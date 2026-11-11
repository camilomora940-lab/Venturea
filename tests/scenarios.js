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
const roundRow = (id, startup_id, extra = {}) => ({ id, startup_id, status: "open", stage: "Seed", target_usd: 500000, ticket_min_usd: 25000, ticket_max_usd: 250000, committed_pct: 0, ...extra });
const baseDb = () => ({
  profiles: [
    { id: "inv1", role: "investor", full_name: "Ana Inversora", city: null },
    { id: "own1", role: "startup", full_name: "Beto Fundador", city: null },
    { id: "own2", role: "startup", full_name: "Cata Fundadora", city: null }
  ],
  sectors: SECTOR_ROWS,
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
    startupRow("s1", "own1", "Nébula Health", "healthtech", { is_fundraising: true }),
    startupRow("s2", "own2", "Finova", "fintech", { is_fundraising: true }),
    startupRow("s3", "own3", "Agro Uno", "agrotech")
  ],
  interests: [{ id: "i1", investor_id: "inv1", startup_id: "s1", status: "pending", created_at: "2026-02-01T00:00:00Z" }],
  posts: [{ id: "u1", startup_id: "s1", author_id: "own1", content: "Cerramos un piloto", created_at: "2026-02-01T00:00:00Z" }]
});
const searchRpc = { search_all: async ({ q }) => (q === "neb" ? [
  { kind: "startup", id: "s1", title: "Nébula Health", subtitle: "healthtech · Santiago" },
  { kind: "post", id: "u1", title: "Cerramos un piloto", subtitle: "Nébula Health" }
] : []) };

const key = (ctx, init) => ctx.doc.dispatchEvent(new ctx.win.KeyboardEvent("keydown", { bubbles: true, ...init }));
const navLabels = (ctx) => ctx.$$("#main-nav .nav-link").map((b) => [...b.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join("").trim());
const appReady =(ctx) => ctx.until(() => ctx.visible(ctx.$(".app-shell")) && ctx.$("#profile-button").title === "Menú de cuenta" && ctx.$$("#main-nav .nav-link").length, "app listo");

window.SCENARIOS = {
  // Escenarios shot_* solo dejan la interfaz abierta para tomar capturas (SHOT=carpeta node tests/run.mjs shot_)
  shot_investor: { db: baseDb, options: { userId: "inv1", rpc: searchRpc }, async run(ctx) { await appReady(ctx); ctx.ok(true, "interfaz abierta"); await ctx.wait(400); } },
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
      ctx.ok(form.elements.isFundraising.checked, "la marca de financiamiento refleja la ronda abierta");
      form.elements.isFundraising.checked = false;
      form.elements.name.value = "Nébula Health 2";
      form.requestSubmit();
      await ctx.wait(200);
      const update = ctx.log.find((e) => e.table === "startup_profiles" && e.op === "update");
      ctx.ok(update, "se actualizó el perfil");
      const keys = Object.keys(update?.payload || {});
      ctx.ok(!["traction_score", "is_fundraising", "owner_id", "country", "sector"].some((k) => keys.includes(k)) && keys.includes("sector_id"), `la actualización no envía columnas protegidas (${keys.join(",")})`);
      ctx.ok(ctx.db.funding_rounds.find((r) => r.id === "r1").status === "paused", "desmarcar pausa la ronda abierta (el historial se conserva)");
      ctx.$("#edit-startup").click();
      ctx.$("#startup-profile-form").elements.isFundraising.checked = true;
      ctx.$("#startup-profile-form").requestSubmit();
      await ctx.wait(200);
      const open = ctx.db.funding_rounds.filter((r) => r.startup_id === "s1" && r.status === "open");
      ctx.ok(open.length === 1 && ctx.db.funding_rounds.filter((r) => r.startup_id === "s1").length === 2, "marcar de nuevo abre una ronda nueva");
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
