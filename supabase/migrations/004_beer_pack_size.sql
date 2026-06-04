-- Case/pack size per beer for distributor order emails (units per case).

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

comment on table public.beer_pack_size is
  'Units per case when ordering from distributor (Bonbright Coors 8, Heidelberg 24, etc.).';

alter table public.beer_pack_size enable row level security;

drop policy if exists beer_pack_size_app_all on public.beer_pack_size;
create policy beer_pack_size_app_all on public.beer_pack_size
  for all using (true) with check (true);

-- Seed Wild Axe (edit merchant_id if needed)
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
