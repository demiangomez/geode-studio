import functools
from django.test import TestCase
from . import models
from django.urls import reverse
from django.db import connection
import django.apps
import datetime
import decimal
from unittest import TestCase
from api.utils import StationMetaUtils, VisitUtils, RinexUtils
import gzip
import os
import shutil
import tempfile
from unittest import mock
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.files.storage import default_storage

# tests.py

from django.db import connection
from django.test import TestCase
from . import views
from . import models
import django.contrib.auth.hashers
from django.test import Client
from django.test.client import encode_multipart, BOUNDARY, MULTIPART_CONTENT

class PermissionsTest(TestCase):
    def authenticate_admin(self):
        url = reverse("token_obtain_pair")

        response = self.client.post(
            url, {"username": "admin", "password": "admin"})

        self.assertEqual(response.status_code, 200)

        self.token = response.json()["access"]

        self.assertIsNotNone(self.token)
        self.client.defaults['HTTP_AUTHORIZATION'] = "Bearer " + self.token

    def authenticate_underprivileged_front(self):
        url = reverse("token_obtain_pair")

        response = self.client.post(
            url, {"username": "underprivileged_front", "password": "underprivileged_front"})

        self.assertEqual(response.status_code, 200)

        self.token = response.json()["access"]

        self.assertIsNotNone(self.token)
        self.client.defaults['HTTP_AUTHORIZATION'] = "Bearer " + self.token

    def authenticate_underprivileged_api(self):
        url = reverse("token_obtain_pair")

        response = self.client.post(
            url, {"username": "underprivileged_api", "password": "underprivileged_api"})

        self.assertEqual(response.status_code, 200)

        self.token = response.json()["access"]

        self.assertIsNotNone(self.token)
        self.client.defaults['HTTP_AUTHORIZATION'] = "Bearer " + self.token

    def test_admin_role(self):
        self.authenticate_admin()

        url = reverse("station_list")

        response = self.client.get(url)

        self.assertEqual(response.status_code, 200)

        url = reverse("antennas_list")

        response = self.client.get(url)

        self.assertEqual(response.status_code, 200)

        response = self.client.post(url, {
            "antenna_code": "ANT1",
            "antenna_description": "test description",
            "radome_code": "R1"
        })

        self.assertEqual(response.status_code, 201)

    def test_disabled_role(self):
        self.authenticate_underprivileged_api()

        # test user is enabled

        url = reverse("station_list")

        response = self.client.get(url)

        self.assertEqual(response.status_code, 200)

        # disable role

        self.authenticate_admin()

        url = reverse("role_detail", kwargs={"pk": models.User.objects.get(
            username="underprivileged_api").role.id})

        response = self.client.patch(
            url, data={"is_active": False}, content_type='application/json')

        self.assertEqual(response.status_code, 200)

        self.assertEqual(models.User.objects.get(
            username="underprivileged_api").role.is_active, False)

        # check user is disabled

        url = reverse("token_obtain_pair")

        response = self.client.post(
            url, {"username": "underprivileged_api", "password": "underprivileged_api"})

        self.assertEqual(response.status_code, 401)

        # check user cannot be enable until role is active

        self.authenticate_admin()

        url = reverse("user_detail", kwargs={
                      "pk": models.User.objects.get(username="underprivileged_api").id})

        response = self.client.patch(
            url, data={"is_active": True}, content_type='multipart/form-data')

        self.assertEqual(response.status_code, 400)

        # enable user but not role, check user is unable of accessing the api

        user = models.User.objects.get(username="underprivileged_api")

        user.is_active = True

        user.save()

        self.assertEqual(models.User.objects.get(
            username="underprivileged_api").is_active, True)

        self.authenticate_underprivileged_api()

        url = reverse("station_list")

        response = self.client.get(url)

        self.assertEqual(response.status_code, 403)

        # enable role

        self.authenticate_admin()

        url = reverse("role_detail", kwargs={"pk": models.User.objects.get(
            username="underprivileged_api").role.id})

        response = self.client.patch(
            url, data={"is_active": True}, content_type='application/json')

        self.assertEqual(response.status_code, 200)

        self.authenticate_underprivileged_api()

        url = reverse("station_list")

        response = self.client.get(url)

        self.assertEqual(response.status_code, 200)

    def test_underprivileged_front_role(self):
        self.authenticate_underprivileged_front()

        url = reverse("get_user_photo", kwargs={
                      "pk": models.User.objects.get(username="underprivileged_front").id})

        response = self.client.get(url)

        self.assertIn(response.status_code, [200, 404])

        url = reverse("station_list")

        response = self.client.get(url)

        self.assertEqual(response.status_code, 200)

        response = self.client.post(url, {
            "station_code": "ST1",
            "station_name": "test station"
        })

        self.assertEqual(response.status_code, 403)

        url = reverse("station_meta_list")

        response = self.client.get(url)

        self.assertEqual(response.status_code, 403)

    def test_underprivileged_api_role(self):
        self.authenticate_underprivileged_api()

        url = reverse("get_user_photo", kwargs={
                      "pk": models.User.objects.get(username="underprivileged_api").id})

        response = self.client.get(url)

        self.assertIn(response.status_code, [200, 404])

        url = reverse("station_list")

        response = self.client.get(url)

        self.assertEqual(response.status_code, 200)

        response = self.client.post(url, {
            "station_code": "ST1",
            "station_name": "test station"
        })

        self.assertEqual(response.status_code, 403)

        url = reverse("antennas_list")

        response = self.client.get(url)

        self.assertEqual(response.status_code, 403)


class StationGapsTest(TestCase):
    """
    Test gaps validation when retrieving stations
    """

    def setUp(self):

        def authenticate():
            url = reverse("token_obtain_pair")

            response = self.client.post(
                url, {"username": "admin", "password": "admin"})

            self.assertEqual(response.status_code, 200)

            self.token = response.json()["access"]

            self.assertIsNotNone(self.token)
            self.client.defaults['HTTP_AUTHORIZATION'] = "Bearer " + self.token

        authenticate()

    def test_gaps(self):
        def test_create_antennas():
            url = reverse("antennas_list")
            data = {
                "antenna_code": "ANT1",
                "antenna_description": "test description",
                "radome_code": "R1"
            }
            response = self.client.post(url, data)

            self.assertEqual(models.Antennas.objects.count(), 1)
            self.assertEqual(response.status_code, 201)
            self.assertEqual(response.json()["antenna_code"], 'ANT1')

        def test_create_receivers():
            url = reverse("receivers_list")
            data = {
                "receiver_code": "RC1",
                "receiver_description": "test description"
            }
            response = self.client.post(
                url, data)

            self.assertEqual(models.Receivers.objects.count(), 1)
            self.assertEqual(response.status_code, 201)
            self.assertEqual(response.json()["receiver_code"], 'RC1')

        def test_create_networks():
            url = reverse("network_list")

            data = {
                "network_code": "NT1",
                "network_name": "test network"
            }

            response = self.client.post(
                url, data)

            self.assertEqual(models.Networks.objects.count(), 1)
            self.assertEqual(response.status_code, 201)
            self.assertEqual(response.json()["network_code"], 'NT1')

        def test_create_gamit_htc():
            url = reverse("gamit_htc_list")

            data = {
                "antenna_code": 'ANT1',
                "height_code": 'HT1'
            }

            response = self.client.post(
                url, data)

            self.assertEqual(models.GamitHtc.objects.count(), 1)
            self.assertEqual(response.status_code, 201)
            self.assertEqual(response.json()["height_code"], 'HT1')

        def test_create_station():
            url = reverse("station_list")

            data = {
                "network_code": 'NT1',
                "station_code": 'ST1',
                "station_name": 'test station'
            }

            response = self.client.post(
                url, data)

            self.assertEqual(models.Stations.objects.count(), 1)
            self.assertEqual(response.status_code, 201)
            self.assertEqual(response.json()["station_code"], 'ST1')

            return response.json()["api_id"]

        def test_create_stationmeta(station_api_id):
            url = reverse("station_meta_list")

            data = {
                "station": station_api_id,
            }

            response = self.client.post(
                url, data)

            self.assertEqual(response.status_code, 201)

        def test_create_first_stationinfo():

            url = reverse("station_info_list")

            data = {
                "network_code": 'NT1',
                "station_code": 'ST1',
                "antenna_code": 'ANT1',
                "receiver_code": 'RC1',
                "height_code": 'HT1',
                "country_code": 'USA',
                "date_start": "2020-01-01T00:00:00",
                "date_end": "2021-01-01T00:00:00",
                "radome_code": "R1",
            }

            response = self.client.post(
                url, data)

            self.assertEqual(response.status_code, 201)

        def test_create_second_stationinfo():

            url = reverse("station_info_list")

            # create second stationinfo, creating a gap between the date-end of the first one and the date-start of the second one
            data = {
                "network_code": 'NT1',
                "station_code": 'ST1',
                "antenna_code": 'ANT1',
                "receiver_code": 'RC1',
                "height_code": 'HT1',
                "country_code": 'USA',
                "date_start": "2021-01-02T00:00:00",
                "date_end": "2022-01-01T00:00:00",
                "radome_code": "R1",
            }

            response = self.client.post(
                url, data)

            self.assertEqual(response.status_code, 201)

            self.assertEqual(models.Stationinfo.objects.count(), 2)
            self.assertEqual(response.json()["network_code"], 'NT1')

        def update_has_gaps_status():
            StationMetaUtils.update_has_gaps_status()

        def test_station_doesnt_have_gaps():
            url = reverse("station_list")

            response = self.client.get(url)

            self.assertEqual(response.status_code, 200)

            self.assertEqual(response.json()["data"][0]["has_gaps"], False)

            self.assertEqual(models.StationMetaGaps.objects.filter(station_meta__station=response.json()["data"][0]["api_id"]).exists(), False)

        def test_create_rinex():
            url = reverse("rinex_list")

            data = {
                "network_code": 'NT1',
                "station_code": 'ST1',
                "observation_year": 2021,
                "observation_month": 1,
                "observation_day": 1,
                "observation_doy": 1,
                "observation_f_year": 2021.0013698630137,
                "observation_s_time": "2021-01-01T12:00:00",
                "observation_e_time": "2021-01-01T13:00:00",
                "interval": 15.0,
                "completion": 0.9
            }

            response = self.client.post(
                url, data)

            self.assertEqual(response.status_code, 201)

            data = {
                "network_code": 'NT1',
                "station_code": 'ST1',
                "observation_year": 2021,
                "observation_month": 1,
                "observation_day": 1,
                "observation_doy": 2,
                "observation_f_year": 2021.0013698630137,
                "observation_s_time": "2021-01-01T15:00:00",
                "observation_e_time": "2021-01-01T19:00:00",
                "interval": 15.0,
                "completion": 0.8
            }

            response = self.client.post(
                url, data)

            self.assertEqual(response.status_code, 201)

            # get rinex
            url = reverse("rinex_list")

            response = self.client.get(url)

            self.assertEqual(response.status_code, 200)

            self.assertEqual(models.Rinex.objects.all().count(), 2)

        def test_station_has_gaps(gap_count):

            url = reverse("station_list")

            response = self.client.get(url)

            self.assertEqual(response.status_code, 200)

            self.assertEqual(response.json()["data"][0]["has_gaps"], True)

            self.assertEqual(models.StationMetaGaps.objects.filter(station_meta__station=response.json()["data"][0]["api_id"]).count(), gap_count)

        def test_station_has_gaps_2():

            url = reverse("station_list")

            response = self.client.get(url)

            self.assertEqual(response.status_code, 200)

            self.assertEqual(response.json()["data"][0]["has_gaps"], True)

            gaps = models.StationMetaGaps.objects.filter(station_meta__station=response.json()["data"][0]["api_id"])

            stationinfo_first = models.Stationinfo.objects.all().order_by('date_start').first()

            stationinfo_last = models.Stationinfo.objects.all().order_by('date_start').last()

            self.assertEqual(gaps.count(), 1)

            self.assertEqual(gaps.first().rinex_count, 2)

            self.assertEqual(gaps.first().record_end_date_end.replace(tzinfo=None), stationinfo_first.date_end.replace(tzinfo=None))

            self.assertEqual(gaps.first().record_end_date_start.replace(tzinfo=None), stationinfo_first.date_start.replace(tzinfo=None))

            self.assertEqual(gaps.first().record_start_date_start.replace(tzinfo=None), stationinfo_last.date_start.replace(tzinfo=None))

            self.assertEqual(gaps.first().record_start_date_end.replace(tzinfo=None), stationinfo_last.date_end.replace(tzinfo=None))


        def delete_rinex():
            url = reverse("rinex_detail", kwargs={
                "pk": models.Rinex.objects.all().first().api_id})

            response = self.client.delete(url)

            self.assertEqual(response.status_code, 204)

        def test_create_rinex_before_stationinfo_date():
            url = reverse("rinex_list")

            data = {
                "network_code": 'NT1',
                "station_code": 'ST1',
                "observation_year": 2019,
                "observation_month": 1,
                "observation_day": 1,
                "observation_doy": 1,
                "observation_f_year": 2019.0013698630137,
                "observation_s_time": "2019-01-01T12:00:00",
                "observation_e_time": "2019-01-01T13:00:00",
                "interval": 15.0,
                "completion": 0.6
            }

            response = self.client.post(
                url, data)

            self.assertEqual(response.status_code, 201)

        def test_create_rinex_after_stationinfo_date():
            url = reverse("rinex_list")

            data = {
                "network_code": 'NT1',
                "station_code": 'ST1',
                "observation_year": 2023,
                "observation_month": 1,
                "observation_day": 1,
                "observation_doy": 1,
                "observation_f_year": 2023.0013698630137,
                "observation_s_time": "2023-01-01T12:00:00",
                "observation_e_time": "2023-01-01T13:00:00",
                "interval": 15.0,
                "completion": 0.6
            }

            response = self.client.post(
                url, data)

            self.assertEqual(response.status_code, 201)

        test_create_antennas()
        test_create_receivers()
        test_create_networks()
        test_create_gamit_htc()
        test_create_stationmeta(
            test_create_station())
        test_create_first_stationinfo()
        test_create_second_stationinfo()
        update_has_gaps_status()
        test_station_doesnt_have_gaps()
        test_create_rinex()
        update_has_gaps_status()
        test_station_has_gaps_2()
        delete_rinex()
        delete_rinex()
        update_has_gaps_status()
        test_station_doesnt_have_gaps()
        test_create_rinex_before_stationinfo_date()
        update_has_gaps_status()
        test_station_has_gaps(1)
        delete_rinex()
        test_create_rinex_after_stationinfo_date()
        update_has_gaps_status()
        test_station_has_gaps(1)


class StationInfoTest(TestCase):
    """
    Test validation for creating and updating station info records
    """

    def setUp(self):
        self.authenticate()

    def authenticate(self):
        url = reverse("token_obtain_pair")

        response = self.client.post(
            url, {"username": "admin", "password": "admin"})

        self.assertEqual(response.status_code, 200)

        self.token = response.json()["access"]

        self.assertIsNotNone(self.token)
        self.client.defaults['HTTP_AUTHORIZATION'] = "Bearer " + self.token

    def test_create_initial_data(self):
        def test_create_antennas(self):
            url = reverse("antennas_list")
            # composite PK (antenna_code, radome_code): one row per radome so
            # that stationinfo validation finds both (ANT1, R1) and (ANT1, R2)
            for radome_code in ("R1", "R2"):
                data = {
                    "antenna_code": "ANT1",
                    "antenna_description": "test description",
                    "radome_code": radome_code
                }
                response = self.client.post(url, data)

                self.assertEqual(response.status_code, 201)
                self.assertEqual(response.json()["antenna_code"], 'ANT1')

            self.assertEqual(models.Antennas.objects.count(), 2)

        def test_create_receivers(self):
            url = reverse("receivers_list")
            data = {
                "receiver_code": "RC1",
                "receiver_description": "test description"
            }
            response = self.client.post(
                url, data)

            self.assertEqual(models.Receivers.objects.count(), 1)
            self.assertEqual(response.status_code, 201)
            self.assertEqual(response.json()["receiver_code"], 'RC1')

        def test_create_networks(self):
            url = reverse("network_list")

            data = {
                "network_code": "NT1",
                "network_name": "test network"
            }

            response = self.client.post(
                url, data)

            self.assertEqual(models.Networks.objects.count(), 1)
            self.assertEqual(response.status_code, 201)
            self.assertEqual(response.json()["network_code"], 'NT1')

        def test_create_gamit_htc(self):
            url = reverse("gamit_htc_list")

            data = {
                "antenna_code": 'ANT1',
                "height_code": 'HT1'
            }

            response = self.client.post(
                url, data)

            self.assertEqual(models.GamitHtc.objects.count(), 1)
            self.assertEqual(response.status_code, 201)
            self.assertEqual(response.json()["height_code"], 'HT1')

        def test_create_station(self):
            url = reverse("station_list")

            data = {
                "network_code": 'NT1',
                "station_code": 'ST1',
                "station_name": 'test station'
            }

            response = self.client.post(
                url, data)
        
            self.assertEqual(models.Stations.objects.count(), 1)
            self.assertEqual(response.status_code, 201)
            self.assertEqual(response.json()["station_code"], 'ST1')

        def test_create_station_info(self):
            url = reverse("station_info_list")

            data = {
                "network_code": 'NT1',
                "station_code": 'ST1',
                "antenna_code": 'ANT1',
                "receiver_code": 'RC1',
                "height_code": 'HT1',
                "country_code": 'USA',
                "date_start": "2020-01-01T00:00:00",
                "radome_code": "R1",
            }

            response = self.client.post(
                url, data)

            self.assertEqual(response.status_code, 201)
            self.assertEqual(models.Stationinfo.objects.count(), 1)
            self.assertEqual(response.json()["network_code"], 'NT1')

        test_create_antennas(self)
        test_create_receivers(self)
        test_create_networks(self)
        test_create_gamit_htc(self)
        test_create_station(self)
        test_create_station_info(self)

    def test_stationinfo_create_validation_first_case(self):
        """
            There should be just one station info created,
            but the start date of the existing record should change
        """
        self.test_create_initial_data()

        url = reverse("station_info_list")

        data = {
            "network_code": 'NT1',
            "station_code": 'ST1',
            "antenna_code": 'ANT1',
            "receiver_code": 'RC1',
            "height_code": 'HT1',
            "country_code": 'USA',
            "date_start": "2019-01-01T00:00:00",
            "radome_code": "R1",
        }

        response = self.client.post(
            url, data)

        self.assertEqual(response.status_code, 201)

        # there should be only one station info yet
        self.assertEqual(models.Stationinfo.objects.count(), 1)

        self.assertEqual(models.Stationinfo.objects.all()[
            0].date_start.strftime("%Y-%m-%d %H:%M:%S"), "2019-01-01 00:00:00")

        # check event has been inserted
        self.assertEqual(models.Events.objects.filter(network_code="NT1", station_code="ST1",
                                                      description__contains=f"has been been modified to {models.Stationinfo.objects.all()[0].date_start.strftime('%Y-%m-%d %H:%M:%S')}").exists(), True)

    def test_stationinfo_create_validation_second_case(self):
        """
        """
        self.test_create_initial_data()

        url = reverse("station_info_list")

        data = {
            "network_code": 'NT1',
            "station_code": 'ST1',
            "antenna_code": 'ANT1',
            "receiver_code": 'RC1',
            "height_code": 'HT1',
            "country_code": 'USA',
            "date_start": "2018-01-01T00:00:00",
            "radome_code": "R2",
        }

        response = self.client.post(
            url, data)

        self.assertEqual(response.status_code, 201)

        self.assertEqual(models.Stationinfo.objects.count(), 2)

        self.assertEqual(models.Stationinfo.objects.all()[
            0].date_start.strftime("%Y-%m-%d %H:%M:%S"), "2018-01-01 00:00:00")

        self.assertEqual(models.Stationinfo.objects.all()[0].date_end, models.Stationinfo.objects.all()[
            1].date_start - datetime.timedelta(seconds=1))

        # check event has been inserted
        self.assertEqual(models.Events.objects.filter(network_code="NT1", station_code="ST1",
                                                      description__contains=f"A new station information record was added").exists(), True)

    def test_stationinfo_create_validation_third_case(self):
        """
            Overlap just the last session
        """
        self.test_create_initial_data()

        url = reverse("station_info_list")

        data = {
            "network_code": 'NT1',
            "station_code": 'ST1',
            "antenna_code": 'ANT1',
            "receiver_code": 'RC1',
            "height_code": 'HT1',
            "country_code": 'USA',
            "date_start": "2021-01-01T00:00:00",
            "radome_code": "R2",
        }

        response = self.client.post(
            url, data)

        self.assertEqual(response.status_code, 201)

        self.assertEqual(models.Stationinfo.objects.count(), 2)

        self.assertEqual(models.Stationinfo.objects.all()[
                         0].date_end, models.Stationinfo.objects.all()[
                         1].date_start - datetime.timedelta(seconds=1))

        self.assertEqual(models.Events.objects.all().filter(network_code="NT1", station_code="ST1",
                                                            description__contains=f"The previous DateEnd value was updated to {models.Stationinfo.objects.all()[0].date_end.strftime('%Y-%m-%d %H:%M:%S')}").exists(), True)

    def test_stationinfo_create_validation_forth_case(self):
        """
            Trying to insert record that overlaps the first record but not the last one.
            Error should be returned
        """
        self.test_create_initial_data()

        url = reverse("station_info_list")

        data = {
            "network_code": 'NT1',
            "station_code": 'ST1',
            "antenna_code": 'ANT1',
            "receiver_code": 'RC1',
            "height_code": 'HT1',
            "country_code": 'USA',
            "date_start": "2023-01-01T00:00:00",
            "radome_code": "R2",
        }

        response = self.client.post(
            url, data)

        self.assertEqual(response.status_code, 201)

        self.assertEqual(models.Stationinfo.objects.count(), 2)

        data = {
            "network_code": 'NT1',
            "station_code": 'ST1',
            "antenna_code": 'ANT1',
            "receiver_code": 'RC1',
            "height_code": 'HT1',
            "country_code": 'USA',
            "date_start": "2021-01-01T00:00:00",
            "date_end": "2022-01-01T00:00:00",
            "radome_code": "R2",
        }

        response = self.client.post(
            url, data)

        self.assertEqual(response.status_code, 400)

        self.assertEqual(models.Stationinfo.objects.count(), 2)

    def test_stationinfo_create_validation_fifth_case(self):
        """
            No overlaps. It should just insert the record
        """
        self.test_create_initial_data()

        # modify the date_end of the first record so it doesn't overlap with the new record

        url = reverse("station_info_detail", kwargs={
                      "pk": models.Stationinfo.objects.all()[0].api_id})

        data = {
            "network_code": 'NT1',
            "station_code": 'ST1',
            "antenna_code": 'ANT1',
            "receiver_code": 'RC1',
            "height_code": 'HT1',
            "country_code": 'USA',
            "date_start": "2020-01-01T00:00:00",
            "date_end": "2021-01-01T00:00:00",
            "radome_code": "R1",
        }

        response = self.client.put(
            url, data, content_type='application/json')

        self.assertEqual(response.status_code, 200)

        self.assertEqual(models.Stationinfo.objects.count(), 1)

        # now add the new record

        url = reverse("station_info_list")

        data = {
            "network_code": 'NT1',
            "station_code": 'ST1',
            "antenna_code": 'ANT1',
            "receiver_code": 'RC1',
            "height_code": 'HT1',
            "country_code": 'USA',
            "date_start": "2022-01-01T00:00:00",
            "radome_code": "R2",
        }

        response = self.client.post(
            url, data)

        self.assertEqual(response.status_code, 201)

        self.assertEqual(models.Stationinfo.objects.count(), 2)

    def test_stationinfo_create_validation_sixth_case(self):
        """
            Try to insert a record with the same pk.
            It should not insert the record and return an error
        """

        self.test_create_initial_data()

        url = reverse("station_info_list")

        data = {
            "network_code": 'NT1',
            "station_code": 'ST1',
            "antenna_code": 'ANT1',
            "receiver_code": 'RC1',
            "height_code": 'HT1',
            "country_code": 'USA',
            "date_start": "2020-01-01T00:00:00",
            "radome_code": "R1",
        }

        response = self.client.post(
            url, data)

        self.assertEqual(response.status_code, 400)

        self.assertEqual(models.Stationinfo.objects.count(), 1)

    def test_stationinfo_update_validation_first_case(self):
        """
            Overlap one record when trying to update.
            Error should be returned.
        """

        self.test_create_initial_data()

        # we insert a new record, that will be overlapped

        url = reverse("station_info_list")

        data = {
            "network_code": 'NT1',
            "station_code": 'ST1',
            "antenna_code": 'ANT1',
            "receiver_code": 'RC1',
            "height_code": 'HT1',
            "country_code": 'USA',
            "date_start": "2021-01-01T00:00:00",
            "radome_code": "R1",
        }

        response = self.client.post(
            url, data)

        self.assertEqual(response.status_code, 201)

        self.assertEqual(models.Stationinfo.objects.count(), 2)

        # now we try to update the first record, overlapping the second one

        url = reverse("station_info_detail", kwargs={
                      "pk": models.Stationinfo.objects.all().first().api_id})

        data = {
            "network_code": 'NT1',
            "station_code": 'ST1',
            "antenna_code": 'ANT1',
            "receiver_code": 'RC1',
            "height_code": 'HT1',
            "country_code": 'USA',
            "date_start": "2022-01-01T00:00:00",
            "radome_code": "R1",
        }

        response = self.client.put(
            url, data, content_type='application/json')

        self.assertEqual(response.status_code, 400)

        # the date start remains the same
        self.assertEqual(models.Stationinfo.objects.all().first().date_start.strftime(
            "%Y-%m-%d %H:%M:%S"), "2020-01-01 00:00:00")

    def test_stationinfo_update_validation_second_case(self):
        """
            Do not overlap any record when trying to update.
            The record should be updated
        """

        self.test_create_initial_data()

        url = reverse("station_info_detail", kwargs={
                      "pk": models.Stationinfo.objects.all().first().api_id})

        data = {
            "network_code": 'NT1',
            "station_code": 'ST1',
            "antenna_code": 'ANT1',
            "receiver_code": 'RC1',
            "height_code": 'HT1',
            "country_code": 'USA',
            "date_start": "2021-01-01T00:00:00",
            "radome_code": "R1",
        }

        response = self.client.put(
            url, data, content_type='application/json')

        self.assertEqual(response.status_code, 200)

        self.assertEqual(models.Stationinfo.objects.count(), 1)

        self.assertEqual(models.Stationinfo.objects.all().first().date_start.strftime(
            "%Y-%m-%d %H:%M:%S"), "2021-01-01 00:00:00")


class PlannedVisitsTest(TestCase):
    """
    Test planned visits: creation, observation files restriction,
    filtering and planned -> done transition
    """

    def setUp(self):

        def authenticate():
            url = reverse("token_obtain_pair")

            response = self.client.post(
                url, {"username": "admin", "password": "admin"})

            self.assertEqual(response.status_code, 200)

            self.token = response.json()["access"]

            self.assertIsNotNone(self.token)
            self.client.defaults['HTTP_AUTHORIZATION'] = "Bearer " + self.token

        authenticate()

    def test_planned_visits(self):
        def test_create_network():
            url = reverse("network_list")

            data = {
                "network_code": "NT1",
                "network_name": "test network"
            }

            response = self.client.post(url, data)

            self.assertEqual(response.status_code, 201)

        def test_create_station():
            url = reverse("station_list")

            data = {
                "network_code": 'NT1',
                "station_code": 'ST1',
                "station_name": 'test station'
            }

            response = self.client.post(url, data)

            self.assertEqual(response.status_code, 201)

            return response.json()["api_id"]

        def test_create_planned_visit(station_api_id):
            url = reverse("visit_list")

            data = {
                "station": station_api_id,
                "date": (datetime.date.today() + datetime.timedelta(days=30)).isoformat(),
                "planned": True,
                "log_sheet_file_delete": False,
                "navigation_file_delete": False,
            }

            response = self.client.post(url, data)

            self.assertEqual(response.status_code, 201)
            self.assertEqual(response.json()["planned"], True)

            return response.json()["id"]

        def test_planned_visit_cannot_have_observation_files(visit_id):
            url = reverse("visit_gnss_data_files_list")

            file = SimpleUploadedFile(
                "test_obs.rnx.part0", gzip.compress(b"test observation file content"))

            response = self.client.post(
                url, {"file": file, "visit": visit_id, "description": "test"})

            self.assertEqual(response.status_code, 400)
            self.assertEqual(models.VisitGNSSDataFiles.objects.count(), 0)

        def test_create_visit_with_observation_files(station_api_id):
            # a non planned visit accepts observation files
            url = reverse("visit_list")

            data = {
                "station": station_api_id,
                "date": datetime.date.today().isoformat(),
                "log_sheet_file_delete": False,
                "navigation_file_delete": False,
            }

            response = self.client.post(url, data)

            self.assertEqual(response.status_code, 201)
            self.assertEqual(response.json()["planned"], False)

            visit_id = response.json()["id"]

            url = reverse("visit_gnss_data_files_list")

            file = SimpleUploadedFile(
                "test_obs.rnx.part0", gzip.compress(b"test observation file content"))

            response = self.client.post(
                url, {"file": file, "visit": visit_id, "description": "test"})

            self.assertEqual(response.status_code, 201)
            self.assertEqual(models.VisitGNSSDataFiles.objects.count(), 1)

            return visit_id

        def test_visit_with_observation_files_cannot_be_planned(visit_id):
            url = reverse("visit_detail", kwargs={"pk": visit_id})

            response = self.client.patch(
                url, data={"planned": True}, content_type='application/json')

            self.assertEqual(response.status_code, 400)
            self.assertEqual(models.Visits.objects.get(
                id=visit_id).planned, False)

        def test_filter_planned_visits():
            url = reverse("visit_list")

            response = self.client.get(url, {"planned": "true"})

            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json()["count"], 1)

            response = self.client.get(url, {"planned": "false"})

            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json()["count"], 1)

        def test_update_planned_visits_status(station_api_id):
            # a due planned visit becomes done, a future one remains planned
            url = reverse("visit_list")

            data = {
                "station": station_api_id,
                "date": (datetime.date.today() - datetime.timedelta(days=1)).isoformat(),
                "planned": True,
                "log_sheet_file_delete": False,
                "navigation_file_delete": False,
            }

            response = self.client.post(url, data)

            self.assertEqual(response.status_code, 201)

            due_visit_id = response.json()["id"]

            VisitUtils.update_planned_visits_status()

            self.assertEqual(models.Visits.objects.get(
                id=due_visit_id).planned, False)
            self.assertEqual(models.Visits.objects.filter(
                planned=True).count(), 1)

        test_create_network()
        station_api_id = test_create_station()
        planned_visit_id = test_create_planned_visit(station_api_id)
        test_planned_visit_cannot_have_observation_files(planned_visit_id)
        visit_id = test_create_visit_with_observation_files(station_api_id)
        test_visit_with_observation_files_cannot_be_planned(visit_id)
        test_filter_planned_visits()
        test_update_planned_visits_status(station_api_id)


class TransferVisitsTest(TestCase):
    """
    Test visits transfer: reassignment with all its files moved to the
    destination station paths, date collision rejection and partial transfer
    """

    def setUp(self):

        def authenticate():
            url = reverse("token_obtain_pair")

            response = self.client.post(
                url, {"username": "admin", "password": "admin"})

            self.assertEqual(response.status_code, 200)

            self.token = response.json()["access"]

            self.assertIsNotNone(self.token)
            self.client.defaults['HTTP_AUTHORIZATION'] = "Bearer " + self.token

        authenticate()

    def test_transfer_visits(self):
        def test_create_network():
            url = reverse("network_list")

            data = {
                "network_code": "NT1",
                "network_name": "test network"
            }

            response = self.client.post(url, data)

            self.assertEqual(response.status_code, 201)

        def test_create_station(station_code):
            url = reverse("station_list")

            data = {
                "network_code": 'NT1',
                "station_code": station_code,
                "station_name": 'test station',
                "lat": "0.0",
                "lon": "0.0",
                "height": "0.0"
            }

            response = self.client.post(url, data)

            self.assertEqual(response.status_code, 201)

            return response.json()["api_id"]

        def test_create_visit(station_api_id, date, with_log_sheet=False):
            url = reverse("visit_list")

            data = {
                "station": station_api_id,
                "date": date.isoformat(),
                "log_sheet_file_delete": False,
                "navigation_file_delete": False,
            }

            if with_log_sheet:
                data["log_sheet_file"] = SimpleUploadedFile(
                    "log_sheet.pdf", b"test log sheet content")

            response = self.client.post(url, data)

            self.assertEqual(response.status_code, 201)

            return response.json()["id"]

        def test_upload_observation_file(visit_id):
            url = reverse("visit_gnss_data_files_list")

            file = SimpleUploadedFile(
                "test_obs.rnx.part0", gzip.compress(b"test observation file content"))

            response = self.client.post(
                url, {"file": file, "visit": visit_id, "description": "test"})

            self.assertEqual(response.status_code, 201)

        def test_upload_attached_file(visit_id):
            url = reverse("visit_attached_files_list")

            file = SimpleUploadedFile(
                "test_attached.txt.part0", gzip.compress(b"test attached file content"))

            response = self.client.post(
                url, {"file": file, "visit": visit_id, "description": "test"})

            self.assertEqual(response.status_code, 201)

        def get_visit_file_paths(visit_id):
            visit = models.Visits.objects.get(id=visit_id)

            return [visit.log_sheet_file.name,
                    models.VisitGNSSDataFiles.objects.get(
                        visit=visit).file.name,
                    models.VisitAttachedFiles.objects.get(visit=visit).file.name]

        def test_transfer_moves_visit_and_files(visit_id, destination_station_api_id):
            old_paths = get_visit_file_paths(visit_id)

            url = reverse("visits_transfer")

            # captureOnCommitCallbacks executes django-cleanup's deferred deletion
            # of the original files, which runs on commit
            with self.captureOnCommitCallbacks(execute=True):
                response = self.client.post(
                    url, {"visits": [visit_id],
                          "destination_station": destination_station_api_id},
                    content_type='application/json')

            self.assertEqual(response.status_code, 200)
            self.assertEqual(len(response.json()["transferred"]), 1)
            self.assertEqual(response.json()["rejected"], [])

            visit = models.Visits.objects.get(id=visit_id)
            self.assertEqual(visit.station_id, destination_station_api_id)

            destination_prefix = os.path.join(
                "stations", visit.station.network_code.network_code,
                visit.station.station_code, "visits", str(visit.date))

            for new_path in get_visit_file_paths(visit_id):
                self.assertTrue(new_path.startswith(destination_prefix))
                self.assertTrue(default_storage.exists(new_path))

            # the original files were deleted by django-cleanup after the commit
            for old_path in old_paths:
                self.assertFalse(default_storage.exists(old_path))

        def test_transfer_rejects_date_collision(visit_id, destination_station_api_id, origin_station_api_id):
            url = reverse("visits_transfer")

            response = self.client.post(
                url, {"visits": [visit_id],
                      "destination_station": destination_station_api_id},
                content_type='application/json')

            self.assertEqual(response.status_code, 400)
            self.assertEqual(len(response.json()["rejected"]), 1)
            self.assertIn("There is already a visit",
                          response.json()["rejected"][0]["error"])
            self.assertEqual(models.Visits.objects.get(
                id=visit_id).station_id, origin_station_api_id)

        def test_partial_transfer(colliding_visit_id, visit_id, destination_station_api_id):
            url = reverse("visits_transfer")

            response = self.client.post(
                url, {"visits": [colliding_visit_id, visit_id],
                      "destination_station": destination_station_api_id},
                content_type='application/json')

            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json()[
                             "transferred"][0]["visit"], visit_id)
            self.assertEqual(response.json()["rejected"][
                             0]["visit"], colliding_visit_id)

        def test_transfer_rejects_unknown_visit_and_station(destination_station_api_id):
            url = reverse("visits_transfer")

            response = self.client.post(
                url, {"visits": [999999],
                      "destination_station": destination_station_api_id},
                content_type='application/json')

            self.assertEqual(response.status_code, 400)
            self.assertEqual(response.json()["rejected"][0]
                             ["error"], "Visit does not exist.")

            response = self.client.post(
                url, {"visits": [999999], "destination_station": 999999},
                content_type='application/json')

            self.assertEqual(response.status_code, 400)

        test_create_network()
        st1_api_id = test_create_station('ST1')
        st2_api_id = test_create_station('ST2')

        date = datetime.date.today()
        visit_id = test_create_visit(st1_api_id, date, with_log_sheet=True)
        test_upload_observation_file(visit_id)
        test_upload_attached_file(visit_id)

        test_transfer_moves_visit_and_files(visit_id, st2_api_id)

        # a new visit on ST1 with the same date now collides with the transferred one
        colliding_visit_id = test_create_visit(st1_api_id, date)
        test_transfer_rejects_date_collision(
            colliding_visit_id, st2_api_id, st1_api_id)

        other_visit_id = test_create_visit(
            st1_api_id, date + datetime.timedelta(days=1))
        test_partial_transfer(colliding_visit_id, other_visit_id, st2_api_id)

        test_transfer_rejects_unknown_visit_and_station(st2_api_id)

    def test_transfer_visits_forbidden_without_resource(self):
        """underprivileged_api has no role assigned to the 'transfer-visits'
        resource, so it must be rejected even with valid credentials"""

        url = reverse("token_obtain_pair")

        response = self.client.post(
            url, {"username": "underprivileged_api", "password": "underprivileged_api"})

        self.assertEqual(response.status_code, 200)

        self.client.defaults['HTTP_AUTHORIZATION'] = "Bearer " + \
            response.json()["access"]

        url = reverse("visits_transfer")

        response = self.client.post(
            url, {"visits": [1], "destination_station": 1},
            content_type='application/json')

        self.assertEqual(response.status_code, 403)


class StationsOnlyMetadataTest(TestCase):
    """
    Test the 'only_metadata=true' lightweight variant of GET /api/stations
    """

    def setUp(self):

        def authenticate():
            url = reverse("token_obtain_pair")

            response = self.client.post(
                url, {"username": "admin", "password": "admin"})

            self.assertEqual(response.status_code, 200)

            self.token = response.json()["access"]

            self.assertIsNotNone(self.token)
            self.client.defaults['HTTP_AUTHORIZATION'] = "Bearer " + self.token

        authenticate()

    def test_stations_only_metadata(self):
        def test_create_station():
            url = reverse("network_list")

            response = self.client.post(
                url, {"network_code": "NT1", "network_name": "test network"})

            self.assertEqual(response.status_code, 201)

            url = reverse("station_list")

            data = {
                "network_code": 'NT1',
                "station_code": 'ST1',
                "station_name": 'test station',
                "lat": "0.0",
                "lon": "0.0",
                "height": "0.0"
            }

            response = self.client.post(url, data)

            self.assertEqual(response.status_code, 201)

        def test_only_metadata_returns_light_fields():
            url = reverse("station_list")

            response = self.client.get(url, {"only_metadata": "true"})

            self.assertEqual(response.status_code, 200)

            station = response.json()["data"][0]

            for field in ('api_id', 'network_code', 'station_code', 'station_name',
                          'country_code', 'lat', 'lon', 'height', 'date_start', 'date_end'):
                self.assertIn(field, station)

            # the heavy fields are the whole point of the lightweight variant
            self.assertNotIn('harpos_coeff_otl', station)
            self.assertNotIn('auto_x', station)

        def test_default_response_remains_full():
            url = reverse("station_list")

            response = self.client.get(url)

            self.assertEqual(response.status_code, 200)
            self.assertIn('harpos_coeff_otl', response.json()["data"][0])

        test_create_station()
        test_only_metadata_returns_light_fields()
        test_default_response_remains_full()


class SourcesMetadataTest(TestCase):
    """
    Test the sources_metadata catalog CRUD and linking it to a server through
    sources_servers.metadata_source_id
    """

    def setUp(self):

        def authenticate():
            url = reverse("token_obtain_pair")

            response = self.client.post(
                url, {"username": "admin", "password": "admin"})

            self.assertEqual(response.status_code, 200)

            self.token = response.json()["access"]

            self.assertIsNotNone(self.token)
            self.client.defaults['HTTP_AUTHORIZATION'] = "Bearer " + self.token

        authenticate()

    def test_sources_metadata(self):
        def test_create_format():
            url = reverse("sources_formats_list")

            response = self.client.post(url, {"format": "TESTFMT"})

            self.assertEqual(response.status_code, 201)

        def test_create_metadata():
            url = reverse("sources_metadata_list")

            data = {
                "protocol": "HTTPS",
                "fqdn": "files.igs.org",
                "path": "/pub/station/log/{station}_*.log",
                "format": "TESTFMT",
                "username": "",
                "password": ""
            }

            response = self.client.post(url, data)

            self.assertEqual(response.status_code, 201)

            # '' is stored as NULL so geode's COALESCE falls back to the server values
            self.assertIsNone(response.json()["username"])
            self.assertIsNone(response.json()["password"])

            return response.json()["id"]

        def test_create_metadata_invalid_protocol():
            url = reverse("sources_metadata_list")

            response = self.client.post(
                url, {"protocol": "FTPS", "fqdn": "files.igs.org"})

            # rejected by the sources_metadata_protocol_check constraint
            self.assertEqual(response.status_code, 400)

        def test_create_server_linked(metadata_id):
            url = reverse("sources_servers_list")

            data = {
                "protocol": "HTTPS",
                "fqdn": "files.igs.org",
                "path": "/archive/${station}",
                "format": "TESTFMT",
                "metadata_source_id": metadata_id
            }

            response = self.client.post(url, data)

            self.assertEqual(response.status_code, 201)
            self.assertEqual(
                response.json()["metadata_source_id"], metadata_id)

            return response.json()["server_id"]

        def test_create_server_without_metadata():
            url = reverse("sources_servers_list")

            data = {
                "protocol": "FTP",
                "fqdn": "ftp.example.org",
                "format": "TESTFMT",
                "metadata_source_id": ""
            }

            response = self.client.post(url, data)

            self.assertEqual(response.status_code, 201)
            self.assertIsNone(response.json()["metadata_source_id"])

        def test_get_metadata(metadata_id):
            url = reverse("sources_metadata_list")

            response = self.client.get(url)

            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json()["count"], 1)
            self.assertEqual(response.json()["data"][0]["id"], metadata_id)

            url = reverse("sources_metadata_detail", args=[metadata_id])

            response = self.client.get(url)

            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json()["fqdn"], "files.igs.org")

        def test_delete_referenced_metadata(metadata_id):
            url = reverse("sources_metadata_detail", args=[metadata_id])

            response = self.client.delete(url)

            # still referenced by a server: FK error reported as 400
            self.assertEqual(response.status_code, 400)

        def test_unlink_server(server_id):
            url = reverse("sources_servers_detail", args=[server_id])

            response = self.client.patch(
                url, {"metadata_source_id": None}, content_type="application/json")

            self.assertEqual(response.status_code, 200)
            self.assertIsNone(response.json()["metadata_source_id"])

        def test_delete_server_keeps_metadata_catalog_entry(metadata_id):
            # deleting the server must NOT delete the (now unreferenced) catalog entry:
            # sources_metadata is a shared, independently managed catalog, like sources_formats
            url = reverse("sources_servers_list")

            response = self.client.post(
                url, {"protocol": "HTTPS", "fqdn": "files.igs.org", "format": "TESTFMT",
                      "metadata_source_id": metadata_id})

            self.assertEqual(response.status_code, 201)

            server_id = response.json()["server_id"]

            url = reverse("sources_servers_detail", args=[server_id])

            response = self.client.delete(url)

            self.assertEqual(response.status_code, 204)

            url = reverse("sources_metadata_detail", args=[metadata_id])

            response = self.client.get(url)

            self.assertEqual(response.status_code, 200)

        def test_delete_metadata(metadata_id):
            url = reverse("sources_metadata_detail", args=[metadata_id])

            response = self.client.delete(url)

            self.assertEqual(response.status_code, 204)

        def test_underprivileged_api_permissions():
            url = reverse("token_obtain_pair")

            response = self.client.post(
                url, {"username": "underprivileged_api", "password": "underprivileged_api"})

            self.assertEqual(response.status_code, 200)

            self.client.defaults['HTTP_AUTHORIZATION'] = "Bearer " + \
                response.json()["access"]

            url = reverse("sources_metadata_list")

            # stations/read cluster: can read the metadata sources but not create them
            response = self.client.get(url)

            self.assertEqual(response.status_code, 200)

            response = self.client.post(
                url, {"protocol": "HTTP", "fqdn": "files.igs.org"})

            self.assertEqual(response.status_code, 403)

        test_create_format()
        metadata_id = test_create_metadata()
        test_create_metadata_invalid_protocol()
        server_id = test_create_server_linked(metadata_id)
        test_create_server_without_metadata()
        test_get_metadata(metadata_id)
        test_delete_referenced_metadata(metadata_id)
        test_unlink_server(server_id)
        test_delete_server_keeps_metadata_catalog_entry(metadata_id)
        test_delete_metadata(metadata_id)
        test_underprivileged_api_permissions()


class ReferenceFramesTest(TestCase):

    def setUp(self):
        def authenticate():
            url = reverse("token_obtain_pair")

            response = self.client.post(
                url, {"username": "admin", "password": "admin"})

            self.assertEqual(response.status_code, 200)

            self.token = response.json()["access"]

            self.assertIsNotNone(self.token)
            self.client.defaults['HTTP_AUTHORIZATION'] = "Bearer " + self.token

        authenticate()

        with connection.cursor() as cursor:
            cursor.execute(
                "INSERT INTO gamit_projects (project) VALUES (%s) ON CONFLICT DO NOTHING", ["tstproj"])

        self.frame = models.ReferenceFrames.objects.create(
            frame_name="tst_frame", engine="gamit", project="tstproj")

    def tearDown(self):
        self.frame.delete()

        with connection.cursor() as cursor:
            cursor.execute("DELETE FROM gamit_projects WHERE project = %s", ["tstproj"])

    def test_reference_frames(self):
        def test_list():
            url = reverse("reference_frames_list")

            response = self.client.get(url)

            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json()["count"], 1)
            self.assertEqual(response.json()["data"][0]["frame_name"], "tst_frame")
            self.assertEqual(response.json()["data"][0]["stacks_count"], 0)

        def test_detail():
            url = reverse("reference_frames_detail", args=[self.frame.api_id])

            response = self.client.get(url)

            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json()["frame_name"], "tst_frame")
            self.assertEqual(response.json()["stacks_count"], 0)

        def test_write_methods_not_allowed():
            list_url = reverse("reference_frames_list")
            detail_url = reverse("reference_frames_detail", args=[self.frame.api_id])

            response = self.client.post(
                list_url, {"frame_name": "x", "engine": "gamit", "project": "tstproj"})
            self.assertEqual(response.status_code, 405)

            response = self.client.put(
                detail_url, {"frame_name": "y"}, content_type="application/json")
            self.assertEqual(response.status_code, 405)

            response = self.client.patch(
                detail_url, {"frame_name": "y"}, content_type="application/json")
            self.assertEqual(response.status_code, 405)

            response = self.client.delete(detail_url)
            self.assertEqual(response.status_code, 405)

        def test_underprivileged_api_permissions():
            url = reverse("token_obtain_pair")

            response = self.client.post(
                url, {"username": "underprivileged_api", "password": "underprivileged_api"})

            self.assertEqual(response.status_code, 200)

            self.client.defaults['HTTP_AUTHORIZATION'] = "Bearer " + \
                response.json()["access"]

            url = reverse("reference_frames_list")

            response = self.client.get(url)

            self.assertEqual(response.status_code, 403)

        test_list()
        test_detail()
        test_write_methods_not_allowed()
        test_underprivileged_api_permissions()


class GamitProjectsTest(TestCase):
    """
    Test the gamit_projects CRUD: search by project, db defaults, the choices mirrored
    from the db CHECK constraints (readable per-field 400), station_list validation
    (existing stations, resolved to the db's exact codes), process_defaults/sestbl
    loaded from a file, and permissions on the endpoints.
    """

    def setUp(self):
        def authenticate():
            url = reverse("token_obtain_pair")

            response = self.client.post(
                url, {"username": "admin", "password": "admin"})

            self.assertEqual(response.status_code, 200)

            self.token = response.json()["access"]

            self.assertIsNotNone(self.token)
            self.client.defaults['HTTP_AUTHORIZATION'] = "Bearer " + self.token

        authenticate()

        # bypass the stations API (Nominatim lookup) to seed the stations referenced by station_list
        self.network = models.Networks.objects.create(network_code="tst")
        self.station = models.Stations.objects.create(
            network_code=self.network, station_code="ST1", lat=-34.6, lon=-58.4, height=30)

    def tearDown(self):
        models.GamitProjects.objects.filter(project__startswith="tst").delete()
        self.station.delete()
        self.network.delete()

    def test_gamit_projects(self):
        def test_create_with_defaults():
            url = reverse("gamit_projects_list")

            response = self.client.post(url, {"project": "tstproj"})

            self.assertEqual(response.status_code, 201)
            # db defaults
            self.assertEqual(response.json()["network_type"], "global")
            self.assertEqual(response.json()["cluster_size"], 25)
            self.assertEqual(response.json()["ties"], 10)
            self.assertEqual(response.json()["experiment_type"], "baseline")
            self.assertEqual(response.json()["noftp"], True)
            self.assertEqual(response.json()["eop_type"], "usno")
            self.assertEqual(response.json()["sigma_floor_h"], 0.01)
            self.assertEqual(response.json()["sigma_floor_v"], 0.03)
            self.assertIsNone(response.json()["station_list"])

            return response.json()["api_id"]

        def test_create_invalid_choices():
            url = reverse("gamit_projects_list")

            response = self.client.post(url, {"project": "tstproj2", "network_type": "foo", "experiment_type": "bar",
                                              "overconst_action": "baz", "systems": ["G", "X"]}, content_type="application/json")

            # readable, per-field messages (the db CHECK constraints are never reached)
            self.assertEqual(response.status_code, 400)
            self.assertEqual({error["attr"] for error in response.json()["errors"]},
                             {"network_type", "experiment_type", "overconst_action", "systems.1"})

        def test_create_duplicate():
            url = reverse("gamit_projects_list")

            response = self.client.post(url, {"project": "tstproj"})

            self.assertEqual(response.status_code, 400)
            self.assertEqual(response.json()["errors"][0]["attr"], "project")

        def test_list_search(api_id):
            url = reverse("gamit_projects_list")

            response = self.client.get(url, {"project": "TSTP"})

            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json()["count"], 1)
            self.assertEqual(response.json()["data"][0]["api_id"], api_id)

            response = self.client.get(url, {"project": "nomatch"})

            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json()["count"], 0)

        def test_station_list(api_id):
            url = reverse("gamit_projects_detail", args=[api_id])

            response = self.client.patch(
                url, {"station_list": ["tst.st1", "xx.zzzz"]}, content_type="application/json")

            self.assertEqual(response.status_code, 400)
            self.assertEqual(response.json()["errors"][0]["attr"], "station_list")
            self.assertIn("xx.zzzz", response.json()["errors"][0]["detail"])

            # case-insensitive, deduplicated, stored with the db's exact codes
            response = self.client.patch(
                url, {"station_list": ["tst.st1", "TST.ST1"], "systems": ["G", "R"]}, content_type="application/json")

            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json()["station_list"], ["tst.ST1"])
            self.assertEqual(response.json()["systems"], ["G", "R"])

        def test_files(api_id):
            url = reverse("gamit_projects_detail", args=[api_id])

            # unlike post(), the test client's patch() does not encode multipart by itself
            response = self.client.patch(url, encode_multipart(BOUNDARY, {
                "sestbl_by_file": SimpleUploadedFile("sestbl.", b"Session Table\n\nProcessing Agency = MIT\n"),
                "process_defaults_by_file": SimpleUploadedFile("process.defaults", b"set MYDIR = /data\n"),
            }), content_type=MULTIPART_CONTENT)

            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json()["sestbl"], "Session Table\n\nProcessing Agency = MIT\n")
            self.assertEqual(response.json()["process_defaults"], "set MYDIR = /data\n")

            # the loaded contents can then be edited as text
            response = self.client.patch(
                url, {"sestbl": "edited"}, content_type="application/json")

            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json()["sestbl"], "edited")

            response = self.client.patch(url, encode_multipart(BOUNDARY, {
                "sestbl_by_file": SimpleUploadedFile("sestbl.", b"\xff\xfe\x00bad")}), content_type=MULTIPART_CONTENT)

            self.assertEqual(response.status_code, 400)
            self.assertEqual(response.json()["errors"][0]["attr"], "sestbl_by_file")

        def test_update_and_delete(api_id):
            url = reverse("gamit_projects_detail", args=[api_id])

            response = self.client.put(url, {"project": "tstproj_renamed", "network_type": "regional", "cluster_size": 30,
                                             "ties": 5, "experiment_type": "relax", "experiment_name": "tstp", "org": "osu",
                                             "noftp": False, "eop_type": "usno", "systems": ["G"], "overconst_action": "inflate",
                                             "sigma_floor_h": 0.02, "sigma_floor_v": 0.05, "station_list": [],
                                             "process_defaults": "", "sestbl": "", "solutions_dir": "/data/tst"},
                                       content_type="application/json")

            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json()["project"], "tstproj_renamed")
            # empty is stored as null, like the rows geode backfilled
            self.assertIsNone(response.json()["station_list"])
            self.assertIsNone(response.json()["process_defaults"])
            self.assertIsNone(response.json()["sestbl"])

            response = self.client.patch(url, {"systems": [], "overconst_action": "", "org": ""},
                                         content_type="application/json")

            self.assertEqual(response.status_code, 200)
            self.assertIsNone(response.json()["systems"])
            self.assertIsNone(response.json()["overconst_action"])
            self.assertIsNone(response.json()["org"])

            response = self.client.delete(url)

            self.assertEqual(response.status_code, 204)

            response = self.client.get(url)

            self.assertEqual(response.status_code, 404)

        def test_underprivileged_api_permissions():
            url = reverse("token_obtain_pair")

            response = self.client.post(
                url, {"username": "underprivileged_api", "password": "underprivileged_api"})

            self.assertEqual(response.status_code, 200)

            self.client.defaults['HTTP_AUTHORIZATION'] = "Bearer " + \
                response.json()["access"]

            url = reverse("gamit_projects_list")

            response = self.client.get(url)

            # not assigned to any role's endpoint cluster
            self.assertEqual(response.status_code, 403)

            url = reverse("processing_station_list")

            response = self.client.post(
                url, {"country_code": ["ARG"]}, content_type="application/json")

            self.assertEqual(response.status_code, 403)

        api_id = test_create_with_defaults()
        test_create_invalid_choices()
        test_create_duplicate()
        test_list_search(api_id)
        test_station_list(api_id)
        test_files(api_id)
        test_update_and_delete(api_id)
        test_underprivileged_api_permissions()


class CampaignPlansTest(TestCase):
    """
    Test the campaign planner: POST /api/campaign-planner (geode's plan_campaign mocked:
    config built from the parameters, planner errors as 400), the campaign_plans CRUD
    (search by name, defaults, validations), the geocoder and the permissions (in the
    campaigns clusters).
    """

    def setUp(self):
        def authenticate():
            url = reverse("token_obtain_pair")

            response = self.client.post(
                url, {"username": "admin", "password": "admin"})

            self.assertEqual(response.status_code, 200)

            self.token = response.json()["access"]

            self.assertIsNotNone(self.token)
            self.client.defaults['HTTP_AUTHORIZATION'] = "Bearer " + self.token

        authenticate()

        # bypass the stations API (Nominatim lookup) to seed the station referenced by stations
        self.network = models.Networks.objects.create(network_code="tst")
        self.station = models.Stations.objects.create(
            network_code=self.network, station_code="ST1", lat=-34.6, lon=-58.4, height=30)

        self.parameters = {"start_city": "La Plata, Buenos Aires, Argentina",
                           "end_city": "La Plata, Buenos Aires, Argentina",
                           "start_date": "2026-12-06", "stations": ["tst.st1"]}

        self.plan_result = {"plan": {"days": [], "summary": {"total_days": 1}}, "html": "<html></html>"}

    def tearDown(self):
        models.CampaignPlans.objects.filter(name__startswith="tst").delete()
        self.station.delete()
        self.network.delete()

    def test_campaign_plans(self):
        from api.utils import CampaignPlannerUtils
        from geode.campaign_planner.planner import CampaignPlannerError

        def test_planner():
            url = reverse("campaign_planner")

            parameters = {**self.parameters,
                          "new_sites": ["Mendoza, Argentina", "-34.1667,-69.7167",
                                        {"name": "Site A", "lat": -33.0, "lon": -65.0},
                                        {"name": "Site B", "city": "San Luis, Argentina"}],
                          "station_time_overrides": {"tst.st1": 60, "Site A": 30},
                          "fuel_cost_per_km": 0.15, "lodging_cost_per_night": 85.5,
                          "per_diem_cost_per_day": 50, "num_participants": 2, "day_start": "07:30"}

            with mock.patch("api.utils.plan_campaign", return_value=self.plan_result) as plan_campaign:
                response = self.client.post(
                    url, parameters, content_type="application/json")

            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json(), self.plan_result)

            # config as geode expects it: dates and times as strings, costs as floats,
            # defaults of the model for the parameters not sent
            config = plan_campaign.call_args.args[0]

            self.assertEqual(config["start_date"], "2026-12-06")
            self.assertEqual(config["day_start"], "07:30")
            self.assertEqual(config["hard_stop"], "20:00")
            # station codes replaced by the exact codes of the db (geode matches them exactly)
            self.assertEqual(config["stations"], ["tst.ST1"])
            self.assertEqual(config["new_sites"], parameters["new_sites"])
            self.assertEqual(config["station_time_overrides"], parameters["station_time_overrides"])
            self.assertEqual(config["fuel_cost_per_km"], 0.15)
            self.assertEqual(config["lodging_cost_per_night"], 85.5)
            self.assertEqual(config["per_diem_cost_per_day"], 50.0)
            self.assertEqual(config["num_participants"], 2)
            self.assertEqual(config["time_on_site_minutes"], 120)
            self.assertNotIn("name", config)
            self.assertIsNotNone(plan_campaign.call_args.kwargs["cnn"])

            # other geode specs (country codes, filters, wildcards, removals) are passed as is
            with mock.patch("api.utils.plan_campaign", return_value=self.plan_result) as plan_campaign:
                response = self.client.post(
                    url, {**self.parameters, "stations": ["ARG:CONTINUOUS", "tst.st1", "-chl.sant", "tst.all"]},
                    content_type="application/json")

            self.assertEqual(response.status_code, 200)
            self.assertEqual(plan_campaign.call_args.args[0]["stations"],
                             ["ARG:CONTINUOUS", "tst.ST1", "-chl.sant", "tst.all"])

            # planner errors (unknown stations, geocoding, routing): 400 with the message as is
            with mock.patch("api.utils.plan_campaign",
                            side_effect=CampaignPlannerError("No stations matched the provided specification.")):
                response = self.client.post(
                    url, parameters, content_type="application/json")

            self.assertEqual(response.status_code, 400)
            self.assertEqual(response.json()["errors"][0]["detail"],
                             "No stations matched the provided specification.")

        def test_planner_validations():
            url = reverse("campaign_planner")

            def assert_invalid(parameters, attr):
                with mock.patch("api.utils.plan_campaign", return_value=self.plan_result) as plan_campaign:
                    response = self.client.post(
                        url, parameters, content_type="application/json")

                self.assertEqual(response.status_code, 400)
                self.assertEqual(response.json()["errors"][0]["attr"], attr)
                plan_campaign.assert_not_called()

            assert_invalid({}, "start_city")
            assert_invalid({**self.parameters, "stations": []}, "non_field_errors")
            assert_invalid({**self.parameters, "stations": [" "]}, "stations.0")
            # unknown NetworkCode.StationCode codes are rejected even with valid ones (geode
            # would skip them silently)
            assert_invalid({**self.parameters, "stations": ["tst.st1", "tst.xxxx"]}, "stations")
            assert_invalid({**self.parameters, "day_start": "20:00", "hard_stop": "08:00"}, "non_field_errors")
            assert_invalid({**self.parameters, "day_start": "8am"}, "day_start")
            assert_invalid({**self.parameters, "new_sites": [{"name": "x"}]}, "new_sites")
            assert_invalid({**self.parameters, "new_sites": [{"lat": "-34", "lon": -58}]}, "new_sites")
            assert_invalid({**self.parameters, "new_sites": [{"name": 1, "city": "x"}]}, "new_sites")
            assert_invalid({**self.parameters, "station_time_overrides": {"arg.lhcl": 0}}, "station_time_overrides")
            assert_invalid({**self.parameters, "station_time_overrides": [60]}, "station_time_overrides")
            assert_invalid({**self.parameters, "fuel_cost_per_km": -1}, "fuel_cost_per_km")
            assert_invalid({**self.parameters, "num_participants": 0}, "num_participants")
            assert_invalid({**self.parameters, "time_on_site_minutes": 0}, "time_on_site_minutes")

        def test_crud():
            url = reverse("campaign_plans_list")

            response = self.client.post(
                url, {**self.parameters, "name": "tst plan"}, content_type="application/json")

            self.assertEqual(response.status_code, 201)
            self.assertEqual(response.json()["stations"], ["tst.ST1"])
            # defaults of geode's DEFAULT_CONFIG
            self.assertEqual(response.json()["time_on_site_minutes"], 120)
            self.assertEqual(response.json()["station_time_overrides"], {})
            self.assertEqual(response.json()["new_sites"], [])
            self.assertEqual(response.json()["fuel_cost_per_km"], 0)
            self.assertEqual(response.json()["lodging_cost_per_night"], 70)
            self.assertEqual(response.json()["per_diem_cost_per_day"], 0)
            self.assertEqual(response.json()["num_participants"], 1)
            self.assertEqual(response.json()["day_start"], "08:00")
            self.assertEqual(response.json()["hard_stop"], "20:00")

            pk = response.json()["id"]

            response = self.client.post(
                url, self.parameters, content_type="application/json")

            self.assertEqual(response.status_code, 400)
            self.assertEqual(response.json()["errors"][0]["attr"], "name")

            response = self.client.get(url, {"name": "TST PLAN"})

            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json()["count"], 1)
            self.assertEqual(response.json()["data"][0]["id"], pk)

            response = self.client.get(url, {"name": "no such plan"})

            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json()["count"], 0)

            url = reverse("campaign_plans_detail", kwargs={"pk": pk})

            # on update, the fields not sent keep the stored values
            response = self.client.patch(
                url, {"stations": [], "new_sites": []}, content_type="application/json")

            self.assertEqual(response.status_code, 400)

            response = self.client.patch(
                url, {"hard_stop": "07:00"}, content_type="application/json")

            self.assertEqual(response.status_code, 400)

            response = self.client.patch(
                url, {"stations": [], "new_sites": ["Mendoza, Argentina"], "day_start": "08:30:00"},
                content_type="application/json")

            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json()["stations"], [])
            self.assertEqual(response.json()["new_sites"], ["Mendoza, Argentina"])
            self.assertEqual(response.json()["day_start"], "08:30")

            response = self.client.put(
                url, {**self.parameters, "name": "tst plan 2", "fuel_cost_per_km": 0.15},
                content_type="application/json")

            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json()["name"], "tst plan 2")
            self.assertEqual(response.json()["fuel_cost_per_km"], 0.15)

            response = self.client.delete(url)

            self.assertEqual(response.status_code, 204)

            response = self.client.get(url)

            self.assertEqual(response.status_code, 404)

        def test_geocode():
            url = reverse("campaign_planner_geocode")

            response = self.client.get(url)

            self.assertEqual(response.status_code, 400)

            location = {"name": "La Plata, Buenos Aires, Argentina", "lat": -34.9206797, "lon": -57.9537638}

            with mock.patch("api.views.geocode_city", return_value=location):
                response = self.client.get(url, {"q": "La Plata, Buenos Aires, Argentina"})

            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json(), location)

            with mock.patch("api.views.geocode_city", side_effect=ValueError('Could not geocode "x".')):
                response = self.client.get(url, {"q": "x"})

            self.assertEqual(response.status_code, 400)
            self.assertEqual(response.json()["errors"][0]["detail"], 'Could not geocode "x".')

        def test_get_config():
            config = CampaignPlannerUtils.get_config(
                {"start_date": datetime.date(2026, 12, 6), "day_start": datetime.time(8, 0),
                 "fuel_cost_per_km": decimal.Decimal("0.1500"), "stations": ["tst.ST1"]})

            self.assertEqual(config, {"start_date": "2026-12-06", "day_start": "08:00",
                                      "fuel_cost_per_km": 0.15, "stations": ["tst.ST1"]})

        def test_underprivileged_api_permissions():
            url = reverse("token_obtain_pair")

            response = self.client.post(
                url, {"username": "underprivileged_api", "password": "underprivileged_api"})

            self.assertEqual(response.status_code, 200)

            self.client.defaults['HTTP_AUTHORIZATION'] = "Bearer " + \
                response.json()["access"]

            # the endpoints are in the campaigns clusters, not assigned to this role
            url = reverse("campaign_plans_list")

            response = self.client.get(url)

            self.assertEqual(response.status_code, 403)

            url = reverse("campaign_planner")

            response = self.client.post(
                url, self.parameters, content_type="application/json")

            self.assertEqual(response.status_code, 403)

        test_planner()
        test_planner_validations()
        test_crud()
        test_geocode()
        test_get_config()
        test_underprivileged_api_permissions()


class ProcessingStationListTest(TestCase):
    """
    Test POST /api/processing-station-list: stations resolved by station type, country
    code, location (great-circle radius) and polygon, combined with AND, returned as
    NetworkCode.StationCode codes for gamit_projects.station_list.
    """

    def setUp(self):
        def authenticate():
            url = reverse("token_obtain_pair")

            response = self.client.post(
                url, {"username": "admin", "password": "admin"})

            self.assertEqual(response.status_code, 200)

            self.token = response.json()["access"]

            self.assertIsNotNone(self.token)
            self.client.defaults['HTTP_AUTHORIZATION'] = "Bearer " + self.token

        authenticate()

        self.station_type = models.StationType.objects.create(name="tst type")
        self.network = models.Networks.objects.create(network_code="tst")
        # placeholder network, never returned
        self.unknown_network = models.Networks.objects.create(network_code="???")

        # bypass the stations API (Nominatim lookup) to seed stations with known coordinates
        self.stations = [
            models.Stations.objects.create(network_code=self.network, station_code="bue1",
                                           country_code="ARG", lat=-34.6, lon=-58.4, height=30),
            models.Stations.objects.create(network_code=self.network, station_code="cor1",
                                           country_code="ARG", lat=-31.4, lon=-64.2, height=400),
            models.Stations.objects.create(network_code=self.network, station_code="scl1",
                                           country_code="CHL", lat=-33.4, lon=-70.7, height=500),
            models.Stations.objects.create(network_code=self.unknown_network, station_code="bue2",
                                           country_code="ARG", lat=-34.6, lon=-58.4, height=30),
            # next to the antimeridian, for the location filter
            models.Stations.objects.create(network_code=self.network, station_code="tuv1",
                                           country_code="TUV", lat=-8.5, lon=179.2, height=10),
        ]

        models.StationMeta.objects.create(
            station=self.stations[0], station_type=self.station_type)

    def tearDown(self):
        models.StationMeta.objects.filter(station__in=self.stations).delete()

        for station in self.stations:
            station.delete()

        self.network.delete()
        self.unknown_network.delete()
        self.station_type.delete()

    def test_processing_station_list(self):
        url = reverse("processing_station_list")

        def resolve(data):
            response = self.client.post(
                url, data, content_type="application/json")

            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json()["count"],
                             len(response.json()["station_list"]))
            self.assertEqual(len(response.json()["stations"]),
                             len(response.json()["station_list"]))

            return response.json()["station_list"]

        def test_no_filters():
            response = self.client.post(url, {}, content_type="application/json")

            self.assertEqual(response.status_code, 400)

            response = self.client.post(
                url, {"all": False}, content_type="application/json")

            self.assertEqual(response.status_code, 400)

        def test_all():
            # geode's 'all': every station except the '?' placeholder networks
            self.assertEqual(resolve({"all": True}), [
                             "tst.bue1", "tst.cor1", "tst.scl1", "tst.tuv1"])
            # other filters still apply
            self.assertEqual(resolve({"all": True, "country_code": ["CHL"]}), ["tst.scl1"])

        def test_by_type():
            self.assertEqual(resolve({"station_type": self.station_type.id}), ["tst.bue1"])

        def test_by_country():
            # '???' stations are never included
            self.assertEqual(resolve({"country_code": ["arg"]}), ["tst.bue1", "tst.cor1"])
            self.assertEqual(resolve({"country_code": ["ARG", "CHL"]}), [
                             "tst.bue1", "tst.cor1", "tst.scl1"])

        def test_by_location():
            # ~ 650 km from Buenos Aires to Cordoba, ~ 1140 km to Santiago
            self.assertEqual(resolve({"lat": -34.6, "lon": -58.4, "distance_km": 100}), ["tst.bue1"])
            self.assertEqual(resolve({"lat": -34.6, "lon": -58.4, "distance_km": 700}), [
                             "tst.bue1", "tst.cor1"])

            # ~ 140 km across the antimeridian (center at lon -179.5, station at 179.2)
            self.assertEqual(resolve({"lat": -8.5, "lon": -179.5, "distance_km": 200}), ["tst.tuv1"])

            response = self.client.post(
                url, {"lat": -34.6, "lon": -58.4}, content_type="application/json")

            self.assertEqual(response.status_code, 400)

        def test_by_polygon():
            polygon = [{"lat": -30, "lon": -66}, {"lat": -30, "lon": -55},
                       {"lat": -40, "lon": -55}, {"lat": -40, "lon": -66}]

            self.assertEqual(resolve({"polygon": polygon}), ["tst.bue1", "tst.cor1"])
            # combined with AND
            self.assertEqual(resolve({"polygon": polygon, "station_type": self.station_type.id}), ["tst.bue1"])

            response = self.client.post(
                url, {"polygon": polygon[:2]}, content_type="application/json")

            self.assertEqual(response.status_code, 400)

        def test_stations_representation():
            response = self.client.post(
                url, {"station_type": self.station_type.id}, content_type="application/json")

            station = response.json()["stations"][0]

            # same representation as GET /api/stations?only_metadata=true
            self.assertEqual(station["api_id"], self.stations[0].api_id)
            self.assertEqual(station["type"], "tst type")
            self.assertEqual(station["lat"], -34.6)

        test_no_filters()
        test_all()
        test_by_type()
        test_by_country()
        test_by_location()
        test_by_polygon()
        test_stations_representation()


class DownloadRinexTest(TestCase):
    """
    Test /api/rinex/<id>/download. The archive is not available in the test environment, so
    RinexUtils.get_rinex_file is mocked.
    """

    def setUp(self):

        def authenticate():
            url = reverse("token_obtain_pair")

            response = self.client.post(
                url, {"username": "admin", "password": "admin"})

            self.assertEqual(response.status_code, 200)

            self.token = response.json()["access"]

            self.assertIsNotNone(self.token)
            self.client.defaults['HTTP_AUTHORIZATION'] = "Bearer " + self.token

        authenticate()

        self.rinex = models.Rinex.objects.create(
            network_code="tst", station_code="tst1", observation_year=2025, observation_month=8,
            observation_day=15, observation_doy=227, observation_f_year=2025.619,
            filename="tst12270.25o", interval=30, completion=1)

    def test_download_rinex(self):
        def test_not_found():
            url = reverse("rinex_download", args=[self.rinex.api_id + 1])

            response = self.client.get(url)

            self.assertEqual(response.status_code, 404)

        def test_archive_error():
            url = reverse("rinex_download", args=[self.rinex.api_id])

            with mock.patch.object(RinexUtils, "get_rinex_file",
                                   side_effect=Exception("File not found in the archive")):
                response = self.client.get(url)

            self.assertEqual(response.status_code, 400)

        def test_download():
            url = reverse("rinex_download", args=[self.rinex.api_id])

            tmp_dir = tempfile.mkdtemp()
            file_path = os.path.join(tmp_dir, "tst12270.25d.Z")

            with open(file_path, "wb") as f:
                f.write(b"crinez content")

            with mock.patch.object(RinexUtils, "get_rinex_file",
                                   return_value=file_path) as get_rinex_file:
                response = self.client.get(url)

            self.assertEqual(response.status_code, 200)
            self.assertEqual(get_rinex_file.call_args[0][0].api_id, self.rinex.api_id)
            self.assertEqual(response["Content-Disposition"],
                             'attachment; filename="tst12270.25d.Z"')
            self.assertEqual(b"".join(response.streaming_content), b"crinez content")

            shutil.rmtree(tmp_dir)

        def test_underprivileged_api_permissions():
            url = reverse("token_obtain_pair")

            response = self.client.post(
                url, {"username": "underprivileged_api", "password": "underprivileged_api"})

            self.assertEqual(response.status_code, 200)

            self.client.defaults['HTTP_AUTHORIZATION'] = "Bearer " + \
                response.json()["access"]

            url = reverse("rinex_download", args=[self.rinex.api_id])

            response = self.client.get(url)

            self.assertEqual(response.status_code, 403)

        test_not_found()
        test_archive_error()
        test_download()
        test_underprivileged_api_permissions()
