-- Production security migration already applied to Supabase.
-- Purpose: prevent direct anon/authenticated access to operational tables.
-- Application server access continues through the server-side Supabase client.

alter table public.stock_locations enable row level security;
alter table public.receiving_sessions enable row level security;
alter table public.receiving_items enable row level security;
alter table public.stock_transfers enable row level security;
alter table public.stock_transfer_items enable row level security;
alter table public.handpick_items enable row level security;

-- No broad anon/authenticated policies are intentionally created here.
-- The application currently performs role authorization in lib/auth.ts and
-- accesses Supabase through the server-side secret-key client.
-- Purpose-built policies should be added when direct client access is introduced.
