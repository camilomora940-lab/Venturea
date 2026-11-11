-- Fase 3: comunidad. Conteo de seguidores por tipo, notificaciones automáticas y Realtime.
begin;

-- Conteo de seguidores (total, inversionistas, empresas). SECURITY DEFINER: cualquiera ve los números
-- sin poder leer quién sigue (la tabla follows solo muestra a cada usuario sus propios seguimientos).
create or replace function public.follower_counts(p_startup_id uuid)
returns table (total bigint, investors bigint, companies bigint)
language sql stable security definer set search_path = '' as $$
  select count(*), count(*) filter (where p.role = 'investor'), count(*) filter (where p.role = 'company')
  from public.follows f
  join public.profiles p on p.id = f.follower_id
  where f.startup_id = p_startup_id
    and exists (select 1 from public.startup_profiles s
                where s.id = p_startup_id and (s.is_published or s.owner_id = (select auth.uid())))
$$;
revoke all on function public.follower_counts(uuid) from public, anon;
grant execute on function public.follower_counts(uuid) to authenticated;

-- Notificaciones: las crean estos triggers (los clientes no pueden insertarlas).
create or replace function public.notify_on_follow()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.notifications (user_id, type, actor_id, entity_id)
  select s.owner_id, 'follow', new.follower_id, new.startup_id from public.startup_profiles s where s.id = new.startup_id;
  return new;
end;
$$;
drop trigger if exists follows_notify on public.follows;
create trigger follows_notify after insert on public.follows for each row execute function public.notify_on_follow();

create or replace function public.notify_on_interest()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    insert into public.notifications (user_id, type, actor_id, entity_id)
    select s.owner_id, 'interest', new.investor_id, new.startup_id from public.startup_profiles s where s.id = new.startup_id;
  elsif new.status = 'matched' and old.status is distinct from 'matched' then
    insert into public.notifications (user_id, type, actor_id, entity_id)
    select new.investor_id, 'match', s.owner_id, new.startup_id from public.startup_profiles s where s.id = new.startup_id;
  end if;
  return new;
end;
$$;
drop trigger if exists interests_notify_insert on public.interests;
create trigger interests_notify_insert after insert on public.interests for each row execute function public.notify_on_interest();
drop trigger if exists interests_notify_update on public.interests;
create trigger interests_notify_update after update of status on public.interests for each row execute function public.notify_on_interest();

-- Al abrir una ronda, sus seguidores reciben una notificación.
create or replace function public.notify_on_round_open()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.notifications (user_id, type, actor_id, entity_id)
  select f.follower_id, 'round_opened', s.owner_id, s.id
  from public.follows f join public.startup_profiles s on s.id = f.startup_id
  where f.startup_id = new.startup_id and s.is_published;
  return new;
end;
$$;
drop trigger if exists funding_rounds_notify_insert on public.funding_rounds;
create trigger funding_rounds_notify_insert after insert on public.funding_rounds
  for each row when (new.status = 'open') execute function public.notify_on_round_open();
drop trigger if exists funding_rounds_notify_update on public.funding_rounds;
create trigger funding_rounds_notify_update after update of status on public.funding_rounds
  for each row when (new.status = 'open' and old.status is distinct from 'open') execute function public.notify_on_round_open();

revoke all on function public.notify_on_follow(), public.notify_on_interest(), public.notify_on_round_open() from public, anon, authenticated;

-- Realtime: la app se suscribe a las filas de notifications de cada usuario (la RLS ya limita cada una a su dueño).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications') then
    alter publication supabase_realtime add table public.notifications;
  end if;
end;
$$;

commit;
