-- Fixed build-to-par for liquor / shots (cocktail components). Edit in Supabase or sync from config.

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

comment on table public.liquor_par is
  'Fixed par levels for liquor and shot SKUs (not usage-based). WAT and LU may differ.';
