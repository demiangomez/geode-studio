from django.db import migrations, models
import django.contrib.postgres.fields
import django.db.models.functions.datetime


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0059_register_rinex_download_endpoint'),
    ]

    operations = [
        migrations.CreateModel(
            name='ReferenceFrames',
            fields=[
                ('frame_name', models.CharField(max_length=20)),
                ('engine', models.CharField(
                    choices=[('gamit', 'gamit'), ('pages', 'pages')], max_length=10)),
                ('project', models.CharField(max_length=20)),
                ('fixed_plate', models.CharField(
                    blank=True, max_length=2, null=True)),
                ('constraints_id', models.CharField(
                    blank=True, max_length=20, null=True)),
                ('position_wrms', models.DecimalField(
                    blank=True, decimal_places=5, max_digits=8, null=True)),
                ('velocity_wrms', models.DecimalField(
                    blank=True, decimal_places=5, max_digits=8, null=True)),
                ('periodic_wrms', django.contrib.postgres.fields.ArrayField(
                    base_field=models.DecimalField(decimal_places=5, max_digits=8),
                    blank=True, null=True, size=None)),
                ('euler_pole', django.contrib.postgres.fields.ArrayField(
                    base_field=models.DecimalField(decimal_places=50, max_digits=150),
                    blank=True, null=True, size=None)),
                ('euler_pole_stations', django.contrib.postgres.fields.ArrayField(
                    base_field=models.CharField(max_length=8), blank=True, null=True, size=None)),
                ('first_epoch', models.DateTimeField(blank=True, null=True)),
                ('last_epoch', models.DateTimeField(blank=True, null=True)),
                ('created', models.DateTimeField(
                    db_default=django.db.models.functions.datetime.Now(), editable=False)),
                ('modified', models.DateTimeField(
                    db_default=django.db.models.functions.datetime.Now(), editable=False)),
                ('api_id', models.AutoField(primary_key=True, serialize=False)),
            ],
            options={
                'db_table': 'reference_frames',
                'ordering': ['frame_name'],
                'managed': False,
                'unique_together': {('frame_name', 'engine')},
            },
        ),
    ]
