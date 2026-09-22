from django.db import migrations


# the planner and the geocoder create nothing: also granted to read-only roles
CAMPAIGN_PLANS_READ_ENDPOINTS = [
    ('/api/campaign-plans', 'GET'),
    ('/api/campaign-plans/<PATH_PARAM>', 'GET'),
    ('/api/campaign-planner', 'POST'),
    ('/api/campaign-planner/geocode', 'GET'),
]

CAMPAIGN_PLANS_WRITE_ENDPOINTS = [
    ('/api/campaign-plans', 'POST'),
    ('/api/campaign-plans/<PATH_PARAM>', 'PUT'),
    ('/api/campaign-plans/<PATH_PARAM>', 'PATCH'),
    ('/api/campaign-plans/<PATH_PARAM>', 'DELETE'),
]

# the Campaign Planner is a panel of the Campaigns page: its endpoints go into the
# existing campaigns clusters (no resource of their own, and not into Stations)
DESCRIPTIONS = {
    'read': "View campaigns and visits (also included in Stations), and campaign plans",
    'read-write': "View and edit campaigns and visits (also included in Stations), and campaign plans",
}

PREVIOUS_DESCRIPTIONS = {
    'read': "View campaigns and visits (also included in Stations)",
    'read-write': "View and edit campaigns and visits (also included in Stations)",
}

CLUSTERS_ENDPOINTS = {
    'read': CAMPAIGN_PLANS_READ_ENDPOINTS,
    'read-write': CAMPAIGN_PLANS_READ_ENDPOINTS + CAMPAIGN_PLANS_WRITE_ENDPOINTS,
}


def create_endpoints(apps, schema_editor):
    Endpoint = apps.get_model('api', 'Endpoint')
    for path, method in CAMPAIGN_PLANS_READ_ENDPOINTS + CAMPAIGN_PLANS_WRITE_ENDPOINTS:
        Endpoint.objects.get_or_create(path=path, method=method)


def add_endpoints_to_campaigns_clusters(apps, schema_editor):
    EndPointsCluster = apps.get_model('api', 'EndPointsCluster')
    Endpoint = apps.get_model('api', 'Endpoint')

    for cluster_type_name, endpoints in CLUSTERS_ENDPOINTS.items():
        for cluster in EndPointsCluster.objects.filter(
                resource__name='campaigns', cluster_type__name=cluster_type_name):
            for path, method in endpoints:
                cluster.endpoints.add(Endpoint.objects.get(path=path, method=method))
            cluster.description = DESCRIPTIONS[cluster_type_name]
            cluster.save()


def remove_endpoints(apps, schema_editor):
    EndPointsCluster = apps.get_model('api', 'EndPointsCluster')
    Endpoint = apps.get_model('api', 'Endpoint')

    for cluster_type_name in CLUSTERS_ENDPOINTS:
        EndPointsCluster.objects.filter(
            resource__name='campaigns', cluster_type__name=cluster_type_name
        ).update(description=PREVIOUS_DESCRIPTIONS[cluster_type_name])

    for path, method in CAMPAIGN_PLANS_READ_ENDPOINTS + CAMPAIGN_PLANS_WRITE_ENDPOINTS:
        # removes the endpoint from every cluster too
        Endpoint.objects.filter(path=path, method=method).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0066_campaign_plans'),
    ]

    operations = [
        migrations.RunPython(create_endpoints, migrations.RunPython.noop),
        migrations.RunPython(add_endpoints_to_campaigns_clusters, remove_endpoints),
    ]
