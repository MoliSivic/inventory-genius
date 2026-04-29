-- Supabase-native backend for Inventory Genius.
-- Run this in Supabase Dashboard > SQL Editor.
--
-- This replaces the old single-row inventory_app_state JSON backend with
-- normalized tables protected by RLS. It intentionally inserts no demo products,
-- demo customers, demo orders, demo receipts, or demo payments.

do $$
begin
  create type public.app_role as enum ('customer', 'admin');
exception
  when duplicate_object then null;
end $$;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  role public.app_role not null default 'customer',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists touch_user_profiles_updated_at on public.user_profiles;
create trigger touch_user_profiles_updated_at
before update on public.user_profiles
for each row execute function public.touch_updated_at();

create or replace function public.create_profile_for_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_profiles (user_id, email, full_name, role)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    'customer'
  )
  on conflict (user_id) do update
  set
    email = excluded.email,
    full_name = coalesce(public.user_profiles.full_name, excluded.full_name),
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists create_profile_after_auth_user_insert on auth.users;
create trigger create_profile_after_auth_user_insert
after insert on auth.users
for each row execute function public.create_profile_for_auth_user();

insert into public.user_profiles (user_id, email, full_name, role)
select
  id,
  coalesce(email, ''),
  coalesce(raw_user_meta_data ->> 'full_name', raw_user_meta_data ->> 'name'),
  'customer'
from auth.users
on conflict (user_id) do nothing;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_profiles
    where user_id = auth.uid()
      and role = 'admin'
  );
$$;

create table if not exists public.app_settings (
  id text primary key default 'default',
  shop_name text not null default 'Inventory Genius',
  shop_email text,
  shop_telegram text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint app_settings_singleton check (id = 'default')
);

create table if not exists public.categories (
  name text primary key,
  default_unit text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.markets (
  name text primary key,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.products (
  id text primary key,
  name text not null,
  category text not null,
  units text[] not null default '{}',
  stock numeric not null default 0,
  avg_cost numeric not null default 0,
  total_cost_basis numeric not null default 0,
  cost_layers jsonb not null default '[]'::jsonb,
  sale_sub_units jsonb,
  min_stock numeric not null default 0,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint products_cost_layers_array check (jsonb_typeof(cost_layers) = 'array'),
  constraint products_sale_sub_units_array check (
    sale_sub_units is null or jsonb_typeof(sale_sub_units) = 'array'
  )
);

create table if not exists public.product_variants (
  id text primary key,
  product_id text not null references public.products(id) on delete cascade,
  size text,
  color text,
  type text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.factories (
  id text primary key,
  name text not null,
  phone text not null default '',
  location text not null default '',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.customers (
  id text primary key,
  auth_user_id uuid references auth.users(id) on delete set null,
  name text not null,
  phone text not null default '',
  market text not null default '',
  telegram text,
  type text not null default 'Buyer App',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.buyer_accounts (
  id text primary key,
  auth_user_id uuid unique references auth.users(id) on delete cascade,
  email text not null unique,
  password_digest text not null default '',
  name text not null,
  phone text,
  telegram text,
  market text not null default '',
  location text not null default '',
  customer_id text not null references public.customers(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.stock_in_invoices (
  id text primary key,
  invoice_number text not null unique,
  factory_id text not null references public.factories(id) on delete restrict,
  date text not null,
  total numeric not null default 0,
  photo text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.stock_in_items (
  invoice_id text not null references public.stock_in_invoices(id) on delete cascade,
  line_no integer not null,
  product_id text not null references public.products(id) on delete restrict,
  quantity numeric not null,
  buy_price numeric not null,
  primary key (invoice_id, line_no)
);

create table if not exists public.sales (
  id text primary key,
  receipt_number text not null unique,
  customer_id text not null references public.customers(id) on delete restrict,
  date text not null,
  archived_at text,
  total numeric not null default 0,
  estimated_profit numeric not null default 0,
  paid_amount numeric not null default 0,
  payment_status text not null default 'unpaid' check (payment_status in ('paid', 'unpaid', 'partial')),
  telegram_status text not null default 'not_sent' check (telegram_status in ('not_sent', 'customer', 'owner', 'both', 'failed')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sale_items (
  sale_id text not null references public.sales(id) on delete cascade,
  line_no integer not null,
  product_id text not null references public.products(id) on delete restrict,
  quantity numeric not null,
  unit text,
  stock_quantity numeric,
  unit_price numeric not null,
  avg_cost_at_sale numeric not null default 0,
  primary key (sale_id, line_no)
);

create table if not exists public.buyer_orders (
  id text primary key,
  order_number text not null unique,
  buyer_id text not null references public.buyer_accounts(id) on delete cascade,
  customer_id text not null references public.customers(id) on delete restrict,
  date text not null,
  updated_at_text text not null,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'packing', 'completed', 'cancelled')),
  payment_status text not null default 'unpaid' check (payment_status in ('paid', 'unpaid', 'partial')),
  paid_amount numeric not null default 0,
  total_estimate numeric not null default 0,
  notes text,
  seller_note text,
  sale_id text references public.sales(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.buyer_order_items (
  order_id text not null references public.buyer_orders(id) on delete cascade,
  line_no integer not null,
  product_id text not null references public.products(id) on delete restrict,
  quantity numeric not null,
  unit text,
  stock_quantity numeric not null,
  estimated_unit_price numeric,
  primary key (order_id, line_no)
);

create table if not exists public.payments (
  id text primary key,
  customer_id text not null references public.customers(id) on delete restrict,
  sale_id text references public.sales(id) on delete cascade,
  amount numeric not null,
  date text not null,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.customer_prices (
  customer_id text not null references public.customers(id) on delete cascade,
  product_id text not null references public.products(id) on delete cascade,
  unit text not null default '',
  price numeric not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (customer_id, product_id, unit)
);

insert into public.app_settings (id, shop_name)
values ('default', 'Inventory Genius')
on conflict (id) do nothing;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'app_settings',
    'categories',
    'markets',
    'products',
    'product_variants',
    'factories',
    'customers',
    'buyer_accounts',
    'stock_in_invoices',
    'sales',
    'buyer_orders',
    'payments',
    'customer_prices'
  ]
  loop
    execute format(
      'drop trigger if exists %I on public.%I',
      'touch_' || table_name || '_updated_at',
      table_name
    );
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.touch_updated_at()',
      'touch_' || table_name || '_updated_at',
      table_name
    );
  end loop;
end $$;

alter table public.user_profiles enable row level security;
alter table public.app_settings enable row level security;
alter table public.categories enable row level security;
alter table public.markets enable row level security;
alter table public.products enable row level security;
alter table public.product_variants enable row level security;
alter table public.factories enable row level security;
alter table public.customers enable row level security;
alter table public.buyer_accounts enable row level security;
alter table public.stock_in_invoices enable row level security;
alter table public.stock_in_items enable row level security;
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;
alter table public.buyer_orders enable row level security;
alter table public.buyer_order_items enable row level security;
alter table public.payments enable row level security;
alter table public.customer_prices enable row level security;

grant usage on schema public to anon, authenticated;
grant usage on type public.app_role to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on public.app_settings, public.categories, public.markets, public.products, public.product_variants to anon;

drop policy if exists "users read own profile" on public.user_profiles;
drop policy if exists "admins read profiles" on public.user_profiles;
drop policy if exists "admins update profiles" on public.user_profiles;

create policy "users read own profile"
on public.user_profiles for select
to authenticated
using (auth.uid() = user_id);

create policy "admins read profiles"
on public.user_profiles for select
to authenticated
using (public.is_admin());

create policy "admins update profiles"
on public.user_profiles for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'app_settings',
    'categories',
    'markets',
    'products',
    'product_variants',
    'factories',
    'customers',
    'buyer_accounts',
    'stock_in_invoices',
    'stock_in_items',
    'sales',
    'sale_items',
    'buyer_orders',
    'buyer_order_items',
    'payments',
    'customer_prices'
  ]
  loop
    execute format(
      'drop policy if exists %I on public.%I',
      'admins manage ' || table_name,
      table_name
    );
    execute format(
      'create policy %I on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())',
      'admins manage ' || table_name,
      table_name
    );
  end loop;
end $$;

create policy "customers read app settings"
on public.app_settings for select
to authenticated
using (true);

create policy "customers read categories"
on public.categories for select
to authenticated
using (true);

create policy "customers read markets"
on public.markets for select
to authenticated
using (true);

create policy "customers read products"
on public.products for select
to authenticated
using (true);

create policy "customers read product variants"
on public.product_variants for select
to authenticated
using (true);

create policy "customers read own customer profile"
on public.customers for select
to authenticated
using (auth_user_id = auth.uid());

create policy "customers insert own customer profile"
on public.customers for insert
to authenticated
with check (auth_user_id = auth.uid());

create policy "customers update own customer profile"
on public.customers for update
to authenticated
using (auth_user_id = auth.uid())
with check (auth_user_id = auth.uid());

create policy "customers read own buyer account"
on public.buyer_accounts for select
to authenticated
using (auth_user_id = auth.uid());

create policy "customers insert own buyer account"
on public.buyer_accounts for insert
to authenticated
with check (auth_user_id = auth.uid());

create policy "customers update own buyer account"
on public.buyer_accounts for update
to authenticated
using (auth_user_id = auth.uid())
with check (auth_user_id = auth.uid());

create policy "customers read own buyer orders"
on public.buyer_orders for select
to authenticated
using (
  exists (
    select 1
    from public.buyer_accounts ba
    where ba.id = buyer_orders.buyer_id
      and ba.auth_user_id = auth.uid()
  )
);

create policy "customers insert own pending buyer orders"
on public.buyer_orders for insert
to authenticated
with check (
  status = 'pending'
  and sale_id is null
  and exists (
    select 1
    from public.buyer_accounts ba
    where ba.id = buyer_orders.buyer_id
      and ba.auth_user_id = auth.uid()
  )
);

create policy "customers update own pending buyer orders"
on public.buyer_orders for update
to authenticated
using (
  status = 'pending'
  and sale_id is null
  and exists (
    select 1
    from public.buyer_accounts ba
    where ba.id = buyer_orders.buyer_id
      and ba.auth_user_id = auth.uid()
  )
)
with check (
  status = 'pending'
  and sale_id is null
  and exists (
    select 1
    from public.buyer_accounts ba
    where ba.id = buyer_orders.buyer_id
      and ba.auth_user_id = auth.uid()
  )
);

create policy "customers read own buyer order items"
on public.buyer_order_items for select
to authenticated
using (
  exists (
    select 1
    from public.buyer_orders bo
    join public.buyer_accounts ba on ba.id = bo.buyer_id
    where bo.id = buyer_order_items.order_id
      and ba.auth_user_id = auth.uid()
  )
);

create policy "customers insert own buyer order items"
on public.buyer_order_items for insert
to authenticated
with check (
  exists (
    select 1
    from public.buyer_orders bo
    join public.buyer_accounts ba on ba.id = bo.buyer_id
    where bo.id = buyer_order_items.order_id
      and bo.status = 'pending'
      and bo.sale_id is null
      and ba.auth_user_id = auth.uid()
  )
);

create policy "customers update own buyer order items"
on public.buyer_order_items for update
to authenticated
using (
  exists (
    select 1
    from public.buyer_orders bo
    join public.buyer_accounts ba on ba.id = bo.buyer_id
    where bo.id = buyer_order_items.order_id
      and bo.status = 'pending'
      and bo.sale_id is null
      and ba.auth_user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.buyer_orders bo
    join public.buyer_accounts ba on ba.id = bo.buyer_id
    where bo.id = buyer_order_items.order_id
      and bo.status = 'pending'
      and bo.sale_id is null
      and ba.auth_user_id = auth.uid()
  )
);

create policy "customers read own sales"
on public.sales for select
to authenticated
using (
  exists (
    select 1
    from public.customers c
    where c.id = sales.customer_id
      and c.auth_user_id = auth.uid()
  )
);

create policy "customers read own sale items"
on public.sale_items for select
to authenticated
using (
  exists (
    select 1
    from public.sales s
    join public.customers c on c.id = s.customer_id
    where s.id = sale_items.sale_id
      and c.auth_user_id = auth.uid()
  )
);

create policy "customers read own payments"
on public.payments for select
to authenticated
using (
  exists (
    select 1
    from public.customers c
    where c.id = payments.customer_id
      and c.auth_user_id = auth.uid()
  )
);

create policy "customers read own customer prices"
on public.customer_prices for select
to authenticated
using (
  exists (
    select 1
    from public.customers c
    where c.id = customer_prices.customer_id
      and c.auth_user_id = auth.uid()
  )
);

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'app_settings',
    'categories',
    'markets',
    'products',
    'product_variants',
    'factories',
    'customers',
    'buyer_accounts',
    'stock_in_invoices',
    'stock_in_items',
    'buyer_orders',
    'buyer_order_items',
    'sales',
    'sale_items',
    'payments',
    'customer_prices'
  ]
  loop
    if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
       and not exists (
         select 1
         from pg_publication_tables
         where pubname = 'supabase_realtime'
           and schemaname = 'public'
           and tablename = table_name
       ) then
      execute format('alter publication supabase_realtime add table public.%I', table_name);
    end if;
  end loop;
end $$;
