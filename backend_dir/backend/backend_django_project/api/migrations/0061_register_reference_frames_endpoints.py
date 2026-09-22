from django.db import migrations


REFERENCE_FRAMES_ENDPOINTS = [
    ('/api/reference-frames', 'GET'),
    ('/api/reference-frames/<PATH_PARAM>', 'GET'),
]


def create_resource(apps, schema_editor):
    Resource = apps.get_model('api', 'Resource')
    Resource.objects.get_or_create(name='reference-frames')


def create_endpoints(apps, schema_editor):
    Endpoint = apps.get_model('api', 'Endpoint')
    for path, method in REFERENCE_FRAMES_ENDPOINTS:
        Endpoint.objects.get_or_create(path=path, method=method)


def create_endpoints_clusters(apps, schema_editor):
    EndPointsCluster = apps.get_model('api', 'EndPointsCluster')
    Resource = apps.get_model('api', 'Resource')
    Endpoint = apps.get_model('api', 'Endpoint')
    ClusterType = apps.get_model('api', 'ClusterType')

    resource = Resource.objects.get(name='reference-frames')

    read = EndPointsCluster.objects.create(
        resource=resource, role_type='FRONT AND API',
        cluster_type=ClusterType.objects.get(name='read'))
    for path, method in REFERENCE_FRAMES_ENDPOINTS:
        read.endpoints.add(Endpoint.objects.get(path=path, method=method))


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0060_reference_frames'),
    ]

    operations = [
        migrations.RunPython(create_resource),
        migrations.RunPython(create_endpoints),
        migrations.RunPython(create_endpoints_clusters),
    ]
