const PROVI_APP_URL = (process.env.PROVI_APP_URL || "https://app.provi.com").replace(/\/$/, "");
const PROVI_RETAILER_ID = process.env.PROVI_RETAILER_ID || "403032";
const PROVI_OHLQ_ACCOUNT_NUMBER = process.env.PROVI_OHLQ_ACCOUNT_NUMBER || "9609977";
const PROVI_LOCATION_NAME = process.env.PROVI_LOCATION_NAME || "Wild Axe";
const PROVI_ALLOW_SUBMIT = (process.env.PROVI_ALLOW_SUBMIT ?? "true").toLowerCase() in {
  "1": true,
  true: true,
  yes: true,
};
const DEFAULT_OHLQ_DISTRIBUTOR_ID = 16114;

export class ProviApiError extends Error {
  constructor(message, { status = null, body = null } = {}) {
    super(message);
    this.name = "ProviApiError";
    this.status = status;
    this.body = body;
  }
}

function decodeURIComponentSafe(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function loadCookiesFromEnv() {
  const raw = process.env.PROVI_COOKIES_JSON;
  if (!raw) {
    throw new ProviApiError(
      "PROVI_COOKIES_JSON is not set. Run: python3 scripts/provi/export_vercel_env.py",
    );
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new ProviApiError("PROVI_COOKIES_JSON must be valid JSON.");
  }

  if (Array.isArray(parsed)) {
    const out = {};
    for (const c of parsed) {
      if (c?.name && c?.value != null) out[c.name] = String(c.value);
    }
    return out;
  }
  if (parsed && typeof parsed === "object") {
    return Object.fromEntries(
      Object.entries(parsed).map(([k, v]) => [k, String(v)]),
    );
  }
  throw new ProviApiError("PROVI_COOKIES_JSON must be a cookie array or name/value object.");
}

export class ProviClient {
  constructor(cookies = null, { retailerContext = null } = {}) {
    this.cookies = cookies || loadCookiesFromEnv();
    this.xsrf = decodeURIComponentSafe(this.cookies["XSRF-TOKEN"] || "");
    this.retailerContext = retailerContext || PROVI_RETAILER_ID;
  }

  headers({ jsonBody = false } = {}) {
    const h = {
      Accept: "*/*",
      Origin: PROVI_APP_URL,
      Referer: `${PROVI_APP_URL}/`,
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Cookie: Object.entries(this.cookies)
        .map(([k, v]) => `${k}=${v}`)
        .join("; "),
    };
    if (jsonBody) h["Content-Type"] = "application/json; charset=utf-8";
    if (this.xsrf) h["X-XSRF-TOKEN"] = this.xsrf;
    if (this.retailerContext) h["X-Tiz-Retailer-Context"] = String(this.retailerContext);
    return h;
  }

  async request(method, path, { query = null, body = null } = {}) {
    let url = `${PROVI_APP_URL}${path}`;
    if (query && Object.keys(query).length) {
      const params = new URLSearchParams();
      for (const [k, v] of Object.entries(query)) {
        if (v != null) params.append(k, String(v));
      }
      url = `${url}?${params}`;
    }

    const res = await fetch(url, {
      method: method.toUpperCase(),
      headers: this.headers({ jsonBody: body != null }),
      body: body != null ? JSON.stringify(body) : undefined,
    });

    const text = await res.text();
    if (!res.ok) {
      throw new ProviApiError(
        `Provi API ${res.status} ${method} ${path}: ${text.slice(0, 300)}`,
        { status: res.status, body: text },
      );
    }
    if (!text) return null;
    return JSON.parse(text);
  }

  get(path, query = {}) {
    return this.request("GET", path, { query });
  }

  post(path, body = null, query = {}) {
    return this.request("POST", path, { query, body });
  }

  put(path, body = null) {
    return this.request("PUT", path, { body });
  }

  async searchProductLines(sku, { limit = 20 } = {}) {
    const data = await this.get("/api/retailer/product_lines", {
      search: sku,
      page: 1,
      page_name: "search",
      page_value: sku,
      limit,
    });
    if (Array.isArray(data)) return data;
    return data?.product_lines || data?.placements || [];
  }

  productLineDetail(productLineId, { distributorId = DEFAULT_OHLQ_DISTRIBUTOR_ID } = {}) {
    return this.get(`/api/retailer/product_lines/${productLineId}`, {
      distributor_id: distributorId,
      distributor_override: "true",
    });
  }

  static inventoryRowsFromProductLine(pl) {
    const rows = [];
    for (const prod of pl.products || []) {
      for (const inv of prod.inventory || []) {
        rows.push({
          sku: String(inv.sku || "").trim(),
          inventory_id: Number(inv.id),
          distributor_id: inv.distributor_id,
          container_size: prod.container_size,
          product_line_id: pl.id,
          product_name: pl.name,
        });
      }
    }
    return rows;
  }

  static walkInventoryNodes(obj, out, productLineId = null) {
    if (obj && typeof obj === "object" && !Array.isArray(obj)) {
      const sku = String(obj.sku || "").trim();
      const invId = obj.inventory_id ?? obj.id;
      if (sku && invId != null && ("inventory_id" in obj || obj.sold_by)) {
        out.push({
          sku,
          inventory_id: Number(invId),
          distributor_id: obj.distributor_id,
          container_size: obj.container_size,
          product_line_id: productLineId,
        });
      }
      for (const v of Object.values(obj)) ProviClient.walkInventoryNodes(v, out, productLineId);
    } else if (Array.isArray(obj)) {
      for (const item of obj) ProviClient.walkInventoryNodes(item, out, productLineId);
    }
  }

  async resolveInventoryBySku(proviSku, { distributorId = DEFAULT_OHLQ_DISTRIBUTOR_ID } = {}) {
    const target = String(proviSku || "").trim().toUpperCase();
    if (!target) throw new ProviApiError("Empty Provi SKU");

    const candidates = [];
    for (const pl of await this.searchProductLines(proviSku)) {
      candidates.push(...ProviClient.inventoryRowsFromProductLine(pl));
      const plId = pl.id;
      if (plId && candidates.length <= 1) {
        try {
          const detail = await this.productLineDetail(Number(plId), { distributorId });
          ProviClient.walkInventoryNodes(detail, candidates, Number(plId));
        } catch {
          /* ignore detail failures */
        }
      }
    }

    const seen = new Set();
    const unique = [];
    for (const row of candidates) {
      if (seen.has(row.inventory_id)) continue;
      seen.add(row.inventory_id);
      unique.push(row);
    }

    const exact = unique.filter((r) => r.sku.toUpperCase() === target);
    if (exact.length === 1) return exact[0];
    if (exact.length > 1) {
      throw new ProviApiError(`Multiple inventory rows for SKU ${proviSku}: ${JSON.stringify(exact)}`);
    }
    if (!unique.length) throw new ProviApiError(`No Provi inventory found for SKU ${proviSku}`);

    const available = [...new Set(unique.map((r) => r.sku))].sort().join(", ");
    throw new ProviApiError(
      `SKU ${proviSku} not found. Available variants from search: ${available}. Check liquor_provi_product mapping.`,
    );
  }

  async getCart() {
    const data = await this.get("/api/retailer/cart");
    if (!data || typeof data !== "object") throw new ProviApiError("Unexpected cart response");
    if (data.cart && typeof data.cart === "object") return data.cart;
    if (data.id != null || data.orders) return data;
    return data;
  }

  addUnitsToCart(inventoryId, unitQuantity) {
    const qty = Math.max(0, Math.round(Number(unitQuantity) || 0));
    if (qty <= 0) throw new ProviApiError("unit_quantity must be > 0");
    return this.post(`/api/retailer/cart_widget_items/${inventoryId}/update_cart`, {
      cart_product: {
        inventory_id: inventoryId,
        case_quantity: 0,
        unit_quantity: qty,
        warehouse_id: null,
      },
    });
  }

  findOhlqOrderId(cart) {
    for (const order of cart.orders || []) {
      const name = String(order.distributor?.name || "").toLowerCase();
      if (name.includes("ohlq") || order.distributor_id === DEFAULT_OHLQ_DISTRIBUTOR_ID) {
        return Number(order.id);
      }
    }
    const orders = cart.orders || [];
    if (orders.length === 1) return Number(orders[0].id);
    return null;
  }

  setRetailerNotes(orderId, notes) {
    return this.put(`/api/retailer/orders/${orderId}`, {
      order: { retailer_notes: notes, backup_notes: null },
    });
  }

  async submitCart() {
    const result = await this.post("/api/retailer/cart/submit");
    if (result && typeof result === "object") {
      if (result.cart && typeof result.cart === "object") return result.cart;
      if (result.id != null || result.submitted_at != null) return result;
    }
    return { raw: result };
  }

  async getLocationContext() {
    const authRows = await this.get("/api/retailer/retailer_user_authentications");
    const rows = Array.isArray(authRows) ? authRows : [];

    let ohlqAccount = null;
    let retailerId = null;
    for (const row of rows) {
      if (row.distributor_id === DEFAULT_OHLQ_DISTRIBUTOR_ID) {
        ohlqAccount = String(row.account_number || "").trim() || null;
        if (row.retailer_id != null) retailerId = Number(row.retailer_id);
        break;
      }
    }

    let retailerName = null;
    const cart = await this.getCart();
    for (const order of cart.orders || []) {
      retailerName = order.retailer?.name || null;
      if (retailerId == null && order.retailer_id != null) retailerId = Number(order.retailer_id);
      break;
    }
    if (retailerId == null && cart.retailer_id != null) retailerId = Number(cart.retailer_id);

    return {
      ohlq_account_number: ohlqAccount,
      retailer_name: retailerName,
      retailer_id: retailerId,
      retailer_context_header: this.retailerContext,
    };
  }

  async assertExpectedLocation() {
    const ctx = await this.getLocationContext();
    const acct = ctx.ohlq_account_number;
    const name = String(ctx.retailer_name || "").trim();
    const retailerId = ctx.retailer_id;

    if (PROVI_RETAILER_ID && retailerId != null && String(retailerId) !== String(PROVI_RETAILER_ID)) {
      throw new ProviApiError(
        `Provi API is targeting retailer ${retailerId}, expected ${PROVI_RETAILER_ID} (${PROVI_LOCATION_NAME}).`,
      );
    }
    if (PROVI_OHLQ_ACCOUNT_NUMBER && acct && acct !== PROVI_OHLQ_ACCOUNT_NUMBER) {
      throw new ProviApiError(
        `Provi session is on the wrong location. OHLQ account is ${acct}, expected ${PROVI_OHLQ_ACCOUNT_NUMBER} (${PROVI_LOCATION_NAME}).`,
      );
    }
    if (name && !name.toLowerCase().includes(PROVI_LOCATION_NAME.toLowerCase())) {
      throw new ProviApiError(
        `Provi cart retailer is "${name}", expected "${PROVI_LOCATION_NAME}".`,
      );
    }
    if (!acct && retailerId == null) {
      throw new ProviApiError("Could not verify Provi location from session.");
    }

    return {
      ...ctx,
      ok: true,
      expected_ohlq_account: PROVI_OHLQ_ACCOUNT_NUMBER,
      expected_retailer_id: PROVI_RETAILER_ID,
      expected_location_name: PROVI_LOCATION_NAME,
    };
  }
}

export function proviSubmitAllowed() {
  return PROVI_ALLOW_SUBMIT;
}
