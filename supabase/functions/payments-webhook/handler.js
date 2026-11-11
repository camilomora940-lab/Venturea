// Lógica pura del webhook de pagos: se prueba en Node (tests/webhook.test.mjs) y corre igual en Deno (index.ts).
// Contrato genérico: cada pasarela (Mercado Pago, Flow, Stripe...) se adapta en un parseEvent propio; el resto no cambia.
//   POST con cuerpo JSON  { id, type, user_id, plan_id, status, trial_ends_at?, current_period_end?, provider?, provider_ref? }
//   y cabecera x-signature = HMAC-SHA256 hexadecimal del cuerpo crudo con PAYMENTS_WEBHOOK_SECRET.
const encoder = new TextEncoder();
const STATUSES = ["free", "trialing", "active", "past_due", "canceled", "expired"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function hmacHex(secret, body) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

// Comparación en tiempo constante para no filtrar la firma por diferencias de tiempo.
function sameText(a, b) {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return difference === 0;
}

export async function verifySignature(secret, rawBody, header) {
  if (!secret || !header) return false;
  const received = String(header).trim().replace(/^sha256=/i, "").toLowerCase();
  return sameText(await hmacHex(secret, rawBody), received);
}

const isoOrNull = (value) => {
  if (value == null) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
};

export function parseEvent(rawBody) {
  let data;
  try { data = JSON.parse(rawBody); } catch { return { error: "JSON inválido" }; }
  if (!data || typeof data !== "object") return { error: "Evento inválido" };
  if (typeof data.id !== "string" || !data.id || data.id.length > 200) return { error: "Falta el id del evento" };
  if (!UUID.test(data.user_id || "")) return { error: "user_id inválido" };
  if (typeof data.plan_id !== "string" || !data.plan_id) return { error: "Falta plan_id" };
  if (!STATUSES.includes(data.status)) return { error: "Estado desconocido" };
  const trial = isoOrNull(data.trial_ends_at);
  const period = isoOrNull(data.current_period_end);
  if (trial === undefined || period === undefined) return { error: "Fecha inválida" };
  return { event: { id: data.id, type: String(data.type || "subscription.updated").slice(0, 100), user_id: data.user_id, plan_id: data.plan_id, status: data.status, trial_ends_at: trial, current_period_end: period, provider: data.provider ? String(data.provider).slice(0, 50) : null, provider_ref: data.provider_ref ? String(data.provider_ref).slice(0, 200) : null } };
}

// db: { roleOf(userId), recordEvent(event) -> true si es nuevo / false si ya se había procesado, saveSubscription(row) }
export async function processEvent(db, event) {
  const role = await db.roleOf(event.user_id);
  if (!role) return { status: 404, body: { error: "Usuario no encontrado" } };
  if (!event.plan_id.startsWith(`${role}_`)) return { status: 422, body: { error: "El plan no corresponde al rol del usuario" } };
  const isNew = await db.recordEvent(event);
  if (!isNew) return { status: 200, body: { ok: true, duplicated: true } }; // el proveedor reintenta: no se procesa dos veces
  await db.saveSubscription({
    user_id: event.user_id, plan_id: event.plan_id, status: event.status, trial_ends_at: event.trial_ends_at,
    current_period_end: event.current_period_end, provider: event.provider, provider_ref: event.provider_ref, updated_at: new Date().toISOString()
  });
  return { status: 200, body: { ok: true, duplicated: false } };
}

export async function handleRequest(db, secret, method, rawBody, signature) {
  if (method !== "POST") return { status: 405, body: { error: "Método no permitido" } };
  if (!(await verifySignature(secret, rawBody, signature))) return { status: 401, body: { error: "Firma inválida" } };
  const { event, error } = parseEvent(rawBody);
  if (error) return { status: 400, body: { error } };
  return processEvent(db, event);
}
