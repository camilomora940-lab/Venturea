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
        check(True, "seed.sql no se puede ejecutar dos veces sin reset")


if __name__ == "__main__":
    main()
