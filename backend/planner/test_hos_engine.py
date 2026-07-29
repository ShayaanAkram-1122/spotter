from django.test import SimpleTestCase

from .hos_engine import (
    CYCLE_RESTART_HOURS,
    DAILY_RESET_REST_HOURS,
    generate_duty_schedule,
)


def total_hours(schedule, status):
    return sum(day.totals[status] for day in schedule)


def all_segments(schedule):
    return [segment for day in schedule for segment in day.segments]


def segment_labels(schedule):
    return [segment.label for segment in all_segments(schedule) if segment.label]


class GenerateDutyScheduleTests(SimpleTestCase):
    def test_short_trip_fits_in_one_day(self):
        schedule = generate_duty_schedule(
            total_driving_hours=5,
            total_distance_miles=250,
            current_cycle_used_hours=0,
        )

        self.assertEqual(len(schedule), 1)
        self.assertAlmostEqual(total_hours(schedule, "driving"), 5)
        self.assertAlmostEqual(total_hours(schedule, "on_duty_not_driving"), 2)
        self.assertAlmostEqual(total_hours(schedule, "off_duty"), 0)
        self.assertIn("Pickup", segment_labels(schedule))
        self.assertIn("Dropoff", segment_labels(schedule))
        self.assertLessEqual(schedule[0].totals["driving"], 11)
        self.assertLessEqual(
            schedule[0].totals["driving"] + schedule[0].totals["on_duty_not_driving"],
            14,
        )

    def test_trip_requires_thirty_minute_break(self):
        schedule = generate_duty_schedule(
            total_driving_hours=10,
            total_distance_miles=500,
            current_cycle_used_hours=0,
        )

        labels = segment_labels(schedule)
        self.assertIn("30-min break", labels)
        self.assertAlmostEqual(total_hours(schedule, "driving"), 10)

        break_segments = [
            segment
            for segment in all_segments(schedule)
            if segment.label == "30-min break"
        ]
        self.assertEqual(len(break_segments), 1)
        self.assertAlmostEqual(break_segments[0].duration, 0.5)

    def test_trip_requires_fuel_stop(self):
        schedule = generate_duty_schedule(
            total_driving_hours=20,
            total_distance_miles=1100,
            current_cycle_used_hours=0,
        )

        labels = segment_labels(schedule)
        self.assertIn("Fuel stop", labels)
        self.assertAlmostEqual(total_hours(schedule, "driving"), 20)

        fuel_segments = [
            segment for segment in all_segments(schedule) if segment.label == "Fuel stop"
        ]
        self.assertGreaterEqual(len(fuel_segments), 1)
        self.assertAlmostEqual(fuel_segments[0].duration, 0.5)

    def test_multi_day_trip_requires_ten_hour_reset(self):
        schedule = generate_duty_schedule(
            total_driving_hours=15,
            total_distance_miles=750,
            current_cycle_used_hours=0,
        )

        self.assertGreater(len(schedule), 1)
        self.assertAlmostEqual(total_hours(schedule, "driving"), 15)

        reset_labels = [
            label for label in segment_labels(schedule) if label == "10-hour off-duty reset"
        ]
        self.assertGreaterEqual(len(reset_labels), 1)

        off_duty_hours = total_hours(schedule, "off_duty")
        self.assertGreaterEqual(off_duty_hours, DAILY_RESET_REST_HOURS)

        for day in schedule:
            self.assertLessEqual(day.totals["driving"], 11 + 1e-4)

    def test_long_trip_requires_thirty_four_hour_restart(self):
        schedule = generate_duty_schedule(
            total_driving_hours=40,
            total_distance_miles=2000,
            current_cycle_used_hours=60,
        )

        labels = segment_labels(schedule)
        self.assertIn("34-hour restart", labels)
        self.assertAlmostEqual(total_hours(schedule, "driving"), 40)

        restart_segments = [
            segment for segment in all_segments(schedule) if segment.label == "34-hour restart"
        ]
        self.assertGreaterEqual(len(restart_segments), 1)
        restart_hours = sum(segment.duration for segment in restart_segments)
        self.assertGreaterEqual(restart_hours, CYCLE_RESTART_HOURS)

    def test_cycle_near_limit_at_start_triggers_restart_before_driving(self):
        schedule = generate_duty_schedule(
            total_driving_hours=2,
            total_distance_miles=100,
            current_cycle_used_hours=69,
        )

        labels = segment_labels(schedule)
        self.assertIn("34-hour restart", labels)
        self.assertAlmostEqual(total_hours(schedule, "driving"), 2)

        segments = all_segments(schedule)
        pickup_index = next(i for i, seg in enumerate(segments) if seg.label == "Pickup")
        restart_index = next(
            i for i, seg in enumerate(segments) if seg.label == "34-hour restart"
        )
        driving_indices = [i for i, seg in enumerate(segments) if seg.status == "driving"]

        self.assertLess(pickup_index, restart_index)
        self.assertTrue(all(index > restart_index for index in driving_indices))

    def test_day_segments_stay_within_twenty_four_hour_window(self):
        schedule = generate_duty_schedule(
            total_driving_hours=25,
            total_distance_miles=1250,
            current_cycle_used_hours=0,
        )

        for day in schedule:
            for segment in day.segments:
                self.assertGreaterEqual(segment.start_hour, 0)
                self.assertLessEqual(segment.end_hour, 24)
                self.assertGreater(segment.end_hour, segment.start_hour)

    def test_day_totals_match_segment_durations(self):
        schedule = generate_duty_schedule(
            total_driving_hours=12,
            total_distance_miles=600,
            current_cycle_used_hours=5,
        )

        for day in schedule:
            for status, hours in day.totals.items():
                expected = sum(
                    segment.duration
                    for segment in day.segments
                    if segment.status == status
                )
                self.assertAlmostEqual(hours, expected)
