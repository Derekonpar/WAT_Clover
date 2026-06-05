import { getConfig } from "./clover.js";

export function supabaseConfig() {
  const url = (process.env.SUPABASE_URL || "").trim().replace(/\/$/, "");
  const projectId = (process.env.SUPABASE_PROJECT_ID || "").trim();
  const base = url || (projectId ? `https://${projectId}.supabase.co` : "");
  const key =
    (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim() ||
    (process.env.SUPABASE_PUBLISHABLE_KEY || "").trim() ||
    (process.env.SUPABASE_ANON_KEY || "").trim();
  const merchantId = getConfig().merchantId;
  return { base, key, merchantId };
}

export function supabaseHeaders(key, extra = {}) {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    Accept: "application/json",
    ...extra,
  };
}
