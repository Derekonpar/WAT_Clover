"""HTTP client for Provi retailer API (from intercept capture)."""
from __future__ import annotations

import json
import ssl
import urllib.error
import urllib.parse
import urllib.request
from typing import Any

from provi.paths import PROVI_APP_URL, PROVI_LOCATION_NAME, PROVI_OHLQ_ACCOUNT_NUMBER, PROVI_RETAILER_ID
from provi.session_cookies import cookies_for_domain, load_session_cookies, retailer_context_from_session, xsrf_token

BASE = PROVI_APP_URL.rstrip("/")
DEFAULT_OHLQ_DISTRIBUTOR_ID = 16114


class ProviApiError(RuntimeError):
    def __init__(self, message: str, *, status: int | None = None, body: str | None = None):
        super().__init__(message)
        self.status = status
        self.body = body


class ProviClient:
    def __init__(self, cookies: dict[str, str] | None = None, *, retailer_context: str | None = None):
        raw = cookies or cookies_for_domain(load_session_cookies())
        self.cookies = raw
        self.xsrf = xsrf_token(raw)
        self.retailer_context = retailer_context or retailer_context_from_session() or PROVI_RETAILER_ID

    def _headers(self, *, json_body: bool = False) -> dict[str, str]:
        h = {
            "Accept": "*/*",
            "Origin": BASE,
            "Referer": f"{BASE}/",
            "User-Agent": (
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            ),
        }
        if json_body:
            h["Content-Type"] = "application/json; charset=utf-8"
        if self.xsrf:
            h["X-XSRF-TOKEN"] = self.xsrf
        if self.retailer_context:
            h["X-Tiz-Retailer-Context"] = str(self.retailer_context)
        return h

    def _cookie_header(self) -> str:
        return "; ".join(f"{k}={v}" for k, v in self.cookies.items())

    def request(
        self,
        method: str,
        path: str,
        *,
        query: dict[str, Any] | None = None,
        body: dict[str, Any] | None = None,
    ) -> Any:
        url = f"{BASE}{path}"
        if query:
            url = f"{url}?{urllib.parse.urlencode(query, doseq=True)}"

        data = None
        if body is not None:
            data = json.dumps(body).encode("utf-8")

        req = urllib.request.Request(
            url,
            data=data,
            method=method.upper(),
            headers={**self._headers(json_body=body is not None), "Cookie": self._cookie_header()},
        )
        ctx = ssl.create_default_context()
        try:
            with urllib.request.urlopen(req, context=ctx, timeout=60) as resp:
                raw = resp.read().decode("utf-8")
                if not raw:
                    return None
                return json.loads(raw)
        except urllib.error.HTTPError as e:
            err_body = e.read().decode("utf-8", errors="replace")
            raise ProviApiError(
                f"Provi API {e.code} {method} {path}: {err_body[:300]}",
                status=e.code,
                body=err_body,
            ) from e

    def get(self, path: str, **query: Any) -> Any:
        return self.request("GET", path, query=query or None)

    def post(self, path: str, body: dict[str, Any] | None = None, **query: Any) -> Any:
        return self.request("POST", path, query=query or None, body=body)

    def put(self, path: str, body: dict[str, Any] | None = None) -> Any:
        return self.request("PUT", path, body=body)

    def search_product_lines(self, sku: str, *, limit: int = 20) -> list[dict[str, Any]]:
        data = self.get(
            "/api/retailer/product_lines",
            search=sku,
            page=1,
            page_name="search",
            page_value=sku,
            limit=limit,
        )
        if isinstance(data, list):
            return data
        return data.get("product_lines") or data.get("placements") or []

    def product_line_detail(self, product_line_id: int, *, distributor_id: int = DEFAULT_OHLQ_DISTRIBUTOR_ID) -> Any:
        return self.get(
            f"/api/retailer/product_lines/{product_line_id}",
            distributor_id=distributor_id,
            distributor_override="true",
        )

    @staticmethod
    def _inventory_rows_from_product_line(pl: dict[str, Any]) -> list[dict[str, Any]]:
        rows: list[dict[str, Any]] = []
        for prod in pl.get("products") or []:
            for inv in prod.get("inventory") or []:
                rows.append(
                    {
                        "sku": (inv.get("sku") or "").strip(),
                        "inventory_id": int(inv.get("id")),
                        "distributor_id": inv.get("distributor_id"),
                        "container_size": prod.get("container_size"),
                        "product_line_id": pl.get("id"),
                        "product_name": pl.get("name"),
                    }
                )
        return rows

    @staticmethod
    def _walk_inventory_nodes(obj: Any, out: list[dict[str, Any]], product_line_id: int | None = None) -> None:
        if isinstance(obj, dict):
            sku = (obj.get("sku") or "").strip()
            inv_id = obj.get("inventory_id") or obj.get("id")
            if sku and inv_id and ("inventory_id" in obj or obj.get("sold_by")):
                try:
                    out.append(
                        {
                            "sku": sku,
                            "inventory_id": int(inv_id if "inventory_id" in obj else inv_id),
                            "distributor_id": obj.get("distributor_id"),
                            "container_size": obj.get("container_size"),
                            "product_line_id": product_line_id,
                        }
                    )
                except (TypeError, ValueError):
                    pass
            for v in obj.values():
                ProviClient._walk_inventory_nodes(v, out, product_line_id)
        elif isinstance(obj, list):
            for item in obj:
                ProviClient._walk_inventory_nodes(item, out, product_line_id)

    def resolve_inventory_by_sku(
        self,
        provi_sku: str,
        *,
        distributor_id: int | None = DEFAULT_OHLQ_DISTRIBUTOR_ID,
    ) -> dict[str, Any]:
        """
        Match exact Provi product code (e.g. 9232L) among size variants (9232B, 9232D…).
        """
        target = provi_sku.strip().upper()
        if not target:
            raise ProviApiError(f"Empty Provi SKU")

        candidates: list[dict[str, Any]] = []
        for pl in self.search_product_lines(provi_sku):
            candidates.extend(self._inventory_rows_from_product_line(pl))
            pl_id = pl.get("id")
            if pl_id and len(candidates) <= 1:
                try:
                    detail = self.product_line_detail(int(pl_id), distributor_id=distributor_id or DEFAULT_OHLQ_DISTRIBUTOR_ID)
                    self._walk_inventory_nodes(detail, candidates, int(pl_id))
                except ProviApiError:
                    pass

        # De-dupe by inventory_id
        seen: set[int] = set()
        unique: list[dict[str, Any]] = []
        for row in candidates:
            iid = row["inventory_id"]
            if iid in seen:
                continue
            seen.add(iid)
            unique.append(row)

        exact = [r for r in unique if r["sku"].upper() == target]
        if len(exact) == 1:
            return exact[0]
        if len(exact) > 1:
            raise ProviApiError(f"Multiple inventory rows for SKU {provi_sku}: {exact}")

        if not unique:
            raise ProviApiError(f"No Provi inventory found for SKU {provi_sku}")

        available = ", ".join(sorted({r["sku"] for r in unique}))
        raise ProviApiError(
            f"SKU {provi_sku} not found. Available variants from search: {available}. "
            "Check liquor_provi_product mapping."
        )

    def get_location_context(self) -> dict[str, Any]:
        """Which Provi retailer/location the client is targeting."""
        auth_rows = self.get("/api/retailer/retailer_user_authentications")
        if not isinstance(auth_rows, list):
            auth_rows = []

        ohlq_account: str | None = None
        retailer_id: int | None = None
        for row in auth_rows:
            if row.get("distributor_id") == DEFAULT_OHLQ_DISTRIBUTOR_ID:
                ohlq_account = (row.get("account_number") or "").strip() or None
                rid = row.get("retailer_id")
                if rid is not None:
                    retailer_id = int(rid)
                break

        retailer_name: str | None = None
        cart = self.get_cart()
        for order in cart.get("orders") or []:
            retailer_name = (order.get("retailer") or {}).get("name")
            if retailer_id is None and order.get("retailer_id") is not None:
                retailer_id = int(order["retailer_id"])
            break
        if retailer_id is None and cart.get("retailer_id") is not None:
            retailer_id = int(cart["retailer_id"])

        return {
            "ohlq_account_number": ohlq_account,
            "retailer_name": retailer_name,
            "retailer_id": retailer_id,
            "retailer_context_header": self.retailer_context,
        }

    def assert_expected_location(self) -> dict[str, Any]:
        """
        Refuse to build carts unless API calls target Wild Axe (403032 / OHLQ 9609977).
        """
        ctx = self.get_location_context()
        acct = ctx.get("ohlq_account_number")
        name = (ctx.get("retailer_name") or "").strip()
        retailer_id = ctx.get("retailer_id")

        if PROVI_RETAILER_ID and retailer_id is not None and str(retailer_id) != str(PROVI_RETAILER_ID):
            raise ProviApiError(
                f"Provi API is targeting retailer {retailer_id}, expected {PROVI_RETAILER_ID} "
                f"({PROVI_LOCATION_NAME}). Header sent: {self.retailer_context!r}. "
                "Run: python3 scripts/provi/setup_session.py, select Wild Axe Throwing, press Enter."
            )

        if PROVI_OHLQ_ACCOUNT_NUMBER and acct and acct != PROVI_OHLQ_ACCOUNT_NUMBER:
            raise ProviApiError(
                f"Provi session is on the wrong location. OHLQ account is {acct}, "
                f"expected {PROVI_OHLQ_ACCOUNT_NUMBER} ({PROVI_LOCATION_NAME}). "
                f"Header sent: {self.retailer_context!r}. "
                "Run: python3 scripts/provi/setup_session.py — select Wild Axe Throwing, press Enter."
            )

        if name and PROVI_LOCATION_NAME.lower() not in name.lower():
            raise ProviApiError(
                f"Provi cart retailer is “{name}”, expected “{PROVI_LOCATION_NAME}”. "
                "Run: python3 scripts/provi/setup_session.py and select Wild Axe Throwing."
            )

        if not acct and retailer_id is None:
            raise ProviApiError(
                "Could not verify Provi location from session. "
                "Run: python3 scripts/provi/setup_session.py and select Wild Axe Throwing."
            )

        ctx["ok"] = True
        ctx["expected_ohlq_account"] = PROVI_OHLQ_ACCOUNT_NUMBER
        ctx["expected_retailer_id"] = PROVI_RETAILER_ID
        ctx["expected_location_name"] = PROVI_LOCATION_NAME
        return ctx

    def get_cart(self) -> dict[str, Any]:
        data = self.get("/api/retailer/cart")
        if not isinstance(data, dict):
            raise ProviApiError("Unexpected cart response")
        inner = data.get("cart")
        if inner is not None and isinstance(inner, dict):
            return inner
        if data.get("id") is not None or data.get("orders") is not None:
            return data
        return data

    def add_units_to_cart(self, inventory_id: int, unit_quantity: int) -> dict[str, Any]:
        qty = max(0, int(unit_quantity))
        if qty <= 0:
            raise ProviApiError("unit_quantity must be > 0")
        return self.post(
            f"/api/retailer/cart_widget_items/{inventory_id}/update_cart",
            body={
                "cart_product": {
                    "inventory_id": inventory_id,
                    "case_quantity": 0,
                    "unit_quantity": qty,
                    "warehouse_id": None,
                }
            },
        )

    def find_ohlq_order_id(self, cart: dict[str, Any] | None = None) -> int | None:
        cart = cart or self.get_cart()
        for order in cart.get("orders") or []:
            dist = order.get("distributor") or {}
            name = (dist.get("name") or "").lower()
            if "ohlq" in name or order.get("distributor_id") == DEFAULT_OHLQ_DISTRIBUTOR_ID:
                return int(order["id"])
        orders = cart.get("orders") or []
        if len(orders) == 1:
            return int(orders[0]["id"])
        return None

    def set_retailer_notes(self, order_id: int, notes: str) -> dict[str, Any]:
        return self.put(
            f"/api/retailer/orders/{order_id}",
            body={"order": {"retailer_notes": notes, "backup_notes": None}},
        )
