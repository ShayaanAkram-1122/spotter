from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from .routing import GeocodingNotFoundError, RoutingServiceError, geocode_location, get_route
from .serializers import TripRequestSerializer


LOCATION_FIELDS = ("current_location", "pickup_location", "dropoff_location")


@api_view(["GET"])
def health(request):
    return Response({"status": "ok"})


@api_view(["POST"])
def create_trip(request):
    serializer = TripRequestSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    data = serializer.validated_data

    coordinates = {}
    waypoints = []

    for field in LOCATION_FIELDS:
        location = data[field]
        try:
            lat, lng = geocode_location(location)
        except GeocodingNotFoundError:
            return Response(
                {"error": f"Could not resolve location: {location}"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except RoutingServiceError:
            return Response(
                {"error": "Geocoding service is unavailable."},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        coordinates[field] = {"lat": lat, "lng": lng}
        waypoints.append((lat, lng))

    try:
        route = get_route(waypoints)
    except RoutingServiceError:
        return Response(
            {"error": "Routing service is unavailable."},
            status=status.HTTP_502_BAD_GATEWAY,
        )

    return Response(
        {
            **data,
            "coordinates": coordinates,
            **route,
        },
        status=status.HTTP_200_OK,
    )
