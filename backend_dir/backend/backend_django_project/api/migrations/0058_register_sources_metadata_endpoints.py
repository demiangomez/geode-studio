from django.db import migrations


SOURCES_METADATA_ENDPOINTS = [
    ('/api/sources-metadata', 'GET'),
    ('/api/sources-metadata/<PATH_PARAM>', 'GET'),
    ('/api/sources-metadata', 'POST'),
    ('/api/sources-metadata/<PATH_PARAM>', 'PUT'),
    ('/api/sources-metadata/<PATH_PARAM>', 'PATCH'),
    ('/api/sources-metadata/<PATH_PARAM>', 'DELETE'),
]
READ_ENDPOINTS = SOURCES_METADATA_ENDPOINTS[:2]


def create_endpoints(apps, schema_editor):
    Endpoint = apps.get_model('api', 'Endpoint')
    for path, method in SOURCES_METADATA_ENDPOINTS:
        # get_or_create: avoid failing on the unique (path, method) if it was added by hand
        Endpoint.objects.get_or_create(path=path, method=method)


def edit_endpoints_clusters(apps, schema_editor):
    EndPointsCluster = apps.get_model('api', 'EndPointsCluster')
    Resource = apps.get_model('api', 'Resource')
    Endpoint = apps.get_model('api', 'Endpoint')
    ClusterType = apps.get_model('api', 'ClusterType')

    def add_to_cluster(resource_name, cluster_type_name, endpoints):
        cluster = EndPointsCluster.objects.get(
            resource=Resource.objects.get(name=resource_name),
            role_type='FRONT AND API',
            cluster_type=ClusterType.objects.get(name=cluster_type_name)
        )
        for path, method in endpoints:
            cluster.endpoints.add(Endpoint.objects.get(path=path, method=method))

    # same clusters as /api/sources-servers and /api/sources-formats
    add_to_cluster('sources-servers', 'read', READ_ENDPOINTS)
    add_to_cluster('sources-servers', 'read-write', SOURCES_METADATA_ENDPOINTS)
    # the station page reads the metadata source of each server (like the sources-servers GETs)
    for cluster_type_name in ('read', 'read-create', 'read-write'):
        add_to_cluster('stations', cluster_type_name, READ_ENDPOINTS)


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0057_sources_metadata'),
    ]

    operations = [
        migrations.RunPython(create_endpoints),
        migrations.RunPython(edit_endpoints_clusters),
    ]
