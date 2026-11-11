// Escenarios de interfaz. Cada uno define datos falsos (db) y una función run(ctx) con afirmaciones ctx.ok(cond, texto).
// Catálogo de sectores como en la migración (32) más uno agregado "sin tocar código".
const SECTOR_ROWS = [
  ["healthtech", "Healthtech", "Salud"], ["biotech", "Biotech", "Salud"], ["medtech", "Medtech", "Salud"],
  ["fintech", "Fintech", "Finanzas"], ["insurtech", "Insurtech", "Finanzas"],
  ["climate-tech", "Climate tech", "Clima y recursos"], ["energia", "Energía", "Clima y recursos"], ["economia-circular", "Economía circular", "Clima y recursos"],
  ["agrotech", "Agrotech", "Clima y recursos"], ["foodtech", "Foodtech", "Clima y recursos"], ["aquatech", "Aquatech/acuicultura", "Clima y recursos"],
  ["forestal", "Forestal", "Clima y recursos"], ["mining-tech", "Mining tech", "Clima y recursos"],
  ["proptech", "Proptech", "Ciudades e industria"], ["construtech", "Construtech", "Ciudades e industria"], ["logistica", "Logística", "Ciudades e industria"],
  ["movilidad", "Movilidad", "Ciudades e industria"], ["industria-4-0", "Industria 4.0", "Ciudades e industria"], ["hardware-iot", "Hardware/IoT", "Ciudades e industria"],
  ["edtech", "Edtech", "Personas"], ["hr-tech", "HR tech", "Personas"], ["legaltech", "Legaltech", "Personas"], ["govtech", "Govtech", "Personas"], ["impacto-social", "Impacto social", "Personas"],
  ["retail-ecommerce", "Retail tech/E-commerce", "Comercio y medios"], ["martech", "Martech", "Comercio y medios"], ["traveltech", "Traveltech", "Comercio y medios"], ["gaming", "Gaming y entretenimiento", "Comercio y medios"],
  ["inteligencia-artificial", "Inteligencia artificial", "Tecnología base"], ["saas-b2b", "SaaS B2B", "Tecnología base"], ["ciberseguridad", "Ciberseguridad", "Tecnología base"], ["deeptech", "Deeptech", "Tecnología base"],
  ["space-tech", "Space tech", "Tecnología base"] // agregado solo en la base: debe aparecer en todos los selectores
].map(([id, name, group_name], index) => ({ id, name, group_name, is_active: true, sort_order: index }));
const startupRow = (id, owner, name, sector_id, extra = {}) => ({
  id, owner_id: owner, name, city: "Santiago", country: "Chile", sector_id, description: `${name} construye algo muy útil para Chile.`, stage: "Seed",
  target_amount_usd: 500000, preferred_check_min_usd: 25000, preferred_check_max_usd: 250000, business_model: "B2B", traction_score: 0.5,
  desired_investor_types: ["Angel", "VC"], desired_stages: ["Seed"], is_fundraising: false, is_published: true, created_at: "2026-01-01T00:00:00Z", ...extra
});
const CATEGORY_ROWS = [["hito", "Hito"], ["financiamiento", "Financiamiento"], ["producto", "Producto"], ["equipo", "Equipo y talento"], ["prensa", "Prensa"], ["evento", "Evento"], ["alianza", "Busco alianza/piloto"]]
  .map(([id, name], index) => ({ id, name, sort_order: index + 1 }));
// 45 publicaciones alternando s1/s2 y repartidas en las 7 categorías (para probar filtros y paginación de 20).
const manyPosts = () => Array.from({ length: 45 }, (_, i) => ({
  id: `p${i}`, startup_id: i % 2 ? "s2" : "s1", author_id: i % 2 ? "own2" : "own1", content: `Novedad número ${i}`,
  category: CATEGORY_ROWS[i % 7].id, created_at: new Date(Date.UTC(2026, 3, 1) - i * 3600000).toISOString()
}));
const followerRpc = { follower_counts: async ({ p_startup_id }, db) => {
  const rows = db.follows.filter((follow) => follow.startup_id === p_startup_id);
  const roleOf = (id) => db.profiles.find((profile) => profile.id === id)?.role;
  return [{ total: rows.length, investors: rows.filter((r) => roleOf(r.follower_id) === "investor").length, companies: rows.filter((r) => roleOf(r.follower_id) === "company").length }];
} };
const roundRow = (id, startup_id, extra = {}) => ({ id, startup_id, status: "open", stage: "Seed", target_usd: 500000, ticket_min_usd: 25000, ticket_max_usd: 250000, committed_pct: 0, created_at: "2026-03-01T00:00:00Z", ...extra });
const baseDb = () => ({
  profiles: [
    { id: "inv1", role: "investor", full_name: "Ana Inversora", city: "Santiago", headline: "Inversionista ángel en salud", bio: "Invierto en equipos fundadores técnicos.", avatar_url: null, banner_url: null },
    { id: "own1", role: "startup", full_name: "Beto Fundador", city: null },
    { id: "own2", role: "startup", full_name: "Cata Fundadora", city: null },
    { id: "comp1", role: "company", full_name: "Clara Corporativa", city: null },
    { id: "comp2", role: "company", full_name: "Nico Nuevo", city: null }
  ],
  company_profiles: [{
    id: "c1", owner_id: "comp1", name: "Clínica Alameda", sector_id: "healthtech", size: "201-1000", city: "Santiago", website: "https://clinica.test",
    description: "Red de clínicas que pilotea soluciones de diagnóstico.", collaboration_types: ["piloto"], challenges: "Reducir esperas", logo_url: null, banner_url: null, is_published: true
  }],
  company_challenges: [{ id: "ch1", company_id: "c1", title: "Reducir esperas en urgencias", description: "Buscamos triage asistido por IA.", status: "open", created_at: "2026-03-01T00:00:00Z" }],
  follows: [{ id: "f1", follower_id: "comp1", startup_id: "s2", created_at: "2026-03-02T00:00:00Z" }],
  sectors: SECTOR_ROWS,
  post_categories: CATEGORY_ROWS,
  notifications: [],
  investor_preferences: [{
    user_id: "inv1", stages: ["Seed"], min_ticket_usd: 25000, max_ticket_usd: 250000, investor_type: "Angel",
    markets: ["Chile"], preferred_models: ["B2B"]
  }],
  profile_sectors: [
    { profile_id: "inv1", sector_id: "healthtech", kind: "interest" }, { profile_id: "inv1", sector_id: "fintech", kind: "interest" },
    { profile_id: "inv1", sector_id: "healthtech", kind: "expertise" }
  ],
  funding_rounds: [roundRow("r1", "s1"), roundRow("r2", "s2", { stage: "Serie A", committed_pct: 30 })],
  startup_profiles: [
    startupRow("s1", "own1", "Nébula Health", "healthtech", { is_fundraising: true, pitch_video_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" }),
    startupRow("s2", "own2", "Finova", "fintech", { is_fundraising: true }),
    startupRow("s3", "own3", "Agro Uno", "agrotech", { pitch_video_url: "https://evil.example.com/v/1" })
  ],
  interests: [{ id: "i1", investor_id: "inv1", startup_id: "s1", status: "pending", created_at: "2026-02-01T00:00:00Z" }],
  posts: [{ id: "u1", startup_id: "s1", author_id: "own1", content: "Cerramos un piloto", category: "hito", created_at: "2026-02-01T00:00:00Z" }]
});
const searchRpc = { search_all: async ({ q }) => ({
  neb: [
    { kind: "startup", id: "s1", title: "Nébula Health", subtitle: "healthtech · Santiago" },
    { kind: "post", id: "u1", title: "Cerramos un piloto", subtitle: "Nébula Health" }
  ],
  cli: [{ kind: "company", id: "c1", title: "Clínica Alameda", subtitle: "healthtech · Santiago" }],
  ana: [{ kind: "investor", id: "inv1", title: "Ana Inversora", subtitle: "Inversionista" }]
})[q] || [] };

const key = (ctx, init) => ctx.doc.dispatchEvent(new ctx.win.KeyboardEvent("keydown", { bubbles: true, ...init }));
const navLabels = (ctx) => ctx.$$("#main-nav .nav-link").map((b) => [...b.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join("").trim());
const appReady =(ctx) => ctx.until(() => ctx.visible(ctx.$(".app-shell")) && ctx.$("#profile-button").title === "Menú de cuenta" && ctx.$$("#main-nav .nav-link").length, "app listo");

const makePng = (ctx, width, height) => new Promise((resolve) => {
  const canvas = ctx.doc.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const pen = canvas.getContext("2d");
  pen.fillStyle = "#1F4FD8";
  pen.fillRect(0, 0, width, height);
  canvas.toBlob((blob) => resolve(new ctx.win.File([blob], "foto.png", { type: "image/png" })), "image/png");
});
const chooseFile = (ctx, file) => {
  const transfer = new ctx.win.DataTransfer();
  transfer.items.add(file);
  const input = ctx.$("#image-file");
  input.files = transfer.files;
  input.dispatchEvent(new ctx.win.Event("change", { bubbles: true }));
};
const typeSearch = async (ctx, text) => {
  const input = ctx.$("#global-search");
  input.value = text;
  input.dispatchEvent(new ctx.win.Event("input", { bubbles: true }));
  await ctx.until(() => ctx.visible(ctx.$("#search-results")), "resultados");
};

window.SCENARIOS = {
  phase3_publicaciones: {
    db: () => ({ ...baseDb(), posts: manyPosts(), follows: [{ id: "f9", follower_id: "inv1", startup_id: "s2" }] }),
    options: { userId: "inv1" },
    async run(ctx) {
      await appReady(ctx);
      ctx.$('#main-nav [data-view="updates"]').click();
      await ctx.until(() => ctx.$$("#update-list .update-item").length === 20, "primera página");
      ctx.ok(ctx.$$("#post-chips .chip").map((c) => c.textContent).join("|") === "Todas|Hito|Financiamiento|Producto|Equipo y talento|Prensa|Evento|Busco alianza/piloto", "chips: Todas + las 7 categorías");
      ctx.ok(ctx.visible(ctx.$("#load-more-posts")), "hay botón para cargar más");
      ctx.$("#load-more-posts").click();
      await ctx.until(() => ctx.$$("#update-list .update-item").length === 40, "segunda página");
      ctx.$("#load-more-posts").click();
      await ctx.until(() => ctx.$$("#update-list .update-item").length === 45, "tercera página");
      ctx.ok(!ctx.visible(ctx.$("#load-more-posts")), "paginación completa: 20 + 20 + 5 y sin más botón");
      ctx.$('#post-chips [data-post-cat="hito"]').click();
      await ctx.until(() => ctx.$$("#update-list .update-item").length === 7, "filtro hito");
      ctx.ok(ctx.$$("#update-list .cat-tag").every((t) => t.textContent === "Hito"), "solo se ven publicaciones de la categoría elegida");
      const select = ctx.log.filter((e) => e.table === "posts" && e.op === "select").pop();
      ctx.ok(select.filters >= 1, "el filtro se hace en la consulta, no ocultando elementos");
      ctx.$('#post-chips [data-post-cat="all"]').click();
      await ctx.until(() => ctx.$$("#update-list .update-item").length === 20, "todas otra vez");
      const sector = ctx.$("#post-sector-filter");
      sector.value = "healthtech";
      sector.dispatchEvent(new ctx.win.Event("change", { bubbles: true }));
      await ctx.until(() => ctx.$$("#update-list .update-item").length === 20 && ctx.$$("#update-list .update-logo").every((l) => l.textContent === "N"), "filtro de sector");
      ctx.ok(true, "el filtro por sector muestra solo la startup de ese sector (N = Nébula)");
      sector.value = "all";
      sector.dispatchEvent(new ctx.win.Event("change", { bubbles: true }));
      ctx.$("#post-following-only").click();
      await ctx.until(() => ctx.$$("#update-list .update-item").length === 20 && ctx.$$("#update-list .update-logo").every((l) => l.textContent === "F"), "solo seguidos");
      ctx.ok(true, "'Solo de quienes sigo' muestra solo a Finova (F)");
      ctx.$('#post-chips [data-post-cat="prensa"]').click();
      await ctx.until(() => ctx.$$("#update-list .update-item").length > 0 && ctx.$$("#update-list .cat-tag").every((t) => t.textContent === "Prensa"), "combinado");
      ctx.ok(ctx.$$("#update-list .update-logo").every((l) => l.textContent === "F"), "los filtros se combinan");
    }
  },
  phase3_publicar_categoria: {
    db: baseDb,
    options: { userId: "own1" },
    async run(ctx) {
      await appReady(ctx);
      ctx.ok(ctx.$$("#post-category option").length === 8 && ctx.$("#post-category").required, "el compositor exige una de las 7 categorías");
      ctx.$("#update-input").value = "Lanzamos la versión 2";
      ctx.$("#publish-update").click();
      await ctx.wait(100);
      ctx.ok(!ctx.db.posts.some((p) => p.content === "Lanzamos la versión 2"), "sin categoría no se publica");
      ctx.$("#post-category").value = "producto";
      ctx.$("#publish-update").click();
      await ctx.wait(200);
      const post = ctx.db.posts.find((p) => p.content === "Lanzamos la versión 2");
      ctx.ok(post && post.category === "producto", "la publicación queda con su categoría");
      ctx.$('#main-nav [data-view="startup"]').click();
      await ctx.until(() => /Producto/.test(ctx.$("#founder-updates").textContent), "mis publicaciones");
      ctx.ok(ctx.$("#founder-updates .cat-tag"), "la categoría aparece como etiqueta de color en cada publicación");
    }
  },
  phase3_financiamiento: {
    db: baseDb,
    options: { userId: "own1" },
    async run(ctx) {
      await appReady(ctx);
      await ctx.until(() => ctx.$("#funding-switch").checked, "interruptor encendido");
      ctx.ok(/Ronda abierta · Seed/.test(ctx.$("#funding-status").textContent) && ctx.$("#funding-switch-label").textContent === "Sí", "el interruptor refleja la ronda abierta");
      ctx.ok(ctx.$("#open-rounds-count").textContent === "2", "dos rondas abiertas en la plataforma");
      ctx.$("#funding-switch").click();
      await ctx.until(() => ctx.db.funding_rounds.find((r) => r.id === "r1").status === "paused", "pausada");
      await ctx.wait(150);
      ctx.ok(!ctx.$("#funding-switch").checked && /Ronda pausada/.test(ctx.$("#round-status").textContent), "apagar el interruptor pausa la ronda");
      ctx.ok(ctx.$("#open-rounds-count").textContent === "1", "la ronda pausada sale de Rondas abiertas");
      ctx.$('[data-round-action="open"]').click();
      await ctx.until(() => ctx.db.funding_rounds.find((r) => r.id === "r1").status === "open", "reabierta");
      await ctx.wait(150);
      ctx.ok(ctx.$("#funding-switch").checked && ctx.$("#open-rounds-count").textContent === "2", "reabrir vuelve a publicarla");
      ctx.$('[data-round-action="closed"]').click();
      await ctx.until(() => ctx.db.funding_rounds.find((r) => r.id === "r1").status === "closed", "cerrada");
      await ctx.wait(150);
      ctx.ok(ctx.$$("#funding-history .funding-row").length === 1 && /Cerrada/.test(ctx.$("#funding-history").textContent), "el historial conserva la ronda cerrada");
      ctx.$("#funding-switch").click();
      ctx.ok(ctx.$("#round-modal").classList.contains("open") && !ctx.$("#funding-switch").checked, "encender el interruptor abre el formulario corto de ronda");
      const form = ctx.$("#round-form");
      form.elements.ticketMin.value = "300000";
      form.elements.ticketMax.value = "100000";
      form.requestSubmit();
      await ctx.wait(100);
      ctx.ok(/ticket máximo/.test(ctx.$("#round-error").textContent), "valida el rango de ticket");
      form.elements.ticketMin.value = "50000";
      form.elements.ticketMax.value = "300000";
      form.elements.target.value = "2000000";
      form.elements.closesAt.value = "2026-12-31";
      form.requestSubmit();
      await ctx.until(() => ctx.db.funding_rounds.some((r) => r.startup_id === "s1" && r.status === "open" && r.id !== "r1"), "ronda nueva");
      await ctx.wait(150);
      const round = ctx.db.funding_rounds.find((r) => r.startup_id === "s1" && r.status === "open");
      ctx.ok(round.target_usd === 2000000 && round.ticket_min_usd === 50000 && round.ticket_max_usd === 300000 && new Date(round.closes_at).getFullYear() === 2026, "crea la ronda con monto, ticket y fecha de cierre");
      ctx.ok(ctx.$("#funding-switch").checked && ctx.$$("#funding-history .funding-row").length === 2, "queda abierta y el historial suma la nueva");
      ctx.$('#main-nav [data-view="funds"]').click();
      ctx.$("#open-fund-modal").click();
      ctx.ok(!ctx.$("#open-fund-modal").hidden && ctx.$("#round-modal").classList.contains("open"), "el botón de Rondas abiertas usa el mismo flujo");
    }
  },
  phase3_seguidores: {
    db: () => ({ ...baseDb(), follows: [{ id: "f1", follower_id: "comp1", startup_id: "s1" }] }),
    options: { userId: "inv1", rpc: followerRpc },
    async run(ctx) {
      await appReady(ctx);
      ctx.ok(ctx.visible(ctx.$("#follow-button")) && ctx.$("#follow-button").textContent === "Seguir", "la tarjeta tiene botón Seguir");
      ctx.ok(ctx.$("#company-tags .tag.funding"), "la tarjeta lleva la insignia 'Buscando financiamiento'");
      ctx.$("#follow-button").click();
      await ctx.until(() => ctx.db.follows.some((f) => f.follower_id === "inv1" && f.startup_id === "s1"), "seguimiento");
      ctx.ok(ctx.$("#follow-button").textContent === "Siguiendo ✓", "el botón pasa a Siguiendo");
      ctx.$("#info-button").click();
      await ctx.until(() => ctx.$("#follower-line"), "conteo");
      ctx.ok(/2\s*seguidores/.test(ctx.$("#follower-line").textContent) && /1 inversionistas/.test(ctx.$("#follower-line").textContent) && /1 empresas/.test(ctx.$("#follower-line").textContent), `el perfil muestra 2 seguidores · 1 inversionistas · 1 empresas (${ctx.$("#follower-line").textContent})`);
      ctx.ok(ctx.$("#follower-line .role-investor") && ctx.$("#follower-line .role-company"), "cada tipo con su color");
      ctx.ok(ctx.$("#profile-page [data-follow]").textContent === "Siguiendo ✓", "el perfil también muestra el estado de seguimiento");
      ctx.$("#profile-page [data-follow]").click();
      await ctx.until(() => !ctx.db.follows.some((f) => f.follower_id === "inv1"), "dejar de seguir");
      await ctx.until(() => /1\s*seguidores/.test(ctx.$("#follower-line").textContent), "conteo actualizado");
      ctx.ok(/1\s*seguidores/.test(ctx.$("#follower-line").textContent) && /0 inversionistas/.test(ctx.$("#follower-line").textContent), "dejar de seguir actualiza el conteo");
    }
  },
  phase3_panel_startup_seguidores: {
    db: () => ({ ...baseDb(), follows: [{ id: "f1", follower_id: "comp1", startup_id: "s1" }, { id: "f2", follower_id: "inv1", startup_id: "s1" }] }),
    options: { userId: "own1", rpc: followerRpc },
    async run(ctx) {
      await appReady(ctx);
      await ctx.until(() => ctx.$("#followers-investors").textContent === "1", "conteo inversionistas");
      ctx.ok(ctx.$("#followers-investors").textContent === "1" && ctx.$("#followers-companies").textContent === "1", "Mi startup muestra seguidores inversionistas y empresas por separado");
      ctx.ok(!/Vistas de perfil/.test(ctx.$("#view-startup").textContent), "se reemplazó la tarjeta 'Vistas de perfil'");
    }
  },
  phase3_notificaciones: {
    db: () => ({ ...baseDb(), notifications: [
      { id: "n1", user_id: "own1", type: "follow", actor_id: "inv1", entity_id: "s1", read_at: null, created_at: "2026-04-01T10:00:00Z" },
      { id: "n2", user_id: "own1", type: "interest", actor_id: "comp1", entity_id: "s1", read_at: null, created_at: "2026-04-01T09:00:00Z" },
      { id: "n3", user_id: "own1", type: "follow", actor_id: "inv1", entity_id: "s1", read_at: "2026-03-01T00:00:00Z", created_at: "2026-03-01T00:00:00Z" },
      { id: "n4", user_id: "inv1", type: "match", actor_id: "own1", entity_id: "s1", read_at: null, created_at: "2026-04-01T08:00:00Z" }
    ] }),
    options: { userId: "own1", rpc: followerRpc },
    async run(ctx) {
      await appReady(ctx);
      await ctx.until(() => ctx.visible(ctx.$("#notif-badge")), "campana");
      ctx.ok(ctx.$("#notif-badge").textContent === "2", "la campana cuenta solo las no leídas propias (2)");
      ctx.ok(ctx.$("#notification-button .notification-dot").hidden, "el punto naranjo fijo se reemplazó por el contador");
      const channel = window.__client.__channels[0];
      ctx.ok(channel && channel.name === "notifications-own1", "se suscribe a Realtime con el canal del usuario");
      const arrive = (id) => {
        const row = { id, user_id: "own1", type: "follow", actor_id: "inv1", entity_id: "s1", read_at: null, created_at: new Date().toISOString() };
        ctx.db.notifications.push(row);
        channel.handlers[0]({ new: row });
      };
      arrive("n10");
      await ctx.until(() => ctx.$$("#notice-stack .notice-card").length === 1, "aviso");
      ctx.ok(/Ana Inversora \(inversionista\) comenzó a seguir a Nébula Health/.test(ctx.$("#notice-stack").textContent), "el aviso dice quién siguió y a quién");
      ctx.ok(ctx.$("#notice-stack [data-notice-open]").textContent === "Ver perfil", "el aviso trae el botón Ver perfil");
      ctx.ok(ctx.$("#notif-badge").textContent === "3", "la campana suma una no leída");
      arrive("n11"); arrive("n12"); arrive("n13");
      await ctx.until(() => ctx.$("#notif-badge").textContent === "6", "seis no leídas");
      await ctx.wait(100);
      ctx.ok(ctx.$$("#notice-stack .notice-card").length === 3, "se apilan como máximo 3 avisos");
      await ctx.wait(6500);
      ctx.ok(ctx.$$("#notice-stack .notice-card").length === 0, "los avisos se cierran solos a los 6 segundos");
      ctx.$("#notification-button").click();
      await ctx.until(() => ctx.$$("#notification-panel .notice-row").length === 7, "historial");
      ctx.ok(ctx.$$("#notification-panel .notice-row.unread").length === 6, "el historial resalta lo nuevo");
      await ctx.until(() => ctx.$("#notif-badge").hidden, "marcadas como leídas");
      ctx.ok(ctx.db.notifications.filter((n) => n.user_id === "own1").every((n) => n.read_at), "al abrir el panel se marcan como leídas");
      ctx.ok(ctx.db.notifications.find((n) => n.id === "n4").read_at === null, "no toca las notificaciones de otros usuarios");
      ctx.$("#notification-panel .notice-row").click();
      await ctx.until(() => ctx.$("#view-profile").classList.contains("active") && /Ana Inversora/.test(ctx.$("#profile-page").textContent), "perfil de quien siguió");
      ctx.ok(ctx.$("#notification-panel").hidden, "el panel se cierra al abrir un perfil");
    }
  },
  phase3_notificaciones_sin_realtime: {
    db: baseDb,
    options: { userId: "own1", realtimeStatus: "CHANNEL_ERROR", pollMs: 400 },
    async run(ctx) {
      await appReady(ctx);
      ctx.ok(ctx.$$("#notice-stack .notice-card").length === 0, "sin avisos al comenzar");
      ctx.db.notifications.push({ id: "n20", user_id: "own1", type: "round_opened", actor_id: "own2", entity_id: "s2", read_at: null, created_at: new Date().toISOString() });
      await ctx.until(() => ctx.$$("#notice-stack .notice-card").length === 1, "aviso por consulta periódica", 600);
      ctx.ok(/Finova abrió una ronda de financiamiento/.test(ctx.$("#notice-stack").textContent), "si Realtime falla, la consulta periódica trae el aviso");
      ctx.ok(ctx.$("#notif-badge").textContent === "1", "y la campana suma una");
    }
  },
  phase2_empresa_alta: {
    db: () => ({ ...baseDb(), company_profiles: [] }),
    options: { userId: "comp2" },
    async run(ctx) {
      await appReady(ctx);
      ctx.ok(ctx.$("#company-profile-modal").classList.contains("open"), "una empresa nueva debe completar su perfil");
      key(ctx, { key: "Escape" });
      ctx.ok(ctx.$("#company-profile-modal").classList.contains("open"), "Escape no cierra el alta obligatoria");
      ctx.ok(navLabels(ctx).join("|") === "Descubrir startups|Mis desafíos|Seguidos|Publicaciones|Mi empresa", `menú empresa: ${navLabels(ctx)}`);
      ctx.ok(ctx.$(".workspace-label").textContent === "ESPACIO DE EMPRESA", "etiqueta de espacio de empresa");
      ctx.ok(ctx.$$("#company-profile-form [name=sector] option").length === 33, "el rubro usa el catálogo de sectores");
      const form = ctx.$("#company-profile-form");
      form.elements.name.value = "Retail Cordillera";
      form.elements.sector.value = "healthtech";
      form.elements.city.value = "Santiago";
      form.elements.description.value = "Cadena de tiendas con programa de innovación abierta.";
      form.requestSubmit();
      await ctx.wait(100);
      ctx.ok(ctx.visible(ctx.$("#company-profile-error")) && /colaboración/.test(ctx.$("#company-profile-error").textContent), "exige al menos un tipo de colaboración");
      ctx.$('#collab-options [value="piloto"]').checked = true;
      form.requestSubmit();
      await ctx.wait(200);
      const saved = ctx.db.company_profiles[0];
      ctx.ok(saved && saved.owner_id === "comp2" && saved.collaboration_types.join() === "piloto", "se crea company_profiles con su colaboración");
      ctx.ok(ctx.db.profile_sectors.some((r) => r.profile_id === "comp2" && r.sector_id === "healthtech"), "el sector de la empresa queda en profile_sectors");
      ctx.ok(!ctx.$("#company-profile-modal").classList.contains("open"), "el alta se cierra al guardar");
      ctx.ok(ctx.$("#company-name").textContent === "Nébula Health", `la tarjeta muestra la mejor startup (${ctx.$("#company-name").textContent})`);
    }
  },
  phase2_empresa: {
    db: baseDb,
    options: { userId: "comp1", rpc: searchRpc },
    async run(ctx) {
      await appReady(ctx);
      ctx.ok(!ctx.$("#company-profile-modal").classList.contains("open"), "una empresa con perfil no ve el alta");
      ctx.ok(ctx.$("#company-fit").textContent.startsWith("100%"), `compatibilidad empresa–startup: ${ctx.$("#company-fit").textContent}`);
      ctx.ok(/Sector coincide \(40%\)/.test(ctx.$("#score-breakdown").textContent), "desglose con los pesos 40/30/20/10");
      ctx.ok(ctx.$("#rail-title").textContent === "Tu perfil de colaboración", "la columna derecha habla de colaboración");
      ctx.$("#pass-button").click();
      ctx.ok(ctx.$("#company-fit").textContent.startsWith("60%"), `la siguiente startup puntúa 60% (${ctx.$("#company-fit").textContent})`);
      for (const view of ["challenges", "following", "updates", "company", "discover"]) {
        ctx.$(`#main-nav [data-view="${view}"]`).click();
        await ctx.wait(80);
        ctx.ok(ctx.$(`#view-${view}`).classList.contains("active"), `botón ${view} navega`);
      }
      ctx.$('#main-nav [data-view="challenges"]').click();
      await ctx.wait(80);
      ctx.ok(ctx.$$("#challenge-list .update-item").length === 1, "lista los desafíos de la empresa");
      const form = ctx.$("#challenge-form");
      form.elements.title.value = "Digitalizar fichas clínicas";
      form.elements.description.value = "Queremos fichas digitales interoperables entre sedes.";
      form.requestSubmit();
      await ctx.wait(150);
      ctx.ok(ctx.db.company_challenges.length === 2 && ctx.$$("#challenge-list .update-item").length === 2, "publica un desafío nuevo");
      ctx.$('[data-challenge-toggle="ch1"]').click();
      await ctx.wait(150);
      ctx.ok(ctx.db.company_challenges.find((c) => c.id === "ch1").status === "closed" && ctx.$("#company-open-challenges").textContent === "1", `cerrar un desafío actualiza el conteo (db: ${ctx.db.company_challenges.map((c) => c.status)}, panel: ${ctx.$("#company-open-challenges").textContent})`);
      ctx.$('#main-nav [data-view="following"]').click();
      await ctx.wait(150);
      ctx.ok(ctx.$$("#followed-list .match-item").length === 1 && /Finova/.test(ctx.$("#followed-list").textContent), "Seguidos lista las startups seguidas");
      ctx.$('#main-nav [data-view="discover"]').click();
      ctx.$("#like-button").click();
      await ctx.wait(150);
      ctx.ok(ctx.db.interests.some((i) => i.investor_id === "comp1"), "una empresa puede expresar interés");
      await typeSearch(ctx, "cli");
      ctx.$('#search-results [data-kind="company"]').click();
      await ctx.until(() => /Clínica Alameda/.test(ctx.$("#profile-page").textContent) && ctx.$("#profile-page [data-edit-own]"), "perfil de empresa");
      ctx.ok(/Digitalizar fichas/.test(ctx.$("#profile-page").textContent) && !/Reducir esperas en urgencias/.test(ctx.$("#profile-page").textContent), "el perfil de empresa lista solo los desafíos abiertos");
      ctx.ok(ctx.$$("#profile-page [data-upload]").length === 2, "el dueño puede cambiar logo y banner desde su perfil");
    }
  },
  phase2_imagenes: {
    db: baseDb,
    options: { userId: "inv1", rpc: searchRpc },
    async run(ctx) {
      await appReady(ctx);
      ctx.$("#profile-button").click();
      ctx.$('[data-menu-action="profile"]').click();
      await ctx.until(() => ctx.$("#profile-page [data-upload='avatar']"), "perfil propio");
      ctx.ok(/Inversionista ángel en salud/.test(ctx.$("#profile-page").textContent), "el perfil del inversor muestra su titular");
      ctx.ok(/Healthtech/.test(ctx.$("#profile-page").textContent), "el perfil del inversor muestra sus sectores");
      ctx.$("#profile-page [data-upload='avatar']").click();
      ctx.ok(ctx.$("#image-modal").getAttribute("aria-hidden") === "false" && /400×400 · MÁX\. 2 MB/.test(ctx.$("#image-eyebrow").textContent), "el cargador de foto indica 400×400 y 2 MB");
      chooseFile(ctx, new ctx.win.File(["x"], "animado.gif", { type: "image/gif" }));
      ctx.ok(/JPG, PNG o WebP/.test(ctx.$("#image-error").textContent) && ctx.$("#image-save").disabled, "rechaza formatos no permitidos con un mensaje claro");
      chooseFile(ctx, new ctx.win.File([new Uint8Array(3 * 1048576)], "grande.png", { type: "image/png" }));
      ctx.ok(/máximo para una foto es 2 MB/.test(ctx.$("#image-error").textContent) && ctx.$("#image-save").disabled, "rechaza fotos de más de 2 MB");
      chooseFile(ctx, await makePng(ctx, 800, 500));
      await ctx.until(() => !ctx.$("#image-save").disabled, "imagen cargada");
      ctx.ok(ctx.$("#image-error").hidden, "una imagen válida limpia el error");
      ctx.$("#image-zoom").value = "1.5";
      ctx.$("#image-zoom").dispatchEvent(new ctx.win.Event("input", { bubbles: true }));
      ctx.$("#image-save").click();
      await ctx.until(() => ctx.log.some((e) => e.upload), "subida");
      const upload = ctx.log.find((e) => e.upload);
      ctx.ok(upload.upload === "avatars" && upload.path.startsWith("inv1/"), `sube a avatars en la carpeta del usuario (${upload.path})`);
      await ctx.until(() => ctx.db.profiles.find((p) => p.id === "inv1").avatar_url, "url guardada");
      ctx.ok(/^https:\/\/files\.test\/avatars\/inv1\//.test(ctx.db.profiles.find((p) => p.id === "inv1").avatar_url), "guarda la URL pública en profiles.avatar_url");
      ctx.ok(ctx.$(".avatar-user").style.backgroundImage.includes("files.test"), "la foto aparece en la barra lateral");
      await ctx.until(() => ctx.$("#profile-page [data-upload='banner']"), "perfil recargado");
      ctx.$("#profile-page [data-upload='banner']").click();
      ctx.ok(/1584×396 · MÁX\. 5 MB/.test(ctx.$("#image-eyebrow").textContent) && ctx.$("#image-canvas").width === 560 && ctx.$("#image-canvas").height === 140, "el banner es 4:1 (1584×396, 5 MB)");
      chooseFile(ctx, await makePng(ctx, 3000, 900));
      await ctx.until(() => !ctx.$("#image-save").disabled, "banner cargado");
      ctx.$("#image-save").click();
      await ctx.until(() => ctx.log.filter((e) => e.upload).length === 2, "segunda subida");
      ctx.ok(ctx.log.filter((e) => e.upload)[1].upload === "banners", "el banner va al bucket banners");
      await ctx.until(() => ctx.db.profiles.find((p) => p.id === "inv1").banner_url, "banner guardado");
      ctx.ok(true, "banner guardado");
    }
  },
  phase2_video_y_perfil: {
    db: baseDb,
    options: { userId: "inv1", rpc: searchRpc },
    async run(ctx) {
      await appReady(ctx);
      ctx.ok(ctx.visible(ctx.$("#pitch-button")), "Ver pitch aparece cuando la startup tiene video");
      ctx.$("#pitch-button").click();
      ctx.ok(ctx.$("#pitch-frame").getAttribute("src") === "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ", "el modal usa la URL de inserción de YouTube");
      key(ctx, { key: "Escape" });
      ctx.ok(!ctx.$("#pitch-frame").getAttribute("src"), "cerrar el modal detiene el video");
      ctx.$("#info-button").click();
      await ctx.until(() => /Nébula Health/.test(ctx.$("#profile-page").textContent) && ctx.$("#profile-page iframe"), "perfil de startup");
      ctx.ok(ctx.$("#view-profile").classList.contains("active"), "Ver perfil abre la página de perfil completa");
      ctx.ok(ctx.$("#profile-page iframe").getAttribute("src") === "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ", "el reproductor destacado usa solo la URL de inserción");
      ctx.ok(/Buscando financiamiento/.test(ctx.$("#profile-page").textContent) && /Ronda abierta · Seed/.test(ctx.$("#profile-page").textContent), "muestra el estado de financiamiento");
      ctx.ok(/Cerramos un piloto/.test(ctx.$("#profile-page").textContent), "muestra las publicaciones de la startup");
      ctx.ok(!ctx.$("#profile-page [data-edit-own]"), "un inversor no ve 'Editar perfil' en una startup ajena");
      ctx.$("#profile-page [data-profile-interest]").click();
      await ctx.wait(150);
      ctx.ok(ctx.db.interests.some((i) => i.investor_id === "inv1" && i.startup_id === "s1" && i.id !== "i1"), "Me interesa desde el perfil");
      // Un enlace almacenado con otro dominio nunca llega a un iframe.
      ctx.win.document.querySelector("#global-search").focus();
      await typeSearch(ctx, "neb");
      ctx.$('#search-results [data-kind="startup"]').click();
      await ctx.until(() => ctx.$("#profile-page iframe"), "perfil desde la búsqueda");
      ctx.ok(ctx.$$("#profile-page iframe").every((f) => f.src.startsWith("https://www.youtube-nocookie.com/")), "la búsqueda abre el perfil con el mismo reproductor");
    }
  },
  phase2_startup_video: {
    db: baseDb,
    options: { userId: "own1" },
    async run(ctx) {
      await appReady(ctx);
      ctx.$("#edit-startup").click();
      const form = ctx.$("#startup-profile-form");
      ctx.ok(form.elements.pitchVideo.value.includes("youtube.com") && /60–120 segundos/.test(form.textContent), "el campo de video existe, se rellena y trae la guía de 60–120 s");
      form.elements.pitchVideo.value = "https://evil.example.com/v/1";
      form.requestSubmit();
      await ctx.wait(150);
      ctx.ok(/YouTube, Vimeo o Loom/.test(ctx.$("#startup-profile-error").textContent) && !ctx.log.some((e) => e.table === "startup_profiles" && e.op === "update"), "un enlace de otro dominio se rechaza sin guardar");
      form.elements.pitchVideo.value = "https://vimeo.com/123456789";
      form.requestSubmit();
      await ctx.wait(150);
      ctx.ok(ctx.db.startup_profiles.find((s) => s.id === "s1").pitch_video_url === "https://vimeo.com/123456789", "un enlace de Vimeo se guarda");
      ctx.$("#view-own-profile").click();
      await ctx.until(() => ctx.$("#profile-page iframe"), "perfil propio con video");
      ctx.ok(ctx.$("#profile-page iframe").getAttribute("src") === "https://player.vimeo.com/video/123456789", "el perfil propio reproduce el video de Vimeo");
      ctx.ok(ctx.$("#profile-page [data-edit-own]") && ctx.$$("#profile-page [data-upload]").length === 2 && !ctx.$("#profile-page [data-profile-interest]"), "perfil propio: editar y subir imágenes, sin 'Me interesa'");
    }
  },
  // Escenarios shot_* solo dejan la interfaz abierta para tomar capturas (SHOT=carpeta node tests/run.mjs shot_)
  shot_investor: { db: baseDb, options: { userId: "inv1", rpc: searchRpc }, async run(ctx) { await appReady(ctx); ctx.ok(true, "interfaz abierta"); await ctx.wait(400); } },
  shot_perfil: { db: baseDb, options: { userId: "inv1" }, async run(ctx) { await appReady(ctx); ctx.$("#info-button").click(); await ctx.until(() => ctx.$("#profile-page iframe"), "perfil"); ctx.ok(true, "perfil abierto"); await ctx.wait(600); } },
  shot_actualizaciones: { db: () => ({ ...baseDb(), posts: manyPosts() }), options: { userId: "inv1" }, async run(ctx) { await appReady(ctx); ctx.$('#main-nav [data-view="updates"]').click(); await ctx.until(() => ctx.$$("#update-list .update-item").length === 20, "posts"); ctx.ok(true, "actualizaciones"); await ctx.wait(500); } },
  shot_financiamiento: {
    db: () => ({ ...baseDb(), notifications: [] }), options: { userId: "own1" },
    async run(ctx) {
      await appReady(ctx);
      await ctx.until(() => ctx.$("#funding-switch").checked, "interruptor");
      const row = { id: "nx", user_id: "own1", type: "follow", actor_id: "inv1", entity_id: "s1", read_at: null, created_at: new Date().toISOString() };
      ctx.db.notifications.push(row);
      window.__client.__channels[0].handlers[0]({ new: row });
      await ctx.until(() => ctx.$$("#notice-stack .notice-card").length === 1, "aviso");
      ctx.$("#view-startup .funding-panel").scrollIntoView();
      ctx.ok(true, "panel de financiamiento"); await ctx.wait(500);
    }
  },
  shot_empresa: { db: baseDb, options: { userId: "comp1" }, async run(ctx) { await appReady(ctx); ctx.ok(true, "interfaz abierta"); await ctx.wait(400); } },
  shot_startup: { db: baseDb, options: { userId: "own1" }, async run(ctx) { await appReady(ctx); ctx.ok(true, "interfaz abierta"); await ctx.wait(400); } },
  phase1_sectores_inversor: {
    db: baseDb,
    options: { userId: "inv1" },
    async run(ctx) {
      await appReady(ctx);
      ctx.$("#edit-filters").click();
      const options = ctx.$$("#sector-options .preference-option");
      ctx.ok(options.length === 33, `la tesis lista los 33 sectores del catálogo (${options.length})`);
      ctx.ok(ctx.$$("#sector-options .preference-group").length === 7, "sectores agrupados en 7 rubros");
      ctx.ok(options.some((o) => o.textContent === "Space tech"), "el sector agregado en la tabla aparece sin tocar código");
      ctx.ok(ctx.$$("#fund-filter option").some((o) => o.textContent === "Space tech") && ctx.$("#fund-filter option").value === "all", "el filtro de rondas también usa el catálogo");
      ctx.ok(ctx.$$('#startup-profile-form [name="sector"] option').length === 33, "el selector del formulario de startup usa el catálogo");
      const search = ctx.$("#sector-search");
      search.value = "fin";
      search.dispatchEvent(new ctx.win.Event("input", { bubbles: true }));
      ctx.ok(ctx.$$("#sector-options .preference-option:not([hidden])").length === 1 && ctx.$$("#sector-options .preference-group:not([hidden])").length === 1, "el buscador de sectores filtra y oculta rubros vacíos");
      search.value = "";
      search.dispatchEvent(new ctx.win.Event("input", { bubbles: true }));
      const box = (id) => ctx.$(`#sector-options [value="${id}"]`);
      ctx.ok(box("healthtech").checked && box("fintech").checked && !box("space-tech").checked, "casillas marcadas desde profile_sectors");
      box("space-tech").checked = true;
      box("fintech").checked = false;
      ctx.$("#preferences-form").requestSubmit();
      await ctx.wait(150);
      const saved = ctx.db.profile_sectors.filter((r) => r.profile_id === "inv1" && r.kind === "interest").map((r) => r.sector_id).sort().join();
      ctx.ok(saved === "healthtech,space-tech", `profile_sectors actualizado (${saved})`);
      ctx.ok(ctx.db.profile_sectors.some((r) => r.kind === "expertise" && r.sector_id === "healthtech"), "la experiencia del inversor no se toca");
      const update = ctx.log.find((e) => e.table === "investor_preferences" && e.op === "update");
      ctx.ok(update && !("sectors" in update.payload), "investor_preferences ya no recibe sectores");
      ctx.ok(ctx.$("#investor-sector-pills").textContent.includes("Space tech"), "las etiquetas muestran el nombre del sector");
    }
  },
  phase1_startup: {
    db: baseDb,
    options: { userId: "own1" },
    async run(ctx) {
      await appReady(ctx);
      ctx.$("#edit-startup").click();
      const form = ctx.$("#startup-profile-form");
      ctx.ok(form.elements.sector.value === "healthtech", "el sector de la startup se preselecciona por id");
      ctx.ok(!form.elements.isFundraising, "el formulario de perfil ya no esconde la marca de financiamiento");
      form.elements.name.value = "Nébula Health 2";
      form.requestSubmit();
      await ctx.wait(200);
      const update = ctx.log.find((e) => e.table === "startup_profiles" && e.op === "update");
      ctx.ok(update, "se actualizó el perfil");
      const keys = Object.keys(update?.payload || {});
      ctx.ok(!["traction_score", "is_fundraising", "owner_id", "country", "sector"].some((k) => keys.includes(k)) && keys.includes("sector_id"), `la actualización no envía columnas protegidas (${keys.join(",")})`);
      ctx.ok(ctx.db.funding_rounds.find((r) => r.id === "r1").status === "open", "guardar el perfil no toca las rondas");
    }
  },
  phase0_investor: {
    db: baseDb,
    options: { userId: "inv1", rpc: searchRpc },
    async run(ctx) {
      await appReady(ctx);
      const labels = navLabels(ctx);
      ctx.ok(labels.join("|") === "Descubrir|Intereses y matches|Actualizaciones|Rondas abiertas", `menú inversor: ${labels}`);
      for (const [view, title] of [["matches", "Intereses y matches"], ["updates", "Actualizaciones"], ["funds", "Rondas abiertas"], ["discover", "Descubrir"]]) {
        ctx.$(`#main-nav [data-view="${view}"]`).click();
        await ctx.wait(80);
        ctx.ok(ctx.$(`#view-${view}`).classList.contains("active") && ctx.$("#breadcrumb-current").textContent === title, `botón ${view} navega`);
      }
      ctx.ok(ctx.$("#match-count").textContent === "1", `contador de intereses visible (${ctx.$("#match-count").textContent})`);
      ctx.ok(ctx.$("#open-rounds-count").textContent === "2", `rondas abiertas = 2 (${ctx.$("#open-rounds-count").textContent})`);
      ctx.ok(ctx.$("#open-rounds-note").textContent === "En 2 sectores", `nota: ${ctx.$("#open-rounds-note").textContent}`);
      // menú de perfil
      ctx.$("#profile-button").click();
      const items = ctx.$$("#profile-menu [role=menuitem]").map((b) => b.textContent);
      ctx.ok(ctx.visible(ctx.$("#profile-menu")) && items.join("|") === "Ver mi perfil|Mi plan|Configuración|Cerrar sesión", `menú de perfil: ${items}`);
      ctx.ok(!ctx.log.some((e) => e.signOut), "abrir el menú no cierra sesión");
      key(ctx, { key: "Escape" });
      ctx.ok(ctx.$("#profile-menu").hidden, "Escape cierra el menú de perfil");
      // modal + Escape + aria-hidden
      ctx.$("#edit-filters").click();
      ctx.ok(ctx.$("#preferences-modal").getAttribute("aria-hidden") === "false", "modal abierto: aria-hidden=false");
      key(ctx, { key: "Escape" });
      ctx.ok(!ctx.$("#preferences-modal").classList.contains("open") && ctx.$("#preferences-modal").getAttribute("aria-hidden") === "true", "Escape cierra el modal y sincroniza aria-hidden");
      // buscador
      key(ctx, { key: "k", ctrlKey: true });
      ctx.ok(ctx.doc.activeElement === ctx.$("#global-search"), "Ctrl+K enfoca el buscador");
      const input = ctx.$("#global-search");
      input.value = "neb";
      input.dispatchEvent(new ctx.win.Event("input", { bubbles: true }));
      await ctx.until(() => ctx.visible(ctx.$("#search-results")), "resultados");
      const groups = ctx.$$("#search-results .search-group > span").map((e) => e.textContent);
      ctx.ok(groups.join("|") === "Startups|Publicaciones", `grupos de búsqueda: ${groups}`);
      const box = ctx.$(".search-box").getBoundingClientRect();
      const bar = ctx.$(".topbar").getBoundingClientRect();
      ctx.ok(Math.abs((box.left + box.width / 2) - (bar.left + bar.width / 2)) < 140, "buscador centrado en la barra");
      ctx.ok(box.height >= 40 && parseFloat(ctx.win.getComputedStyle(input).fontSize) >= 14, "buscador de 40px y letra de 14px");
      // cerrar sesión desde el menú
      ctx.$("#profile-button").click();
      ctx.$('[data-menu-action="signout"]').click();
      await ctx.wait(50);
      ctx.ok(ctx.log.some((e) => e.signOut), "Cerrar sesión funciona desde el menú");
    }
  },
  phase0_startup: {
    db: baseDb,
    options: { userId: "own1" },
    async run(ctx) {
      await appReady(ctx);
      const labels = navLabels(ctx);
      ctx.ok(labels.join("|") === "Mi startup|Intereses y matches|Actualizaciones|Rondas abiertas", `menú startup: ${labels}`);
      for (const view of ["matches", "updates", "funds", "startup"]) {
        ctx.$(`#main-nav [data-view="${view}"]`).click();
        await ctx.wait(80);
        ctx.ok(ctx.$(`#view-${view}`).classList.contains("active"), `botón ${view} navega`);
      }
      ctx.$('#main-nav [data-view="matches"]').click();
      await ctx.wait(80);
      ctx.ok(ctx.$$("#match-list .request-item").length === 1, "la startup ve la solicitud en Intereses y matches");
      ctx.$('#main-nav [data-view="funds"]').click();
      await ctx.wait(80);
      ctx.ok(ctx.$$("#fund-grid [data-fund-interest]").length === 0, "la startup no ve botones 'Me interesa'");
    }
  }
};
