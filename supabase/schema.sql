create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('investor', 'startup')),
  full_name text not null check (length(trim(full_name)) between 2 and 120),
  city text,
  created_at timestamptz not null default now()
);

create table if not exists public.investor_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  sectors text[] not null default '{}'
    check (sectors <@ array['Healthtech', 'Climate tech', 'Fintech', 'SaaS', 'Inteligencia artificial']::text[]),
  stages text[] not null default '{}'
    check (stages <@ array['Pre-seed', 'Seed', 'Serie A']::text[]),
  min_ticket_usd bigint not null default 25000 check (min_ticket_usd > 0),
  max_ticket_usd bigint not null default 250000 check (max_ticket_usd >= min_ticket_usd),
  investor_type text not null default 'Angel' check (investor_type in ('Angel', 'VC', 'Corporate')),
  markets text[] not null default array['Chile']::text[] check (markets <@ array['Chile']::text[]),
  preferred_models text[] not null default array['B2B', 'B2B2C', 'B2C']::text[]
    check (preferred_models <@ array['B2B', 'B2B2C', 'B2C']::text[]),
  sector_expertise text[] not null default '{}'
    check (sector_expertise <@ array['Healthtech', 'Climate tech', 'Fintech', 'SaaS', 'Inteligencia artificial']::text[]),
  updated_at timestamptz not null default now()
);

create table if not exists public.startup_profiles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references public.profiles(id) on delete cascade,
  name text not null check (length(trim(name)) between 2 and 120),
  city text not null check (length(trim(city)) between 2 and 100),
  country text not null default 'Chile' check (country = 'Chile'),
  sector text not null check (sector in ('Healthtech', 'Climate tech', 'Fintech', 'SaaS', 'Inteligencia artificial')),
  description text not null check (length(trim(description)) between 20 and 1000),
  stage text not null check (stage in ('Pre-seed', 'Seed', 'Serie A')),
  target_amount_usd bigint not null check (target_amount_usd >= 1000),
  preferred_check_min_usd bigint not null check (preferred_check_min_usd > 0),
  preferred_check_max_usd bigint not null check (preferred_check_max_usd >= preferred_check_min_usd),
  business_model text not null check (business_model in ('B2B', 'B2B2C', 'B2C')),
  traction_score numeric(3,2) not null default 0 check (traction_score between 0 and 1),
  desired_investor_types text[] not null default array['Angel', 'VC']::text[]
    check (desired_investor_types <@ array['Angel', 'VC', 'Corporate']::text[]),
  desired_stages text[] not null default array['Pre-seed', 'Seed']::text[]
    check (desired_stages <@ array['Pre-seed', 'Seed', 'Serie A']::text[]),
  is_fundraising boolean not null default false,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.startup_updates (
  id uuid primary key default gen_random_uuid(),
  startup_id uuid not null references public.startup_profiles(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  content text not null check (length(trim(content)) between 1 and 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.startup_updates
  add column if not exists updated_at timestamptz not null default now();

create table if not exists public.interests (
  id uuid primary key default gen_random_uuid(),
  investor_id uuid not null references public.profiles(id) on delete cascade,
  startup_id uuid not null references public.startup_profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'matched', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (investor_id, startup_id)
);

create index if not exists startup_profiles_discovery_idx
  on public.startup_profiles (is_published, sector, stage, created_at desc);
create index if not exists startup_updates_feed_idx
  on public.startup_updates (created_at desc);
create index if not exists interests_startup_idx
  on public.interests (startup_id, status, created_at desc);
create index if not exists interests_investor_idx
  on public.interests (investor_id, status, created_at desc);

create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  chosen_role text;
  chosen_name text;
begin
  chosen_role := case
    when new.raw_user_meta_data ->> 'role' in ('investor', 'startup')
      then new.raw_user_meta_data ->> 'role'
    else 'investor'
  end;
  chosen_name := coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), 'Nuevo usuario');

  insert into public.profiles (id, role, full_name)
  values (new.id, chosen_role, chosen_name);

  if chosen_role = 'investor' then
    insert into public.investor_preferences (user_id, sectors, stages, sector_expertise)
    values (
      new.id,
      array['Healthtech', 'Climate tech', 'Inteligencia artificial']::text[],
      array['Pre-seed', 'Seed']::text[],
      array['Healthtech', 'Climate tech', 'Inteligencia artificial']::text[]
    );
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.create_profile_for_new_user();

insert into public.profiles (id, role, full_name)
select
  u.id,
  case when u.raw_user_meta_data ->> 'role' in ('investor', 'startup')
    then u.raw_user_meta_data ->> 'role' else 'investor' end,
  coalesce(nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''), 'Nuevo usuario')
from auth.users u
on conflict (id) do nothing;

insert into public.investor_preferences (user_id, sectors, stages, sector_expertise)
select
  p.id,
  array['Healthtech', 'Climate tech', 'Inteligencia artificial']::text[],
  array['Pre-seed', 'Seed']::text[],
  array['Healthtech', 'Climate tech', 'Inteligencia artificial']::text[]
from public.profiles p
where p.role = 'investor'
on conflict (user_id) do nothing;

grant usage on schema public to authenticated;
revoke all on public.profiles, public.investor_preferences, public.startup_profiles,
  public.startup_updates, public.interests from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (full_name, city) on public.profiles to authenticated;
grant select on public.investor_preferences to authenticated;
grant update (sectors, stages, min_ticket_usd, max_ticket_usd, investor_type, markets, preferred_models, sector_expertise, updated_at)
  on public.investor_preferences to authenticated;
grant select, insert, update, delete on public.startup_profiles to authenticated;
grant select, insert, delete on public.startup_updates to authenticated;
grant update (content, updated_at) on public.startup_updates to authenticated;
grant select, insert on public.interests to authenticated;
grant update (status, updated_at) on public.interests to authenticated;
revoke all on function public.create_profile_for_new_user() from public, anon, authenticated;

alter table public.profiles enable row level security;
alter table public.investor_preferences enable row level security;
alter table public.startup_profiles enable row level security;
alter table public.startup_updates enable row level security;
alter table public.interests enable row level security;

drop policy if exists "Authenticated users can view public profile names" on public.profiles;
create policy "Authenticated users can view public profile names"
  on public.profiles for select to authenticated using (true);
drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

drop policy if exists "Investors can read their own preferences" on public.investor_preferences;
create policy "Investors can read their own preferences"
  on public.investor_preferences for select to authenticated
  using (user_id = (select auth.uid()));
drop policy if exists "Investors can update their own preferences" on public.investor_preferences;
create policy "Investors can update their own preferences"
  on public.investor_preferences for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'investor')
  );

drop policy if exists "Users can discover published Chilean startups" on public.startup_profiles;
create policy "Users can discover published Chilean startups"
  on public.startup_profiles for select to authenticated
  using (is_published or owner_id = (select auth.uid()));
drop policy if exists "Startups can create their own profile" on public.startup_profiles;
create policy "Startups can create their own profile"
  on public.startup_profiles for insert to authenticated
  with check (
    owner_id = (select auth.uid())
    and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'startup')
  );
drop policy if exists "Startups can update their own profile" on public.startup_profiles;
create policy "Startups can update their own profile"
  on public.startup_profiles for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (
    owner_id = (select auth.uid())
    and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'startup')
  );
drop policy if exists "Startups can delete their own profile" on public.startup_profiles;
create policy "Startups can delete their own profile"
  on public.startup_profiles for delete to authenticated
  using (owner_id = (select auth.uid()));

drop policy if exists "Users can read published startup updates" on public.startup_updates;
create policy "Users can read updates from published startups"
  on public.startup_updates for select to authenticated
  using (exists (
    select 1 from public.startup_profiles s
    where s.id = startup_id and (s.is_published or s.owner_id = (select auth.uid()))
  ));
drop policy if exists "Startup owners can publish updates" on public.startup_updates;
create policy "Startup owners can publish updates"
  on public.startup_updates for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and exists (
      select 1 from public.startup_profiles s
      where s.id = startup_id and s.owner_id = (select auth.uid())
    )
  );
drop policy if exists "Startup owners can edit their own updates" on public.startup_updates;
create policy "Startup owners can edit their own updates"
  on public.startup_updates for update to authenticated
  using (author_id = (select auth.uid()))
  with check (
    author_id = (select auth.uid())
    and exists (
      select 1 from public.startup_profiles s
      where s.id = startup_id and s.owner_id = (select auth.uid())
    )
  );
drop policy if exists "Startup owners can delete their own updates" on public.startup_updates;
create policy "Startup owners can delete their own updates"
  on public.startup_updates for delete to authenticated
  using (author_id = (select auth.uid()));

drop policy if exists "Participants can view their interests" on public.interests;
create policy "Participants can view their interests"
  on public.interests for select to authenticated
  using (
    investor_id = (select auth.uid())
    or exists (
      select 1 from public.startup_profiles s
      where s.id = startup_id and s.owner_id = (select auth.uid())
    )
  );
drop policy if exists "Investors can express interest in published startups" on public.interests;
create policy "Investors can express interest in published startups"
  on public.interests for insert to authenticated
  with check (
    investor_id = (select auth.uid())
    and status = 'pending'
    and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'investor')
    and exists (select 1 from public.startup_profiles s where s.id = startup_id and s.is_published)
  );
drop policy if exists "Startup owners can respond to investor interest" on public.interests;
create policy "Startup owners can respond to investor interest"
  on public.interests for update to authenticated
  using (
    status = 'pending'
    and exists (
      select 1 from public.startup_profiles s
      where s.id = startup_id and s.owner_id = (select auth.uid())
    )
  )
  with check (
    status in ('matched', 'rejected')
    and exists (
      select 1 from public.startup_profiles s
      where s.id = startup_id and s.owner_id = (select auth.uid())
    )
  );
