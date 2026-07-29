from unittest.mock import patch

from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from .routing import GeocodingNotFoundError, RoutingServiceError


class CreateTripTests(APITestCase):
    def setUp(self):
        self.url = reverse("create_trip")
        self.valid_payload = {
            "current_location": "Chicago, IL",
            "pickup_location": "Dallas, TX",
            "dropoff_location": "Houston, TX",
            "current_cycle_used": 12.5,
        }
        self.mock_coordinates = {
            "Chicago, IL": (41.8781, -87.6298),
            "Dallas, TX": (32.7767, -96.7970),
            "Houston, TX": (29.7604, -95.3698),
        }
        self.mock_route = {
            "total_distance_miles": 1234.56,
            "total_driving_hours": 18.25,
            "route_geometry": {
                "type": "LineString",
                "coordinates": [
                    [-87.6298, 41.8781],
                    [-96.7970, 32.7767],
                    [-95.3698, 29.7604],
                ],
            },
        }

    def _mock_geocode(self, location):
        if location not in self.mock_coordinates:
            raise GeocodingNotFoundError(location)
        return self.mock_coordinates[location]

    def _post_with_mocked_routing(self, payload=None):
        with (
            patch("planner.views.geocode_location", side_effect=self._mock_geocode),
            patch("planner.views.get_route", return_value=self.mock_route),
        ):
            return self.client.post(
                self.url, payload or self.valid_payload, format="json"
            )

    def test_valid_input_returns_200(self):
        response = self._post_with_mocked_routing()

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["current_location"], "Chicago, IL")
        self.assertEqual(response.data["current_cycle_used"], 12.5)
        self.assertEqual(
            response.data["coordinates"]["current_location"],
            {"lat": 41.8781, "lng": -87.6298},
        )
        self.assertEqual(response.data["total_distance_miles"], 1234.56)
        self.assertEqual(response.data["total_driving_hours"], 18.25)
        self.assertEqual(response.data["route_geometry"]["type"], "LineString")

    def test_response_includes_duty_schedule(self):
        response = self._post_with_mocked_routing()

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("duty_schedule", response.data)

        schedule = response.data["duty_schedule"]
        self.assertIsInstance(schedule, list)
        self.assertGreater(len(schedule), 0)

        for day in schedule:
            self.assertIn("day_index", day)
            self.assertIn("segments", day)
            self.assertIn("totals", day)
            self.assertIsInstance(day["segments"], list)
            self.assertGreater(len(day["segments"]), 0)

            for seg in day["segments"]:
                self.assertIn("status", seg)
                self.assertIn("start_hour", seg)
                self.assertIn("end_hour", seg)
                self.assertIn(seg["status"], ("off_duty", "sleeper_berth", "driving", "on_duty_not_driving"))
                self.assertGreaterEqual(seg["start_hour"], 0)
                self.assertLessEqual(seg["end_hour"], 24)
                self.assertGreater(seg["end_hour"], seg["start_hour"])

            totals = day["totals"]
            for key in ("off_duty", "sleeper_berth", "driving", "on_duty_not_driving"):
                self.assertIn(key, totals)

    def test_duty_schedule_total_driving_matches_route(self):
        response = self._post_with_mocked_routing()

        schedule = response.data["duty_schedule"]
        total_driving = sum(day["totals"]["driving"] for day in schedule)
        self.assertAlmostEqual(total_driving, self.mock_route["total_driving_hours"], places=4)

    def test_duty_schedule_contains_pickup_and_dropoff(self):
        response = self._post_with_mocked_routing()

        all_labels = [
            seg["label"]
            for day in response.data["duty_schedule"]
            for seg in day["segments"]
            if "label" in seg
        ]
        self.assertIn("Pickup", all_labels)
        self.assertIn("Dropoff", all_labels)

    def test_missing_field_returns_400(self):
        payload = {**self.valid_payload}
        del payload["pickup_location"]

        response = self.client.post(self.url, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("pickup_location", response.data)

    def test_cycle_used_out_of_range_returns_400(self):
        payload = {**self.valid_payload, "current_cycle_used": 71}

        response = self.client.post(self.url, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("current_cycle_used", response.data)

    def test_location_not_found_returns_400(self):
        def geocode_side_effect(location):
            raise GeocodingNotFoundError(location)

        with patch("planner.views.geocode_location", side_effect=geocode_side_effect):
            response = self.client.post(self.url, self.valid_payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(
            response.data["error"],
            "Could not resolve location: Chicago, IL",
        )

    def test_routing_service_unavailable_returns_502(self):
        with (
            patch("planner.views.geocode_location", side_effect=self._mock_geocode),
            patch("planner.views.get_route", side_effect=RoutingServiceError()),
        ):
            response = self.client.post(self.url, self.valid_payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_502_BAD_GATEWAY)
        self.assertEqual(response.data["error"], "Routing service is unavailable.")
