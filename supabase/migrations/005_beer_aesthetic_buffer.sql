-- Extra units kept in each cooler so shelves look stocked (added to usage-based par).

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

comment on table public.beer_aesthetic_buffer is
  'Beer inventory only: extra WAT/LU units on top of 6-week avg (rounded to pack size).';

alter table public.beer_aesthetic_buffer enable row level security;

drop policy if exists beer_aesthetic_buffer_app_all on public.beer_aesthetic_buffer;
create policy beer_aesthetic_buffer_app_all on public.beer_aesthetic_buffer
  for all using (true) with check (true);

-- Wild Axe: Michelob, Miller, Modelo = 36; all other beers = 18 (WAT and LU each)
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
