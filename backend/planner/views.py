from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from .hos_engine import DutySegment, DaySchedule, generate_duty_schedule
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

    schedule = generate_duty_schedule(
        total_driving_hours=route["total_driving_hours"],
        total_distance_miles=route["total_distance_miles"],
        current_cycle_used_hours=data["current_cycle_used"],
    )

    return Response(
        {
            **data,
            "coordinates": coordinates,
            **route,
            "duty_schedule": _serialize_schedule(schedule),
        },
        status=status.HTTP_200_OK,
    )


def _serialize_schedule(schedule: list[DaySchedule]) -> list[dict]:
    return [
        {
            "day_index": day.day_index,
            "segments": [_serialize_segment(seg) for seg in day.segments],
            "totals": day.totals,
        }
        for day in schedule
    ]


def _serialize_segment(seg: DutySegment) -> dict:
    result = {
        "status": seg.status,
        "start_hour": seg.start_hour,
        "end_hour": seg.end_hour,
    }
    if seg.label is not None:
        result["label"] = seg.label
    return result
