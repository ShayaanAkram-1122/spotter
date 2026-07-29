from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal

DutyStatus = Literal[
    "off_duty",
    "sleeper_berth",
    "driving",
    "on_duty_not_driving",
]

ALL_STATUSES: tuple[DutyStatus, ...] = (
    "off_duty",
    "sleeper_berth",
    "driving",
    "on_duty_not_driving",
)

EPSILON = 1e-6

FUEL_INTERVAL_MILES = 1000
FUEL_STOP_HOURS = 0.5
PICKUP_HOURS = 1.0
DROPOFF_HOURS = 1.0
BREAK_HOURS = 0.5
MAX_DAILY_DRIVING_HOURS = 11.0
MAX_DAILY_ON_DUTY_HOURS = 14.0
MAX_DRIVING_BEFORE_BREAK_HOURS = 8.0
DAILY_RESET_REST_HOURS = 10.0
CYCLE_MAX_HOURS = 70.0
CYCLE_RESTART_HOURS = 34.0


@dataclass(frozen=True)
class DutySegment:
    status: DutyStatus
    start_hour: float
    end_hour: float
    label: str | None = None

    @property
    def duration(self) -> float:
        return self.end_hour - self.start_hour


@dataclass
class DaySchedule:
    day_index: int
    segments: list[DutySegment] = field(default_factory=list)

    @property
    def totals(self) -> dict[DutyStatus, float]:
        totals = {status: 0.0 for status in ALL_STATUSES}
        for segment in self.segments:
            totals[segment.status] += segment.duration
        return totals


def generate_duty_schedule(
    total_driving_hours: float,
    total_distance_miles: float,
    current_cycle_used_hours: float,
) -> list[DaySchedule]:
    """Generate FMCSA-style duty schedules for a trip."""
    simulator = _HOSSimulator(
        total_driving_hours=total_driving_hours,
        total_distance_miles=total_distance_miles,
        current_cycle_used_hours=current_cycle_used_hours,
    )
    return simulator.run()


class _HOSSimulator:
    def __init__(
        self,
        total_driving_hours: float,
        total_distance_miles: float,
        current_cycle_used_hours: float,
    ) -> None:
        self.remaining_driving_hours = max(total_driving_hours, 0.0)
        self.total_distance_miles = max(total_distance_miles, 0.0)
        self.miles_per_driving_hour = (
            self.total_distance_miles / total_driving_hours
            if total_driving_hours > EPSILON
            else 0.0
        )

        self.cycle_used_hours = max(current_cycle_used_hours, 0.0)
        self.day_index = 0
        self.current_hour = 0.0
        self.day_driving_hours = 0.0
        self.day_on_duty_hours = 0.0
        self.driving_since_break_hours = 0.0
        self.miles_since_last_fuel = 0.0
        self.miles_driven = 0.0

        self.pickup_done = False
        self.dropoff_done = False

        self.days: list[DaySchedule] = []
        self._current_day = DaySchedule(day_index=self.day_index)

    def run(self) -> list[DaySchedule]:
        if not self.pickup_done:
            self._ensure_cycle_capacity(PICKUP_HOURS)
            self._add_on_duty_not_driving(PICKUP_HOURS, "Pickup")
            self.pickup_done = True

        while self.remaining_driving_hours > EPSILON:
            if self._day_limits_reached():
                self._add_daily_reset()
                continue

            if self._needs_fuel_stop():
                self._ensure_cycle_capacity(FUEL_STOP_HOURS)
                self._add_on_duty_not_driving(FUEL_STOP_HOURS, "Fuel stop")
                self.miles_since_last_fuel = 0.0
                continue

            if self._needs_break():
                self._ensure_cycle_capacity(BREAK_HOURS)
                self._add_on_duty_not_driving(BREAK_HOURS, "30-min break")
                self.driving_since_break_hours = 0.0
                continue

            drive_hours = self._max_drive_chunk()
            if drive_hours <= EPSILON:
                self._ensure_cycle_capacity(
                    min(self.remaining_driving_hours, MAX_DRIVING_BEFORE_BREAK_HOURS)
                )
                continue

            self._add_driving(drive_hours)

        if not self.dropoff_done:
            self._ensure_cycle_capacity(DROPOFF_HOURS)
            self._add_on_duty_not_driving(DROPOFF_HOURS, "Dropoff")
            self.dropoff_done = True

        self._finalize_current_day()
        return self.days

    def _day_limits_reached(self) -> bool:
        return (
            self.day_driving_hours >= MAX_DAILY_DRIVING_HOURS - EPSILON
            or self.day_on_duty_hours >= MAX_DAILY_ON_DUTY_HOURS - EPSILON
        )

    def _needs_break(self) -> bool:
        return self.driving_since_break_hours >= MAX_DRIVING_BEFORE_BREAK_HOURS - EPSILON

    def _needs_fuel_stop(self) -> bool:
        return self.miles_since_last_fuel >= FUEL_INTERVAL_MILES - EPSILON

    def _cycle_capacity_remaining(self) -> float:
        return CYCLE_MAX_HOURS - self.cycle_used_hours

    def _ensure_cycle_capacity(self, on_duty_hours: float) -> None:
        if on_duty_hours <= self._cycle_capacity_remaining() + EPSILON:
            return
        self._add_cycle_restart()

    def _max_drive_chunk(self) -> float:
        if self.remaining_driving_hours <= EPSILON:
            return 0.0

        limits = [self.remaining_driving_hours]

        if self.day_driving_hours < MAX_DAILY_DRIVING_HOURS:
            limits.append(MAX_DAILY_DRIVING_HOURS - self.day_driving_hours)

        if self.day_on_duty_hours < MAX_DAILY_ON_DUTY_HOURS:
            limits.append(MAX_DAILY_ON_DUTY_HOURS - self.day_on_duty_hours)

        if self.driving_since_break_hours < MAX_DRIVING_BEFORE_BREAK_HOURS:
            limits.append(MAX_DRIVING_BEFORE_BREAK_HOURS - self.driving_since_break_hours)

        if self.miles_per_driving_hour > EPSILON:
            miles_until_fuel = FUEL_INTERVAL_MILES - self.miles_since_last_fuel
            if miles_until_fuel > EPSILON:
                limits.append(miles_until_fuel / self.miles_per_driving_hour)

        cycle_remaining = self._cycle_capacity_remaining()
        if cycle_remaining <= EPSILON:
            return 0.0
        limits.append(cycle_remaining)

        return max(0.0, min(limits))

    def _add_daily_reset(self) -> None:
        self._add_off_duty(DAILY_RESET_REST_HOURS, "10-hour off-duty reset")
        self.day_driving_hours = 0.0
        self.day_on_duty_hours = 0.0
        self.driving_since_break_hours = 0.0
        self._begin_next_work_day()

    def _add_cycle_restart(self) -> None:
        self._add_off_duty(CYCLE_RESTART_HOURS, "34-hour restart")
        self.cycle_used_hours = 0.0
        self.day_driving_hours = 0.0
        self.day_on_duty_hours = 0.0
        self.driving_since_break_hours = 0.0
        self._begin_next_work_day()

    def _begin_next_work_day(self) -> None:
        if self.current_hour <= EPSILON:
            return

        self._finalize_current_day()
        self.day_index += 1
        self.current_hour = 0.0
        self._current_day = DaySchedule(day_index=self.day_index)

    def _add_driving(self, hours: float) -> None:
        miles = hours * self.miles_per_driving_hour
        self._add_segment("driving", hours, "Driving")
        self.remaining_driving_hours -= hours
        self.day_driving_hours += hours
        self.day_on_duty_hours += hours
        self.driving_since_break_hours += hours
        self.cycle_used_hours += hours
        self.miles_since_last_fuel += miles
        self.miles_driven += miles

    def _add_on_duty_not_driving(self, hours: float, label: str) -> None:
        self._add_segment("on_duty_not_driving", hours, label)
        self.day_on_duty_hours += hours
        self.cycle_used_hours += hours

    def _add_off_duty(self, hours: float, label: str) -> None:
        self._add_segment("off_duty", hours, label)

    def _add_segment(self, status: DutyStatus, duration: float, label: str | None) -> None:
        remaining = duration

        while remaining > EPSILON:
            space_in_day = 24.0 - self.current_hour
            chunk = min(remaining, space_in_day)

            self._current_day.segments.append(
                DutySegment(
                    status=status,
                    start_hour=round(self.current_hour, 4),
                    end_hour=round(self.current_hour + chunk, 4),
                    label=label,
                )
            )

            self.current_hour += chunk
            remaining -= chunk

            if self.current_hour >= 24.0 - EPSILON:
                self._finalize_current_day()
                self.day_index += 1
                self.current_hour = 0.0
                self._current_day = DaySchedule(day_index=self.day_index)

    def _finalize_current_day(self) -> None:
        if not self._current_day.segments:
            return
        self.days.append(self._current_day)
        self._current_day = DaySchedule(day_index=self.day_index)
