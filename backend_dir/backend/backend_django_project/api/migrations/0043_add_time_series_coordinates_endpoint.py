from django.db import migrations


def create_endpoints(apps, schema_editor):
    Endpoint = apps.get_model('api', 'Endpoint')
    Endpoint.objects.create(
        path='/api/time-series/<PATH_PARAM>/coordinates', method='GET')


def create_endpoints_clusters(apps, schema_editor):
    EndPointsCluster = apps.get_model('api', 'EndPointsCluster')
    Resource = apps.get_model('api', 'Resource')
    Endpoint = apps.get_model('api', 'Endpoint')
    ClusterType = apps.get_model('api', 'ClusterType')

    # the coordinates query is a read, same cluster as GET /api/time-series/<id>
    station_read = EndPointsCluster.objects.get(
        resource=Resource.objects.get(name='stations'),
        role_type='FRONT AND API',
        cluster_type=ClusterType.objects.get(name='read')
    )
    station_read.endpoints.add(
        Endpoint.objects.get(
            path="/api/time-series/<PATH_PARAM>/coordinates", method="GET"))


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0042_add_edit_jump_put_endpoint'),
    ]

    operations = [
        migrations.RunPython(create_endpoints),
        migrations.RunPython(create_endpoints_clusters),
    ]
