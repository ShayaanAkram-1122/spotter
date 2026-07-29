from unittest.mock import patch

from django.test import SimpleTestCase

from .routing import (
    GeocodingNotFoundError,
    RoutingServiceError,
    geocode_location,
    get_route,
)


class RoutingServiceTests(SimpleTestCase):
    def test_geocode_location_returns_coordinates(self):
        with patch(
            "planner.routing._get_json",
            return_value=[{"lat": "41.8781", "lon": "-87.6298"}],
        ):
            lat, lng = geocode_location("Chicago, IL")

        self.assertEqual(lat, 41.8781)
        self.assertEqual(lng, -87.6298)

    def test_geocode_location_not_found_raises(self):
        with patch("planner.routing._get_json", return_value=[]):
            with self.assertRaises(GeocodingNotFoundError) as ctx:
                geocode_location("Nowhere, ZZ")

        self.assertEqual(ctx.exception.location, "Nowhere, ZZ")

    def test_get_route_returns_distance_duration_and_geometry(self):
        osrm_response = {
            "code": "Ok",
            "routes": [
                {
                    "distance": 1609344,
                    "duration": 65700,
                    "geometry": {
                        "type": "LineString",
                        "coordinates": [[-87.6, 41.8], [-96.7, 32.7]],
                    },
                }
            ],
        }
        waypoints = [(41.8781, -87.6298), (32.7767, -96.7970)]

        with patch("planner.routing._get_json", return_value=osrm_response):
            route = get_route(waypoints)

        self.assertEqual(route["total_distance_miles"], 1000.0)
        self.assertEqual(route["total_driving_hours"], 18.25)
        self.assertEqual(route["route_geometry"]["type"], "LineString")

    def test_get_route_service_error_when_no_route(self):
        with patch("planner.routing._get_json", return_value={"code": "NoRoute", "routes": []}):
            with self.assertRaises(RoutingServiceError):
                get_route([(41.8781, -87.6298), (32.7767, -96.7970)])
