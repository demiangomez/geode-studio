from django.db import migrations


def create_endpoints(apps, schema_editor):
    Endpoint = apps.get_model('api', 'Endpoint')
    api_routes = [
        ('/api/time-series-config/<PATH_PARAM>/GAMIT/set-jumps', 'PUT'),
        ('/api/time-series-config/<PATH_PARAM>/PPP/set-jumps', 'PUT'),
    ]
    for path, method in api_routes:
        Endpoint.objects.create(path=path, method=method)


def create_endpoints_clusters(apps, schema_editor):
    EndPointsCluster = apps.get_model('api', 'EndPointsCluster')
    Resource = apps.get_model('api', 'Resource')
    Endpoint = apps.get_model('api', 'Endpoint')
    ClusterType = apps.get_model('api', 'ClusterType')

    # editing a jump (PUT) lives in the same cluster as creating one (set-jumps POST)
    station_read_write = EndPointsCluster.objects.get(
        resource=Resource.objects.get(name='stations'),
        role_type='FRONT AND API',
        cluster_type=ClusterType.objects.get(name='read-write')
    )
    station_read_write.endpoints.add(
        Endpoint.objects.get(
            path="/api/time-series-config/<PATH_PARAM>/PPP/set-jumps", method="PUT"))
    station_read_write.endpoints.add(
        Endpoint.objects.get(
            path="/api/time-series-config/<PATH_PARAM>/GAMIT/set-jumps", method="PUT"))


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0041_auto_20250901_1335'),
    ]

    operations = [
        migrations.RunPython(create_endpoints),
        migrations.RunPython(create_endpoints_clusters),
    ]
