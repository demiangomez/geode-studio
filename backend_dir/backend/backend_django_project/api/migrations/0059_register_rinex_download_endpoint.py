from django.db import migrations


RINEX_DOWNLOAD_ENDPOINT = '/api/rinex/<PATH_PARAM>/download'


def create_endpoint(apps, schema_editor):
    Endpoint = apps.get_model('api', 'Endpoint')
    # get_or_create: avoid failing on the unique (path, method) if it was added by hand
    Endpoint.objects.get_or_create(path=RINEX_DOWNLOAD_ENDPOINT, method='GET')


def edit_endpoints_clusters(apps, schema_editor):
    EndPointsCluster = apps.get_model('api', 'EndPointsCluster')
    Resource = apps.get_model('api', 'Resource')
    Endpoint = apps.get_model('api', 'Endpoint')
    ClusterType = apps.get_model('api', 'ClusterType')

    endpoint = Endpoint.objects.get(path=RINEX_DOWNLOAD_ENDPOINT, method='GET')

    # same clusters as the other rinex GETs (/api/rinex/<PATH_PARAM>/get-previous-station-info)
    for cluster_type_name in ('read', 'read-create', 'read-write'):
        cluster = EndPointsCluster.objects.get(
            resource=Resource.objects.get(name='stations'),
            role_type='FRONT AND API',
            cluster_type=ClusterType.objects.get(name=cluster_type_name)
        )
        cluster.endpoints.add(endpoint)


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0058_register_sources_metadata_endpoints'),
    ]

    operations = [
        migrations.RunPython(create_endpoint),
        migrations.RunPython(edit_endpoints_clusters),
    ]
