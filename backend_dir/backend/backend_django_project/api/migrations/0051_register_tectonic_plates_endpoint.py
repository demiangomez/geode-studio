from django.db import migrations


TECTONIC_PLATES_ENDPOINT = '/api/tectonic-plates'


def create_endpoint(apps, schema_editor):
    Endpoint = apps.get_model('api', 'Endpoint')
    # get_or_create: avoid failing on the unique (path, method) if it was added by hand
    Endpoint.objects.get_or_create(path=TECTONIC_PLATES_ENDPOINT, method='GET')


def edit_endpoints_clusters(apps, schema_editor):
    EndPointsCluster = apps.get_model('api', 'EndPointsCluster')
    Resource = apps.get_model('api', 'Resource')
    Endpoint = apps.get_model('api', 'Endpoint')
    ClusterType = apps.get_model('api', 'ClusterType')

    endpoint = Endpoint.objects.get(
        path=TECTONIC_PLATES_ENDPOINT, method='GET')

    # 'overview' because it is static reference data for the map, same shelf as
    # GET /api/station-types and GET /api/station-status, which the map already
    # needs to render. It has no read-create cluster.
    for cluster_type_name in ('read', 'read-write'):
        cluster = EndPointsCluster.objects.get(
            resource=Resource.objects.get(name='overview'),
            role_type='FRONT AND API',
            cluster_type=ClusterType.objects.get(name=cluster_type_name)
        )
        cluster.endpoints.add(endpoint)


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0050_remove_stationtype_search_icon_on_assets_folder'),
    ]

    operations = [
        migrations.RunPython(create_endpoint),
        migrations.RunPython(edit_endpoints_clusters),
    ]
