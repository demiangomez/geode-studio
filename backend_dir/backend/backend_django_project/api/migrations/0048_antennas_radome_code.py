from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0047_register_station_report_html_endpoint'),
    ]

    operations = [
        migrations.AddField(
            model_name='antennas',
            name='radome_code',
            field=models.CharField(db_column='RadomeCode', max_length=7),
        ),
    ]
