// Escenarios de interfaz. Cada uno define datos falsos (db) y una función run(ctx) con afirmaciones ctx.ok(cond, texto).
const startupRow = (id, owner, name, sector, extra = {}) => ({
  id, owner_id: owner, name, city: "Santiago", country: "Chile", sector, description: `${name} construye algo muy útil para Chile.`, stage: "Seed",
  target_amount_usd: 500000, preferred_check_min_usd: 25000, preferred_check_max_usd: 250000, business_model: "B2B", traction_score: 0.5,
  desired_investor_types: ["Angel", "VC"], desired_stages: ["Seed"], is_fundraising: false, is_published: true, created_at: "2026-01-01T00:00:00Z", ...extra
});
const baseDb = () => ({
  profiles: [
    { id: "inv1", role: "investor", full_name: "Ana Inversora", city: null },
    { id: "own1", role: "startup", full_name: "Beto Fundador", city: null },
    { id: "own2", role: "startup", full_name: "Cata Fundadora", city: null }
  ],
  investor_preferences: [{
    user_id: "inv1", sectors: ["healthtech", "fintech"], stages: ["Seed"], min_ticket_usd: 25000, max_ticket_usd: 250000, investor_type: "Angel",
    markets: ["Chile"], preferred_models: ["B2B"], sector_expertise: ["healthtech"]
  }],
  startup_profiles: [
    startupRow("s1", "own1", "Nébula Health", "healthtech", { is_fundraising: true }),
    startupRow("s2", "own2", "Finova", "fintech", { is_fundraising: true }),
    startupRow("s3", "own3", "Agro Uno", "agrotech")
  ],
  interests: [{ id: "i1", investor_id: "inv1", startup_id: "s1", status: "pending", created_at: "2026-02-01T00:00:00Z" }],
  startup_updates: [{ id: "u1", startup_id: "s1", author_id: "own1", content: "Cerramos un piloto", created_at: "2026-02-01T00:00:00Z" }]
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
