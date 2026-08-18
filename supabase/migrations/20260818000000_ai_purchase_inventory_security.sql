-- Production schema record for the automated liquidation workflow.
-- The application performs authorized writes through the server-side service-role client.
-- RLS prevents direct anon/authenticated access to operational tables.

alter table public.stock_locations enable row level security;
alter table public.receiving_sessions enable row level security;
alter table public.receiving_items enable row level security;
alter table public.stock_transfers enable row level security;
alter table public.stock_transfer_items enable row level security;
alter table public.handpick_items enable row level security;

alter table public.handpick_items
  add column if not exists photo_paths jsonb not null default '[]'::jsonb,
  add column if not exists ai_status text not null default 'pending',
  add column if not exists ai_report jsonb not null default '{}'::jsonb,
  add column if not exists ai_quality_score numeric,
  add column if not exists ai_authenticity_score numeric,
  add column if not exists lowest_online_price numeric,
  add column if not exists lowest_online_price_url text,
  add column if not exists online_price_sources jsonb not null default '[]'::jsonb,
  add column if not exists recommended_qty integer,
  add column if not exists recommended_bid_price numeric,
  add column if not exists recommended_landed_cost numeric,
  add column if not exists recommended_sell_price numeric,
  add column if not exists minimum_margin_pct numeric not null default 30,
  add column if not exists customer_discount_pct numeric not null default 50,
  add column if not exists purchase_status text not null default 'pending',
  add column if not exists purchase_qty numeric,
  add column if not exists purchase_unit_price numeric,
  add column if not exists purchase_confirmed_at timestamptz,
  add column if not exists purchase_confirmed_by text,
  add column if not exists promotion_decision text not null default 'pending',
  add column if not exists promotion_status text not null default 'not_started',
  add column if not exists promotion_next_reminder_at timestamptz,
  add column if not exists promotion_last_reminded_at timestamptz,
  add column if not exists promotion_completed_at timestamptz,
  add column if not exists ai_evaluated_at timestamptz;

create table if not exists public.handpick_ai_evaluations (
  id uuid primary key default gen_random_uuid(),
  handpick_item_id uuid not null references public.handpick_items(id) on delete cascade,
  provider text not null default 'openai',
  model text,
  status text not null default 'completed',
  input_media jsonb not null default '[]'::jsonb,
  report jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.handpick_ai_evaluations enable row level security;

create table if not exists public.inventory_units (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references public.products(id) on delete set null,
  lot_id uuid references public.lots(id) on delete set null,
  handpick_item_id uuid references public.handpick_items(id) on delete set null,
  unit_barcode text not null unique,
  lot_code text,
  product_code text,
  product_name text not null,
  selling_price numeric not null default 0,
  status text not null default 'received',
  location_id uuid references public.stock_locations(id) on delete set null,
  verified_by text,
  verified_at timestamptz,
  label_printed_at timestamptz,
  sold_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.inventory_units enable row level security;
create index if not exists inventory_units_lot_idx on public.inventory_units(lot_id);
create index if not exists inventory_units_status_idx on public.inventory_units(status);

create table if not exists public.product_banners (
  id uuid primary key default gen_random_uuid(),
  lot_id uuid references public.lots(id) on delete cascade,
  title text not null,
  highlighted_items jsonb not null default '[]'::jsonb,
  image_path text,
  caption text,
  status text not null default 'generated',
  created_at timestamptz not null default now()
);
alter table public.product_banners enable row level security;
create index if not exists product_banners_lot_idx on public.product_banners(lot_id);

create table if not exists public.social_promotions (
  id uuid primary key default gen_random_uuid(),
  lot_id uuid references public.lots(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  handpick_item_id uuid references public.handpick_items(id) on delete set null,
  channel text not null,
  status text not null default 'queued',
  scheduled_at timestamptz,
  published_at timestamptz,
  external_id text,
  creative_path text,
  copy_text text,
  error_message text,
  reminder_count integer not null default 0,
  created_at timestamptz not null default now()
);
alter table public.social_promotions enable row level security;
create index if not exists social_promotions_status_idx on public.social_promotions(status, scheduled_at);

create table if not exists public.transport_providers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact_name text,
  phone text,
  mode text,
  base_cost numeric not null default 0,
  per_km_cost numeric not null default 0,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.transport_providers enable row level security;

create index if not exists handpick_items_purchase_status_idx on public.handpick_items(purchase_status, promotion_decision);
create index if not exists handpick_items_ai_status_idx on public.handpick_items(ai_status);
