-- Fase 0: búsqueda global agrupada. SECURITY INVOKER: la RLS de cada tabla decide qué ve cada usuario.
-- Las fases siguientes la reemplazan (create or replace) para incluir empresas y la tabla posts.
create or replace function public.search_all(q text)
returns table (kind text, id uuid, title text, subtitle text)
language sql
stable
security invoker
set search_path = ''
as $$
  with p as (
    select '%' || replace(replace(replace(trim(q), '\', '\\'), '%', '\%'), '_', '\_') || '%' as pat
    where length(trim(q)) >= 2
  )
  (select 'startup'::text, s.id, s.name, s.sector || ' · ' || s.city
     from public.startup_profiles s, p
     where s.is_published and (s.name ilike p.pat or s.description ilike p.pat or s.sector ilike p.pat)
     order by s.name limit 5)
  union all
  (select 'investor'::text, pr.id, pr.full_name, 'Inversionista'::text
     from public.profiles pr, p
     where pr.role = 'investor' and pr.full_name ilike p.pat
     order by pr.full_name limit 5)
  union all
  (select 'post'::text, u.id, left(u.content, 80), s.name
     from public.startup_updates u
     join public.startup_profiles s on s.id = u.startup_id, p
     where u.content ilike p.pat
     order by u.created_at desc limit 5)
$$;

revoke all on function public.search_all(text) from public, anon;
grant execute on function public.search_all(text) to authenticated;
