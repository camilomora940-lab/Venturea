// Crea (o recrea con --reset) las 30 cuentas de prueba con la Admin API de Supabase.
// Lee SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY y SEED_PASSWORD de un .env local (nunca se sube a git).
// Después ejecuta supabase/seed.sql en el SQL Editor del MISMO proyecto de pruebas.
import { existsSync, readFileSync } from "node:fs";

const root = new URL("../", import.meta.url);
const env = { ...process.env };
if (existsSync(new URL(".env", root))) {
  for (const line of readFileSync(new URL(".env", root), "utf8").split(/\r?\n/)) {
    const match = /^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (match && !(match[1] in env)) env[match[1]] = match[2].replace(/^["']|["']$/g, "");
  }
}
const { SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: key, SEED_PASSWORD: password } = env;
if (!url || !key || !password) {
  console.error("Faltan SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY o SEED_PASSWORD en .env (ver supabase/SETUP.md).");
  process.exit(1);
}
// Protección: este script borra usuarios; nunca debe apuntar al proyecto real que usa el frontend.
const configured = /supabaseUrl:\s*"([^"]+)"/.exec(readFileSync(new URL("supabase-config.js", root), "utf8"))?.[1];
if (configured && configured.replace(/\/$/, "") === url.replace(/\/$/, "")) {
  console.error("SUPABASE_URL coincide con supabase-config.js (el proyecto real). Usa un proyecto de pruebas aparte.");
  process.exit(1);
}

const accounts = JSON.parse(readFileSync(new URL("scripts/seed-accounts.json", root), "utf8"));
const api = async (path, init = {}) => {
  const response = await fetch(`${url}/auth/v1/admin${path}`, {
    ...init,
    headers: { apikey: key, Authorization: `Bearer ${key}`, "content-type": "application/json" }
  });
  const body = await response.json().catch(() => ({}));
  return { status: response.status, body };
};
const listSeedUsers = async () => {
  const found = [];
  for (let page = 1; ; page++) {
    const { body } = await api(`/users?page=${page}&per_page=200`);
    const users = body.users || [];
    found.push(...users.filter((user) => user.email?.endsWith("@venturea.test")));
    if (users.length < 200) return found;
  }
};

if (process.argv.includes("--reset")) {
  const existing = await listSeedUsers();
  for (const user of existing) await api(`/users/${user.id}`, { method: "DELETE" }); // cascada: borra perfiles y todo lo sembrado
  console.log(`Borradas ${existing.length} cuentas de prueba (y sus datos).`);
}
const present = new Set((await listSeedUsers()).map((user) => user.email));
let created = 0;
for (const account of accounts) {
  if (present.has(account.email)) continue;
  const { status, body } = await api("/users", {
    method: "POST",
    body: JSON.stringify({ email: account.email, password, email_confirm: true, user_metadata: { full_name: account.name, role: account.role } })
  });
  if (status >= 300) { console.error(`No se pudo crear ${account.email}: ${body.msg || body.message || status}`); process.exit(1); }
  created++;
}
console.log(`Cuentas creadas: ${created}; ya existían: ${accounts.length - created}.`);
console.log("Siguiente paso: ejecuta supabase/seed.sql en el SQL Editor del proyecto de pruebas.");
