"""Prepare and send distributor order emails from inventory counts."""
from __future__ import annotations

import os
import smtplib
from email.mime.text import MIMEText
from typing import Any

from clover_client import BEER_LINE_ITEMS, canonical_beer_name
from beer_pack import pack_size_for_beer

DISTRIBUTORS = [
    {
        "id": "bonbright",
        "label": "Bonbright",
        "email_env": "BONBRIGHT_ORDER_EMAIL",
        "email_fallback": "avogt@bonbright.com",
        "beers": ["Miller Lite", "Guinness", "Blue Moon", "Coors Light", "Modelo"],
    },
    {
        "id": "heidelberg",
        "label": "Heidelberg",
        "email_env": "HEIDELBERG_ORDER_EMAIL",
        "email_fallback": "wes.feldmeyer@heidelbergdistributing.com",
        "beers": [
            "Michelob Ultra",
            "Yuengling",
            "Bud Light",
            "Angry Orchard",
            "High Noon Pineapple",
            "Busch Light",
            "Truth",
        ],
    },
    {
        "id": "yellow_springs",
        "label": "Yellow Springs",
        "email_env": "YELLOW_SPRINGS_ORDER_EMAIL",
        "email_fallback": "shawn@yellowspringsbrewery.com",
        "beers": ["Boat Show (Yellow Springs)"],
    },
]


def _pack_size(dist_id: str, beer_name: str) -> int:
    return pack_size_for_beer(beer_name)


def _normalize_packs(units_needed: int, pack_size: int) -> dict[str, int]:
    units = max(0, int(units_needed))
    if units == 0:
        return {"packs": 0, "unitsOrdered": 0, "packSize": pack_size}
    packs = (units + pack_size - 1) // pack_size
    return {"packs": packs, "unitsOrdered": packs * pack_size, "packSize": pack_size}


def _distributor_for_beer(name: str):
    canonical = canonical_beer_name(name) or name
    lower = canonical.strip().lower()
    for d in DISTRIBUTORS:
        if any(b.lower() == lower for b in d["beers"]):
            return d
    return None


def _resolve_email(dist: dict) -> str:
    return (os.getenv(dist["email_env"]) or "").strip() or dist["email_fallback"]


def _format_body(dist_label: str, lines: list[dict]) -> str:
    items = "\n".join(
        f"  - {l['name']}: {l['packs']} case{'s' if l['packs'] != 1 else ''} ({l['packSize']}-pack)"
        for l in lines
    )
    return (
        f"Hello {dist_label},\n\n"
        "For this week, we would like:\n\n"
        f"{items}\n\n"
        "Thank you,\n"
        "Wild Axe Throwing"
    )


def prepare_send_orders(lines: list[dict[str, Any]], *, confirm: bool = False) -> dict[str, Any]:
    by_dist: dict[str, dict] = {}
    skipped = []

    for line in lines:
        name = (line.get("name") or "").strip()
        canonical = canonical_beer_name(name)
        if not canonical:
            raise ValueError(f"Unknown item: {name}")
        order_qty = max(0, int(round(float(line.get("orderQty") or 0))))
        if order_qty <= 0:
            continue
        dist = _distributor_for_beer(canonical)
        if not dist:
            skipped.append({"name": canonical, "orderQty": order_qty})
            continue
        pack_size = _pack_size(dist["id"], canonical)
        pack = _normalize_packs(order_qty, pack_size)
        row = {
            "name": canonical,
            "onHand": line.get("onHand"),
            "par": line.get("par"),
            "unitsNeeded": order_qty,
            **pack,
        }
        by_dist.setdefault(dist["id"], {"dist": dist, "lines": []})["lines"].append(row)

    if not by_dist:
        raise ValueError("No distributor mapping for items that need ordering.")

    distributors = []
    emails = []
    for bucket in by_dist.values():
        dist = bucket["dist"]
        dist_lines = bucket["lines"]
        distributors.append(
            {
                "distributorId": dist["id"],
                "distributor": dist["label"],
                "to": _resolve_email(dist),
                "lines": dist_lines,
            }
        )
        emails.append(
            {
                "distributor": dist["label"],
                "to": _resolve_email(dist),
                "subject": "Wild Axe Throwing — weekly beer order",
                "body": _format_body(dist["label"], dist_lines),
                "lines": dist_lines,
            }
        )

    sender = (os.getenv("GMAIL_SENDER") or os.getenv("GOOGLE_GMAIL_USER") or "").strip()

    if not confirm:
        return {
            "ok": True,
            "mode": "review",
            "from": sender,
            "distributors": distributors,
            "emails": emails,
            "skipped": skipped,
        }

    user = (os.getenv("GMAIL_SENDER") or os.getenv("GOOGLE_GMAIL_USER") or "").strip()
    password = (os.getenv("GMAIL_APP_PASSWORD") or os.getenv("GOOGLE_APP_PASSWORD") or "").strip()
    if not user or not password:
        raise RuntimeError(
            "Gmail not configured. Set GMAIL_SENDER and GMAIL_APP_PASSWORD in .env."
        )

    sent = []
    with smtplib.SMTP_SSL("smtp.gmail.com", 465) as smtp:
        smtp.login(user, password)
        for email in emails:
            msg = MIMEText(email["body"])
            msg["Subject"] = email["subject"]
            msg["From"] = f"Wild Axe Throwing <{user}>"
            msg["To"] = email["to"]
            smtp.sendmail(user, [email["to"]], msg.as_string())
            sent.append({"distributor": email["distributor"], "to": email["to"]})

    return {
        "ok": True,
        "mode": "sent",
        "from": sender,
        "message": f"Sent {len(sent)} order email{'s' if len(sent) != 1 else ''} from {sender}.",
        "sent": sent,
        "emails": emails,
        "skipped": skipped,
    }
