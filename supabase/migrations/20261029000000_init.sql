-- Velavan Transport telematics: owner + driver accounts, vehicles, assignments.
--
-- Roles
--   owner  : any account created from the Supabase dashboard (Authentication > Add user).
--   driver : accounts the owner creates in the app. They sign in with phone + password;
--            under the hood their login email is <phone>@drivers.velavan.app.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null check (role in ('owner', 'driver')),
  name text,
  phone text unique,
  owner_id uuid references public.profiles (id) on delete cascade, -- drivers only
  vehicle_id uuid,                                                  -- drivers only: assigned vehicle
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  onelap_device_id bigint not null,
  reg_no text not null,
  name text,
  created_at timestamptz not null default now(),
  unique (owner_id, onelap_device_id)
);

alter table public.profiles
  add constraint profiles_vehicle_fk foreign key (vehicle_id) references public.vehicles (id) on delete set null;

-- New auth users become owners unless they use the driver email domain
-- (driver profiles are written by the "drivers" edge function).
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.email not like '%@drivers.velavan.app' then
    insert into public.profiles (id, role, name)
    values (new.id, 'owner', coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)))
    on conflict (id) do nothing;
  end if;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Owners that existed before this migration
insert into public.profiles (id, role, name)
select id, 'owner', split_part(email, '@', 1) from auth.users
where email not like '%@drivers.velavan.app'
on conflict (id) do nothing;

-- Helpers used by policies (security definer avoids recursive RLS on profiles)
create function public.my_role() returns text
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid() and active
$$;

create function public.my_vehicle_id() returns uuid
language sql stable security definer set search_path = public as $$
  select vehicle_id from public.profiles where id = auth.uid() and active
$$;

-- Row Level Security --------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.vehicles enable row level security;

-- Everyone reads their own profile; owners read their drivers.
create policy "read own profile" on public.profiles for select to authenticated
  using (id = auth.uid() or owner_id = auth.uid());

-- Owners manage their vehicles; drivers read only the vehicle assigned to them.
create policy "owner manages vehicles" on public.vehicles for all to authenticated
  using (owner_id = auth.uid() and public.my_role() = 'owner')
  with check (owner_id = auth.uid() and public.my_role() = 'owner');

create policy "driver reads assigned vehicle" on public.vehicles for select to authenticated
  using (id = public.my_vehicle_id());
-- Driver create/update/delete goes only through the "drivers" edge function (service role).

-- Per-day telematics totals, cached by the onelap function for finished days ----
create table public.daily_stats (
  device_id bigint not null,
  day date not null,          -- calendar day in Asia/Kolkata
  km double precision not null default 0,
  moving_s integer not null default 0,
  idle_s integer not null default 0,
  stopped_s integer not null default 0,
  max_speed double precision not null default 0, -- km/h
  points integer not null default 0,
  computed_at timestamptz not null default now(),
  primary key (device_id, day)
);
alter table public.daily_stats enable row level security;
-- No policies: only the edge function (service role) reads and writes this table.
