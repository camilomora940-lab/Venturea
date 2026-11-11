-- Fase 1: modelo de datos v2. Ejecutar después de 001 y 002. Conserva los datos existentes.
-- Cambios: catálogo de sectores, rol empresa, medios (foto/banner/video), rondas, categorías de publicación,
-- seguidores, notificaciones y las tablas de planes (la lógica de pagos llega en 006_freemium.sql).
-- Va dentro de una transacción: si algo falla, no queda nada a medias y se puede volver a ejecutar.
begin;

-- ---------------------------------------------------------------------------
-- 1. Catálogo de sectores (reemplaza los CHECK fijos)
-- ---------------------------------------------------------------------------
create table if not exists public.sectors (
  id text primary key check (id ~ '^[a-z0-9-]+$'),
  name text not null unique,
  group_name text not null,
  is_active boolean not null default true,
  sort_order int not null default 0
);

insert into public.sectors (id, name, group_name, sort_order) values
  ('healthtech', 'Healthtech', 'Salud', 10),
  ('biotech', 'Biotech', 'Salud', 11),
  ('medtech', 'Medtech', 'Salud', 12),
  ('fintech', 'Fintech', 'Finanzas', 20),
  ('insurtech', 'Insurtech', 'Finanzas', 21),
  ('climate-tech', 'Climate tech', 'Clima y recursos', 30),
  ('energia', 'Energía', 'Clima y recursos', 31),
  ('economia-circular', 'Economía circular', 'Clima y recursos', 32),
  ('agrotech', 'Agrotech', 'Clima y recursos', 33),
  ('foodtech', 'Foodtech', 'Clima y recursos', 34),
  ('aquatech', 'Aquatech/acuicultura', 'Clima y recursos', 35),
  ('forestal', 'Forestal', 'Clima y recursos', 36),
  ('mining-tech', 'Mining tech', 'Clima y recursos', 37),
  ('proptech', 'Proptech', 'Ciudades e industria', 40),
  ('construtech', 'Construtech', 'Ciudades e industria', 41),
  ('logistica', 'Logística', 'Ciudades e industria', 42),
  ('movilidad', 'Movilidad', 'Ciudades e industria', 43),
  ('industria-4-0', 'Industria 4.0', 'Ciudades e industria', 44),
  ('hardware-iot', 'Hardware/IoT', 'Ciudades e industria', 45),
  ('edtech', 'Edtech', 'Personas', 50),
  ('hr-tech', 'HR tech', 'Personas', 51),
  ('legaltech', 'Legaltech', 'Personas', 52),
  ('govtech', 'Govtech', 'Personas', 53),
  ('impacto-social', 'Impacto social', 'Personas', 54),
  ('retail-ecommerce', 'Retail tech/E-commerce', 'Comercio y medios', 60),
  ('martech', 'Martech', 'Comercio y medios', 61),
  ('traveltech', 'Traveltech', 'Comercio y medios', 62),
  ('gaming', 'Gaming y entretenimiento', 'Comercio y medios', 63),
  ('inteligencia-artificial', 'Inteligencia artificial', 'Tecnología base', 70),
  ('saas-b2b', 'SaaS B2B', 'Tecnología base', 71),
  ('ciberseguridad', 'Ciberseguridad', 'Tecnología base', 72),
  ('deeptech', 'Deeptech', 'Tecnología base', 73)
on conflict (id) do nothing;

-- Nombres antiguos -> ids del catálogo.
create temp table sector_map (old text primary key, new text not null) on commit drop;
insert into sector_map values
  ('Healthtech', 'healthtech'), ('Climate tech', 'climate-tech'), ('Fintech', 'fintech'),
  ('SaaS', 'saas-b2b'), ('Inteligencia artificial', 'inteligencia-artificial');

-- ---------------------------------------------------------------------------
-- 2. Perfiles: rol empresa/admin y medios del usuario
-- ---------------------------------------------------------------------------
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('investor', 'startup', 'company', 'admin'));
alter table public.profiles
  add column if not exists avatar_url text check (avatar_url is null or avatar_url ~ '^https://'),
  add column if not exists banner_url text check (banner_url is null or banner_url ~ '^https://'),
  add column if not exists headline text check (headline is null or length(headline) <= 160),
  add column if not exists bio text check (bio is null or length(bio) <= 1000);

-- ---------------------------------------------------------------------------
-- 3. Sectores de interés y experiencia (inversores y empresas) en profile_sectors
-- ---------------------------------------------------------------------------
create table if not exists public.profile_sectors (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  sector_id text not null references public.sectors(id),
  kind text not null check (kind in ('interest', 'expertise')),
  primary key (profile_id, sector_id, kind)
);

insert into public.profile_sectors (profile_id, sector_id, kind)
select p.user_id, m.new, 'interest'
from public.investor_preferences p, unnest(p.sectors) s(name) join sector_map m on m.old = s.name
on conflict do nothing;
insert into public.profile_sectors (profile_id, sector_id, kind)
select p.user_id, m.new, 'expertise'
from public.investor_preferences p, unnest(p.sector_expertise) s(name) join sector_map m on m.old = s.name
on conflict do nothing;

alter table public.investor_preferences drop column sectors, drop column sector_expertise;

-- ---------------------------------------------------------------------------
-- 4. Startups: sector desde el catálogo y medios
-- ---------------------------------------------------------------------------
alter table public.startup_profiles drop constraint if exists startup_profiles_sector_check;
update public.startup_profiles s set sector = m.new from sector_map m where s.sector = m.old;
alter table public.startup_profiles rename column sector to sector_id;
alter table public.startup_profiles add constraint startup_profiles_sector_fk
  foreign key (sector_id) references public.sectors(id);
alter table public.startup_profiles
  add column if not exists logo_url text check (logo_url is null or logo_url ~ '^https://'),
  add column if not exists banner_url text check (banner_url is null or banner_url ~ '^https://'),
  add column if not exists pitch_video_url text check (
    pitch_video_url is null or (length(pitch_video_url) <= 300
      and pitch_video_url ~* '^https://(www\.|m\.)?(youtube\.com|youtu\.be|vimeo\.com|loom\.com)/')
  );

-- ---------------------------------------------------------------------------
-- 5. Perfil de empresa y sus desafíos
-- ---------------------------------------------------------------------------
create table if not exists public.company_profiles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references public.profiles(id) on delete cascade,
  name text not null check (length(trim(name)) between 2 and 120),
  sector_id text not null references public.sectors(id),
  size text not null check (size in ('1-10', '11-50', '51-200', '201-1000', '1000+')),
  city text not null check (length(trim(city)) between 2 and 100),
  website text check (website is null or website ~* '^https?://'),
  description text not null check (length(trim(description)) between 20 and 1000),
  collaboration_types text[] not null default '{}'
    check (collaboration_types <@ array['piloto', 'proveedor', 'co-desarrollo', 'inversion-corporativa', 'adquisicion']::text[]),
  challenges text check (challenges is null or length(challenges) <= 1000),
  logo_url text check (logo_url is null or logo_url ~ '^https://'),
  banner_url text check (banner_url is null or banner_url ~ '^https://'),
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- "Mis desafíos": varios por empresa (el plan Free permite 1; ver 006_freemium.sql).
create table if not exists public.company_challenges (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.company_profiles(id) on delete cascade,
  title text not null check (length(trim(title)) between 3 and 120),
  description text not null check (length(trim(description)) between 10 and 1000),
  status text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 6. Rondas de financiamiento
-- ---------------------------------------------------------------------------
create table if not exists public.funding_rounds (
  id uuid primary key default gen_random_uuid(),
  startup_id uuid not null references public.startup_profiles(id) on delete cascade,
  status text not null default 'draft' check (status in ('draft', 'open', 'paused', 'closed')),
  stage text not null check (stage in ('Pre-seed', 'Seed', 'Serie A')),
  target_usd bigint not null check (target_usd >= 1000),
  ticket_min_usd bigint not null check (ticket_min_usd > 0),
  ticket_max_usd bigint not null check (ticket_max_usd >= ticket_min_usd),
  committed_pct int not null default 0 check (committed_pct between 0 and 100),
  opens_at timestamptz,
  closes_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists funding_rounds_one_open_idx on public.funding_rounds (startup_id) where status = 'open';
create index if not exists funding_rounds_startup_idx on public.funding_rounds (startup_id, created_at desc);

-- Las rondas abiertas que ya existían (is_fundraising = true) pasan a ser filas de funding_rounds.
insert into public.funding_rounds (startup_id, status, stage, target_usd, ticket_min_usd, ticket_max_usd, opens_at)
select id, 'open', stage, target_amount_usd, preferred_check_min_usd, preferred_check_max_usd, now()
from public.startup_profiles where is_fundraising;

-- is_fundraising pasa a ser un reflejo de "existe una ronda abierta"; solo lo escribe este trigger.
create or replace function public.sync_is_fundraising()
returns trigger language plpgsql security definer set search_path = '' as $$
declare sid uuid := coalesce(new.startup_id, old.startup_id);
begin
  update public.startup_profiles
    set is_fundraising = exists (select 1 from public.funding_rounds r where r.startup_id = sid and r.status = 'open')
    where id = sid;
  return null;
end;
$$;
drop trigger if exists funding_rounds_sync on public.funding_rounds;
create trigger funding_rounds_sync after insert or update or delete on public.funding_rounds
  for each row execute function public.sync_is_fundraising();
revoke all on function public.sync_is_fundraising() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 7. Publicaciones con categoría (startup_updates -> posts)
-- ---------------------------------------------------------------------------
create table if not exists public.post_categories (
  id text primary key check (id ~ '^[a-z0-9-]+$'),
  name text not null unique,
  sort_order int not null default 0
);
insert into public.post_categories (id, name, sort_order) values
  ('hito', 'Hito', 1), ('financiamiento', 'Financiamiento', 2), ('producto', 'Producto', 3),
  ('equipo', 'Equipo y talento', 4), ('prensa', 'Prensa', 5), ('evento', 'Evento', 6),
  ('alianza', 'Busco alianza/piloto', 7)
on conflict (id) do nothing;

alter table public.startup_updates rename to posts;
alter table public.posts add column if not exists category text not null default 'hito' references public.post_categories(id);
create index if not exists posts_category_idx on public.posts (category, created_at desc);

-- ---------------------------------------------------------------------------
-- 8. Seguidores y notificaciones
-- ---------------------------------------------------------------------------
create table if not exists public.follows (
  id uuid primary key default gen_random_uuid(),
  follower_id uuid not null references public.profiles(id) on delete cascade,
  startup_id uuid not null references public.startup_profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (follower_id, startup_id)
);
create index if not exists follows_startup_idx on public.follows (startup_id);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('follow', 'interest', 'match', 'round_opened', 'billing')),
  actor_id uuid references public.profiles(id) on delete set null,
  entity_id uuid,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 9. Planes y suscripciones (solo lectura desde el navegador; las escribe el servidor)
-- ---------------------------------------------------------------------------
create table if not exists public.plans (
  id text primary key,
  role text not null check (role in ('startup', 'investor', 'company')),
  name text not null,
  is_paid boolean not null default false,
  price_clp int check (price_clp is null or price_clp >= 0), -- null = precio por definir
  limits jsonb not null default '{}'
);
insert into public.plans (id, role, name, is_paid, limits) values
  ('startup_free', 'startup', 'Free', false, '{"open_rounds": 1}'),
  ('startup_pro', 'startup', 'Pro', true, '{"open_rounds": 1}'),
  ('investor_free', 'investor', 'Free', false, '{"interests_per_month": 10}'),
  ('investor_pro', 'investor', 'Pro', true, '{}'),
  ('company_free', 'company', 'Free', false, '{"interests_per_month": 10, "open_challenges": 1}'),
  ('company_pro', 'company', 'Pro', true, '{}')
on conflict (id) do nothing;

create table if not exists public.subscriptions (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  plan_id text not null references public.plans(id),
  status text not null default 'free' check (status in ('free', 'trialing', 'active', 'past_due', 'canceled', 'expired')),
  trial_ends_at timestamptz,
  current_period_end timestamptz,
  provider text,
  provider_ref text,
  updated_at timestamptz not null default now()
);

create table if not exists public.payment_events (
  id text primary key, -- id del evento del proveedor: impide procesar dos veces el mismo pago
  user_id uuid references public.profiles(id) on delete set null,
  type text not null,
  payload jsonb not null default '{}',
  processed_at timestamptz not null default now()
);

insert into public.subscriptions (user_id, plan_id)
select id, role || '_free' from public.profiles where role in ('startup', 'investor', 'company')
on conflict (user_id) do nothing;

-- ---------------------------------------------------------------------------
-- 10. Alta de usuarios: rol empresa, sectores por defecto y suscripción Free
-- ---------------------------------------------------------------------------
create or replace function public.create_profile_for_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  chosen_role text;
  chosen_name text;
begin
  -- 'admin' nunca se acepta desde el registro público.
  chosen_role := case
    when new.raw_user_meta_data ->> 'role' in ('investor', 'startup', 'company') then new.raw_user_meta_data ->> 'role'
    else 'investor'
  end;
  chosen_name := coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), 'Nuevo usuario');

  insert into public.profiles (id, role, full_name) values (new.id, chosen_role, chosen_name);
  insert into public.subscriptions (user_id, plan_id) values (new.id, chosen_role || '_free');

  if chosen_role = 'investor' then
    insert into public.investor_preferences (user_id, stages) values (new.id, array['Pre-seed', 'Seed']::text[]);
    insert into public.profile_sectors (profile_id, sector_id, kind)
    select new.id, s, k from unnest(array['healthtech', 'climate-tech', 'inteligencia-artificial']) s, unnest(array['interest', 'expertise']) k;
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 11. Permisos: updates por columna (nadie edita traction_score, is_fundraising ni planes desde el navegador)
-- ---------------------------------------------------------------------------
revoke all on public.sectors, public.post_categories, public.profile_sectors, public.company_profiles,
  public.company_challenges, public.funding_rounds, public.follows, public.notifications,
  public.plans, public.subscriptions, public.payment_events from anon, authenticated;

grant select on public.sectors, public.post_categories, public.plans to authenticated;
grant select on public.subscriptions to authenticated;
grant select, insert, delete on public.profile_sectors to authenticated;
grant select, delete on public.company_profiles to authenticated;
grant insert (owner_id, name, sector_id, size, city, website, description, collaboration_types, challenges, logo_url, banner_url, is_published)
  on public.company_profiles to authenticated;
grant update (name, sector_id, size, city, website, description, collaboration_types, challenges, logo_url, banner_url, is_published, updated_at)
  on public.company_profiles to authenticated;
grant select, insert, update, delete on public.company_challenges to authenticated;
grant select, delete on public.funding_rounds to authenticated;
grant insert (startup_id, status, stage, target_usd, ticket_min_usd, ticket_max_usd, committed_pct, opens_at, closes_at)
  on public.funding_rounds to authenticated;
grant update (status, stage, target_usd, ticket_min_usd, ticket_max_usd, committed_pct, opens_at, closes_at, updated_at)
  on public.funding_rounds to authenticated;
grant select, insert, delete on public.follows to authenticated;
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;

revoke insert, update on public.startup_profiles from authenticated;
grant insert (owner_id, name, city, country, sector_id, description, stage, target_amount_usd, preferred_check_min_usd,
  preferred_check_max_usd, business_model, desired_investor_types, desired_stages, is_published, logo_url, banner_url, pitch_video_url)
  on public.startup_profiles to authenticated;
grant update (name, city, sector_id, description, stage, target_amount_usd, preferred_check_min_usd, preferred_check_max_usd,
  business_model, desired_investor_types, desired_stages, is_published, logo_url, banner_url, pitch_video_url, updated_at)
  on public.startup_profiles to authenticated;

revoke update on public.profiles from authenticated;
grant update (full_name, city, avatar_url, banner_url, headline, bio) on public.profiles to authenticated;
revoke update on public.investor_preferences from authenticated;
grant update (stages, min_ticket_usd, max_ticket_usd, investor_type, markets, preferred_models, updated_at)
  on public.investor_preferences to authenticated;

-- ---------------------------------------------------------------------------
-- 12. Row Level Security
-- ---------------------------------------------------------------------------
alter table public.sectors enable row level security;
alter table public.post_categories enable row level security;
alter table public.plans enable row level security;
alter table public.profile_sectors enable row level security;
alter table public.company_profiles enable row level security;
alter table public.company_challenges enable row level security;
alter table public.funding_rounds enable row level security;
alter table public.follows enable row level security;
alter table public.notifications enable row level security;
alter table public.subscriptions enable row level security;
alter table public.payment_events enable row level security; -- sin políticas: solo service_role

create policy "Authenticated users can read sectors" on public.sectors for select to authenticated using (true);
create policy "Authenticated users can read post categories" on public.post_categories for select to authenticated using (true);
create policy "Authenticated users can read plans" on public.plans for select to authenticated using (true);

create policy "Users can read their own subscription" on public.subscriptions
  for select to authenticated using (user_id = (select auth.uid()));

create policy "Users manage their own profile sectors" on public.profile_sectors
  for all to authenticated
  using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()));

create policy "Users can discover published companies" on public.company_profiles
  for select to authenticated using (is_published or owner_id = (select auth.uid()));
create policy "Companies can create their own profile" on public.company_profiles
  for insert to authenticated
  with check (owner_id = (select auth.uid())
    and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'company'));
create policy "Companies can update their own profile" on public.company_profiles
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));
create policy "Companies can delete their own profile" on public.company_profiles
  for delete to authenticated using (owner_id = (select auth.uid()));

create policy "Users can read open challenges of published companies" on public.company_challenges
  for select to authenticated using (exists (
    select 1 from public.company_profiles c
    where c.id = company_id and (c.owner_id = (select auth.uid()) or (c.is_published and status = 'open'))));
create policy "Companies manage their own challenges" on public.company_challenges
  for all to authenticated
  using (exists (select 1 from public.company_profiles c where c.id = company_id and c.owner_id = (select auth.uid())))
  with check (exists (select 1 from public.company_profiles c where c.id = company_id and c.owner_id = (select auth.uid())));

create policy "Users can read non-draft rounds of published startups" on public.funding_rounds
  for select to authenticated using (exists (
    select 1 from public.startup_profiles s
    where s.id = startup_id and (s.owner_id = (select auth.uid()) or (s.is_published and status <> 'draft'))));
create policy "Startups manage their own rounds" on public.funding_rounds
  for all to authenticated
  using (exists (select 1 from public.startup_profiles s where s.id = startup_id and s.owner_id = (select auth.uid())))
  with check (exists (select 1 from public.startup_profiles s where s.id = startup_id and s.owner_id = (select auth.uid())));

-- Seguir: solo inversionistas y empresas (las startups no se siguen entre sí; decisión abierta nº 3 del plan).
create policy "Users can read their own follows" on public.follows
  for select to authenticated using (follower_id = (select auth.uid()));
create policy "Investors and companies can follow published startups" on public.follows
  for insert to authenticated
  with check (follower_id = (select auth.uid())
    and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('investor', 'company'))
    and exists (select 1 from public.startup_profiles s where s.id = startup_id and s.is_published));
create policy "Users can unfollow" on public.follows
  for delete to authenticated using (follower_id = (select auth.uid()));

create policy "Users can read their own notifications" on public.notifications
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Users can mark their own notifications as read" on public.notifications
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- "Me interesa" también para empresas (la columna investor_id guarda a quien muestra interés).
drop policy if exists "Investors can express interest in published startups" on public.interests;
create policy "Investors and companies can express interest in published startups"
  on public.interests for insert to authenticated
  with check (
    investor_id = (select auth.uid())
    and status = 'pending'
    and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('investor', 'company'))
    and exists (select 1 from public.startup_profiles s where s.id = startup_id and s.is_published)
  );

-- Las políticas de investor_preferences ya no dependen de las columnas eliminadas; se mantienen tal cual.

-- ---------------------------------------------------------------------------
-- 13. Búsqueda global v2: startups, inversionistas, empresas y publicaciones
-- ---------------------------------------------------------------------------
create or replace function public.search_all(q text)
returns table (kind text, id uuid, title text, subtitle text)
language sql stable security invoker set search_path = '' as $$
  with p as (
    select '%' || replace(replace(replace(trim(q), '\', '\\'), '%', '\%'), '_', '\_') || '%' as pat
    where length(trim(q)) >= 2
  )
  (select 'startup'::text, s.id, s.name, sc.name || ' · ' || s.city
     from public.startup_profiles s join public.sectors sc on sc.id = s.sector_id, p
     where s.is_published and (s.name ilike p.pat or s.description ilike p.pat or sc.name ilike p.pat)
     order by s.name limit 5)
  union all
  (select 'investor'::text, pr.id, pr.full_name, 'Inversionista'::text
     from public.profiles pr, p
     where pr.role = 'investor' and pr.full_name ilike p.pat
     order by pr.full_name limit 5)
  union all
  (select 'company'::text, c.id, c.name, sc.name || ' · ' || c.city
     from public.company_profiles c join public.sectors sc on sc.id = c.sector_id, p
     where c.is_published and (c.name ilike p.pat or c.description ilike p.pat or sc.name ilike p.pat)
     order by c.name limit 5)
  union all
  (select 'post'::text, u.id, left(u.content, 80), s.name
     from public.posts u join public.startup_profiles s on s.id = u.startup_id, p
     where s.is_published and u.content ilike p.pat
     order by u.created_at desc limit 5)
$$;
revoke all on function public.search_all(text) from public, anon;
grant execute on function public.search_all(text) to authenticated;

commit;
