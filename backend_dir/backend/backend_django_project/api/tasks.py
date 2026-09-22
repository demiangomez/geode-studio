from celery import shared_task
import time
from . import utils

@shared_task
def update_gaps_status():
    utils.StationMetaUtils.update_gaps_status_for_all_station_meta_needed()


@shared_task
def update_planned_visits_status():
    utils.VisitUtils.update_planned_visits_status()
