from django.db import migrations


REPORT_HTML_ENDPOINT = '/api/stations/<PATH_PARAM>/get-report-html'


def create_endpoint(apps, schema_editor):
    Endpoint = apps.get_model('api', 'Endpoint')
    # get_or_create: avoid failing on the unique (path, method) if it was added by hand
    Endpoint.objects.get_or_create(path=REPORT_HTML_ENDPOINT, method='GET')


def edit_endpoints_clusters(apps, schema_editor):
    EndPointsCluster = apps.get_model('api', 'EndPointsCluster')
    Resource = apps.get_model('api', 'Resource')
    Endpoint = apps.get_model('api', 'Endpoint')
    ClusterType = apps.get_model('api', 'ClusterType')

    endpoint = Endpoint.objects.get(path=REPORT_HTML_ENDPOINT, method='GET')

    # same clusters as GET /api/stations/<PATH_PARAM>/get-kmz (0041)
    for cluster_type_name in ('read', 'read-create', 'read-write'):
        cluster = EndPointsCluster.objects.get(
            resource=Resource.objects.get(name='stations'),
            role_type='FRONT AND API',
            cluster_type=ClusterType.objects.get(name=cluster_type_name)
        )
        cluster.endpoints.add(endpoint)


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0046_remove_networks_delete_endpoint'),
    ]

    operations = [
        migrations.RunPython(create_endpoint),
        migrations.RunPython(edit_endpoints_clusters),
    ]
