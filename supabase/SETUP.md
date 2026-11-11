# Configurar Venturea (Supabase)

Venturea funciona sobre un proyecto de Supabase. Se recomiendan **dos proyectos**: uno real y otro **solo para pruebas**, para no mezclar datos falsos con usuarios reales.

## 1. Crear el proyecto y aplicar las migraciones

1. Crea una organización y un proyecto en Supabase (el plan **Free** alcanza para empezar).
2. En **SQL Editor**, ejecuta **en orden** cada archivo de [`migrations/`](./migrations). Cada cambio de base de datos es un archivo numerado; nunca se edita uno ya aplicado:

   | Archivo | Qué agrega |
   | --- | --- |
   | `001_init.sql` | Perfiles, preferencias, startups, publicaciones, intereses y RLS (versión original) |
   | `002_search.sql` | Búsqueda global `search_all(q)` |
   | `003_v2.sql` | Catálogo de 32 sectores, rol empresa, medios, rondas, categorías, seguidores, notificaciones y tablas de planes. Conserva los datos existentes y corre dentro de una transacción |
   | `004_profiles_storage.sql` | Buckets públicos `avatars` (2 MB) y `banners` (5 MB) con escritura solo en la carpeta del propio usuario; sectores visibles en perfiles públicos |
   | `005_community.sql` | `follower_counts()`, notificaciones automáticas (seguir, interés, match y ronda abierta) y publicación en Realtime |
   | `006_freemium.sql` | `has_feature()`, vista `my_entitlements`, límites del plan Free (triggers), privilegios Pro en RLS, estadísticas de visitas, bucket `pitch-videos` y vencimiento diario (pg_cron) |

3. En **Project Settings → API**, copia el **Project URL** y la clave **anon/publicable**. Nunca copies una `service_role` o clave secreta en el frontend.
4. En **Authentication → URL Configuration**, agrega la URL local permitida `http://localhost:8000/**` y define `http://localhost:8000/` como Site URL.

## 2. Conectar Venturea

Edita [`../supabase-config.js`](../supabase-config.js) con los datos públicos del paso anterior:

```js
window.VENTUREA_CONFIG = {
  supabaseUrl: "https://TU-PROJECT-REF.supabase.co",
  supabaseAnonKey: "TU-CLAVE-ANON-O-PUBLICABLE"
};
```

La URL y la clave pública están pensadas para el navegador; las políticas RLS y los permisos por columna de la base son los que autorizan cada operación.

## 3. Probar localmente

```powershell
python -m http.server 8000
```

Visita `http://localhost:8000`. El navegador no puede conectarse a una instancia real abriendo `index.html` con `file://`.

## 4. Base de datos de pruebas (proyecto aparte)

1. Crea un **segundo proyecto** de Supabase solo para pruebas y aplica en él las migraciones (paso 1).
2. Crea un archivo `.env` en la raíz del repositorio (ya está en `.gitignore`; **nunca** se sube a git):

   ```
   SUPABASE_URL=https://PROYECTO-DE-PRUEBAS.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=clave-service-role-del-proyecto-de-pruebas
   SEED_PASSWORD=una-contraseña-para-todas-las-cuentas-de-prueba
   ```

   La `service_role` salta toda la seguridad: úsala solo aquí, en tu máquina. El script se niega a correr si `SUPABASE_URL` coincide con la de `supabase-config.js`.
3. `npm run reset` (equivale a `node scripts/seed-users.mjs --reset`) borra las cuentas `@venturea.test` —y todos sus datos por cascada— y las vuelve a crear con la Admin API.
4. Ejecuta [`seed.sql`](./seed.sql) en el SQL Editor del proyecto de pruebas. Carga 15 startups en 15 sectores (5 rondas abiertas, 2 pausadas, 1 cerrada, 1 borrador), 8 inversionistas, 6 empresas, 1 administrador, 60 publicaciones en las 7 categorías, 80 seguimientos, 20 intereses y los 7 estados de pago.
5. Para repetir desde cero: `npm run reset` y volver a ejecutar `seed.sql`. Si lo ejecutas dos veces sin reset, se detiene con un aviso.
6. Para apuntar el frontend al proyecto de pruebas, usa temporalmente su URL y clave anon en `supabase-config.js` (no subas ese cambio).

### Cuentas de prueba

Todas usan la contraseña de `SEED_PASSWORD`. El estado de pago se aplica desde la Fase 4.

| Correo | Rol | Plan | Estado |
| --- | --- | --- | --- |
| s01@venturea.test | Startup (Nébula Health, healthtech) | Pro | Activo · ronda abierta · con video pitch |
| s02@venturea.test | Startup (Lumen Terra, agrotech) | Pro | En prueba (5 días) · ronda abierta |
| s03@venturea.test | Startup (Finova, fintech) | Free | Ronda abierta · con video pitch |
| s04@venturea.test | Startup (Nodo, saas-b2b) | Free | Ronda abierta |
| s05@venturea.test | Startup (Prisma AI, IA) | Free | Ronda abierta |
| s06@venturea.test | Startup (Raíz Foods, foodtech) | Free | Ronda pausada |
| s07@venturea.test | Startup (Solaris, energía) | Free | Ronda pausada |
| s08@venturea.test | Startup (BioLoop, economía circular) | Free | Ronda cerrada |
| s09@venturea.test | Startup (Kipu Edu, edtech) | Free | Ronda en borrador |
| s10–s15@venturea.test | Startups (logística, mining tech, proptech, aquatech, ciberseguridad, e-commerce) | Free | Sin ronda |
| i01@venturea.test | Inversionista (Ángel) | Free | `free` |
| i02@venturea.test | Inversionista (VC) | Pro | `active` |
| i03@venturea.test | Inversionista (VC) | Pro | `trialing` (9 días) |
| i04@venturea.test | Inversionista (Ángel) | Pro | `past_due` dentro de los 5 días de gracia |
| i05@venturea.test | Inversionista (Ángel) | Pro | `past_due` con la gracia vencida |
| i06@venturea.test | Inversionista (VC) | Pro | `canceled` con periodo vigente (12 días) |
| i07@venturea.test | Inversionista (Corporate) | Pro | `expired` |
| i08@venturea.test | Inversionista (VC) | Free | `free` |
| c01@venturea.test | Empresa (Minera Austral) | Pro | Activo |
| c02@venturea.test | Empresa (Banco Meridian) | Pro | `canceled` con periodo vigente (6 días) |
| c03–c06@venturea.test | Empresas (AgroNorte, Retail Cordillera, Energía del Sur, Clínica Alameda) | Free | `free` |
| a01@venturea.test | Administrador | — | — |

## Planes, pagos y privilegios (Fase 4)

Venturea tiene plan **Free** y plan **Pro** por rol. Los precios y límites exactos de Pro están por definir (decisiones abiertas 1 y 2): `plans.price_clp` queda en `null` hasta decidirlos y los límites viven en `plans.limits`.

**Quién decide.** El navegador solo *lee* su suscripción (`my_entitlements`). Ninguna política permite insertarla o modificarla: la escribe solo la Edge Function `payments-webhook` (clave `service_role`, solo en el servidor) o tú desde el panel de Supabase. Los privilegios se calculan en la base con `has_feature()` a partir del estado y las fechas; la pantalla solo los refleja.

| Estado | ¿Tiene Pro? |
| --- | --- |
| `free` | No |
| `trialing` | Sí, hasta `trial_ends_at` |
| `active` | Sí |
| `past_due` | Sí, durante 5 días de gracia desde `current_period_end` |
| `canceled` | Sí, hasta `current_period_end` |
| `expired` | No. Vuelve a Free; los datos Pro se conservan pero se bloquean |

La función `expire_subscriptions()` pasa a `expired` lo vencido. Se programa sola todos los días a las 03:05 UTC **si la extensión `pg_cron` está activa** (Database → Extensions → `pg_cron`; después vuelve a ejecutar la última parte de `006_freemium.sql` o ejecuta `select cron.schedule('expire-subscriptions', '5 3 * * *', 'select public.expire_subscriptions()');`).

**Probar estados a mano** (mientras no haya pasarela), en el SQL Editor del proyecto de pruebas:

```sql
update public.subscriptions
   set plan_id = 'investor_pro', status = 'active', current_period_end = now() + interval '30 days'
 where user_id = (select id from auth.users where email = 'i01@venturea.test');
```

**Webhook de pagos.** [`functions/payments-webhook`](./functions/payments-webhook) verifica la firma HMAC-SHA256 del cuerpo (cabecera `x-signature`), ignora eventos repetidos (`payment_events.id` es único) y actualiza `subscriptions`. El contrato es genérico; cuando se elija pasarela (Mercado Pago, Flow, Stripe...) solo hay que adaptar `parseEvent`.

```powershell
supabase secrets set PAYMENTS_WEBHOOK_SECRET=un-secreto-largo
supabase functions deploy payments-webhook --no-verify-jwt
```

Para activar el botón de pago, define `checkoutUrl` en `supabase-config.js`; sin él, el botón explica que los pagos aún no están habilitados en lugar de simular un cobro.

## Pruebas automáticas

```powershell
npm test
```

Ejecuta, sin dependencias de ejecución: las funciones puras (`tests/unit.mjs`), el webhook de pagos (`tests/webhook.test.mjs`), la interfaz en Edge/Chrome sin ventana contra un Supabase simulado (`tests/run.mjs`), los contrastes de color (`tests/contrast.mjs`) y las migraciones, el seed, los permisos y los 7 estados de pago sobre un PostgreSQL real y embebido (`tests/db_test.py`, requiere `pip install pgserver psycopg2-binary pglast`).

## Costos y límites

Supabase Free tiene límites y puede pausar proyectos inactivos; el almacenamiento (fotos, banners y videos Pro) cuenta contra la cuota del plan. Antes de cobrar, confirma las comisiones y el soporte de suscripciones de la pasarela elegida y revisa las condiciones vigentes de cada proveedor.
