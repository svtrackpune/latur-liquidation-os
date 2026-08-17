-- Production migration already applied to Supabase as automation_first_operations.
alter table products add column if not exists barcode text;
create index if not exists idx_products_barcode on products(barcode);
create table if not exists stock_locations(id uuid primary key default gen_random_uuid(), name text not null unique, town text, location_type text default 'warehouse', active boolean default true, created_at timestamptz default now());
create table if not exists receiving_sessions(id uuid primary key default gen_random_uuid(), lot_id uuid references lots(id), status text default 'in_progress', expected_units numeric default 0, received_units numeric default 0, discrepancy_units numeric default 0, started_by text, completed_by text, started_at timestamptz default now(), completed_at timestamptz, notes text);
create table if not exists receiving_items(id uuid primary key default gen_random_uuid(), receiving_id uuid references receiving_sessions(id) on delete cascade, product_id uuid references products(id), sku text, barcode text, quantity numeric default 1, grade text, verification_status text default 'verified', discrepancy_note text, verified_by text, verified_at timestamptz default now());
create table if not exists stock_transfers(id uuid primary key default gen_random_uuid(), transfer_no text unique not null, from_location text not null, to_location text not null, status text default 'in_transit', created_by text, dispatched_at timestamptz default now(), received_at timestamptz, notes text);
create table if not exists stock_transfer_items(id uuid primary key default gen_random_uuid(), transfer_id uuid references stock_transfers(id) on delete cascade, product_id uuid references products(id), sku text, quantity numeric default 1, received_qty numeric default 0);
create table if not exists handpick_items(id uuid primary key default gen_random_uuid(), admin_user text not null, visit_date date default current_date, vendor_id uuid references suppliers(id), lot_id uuid references lots(id), barcode text, product_name text not null, brand text, model text, serial_no text, quantity numeric default 1, observed_condition text, market_price numeric, target_buy_price numeric, decision text default 'pending', notes text, created_at timestamptz default now());
create index if not exists idx_products_location_status on products(location,status);
create index if not exists idx_products_sku on products(sku);
create index if not exists idx_receiving_lot on receiving_sessions(lot_id);
create index if not exists idx_transfer_status on stock_transfers(status);
create index if not exists idx_handpick_visit on handpick_items(visit_date);
insert into stock_locations(name,town,location_type) values ('Latur Warehouse','Latur','warehouse'),('Nilanga Warehouse','Nilanga','warehouse'),('Deoni','Deoni','shop'),('Udgir','Udgir','shop') on conflict(name) do nothing;
