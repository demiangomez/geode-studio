from django.db import migrations


# distinct-antenna-codes existed before but was never registered in the
# permissions catalog (only worked for allow_all roles); fixing that here
# alongside the new distinct-radome-codes endpoint.
DISTINCT_CODES_ENDPOINTS = [
    ('/api/distinct-antenna-codes', 'GET'),
    ('/api/distinct-radome-codes', 'GET'),
]


def create_endpoints(apps, schema_editor):
    Endpoint = apps.get_model('api', 'Endpoint')
    for path, method in DISTINCT_CODES_ENDPOINTS:
        # get_or_create: avoid failing on the unique (path, method) if it was added by hand
        Endpoint.objects.get_or_create(path=path, method=method)


def edit_endpoints_clusters(apps, schema_editor):
    EndPointsCluster = apps.get_model('api', 'EndPointsCluster')
    Resource = apps.get_model('api', 'Resource')
    Endpoint = apps.get_model('api', 'Endpoint')
    ClusterType = apps.get_model('api', 'ClusterType')

    # same clusters as GET /api/distinct-stack-names/<PATH_PARAM>
    for cluster_type_name in ('read', 'read-create', 'read-write'):
        cluster = EndPointsCluster.objects.get(
            resource=Resource.objects.get(name='stations'),
            role_type='FRONT AND API',
            cluster_type=ClusterType.objects.get(name=cluster_type_name)
        )
        for path, method in DISTINCT_CODES_ENDPOINTS:
            cluster.endpoints.add(
                Endpoint.objects.get(path=path, method=method))


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0048_antennas_radome_code'),
    ]

    operations = [
        migrations.RunPython(create_endpoints),
        migrations.RunPython(edit_endpoints_clusters),
    ]
