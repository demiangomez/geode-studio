from django.db import migrations


TRANSFER_VISITS_ENDPOINT = '/api/visits/transfer'


def create_endpoint(apps, schema_editor):
    Endpoint = apps.get_model('api', 'Endpoint')
    # get_or_create: avoid failing on the unique (path, method) if it was added by hand
    Endpoint.objects.get_or_create(path=TRANSFER_VISITS_ENDPOINT, method='POST')


def create_endpoints_cluster(apps, schema_editor):
    EndPointsCluster = apps.get_model('api', 'EndPointsCluster')
    Resource = apps.get_model('api', 'Resource')
    Endpoint = apps.get_model('api', 'Endpoint')
    ClusterType = apps.get_model('api', 'ClusterType')

    # own resource/cluster so transferring visits is a special permission, granted on
    # its own: it is NOT added to the 'visits' clusters and NOT assigned to any role
    # here. Until an admin adds this cluster to a role, only allow_all roles can use it.
    resource, _ = Resource.objects.get_or_create(name='transfer-visits')

    cluster, _ = EndPointsCluster.objects.get_or_create(
        resource=resource,
        cluster_type=ClusterType.objects.get(name='read-write'),
        role_type='FRONT AND API')

    cluster.endpoints.add(Endpoint.objects.get(
        path=TRANSFER_VISITS_ENDPOINT, method='POST'))


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0055_update_planned_visits_status_endpoint'),
    ]

    operations = [
        migrations.RunPython(create_endpoint),
        migrations.RunPython(create_endpoints_cluster),
    ]
