-- Provi / OHLQ product IDs for liquor inventory ordering.
-- order_via: catalog = add by product ID in Provi; rep_notes = list qty in checkout rep notes.

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

comment on table public.liquor_provi_product is
  'Maps liquor inventory item names to Provi/OHLQ product IDs; rep_notes items go in checkout notes.';

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
