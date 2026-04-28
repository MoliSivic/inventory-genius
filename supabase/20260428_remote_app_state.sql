-- Development realtime backend for Inventory Genius.
-- Run this once in Supabase Dashboard > SQL Editor for project mesrjiuytjasaaidptaa.
--
-- This matches the current frontend sync strategy: one shared JSON AppState row
-- so the seller and customer web apps can share data immediately during development.
-- Later, replace this with normalized production tables and stricter RLS.

do $$
begin
  create type public.app_role as enum ('customer', 'admin');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  role public.app_role not null default 'customer',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_user_profiles_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_user_profiles_updated_at on public.user_profiles;

create trigger set_user_profiles_updated_at
before update on public.user_profiles
for each row
execute function public.set_user_profiles_updated_at();

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
for each row
execute function public.create_profile_for_auth_user();

insert into public.user_profiles (user_id, email, full_name, role)
select
  id,
  coalesce(email, ''),
  coalesce(raw_user_meta_data ->> 'full_name', raw_user_meta_data ->> 'name'),
  'customer'
from auth.users
on conflict (user_id) do nothing;

alter table public.user_profiles enable row level security;

grant usage on schema public to authenticated;
grant usage on type public.app_role to authenticated;
grant select on public.user_profiles to authenticated;

drop policy if exists "users read own profile" on public.user_profiles;

create policy "users read own profile"
on public.user_profiles
for select
to authenticated
using (auth.uid() = user_id);

create table if not exists public.inventory_app_state (
  id text primary key,
  state jsonb not null,
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'inventory_app_state_state_is_object'
      and conrelid = 'public.inventory_app_state'::regclass
  ) then
    alter table public.inventory_app_state
      add constraint inventory_app_state_state_is_object
      check (jsonb_typeof(state) = 'object');
  end if;
end $$;

create or replace function public.set_inventory_app_state_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_inventory_app_state_updated_at on public.inventory_app_state;

create trigger set_inventory_app_state_updated_at
before update on public.inventory_app_state
for each row
execute function public.set_inventory_app_state_updated_at();

alter table public.inventory_app_state replica identity full;
alter table public.inventory_app_state enable row level security;

grant usage on schema public to anon, authenticated;
grant select, insert, update on public.inventory_app_state to anon, authenticated;

drop policy if exists "dev read shared app state" on public.inventory_app_state;
drop policy if exists "dev insert shared app state" on public.inventory_app_state;
drop policy if exists "dev update shared app state" on public.inventory_app_state;

create policy "dev read shared app state"
on public.inventory_app_state
for select
to anon, authenticated
using (true);

create policy "dev insert shared app state"
on public.inventory_app_state
for insert
to anon, authenticated
with check (id = 'default' and jsonb_typeof(state) = 'object');

create policy "dev update shared app state"
on public.inventory_app_state
for update
to anon, authenticated
using (id = 'default')
with check (id = 'default' and jsonb_typeof(state) = 'object');

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1
       from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'inventory_app_state'
     ) then
    alter publication supabase_realtime add table public.inventory_app_state;
  end if;
end $$;

-- Do not insert an empty row here. The frontend writes the full seed AppState
-- automatically the first time it connects if the default row does not exist.
