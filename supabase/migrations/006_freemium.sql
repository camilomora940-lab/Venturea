-- Fase 4: freemium. El acceso Pro se calcula SIEMPRE aquí, a partir del estado y las fechas de la suscripción.
-- El navegador solo lee su suscripción (003): nadie puede darse Pro editando datos. Solo escribe el servidor
-- (Edge Function payments-webhook con service_role, o el panel de Supabase mientras no haya pasarela).
begin;

-- ---------------------------------------------------------------------------
-- 1. ¿Tiene Pro ahora mismo? (días de gracia: 5)
--    active: sí (hasta 5 días después de su fin de periodo si el cobro se retrasa sin aviso)
--    trialing: sí, hasta fin de prueba · past_due: sí, 5 días de gracia · canceled: sí, hasta fin de periodo
--    free / expired: no
-- ---------------------------------------------------------------------------
create or replace function public.pro_active(p_user uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((
    select p.is_paid and case s.status
        when 'active' then s.current_period_end is null or now() < s.current_period_end + interval '5 days'
        when 'trialing' then s.trial_ends_at is not null and now() < s.trial_ends_at
        when 'past_due' then s.current_period_end is not null and now() < s.current_period_end + interval '5 days'
        when 'canceled' then s.current_period_end is not null and now() < s.current_period_end
        else false end
    from public.subscriptions s join public.plans p on p.id = s.plan_id
    where s.user_id = p_user), false)
$$;

create or replace function public.role_features(p_role text)
returns text[] language sql immutable as $$
  select case p_role
    when 'startup' then array['follower_list', 'profile_stats', 'featured', 'video_upload', 'pro_badge']
    when 'investor' then array['unlimited_interests', 'advanced_filters', 'round_alerts', 'followers_of_startup']
    when 'company' then array['unlimited_challenges', 'unlimited_interests', 'advanced_search', 'export_lists', 'pro_badge']
    else array[]::text[] end
$$;

-- has_feature('follower_list'): lo usan las políticas RLS, los triggers y la vista my_entitlements.
create or replace function public.has_feature(feature text)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.pro_active((select auth.uid()))
    and feature = any (public.role_features((select p.role from public.profiles p where p.id = (select auth.uid()))))
$$;

-- Insignia Pro y "destacada": cualquiera puede saber quién de una lista es Pro (es público por diseño).
create or replace function public.pro_user_ids(p_ids uuid[])
returns setof uuid language sql stable security definer set search_path = '' as $$
  select u from unnest(p_ids) u where public.pro_active(u)
$$;

revoke all on function public.pro_active(uuid), public.role_features(text), public.has_feature(text), public.pro_user_ids(uuid[]) from public, anon;
grant execute on function public.pro_active(uuid), public.role_features(text), public.has_feature(text), public.pro_user_ids(uuid[]) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Lo que ve el frontend: estado real, privilegios y uso del mes (la decisión final es de la base)
-- ---------------------------------------------------------------------------
create or replace view public.my_entitlements with (security_invoker = true) as
select
  s.user_id, s.plan_id, p.name as plan_name, pr.role, s.status,
  public.pro_active(s.user_id) as is_pro,
  case when s.status in ('active', 'trialing', 'past_due', 'canceled') and not public.pro_active(s.user_id) then 'expired' else s.status end as effective_status,
  s.trial_ends_at, s.current_period_end,
  case when s.status = 'past_due' then s.current_period_end + interval '5 days' end as grace_ends_at,
  case when public.pro_active(s.user_id) then public.role_features(pr.role) else array[]::text[] end as features,
  (select f.limits from public.plans f where f.id = pr.role || '_free') as free_limits,
  (select count(*) from public.interests i where i.investor_id = s.user_id and i.created_at >= date_trunc('month', now()))::int as interests_used_month,
  (select count(*) from public.company_challenges c join public.company_profiles cp on cp.id = c.company_id
     where cp.owner_id = s.user_id and c.status = 'open')::int as open_challenges
from public.subscriptions s
join public.plans p on p.id = s.plan_id
join public.profiles pr on pr.id = s.user_id
where s.user_id = (select auth.uid());
revoke all on public.my_entitlements from anon, authenticated;
grant select on public.my_entitlements to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Límites del plan Free, aplicados por triggers
-- ---------------------------------------------------------------------------
create or replace function public.enforce_interest_limit()
returns trigger language plpgsql security definer set search_path = '' as $$
declare cap int; used int;
begin
  if public.pro_active(new.investor_id) then return new; end if;
  select (f.limits ->> 'interests_per_month')::int into cap
    from public.profiles pr join public.plans f on f.id = pr.role || '_free' where pr.id = new.investor_id;
  if cap is null then return new; end if;
  select count(*) into used from public.interests where investor_id = new.investor_id and created_at >= date_trunc('month', now());
  if used >= cap then
    raise exception 'LIMIT_INTERESTS: el plan Free permite % "Me interesa" por mes', cap using errcode = 'P0001';
  end if;
  return new;
end;
$$;
drop trigger if exists interests_limit on public.interests;
create trigger interests_limit before insert on public.interests for each row execute function public.enforce_interest_limit();

create or replace function public.enforce_challenge_limit()
returns trigger language plpgsql security definer set search_path = '' as $$
declare owner uuid; cap int; used int;
begin
  if new.status <> 'open' or (tg_op = 'UPDATE' and old.status = 'open') then return new; end if;
  select cp.owner_id into owner from public.company_profiles cp where cp.id = new.company_id;
  if public.pro_active(owner) then return new; end if;
  select (f.limits ->> 'open_challenges')::int into cap from public.plans f where f.id = 'company_free';
  select count(*) into used from public.company_challenges where company_id = new.company_id and status = 'open' and id <> new.id;
  if cap is not null and used >= cap then
    raise exception 'LIMIT_CHALLENGES: el plan Free permite % desafío(s) abierto(s)', cap using errcode = 'P0001';
  end if;
  return new;
end;
$$;
drop trigger if exists challenges_limit on public.company_challenges;
create trigger challenges_limit before insert or update of status on public.company_challenges
  for each row execute function public.enforce_challenge_limit();
revoke all on function public.enforce_interest_limit(), public.enforce_challenge_limit() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Privilegios Pro en datos
-- ---------------------------------------------------------------------------
-- Ver quién sigue: la startup Pro ve a sus seguidores; el inversionista Pro ve quién sigue a cualquier startup publicada.
drop policy if exists "Users can read their own follows" on public.follows;
create policy "Users can read follows they are allowed to see" on public.follows
  for select to authenticated using (
    follower_id = (select auth.uid())
    or (public.has_feature('follower_list') and exists (
      select 1 from public.startup_profiles s where s.id = startup_id and s.owner_id = (select auth.uid())))
    or (public.has_feature('followers_of_startup') and exists (
      select 1 from public.startup_profiles s where s.id = startup_id and s.is_published))
  );

-- Estadísticas de visitas (startup Pro).
create table if not exists public.profile_views (
  id uuid primary key default gen_random_uuid(),
  startup_id uuid not null references public.startup_profiles(id) on delete cascade,
  viewer_id uuid not null references public.profiles(id) on delete cascade,
  viewed_on date not null default current_date,
  unique (startup_id, viewer_id, viewed_on)
);
alter table public.profile_views enable row level security; -- sin políticas: solo las funciones de abajo
revoke all on public.profile_views from anon, authenticated;

create or replace function public.record_profile_view(p_startup_id uuid)
returns void language sql security definer set search_path = '' as $$
  insert into public.profile_views (startup_id, viewer_id)
  select s.id, (select auth.uid()) from public.startup_profiles s
  where s.id = p_startup_id and s.is_published and s.owner_id <> (select auth.uid())
  on conflict do nothing
$$;

create or replace function public.startup_view_stats(p_startup_id uuid)
returns table (views_7d bigint, views_30d bigint, unique_viewers_30d bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.has_feature('profile_stats')
     or not exists (select 1 from public.startup_profiles s where s.id = p_startup_id and s.owner_id = (select auth.uid())) then
    raise exception 'FEATURE_LOCKED: las estadísticas de visitas son una función Pro' using errcode = 'P0001';
  end if;
  return query
    select count(*) filter (where v.viewed_on >= current_date - 6),
           count(*) filter (where v.viewed_on >= current_date - 29),
           count(distinct v.viewer_id) filter (where v.viewed_on >= current_date - 29)
    from public.profile_views v where v.startup_id = p_startup_id;
end;
$$;
revoke all on function public.record_profile_view(uuid), public.startup_view_stats(uuid) from public, anon;
grant execute on function public.record_profile_view(uuid), public.startup_view_stats(uuid) to authenticated;

-- Video propio (startup Pro): bucket aparte, escritura solo en la carpeta del usuario y solo con Pro.
alter table public.startup_profiles
  add column if not exists pitch_video_file_url text check (pitch_video_file_url is null or pitch_video_file_url ~ '^https://');
grant insert (pitch_video_file_url), update (pitch_video_file_url) on public.startup_profiles to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('pitch-videos', 'pitch-videos', true, 104857600, array['video/mp4', 'video/webm'])
on conflict (id) do update
  set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
drop policy if exists "Public read of pitch videos" on storage.objects;
create policy "Public read of pitch videos" on storage.objects for select using (bucket_id = 'pitch-videos');
drop policy if exists "Pro startups upload pitch videos" on storage.objects;
create policy "Pro startups upload pitch videos" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'pitch-videos' and (storage.foldername(name))[1] = (select auth.uid())::text and public.has_feature('video_upload'));
drop policy if exists "Startups manage their own pitch videos" on storage.objects;
create policy "Startups manage their own pitch videos" on storage.objects
  for delete to authenticated
  using (bucket_id = 'pitch-videos' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Alertas de nuevas rondas: seguidores + inversionistas Pro con ese sector entre sus intereses.
create or replace function public.notify_on_round_open()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.notifications (user_id, type, actor_id, entity_id)
  select t.u, 'round_opened', s.owner_id, s.id
  from (
    select f.follower_id as u from public.follows f where f.startup_id = new.startup_id
    union
    select ps.profile_id from public.profile_sectors ps
      join public.profiles p on p.id = ps.profile_id and p.role = 'investor'
      where ps.kind = 'interest'
        and ps.sector_id = (select sector_id from public.startup_profiles where id = new.startup_id)
        and public.pro_active(ps.profile_id)
  ) t
  join public.startup_profiles s on s.id = new.startup_id
  where s.is_published;
  return new;
end;
$$;

-- Aviso de cobro pendiente para quien pasa a past_due (también si el estado se cambia a mano).
create or replace function public.notify_on_billing()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'past_due' and old.status is distinct from 'past_due' then
    insert into public.notifications (user_id, type) values (new.user_id, 'billing');
  end if;
  return new;
end;
$$;
drop trigger if exists subscriptions_billing_notify on public.subscriptions;
create trigger subscriptions_billing_notify after update of status on public.subscriptions
  for each row execute function public.notify_on_billing();
revoke all on function public.notify_on_billing() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. Tarea diaria: pasa a expired lo vencido (los datos Pro se conservan; solo se bloquean)
-- ---------------------------------------------------------------------------
create or replace function public.expire_subscriptions()
returns int language plpgsql security definer set search_path = '' as $$
declare changed int;
begin
  update public.subscriptions set status = 'expired', updated_at = now()
  where (status = 'trialing' and trial_ends_at < now())
     or (status = 'canceled' and current_period_end < now())
     or (status in ('active', 'past_due') and current_period_end is not null and current_period_end + interval '5 days' < now());
  get diagnostics changed = row_count;
  return changed;
end;
$$;
revoke all on function public.expire_subscriptions() from public, anon, authenticated;

-- pg_cron (actívalo en Database → Extensions): todos los días a las 03:05 UTC.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('expire-subscriptions', '5 3 * * *', 'select public.expire_subscriptions()');
  end if;
end;
$$;

commit;
