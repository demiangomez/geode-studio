"""
Bridges django-auditlog to the 'events' table: every LogEntry created for a
station-metadata model produces an Events record with event_type='meta', so
metadata changes can be isolated from the rest of the events.

Stationinfo is NOT bridged here on purpose: its views already create their own
(more specific) events through EventManager, which keep the original
event_type='info'.
"""
import logging
from decimal import Decimal, InvalidOperation

from auditlog.models import LogEntry
from django.db.models import Model
from django.db.models.signals import post_save
from django.dispatch import receiver

from api import models

logger = logging.getLogger(__name__)

# StationMeta fields maintained automatically (gaps client / stationinfo sync),
# not user edits: changes touching only these must not create events
AUTOMATED_STATION_META_FIELDS = {
    'has_gaps', 'has_gaps_update_needed', 'has_gaps_last_update_datetime', 'has_stationinfo'}

# pks and station/visit FKs are left out of the description: the station is
# already on the event's NetworkCode/StationCode columns
EXCLUDED_DESCRIPTION_FIELDS = {'api_id', 'id', 'station', 'visit'}

# guards against huge values (e.g. stations.harpos_coeff_otl)
MAX_DESCRIPTION_VALUE_LENGTH = 200


def _old_value(log_entry, field):
    """Value a field had before the change, from the LogEntry changes dict.

    Used when the instance was deleted and can no longer be queried."""
    value = (log_entry.changes or {}).get(field, [None, None])[0]

    return None if value in (None, 'None') else value


def _source_object(log_entry):
    """The instance the LogEntry was created for, or None if it was deleted
    (LogEntry has no GenericForeignKey accessor)."""
    return log_entry.content_type.model_class()._default_manager.filter(
        pk=log_entry.object_pk).first()


def _station_codes(station_pk):
    station = models.Stations.objects.filter(pk=station_pk).first()

    return (station.network_code_id, station.station_code) if station else (None, None)


def _resolve_stations(log_entry):
    station = _source_object(log_entry)

    if station is not None:
        return station.network_code_id, station.station_code

    return _old_value(log_entry, 'network_code'), _old_value(log_entry, 'station_code')


def _resolve_sources_stations(log_entry):
    source_station = _source_object(log_entry)

    if source_station is not None:
        return source_station.network_code, source_station.station_code

    return _old_value(log_entry, 'network_code'), _old_value(log_entry, 'station_code')


def _resolve_by_station_fk(log_entry):
    instance = _source_object(log_entry)

    return _station_codes(instance.station_id if instance is not None else _old_value(log_entry, 'station'))


def _resolve_by_visit_fk(log_entry):
    instance = _source_object(log_entry)

    visit_pk = instance.visit_id if instance is not None else _old_value(
        log_entry, 'visit')
    visit = models.Visits.objects.filter(pk=visit_pk).first()

    return _station_codes(visit.station_id) if visit else (None, None)


# content_type.model -> (label used in the description, station resolver)
METADATA_MODELS = {
    'stations': ('station', _resolve_stations),
    'stationmeta': ('station metadata', _resolve_by_station_fk),
    'stationattachedfiles': ('station attached file', _resolve_by_station_fk),
    'stationimages': ('station image', _resolve_by_station_fk),
    'visits': ('visit', _resolve_by_station_fk),
    'visitimages': ('visit image', _resolve_by_visit_fk),
    'visitattachedfiles': ('visit attached file', _resolve_by_visit_fk),
    'visitgnssdatafiles': ('visit GNSS data file', _resolve_by_visit_fk),
    'sourcesstations': ('station data source', _resolve_sources_stations),
}


def _short(value):
    value = str(value)

    return value[:MAX_DESCRIPTION_VALUE_LENGTH] + '...' if len(value) > MAX_DESCRIPTION_VALUE_LENGTH else value


def _phantom_change(old, new):
    """BaseModel strips trailing zeros from decimals on load, so every save
    logs spurious diffs like '1.50' -> '1.5': skip numerically equal changes."""
    try:
        return Decimal(old) == Decimal(new)
    except (InvalidOperation, TypeError, ValueError):
        return False


def _fk_display_value(fk_field, value):
    """FK changes come as raw ids: resolve them to the related object's name
    (e.g. monument_type: 4 -> Pillar). Falls back to the raw value when the
    related record is gone or has no readable representation."""
    if value in (None, 'None', ''):
        return value

    related = fk_field.related_model._default_manager.filter(
        **{fk_field.target_field.name: value}).first()

    if related is None:
        return value

    if getattr(related, 'name', ''):
        return related.name

    if type(related).__str__ is not Model.__str__:
        return str(related)

    return value


def _build_description(log_entry, label):
    """Readable description of the change, or None if there is nothing real to
    report (an update whose only changes are phantom decimal diffs)."""
    changes = {field: values for field, values in (log_entry.changes or {}).items()
               if field not in EXCLUDED_DESCRIPTION_FIELDS}

    fk_fields = {field.name: field for field in
                 log_entry.content_type.model_class()._meta.fields if field.many_to_one}

    def display(field, value):
        if field in fk_fields:
            value = _fk_display_value(fk_fields[field], value)
        return _short(value)

    by_user = f' by {log_entry.actor.get_username()}' if log_entry.actor_id else ''

    if log_entry.action == LogEntry.Action.CREATE:
        details = '; '.join(f'{field}: {display(field, new)}' for field, (old, new) in changes.items()
                            if new not in (None, 'None', ''))
        return f'A new {label} record was added{by_user}: {details}'

    if log_entry.action == LogEntry.Action.UPDATE:
        changes = {field: values for field, values in changes.items()
                   if not _phantom_change(*values)}
        if not changes:
            return None
        details = '; '.join(
            f'{field}: {display(field, old)} -> {display(field, new)}' for field, (old, new) in changes.items())
        return f'The {label} record has been updated{by_user}: {details}'

    details = '; '.join(f'{field}: {display(field, old)}' for field, (old, new) in changes.items()
                        if old not in (None, 'None', ''))
    return f'The {label} record has been deleted{by_user}: {details}'


@receiver(post_save, sender=LogEntry, dispatch_uid='log_metadata_change_to_events')
def log_metadata_change_to_events(sender, instance, created, **kwargs):
    if not created:
        return

    try:
        model_config = METADATA_MODELS.get(instance.content_type.model)

        if model_config is None:
            return

        if (instance.content_type.model == 'stationmeta'
                and set(instance.changes or {}) <= AUTOMATED_STATION_META_FIELDS):
            return

        label, resolve_station = model_config
        description = _build_description(instance, label)

        if description is None:
            return

        network_code, station_code = resolve_station(instance)

        # imported here to avoid a circular import (views imports models)
        from api.views import EventManager

        EventManager.create_event(event_type='meta',
                                  network_code=network_code,
                                  station_code=station_code,
                                  description=description,
                                  module='api.signals.log_metadata_change_to_events')
    except Exception:
        # the event is best-effort: never break the request that made the change
        logger.exception(
            'Could not create meta event for LogEntry %s', instance.pk)
