from django.db import migrations


BULK_DOWNLOAD_ENDPOINT = '/api/time-series/bulk-download'


def create_endpoint(apps, schema_editor):
    Endpoint = apps.get_model('api', 'Endpoint')
    # get_or_create: avoid failing on the unique (path, method) if it was added by hand
    Endpoint.objects.get_or_create(path=BULK_DOWNLOAD_ENDPOINT, method='POST')


def create_endpoints_cluster(apps, schema_editor):
    EndPointsCluster = apps.get_model('api', 'EndPointsCluster')
    Resource = apps.get_model('api', 'Resource')
    Endpoint = apps.get_model('api', 'Endpoint')
    ClusterType = apps.get_model('api', 'ClusterType')

    # bulk download is an export/read, same cluster as GET /api/time-series/<id>
    station_read = EndPointsCluster.objects.get(
        resource=Resource.objects.get(name='stations'),
        role_type='FRONT AND API',
        cluster_type=ClusterType.objects.get(name='read')
    )
    station_read.endpoints.add(
        Endpoint.objects.get(path=BULK_DOWNLOAD_ENDPOINT, method='POST'))


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0044_register_time_series_stage3_endpoints'),
    ]

    operations = [
        migrations.RunPython(create_endpoint),
        migrations.RunPython(create_endpoints_cluster),
    ]
