from django.db import migrations


GAMIT_PROJECTS_READ_ENDPOINTS = [
    ('/api/gamit-projects', 'GET'),
    ('/api/gamit-projects/<PATH_PARAM>', 'GET'),
    # resolves stations to a station_list; a query (nothing is created), so also
    # granted to read-only roles to visualize a project's stations on the map
    ('/api/processing-station-list', 'POST'),
]

GAMIT_PROJECTS_WRITE_ENDPOINTS = [
    ('/api/gamit-projects', 'POST'),
    ('/api/gamit-projects/<PATH_PARAM>', 'PUT'),
    ('/api/gamit-projects/<PATH_PARAM>', 'PATCH'),
    ('/api/gamit-projects/<PATH_PARAM>', 'DELETE'),
]

DESCRIPTIONS = {
    'read': "View GAMIT projects and resolve stations to a processing station list",
    'read-write': "View, create, edit and delete GAMIT projects (deleting also deletes its GAMIT solutions)",
}


def create_resource(apps, schema_editor):
    Resource = apps.get_model('api', 'Resource')
    # "Processing and Frames" menu, next to reference-frames
    Resource.objects.get_or_create(name='gamit-projects')


def create_endpoints(apps, schema_editor):
    Endpoint = apps.get_model('api', 'Endpoint')
    for path, method in GAMIT_PROJECTS_READ_ENDPOINTS + GAMIT_PROJECTS_WRITE_ENDPOINTS:
        # get_or_create: avoid failing on the unique (path, method) if it was added by hand
        Endpoint.objects.get_or_create(path=path, method=method)


def create_endpoints_clusters(apps, schema_editor):
    EndPointsCluster = apps.get_model('api', 'EndPointsCluster')
    Resource = apps.get_model('api', 'Resource')
    Endpoint = apps.get_model('api', 'Endpoint')
    ClusterType = apps.get_model('api', 'ClusterType')

    resource = Resource.objects.get(name='gamit-projects')

    read = EndPointsCluster.objects.create(
        resource=resource, role_type='FRONT AND API',
        cluster_type=ClusterType.objects.get(name='read'),
        description=DESCRIPTIONS['read'])
    for path, method in GAMIT_PROJECTS_READ_ENDPOINTS:
        read.endpoints.add(Endpoint.objects.get(path=path, method=method))

    read_write = EndPointsCluster.objects.create(
        resource=resource, role_type='FRONT AND API',
        cluster_type=ClusterType.objects.get(name='read-write'),
        description=DESCRIPTIONS['read-write'])
    for path, method in GAMIT_PROJECTS_READ_ENDPOINTS + GAMIT_PROJECTS_WRITE_ENDPOINTS:
        read_write.endpoints.add(Endpoint.objects.get(path=path, method=method))


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0064_gamit_projects'),
    ]

    operations = [
        migrations.RunPython(create_resource),
        migrations.RunPython(create_endpoints),
        migrations.RunPython(create_endpoints_clusters),
    ]
