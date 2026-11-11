"""Prueba las migraciones en un PostgreSQL real y embebido (pip install pgserver psycopg2-binary).
Simula lo mínimo de Supabase: roles anon/authenticated/service_role, auth.users y auth.uid().
Uso: python tests/db_test.py"""
import glob, os, shutil, sys, tempfile, json
import pgserver, psycopg2

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
MIG = sorted(glob.glob(os.path.join(ROOT, "supabase", "migrations", "*.sql")))
sys.stdout.reconfigure(encoding="utf-8")
results = []


def check(cond, label):
    results.append((bool(cond), label))
    print(("  ✓ " if cond else "  ✗ ") + label)


class Db:
    def __init__(self, uri):
        self.conn = psycopg2.connect(uri)
        self.conn.autocommit = True
        self.cur = self.conn.cursor()

    def run(self, sql, params=None):
        self.cur.execute(sql, params)
        return self.cur.fetchall() if self.cur.description else []

    def one(self, sql, params=None):
        rows = self.run(sql, params)
        return rows[0][0] if rows else None

    def as_user(self, uid, sql, params=None):
        """Ejecuta como el rol 'authenticated' con auth.uid() = uid. Devuelve ('ok', filas) o ('error', mensaje)."""
        try:
            self.run("reset role")
            self.run("select set_config('request.jwt.claim.sub', %s, false)", (str(uid),))
            self.run("set role authenticated")
            return "ok", self.run(sql, params)
        except Exception as error:  # noqa: BLE001
            return "error", str(error).splitlines()[0]
        finally:
            self.run("reset role")

    def migrate(self, upto=None, only=None):
        for path in MIG:
            number = os.path.basename(path)[:3]
            if only and number not in only:
                continue
            if upto and number > upto:
                break
            # pgcrypto no viene en este PostgreSQL embebido; gen_random_uuid() ya es nativo desde PG13.
            self.run(open(path, encoding="utf-8").read().replace("create extension if not exists pgcrypto;", ""))


def bootstrap(db):
    db.run("""
      do $$ begin
        create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
      exception when duplicate_object then null; end $$;
      create schema if not exists auth;
      create table if not exists auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb default '{}');
      create or replace function auth.uid() returns uuid language sql stable
        as $f$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $f$;
      grant usage on schema auth to authenticated, anon, service_role;
      grant execute on function auth.uid() to authenticated, anon, service_role;
      alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
      alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
      grant usage on schema public to anon, authenticated, service_role;
      -- Mínimo del esquema storage de Supabase.
      create schema if not exists storage;
      create table if not exists storage.buckets (id text primary key, name text, public boolean default false, file_size_limit bigint, allowed_mime_types text[]);
      create table if not exists storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid);
      alter table storage.objects enable row level security;
      create or replace function storage.foldername(name text) returns text[] language sql immutable
        as $f$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $f$;
      grant usage on schema storage to anon, authenticated, service_role;
      grant select, insert, update, delete on storage.objects to anon, authenticated, service_role;
      grant select on storage.buckets to anon, authenticated, service_role;
      do $$ begin create publication supabase_realtime; exception when duplicate_object then null; end $$;
    """)


def signup(db, email, role, name):
    return db.one(
        "insert into auth.users (email, raw_user_meta_data) values (%s, %s) returning id",
        (email, json.dumps({"role": role, "full_name": name})),
    )


def main():
    folder = tempfile.mkdtemp(prefix="venturea-pg-")
    server = pgserver.get_server(folder, cleanup_mode="delete")
    db = Db(server.get_uri())
    try:
        bootstrap(db)
        run_all(db)
        db.run("create database seed_test")
        seeded = Db("/seed_test".join(server.get_uri().rsplit("/postgres", 1)))
        bootstrap(seeded)
        run_seed(seeded)
        seeded.conn.close()
    finally:
        db.conn.close()
        server.cleanup()
        shutil.rmtree(folder, ignore_errors=True)
    failed = [label for ok, label in results if not ok]
    print(f"\n{len(results) - len(failed)}/{len(results)} comprobaciones")
    sys.exit(1 if failed else 0)


def run_all(db):
    print("Migración 001 + 002 con datos del MVP")
    db.migrate(upto="002")
    inv = signup(db, "inv@x.cl", "investor", "Ana Inversora")
    own = signup(db, "own@x.cl", "startup", "Beto Fundador")
    db.run("insert into startup_profiles (owner_id, name, city, sector, description, stage, target_amount_usd, preferred_check_min_usd, preferred_check_max_usd, business_model, is_fundraising) "
           "values (%s, 'Nébula', 'Santiago', 'Inteligencia artificial', 'Diagnóstico preventivo con IA de punta', 'Seed', 500000, 25000, 150000, 'B2B', true)", (own,))
    sid = db.one("select id from startup_profiles where owner_id = %s", (own,))
    db.run("insert into startup_updates (startup_id, author_id, content) values (%s, %s, 'Cerramos un piloto')", (sid, own))

    print("Migración 003 (v2) sobre datos existentes")
    db.migrate(only=["003"])
    check(db.one("select count(*) from sectors") == 32, "catálogo con 32 sectores")
    check(db.one("select count(distinct group_name) from sectors") == 7, "sectores en 7 grupos")
    check(db.one("select sector_id from startup_profiles where id = %s", (sid,)) == "inteligencia-artificial", "sector de la startup migrado a id de catálogo")
    check(db.one("select count(*) from profile_sectors where profile_id = %s and kind = 'interest'", (inv,)) == 3, "sectores de interés del inversor migrados a profile_sectors")
    check(db.one("select count(*) from funding_rounds where startup_id = %s and status = 'open'", (sid,)) == 1, "ronda abierta existente convertida a funding_rounds")
    check(db.one("select category from posts limit 1") == "hito", "publicaciones existentes renombradas a posts con categoría 'hito'")
    check(db.one("select count(*) from subscriptions where status = 'free'") == 2, "todos los usuarios existentes quedan en plan Free")
    check(db.one("select count(*) from information_schema.columns where table_name = 'investor_preferences' and column_name in ('sectors','sector_expertise')") == 0, "investor_preferences ya no duplica sectores")

    db.migrate(only=["004", "005", "006"])

    print("Alta de usuarios")
    adm = signup(db, "adm@x.cl", "admin", "Quiere Admin")
    check(db.one("select role from profiles where id = %s", (adm,)) == "investor", "el rol admin no se acepta desde el registro público")
    comp = signup(db, "comp@x.cl", "company", "Carla Corporativa")
    check(db.one("select role from profiles where id = %s", (comp,)) == "company", "registro con rol empresa")
    check(db.one("select plan_id from subscriptions where user_id = %s", (comp,)) == "company_free", "empresa nueva con plan company_free")
    check(db.one("select count(*) from profile_sectors where profile_id = %s", (comp,)) == 0, "empresa nueva sin sectores de inversor")

    print("Permisos por columna (RLS y grants)")
    status, msg = db.as_user(own, "update startup_profiles set traction_score = 1 where owner_id = %s", (own,))
    check(status == "error" and "permission denied" in msg, "la startup no puede editar su traction_score")
    status, msg = db.as_user(own, "update startup_profiles set is_fundraising = false where owner_id = %s", (own,))
    check(status == "error" and "permission denied" in msg, "la startup no puede editar is_fundraising a mano")
    status, _ = db.as_user(own, "update startup_profiles set name = 'Nébula 2' where owner_id = %s", (own,))
    check(status == "ok" and db.one("select name from startup_profiles where id = %s", (sid,)) == "Nébula 2", "la startup sí edita su nombre")
    status, msg = db.as_user(own, "update subscriptions set plan_id = 'startup_pro', status = 'active' where user_id = %s", (own,))
    check(status == "error" and "permission denied" in msg, "nadie se da Pro editando su suscripción")
    status, msg = db.as_user(own, "insert into subscriptions (user_id, plan_id, status) values (gen_random_uuid(), 'startup_pro', 'active')")
    check(status == "error", "nadie inserta suscripciones")
    status, rows = db.as_user(own, "select user_id from subscriptions")
    check(status == "ok" and [str(r[0]) for r in rows] == [str(own)], "cada usuario solo ve su propia suscripción")
    status, msg = db.as_user(own, "select * from payment_events")
    check(status == "error", "payment_events no es legible desde el navegador")
    status, msg = db.as_user(own, "update profiles set role = 'admin' where id = %s", (own,))
    check(status == "error" and "permission denied" in msg, "nadie cambia su rol")
    status, _ = db.as_user(inv, "select count(*) from sectors")
    check(status == "ok", "el catálogo de sectores es legible")
    status, msg = db.as_user(inv, "insert into sectors (id, name, group_name) values ('x', 'X', 'X')")
    check(status == "error", "los clientes no editan el catálogo de sectores")

    print("Rondas")
    status, _ = db.as_user(own, "insert into funding_rounds (startup_id, status, stage, target_usd, ticket_min_usd, ticket_max_usd) values (%s, 'open', 'Seed', 1000, 100, 200)", (sid,))
    check(status == "error", "no puede haber dos rondas abiertas a la vez")
    db.as_user(own, "update funding_rounds set status = 'paused' where startup_id = %s", (sid,))
    check(db.one("select is_fundraising from startup_profiles where id = %s", (sid,)) is False, "pausar la ronda apaga is_fundraising")
    status, _ = db.as_user(own, "insert into funding_rounds (startup_id, status, stage, target_usd, ticket_min_usd, ticket_max_usd) values (%s, 'open', 'Seed', 2000000, 100000, 200000)", (sid,))
    check(status == "ok" and db.one("select is_fundraising from startup_profiles where id = %s", (sid,)) is True, "abrir una nueva ronda enciende is_fundraising y conserva el historial")
    check(db.one("select count(*) from funding_rounds where startup_id = %s", (sid,)) == 2, "el historial de rondas se conserva")
    status, _ = db.as_user(inv, "insert into funding_rounds (startup_id, status, stage, target_usd, ticket_min_usd, ticket_max_usd) values (%s, 'paused', 'Seed', 2000, 100, 200)", (sid,))
    check(status == "error", "un inversor no crea rondas de otra startup")
    check(db.as_user(inv, "select count(*) from funding_rounds where startup_id = %s", (sid,))[1][0][0] == 2, "las rondas no borrador son visibles para otros")

    print("Perfil de empresa y búsqueda")
    status, _ = db.as_user(comp, "insert into company_profiles (owner_id, name, sector_id, size, city, description, collaboration_types) values (%s, 'Minera Austral', 'mining-tech', '1000+', 'Antofagasta', 'Buscamos pilotos de automatización minera', array['piloto'])", (comp,))
    check(status == "ok", "una empresa crea su perfil")
    status, _ = db.as_user(inv, "insert into company_profiles (owner_id, name, sector_id, size, city, description) values (%s, 'Falsa', 'fintech', '1-10', 'Santiago', 'Un inversor no puede crear empresas')", (inv,))
    check(status == "error", "un inversor no crea perfil de empresa")
    check(len(db.as_user(inv, "select * from search_all('minera')")[1]) == 1, "search_all encuentra empresas")
    check(len(db.as_user(inv, "select * from search_all('piloto') where kind = 'post'")[1]) == 1, "search_all encuentra publicaciones")
    check(len(db.as_user(inv, "select * from search_all('100%')")[1]) == 0, "search_all escapa % de la búsqueda")
    status, _ = db.as_user(inv, "select * from search_all('a')")
    check(status == "ok" and db.as_user(inv, "select * from search_all('a')")[1] == [], "búsquedas de 1 letra no devuelven nada")

    print("Video pitch y medios")
    status, msg = db.as_user(own, "update startup_profiles set pitch_video_url = 'https://evil.example.com/v/1' where owner_id = %s", (own,))
    check(status == "error", "el video de otro dominio se rechaza en la base")
    status, _ = db.as_user(own, "update startup_profiles set pitch_video_url = 'https://www.youtube.com/watch?v=abc' where owner_id = %s", (own,))
    check(status == "ok", "un enlace de YouTube se acepta")
    status, _ = db.as_user(own, "update startup_profiles set logo_url = 'javascript:alert(1)' where owner_id = %s", (own,))
    check(status == "error", "las URLs de imagen deben ser https")

    print("Fotos y banners (Storage)")
    check(db.one("select file_size_limit from storage.buckets where id = 'avatars'") == 2 * 1024 * 1024, "bucket avatars limitado a 2 MB")
    check(db.one("select file_size_limit from storage.buckets where id = 'banners'") == 5 * 1024 * 1024, "bucket banners limitado a 5 MB")
    check(db.one("select allowed_mime_types from storage.buckets where id = 'avatars'") == ["image/jpeg", "image/png", "image/webp"], "solo JPG, PNG o WebP")
    status, _ = db.as_user(own, "insert into storage.objects (bucket_id, name) values ('avatars', %s)", (f"{own}/avatar.webp",))
    check(status == "ok", "un usuario sube a su propia carpeta")
    status, _ = db.as_user(own, "insert into storage.objects (bucket_id, name) values ('avatars', %s)", (f"{inv}/avatar.webp",))
    check(status == "error", "nadie sube a la carpeta de otro usuario")
    status, _ = db.as_user(own, "insert into storage.objects (bucket_id, name) values ('avatars', 'suelto.webp')")
    check(status == "error", "no se sube fuera de una carpeta de usuario")
    status, _ = db.as_user(own, "insert into storage.objects (bucket_id, name) values ('documentos', %s)", (f"{own}/x.pdf",))
    check(status == "error", "solo existen escritura en avatars y banners")
    status, _ = db.as_user(inv, "delete from storage.objects where name = %s", (f"{own}/avatar.webp",))
    check(status == "ok" and db.one("select count(*) from storage.objects") == 1, "nadie borra archivos ajenos")
    db.run("reset role")
    db.run("set role anon")
    check(db.one("select count(*) from storage.objects where bucket_id = 'avatars'") == 1, "las fotos son de lectura pública")
    db.run("reset role")
    status, rows = db.as_user(own, "select sector_id from profile_sectors where profile_id = %s", (inv,))
    check(status == "ok" and len(rows) == 6, "los sectores de un inversor son visibles en su perfil público")
    status, _ = db.as_user(own, "insert into profile_sectors (profile_id, sector_id, kind) values (%s, 'fintech', 'interest')", (inv,))
    check(status == "error", "nadie edita los sectores de otro")

    print("Seguidores e intereses")
    status, _ = db.as_user(inv, "insert into follows (follower_id, startup_id) values (%s, %s)", (inv, sid))
    check(status == "ok", "un inversor sigue a una startup")
    status, _ = db.as_user(inv, "insert into follows (follower_id, startup_id) values (%s, %s)", (inv, sid))
    check(status == "error", "no se puede seguir dos veces")
    status, _ = db.as_user(own, "insert into follows (follower_id, startup_id) values (%s, %s)", (own, sid))
    check(status == "error", "una startup no sigue startups")
    status, _ = db.as_user(comp, "insert into interests (investor_id, startup_id) values (%s, %s)", (comp, sid))
    check(status == "ok", "una empresa puede expresar interés")
    status, _ = db.as_user(inv, "insert into notifications (user_id, type) values (%s, 'follow')", (own,))
    check(status == "error", "los clientes no fabrican notificaciones")
    status, msg = db.as_user(inv, "update interests set status = 'matched' where investor_id = %s", (comp,))
    check(db.one("select status from interests where investor_id = %s", (comp,)) == "pending", "un tercero no cambia el estado de un interés ajeno")

    print("Comunidad: seguidores y notificaciones")
    notes = lambda uid, kind: db.one("select count(*) from notifications where user_id = %s and type = %s", (uid, kind))
    check(notes(own, "follow") == 1 and db.one("select actor_id from notifications where type = 'follow'") == inv, "seguir crea una notificación para el dueño de la startup")
    check(notes(own, "interest") == 1, "un interés crea una notificación para la startup")
    status, rows = db.as_user(own, "select * from follower_counts(%s)", (sid,))
    check(status == "ok" and rows == [(1, 1, 0)], f"follower_counts: 1 seguidor, 1 inversionista, 0 empresas ({rows})")
    db.as_user(comp, "insert into follows (follower_id, startup_id) values (%s, %s)", (comp, sid))
    check(db.as_user(inv, "select * from follower_counts(%s)", (sid,))[1] == [(2, 1, 1)], "el conteo separa inversionistas y empresas y lo ve cualquiera")
    check(db.as_user(inv, "select count(*) from follows where follower_id <> %s", (inv,))[1] == [(0,)], "nadie lee quién más sigue (la lista no es pública)")
    status, _ = db.as_user(own, "select * from follower_counts('00000000-0000-0000-0000-000000000000')")
    check(status == "ok" and db.as_user(own, "select * from follower_counts('00000000-0000-0000-0000-000000000000')")[1] == [(0, 0, 0)], "un id inexistente devuelve ceros")
    db.as_user(own, "update interests set status = 'matched' where investor_id = %s and startup_id = %s", (comp, sid))
    check(notes(comp, "match") == 1 and db.one("select actor_id from notifications where type = 'match'") == own, "aceptar un interés notifica el match a quien lo envió")
    db.as_user(own, "update funding_rounds set status = 'paused' where startup_id = %s and status = 'open'", (sid,))
    check(notes(inv, "round_opened") == 0, "pausar una ronda no notifica")
    db.as_user(own, "insert into funding_rounds (startup_id, status, stage, target_usd, ticket_min_usd, ticket_max_usd) values (%s, 'open', 'Seed', 900000, 50000, 100000)", (sid,))
    check(notes(inv, "round_opened") == 1 and notes(comp, "round_opened") == 1, "abrir una ronda notifica a todos sus seguidores")
    db.as_user(own, "update funding_rounds set status = 'paused' where startup_id = %s and status = 'open'", (sid,))
    db.as_user(own, "update funding_rounds set status = 'open' where startup_id = %s and status = 'paused' and target_usd = 900000", (sid,))
    check(notes(inv, "round_opened") == 2, "reabrir una ronda pausada también notifica")
    db.as_user(inv, "update notifications set read_at = now() where user_id = %s", (own,))
    check(db.one("select count(*) from notifications where user_id = %s and read_at is not null", (own,)) == 0, "nadie marca como leídas las notificaciones de otro")
    db.as_user(inv, "update notifications set read_at = now() where user_id = %s", (inv,))
    check(db.one("select count(*) from notifications where user_id = %s and read_at is null", (inv,)) == 0, "cada usuario marca las suyas como leídas")
    status, _ = db.as_user(inv, "update notifications set type = 'match' where user_id = %s", (inv,))
    check(status == "error", "solo read_at es editable en una notificación")
    status, _ = db.as_user(inv, "select * from notifications where user_id = %s", (own,))
    check(db.as_user(inv, "select count(*) from notifications where user_id = %s", (own,))[1] == [(0,)], "cada usuario solo lee sus notificaciones")
    check(db.one("select count(*) from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'notifications'") == 1, "notifications publicada en Realtime")


def run_seed(db):
    print("Datos de prueba (supabase/seed.sql) sobre una base limpia")
    db.migrate()
    accounts = json.load(open(os.path.join(ROOT, "scripts", "seed-accounts.json"), encoding="utf-8"))
    for account in accounts:
        signup(db, account["email"], account["role"], account["name"])
    db.run(open(os.path.join(ROOT, "supabase", "seed.sql"), encoding="utf-8").read())
    count = lambda sql: db.one(sql)
    check(count("select count(*) from startup_profiles") == 15, "15 startups")
    check(count("select count(distinct sector_id) from startup_profiles") >= 10, "startups en al menos 10 sectores")
    check(count("select count(*) from funding_rounds where status = 'open'") == 5, "5 rondas abiertas")
    check(count("select count(*) from funding_rounds where status = 'paused'") == 2, "2 rondas pausadas")
    check(count("select count(*) from funding_rounds where status = 'closed'") == 1, "1 ronda cerrada")
    check(count("select count(*) from startup_profiles where is_fundraising") == 5, "is_fundraising refleja las 5 rondas abiertas")
    check(count("select count(*) from profiles where role = 'investor'") == 8, "8 inversionistas")
    check(count("select count(*) from profiles where role = 'company'") == 6, "6 empresas")
    check(count("select count(*) from company_profiles") == 6, "6 perfiles de empresa")
    check(count("select count(*) from profiles where role = 'admin'") == 1, "1 administrador")
    check(count("select count(*) from posts") == 60, "60 publicaciones")
    check(count("select count(distinct category) from posts") == 7, "publicaciones en las 7 categorías")
    check(count("select count(*) from follows") == 80, "80 seguimientos")
    check(count("select count(*) from interests") == 20, "20 intereses")
    check(count("select count(distinct status) from interests") == 3, "intereses pendientes, match y rechazados")
    states = {r[0] for r in db.run("select status from subscriptions where user_id in (select id from auth.users where email like 'i0%')")}
    check(states == {"free", "active", "trialing", "past_due", "canceled", "expired"}, "los estados de pago están cubiertos")
    check(count("select count(*) from subscriptions where status = 'past_due'") == 2, "pago atrasado dentro y fuera de gracia")
    try:
        db.run(open(os.path.join(ROOT, "supabase", "seed.sql"), encoding="utf-8").read())
        check(False, "seed.sql no se puede ejecutar dos veces sin reset")
    except Exception:  # noqa: BLE001
        db.run("rollback")  # el script abre su propia transacción y queda abortada
        check(True, "seed.sql no se puede ejecutar dos veces sin reset")
    run_freemium(db)


def run_freemium(db):
    uid = lambda email: db.one("select id from auth.users where email = %s", (f"{email}@venturea.test",))
    entitlement = lambda email: db.as_user(uid(email), "select effective_status, is_pro, array_length(features, 1) from my_entitlements")[1]
    print("Freemium: los 7 estados de pago, en la base")
    expected = {"i01": ("free", False), "i02": ("active", True), "i03": ("trialing", True), "i04": ("past_due", True),
                "i05": ("expired", False), "i06": ("canceled", True), "i07": ("expired", False)}
    for email, (state, pro) in expected.items():
        rows = entitlement(email)
        check(len(rows) == 1 and rows[0][0] == state and rows[0][1] == pro, f"{email}: estado {state}, Pro={pro} (obtuvo {rows})")
        flag = db.as_user(uid(email), "select has_feature('unlimited_interests')")[1][0][0]
        check(flag == pro, f"{email}: has_feature('unlimited_interests') = {pro}")
    check(db.as_user(uid("i02"), "select has_feature('follower_list')")[1][0][0] is False, "un inversionista Pro no recibe privilegios de startup")
    check(db.as_user(uid("s01"), "select has_feature('follower_list'), has_feature('video_upload'), has_feature('unlimited_interests')")[1][0] == (True, True, False), "una startup Pro recibe solo privilegios de startup")
    check(db.as_user(uid("s03"), "select has_feature('follower_list')")[1][0][0] is False, "una startup Free no tiene privilegios Pro")
    check(db.as_user(uid("i02"), "select user_id from my_entitlements where user_id <> %s", (uid("i02"),))[1] == [], "my_entitlements solo muestra la fila propia")
    status, _ = db.as_user(uid("i02"), "select pro_active(%s)", (uid("i02"),))
    check(status == "ok", "pro_active es consultable por usuarios autenticados")
    db.run("reset role"); db.run("set role anon")
    try:
        db.run("select has_feature('x')"); anon_ok = True
    except Exception:  # noqa: BLE001
        anon_ok = False
    db.run("reset role")
    check(not anon_ok, "anon no puede consultar privilegios")

    print("Freemium: un usuario Free no logra darse Pro")
    me = uid("i01")
    for label, sql in [("editando su suscripción", "update subscriptions set plan_id = 'investor_pro', status = 'active' where user_id = %s"),
                       ("insertando otra suscripción", "insert into subscriptions (user_id, plan_id, status) values (%s, 'investor_pro', 'active')"),
                       ("editando los planes", "update plans set is_paid = false where id = (select plan_id from subscriptions where user_id = %s)"),
                       ("escribiendo eventos de pago", "insert into payment_events (id, user_id, type) select 'x', %s, 'paid'"),
                       ("cambiando su rol", "update profiles set role = 'startup' where id = %s")]:
        status, msg = db.as_user(me, sql, (me,))
        check(status == "error" and "permission denied" in msg, f"no puede darse Pro {label}")
    status, msg = db.as_user(me, "select expire_subscriptions()")
    check(status == "error", "no puede ejecutar la tarea de vencimiento")
    check(entitlement("i01")[0][1] is False, "tras los intentos sigue siendo Free")

    print("Freemium: límite de 10 'Me interesa' al mes")
    free_id, pro_id, grace_id, lapsed_id = uid("i01"), uid("i02"), uid("i04"), uid("i05")
    def fill(user, target):
        used = db.as_user(user, "select interests_used_month from my_entitlements")[1][0][0]
        free_startups = [r[0] for r in db.run("select id from startup_profiles where id not in (select startup_id from interests where investor_id = %s) order by name", (user,))]
        outcome = ("ok", None)
        for startup in free_startups[: max(0, target - used)]:
            outcome = db.as_user(user, "insert into interests (investor_id, startup_id) values (%s, %s)", (user, startup))
            if outcome[0] == "error":
                break
        return outcome, db.as_user(user, "select interests_used_month from my_entitlements")[1][0][0]
    outcome, used = fill(free_id, 10)
    check(outcome[0] == "ok" and used == 10, f"un usuario Free llega a 10 este mes ({used})")
    extra = [r[0] for r in db.run("select id from startup_profiles where id not in (select startup_id from interests where investor_id = %s) limit 1", (free_id,))]
    status, msg = db.as_user(free_id, "insert into interests (investor_id, startup_id) values (%s, %s)", (free_id, extra[0]))
    check(status == "error" and "LIMIT_INTERESTS" in msg, "el interés 11 de un usuario Free se rechaza en la base")
    outcome, used = fill(pro_id, 14)
    check(outcome[0] == "ok" and used == 14, f"un usuario Pro active supera los 10 ({used})")
    outcome, used = fill(grace_id, 12)
    check(outcome[0] == "ok" and used == 12, "past_due dentro de la gracia conserva el privilegio")
    outcome, used = fill(lapsed_id, 12)
    check(outcome[0] == "error" and "LIMIT_INTERESTS" in outcome[1] and used == 10, "past_due con la gracia vencida vuelve al límite Free")

    print("Freemium: desafíos de empresa")
    company = lambda email: db.one("select id from company_profiles where owner_id = %s", (uid(email),))
    ins = "insert into company_challenges (company_id, title, description) values (%s, 'Otro desafío', 'Una descripción suficiente')"
    status, msg = db.as_user(uid("c03"), ins, (company("c03"),))
    check(status == "error" and "LIMIT_CHALLENGES" in msg, "una empresa Free no publica un segundo desafío abierto")
    check(db.as_user(uid("c01"), ins, (company("c01"),))[0] == "ok", "una empresa Pro publica varios")
    check(db.as_user(uid("c02"), ins, (company("c02"),))[0] == "ok", "cancelada con periodo vigente conserva el privilegio")
    db.as_user(uid("c03"), "update company_challenges set status = 'closed' where company_id = %s", (company("c03"),))
    check(db.as_user(uid("c03"), ins, (company("c03"),))[0] == "ok", "cerrando el desafío, la empresa Free puede publicar otro")
    status, msg = db.as_user(uid("c03"), "update company_challenges set status = 'open' where company_id = %s and title <> 'Otro desafío'", (company("c03"),))
    check(db.one("select count(*) from company_challenges where company_id = %s and status = 'open'", (company("c03"),)) == 1, "reabrir un desafío no esquiva el límite Free")

    print("Freemium: seguidores, estadísticas y video")
    sid = db.one("select id from startup_profiles where owner_id = %s", (uid("s01"),))
    total = db.one("select count(*) from follows where startup_id = %s", (sid,))
    check(total > 0, "la startup de prueba tiene seguidores")
    check(db.as_user(uid("s01"), "select count(*) from follows where startup_id = %s", (sid,))[1][0][0] == total, "la startup Pro ve la lista de quién la sigue")
    sid3 = db.one("select id from startup_profiles where owner_id = %s", (uid("s03"),))
    check(db.as_user(uid("s03"), "select count(*) from follows where startup_id = %s", (sid3,))[1][0][0] == 0, "la startup Free no ve la lista de seguidores")
    check(db.as_user(uid("i02"), "select count(*) from follows where startup_id = %s", (sid,))[1][0][0] == total, "el inversionista Pro ve quién sigue a una startup")
    check(db.as_user(uid("i05"), "select count(*) from follows where startup_id = %s and follower_id <> %s", (sid, uid("i05")))[1][0][0] == 0, "el inversionista sin Pro no ve a los demás seguidores")
    db.as_user(uid("i01"), "select record_profile_view(%s)", (sid,))
    db.as_user(uid("i01"), "select record_profile_view(%s)", (sid,))
    db.as_user(uid("s01"), "select record_profile_view(%s)", (sid,))
    status, rows = db.as_user(uid("s01"), "select * from startup_view_stats(%s)", (sid,))
    check(status == "ok" and rows == [(1, 1, 1)], f"estadísticas Pro: una visita por visitante y día, sin contar al dueño ({rows})")
    status, msg = db.as_user(uid("s03"), "select * from startup_view_stats(%s)", (sid3,))
    check(status == "error" and "FEATURE_LOCKED" in msg, "las estadísticas están bloqueadas para una startup Free")
    status, msg = db.as_user(uid("s01"), "select * from startup_view_stats(%s)", (sid3,))
    check(status == "error", "ni siquiera una Pro lee estadísticas de otra startup")
    check(db.as_user(uid("s01"), "insert into storage.objects (bucket_id, name) values ('pitch-videos', %s)", (f"{uid('s01')}/pitch.mp4",))[0] == "ok", "la startup Pro sube su video")
    check(db.as_user(uid("s03"), "insert into storage.objects (bucket_id, name) values ('pitch-videos', %s)", (f"{uid('s03')}/pitch.mp4",))[0] == "error", "la startup Free no sube video propio")
    check(db.one("select file_size_limit from storage.buckets where id = 'pitch-videos'") == 100 * 1024 * 1024, "videos limitados a 100 MB")
    pro_ids = {r[0] for r in db.as_user(uid("i01"), "select * from pro_user_ids(array[%s, %s, %s]::uuid[])", (uid("s01"), uid("s03"), uid("s02")))[1]}
    check(pro_ids == {uid("s01"), uid("s02")}, "pro_user_ids marca solo a las startups Pro (insignia y destacada)")

    print("Freemium: alertas, cobros y vencimiento")
    s07 = db.one("select id from startup_profiles where owner_id = %s", (uid("s07"),))
    db.run("delete from follows")
    db.as_user(uid("s07"), "update funding_rounds set status = 'open' where startup_id = %s and status = 'paused'", (s07,))
    got = lambda email: db.one("select count(*) from notifications where user_id = %s and type = 'round_opened'", (uid(email),))
    check(got("i06") == 1, "un inversionista Pro con ese sector recibe alerta de la nueva ronda aunque no siga a la startup")
    sid_health = db.one("select id from startup_profiles where owner_id = %s", (uid("s01"),))
    db.as_user(uid("s01"), "update funding_rounds set status = 'paused' where startup_id = %s and status = 'open'", (sid_health,))
    db.as_user(uid("s01"), "update funding_rounds set status = 'open' where startup_id = %s and status = 'paused'", (sid_health,))
    check(got("i01") == 0 and got("i08") == 0, "los inversionistas Free que no siguen no reciben la alerta")
    db.run("update subscriptions set status = 'past_due', current_period_end = now() - interval '1 day' where user_id = %s", (uid("i08"),))
    check(db.one("select count(*) from notifications where user_id = %s and type = 'billing'", (uid("i08"),)) == 1, "pasar a past_due crea un aviso de cobro")
    changed = db.one("select expire_subscriptions()")
    states = dict(db.run("select u.email, s.status from subscriptions s join auth.users u on u.id = s.user_id where u.email like 'i0%'"))
    check(states["i05@venturea.test"] == "expired", "la tarea diaria expira past_due con la gracia vencida")
    check(states["i04@venturea.test"] == "past_due" and states["i03@venturea.test"] == "trialing" and states["i02@venturea.test"] == "active", "y no toca a quienes siguen vigentes")
    check(changed >= 1, f"expire_subscriptions informa lo cambiado ({changed})")
    check(db.one("select count(*) from subscriptions s join plans p on p.id = s.plan_id where s.status = 'expired' and p.is_paid") >= 2, "los vencidos conservan su plan y datos (solo se bloquean)")


if __name__ == "__main__":
    main()
