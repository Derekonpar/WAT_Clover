-- Weekly item usage from Clover (run in Supabase SQL editor)

create table if not exists public.usage_weekly (
  id bigint generated always as identity primary key,
  merchant_id text not null,
  week_start date not null,
  week_end date not null,
  item_name text not null,
  category_name text not null default '',
  quantity_sold integer not null default 0,
  gross_minor_units integer not null default 0,
  synced_at timestamptz not null default now(),
  constraint usage_weekly_unique unique (merchant_id, week_start, item_name)
);

create index if not exists usage_weekly_merchant_week_idx
  on public.usage_weekly (merchant_id, week_start desc);

create index if not exists usage_weekly_item_idx
  on public.usage_weekly (merchant_id, item_name);

comment on table public.usage_weekly is
  'Per-item Clover sales totals by calendar week (Mon–Sun) for par calculations.';
