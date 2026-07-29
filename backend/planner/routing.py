import json
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
OSRM_URL = "https://router.project-osrm.org/route/v1/driving"
USER_AGENT = "snapper-planner/1.0 (local development; snapper trip planner)"
METERS_PER_MILE = 1609.344
SECONDS_PER_HOUR = 3600


class GeocodingNotFoundError(Exception):
    def __init__(self, location: str):
        self.location = location
        super().__init__(f"Could not resolve location: {location}")


class RoutingServiceError(Exception):
    pass


def _get_json(url: str, params: dict) -> object:
    query = urlencode(params)
    request = Request(
        f"{url}?{query}",
        headers={"User-Agent": USER_AGENT},
    )
    try:
        with urlopen(request, timeout=10) as response:
            return json.loads(response.read().decode())
    except (HTTPError, URLError, TimeoutError, json.JSONDecodeError) as exc:
        raise RoutingServiceError("Routing service is unavailable.") from exc


def geocode_location(location: str) -> tuple[float, float]:
    """Geocode a free-text location into (lat, lng) using Nominatim."""
    results = _get_json(
        NOMINATIM_URL,
        {"q": location, "format": "json", "limit": 1},
    )
    if not results:
        raise GeocodingNotFoundError(location)

    first = results[0]
    return float(first["lat"]), float(first["lon"])


def get_route(waypoints: list[tuple[float, float]]) -> dict:
    """
    Route through ordered (lat, lng) waypoints via OSRM.

    Returns total_distance_miles, total_driving_hours, and route_geometry.
    """
    if len(waypoints) < 2:
        raise ValueError("At least two waypoints are required.")

    coordinate_path = ";".join(f"{lng},{lat}" for lat, lng in waypoints)
    url = f"{OSRM_URL}/{coordinate_path}"
    data = _get_json(url, {"overview": "full", "geometries": "geojson"})

    if data.get("code") != "Ok" or not data.get("routes"):
        raise RoutingServiceError("Routing service returned no route.")

    route = data["routes"][0]
    return {
        "total_distance_miles": round(route["distance"] / METERS_PER_MILE, 2),
        "total_driving_hours": round(route["duration"] / SECONDS_PER_HOUR, 2),
        "route_geometry": route["geometry"],
    }
