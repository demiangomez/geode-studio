from django.db import migrations


def remove_endpoint(apps, schema_editor):
    Endpoint = apps.get_model('api', 'Endpoint')
    # NetworkDetail no longer supports DELETE (RetrieveUpdateAPIView), so the
    # endpoint registered in 0002 is dead: remove it from the permissions catalog.
    # filter().delete(): idempotent, and clears any cluster assignment (m2m) too.
    Endpoint.objects.filter(
        path='/api/networks/<PATH_PARAM>', method='DELETE').delete()


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0045_register_bulk_download_endpoint'),
    ]

    operations = [
        migrations.RunPython(remove_endpoint),
    ]
