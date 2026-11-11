-- Datos de prueba de Venturea. SOLO para un proyecto Supabase de pruebas (nunca el real).
-- Orden: 1) migraciones  2) npm run reset (crea las 30 cuentas @venturea.test)  3) este archivo en el SQL Editor.
-- Cubre: 15 startups en 15 sectores (5 rondas abiertas, 2 pausadas, 1 cerrada), 8 inversionistas, 6 empresas,
-- 1 administrador, 60 publicaciones en 7 categorías, 80 seguimientos, 20 intereses y los 7 estados de pago.
begin;

do $$ begin
  if exists (select 1 from public.startup_profiles s join auth.users u on u.id = s.owner_id where u.email like '%@venturea.test') then
    raise exception 'Los datos de prueba ya están cargados. Ejecuta primero "npm run reset" para recrear las cuentas.';
  end if;
  if (select count(*) from auth.users where email like '%@venturea.test') <> 30 then
    raise exception 'Faltan cuentas de prueba. Ejecuta "npm run reset" antes de este archivo.';
  end if;
end $$;

-- Administrador (la API de Auth no permite asignar este rol desde el registro).
update public.profiles set role = 'admin' where id = (select id from auth.users where email = 'a01@venturea.test');
delete from public.investor_preferences where user_id = (select id from auth.users where email = 'a01@venturea.test');
delete from public.profile_sectors where profile_id = (select id from auth.users where email = 'a01@venturea.test');
delete from public.subscriptions where user_id = (select id from auth.users where email = 'a01@venturea.test');

-- Startups ------------------------------------------------------------------
create temp table seed_startups (email text, name text, city text, sector_id text, stage text, target bigint, tmin bigint, tmax bigint,
  model text, round_status text, description text) on commit drop;
insert into seed_startups values
  ('s01@venturea.test', 'Nébula Health', 'Santiago', 'healthtech', 'Seed', 1200000, 50000, 200000, 'B2B2C', 'open', 'Diagnóstico preventivo con IA que detecta señales tempranas de enfermedades a partir de análisis de sangre de rutina.'),
  ('s02@venturea.test', 'Lumen Terra', 'Valparaíso', 'agrotech', 'Pre-seed', 650000, 25000, 150000, 'B2B', 'open', 'Sensores inteligentes y analítica predictiva para reducir el consumo de agua en operaciones agrícolas.'),
  ('s03@venturea.test', 'Finova', 'Santiago', 'fintech', 'Seed', 2400000, 100000, 250000, 'B2B', 'open', 'Infraestructura de pagos transfronterizos que hace rápidas y transparentes las transferencias de pymes.'),
  ('s04@venturea.test', 'Nodo', 'Concepción', 'saas-b2b', 'Serie A', 5000000, 250000, 1000000, 'B2B', 'open', 'Plataforma de automatización que conecta datos y herramientas de equipos operativos sin código.'),
  ('s05@venturea.test', 'Prisma AI', 'Santiago', 'inteligencia-artificial', 'Seed', 900000, 50000, 200000, 'B2B', 'open', 'Modelos de IA que ayudan a equipos de atención al cliente a resolver consultas complejas con contexto.'),
  ('s06@venturea.test', 'Raíz Foods', 'Temuco', 'foodtech', 'Pre-seed', 400000, 20000, 100000, 'B2C', 'paused', 'Ingredientes funcionales de origen vegetal para alimentos más nutritivos y cadenas regenerativas.'),
  ('s07@venturea.test', 'Solaris', 'Antofagasta', 'energia', 'Serie A', 4000000, 200000, 800000, 'B2B', 'paused', 'Energía solar como servicio para comercios y pequeñas industrias del norte de Chile.'),
  ('s08@venturea.test', 'BioLoop', 'Santiago', 'economia-circular', 'Pre-seed', 500000, 25000, 120000, 'B2B', 'closed', 'Transformamos residuos orgánicos en bioplásticos compostables para empaques.'),
  ('s09@venturea.test', 'Kipu Edu', 'Santiago', 'edtech', 'Seed', 700000, 30000, 150000, 'B2C', 'draft', 'Plataforma de tutorías con IA para estudiantes de enseñanza media en regiones.'),
  ('s10@venturea.test', 'Ruta Sur', 'Puerto Montt', 'logistica', 'Seed', 800000, 40000, 180000, 'B2B', null, 'Optimización de rutas y última milla para pymes de la zona austral.'),
  ('s11@venturea.test', 'Cobre Digital', 'Antofagasta', 'mining-tech', 'Seed', 1500000, 75000, 300000, 'B2B', null, 'Gemelos digitales para mantención predictiva de equipos en faenas mineras.'),
  ('s12@venturea.test', 'Casa Plena', 'Viña del Mar', 'proptech', 'Pre-seed', 350000, 20000, 90000, 'B2C', null, 'Marketplace de arriendos con verificación digital de contratos y garantías.'),
  ('s13@venturea.test', 'Salmo IoT', 'Puerto Montt', 'aquatech', 'Seed', 950000, 50000, 200000, 'B2B', null, 'Sensores y analítica para monitorear la salud de peces en centros de cultivo.'),
  ('s14@venturea.test', 'Escudo Andino', 'Santiago', 'ciberseguridad', 'Serie A', 3500000, 150000, 700000, 'B2B', null, 'Detección de amenazas gestionada para pymes que no tienen equipo de seguridad propio.'),
  ('s15@venturea.test', 'Mercado Vivo', 'Santiago', 'retail-ecommerce', 'Pre-seed', 450000, 25000, 110000, 'B2B2C', null, 'Herramientas de venta en vivo para ferias y comercios de barrio que quieren vender en línea.');

insert into public.startup_profiles (owner_id, name, city, sector_id, description, stage, target_amount_usd, preferred_check_min_usd,
  preferred_check_max_usd, business_model, traction_score, desired_investor_types, desired_stages, pitch_video_url)
select u.id, s.name, s.city, s.sector_id, s.description, s.stage, s.target, s.tmin, s.tmax, s.model,
  round(((row_number() over (order by s.email) * 7) % 10) / 10.0, 2),
  case when s.stage = 'Serie A' then array['VC', 'Corporate'] else array['Angel', 'VC'] end,
  case s.stage when 'Pre-seed' then array['Pre-seed', 'Seed'] when 'Seed' then array['Seed', 'Serie A'] else array['Seed', 'Serie A'] end,
  case when s.email in ('s01@venturea.test', 's03@venturea.test') then 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' end
from seed_startups s join auth.users u on u.email = s.email;

insert into public.funding_rounds (startup_id, status, stage, target_usd, ticket_min_usd, ticket_max_usd, committed_pct, opens_at, closes_at)
select sp.id, s.round_status, s.stage, s.target, s.tmin, s.tmax,
  case s.round_status when 'closed' then 100 else (row_number() over (order by s.email) * 9) % 70 end,
  now() - interval '20 days',
  case when s.round_status = 'open' then now() + interval '60 days' end
from seed_startups s join auth.users u on u.email = s.email join public.startup_profiles sp on sp.owner_id = u.id
where s.round_status is not null;

-- Inversionistas -------------------------------------------------------------
create temp table seed_investors (email text, itype text, stages text[], tmin bigint, tmax bigint, interests text[], expertise text[]) on commit drop;
insert into seed_investors values
  ('i01@venturea.test', 'Angel', array['Pre-seed', 'Seed'], 25000, 250000, array['healthtech', 'climate-tech', 'inteligencia-artificial'], array['healthtech']),
  ('i02@venturea.test', 'VC', array['Seed', 'Serie A'], 100000, 1000000, array['fintech', 'saas-b2b', 'ciberseguridad'], array['fintech', 'saas-b2b']),
  ('i03@venturea.test', 'VC', array['Seed'], 100000, 500000, array['agrotech', 'foodtech', 'aquatech', 'climate-tech'], array['agrotech']),
  ('i04@venturea.test', 'Angel', array['Pre-seed'], 10000, 100000, array['edtech', 'proptech', 'retail-ecommerce'], array['edtech']),
  ('i05@venturea.test', 'Angel', array['Pre-seed', 'Seed'], 25000, 150000, array['healthtech', 'biotech', 'medtech'], array['biotech']),
  ('i06@venturea.test', 'VC', array['Seed', 'Serie A'], 200000, 1500000, array['energia', 'mining-tech', 'industria-4-0'], array['energia', 'mining-tech']),
  ('i07@venturea.test', 'Corporate', array['Seed', 'Serie A'], 150000, 1000000, array['logistica', 'inteligencia-artificial', 'ciberseguridad'], array['logistica']),
  ('i08@venturea.test', 'VC', array['Pre-seed', 'Seed'], 50000, 400000, array['inteligencia-artificial', 'saas-b2b', 'deeptech', 'healthtech'], array['deeptech']);

update public.investor_preferences p
  set investor_type = i.itype, stages = i.stages, min_ticket_usd = i.tmin, max_ticket_usd = i.tmax
  from seed_investors i join auth.users u on u.email = i.email where p.user_id = u.id;
delete from public.profile_sectors where profile_id in (select u.id from seed_investors i join auth.users u on u.email = i.email);
insert into public.profile_sectors (profile_id, sector_id, kind)
select u.id, sector, 'interest' from seed_investors i join auth.users u on u.email = i.email, unnest(i.interests) sector;
insert into public.profile_sectors (profile_id, sector_id, kind)
select u.id, sector, 'expertise' from seed_investors i join auth.users u on u.email = i.email, unnest(i.expertise) sector;

-- Empresas -------------------------------------------------------------------
create temp table seed_companies (email text, name text, sector_id text, size text, city text, collab text[], description text, challenge text) on commit drop;
insert into seed_companies values
  ('c01@venturea.test', 'Minera Austral', 'mining-tech', '1000+', 'Antofagasta', array['piloto', 'co-desarrollo'], 'Operación minera de cobre que busca digitalizar mantención y seguridad en faena.', 'Reducir detenciones no planificadas de camiones'),
  ('c02@venturea.test', 'Banco Meridian', 'fintech', '1000+', 'Santiago', array['piloto', 'inversion-corporativa'], 'Banco con foco en pymes que explora alianzas con fintech de pagos e identidad.', 'Onboarding digital de pymes en menos de 10 minutos'),
  ('c03@venturea.test', 'AgroNorte', 'agrotech', '201-1000', 'La Serena', array['proveedor', 'piloto'], 'Exportadora frutícola que busca tecnología de riego y trazabilidad.', 'Medir consumo de agua por cuartel en tiempo real'),
  ('c04@venturea.test', 'Retail Cordillera', 'retail-ecommerce', '1000+', 'Santiago', array['proveedor', 'adquisicion'], 'Cadena de tiendas por departamento con programa de innovación abierta.', 'Mejorar la conversión de la tienda en línea'),
  ('c05@venturea.test', 'Energía del Sur', 'energia', '51-200', 'Concepción', array['co-desarrollo', 'inversion-corporativa'], 'Distribuidora eléctrica regional interesada en redes inteligentes y almacenamiento.', 'Predecir demanda por alimentador'),
  ('c06@venturea.test', 'Clínica Alameda', 'healthtech', '201-1000', 'Santiago', array['piloto'], 'Red de clínicas privadas que pilotea soluciones de diagnóstico y gestión de pacientes.', 'Reducir tiempos de espera en urgencias');

insert into public.company_profiles (owner_id, name, sector_id, size, city, website, description, collaboration_types, challenges)
select u.id, c.name, c.sector_id, c.size, c.city, 'https://www.' || lower(replace(c.name, ' ', '')) || '.cl', c.description, c.collab, c.challenge
from seed_companies c join auth.users u on u.email = c.email;
insert into public.company_challenges (company_id, title, description)
select cp.id, c.challenge, 'Buscamos startups chilenas con una solución probada para: ' || lower(c.challenge) || '.'
from seed_companies c join auth.users u on u.email = c.email join public.company_profiles cp on cp.owner_id = u.id;
insert into public.profile_sectors (profile_id, sector_id, kind)
select u.id, c.sector_id, 'interest' from seed_companies c join auth.users u on u.email = c.email;

-- Publicaciones: 60, repartidas entre las 15 startups y las 7 categorías ---------------
with s as (select sp.id, sp.owner_id, sp.name, row_number() over (order by sp.name) rn
           from public.startup_profiles sp join auth.users u on u.id = sp.owner_id where u.email like '%@venturea.test'),
     c as (select id, name, row_number() over (order by sort_order) rn from public.post_categories)
insert into public.posts (startup_id, author_id, content, category, created_at)
select s.id, s.owner_id,
  s.name || ' · ' || c.name || ': ' || (array[
    'Cerramos un piloto con tres clientes y superamos la meta de usuarios activos.',
    'Abrimos conversaciones con inversionistas para una ronda de crecimiento.',
    'Lanzamos una nueva versión del producto con mejoras pedidas por clientes.',
    'Sumamos dos ingenieras y un líder comercial al equipo.',
    'Salimos en medios nacionales contando cómo resolvemos el problema.',
    'Estaremos presentando en el próximo encuentro de innovación en Santiago.',
    'Buscamos una empresa para pilotear nuestra solución durante 8 semanas.'
  ])[c.rn::int],
  c.id, now() - (n * interval '7 hours')
from generate_series(0, 59) n join s on s.rn = (n % 15) + 1 join c on c.rn = (n % 7) + 1;

-- Seguimientos: 80, de inversionistas y empresas hacia startups -----------------------
insert into public.follows (follower_id, startup_id, created_at)
select f.id, sp.id, now() - (row_number() over () * interval '3 hours')
from (select p.id from public.profiles p join auth.users u on u.id = p.id
      where u.email like '%@venturea.test' and p.role in ('investor', 'company')) f
cross join (select id from public.startup_profiles) sp
order by md5(f.id::text || sp.id::text)
limit 80;

-- Intereses: 20 (pendientes, match y rechazados) -------------------------------------
insert into public.interests (investor_id, startup_id, status, created_at)
select t.investor_id, t.startup_id, (array['pending', 'matched', 'rejected'])[(t.rn % 3) + 1], now() - (t.rn * interval '5 hours')
from (select f.id investor_id, sp.id startup_id, row_number() over (order by md5(f.id::text || sp.id::text || 'i')) rn
      from (select p.id from public.profiles p join auth.users u on u.id = p.id
            where u.email like '%@venturea.test' and p.role in ('investor', 'company')) f
      cross join (select id from public.startup_profiles) sp) t
where t.rn <= 20;

-- Estados de pago ------------------------------------------------------------------
create temp table seed_billing (email text, plan_id text, status text, trial_ends timestamptz, period_end timestamptz) on commit drop;
insert into seed_billing values
  ('i01@venturea.test', 'investor_free', 'free', null, null),
  ('i02@venturea.test', 'investor_pro', 'active', null, now() + interval '20 days'),
  ('i03@venturea.test', 'investor_pro', 'trialing', now() + interval '9 days', now() + interval '9 days'),
  ('i04@venturea.test', 'investor_pro', 'past_due', null, now() - interval '2 days'),   -- dentro de los 5 días de gracia
  ('i05@venturea.test', 'investor_pro', 'past_due', null, now() - interval '9 days'),   -- gracia vencida
  ('i06@venturea.test', 'investor_pro', 'canceled', null, now() + interval '12 days'),  -- Pro hasta fin de periodo
  ('i07@venturea.test', 'investor_pro', 'expired', null, now() - interval '30 days'),
  ('s01@venturea.test', 'startup_pro', 'active', null, now() + interval '25 days'),
  ('s02@venturea.test', 'startup_pro', 'trialing', now() + interval '5 days', now() + interval '5 days'),
  ('c01@venturea.test', 'company_pro', 'active', null, now() + interval '18 days'),
  ('c02@venturea.test', 'company_pro', 'canceled', null, now() + interval '6 days');
update public.subscriptions s
  set plan_id = b.plan_id, status = b.status, trial_ends_at = b.trial_ends, current_period_end = b.period_end,
      provider = case when b.status = 'free' then null else 'manual' end, updated_at = now()
  from seed_billing b join auth.users u on u.email = b.email where s.user_id = u.id;

commit;
