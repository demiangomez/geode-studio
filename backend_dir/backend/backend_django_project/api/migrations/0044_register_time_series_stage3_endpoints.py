from django.db import migrations


# read-only catalogs (combos populated from geode): same cluster as available-jump-types
READ_ENDPOINTS = [
    '/api/time-series-config/mode-obs-types',
    '/api/time-series-config/solution-types',
    '/api/time-series-config/adjustment-options',
]

# copy_params toggle (write): same cluster as set-jumps. solution is uppercase in the path
READ_WRITE_ENDPOINTS = [
    '/api/time-series-config/<PATH_PARAM>/GAMIT/set-copy-params',
    '/api/time-series-config/<PATH_PARAM>/PPP/set-copy-params',
]


def create_endpoints(apps, schema_editor):
    Endpoint = apps.get_model('api', 'Endpoint')
    # get_or_create: these were added in code but never registered; some may already
    # exist (e.g. registered by hand), so avoid failing on the unique (path, method)
    for path in READ_ENDPOINTS:
        Endpoint.objects.get_or_create(path=path, method='GET')
    for path in READ_WRITE_ENDPOINTS:
        Endpoint.objects.get_or_create(path=path, method='POST')


def create_endpoints_clusters(apps, schema_editor):
    EndPointsCluster = apps.get_model('api', 'EndPointsCluster')
    Resource = apps.get_model('api', 'Resource')
    Endpoint = apps.get_model('api', 'Endpoint')
    ClusterType = apps.get_model('api', 'ClusterType')

    station_read = EndPointsCluster.objects.get(
        resource=Resource.objects.get(name='stations'),
        role_type='FRONT AND API',
        cluster_type=ClusterType.objects.get(name='read')
    )
    for path in READ_ENDPOINTS:
        station_read.endpoints.add(
            Endpoint.objects.get(path=path, method='GET'))

    station_read_write = EndPointsCluster.objects.get(
        resource=Resource.objects.get(name='stations'),
        role_type='FRONT AND API',
        cluster_type=ClusterType.objects.get(name='read-write')
    )
    for path in READ_WRITE_ENDPOINTS:
        station_read_write.endpoints.add(
            Endpoint.objects.get(path=path, method='POST'))


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0043_add_time_series_coordinates_endpoint'),
    ]

    operations = [
        migrations.RunPython(create_endpoints),
        migrations.RunPython(create_endpoints_clusters),
    ]
