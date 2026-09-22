from django.db import migrations


DESCRIPTIONS = {
    ('earthquakes', 'read'): "View earthquake data and affected stations",
    ('campaigns', 'read'): "View campaigns and visits (also included in Stations)",
    ('campaigns', 'read-write'): "View and edit campaigns and visits (also included in Stations)",
    ('users', 'read'): "View users and roles",
    ('users', 'read-write'): "View and edit users and roles",
    ('overview', 'read'): "View people, monument types, station status/colors (also included in Stations)",
    ('overview', 'read-write'): "View and edit people, monument types, station status/colors (also included in Stations)",
    ('stations', 'read'): "View stations, plus campaigns, visits, sources, people and catalogs",
    ('stations', 'read-create'): "View stations (as above), plus create stations",
    ('stations', 'read-write'): "View and edit stations, plus campaigns, visits, sources, people and catalogs",
    ('sources-servers', 'read'): "View source servers and formats (also included in Stations)",
    ('sources-servers', 'read-write'): "View and edit source servers and formats (also included in Stations)",
    ('reference-frames', 'read'): "View the reference frames catalog",
    ('transfer-visits', 'read-write'): "Transfer visits between stations",
    ('planned-visits-status', 'read-write'): "Auto-mark planned visits as done",
}


def set_descriptions(apps, schema_editor):
    EndPointsCluster = apps.get_model('api', 'EndPointsCluster')

    for (resource_name, cluster_type_name), description in DESCRIPTIONS.items():
        EndPointsCluster.objects.filter(
            resource__name=resource_name, cluster_type__name=cluster_type_name
        ).update(description=description)


def clear_descriptions(apps, schema_editor):
    EndPointsCluster = apps.get_model('api', 'EndPointsCluster')

    for resource_name, cluster_type_name in DESCRIPTIONS:
        EndPointsCluster.objects.filter(
            resource__name=resource_name, cluster_type__name=cluster_type_name
        ).update(description='')


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0062_add_station_status_color_to_stations_clusters'),
    ]

    operations = [
        migrations.RunPython(set_descriptions, clear_descriptions),
    ]
