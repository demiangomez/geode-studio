from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0051_register_tectonic_plates_endpoint'),
    ]

    operations = [
        migrations.AddField(
            model_name='stations',
            name='plate',
            field=models.CharField(blank=True, max_length=2, null=True),
        ),
    ]
