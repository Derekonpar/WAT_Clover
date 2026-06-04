-- Paste this entire file into Supabase → SQL → New query → Run once.

-- 001 usage_weekly
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

-- 002 liquor_par
create table if not exists public.liquor_par (
  id bigint generated always as identity primary key,
  merchant_id text not null,
  item_name text not null,
  wat_par integer not null default 0 check (wat_par >= 0),
  lu_par integer not null default 0 check (lu_par >= 0),
  updated_at timestamptz not null default now(),
  constraint liquor_par_unique unique (merchant_id, item_name)
);

create index if not exists liquor_par_merchant_idx on public.liquor_par (merchant_id);

-- 003 RLS (needed when using SUPABASE_PUBLISHABLE_KEY instead of service_role)
alter table public.usage_weekly enable row level security;
alter table public.liquor_par enable row level security;

drop policy if exists usage_weekly_app_all on public.usage_weekly;
create policy usage_weekly_app_all on public.usage_weekly
  for all using (true) with check (true);

drop policy if exists liquor_par_app_all on public.liquor_par;
create policy liquor_par_app_all on public.liquor_par
  for all using (true) with check (true);

-- 004 beer_pack_size
create table if not exists public.beer_pack_size (
  id bigint generated always as identity primary key,
  merchant_id text not null,
  beer_name text not null,
  distributor_id text not null,
  pack_size integer not null check (pack_size > 0),
  updated_at timestamptz not null default now(),
  constraint beer_pack_size_unique unique (merchant_id, beer_name)
);

create index if not exists beer_pack_size_merchant_idx on public.beer_pack_size (merchant_id);

alter table public.beer_pack_size enable row level security;

drop policy if exists beer_pack_size_app_all on public.beer_pack_size;
create policy beer_pack_size_app_all on public.beer_pack_size
  for all using (true) with check (true);

insert into public.beer_pack_size (merchant_id, beer_name, distributor_id, pack_size)
values
  ('F94ACDTMC3C51', 'Miller Lite', 'bonbright', 12),
  ('F94ACDTMC3C51', 'Guinness', 'bonbright', 12),
  ('F94ACDTMC3C51', 'Blue Moon', 'bonbright', 12),
  ('F94ACDTMC3C51', 'Coors Light', 'bonbright', 8),
  ('F94ACDTMC3C51', 'Modelo', 'bonbright', 12),
  ('F94ACDTMC3C51', 'Michelob Ultra', 'heidelberg', 24),
  ('F94ACDTMC3C51', 'Yuengling', 'heidelberg', 24),
  ('F94ACDTMC3C51', 'Bud Light', 'heidelberg', 24),
  ('F94ACDTMC3C51', 'Angry Orchard', 'heidelberg', 24),
  ('F94ACDTMC3C51', 'High Noon Pineapple', 'heidelberg', 24),
  ('F94ACDTMC3C51', 'Busch Light', 'heidelberg', 24),
  ('F94ACDTMC3C51', 'Truth', 'heidelberg', 24),
  ('F94ACDTMC3C51', 'Boat Show (Yellow Springs)', 'yellow_springs', 12)
on conflict (merchant_id, beer_name) do update
  set distributor_id = excluded.distributor_id,
      pack_size = excluded.pack_size,
      updated_at = now();

-- 005 beer_aesthetic_buffer
create table if not exists public.beer_aesthetic_buffer (
  id bigint generated always as identity primary key,
  merchant_id text not null,
  beer_name text not null,
  wat_buffer integer not null default 18 check (wat_buffer >= 0),
  lu_buffer integer not null default 18 check (lu_buffer >= 0),
  updated_at timestamptz not null default now(),
  constraint beer_aesthetic_buffer_unique unique (merchant_id, beer_name)
);

create index if not exists beer_aesthetic_buffer_merchant_idx
  on public.beer_aesthetic_buffer (merchant_id);

alter table public.beer_aesthetic_buffer enable row level security;

drop policy if exists beer_aesthetic_buffer_app_all on public.beer_aesthetic_buffer;
create policy beer_aesthetic_buffer_app_all on public.beer_aesthetic_buffer
  for all using (true) with check (true);

insert into public.beer_aesthetic_buffer (merchant_id, beer_name, wat_buffer, lu_buffer)
values
  ('F94ACDTMC3C51', 'Michelob Ultra', 36, 36),
  ('F94ACDTMC3C51', 'Miller Lite', 36, 36),
  ('F94ACDTMC3C51', 'Modelo', 36, 36),
  ('F94ACDTMC3C51', 'Angry Orchard', 18, 18),
  ('F94ACDTMC3C51', 'Blue Moon', 18, 18),
  ('F94ACDTMC3C51', 'Boat Show (Yellow Springs)', 18, 18),
  ('F94ACDTMC3C51', 'Bud Light', 18, 18),
  ('F94ACDTMC3C51', 'Busch Light', 18, 18),
  ('F94ACDTMC3C51', 'Coors Light', 18, 18),
  ('F94ACDTMC3C51', 'Guinness', 18, 18),
  ('F94ACDTMC3C51', 'High Noon Pineapple', 18, 18),
  ('F94ACDTMC3C51', 'Truth', 18, 18),
  ('F94ACDTMC3C51', 'Yuengling', 18, 18)
on conflict (merchant_id, beer_name) do update
  set wat_buffer = excluded.wat_buffer,
      lu_buffer = excluded.lu_buffer,
      updated_at = now();

-- 006 liquor_provi_product
create table if not exists public.liquor_provi_product (
  id bigint generated always as identity primary key,
  merchant_id text not null,
  item_name text not null,
  provi_product_id text,
  order_via text not null default 'catalog'
    check (order_via in ('catalog', 'rep_notes')),
  updated_at timestamptz not null default now(),
  constraint liquor_provi_product_unique unique (merchant_id, item_name)
);

create index if not exists liquor_provi_product_merchant_idx
  on public.liquor_provi_product (merchant_id);

alter table public.liquor_provi_product enable row level security;

drop policy if exists liquor_provi_product_app_all on public.liquor_provi_product;
create policy liquor_provi_product_app_all on public.liquor_provi_product
  for all using (true) with check (true);

insert into public.liquor_provi_product (merchant_id, item_name, provi_product_id, order_via)
values
  ('F94ACDTMC3C51', 'Amaretto', '0071B', 'catalog'),
  ('F94ACDTMC3C51', 'Svedka Blue Raspberry', '8867B', 'catalog'),
  ('F94ACDTMC3C51', 'Knobb Creek Maple', '5480B', 'catalog'),
  ('F94ACDTMC3C51', 'Crown Royal Apple Shot', '2383L', 'catalog'),
  ('F94ACDTMC3C51', 'Captain Morgan Shot', '1755L', 'catalog'),
  ('F94ACDTMC3C51', 'Woodford Reserve Shot', '9674L', 'catalog'),
  ('F94ACDTMC3C51', 'Tito Shot', '9232L', 'catalog'),
  ('F94ACDTMC3C51', 'Patron Shot', '7984B', 'catalog'),
  ('F94ACDTMC3C51', 'Jack Daniel Shot', '0066L', 'catalog'),
  ('F94ACDTMC3C51', 'Cruzan Vanilla', null, 'rep_notes'),
  ('F94ACDTMC3C51', 'Triple Sec', null, 'rep_notes'),
  ('F94ACDTMC3C51', 'Strawberry Pucker', null, 'rep_notes'),
  ('F94ACDTMC3C51', 'Orange bitters', null, 'rep_notes'),
  ('F94ACDTMC3C51', 'Midori', null, 'rep_notes'),
  ('F94ACDTMC3C51', 'Simple Syrup', null, 'rep_notes'),
  ('F94ACDTMC3C51', 'Grenadine', null, 'rep_notes'),
  ('F94ACDTMC3C51', 'Sour mix', null, 'rep_notes')
on conflict (merchant_id, item_name) do update
  set provi_product_id = excluded.provi_product_id,
      order_via = excluded.order_via,
      updated_at = now();
