"""Sun–Sat retail weeks (Sunday orders use par from the week that ended Saturday)."""
from __future__ import annotations

import datetime as dt


def last_complete_sun_sat_week(
    today: dt.date | None = None,
) -> tuple[dt.date, dt.date]:
    """
    Most recent complete Sun–Sat week.

    On Saturday, that week is still in progress until midnight — use the prior week
    unless include_in_progress_saturday=True (for end-of-Saturday cron).
    """
    return last_complete_sun_sat_week_ex(today, include_in_progress_saturday=False)


def last_complete_sun_sat_week_ex(
    today: dt.date | None = None,
    *,
    include_in_progress_saturday: bool = False,
) -> tuple[dt.date, dt.date]:
    today = today or dt.date.today()
    if today.weekday() == 5 and include_in_progress_saturday:
        week_end = today
    else:
        days_since_sat = (today.weekday() - 5) % 7
        if days_since_sat == 0:
            days_since_sat = 7
        week_end = today - dt.timedelta(days=days_since_sat)
    week_start = week_end - dt.timedelta(days=6)
    return week_start, week_end


def last_n_week_ranges(
    n: int,
    *,
    today: dt.date | None = None,
) -> list[tuple[dt.date, dt.date]]:
    """Last N complete Sun–Sat weeks (most recent first)."""
    last_start, last_end = last_complete_sun_sat_week(today)
    ranges: list[tuple[dt.date, dt.date]] = [(last_start, last_end)]
    for i in range(1, n):
        week_end = last_end - dt.timedelta(days=7 * i)
        week_start = week_end - dt.timedelta(days=6)
        ranges.append((week_start, week_end))
    return ranges
