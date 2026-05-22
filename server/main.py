"""FastAPI server for Clover sales dashboard."""
from __future__ import annotations

import datetime as dt
import sys
from pathlib import Path

from typing import Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from clover_client import fetch_sales_report, get_config, load_dotenv, parse_last_week_range  # noqa: E402

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


dist = ROOT / "web" / "dist"
if dist.exists():
    app.mount("/", StaticFiles(directory=str(dist), html=True), name="static")
