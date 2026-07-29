from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase


class CreateTripTests(APITestCase):
    def setUp(self):
        self.url = reverse("create_trip")
        self.valid_payload = {
            "current_location": "Chicago, IL",
            "pickup_location": "Dallas, TX",
            "dropoff_location": "Houston, TX",
            "current_cycle_used": 12.5,
        }

    def test_valid_input_returns_200(self):
        response = self.client.post(self.url, self.valid_payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["current_location"], "Chicago, IL")
        self.assertEqual(response.data["pickup_location"], "Dallas, TX")
        self.assertEqual(response.data["dropoff_location"], "Houston, TX")
        self.assertEqual(response.data["current_cycle_used"], 12.5)

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
