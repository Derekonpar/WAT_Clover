"""FastAPI server for Clover sales dashboard."""
from __future__ import annotations

import datetime as dt
import sys
from pathlib import Path

from typing import List, Optional, Union

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from clover_client import (  # noqa: E402
    fetch_liquor_catalog,
    fetch_liquor_sales_report,
    fetch_sales_report,
    fetch_usage_report,
    get_config,
    list_clover_categories,
    load_dotenv,
    parse_last_week_range,
)
from inventory_orders import prepare_send_orders  # noqa: E402
from liquor_orders import prepare_liquor_orders  # noqa: E402
from liquor_provi_map import liquor_provi_map_from_supabase  # noqa: E402
from supabase_client import test_connection  # noqa: E402
from beer_pack import beer_pack_sizes_from_supabase, pack_size_for_beer  # noqa: E402
from liquor_par import liquor_par_from_supabase  # noqa: E402
from usage_sync import (  # noqa: E402
    suggested_par_from_supabase,
    sync_weeks_to_supabase,
    update_beer_par_for_orders,
)

load_dotenv()

app = FastAPI(title="Clover Sales Dashboard", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health():
    try:
        cfg = get_config()
        return {"ok": True, "merchant_id": cfg.merchant_id}
    except Exception as e:
        return {"ok": False, "error": str(e)}


@app.get("/api/sales")
def sales(
    start_date: Optional[str] = Query(None, description="YYYY-MM-DD"),
    end_date: Optional[str] = Query(None, description="YYYY-MM-DD"),
    preset: Optional[str] = Query(None, description="last_week | last_7_days"),
    refresh: bool = Query(False, description="Bypass cache and call Clover again"),
):
    today = dt.date.today()

    if preset == "last_week":
        start_d, end_d = parse_last_week_range(today)
    elif preset == "last_7_days":
        end_d = today
        start_d = today - dt.timedelta(days=6)
    else:
        if not start_date or not end_date:
            raise HTTPException(
                status_code=400,
                detail="Provide start_date and end_date, or preset=last_week|last_7_days",
            )
        try:
            start_d = dt.date.fromisoformat(start_date)
            end_d = dt.date.fromisoformat(end_date)
        except ValueError as e:
            raise HTTPException(status_code=400, detail="Invalid date format") from e

    try:
        return fetch_sales_report(str(start_d), str(end_d), force_refresh=refresh)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e


class OrderLineIn(BaseModel):
    name: str
    onHand: Union[float, int]
    par: Union[float, int]
    orderQty: int


class SendOrdersIn(BaseModel):
    lines: List[OrderLineIn]
    confirm: bool = False
    submit: bool = False


@app.get("/api/supabase/health")
def supabase_health():
    try:
        return test_connection()
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@app.post("/api/usage/sync")
def usage_sync(
    weeks: int = Query(8, ge=1, le=26, description="Weeks of history to sync"),
    refresh: bool = Query(False, description="Bypass Clover cache when pulling weeks"),
):
    try:
        return sync_weeks_to_supabase(weeks, force_refresh=refresh)
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@app.post("/api/beer-par/update")
def beer_par_update(
    refresh: bool = Query(True, description="Pull fresh Clover data for the synced week"),
):
    """Sync last Sun–Sat week to Supabase and return 6-week average beer par."""
    try:
        return update_beer_par_for_orders(force_refresh=refresh)
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@app.get("/api/beer-par/status")
def beer_par_status():
    """Which Sun–Sat week par is based on (for gating Sunday orders)."""
    try:
        from week_calendar import last_complete_sun_sat_week

        ws, we = last_complete_sun_sat_week()
        return {
            "ok": True,
            "order_week": {"start": str(ws), "end": str(we)},
        }
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@app.get("/api/suggested-par")
def suggested_par(
    weeks: int = Query(6, ge=1, le=26, description="Weeks to average for beer par"),
    refresh: bool = Query(False, description="Bypass server cache"),
):
    try:
        return suggested_par_from_supabase(weeks, force_refresh=refresh)
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@app.get("/api/liquor-par")
def liquor_par(
    refresh: bool = Query(False, description="Bypass server cache"),
):
    try:
        return liquor_par_from_supabase(force_refresh=refresh)
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@app.get("/api/liquor-provi-map")
def liquor_provi_map(
    refresh: bool = Query(False, description="Bypass server cache"),
):
    try:
        return liquor_provi_map_from_supabase(force_refresh=refresh)
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@app.get("/api/usage")
def usage(
    start_date: Optional[str] = Query(None, description="YYYY-MM-DD"),
    end_date: Optional[str] = Query(None, description="YYYY-MM-DD"),
    preset: Optional[str] = Query(None, description="last_week | last_7_days"),
    refresh: bool = Query(False, description="Bypass cache and call Clover again"),
):
    today = dt.date.today()

    if preset == "last_week":
        start_d, end_d = parse_last_week_range(today)
    elif preset == "last_7_days":
        end_d = today
        start_d = today - dt.timedelta(days=6)
    else:
        if not start_date or not end_date:
            raise HTTPException(
                status_code=400,
                detail="Provide start_date and end_date, or preset=last_week|last_7_days",
            )
        try:
            start_d = dt.date.fromisoformat(start_date)
            end_d = dt.date.fromisoformat(end_date)
        except ValueError as e:
            raise HTTPException(status_code=400, detail="Invalid date format") from e

    try:
        return fetch_usage_report(str(start_d), str(end_d), force_refresh=refresh)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e


@app.get("/api/liquor-sales")
def liquor_sales(
    start_date: Optional[str] = Query(None, description="YYYY-MM-DD"),
    end_date: Optional[str] = Query(None, description="YYYY-MM-DD"),
    preset: Optional[str] = Query(None, description="last_week | last_7_days"),
    refresh: bool = Query(False, description="Bypass cache and call Clover again"),
):
    today = dt.date.today()

    if preset == "last_week":
        start_d, end_d = parse_last_week_range(today)
    elif preset == "last_7_days":
        end_d = today
        start_d = today - dt.timedelta(days=6)
    else:
        if not start_date or not end_date:
            raise HTTPException(
                status_code=400,
                detail="Provide start_date and end_date, or preset=last_week|last_7_days",
            )
        try:
            start_d = dt.date.fromisoformat(start_date)
            end_d = dt.date.fromisoformat(end_date)
        except ValueError as e:
            raise HTTPException(status_code=400, detail="Invalid date format") from e

    try:
        return fetch_liquor_sales_report(str(start_d), str(end_d), force_refresh=refresh)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e


@app.get("/api/catalog")
def catalog(refresh: bool = Query(False, description="Bypass cache and call Clover again")):
    try:
        cfg = get_config()
        from clover_client import fetch_liquor_inventory_catalog

        result = fetch_liquor_inventory_catalog(cfg, force_refresh=refresh)
        return {"ok": True, **result}
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e


@app.get("/api/beer-pack-sizes")
def beer_pack_sizes(
    refresh: bool = Query(False, description="Bypass server cache"),
):
    try:
        return beer_pack_sizes_from_supabase(force_refresh=refresh)
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@app.get("/api/catalog/categories")
def catalog_categories():
    """List Clover category names (troubleshooting)."""
    try:
        cfg = get_config()
        return {"ok": True, "categories": list_clover_categories(cfg)}
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e


@app.post("/api/send-orders")
def send_orders(body: SendOrdersIn):
    try:
        return prepare_send_orders(
            [line.model_dump() for line in body.lines],
            confirm=body.confirm,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@app.post("/api/send-liquor-orders")
def send_liquor_orders(body: SendOrdersIn):
    try:
        return prepare_liquor_orders(
            [line.model_dump() for line in body.lines],
            confirm=body.confirm,
            submit=body.submit,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


dist = ROOT / "web" / "dist"
if dist.exists():
    app.mount("/", StaticFiles(directory=str(dist), html=True), name="static")
