window.initializeSupabaseApp = function initializeSupabaseApp() {
  const config = window.VENTUREA_CONFIG;
  const authScreen = document.querySelector("#auth-screen");
  const appShell = document.querySelector(".app-shell");
  const authForm = document.querySelector("#auth-form");
  const authError = document.querySelector("#auth-error");
  const supabaseSdk = window.supabase?.createClient;
  let supabaseClient;
  let user;
  let profile;
  let startupProfile;
  let investorPreferences;
  let workspaceUserId = null;
  let workspaceController;
  let startups = [];
  let rankedStartups = [];
  let selectedIndex = 0;
  let authMode = "signup";
  let busy = false;

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[char]));
  const money = (value) => `USD ${Number(value || 0).toLocaleString("en-US")}`;
  const setError = (element, message) => {
    element.textContent = message;
    element.hidden = !message;
  };
  const notify = (message) => {
    const toast = $("#toast");
    toast.textContent = message;
    toast.classList.add("visible");
    window.clearTimeout(notify.timer);
    notify.timer = window.setTimeout(() => toast.classList.remove("visible"), 3500);
  };
  const showAuth = (message = "") => {
    authScreen.hidden = false;
    appShell.hidden = true;
    setError(authError, message);
  };
  const hideAuth = () => {
    authScreen.hidden = true;
    appShell.hidden = false;
    appShell.classList.add("authenticated");
  };
  const setText = (selector, value) => {
    const element = $(selector);
    if (element) element.textContent = String(value);
  };
  const setModal = (modal, open) => {
    modal.classList.toggle("open", open);
    modal.setAttribute("aria-hidden", String(!open));
  };
  const MENUS = {
    investor: [["discover", "◈", "Descubrir", "discover-count"], ["matches", "♡", "Intereses y matches", "match-count"], ["updates", "◷", "Actualizaciones"], ["funds", "↗", "Rondas abiertas"]],
    startup: [["startup", "⌂", "Mi startup"], ["matches", "♡", "Intereses y matches", "match-count"], ["updates", "◷", "Actualizaciones"], ["funds", "↗", "Rondas abiertas"]]
  };
  const VIEW_TITLES = { discover: "Descubrir", matches: "Intereses y matches", updates: "Actualizaciones", funds: "Rondas abiertas", startup: "Mi startup" };
  const ROLE_LABELS = { investor: "Inversor/a", startup: "Startup chilena" };
  const reportFailure = (action, error) => {
    console.error(`${action}:`, error);
    notify(`${action}. ${error.message || "Intenta nuevamente."}`);
  };

  if (!supabaseSdk) {
    showAuth("No se pudo cargar el cliente de Supabase. Comprueba tu conexión e inténtalo de nuevo.");
    return;
  }
  try {
    supabaseClient = supabaseSdk(config.supabaseUrl, config.supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
  } catch (error) {
    console.error("La configuración de Supabase no es válida:", error);
    showAuth("La URL o la clave pública de Supabase no son válidas. Revísalas en supabase-config.js.");
    return;
  }

  function setAuthMode(mode) {
    authMode = mode;
    const signingUp = mode === "signup";
    $("#auth-title").innerHTML = signingUp
      ? 'Conecta innovación con capital<span class="heading-period">.</span>'
      : 'Qué bueno verte de nuevo<span class="heading-period">.</span>';
    $("#auth-copy").textContent = signingUp
      ? "Crea tu cuenta gratuita para descubrir startups chilenas, publicar tu proyecto y conectar con inversores."
      : "Ingresa para continuar con tus perfiles, intereses y conexiones.";
    $("#auth-name-label").hidden = !signingUp;
    $("#auth-role-label").hidden = !signingUp;
    $("#auth-consent-label").hidden = !signingUp;
    authForm.elements.fullName.required = signingUp;
    authForm.elements.consent.required = signingUp;
    authForm.elements.password.autocomplete = signingUp ? "new-password" : "current-password";
    $("#auth-submit").textContent = signingUp ? "Crear cuenta gratis" : "Iniciar sesión";
    $("#auth-switch-copy").textContent = signingUp ? "¿Ya tienes cuenta?" : "¿Primera vez en Venturea?";
    $("#auth-mode-toggle").textContent = signingUp ? "Iniciar sesión" : "Crear cuenta gratis";
    setError(authError, "");
  }

  async function loadProfile(authUser) {
    const { data, error } = await supabaseClient
      .from("profiles")
      .select("id, role, full_name, city")
      .eq("id", authUser.id)
      .single();
    if (error) throw new Error(`No encontramos tu perfil. Ejecuta el esquema SQL de configuración. ${error.message}`);
    return data;
  }

  async function loadInvestorPreferences() {
    const { data, error } = await supabaseClient
      .from("investor_preferences")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("No se encontraron tus preferencias de inversión. Ejecuta el esquema SQL y vuelve a iniciar sesión.");
    investorPreferences = data;
  }

  function updateAccountLabels() {
    const initials = profile.full_name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
    $(".profile-copy strong").textContent = profile.full_name;
    $(".profile-copy small").textContent = ROLE_LABELS[profile.role];
    $(".avatar-user").textContent = initials;
    $(".top-avatar").textContent = initials;
    $("#profile-button").title = "Menú de cuenta";
    $("#profile-button").setAttribute("aria-label", "Abrir menú de cuenta");
  }

  // Cada rol recibe su propio menú; el modo demo (app.js) conserva el HTML estático.
  function setRoleNavigation() {
    $$("[data-demo-only]").forEach((item) => { item.hidden = true; });
    $(".workspace-label").textContent = profile.role === "investor" ? "ESPACIO DE INVERSIÓN" : "ESPACIO DE STARTUP";
    $("#notification-button .notification-dot").hidden = true;
    $("#main-nav").innerHTML = MENUS[profile.role].map(([view, icon, label, countId]) =>
      `<button class="nav-link" data-view="${view}"><span class="nav-icon">${icon}</span>${label}${countId ? `<span class="nav-count" id="${countId}">0</span>` : ""}</button>`
    ).join("");
  }

  function ticketFit(startup) {
    const minimum = Number(investorPreferences.min_ticket_usd);
    const maximum = Number(investorPreferences.max_ticket_usd);
    if (minimum === maximum) {
      return minimum >= startup.preferred_check_min_usd && minimum <= startup.preferred_check_max_usd ? 1 : 0;
    }
    const overlap = Math.max(0, Math.min(maximum, startup.preferred_check_max_usd) - Math.max(minimum, startup.preferred_check_min_usd));
    const range = startup.preferred_check_max_usd - startup.preferred_check_min_usd;
    return range > 0 ? Math.min(1, overlap / range) : 0;
  }

  function assess(startup) {
    const sectorFit = investorPreferences.sectors.includes(startup.sector) ? 1 : 0;
    const stageFit = investorPreferences.stages.includes(startup.stage) ? 1 : 0;
    const checkFit = ticketFit(startup);
    const marketFit = investorPreferences.markets.includes(startup.country) ? 1 : 0;
    const modelFit = investorPreferences.preferred_models.includes(startup.business_model) ? 1 : 0;
    const tractionFit = Math.min(1, Number(startup.traction_score) / 0.3);
    const investorScore = Math.round(100 * (
      sectorFit * 0.25 + stageFit * 0.2 + checkFit * 0.2 +
      marketFit * 0.15 + modelFit * 0.1 + tractionFit * 0.1
    ));
    const startupScore = Math.round(100 * (
      (startup.desired_investor_types.includes(investorPreferences.investor_type) ? 0.25 : 0) +
      checkFit * 0.25 +
      (investorPreferences.sector_expertise.includes(startup.sector) ? 0.25 : 0) +
      (investorPreferences.markets.includes(startup.country) ? 0.15 : 0) +
      (startup.desired_stages.some((stage) => investorPreferences.stages.includes(stage)) ? 0.1 : 0)
    ));
    return {
      investorScore,
      startupScore,
      combinedScore: Math.round(Math.sqrt(investorScore * startupScore))
    };
  }

  function passesFilters(startup) {
    return investorPreferences.sectors.includes(startup.sector) &&
      investorPreferences.stages.includes(startup.stage) &&
      ticketFit(startup) > 0 &&
      investorPreferences.markets.includes(startup.country) &&
      startup.desired_investor_types.includes(investorPreferences.investor_type) &&
      startup.desired_stages.some((stage) => investorPreferences.stages.includes(stage));
  }

  function orderCandidates(candidates) {
    const sorted = candidates.sort((a, b) => b.assessment.combinedScore - a.assessment.combinedScore);
    const buckets = new Map();
    sorted.forEach((startup) => {
      const bucket = buckets.get(startup.sector) || [];
      bucket.push(startup);
      buckets.set(startup.sector, bucket);
    });
    const diversified = [];
    while (buckets.size) {
      for (const [sector, bucket] of buckets) {
        diversified.push(bucket.shift());
        if (!bucket.length) buckets.delete(sector);
      }
    }
    return diversified;
  }

  async function loadStartups() {
    const { data, error } = await supabaseClient
      .from("startup_profiles")
      .select("*")
      .eq("is_published", true)
      .order("created_at", { ascending: false });
    if (error) throw error;
    startups = data || [];
    const openRounds = startups.filter((startup) => startup.is_fundraising);
    setText("#startup-count", startups.length);
    setText("#discover-count", startups.length);
    setText("#open-rounds-count", openRounds.length);
    setText("#open-rounds-note", `En ${new Set(openRounds.map((startup) => startup.sector)).size} sectores`);
    const owners = [...new Set(startups.map((startup) => startup.owner_id))];
    if (owners.length) {
      const { data: ownerProfiles, error: ownersError } = await supabaseClient
        .from("profiles").select("id, full_name").in("id", owners);
      if (ownersError) throw ownersError;
      const names = new Map(ownerProfiles.map((owner) => [owner.id, owner.full_name]));
      startups = startups.map((startup) => ({ ...startup, founder_name: names.get(startup.owner_id) || "Equipo fundador" }));
    }
    rankedStartups = profile.role === "investor"
      ? orderCandidates(startups.filter(passesFilters).map((startup) => ({ ...startup, assessment: assess(startup) })))
      : [];
    $("#stat-matches").textContent = String(rankedStartups.length).padStart(2, "0");
    $("#investor-compatible-count").textContent = `${rankedStartups.length} startups compatibles`;
  }

  function renderRemoteCard() {
    const startup = rankedStartups[selectedIndex];
    const card = $("#startup-card");
    const empty = $("#no-compatible-startups");
    if (!startup) {
      card.hidden = true;
      empty.hidden = false;
      $("#card-number").textContent = "00 / 00";
      return;
    }
    card.hidden = false;
    empty.hidden = true;
    $("#card-number").textContent = `${String(selectedIndex + 1).padStart(2, "0")} / ${String(rankedStartups.length).padStart(2, "0")}`;
    $("#card-cover").className = `startup-cover ${startup.sector === "Climate tech" ? "cover-climate" : startup.sector === "Fintech" ? "cover-fintech" : startup.sector === "SaaS" ? "cover-saas" : startup.sector === "Inteligencia artificial" ? "cover-ai" : ""}`;
    $("#company-logo").textContent = startup.name.slice(0, 1).toUpperCase();
    $("#company-name").textContent = startup.name;
    $("#company-location").textContent = `${startup.city}, Chile`;
    $("#company-description").textContent = startup.description;
    $("#company-round").textContent = `${startup.stage} · ${money(startup.target_amount_usd)}`;
    $("#company-traction").textContent = `${Math.round(Number(startup.traction_score) * 100)}% tracción reportada`;
    $("#company-fit").innerHTML = `${startup.assessment.combinedScore}% <span>✦</span>`;
    $("#score-breakdown").textContent = `Tu encaje ${startup.assessment.investorScore}% · Encaje con lo que busca la startup ${startup.assessment.startupScore}%`;
    $("#score-reasons").innerHTML = [
      `Sector ${escapeHtml(startup.sector)}`,
      `Etapa ${escapeHtml(startup.stage)}`,
      `Ticket ${escapeHtml(money(investorPreferences.min_ticket_usd))}–${escapeHtml(money(investorPreferences.max_ticket_usd))}`,
      "Chile"
    ].map((reason) => `<span>${reason}</span>`).join("");
    $("#founder-name").textContent = startup.founder_name;
    $("#founder-avatar").textContent = startup.founder_name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
    $("#company-tags").innerHTML = [startup.sector, startup.business_model, startup.stage].map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("");
    $("#bookmark-button").hidden = true;
  }

  async function loadInterests() {
    const { data, error } = await supabaseClient
      .from("interests")
      .select("*")
      .eq("investor_id", user.id)
      .order("created_at", { ascending: false });
    if (error) throw error;
    const interests = data || [];
    setText("#match-count", interests.filter((interest) => interest.status === "pending").length);
    if (!interests.length) {
      $("#match-list").innerHTML = '<div class="empty-state"><span>♡</span><h3>Tu próximo match empieza aquí</h3><p>Expresa interés en una startup chilena. El match se crea cuando ambos aceptan.</p><button class="primary-button" data-open-view="discover">Descubrir startups</button></div>';
      return;
    }
    const startupIds = [...new Set(interests.map((interest) => interest.startup_id))];
    const { data: linkedStartups, error: startupError } = await supabaseClient
      .from("startup_profiles").select("id, name, city, sector, stage").in("id", startupIds);
    if (startupError) throw startupError;
    const lookup = new Map(linkedStartups.map((startup) => [startup.id, startup]));
    $("#match-list").innerHTML = interests.map((interest) => {
      const startup = lookup.get(interest.startup_id);
      if (!startup) return "";
      const matched = interest.status === "matched";
      const rejected = interest.status === "rejected";
      return `<article class="match-item"><span class="match-logo">${escapeHtml(startup.name.slice(0, 1))}</span><div class="match-item-info"><strong>${escapeHtml(startup.name)}</strong><small>${matched ? "Match mutuo" : rejected ? "No aceptado" : "Interés enviado · Esperando respuesta"} · ${escapeHtml(startup.sector)} · ${escapeHtml(startup.city)}, Chile</small></div>${matched ? '<span class="interest-pending">Match mutuo</span>' : ""}</article>`;
    }).join("");
  }

  async function loadRequests() {
    // La startup ve las solicitudes en su panel y en "Intereses y matches".
    const show = (html) => $$("#startup-requests, #match-list").forEach((element) => { element.innerHTML = html; });
    if (!startupProfile) {
      show("");
      return;
    }
    const { data, error } = await supabaseClient
      .from("interests").select("*").eq("startup_id", startupProfile.id).order("created_at", { ascending: false });
    if (error) throw error;
    const requests = data || [];
    const pending = requests.filter((request) => request.status === "pending").length;
    setText("#interested-count", pending);
    setText("#match-count", pending);
    if (!requests.length) {
      show('<div class="empty-state"><span>♡</span><h3>Aún no hay intereses</h3><p>Cuando un inversor compatible te envíe interés, aparecerá aquí.</p></div>');
      return;
    }
    const ids = [...new Set(requests.map((request) => request.investor_id))];
    const { data: investors, error: profilesError } = await supabaseClient.from("profiles").select("id, full_name").in("id", ids);
    if (profilesError) throw profilesError;
    const names = new Map(investors.map((investor) => [investor.id, investor.full_name]));
    show(requests.map((request) => `<article class="request-item"><div><strong>${escapeHtml(names.get(request.investor_id) || "Inversor/a")}</strong><small>${request.status === "matched" ? "Match mutuo" : request.status === "rejected" ? "No aceptado" : "Quiere conocer tu startup"}</small></div>${request.status === "pending" ? `<button data-respond="${request.id}" data-status="matched">Aceptar match</button><button data-respond="${request.id}" data-status="rejected">Ahora no</button>` : ""}</article>`).join(""));
  }

  async function loadUpdates() {
    const { data, error } = await supabaseClient
      .from("startup_updates").select("*").order("created_at", { ascending: false }).limit(50);
    if (error) throw error;
    const posts = data || [];
    if (!posts.length) {
      $("#update-list").innerHTML = '<div class="empty-state"><span>◷</span><h3>Sin actualizaciones todavía</h3><p>Las novedades de startups chilenas aparecerán aquí.</p></div>';
      return;
    }
    const ids = [...new Set(posts.map((post) => post.startup_id))];
    const { data: companies, error: companiesError } = await supabaseClient.from("startup_profiles").select("id, name, sector").in("id", ids);
    if (companiesError) throw companiesError;
    const lookup = new Map(companies.map((company) => [company.id, company]));
    const renderedPosts = posts.map((post) => {
      const company = lookup.get(post.startup_id);
      if (!company) return "";
      return `<article class="update-item"><span class="update-logo">${escapeHtml(company.name.slice(0, 1))}</span><div class="update-copy"><strong>${escapeHtml(company.name)} <span class="tag">${escapeHtml(company.sector)}</span></strong><small>${new Date(post.created_at).toLocaleString("es-CL")}</small><p>${escapeHtml(post.content)}</p></div></article>`;
    }).join("");
    $("#update-list").innerHTML = renderedPosts;
    if (profile.role === "startup" && startupProfile) {
      $("#founder-updates").innerHTML = posts.filter((post) => post.startup_id === startupProfile.id).map((post) => `<article class="founder-update-card"><strong>Actualización para inversores</strong><small>${new Date(post.created_at).toLocaleString("es-CL")}</small><p>${escapeHtml(post.content)}</p></article>`).join("");
    }
  }

  function renderRemoteFunds() {
    const sector = $("#fund-filter").value;
    const stage = $("#stage-filter").value;
    const filtered = startups.filter((startup) => startup.is_fundraising && (sector === "all" || startup.sector === sector) && (stage === "all" || startup.stage === stage));
    $("#fund-opportunity-count").textContent = String(filtered.length);
    $("#fund-grid").innerHTML = filtered.length ? filtered.map((startup) => `<article class="fund-card"><div class="fund-card-top"><span class="fund-card-logo">${escapeHtml(startup.name.slice(0, 1))}</span><span class="fund-stage">${escapeHtml(startup.stage)}</span></div><h3>${escapeHtml(startup.name)}</h3><span class="fund-sector">${escapeHtml(startup.sector)} · ${escapeHtml(startup.city)}, Chile</span><p>${escapeHtml(startup.description)}</p><div class="fund-progress-row"><span>Objetivo de ronda</span><strong>${escapeHtml(money(startup.target_amount_usd))}</strong></div><div class="fund-progress-row"><span>Ticket buscado</span><strong>${escapeHtml(money(startup.preferred_check_min_usd))}–${escapeHtml(money(startup.preferred_check_max_usd))}</strong></div><div class="fund-card-footer"><span>Ubicación declarada</span>${profile.role === "investor" ? `<button data-fund-interest="${startup.id}">Me interesa →</button>` : ""}</div></article>`).join("") : '<div class="no-results">Aún no hay rondas publicadas con estos filtros.</div>';
  }

  function fillStartupProfileForm() {
    const form = $("#startup-profile-form");
    if (!startupProfile) return;
    for (const [field, key] of Object.entries({
      name: "name", city: "city", sector: "sector", stage: "stage", target: "target_amount_usd",
      checkMin: "preferred_check_min_usd", checkMax: "preferred_check_max_usd",
      description: "description", businessModel: "business_model", isFundraising: "is_fundraising"
    })) {
      if (startupProfile[key] !== undefined) {
        if (form.elements[field].type === "checkbox") form.elements[field].checked = startupProfile[key];
        else form.elements[field].value = startupProfile[key];
      }
    }
  }

  function renderStartupDashboard() {
    if (!startupProfile) {
      setModal($("#startup-profile-modal"), true);
      return;
    }
    setModal($("#startup-profile-modal"), false);
    $(".dashboard-company-logo").textContent = startupProfile.name.slice(0, 1).toUpperCase();
    $(".dashboard-company-info h2").textContent = startupProfile.name;
    $(".dashboard-company-info > p").textContent = `${startupProfile.description} · ${startupProfile.city}, Chile`;
    $(".dashboard-company-info .tag-row").innerHTML = [startupProfile.sector, startupProfile.business_model, startupProfile.stage].map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("");
    $("#round-status").textContent = startupProfile.is_fundraising ? "Ronda abierta" : "Perfil publicado";
    $("#startup-profile-form").elements.name.value = startupProfile.name;
    $("#startup-profile-form").elements.city.value = startupProfile.city;
    fillStartupProfileForm();
    loadRequests().catch((error) => reportFailure("No pudimos cargar las solicitudes de interés", error));
  }

  async function loadWorkspace() {
    if (workspaceUserId === user.id) return;
    workspaceUserId = user.id;
    workspaceController?.abort();
    workspaceController = new AbortController();
    const { signal } = workspaceController;
    try {
    profile = await loadProfile(user);
    startupProfile = null;
    updateAccountLabels();
    setRoleNavigation();
    hideAuth();
    $$(".view").forEach((view) => view.classList.remove("active"));
    $("#main-nav").addEventListener("click", (event) => {
      const link = event.target.closest("[data-view]");
      if (link) switchRemoteView(link.dataset.view);
    }, { signal });
    $("#notification-button").addEventListener("click", () => switchRemoteView("updates"), { signal });
    $("#profile-button").addEventListener("click", toggleProfileMenu, { signal });
    $("#profile-menu").addEventListener("click", handleProfileMenu, { signal });
    $(".top-avatar").addEventListener("click", () => openOwnProfile(), { signal });
    $("#search-kbd").textContent = /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘ K" : "Ctrl K";
    $("#global-search").addEventListener("input", scheduleSearch, { signal });
    $("#global-search").addEventListener("focus", scheduleSearch, { signal });
    $("#search-results").addEventListener("click", openSearchResult, { signal });
    document.addEventListener("keydown", handleGlobalKeys, { signal });
    document.addEventListener("click", closePopovers, { signal });
    if (profile.role === "investor") {
      selectedIndex = 0;
      await loadInvestorPreferences();
      await loadStartups();
      renderRemoteCard();
      $("#investor-sector-pills").innerHTML = investorPreferences.sectors.map((sector) => `<span>${escapeHtml(sector)}</span>`).join("") || "<span>Sin sectores</span>";
      $("#investor-stage-value").textContent = investorPreferences.stages.join(" · ") || "Sin etapas";
      $("#investor-ticket-value").textContent = `${money(investorPreferences.min_ticket_usd)} – ${money(investorPreferences.max_ticket_usd)}`;
      await loadInterests();
      switchRemoteView("discover");
      $("#open-fund-modal").hidden = true;
      $("#edit-filters").addEventListener("click", openPreferences, { signal });
      $("#empty-edit-filters").addEventListener("click", openPreferences, { signal });
      $("#preferences-form").addEventListener("submit", savePreferences, { signal });
      $("#like-button").addEventListener("click", sendInterest, { signal });
      $("#pass-button").addEventListener("click", nextStartup, { signal });
      $("#bookmark-button").hidden = true;
      $("#info-button").addEventListener("click", () => notify("El perfil completo se abrirá pronto."), { signal });
    } else {
      const { data, error } = await supabaseClient.from("startup_profiles").select("*").eq("owner_id", user.id).maybeSingle();
      if (error) throw error;
      startupProfile = data;
      switchRemoteView("startup");
      $("#open-fund-modal").addEventListener("click", openStartupEditor, { signal });
      $("#startup-create-fund").addEventListener("click", openStartupEditor, { signal });
      $("#edit-startup").addEventListener("click", openStartupEditor, { signal });
      $("#startup-profile-form").addEventListener("submit", saveStartupProfile, { signal });
      $("#publish-update").addEventListener("click", publishUpdate, { signal });
      await loadStartups();
    }
    $("#fund-filter").addEventListener("change", renderRemoteFunds, { signal });
    $("#stage-filter").addEventListener("change", renderRemoteFunds, { signal });
    document.addEventListener("click", handleRemoteClick, { signal });
    } catch (error) {
      workspaceUserId = null;
      throw error;
    }
  }

  function toggleProfileMenu(event) {
    event?.stopPropagation();
    const menu = $("#profile-menu");
    menu.hidden = !menu.hidden;
    $("#profile-button").setAttribute("aria-expanded", String(!menu.hidden));
    if (!menu.hidden) $("[role='menuitem']", menu).focus();
  }

  function closePopovers(event) {
    if (!event.target.closest(".profile-wrap")) {
      $("#profile-menu").hidden = true;
      $("#profile-button").setAttribute("aria-expanded", "false");
    }
    if (!event.target.closest(".search-wrap")) $("#search-results").hidden = true;
  }

  function openOwnProfile() {
    if (profile.role === "startup") switchRemoteView("startup");
    else openPreferences();
  }

  function handleProfileMenu(event) {
    const action = event.target.closest("[data-menu-action]")?.dataset.menuAction;
    if (!action) return;
    $("#profile-menu").hidden = true;
    $("#profile-button").setAttribute("aria-expanded", "false");
    if (action === "profile") openOwnProfile();
    if (action === "settings") profile.role === "startup" ? openStartupEditor() : openPreferences();
    if (action === "plan") notify("Estás en el plan Free: perfil, descubrimiento y conexiones incluidos.");
    if (action === "signout") signOut();
  }

  // Escape cierra menú, resultados y el modal abierto (salvo el perfil obligatorio de una startup nueva).
  function handleGlobalKeys(event) {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      $("#global-search").focus();
      $("#global-search").select();
      return;
    }
    if (event.key !== "Escape") return;
    $("#profile-menu").hidden = true;
    $("#profile-button").setAttribute("aria-expanded", "false");
    $("#search-results").hidden = true;
    $$(".modal-backdrop.open").forEach((modal) => {
      if (modal.id !== "startup-profile-modal" || startupProfile) setModal(modal, false);
    });
  }

  const SEARCH_GROUPS = [["startup", "Startups"], ["investor", "Inversionistas"], ["company", "Empresas"], ["post", "Publicaciones"]];
  let searchTimer;
  function scheduleSearch() {
    window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(runSearch, 250);
  }

  async function runSearch() {
    const query = $("#global-search").value.trim();
    const box = $("#search-results");
    if (query.length < 2) {
      box.hidden = true;
      return;
    }
    const { data, error } = await supabaseClient.rpc("search_all", { q: query });
    if (query !== $("#global-search").value.trim()) return; // llegó tarde: el usuario ya escribió otra cosa
    if (error) return reportFailure("No pudimos buscar", error);
    box.innerHTML = SEARCH_GROUPS.map(([kind, label]) => {
      const rows = data.filter((row) => row.kind === kind);
      return rows.length ? `<div class="search-group" role="group" aria-label="${label}"><span>${label}</span>${rows.map((row) => `<button role="option" data-kind="${kind}" data-id="${escapeHtml(row.id)}"><strong>${escapeHtml(row.title)}</strong><small>${escapeHtml(row.subtitle)}</small></button>`).join("")}</div>` : "";
    }).join("") || '<p class="search-empty">Sin resultados para esa búsqueda.</p>';
    box.hidden = false;
  }

  function openSearchResult(event) {
    const result = event.target.closest("[data-kind]");
    if (!result) return;
    $("#search-results").hidden = true;
    const { kind, id } = result.dataset;
    if (kind === "post") return switchRemoteView("updates");
    if (kind === "startup") {
      const found = rankedStartups.findIndex((startup) => startup.id === id);
      if (found < 0) return notify("Esa startup no está entre tus candidatas compatibles.");
      selectedIndex = found;
      renderRemoteCard();
      return switchRemoteView("discover");
    }
    notify("El perfil completo se abrirá pronto.");
  }

  async function signOut() {
    const { error } = await supabaseClient.auth.signOut();
    if (error) reportFailure("No pudimos cerrar la sesión", error);
    else {
      user = null;
      profile = null;
      workspaceUserId = null;
      workspaceController?.abort();
      appShell.hidden = true;
      showAuth();
    }
  }

  function switchRemoteView(name) {
    const target = $(`#view-${name}`);
    if (!target || !MENUS[profile.role].some(([view]) => view === name)) return;
    $$(".view").forEach((view) => view.classList.toggle("active", view === target));
    $$(".nav-link[data-view]").forEach((link) => link.classList.toggle("active", link.dataset.view === name));
    $("#breadcrumb-current").textContent = VIEW_TITLES[name];
    if (name === "matches") (profile.role === "investor" ? loadInterests() : loadRequests()).catch((error) => reportFailure("No pudimos cargar tus conexiones", error));
    if (name === "updates") loadUpdates().catch((error) => reportFailure("No pudimos cargar las actualizaciones", error));
    if (name === "funds") renderRemoteFunds();
    if (name === "startup") renderStartupDashboard();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function sendInterest() {
    const startup = rankedStartups[selectedIndex];
    if (!startup) return;
    const { error } = await supabaseClient.from("interests").insert({ investor_id: user.id, startup_id: startup.id });
    if (error?.code === "23505") {
      notify("Ya enviaste interés por esta startup.");
      return;
    }
    if (error) {
      reportFailure("No pudimos enviar tu interés", error);
      return;
    }
    notify(`Interés enviado a ${startup.name}. El equipo fundador podrá responderlo.`);
    await loadInterests();
    nextStartup();
  }

  function nextStartup() {
    if (rankedStartups.length) selectedIndex = (selectedIndex + 1) % rankedStartups.length;
    renderRemoteCard();
  }

  function openPreferences() {
    const sectors = ["Healthtech", "Climate tech", "Fintech", "SaaS", "Inteligencia artificial"];
    const stages = ["Pre-seed", "Seed", "Serie A"];
    $("#sector-options").innerHTML = sectors.map((sector) => `<label class="preference-option"><input type="checkbox" name="sector" value="${sector}" ${investorPreferences.sectors.includes(sector) ? "checked" : ""}>${sector}</label>`).join("");
    $("#stage-options").innerHTML = stages.map((stage) => `<label class="preference-option"><input type="checkbox" name="stage" value="${stage}" ${investorPreferences.stages.includes(stage) ? "checked" : ""}>${stage}</label>`).join("");
    $("#preferences-form").elements.minTicket.value = investorPreferences.min_ticket_usd;
    $("#preferences-form").elements.maxTicket.value = investorPreferences.max_ticket_usd;
    setModal($("#preferences-modal"), true);
  }

  async function savePreferences(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const sectors = [...form.querySelectorAll("[name='sector']:checked")].map((input) => input.value);
    const stages = [...form.querySelectorAll("[name='stage']:checked")].map((input) => input.value);
    const minTicket = Number(form.elements.minTicket.value);
    const maxTicket = Number(form.elements.maxTicket.value);
    if (!sectors.length || !stages.length || minTicket <= 0 || maxTicket < minTicket) {
      notify("Selecciona al menos un sector y una etapa, y revisa el rango del ticket.");
      return;
    }
    const updated = {
      sectors,
      stages,
      min_ticket_usd: minTicket,
      max_ticket_usd: maxTicket
    };
    const { data, error } = await supabaseClient.from("investor_preferences").update(updated).eq("user_id", user.id).select().single();
    if (error) {
      reportFailure("No pudimos guardar tu tesis", error);
      return;
    }
    investorPreferences = data;
    selectedIndex = 0;
    await loadStartups();
    renderRemoteCard();
    $("#investor-sector-pills").innerHTML = sectors.map((sector) => `<span>${escapeHtml(sector)}</span>`).join("");
    $("#investor-stage-value").textContent = stages.join(" · ");
    $("#investor-ticket-value").textContent = `${money(minTicket)} – ${money(maxTicket)}`;
    setModal($("#preferences-modal"), false);
    notify("Tesis actualizada. Las startups se recalcularon.");
  }

  function openStartupEditor() {
    fillStartupProfileForm();
    setError($("#startup-profile-error"), "");
    setModal($("#startup-profile-modal"), true);
  }

  async function saveStartupProfile(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = {
      owner_id: user.id,
      name: form.elements.name.value.trim(),
      city: form.elements.city.value.trim(),
      country: "Chile",
      sector: form.elements.sector.value,
      description: form.elements.description.value.trim(),
      stage: form.elements.stage.value,
      target_amount_usd: Number(form.elements.target.value),
      preferred_check_min_usd: Number(form.elements.checkMin.value),
      preferred_check_max_usd: Number(form.elements.checkMax.value),
      business_model: form.elements.businessModel.value,
      traction_score: startupProfile?.traction_score ?? 0,
      desired_investor_types: startupProfile?.desired_investor_types || ["Angel", "VC"],
      desired_stages: startupProfile?.desired_stages || [form.elements.stage.value],
      is_fundraising: form.elements.isFundraising.checked,
      is_published: true
    };
    if (values.description.length < 20 || values.description.length > 1000) {
      setError($("#startup-profile-error"), "La descripción debe tener entre 20 y 1.000 caracteres.");
      return;
    }
    if (values.preferred_check_max_usd < values.preferred_check_min_usd) {
      setError($("#startup-profile-error"), "El ticket máximo debe ser igual o mayor que el mínimo.");
      return;
    }
    const query = startupProfile
      ? supabaseClient.from("startup_profiles").update(values).eq("id", startupProfile.id)
      : supabaseClient.from("startup_profiles").insert(values);
    const { data, error } = await query.select().single();
    if (error) {
      setError($("#startup-profile-error"), error.message);
      console.error("No pudimos guardar el perfil de startup:", error);
      return;
    }
    startupProfile = data;
    setModal($("#startup-profile-modal"), false);
    renderStartupDashboard();
    await loadStartups();
    notify("Perfil publicado para inversores.");
  }

  async function publishUpdate() {
    if (!startupProfile) return notify("Completa primero tu perfil de startup.");
    const input = $("#update-input");
    const content = input.value.trim();
    if (!content) return notify("Escribe una actualización antes de publicarla.");
    const { error } = await supabaseClient.from("startup_updates").insert({
      startup_id: startupProfile.id,
      author_id: user.id,
      content
    });
    if (error) return reportFailure("No pudimos publicar la actualización", error);
    input.value = "";
    notify("Actualización publicada para la comunidad.");
    switchRemoteView("updates");
  }

  async function handleRemoteClick(event) {
    const viewButton = event.target.closest("[data-open-view]");
    if (viewButton) switchRemoteView(viewButton.dataset.openView);
    const interestButton = event.target.closest("[data-fund-interest]");
    if (interestButton && profile.role === "investor") {
      const startup = startups.find((item) => item.id === interestButton.dataset.fundInterest);
      const { error } = await supabaseClient.from("interests").insert({ investor_id: user.id, startup_id: interestButton.dataset.fundInterest });
      if (error?.code === "23505") return notify("Ya enviaste interés por esta startup.");
      if (error) return reportFailure("No pudimos enviar tu interés", error);
      notify(`Interés enviado a ${startup?.name || "la startup"}.`);
      await loadInterests();
    }
    const responseButton = event.target.closest("[data-respond]");
    if (responseButton && profile.role === "startup") {
      const { error } = await supabaseClient.from("interests")
        .update({ status: responseButton.dataset.status, updated_at: new Date().toISOString() })
        .eq("id", responseButton.dataset.respond);
      if (error) return reportFailure("No pudimos actualizar el interés", error);
      notify(responseButton.dataset.status === "matched" ? "Match mutuo confirmado." : "Solicitud descartada.");
      await loadRequests();
    }
  }

  authForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (busy) return;
    busy = true;
    $("#auth-submit").disabled = true;
    setError(authError, "");
    try {
      const email = authForm.elements.email.value.trim();
      const password = authForm.elements.password.value;
      if (authMode === "signup") {
        const { data, error } = await supabaseClient.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: authForm.elements.fullName.value.trim(), role: authForm.elements.role.value },
            emailRedirectTo: window.location.origin
          }
        });
        if (error) throw error;
        if (!data.session) {
          setAuthMode("signin");
          setError(authError, "Cuenta creada. Confirma tu correo y luego inicia sesión para continuar.");
          return;
        }
        user = data.user;
        await loadWorkspace();
      } else {
        const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
        if (error) throw error;
        user = data.user;
        await loadWorkspace();
      }
    } catch (error) {
      console.error("Error en el acceso:", error);
      setError(authError, error.message || "No se pudo completar el acceso.");
    } finally {
      busy = false;
      $("#auth-submit").disabled = false;
    }
  });
  $("#auth-mode-toggle").addEventListener("click", () => setAuthMode(authMode === "signup" ? "signin" : "signup"));
  $("#close-preferences-modal").addEventListener("click", () => setModal($("#preferences-modal"), false));
  $("#preferences-modal").addEventListener("click", (event) => {
    if (event.target === $("#preferences-modal")) setModal($("#preferences-modal"), false);
  });
  $("#startup-profile-modal").addEventListener("click", (event) => {
    if (event.target === $("#startup-profile-modal") && startupProfile) {
      setModal($("#startup-profile-modal"), false);
    }
  });
  $("#auth-screen").hidden = true;
  appShell.hidden = true;
  setAuthMode("signup");

  supabaseClient.auth.onAuthStateChange((_event, session) => {
    window.setTimeout(async () => {
      if (!session) {
        user = null;
        profile = null;
        workspaceUserId = null;
        workspaceController?.abort();
        showAuth();
        return;
      }
      if (user?.id === session.user.id) return;
      user = session.user;
      try {
        await loadWorkspace();
      } catch (error) {
        console.error("No se pudo abrir Venturea:", error);
        showAuth(error.message || "No pudimos cargar tu perfil.");
      }
    }, 0);
  });
  supabaseClient.auth.getSession().then(({ data, error }) => {
    if (error) throw error;
    if (!data.session) {
      showAuth();
      return;
    }
    user = data.session.user;
    loadWorkspace().catch((loadError) => {
      console.error("No se pudo cargar Venturea:", loadError);
      showAuth(loadError.message || "No pudimos cargar tu cuenta.");
    });
  }).catch((error) => {
    console.error("No se pudo revisar la sesión de Supabase:", error);
    showAuth("No se pudo conectar con Supabase. Revisa la configuración y vuelve a cargar la página.");
  });
};
