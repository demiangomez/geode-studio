from django.db import migrations


def add_endpoint(apps, schema_editor):
    EndPointsCluster = apps.get_model('api', 'EndPointsCluster')
    Resource = apps.get_model('api', 'Resource')
    Endpoint = apps.get_model('api', 'Endpoint')

    endpoint = Endpoint.objects.get(path='/api/station-status-color', method='GET')

    for cluster in EndPointsCluster.objects.filter(resource=Resource.objects.get(name='stations')):
        cluster.endpoints.add(endpoint)


def remove_endpoint(apps, schema_editor):
    EndPointsCluster = apps.get_model('api', 'EndPointsCluster')
    Resource = apps.get_model('api', 'Resource')
    Endpoint = apps.get_model('api', 'Endpoint')

    endpoint = Endpoint.objects.get(path='/api/station-status-color', method='GET')

    for cluster in EndPointsCluster.objects.filter(resource=Resource.objects.get(name='stations')):
        cluster.endpoints.remove(endpoint)


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0061_register_reference_frames_endpoints'),
    ]

    operations = [
        migrations.RunPython(add_endpoint, remove_endpoint),
    ]
