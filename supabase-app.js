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
  let companyProfile = null;
  let companySectors = [];
  let postCategories = [];
  let followingIds = new Set();
  let fundingRounds = [];
  let investorPreferences;
  let workspaceUserId = null;
  let workspaceController;
  let startups = [];
  let sectors = [];
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
  // Portada por sector sin banner: degradado cobalto→violeta, cobalto→esmeralda o marino→cobalto, estable por sector.
  const coverClass = (sector) => ["", "cover-emerald", "cover-navy"][[...String(sector)].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 3];
  const sectorName = (id) => sectors.find((sector) => sector.id === id)?.name ?? id;
  // <option> agrupadas por rubro; solo sectores activos (los inactivos siguen teniendo nombre en sectorName).
  const sectorOptions = (selected, withAll = false) => {
    const groups = [...new Set(sectors.filter((sector) => sector.is_active).map((sector) => sector.group_name))];
    return (withAll ? '<option value="all">Todos los sectores</option>' : "") + groups.map((group) =>
      `<optgroup label="${escapeHtml(group)}">${sectors.filter((sector) => sector.is_active && sector.group_name === group).map((sector) =>
        `<option value="${sector.id}"${sector.id === selected ? " selected" : ""}>${escapeHtml(sector.name)}</option>`).join("")}</optgroup>`).join("");
  };
  const setText = (selector, value) => {
    const element = $(selector);
    if (element) element.textContent = String(value);
  };
  const setModal = (modal, open) => {
    modal.classList.toggle("open", open);
    modal.setAttribute("aria-hidden", String(!open));
    if (!open) $$("iframe", modal).forEach((frame) => frame.removeAttribute("src")); // detiene el video al cerrar
  };
  const MENUS = {
    investor: [["discover", "◈", "Descubrir", "discover-count"], ["matches", "♡", "Intereses y matches", "match-count"], ["updates", "◷", "Actualizaciones"], ["funds", "↗", "Rondas abiertas"]],
    startup: [["startup", "⌂", "Mi startup"], ["matches", "♡", "Intereses y matches", "match-count"], ["updates", "◷", "Actualizaciones"], ["funds", "↗", "Rondas abiertas"]],
    company: [["discover", "◈", "Descubrir startups", "discover-count"], ["challenges", "⚑", "Mis desafíos"], ["following", "★", "Seguidos"], ["updates", "◷", "Publicaciones"], ["company", "⌂", "Mi empresa"]],
    admin: [["updates", "◷", "Actualizaciones"], ["funds", "↗", "Rondas abiertas"]]
  };
  const VIEW_TITLES = {
    discover: "Descubrir", matches: "Intereses y matches", updates: "Actualizaciones", funds: "Rondas abiertas", startup: "Mi startup",
    company: "Mi empresa", challenges: "Mis desafíos", following: "Seguidos", profile: "Perfil", plan: "Mi plan"
  };
  const ROLE_LABELS = { investor: "Inversor/a", startup: "Startup chilena", company: "Empresa", admin: "Administración" };
  const WORKSPACE_LABELS = { investor: "ESPACIO DE INVERSIÓN", startup: "ESPACIO DE STARTUP", company: "ESPACIO DE EMPRESA", admin: "ADMINISTRACIÓN" };
  const paintDataBg = (root) => $$("[data-bg]", root).forEach((element) => { element.style.backgroundImage = cssUrl(element.dataset.bg); });
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
      .select("id, role, full_name, city, avatar_url, banner_url, headline, bio")
      .eq("id", authUser.id)
      .single();
    if (error) throw new Error(`No encontramos tu perfil. Ejecuta el esquema SQL de configuración. ${error.message}`);
    return data;
  }

  async function loadSectors() {
    const { data, error } = await supabaseClient.from("sectors").select("id, name, group_name, is_active, sort_order").order("sort_order");
    if (error) throw error;
    sectors = data || [];
    $("#fund-filter").innerHTML = sectorOptions("all", true);
    $("#startup-profile-form").elements.sector.innerHTML = sectorOptions();
    $("#company-profile-form").elements.sector.innerHTML = sectorOptions();
  }

  async function loadInvestorPreferences() {
    const { data, error } = await supabaseClient
      .from("investor_preferences")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("No se encontraron tus preferencias de inversión. Ejecuta el esquema SQL y vuelve a iniciar sesión.");
    const { data: tagged, error: sectorsError } = await supabaseClient.from("profile_sectors").select("sector_id, kind").eq("profile_id", user.id);
    if (sectorsError) throw sectorsError;
    const ofKind = (kind) => (tagged || []).filter((row) => row.kind === kind).map((row) => row.sector_id);
    investorPreferences = { ...data, sectors: ofKind("interest"), sector_expertise: ofKind("expertise") };
  }

  function updateAccountLabels() {
    const initials = profile.full_name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
    $(".profile-copy strong").textContent = profile.full_name;
    $(".profile-copy small").textContent = ROLE_LABELS[profile.role];
    const target = mediaTarget();
    const photo = target ? target.row[target.avatar] : null;
    paintPhoto($(".avatar-user"), photo, initials);
    paintPhoto($(".top-avatar"), photo, initials);
    $("#profile-button").title = "Menú de cuenta";
    $("#profile-button").setAttribute("aria-label", "Abrir menú de cuenta");
  }

  // Cada rol recibe su propio menú; el modo demo (app.js) conserva el HTML estático.
  function setRoleNavigation() {
    $$("[data-demo-only]").forEach((item) => { item.hidden = true; });
    $(".workspace-label").textContent = WORKSPACE_LABELS[profile.role];
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
    const sectorFit = investorPreferences.sectors.includes(startup.sector_id) ? 1 : 0;
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
      (investorPreferences.sector_expertise.includes(startup.sector_id) ? 0.25 : 0) +
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
    return investorPreferences.sectors.includes(startup.sector_id) &&
      investorPreferences.stages.includes(startup.stage) &&
      ticketFit(startup) > 0 &&
      investorPreferences.markets.includes(startup.country) &&
      startup.desired_investor_types.includes(investorPreferences.investor_type) &&
      startup.desired_stages.some((stage) => investorPreferences.stages.includes(stage));
  }

  // Las startups Pro aparecen destacadas: +10 puntos solo para ordenar (el porcentaje mostrado no cambia).
  const featuredScore = (startup) => startup.assessment.combinedScore + (startup.is_pro ? 10 : 0);

  function orderCandidates(candidates) {
    const sorted = candidates.sort((a, b) => featuredScore(b) - featuredScore(a));
    const buckets = new Map();
    sorted.forEach((startup) => {
      const bucket = buckets.get(startup.sector_id) || [];
      bucket.push(startup);
      buckets.set(startup.sector_id, bucket);
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
    const { data: rounds, error: roundsError } = await supabaseClient.from("funding_rounds").select("*").eq("status", "open");
    if (roundsError) throw roundsError;
    const roundOf = new Map((rounds || []).map((round) => [round.startup_id, round]));
    startups = startups.map((startup) => ({ ...startup, round: roundOf.get(startup.id) }));
    const openRounds = startups.filter((startup) => startup.round);
    setText("#startup-count", startups.length);
    setText("#discover-count", startups.length);
    setText("#open-rounds-count", openRounds.length);
    setText("#open-rounds-note", `En ${new Set(openRounds.map((startup) => startup.sector_id)).size} sectores`);
    const owners = [...new Set(startups.map((startup) => startup.owner_id))];
    if (owners.length) {
      const { data: ownerProfiles, error: ownersError } = await supabaseClient
        .from("profiles").select("id, full_name").in("id", owners);
      if (ownersError) throw ownersError;
      const names = new Map(ownerProfiles.map((owner) => [owner.id, owner.full_name]));
      startups = startups.map((startup) => ({ ...startup, founder_name: names.get(startup.owner_id) || "Equipo fundador" }));
    }
    const { data: proIds, error: proError } = await supabaseClient.rpc("pro_user_ids", { p_ids: [...new Set(startups.map((startup) => startup.owner_id))] });
    if (proError) throw proError;
    proOwners = new Set(proIds || []);
    startups = startups.map((startup) => ({ ...startup, is_pro: proOwners.has(startup.owner_id) }));
    rankedStartups = profile.role === "investor"
      ? orderCandidates(startups.filter(passesFilters).filter(passesAdvanced).map((startup) => ({ ...startup, assessment: assess(startup) })))
      : profile.role === "company" && companyProfile
        ? startups.filter(passesAdvanced).map((startup) => ({ ...startup, assessment: assessCompany(startup) })).sort((a, b) => featuredScore(b) - featuredScore(a))
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
      $("#follow-button").hidden = true;
      return;
    }
    card.hidden = false;
    empty.hidden = true;
    $("#card-number").textContent = `${String(selectedIndex + 1).padStart(2, "0")} / ${String(rankedStartups.length).padStart(2, "0")}`;
    $("#card-cover").className = `startup-cover ${coverClass(startup.sector_id)}`;
    paintBanner($("#card-cover"), startup.banner_url);
    paintPhoto($("#company-logo"), startup.logo_url, startup.name.slice(0, 1).toUpperCase());
    $("#pitch-button").hidden = !startup.pitch_video_url;
    $("#company-name").textContent = startup.name;
    $("#company-location").textContent = `${startup.city}, Chile`;
    $("#company-description").textContent = startup.description;
    $("#company-round").textContent = `${startup.stage} · ${money(startup.target_amount_usd)}`;
    $("#company-traction").textContent = `${Math.round(Number(startup.traction_score) * 100)}% tracción reportada`;
    $("#company-fit").innerHTML = `${startup.assessment.combinedScore}% <span>✦</span>`;
    const parts = startup.assessment.parts;
    $("#score-breakdown").textContent = profile.role === "company"
      ? `Sector ${parts.sectorFit ? "coincide" : "no coincide"} (40%) · Colaboración ${Math.round(parts.collabFit * 100)}% (30%) · Etapa ${Math.round(parts.stageFit * 100)}% (20%) · Ciudad ${parts.cityFit ? "coincide" : "distinta"} (10%)`
      : `Tu encaje ${startup.assessment.investorScore}% · Encaje con lo que busca la startup ${startup.assessment.startupScore}%`;
    setText("#score-note", profile.role === "company"
      ? "Tu puntaje pondera sector (40%), tipo de colaboración (30%), etapa (20%) y ciudad (10%). Es orientativo; no predice una alianza."
      : "Tu puntaje pondera sector (25%), etapa (20%), ticket (20%), mercado (15%), modelo (10%) y tracción (10%). La compatibilidad combina ambos puntajes; no predice inversión.");
    $("#score-reasons").innerHTML = [
      `Sector ${escapeHtml(sectorName(startup.sector_id))}`,
      `Etapa ${escapeHtml(startup.stage)}`,
      profile.role === "company" ? `Ciudad ${escapeHtml(startup.city)}` : `Ticket ${escapeHtml(money(investorPreferences.min_ticket_usd))}–${escapeHtml(money(investorPreferences.max_ticket_usd))}`,
      "Chile"
    ].map((reason) => `<span>${reason}</span>`).join("");
    $("#founder-name").textContent = startup.founder_name;
    $("#founder-avatar").textContent = startup.founder_name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
    $("#company-tags").innerHTML = [sectorName(startup.sector_id), startup.business_model, startup.stage].map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("") + (startup.round ? '<span class="tag funding">Buscando financiamiento</span>' : "") + (startup.is_pro ? PRO_TAG : "");
    setText(".cover-label", startup.is_pro ? "★ STARTUP DESTACADA · PRO" : "STARTUP");
    $("#bookmark-button").hidden = true;
    renderFollowButtons();
  }

  async function loadInterests(target = "#match-list") {
    const { data, error } = await supabaseClient
      .from("interests")
      .select("*")
      .eq("investor_id", user.id)
      .order("created_at", { ascending: false });
    if (error) throw error;
    const interests = data || [];
    setText("#match-count", interests.filter((interest) => interest.status === "pending").length);
    if (!interests.length) {
      $(target).innerHTML = '<div class="empty-state"><span>♡</span><h3>Tu próximo match empieza aquí</h3><p>Expresa interés en una startup chilena. El match se crea cuando ambos aceptan.</p><button class="primary-button" data-open-view="discover">Descubrir startups</button></div>';
      return;
    }
    const startupIds = [...new Set(interests.map((interest) => interest.startup_id))];
    const { data: linkedStartups, error: startupError } = await supabaseClient
      .from("startup_profiles").select("id, name, city, sector_id, stage").in("id", startupIds);
    if (startupError) throw startupError;
    const lookup = new Map(linkedStartups.map((startup) => [startup.id, startup]));
    $(target).innerHTML = interests.map((interest) => {
      const startup = lookup.get(interest.startup_id);
      if (!startup) return "";
      const matched = interest.status === "matched";
      const rejected = interest.status === "rejected";
      return `<article class="match-item"><span class="match-logo">${escapeHtml(startup.name.slice(0, 1))}</span><div class="match-item-info"><strong>${escapeHtml(startup.name)}</strong><small>${matched ? "Match mutuo" : rejected ? "No aceptado" : "Interés enviado · Esperando respuesta"} · ${escapeHtml(sectorName(startup.sector_id))} · ${escapeHtml(startup.city)}, Chile</small></div>${matched ? '<span class="interest-pending">Match mutuo</span>' : ""}</article>`;
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
    const { data: investors, error: profilesError } = await supabaseClient.from("profiles").select("id, full_name, role").in("id", ids);
    if (profilesError) throw profilesError;
    const names = new Map(investors.map((investor) => [investor.id, investor.full_name]));
    const roles = new Map(investors.map((investor) => [investor.id, investor.role]));
    show(requests.map((request) => `<article class="request-item"><div><strong>${escapeHtml(names.get(request.investor_id) || "Inversor/a")} <span class="tag">${escapeHtml(ROLE_LABELS[roles.get(request.investor_id)] || "")}</span></strong><small>${request.status === "matched" ? "Match mutuo" : request.status === "rejected" ? "No aceptado" : "Quiere conocer tu startup"}</small></div>${request.status === "pending" ? `<button data-respond="${request.id}" data-status="matched">Aceptar match</button><button data-respond="${request.id}" data-status="rejected">Ahora no</button>` : ""}</article>`).join(""));
  }

  function renderRemoteFunds() {
    const sector = $("#fund-filter").value;
    const stage = $("#stage-filter").value;
    const filtered = startups.filter((startup) => startup.round && (sector === "all" || startup.sector_id === sector) && (stage === "all" || startup.round.stage === stage));
    $("#fund-opportunity-count").textContent = String(filtered.length);
    $("#fund-grid").innerHTML = filtered.length ? filtered.map((startup) => `<article class="fund-card"><div class="fund-card-top"><span class="fund-card-logo" data-bg="${escapeHtml(startup.logo_url || "")}">${startup.logo_url ? "" : escapeHtml(startup.name.slice(0, 1))}</span><span class="fund-stage">${escapeHtml(startup.round.stage)}</span></div><h3>${escapeHtml(startup.name)}</h3><span class="fund-sector">${escapeHtml(sectorName(startup.sector_id))} · ${escapeHtml(startup.city)}, Chile</span><p>${escapeHtml(startup.description)}</p><div class="fund-progress-row"><span>Objetivo de ronda</span><strong>${escapeHtml(money(startup.round.target_usd))}</strong></div><div class="fund-progress-row"><span>Ticket buscado</span><strong>${escapeHtml(money(startup.round.ticket_min_usd))}–${escapeHtml(money(startup.round.ticket_max_usd))}</strong></div>${startup.round.committed_pct ? `<div class="fund-progress-row"><span>Capital comprometido</span><strong>${startup.round.committed_pct}%</strong></div>` : ""}<div class="fund-card-footer"><span>Ubicación declarada</span>${["investor", "company"].includes(profile.role) ? `<button data-fund-interest="${startup.id}">Me interesa →</button>` : ""}</div></article>`).join("") : '<div class="no-results">Aún no hay rondas publicadas con estos filtros.</div>';
    paintDataBg($("#fund-grid"));
  }

  function fillStartupProfileForm() {
    const form = $("#startup-profile-form");
    if (!startupProfile) return;
    for (const [field, key] of Object.entries({
      name: "name", city: "city", sector: "sector_id", stage: "stage", target: "target_amount_usd",
      checkMin: "preferred_check_min_usd", checkMax: "preferred_check_max_usd",
      description: "description", businessModel: "business_model", pitchVideo: "pitch_video_url"
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
    paintPhoto($("#view-startup .dashboard-company-logo"), startupProfile.logo_url, startupProfile.name.slice(0, 1).toUpperCase());
    paintBanner($("#view-startup .dashboard-cover"), startupProfile.banner_url);
    $("#view-startup .dashboard-company-info h2").textContent = startupProfile.name;
    $("#view-startup .dashboard-company-info > p").textContent = `${startupProfile.description} · ${startupProfile.city}, Chile`;
    $("#view-startup .dashboard-company-info .tag-row").innerHTML = (hasFeature("pro_badge") ? PRO_TAG : "") + [sectorName(startupProfile.sector_id), startupProfile.business_model, startupProfile.stage].map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("");
    $("#startup-profile-form").elements.name.value = startupProfile.name;
    $("#startup-profile-form").elements.city.value = startupProfile.city;
    fillStartupProfileForm();
    loadRequests().catch((error) => reportFailure("No pudimos cargar las solicitudes de interés", error));
    loadFundingRounds().catch((error) => reportFailure("No pudimos cargar tus rondas", error));
    loadOwnPosts().catch((error) => reportFailure("No pudimos cargar tus publicaciones", error));
    loadFollowerStats().catch((error) => reportFailure("No pudimos cargar tus seguidores", error));
    loadVisitStats().catch((error) => reportFailure("No pudimos cargar tus visitas", error));
  }

  async function loadWorkspace() {
    if (workspaceUserId === user.id) return;
    workspaceUserId = user.id;
    workspaceController?.abort();
    workspaceController = new AbortController();
    const { signal } = workspaceController;
    try {
    profile = await loadProfile(user);
    await loadSectors();
    Object.assign(postsState, { category: "all", sector: "all", followingOnly: false, offset: 0 });
    followingIds = new Set();
    fundingRounds = [];
    await loadPostCategories();
    $("#post-following-only").checked = false;
    entitlements = { effective_status: "free", is_pro: false, features: [], free_limits: {}, interests_used_month: 0, open_challenges: 0 };
    proOwners = new Set();
    Object.assign(advanced, { city: "", sector: "all", traction: 0, model: "all" });
    await loadEntitlements();
    $("#post-following-label").hidden = !["investor", "company"].includes(profile.role);
    startupProfile = null;
    companyProfile = null;
    companySectors = [];
    updateAccountLabels();
    setRoleNavigation();
    hideAuth();
    $$(".view").forEach((view) => view.classList.remove("active"));
    $("#main-nav").addEventListener("click", (event) => {
      const link = event.target.closest("[data-view]");
      if (link) switchRemoteView(link.dataset.view);
    }, { signal });
    $("#notification-button").addEventListener("click", toggleNotificationPanel, { signal });
    $("#notification-panel").addEventListener("click", handleNoticeClick, { signal });
    $("#notice-stack").addEventListener("click", handleNoticeClick, { signal });
    $("#profile-button").addEventListener("click", toggleProfileMenu, { signal });
    $("#profile-menu").addEventListener("click", handleProfileMenu, { signal });
    $(".top-avatar").addEventListener("click", () => openOwnProfile(), { signal });
    $("#search-kbd").textContent = /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘ K" : "Ctrl K";
    $("#global-search").addEventListener("input", scheduleSearch, { signal });
    $("#global-search").addEventListener("focus", scheduleSearch, { signal });
    $("#search-results").addEventListener("click", openSearchResult, { signal });
    document.addEventListener("keydown", handleGlobalKeys, { signal });
    document.addEventListener("click", closePopovers, { signal });
    $("#info-button").addEventListener("click", () => { if (rankedStartups[selectedIndex]) openProfile("startup", rankedStartups[selectedIndex].id); }, { signal });
    $("#pitch-button").addEventListener("click", () => {
      const current = rankedStartups[selectedIndex];
      if (current?.pitch_video_url) openPitch(current.name, current.pitch_video_url);
    }, { signal });
    $("#view-own-profile").addEventListener("click", openOwnProfile, { signal });
    $("#view-own-profile-company").addEventListener("click", openOwnProfile, { signal });
    $("#post-chips").addEventListener("click", (event) => {
      const chip = event.target.closest("[data-post-cat]");
      if (!chip) return;
      postsState.category = chip.dataset.postCat;
      $$("#post-chips .chip").forEach((item) => { item.classList.toggle("active", item === chip); item.setAttribute("aria-pressed", String(item === chip)); });
      reloadUpdates();
    }, { signal });
    $("#post-sector-filter").addEventListener("change", (event) => { postsState.sector = event.target.value; reloadUpdates(); }, { signal });
    $("#post-following-only").addEventListener("change", (event) => { postsState.followingOnly = event.target.checked; reloadUpdates(); }, { signal });
    $("#load-more-posts").addEventListener("click", () => loadUpdates({ append: true }).catch((error) => reportFailure("No pudimos cargar más publicaciones", error)), { signal });
    $("#follow-button").addEventListener("click", () => { if (rankedStartups[selectedIndex]) toggleFollow(rankedStartups[selectedIndex].id); }, { signal });
    $("#funding-switch").addEventListener("change", handleFundingSwitch, { signal });
    $("#funding-panel").addEventListener("click", handleFundingClick, { signal });
    $("#round-form").addEventListener("submit", saveRound, { signal });
    $("#advanced-fields").addEventListener("change", () => applyAdvancedFilters().catch((error) => reportFailure("No pudimos aplicar los filtros", error)), { signal });
    // Si el pago cambia mientras la pestaña estaba abierta, el plan se actualiza al volver a ella.
    document.addEventListener("visibilitychange", () => { if (!document.hidden) loadEntitlements().catch(() => {}); }, { signal });
    startNotifications(signal);
    if (profile.role === "investor") {
      selectedIndex = 0;
      await loadInvestorPreferences();
      await refreshFollowIds();
      await loadStartups();
      renderRemoteCard();
      $("#investor-sector-pills").innerHTML = investorPreferences.sectors.map((sector) => `<span>${escapeHtml(sectorName(sector))}</span>`).join("") || "<span>Sin sectores</span>";
      $("#investor-stage-value").textContent = investorPreferences.stages.join(" · ") || "Sin etapas";
      $("#investor-ticket-value").textContent = `${money(investorPreferences.min_ticket_usd)} – ${money(investorPreferences.max_ticket_usd)}`;
      await loadInterests();
      switchRemoteView("discover");
      $("#open-fund-modal").hidden = true;
      $("#edit-filters").addEventListener("click", openPreferences, { signal });
      $("#empty-edit-filters").addEventListener("click", openPreferences, { signal });
      $("#preferences-form").addEventListener("submit", savePreferences, { signal });
      $("#sector-search").addEventListener("input", filterSectorChecklist, { signal });
      $("#like-button").addEventListener("click", sendInterest, { signal });
      $("#pass-button").addEventListener("click", nextStartup, { signal });
      $("#bookmark-button").hidden = true;
      setText("#rail-title", "Tu tesis de inversión");
      setText("#rail-label-1", "SECTORES");
      setText("#rail-label-2", "ETAPAS");
      setText("#rail-label-3", "TICKET");
    } else if (profile.role === "startup") {
      const { data, error } = await supabaseClient.from("startup_profiles").select("*").eq("owner_id", user.id).maybeSingle();
      if (error) throw error;
      startupProfile = data;
      updateAccountLabels();
      switchRemoteView("startup");
      $("#open-fund-modal").addEventListener("click", openRoundForm, { signal });
      $("#startup-create-fund").addEventListener("click", openRoundForm, { signal });
      $("#edit-startup").addEventListener("click", openStartupEditor, { signal });
      $("#startup-profile-form").addEventListener("submit", saveStartupProfile, { signal });
      $("#publish-update").addEventListener("click", publishUpdate, { signal });
      await loadStartups();
    } else if (profile.role === "company") {
      const { data, error } = await supabaseClient.from("company_profiles").select("*").eq("owner_id", user.id).maybeSingle();
      if (error) throw error;
      companyProfile = data;
      const { data: tagged, error: taggedError } = await supabaseClient.from("profile_sectors").select("sector_id").eq("profile_id", user.id).eq("kind", "interest");
      if (taggedError) throw taggedError;
      companySectors = (tagged || []).map((row) => row.sector_id);
      await refreshFollowIds();
      updateAccountLabels();
      selectedIndex = 0;
      await loadStartups();
      if (companyProfile) {
        renderRemoteCard();
        renderCompanyRail();
      }
      switchRemoteView("discover");
      $("#open-fund-modal").hidden = true;
      $("#bookmark-button").hidden = true;
      $("#edit-filters").addEventListener("click", openCompanyEditor, { signal });
      $("#edit-company").addEventListener("click", openCompanyEditor, { signal });
      $("#like-button").addEventListener("click", sendInterest, { signal });
      $("#pass-button").addEventListener("click", nextStartup, { signal });
      if (!companyProfile) openCompanyEditor();
    } else {
      $("#open-fund-modal").hidden = true;
      await loadStartups();
      switchRemoteView("updates");
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
    if (!event.target.closest(".bell-wrap")) {
      $("#notification-panel").hidden = true;
      $("#notification-button").setAttribute("aria-expanded", "false");
    }
  }


  function handleProfileMenu(event) {
    const action = event.target.closest("[data-menu-action]")?.dataset.menuAction;
    if (!action) return;
    $("#profile-menu").hidden = true;
    $("#profile-button").setAttribute("aria-expanded", "false");
    if (action === "profile") openOwnProfile();
    if (action === "settings") {
      if (profile.role === "startup") openStartupEditor();
      else if (profile.role === "company") openCompanyEditor();
      else if (profile.role === "investor") openPreferences();
    }
    if (action === "plan") openPlan();
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
    $("#notification-panel").hidden = true;
    $("#notification-button").setAttribute("aria-expanded", "false");
    $$(".modal-backdrop.open").forEach((modal) => {
      const forced = (modal.id === "startup-profile-modal" && !startupProfile) || (modal.id === "company-profile-modal" && !companyProfile);
      if (!forced) setModal(modal, false);
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
    openProfile(kind, id);
  }

  // ------------------------------------------------------------------
  // Medios: foto, banner y video pitch
  // ------------------------------------------------------------------
  const initialsOf = (name) => String(name).split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  const cssUrl = (url) => (/^https:\/\//.test(url || "") ? `url("${encodeURI(url).replace(/"/g, "%22")}")` : "");
  // Foto si existe; si no, las iniciales.
  function paintPhoto(element, url, fallback) {
    element.style.backgroundImage = cssUrl(url);
    element.textContent = url ? "" : fallback;
  }
  // Banner si existe; si no, queda el degradado por sector de la hoja de estilos.
  function paintBanner(element, url) {
    element.style.backgroundImage = cssUrl(url);
    element.classList.toggle("has-banner", Boolean(url));
  }
  // A qué fila pertenecen la foto y el banner de la persona que inició sesión.
  function mediaTarget() {
    if (profile.role === "startup" && startupProfile) return { table: "startup_profiles", row: startupProfile, avatar: "logo_url", banner: "banner_url" };
    if (profile.role === "company" && companyProfile) return { table: "company_profiles", row: companyProfile, avatar: "logo_url", banner: "banner_url" };
    if (profile.role === "investor") return { table: "profiles", row: profile, avatar: "avatar_url", banner: "banner_url" };
    return null;
  }

  let imageDraft = null;
  function openImageUploader(kind) {
    if (!mediaTarget()) return notify("Completa primero tu perfil para subir imágenes.");
    const rule = window.VentureaMedia.IMAGE_RULES[kind];
    imageDraft = { kind, image: null, zoom: 1, panX: 0, panY: 0, busy: false };
    $("#image-eyebrow").textContent = `${kind === "avatar" ? "FOTO" : "BANNER"} · ${rule.width}×${rule.height} · MÁX. ${rule.maxBytes / 1048576} MB`;
    $("#image-title").innerHTML = `${kind === "avatar" ? "Sube tu foto" : "Sube tu banner"}<span class="heading-period">.</span>`;
    const canvas = $("#image-canvas");
    canvas.width = kind === "avatar" ? 280 : 560;
    canvas.height = kind === "avatar" ? 280 : 140;
    $("#image-file").value = "";
    $("#image-zoom").value = "1";
    $("#image-save").disabled = true;
    setError($("#image-error"), "");
    drawCrop();
    setModal($("#image-modal"), true);
  }

  function drawCrop() {
    const canvas = $("#image-canvas");
    const context = canvas.getContext("2d");
    context.fillStyle = "#E3E8F2";
    context.fillRect(0, 0, canvas.width, canvas.height);
    if (!imageDraft?.image) return;
    const { image, zoom } = imageDraft;
    const rect = window.VentureaMedia.coverRect(image.naturalWidth, image.naturalHeight, canvas.width, canvas.height, zoom, imageDraft.panX, imageDraft.panY);
    imageDraft.panX = rect.sx - (image.naturalWidth - rect.sw) / 2; // guarda el desplazamiento ya limitado
    imageDraft.panY = rect.sy - (image.naturalHeight - rect.sh) / 2;
    context.drawImage(image, rect.sx, rect.sy, rect.sw, rect.sh, 0, 0, canvas.width, canvas.height);
  }

  function pickImage(event) {
    const file = event.target.files[0];
    const problem = window.VentureaMedia.validateImageFile(file, imageDraft.kind);
    imageDraft.image = null;
    $("#image-save").disabled = true;
    setError($("#image-error"), problem);
    if (problem) return drawCrop();
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      Object.assign(imageDraft, { image, zoom: 1, panX: 0, panY: 0 });
      $("#image-zoom").value = "1";
      $("#image-save").disabled = false;
      drawCrop();
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      setError($("#image-error"), "No pudimos leer esa imagen. Prueba con otro archivo.");
    };
    image.src = url;
  }

  function dragCrop(event) {
    if (!imageDraft?.image) return;
    const canvas = event.currentTarget;
    canvas.setPointerCapture?.(event.pointerId);
    let last = { x: event.clientX, y: event.clientY };
    const move = (moveEvent) => {
      const { image, zoom } = imageDraft;
      const rect = window.VentureaMedia.coverRect(image.naturalWidth, image.naturalHeight, canvas.width, canvas.height, zoom, imageDraft.panX, imageDraft.panY);
      const factor = canvas.width / rect.sw; // píxeles de pantalla por píxel de la imagen original
      imageDraft.panX -= (moveEvent.clientX - last.x) / factor;
      imageDraft.panY -= (moveEvent.clientY - last.y) / factor;
      last = { x: moveEvent.clientX, y: moveEvent.clientY };
      drawCrop();
    };
    const stop = () => { canvas.removeEventListener("pointermove", move); canvas.removeEventListener("pointerup", stop); canvas.removeEventListener("pointercancel", stop); };
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", stop);
    canvas.addEventListener("pointercancel", stop);
  }

  async function saveImage() {
    if (!imageDraft?.image || imageDraft.busy) return;
    imageDraft.busy = true;
    $("#image-save").disabled = true;
    const { kind, image, zoom, panX, panY } = imageDraft;
    const target = mediaTarget();
    const rule = window.VentureaMedia.IMAGE_RULES[kind];
    try {
      const output = document.createElement("canvas");
      output.width = rule.width;
      output.height = rule.height;
      const rect = window.VentureaMedia.coverRect(image.naturalWidth, image.naturalHeight, rule.width, rule.height, zoom, panX, panY);
      output.getContext("2d").drawImage(image, rect.sx, rect.sy, rect.sw, rect.sh, 0, 0, rule.width, rule.height);
      const blob = await new Promise((resolve) => output.toBlob(resolve, "image/webp", 0.9));
      if (!blob) throw new Error("No pudimos preparar la imagen.");
      const bucket = kind === "avatar" ? "avatars" : "banners";
      const extension = { "image/webp": "webp", "image/jpeg": "jpg" }[blob.type] || "png";
      const path = `${user.id}/${target.table}-${kind}-${Date.now()}.${extension}`; // la política exige la carpeta {user_id}/
      const { error } = await supabaseClient.storage.from(bucket).upload(path, blob, { contentType: blob.type, cacheControl: "31536000" });
      if (error) throw error;
      const { data: published } = supabaseClient.storage.from(bucket).getPublicUrl(path);
      const column = kind === "avatar" ? target.avatar : target.banner;
      const { data, error: updateError } = await supabaseClient.from(target.table).update({ [column]: published.publicUrl }).eq("id", target.row.id).select().single();
      if (updateError) throw updateError;
      Object.assign(target.row, data);
      setModal($("#image-modal"), false);
      refreshOwnMedia();
      notify(kind === "avatar" ? "Foto actualizada." : "Banner actualizado.");
    } catch (error) {
      console.error("No pudimos guardar la imagen:", error);
      setError($("#image-error"), error.message || "No pudimos guardar la imagen.");
      $("#image-save").disabled = false;
    } finally {
      imageDraft.busy = false;
    }
  }

  function refreshOwnMedia() {
    updateAccountLabels();
    if (profile.role === "startup") renderStartupDashboard();
    if (profile.role === "company") renderCompanyDashboard();
    if ($("#view-profile").classList.contains("active") && openProfileRef) openProfile(openProfileRef.kind, openProfileRef.id);
  }

  function openPitch(name, url) {
    const embed = window.VentureaMedia.toEmbedUrl(url);
    if (!embed) return notify("Ese enlace de video no es válido.");
    $("#pitch-title").innerHTML = `${escapeHtml(name)}<span class="heading-period">.</span>`;
    $("#pitch-frame").src = embed;
    setModal($("#pitch-modal"), true);
  }

  // ------------------------------------------------------------------
  // Empresa: perfil, compatibilidad con startups, desafíos y seguidos
  // ------------------------------------------------------------------
  const COLLABORATION = [["piloto", "Piloto"], ["proveedor", "Proveedor"], ["co-desarrollo", "Co-desarrollo"], ["inversion-corporativa", "Inversión corporativa"], ["adquisicion", "Adquisición"]];
  const collaborationName = (id) => COLLABORATION.find(([key]) => key === id)?.[1] ?? id;

  // Compatibilidad empresa–startup: sector 40 %, colaboración 30 %, etapa 20 %, ciudad 10 %. Solo orientativa.
  function assessCompany(startup) {
    const interests = new Set([companyProfile.sector_id, ...companySectors]);
    const types = companyProfile.collaboration_types || [];
    const operational = types.some((type) => ["piloto", "proveedor", "co-desarrollo"].includes(type));
    const investing = types.some((type) => ["inversion-corporativa", "adquisicion"].includes(type));
    const collabFit = Math.max(
      operational ? (startup.business_model === "B2C" ? 0.3 : 1) : 0,
      investing ? (startup.desired_investor_types.includes("Corporate") ? 1 : 0) : 0
    );
    const stageFit = Math.max(
      operational ? { "Pre-seed": 0.6, Seed: 1, "Serie A": 1 }[startup.stage] ?? 0 : 0,
      investing ? { "Pre-seed": 0.4, Seed: 0.7, "Serie A": 1 }[startup.stage] ?? 0 : 0
    );
    const sectorFit = interests.has(startup.sector_id) ? 1 : 0;
    const cityFit = startup.city.trim().toLowerCase() === companyProfile.city.trim().toLowerCase() ? 1 : 0;
    const combinedScore = Math.round(100 * (sectorFit * 0.4 + collabFit * 0.3 + stageFit * 0.2 + cityFit * 0.1));
    return { combinedScore, investorScore: combinedScore, startupScore: combinedScore, parts: { sectorFit, collabFit, stageFit, cityFit } };
  }

  function renderCompanyRail() {
    setText("#rail-title", "Tu perfil de colaboración");
    setText("#rail-label-1", "SECTORES");
    setText("#rail-label-2", "COLABORACIÓN");
    setText("#rail-label-3", "CIUDAD");
    const sectorIds = [...new Set([companyProfile.sector_id, ...companySectors])];
    $("#investor-sector-pills").innerHTML = sectorIds.map((id) => `<span>${escapeHtml(sectorName(id))}</span>`).join("");
    $("#investor-stage-value").textContent = (companyProfile.collaboration_types || []).map(collaborationName).join(" · ") || "Sin definir";
    $("#investor-ticket-value").textContent = companyProfile.city;
    $("#investor-compatible-count").textContent = `${rankedStartups.length} startups para ti`;
    setText("#empty-title", "Aún no hay startups publicadas");
    setText("#empty-copy", "Cuando se publiquen startups chilenas aparecerán aquí, ordenadas por afinidad.");
    $("#empty-edit-filters").hidden = true;
  }

  function openCompanyEditor() {
    const form = $("#company-profile-form");
    const current = companyProfile || {};
    form.elements.name.value = current.name ?? "";
    form.elements.sector.value = current.sector_id ?? form.elements.sector.options[0]?.value;
    form.elements.size.value = current.size ?? "11-50";
    form.elements.city.value = current.city ?? "";
    form.elements.website.value = current.website ?? "";
    form.elements.description.value = current.description ?? "";
    form.elements.challenges.value = current.challenges ?? "";
    $("#collab-options").innerHTML = COLLABORATION.map(([id, label]) =>
      `<label class="preference-option"><input type="checkbox" name="collab" value="${id}" ${(current.collaboration_types || []).includes(id) ? "checked" : ""}>${label}</label>`).join("");
    setError($("#company-profile-error"), "");
    setModal($("#company-profile-modal"), true);
  }

  async function saveCompanyProfile(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const errorBox = $("#company-profile-error");
    const values = {
      owner_id: user.id,
      name: form.elements.name.value.trim(),
      sector_id: form.elements.sector.value,
      size: form.elements.size.value,
      city: form.elements.city.value.trim(),
      website: form.elements.website.value.trim() || null,
      description: form.elements.description.value.trim(),
      collaboration_types: [...form.querySelectorAll("[name='collab']:checked")].map((input) => input.value),
      challenges: form.elements.challenges.value.trim() || null,
      is_published: true
    };
    if (values.description.length < 20 || values.description.length > 1000) return setError(errorBox, "La descripción debe tener entre 20 y 1.000 caracteres.");
    if (!values.collaboration_types.length) return setError(errorBox, "Elige al menos un tipo de colaboración.");
    const { owner_id, ...editable } = values; // owner_id solo se escribe al crear
    const query = companyProfile
      ? supabaseClient.from("company_profiles").update(editable).eq("id", companyProfile.id)
      : supabaseClient.from("company_profiles").insert(values);
    const { data, error } = await query.select().single();
    if (error) {
      console.error("No pudimos guardar el perfil de empresa:", error);
      return setError(errorBox, error.message);
    }
    if (!companySectors.includes(values.sector_id)) {
      const { error: sectorError } = await supabaseClient.from("profile_sectors").insert({ profile_id: user.id, sector_id: values.sector_id, kind: "interest" });
      if (sectorError && sectorError.code !== "23505") console.error("No pudimos guardar el sector de la empresa:", sectorError);
      else companySectors = [...companySectors, values.sector_id];
    }
    companyProfile = data;
    setModal($("#company-profile-modal"), false);
    updateAccountLabels();
    await loadStartups();
    selectedIndex = 0;
    renderRemoteCard();
    renderCompanyRail();
    renderCompanyDashboard();
    notify("Perfil de empresa guardado.");
  }

  function renderCompanyDashboard() {
    if (!companyProfile) return setModal($("#company-profile-modal"), true);
    paintPhoto($("#company-logo-dash"), companyProfile.logo_url, companyProfile.name.slice(0, 1).toUpperCase());
    paintBanner($("#company-cover"), companyProfile.banner_url);
    setText("#company-dash-name", companyProfile.name);
    setText("#company-dash-desc", `${companyProfile.description} · ${companyProfile.city}, Chile`);
    $("#company-dash-tags").innerHTML = (hasFeature("pro_badge") ? PRO_TAG : "") + [sectorName(companyProfile.sector_id), `${companyProfile.size} personas`, ...(companyProfile.collaboration_types || []).map(collaborationName)]
      .map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("");
    loadChallenges().catch((error) => reportFailure("No pudimos cargar tus desafíos", error));
    loadFollowing().catch((error) => reportFailure("No pudimos cargar tus seguidos", error));
  }

  async function loadChallenges() {
    const { data, error } = await supabaseClient.from("company_challenges").select("*").eq("company_id", companyProfile.id).order("created_at", { ascending: false });
    if (error) throw error;
    const challenges = data || [];
    const openCount = challenges.filter((challenge) => challenge.status === "open").length;
    setText("#company-open-challenges", openCount);
    setText("#challenge-note", entitlements.is_pro ? "Con tu plan Pro puedes publicar desafíos ilimitados." : `Plan Free: ${openCount} de ${challengeLimit() ?? 1} desafío abierto. Con Pro son ilimitados.`);
    $("#challenge-list").innerHTML = challenges.length
      ? challenges.map((challenge) => `<article class="update-item"><div class="update-copy"><strong>${escapeHtml(challenge.title)} <span class="tag">${challenge.status === "open" ? "Abierto" : "Cerrado"}</span></strong><small>${new Date(challenge.created_at).toLocaleDateString("es-CL")}</small><p>${escapeHtml(challenge.description)}</p></div><button class="secondary-button" data-challenge-toggle="${challenge.id}" data-status="${challenge.status === "open" ? "closed" : "open"}">${challenge.status === "open" ? "Cerrar" : "Reabrir"}</button></article>`).join("")
      : '<div class="empty-state"><span>⚑</span><h3>Aún no publicas desafíos</h3><p>Cuéntales a las startups qué problema quieres resolver.</p></div>';
  }

  async function saveChallenge(event) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!companyProfile) return notify("Completa primero el perfil de tu empresa.");
    const { error } = await supabaseClient.from("company_challenges").insert({
      company_id: companyProfile.id, title: form.elements.title.value.trim(), description: form.elements.description.value.trim()
    });
    if (error) {
      if (/LIMIT_CHALLENGES/.test(error.message)) return notify("El plan Free permite un desafío abierto. Cierra el actual o pasa a Pro para publicar más.");
      return reportFailure("No pudimos publicar el desafío", error);
    }
    form.reset();
    notify("Desafío publicado.");
    await loadChallenges();
  }

  async function loadFollowing() {
    const { data, error } = await supabaseClient.from("follows").select("*").eq("follower_id", user.id).order("created_at", { ascending: false });
    if (error) throw error;
    const followed = (data || []).map((follow) => startups.find((startup) => startup.id === follow.startup_id)).filter(Boolean);
    setText("#company-followed-count", followed.length);
    $("#followed-list").innerHTML = followed.length
      ? followed.map((startup) => `<article class="match-item"><span class="match-logo" data-bg="${escapeHtml(startup.logo_url || "")}">${startup.logo_url ? "" : escapeHtml(startup.name.slice(0, 1))}</span><div class="match-item-info"><strong>${escapeHtml(startup.name)}</strong><small>${escapeHtml(sectorName(startup.sector_id))} · ${escapeHtml(startup.city)}, Chile</small></div><button class="secondary-button" data-open-profile="startup:${startup.id}">Ver perfil</button></article>`).join("")
      : '<div class="empty-state"><span>★</span><h3>Aún no sigues startups</h3><p>Entra al perfil de una startup y pulsa “Seguir” para tenerla siempre a mano.</p></div>';
    $$("#followed-list [data-bg]").forEach((element) => { element.style.backgroundImage = cssUrl(element.dataset.bg); });
    await loadInterests("#sent-interests");
  }

  // ------------------------------------------------------------------
  // Perfil completo (startup, inversionista y empresa)
  // ------------------------------------------------------------------
  let openProfileRef = null;

  function profileShell({ bannerUrl, photoUrl, initials, title, subtitle, tags = [], meta = "", actions = "", body = "" }) {
    return `<article class="profile-card"><div class="profile-banner" data-bg="${escapeHtml(bannerUrl || "")}"></div><div class="profile-head"><div class="profile-photo" data-bg="${escapeHtml(photoUrl || "")}">${photoUrl ? "" : escapeHtml(initials)}</div><div class="profile-title"><h2>${escapeHtml(title)}</h2><p>${escapeHtml(subtitle)}</p><div class="tag-row">${tags.map((tag) => `<span class="tag${tag.startsWith("★") ? " pro-tag" : ""}">${escapeHtml(tag)}</span>`).join("")}</div>${meta}</div><div class="profile-actions">${actions}</div></div><div class="profile-body">${body}</div></article>`;
  }
  const profileSection = (title, content) => `<section class="profile-section"><h3>${title}</h3>${content}</section>`;
  const postCards = (posts, author) => posts.length
    ? posts.map((post) => `<article class="founder-update-card"><strong>${escapeHtml(author)}</strong><small>${new Date(post.created_at).toLocaleString("es-CL")}</small><p>${escapeHtml(post.content)}</p></article>`).join("")
    : '<p class="field-hint">Aún no hay publicaciones.</p>';

  async function openProfile(kind, id) {
    openProfileRef = { kind, id };
    switchRemoteView("profile");
    const page = $("#profile-page");
    page.innerHTML = '<p class="search-empty">Cargando perfil…</p>';
    try {
      page.innerHTML = await buildProfile(kind, id);
      paintDataBg(page);
      renderFollowButtons();
    } catch (error) {
      console.error("No pudimos abrir el perfil:", error);
      page.innerHTML = '<div class="empty-state"><span>⌕</span><h3>No pudimos abrir este perfil</h3><p>Puede que ya no esté publicado.</p></div>';
    }
  }

  const firstError = (...results) => results.find((result) => result.error)?.error;

  async function buildProfile(kind, id) {
    if (kind === "startup") {
      const { data: startup, error } = await supabaseClient.from("startup_profiles").select("*").eq("id", id).single();
      if (error) throw error;
      const [owner, open, posts] = await Promise.all([
        supabaseClient.from("profiles").select("full_name").eq("id", startup.owner_id).maybeSingle(),
        supabaseClient.from("funding_rounds").select("*").eq("startup_id", id).eq("status", "open").maybeSingle(),
        supabaseClient.from("posts").select("*").eq("startup_id", id).order("created_at", { ascending: false }).limit(10)
      ]);
      const failed = firstError(owner, open, posts);
      if (failed) throw failed;
      const counts = await followerCounts(id);
      const round = open.data;
      const own = startup.owner_id === user.id;
      const embed = startup.pitch_video_url ? window.VentureaMedia.toEmbedUrl(startup.pitch_video_url) : null;
      const canInterest = !own && ["investor", "company"].includes(profile.role);
      const ownerPro = await isProUser(startup.owner_id);
      const fileVideo = ownerPro && ownVideoUrl(startup.pitch_video_file_url)
        ? `<video class="profile-video" controls preload="metadata" src="${escapeHtml(startup.pitch_video_file_url)}"></video>` : "";
      const followerSection = await followerListSection(startup, own);
      if (!own) supabaseClient.rpc("record_profile_view", { p_startup_id: id }).then(() => {}, () => {});
      return profileShell({
        bannerUrl: startup.banner_url, photoUrl: startup.logo_url, initials: startup.name.slice(0, 1).toUpperCase(),
        title: startup.name, subtitle: `${startup.city}, Chile · Fundador/a: ${owner.data?.full_name || "Equipo fundador"}`,
        tags: [sectorName(startup.sector_id), startup.business_model, startup.stage, ...(round ? ["Buscando financiamiento"] : []), ...(ownerPro ? ["★ Pro"] : [])],
        meta: followerLine(counts),
        actions: (own ? '<button class="secondary-button" data-edit-own>Editar perfil</button><button class="secondary-button" data-upload="avatar">Cambiar logo</button><button class="secondary-button" data-upload="banner">Cambiar banner</button>' : "") +
          (canFollow() && !own ? `<button class="secondary-button" data-follow="${startup.id}">Seguir</button>` : "") +
          (canInterest ? `<button class="primary-button small-button" data-profile-interest="${startup.id}">♡ Me interesa</button>` : ""),
        body: profileSection("Acerca de", `<p>${escapeHtml(startup.description)}</p>`) +
          (fileVideo ? profileSection("Video pitch", fileVideo) : embed ? profileSection("Video pitch", `<div class="video-frame"><iframe title="Video pitch de ${escapeHtml(startup.name)}" src="${embed}" allowfullscreen loading="lazy" referrerpolicy="strict-origin-when-cross-origin" sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"></iframe></div>`) : "") +
          profileSection("Financiamiento", round
            ? `<p><strong>Ronda abierta · ${escapeHtml(round.stage)}</strong><br>Objetivo ${escapeHtml(money(round.target_usd))} · Ticket ${escapeHtml(money(round.ticket_min_usd))}–${escapeHtml(money(round.ticket_max_usd))}${round.committed_pct ? ` · ${round.committed_pct}% comprometido` : ""}</p>`
            : "<p>Esta startup no está buscando financiamiento por ahora.</p>") +
          followerSection +
          profileSection("Publicaciones", postCards(posts.data || [], startup.name))
      });
    }
    if (kind === "company") {
      const { data: company, error } = await supabaseClient.from("company_profiles").select("*").eq("id", id).single();
      if (error) throw error;
      const challenges = await supabaseClient.from("company_challenges").select("*").eq("company_id", id).eq("status", "open").order("created_at", { ascending: false });
      if (challenges.error) throw challenges.error;
      const own = company.owner_id === user.id;
      const site = /^https?:\/\//.test(company.website || "") ? `<p><a href="${escapeHtml(company.website)}" target="_blank" rel="noopener noreferrer">${escapeHtml(company.website)}</a></p>` : "";
      return profileShell({
        bannerUrl: company.banner_url, photoUrl: company.logo_url, initials: company.name.slice(0, 1).toUpperCase(),
        title: company.name, subtitle: `${company.city}, Chile · ${company.size} personas`,
        tags: [sectorName(company.sector_id), ...((await isProUser(company.owner_id)) ? ["★ Pro"] : []), ...(company.collaboration_types || []).map(collaborationName)],
        actions: own ? '<button class="secondary-button" data-edit-own>Editar perfil</button><button class="secondary-button" data-upload="avatar">Cambiar logo</button><button class="secondary-button" data-upload="banner">Cambiar banner</button>' : "",
        body: profileSection("Acerca de", `<p>${escapeHtml(company.description)}</p>${site}`) +
          profileSection("Desafíos de innovación", (challenges.data || []).length
            ? challenges.data.map((challenge) => `<article class="founder-update-card"><strong>${escapeHtml(challenge.title)}</strong><p>${escapeHtml(challenge.description)}</p></article>`).join("")
            : `<p>${escapeHtml(company.challenges || "Esta empresa no tiene desafíos abiertos.")}</p>`)
      });
    }
    const [person, tagged] = await Promise.all([
      supabaseClient.from("profiles").select("id, role, full_name, city, avatar_url, banner_url, headline, bio").eq("id", id).single(),
      supabaseClient.from("profile_sectors").select("sector_id, kind").eq("profile_id", id)
    ]);
    const failed = firstError(person, tagged);
    if (failed) throw failed;
    const who = person.data;
    const own = who.id === user.id;
    const names = (kindName) => (tagged.data || []).filter((row) => row.kind === kindName).map((row) => `<span class="tag">${escapeHtml(sectorName(row.sector_id))}</span>`).join("") || '<p class="field-hint">Sin información.</p>';
    return profileShell({
      bannerUrl: who.banner_url, photoUrl: who.avatar_url, initials: initialsOf(who.full_name),
      title: who.full_name, subtitle: [who.headline || ROLE_LABELS[who.role] || "", who.city].filter(Boolean).join(" · "),
      actions: own ? '<button class="secondary-button" data-edit-own>Editar perfil</button><button class="secondary-button" data-upload="avatar">Cambiar foto</button><button class="secondary-button" data-upload="banner">Cambiar banner</button>' : "",
      body: profileSection("Acerca de", `<p>${escapeHtml(who.bio || "Aún no hay descripción.")}</p>`) +
        profileSection("Sectores de interés", `<div class="tag-row">${names("interest")}</div>`) +
        profileSection("Experiencia en", `<div class="tag-row">${names("expertise")}</div>`)
    });
  }

  function openOwnProfile() {
    if (profile.role === "startup") return startupProfile ? openProfile("startup", startupProfile.id) : openStartupEditor();
    if (profile.role === "company") return companyProfile ? openProfile("company", companyProfile.id) : openCompanyEditor();
    return openProfile("investor", profile.id);
  }

  function openProfileEditor() {
    if (profile.role === "startup") return openStartupEditor();
    if (profile.role === "company") return openCompanyEditor();
    const form = $("#profile-form");
    form.elements.fullName.value = profile.full_name;
    form.elements.city.value = profile.city ?? "";
    form.elements.headline.value = profile.headline ?? "";
    form.elements.bio.value = profile.bio ?? "";
    setError($("#profile-error"), "");
    setModal($("#profile-modal"), true);
  }

  async function saveProfile(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const { data, error } = await supabaseClient.from("profiles").update({
      full_name: form.elements.fullName.value.trim(), city: form.elements.city.value.trim() || null,
      headline: form.elements.headline.value.trim() || null, bio: form.elements.bio.value.trim() || null
    }).eq("id", user.id).select().single();
    if (error) return setError($("#profile-error"), error.message);
    Object.assign(profile, data);
    setModal($("#profile-modal"), false);
    refreshOwnMedia();
    notify("Perfil actualizado.");
  }

  // Único camino para "Me interesa" (tarjeta, rondas y perfil). Devuelve true si el interés quedó enviado.
  async function sendInterestTo(startupId) {
    const cap = interestLimit() ?? 10;
    const limitMessage = `Llegaste al límite de ${cap} «Me interesa» de este mes. Con el plan Pro son ilimitados.`;
    if (!hasFeature("unlimited_interests") && entitlements.interests_used_month >= cap) {
      notify(limitMessage);
      return false;
    }
    const { error } = await supabaseClient.from("interests").insert({ investor_id: user.id, startup_id: startupId });
    if (error?.code === "23505") {
      notify("Ya enviaste interés por esta startup.");
      return false;
    }
    if (error) {
      if (/LIMIT_INTERESTS/.test(error.message)) { // la base manda: el contador de la pantalla estaba desactualizado
        notify(limitMessage);
        loadEntitlements().catch(() => {});
      } else reportFailure("No pudimos enviar tu interés", error);
      return false;
    }
    notify(`Interés enviado a ${startups.find((item) => item.id === startupId)?.name || "la startup"}. El equipo fundador podrá responderlo.`);
    await Promise.all([loadInterests(), loadEntitlements()]);
    return true;
  }


  // ------------------------------------------------------------------
  // Publicaciones por categoría (filtro en la consulta, con paginación)
  // ------------------------------------------------------------------
  const POSTS_PAGE = 20;
  const postsState = { category: "all", sector: "all", followingOnly: false, offset: 0, request: 0 };
  const categoryName = (id) => postCategories.find((category) => category.id === id)?.name ?? id;
  const categoryTag = (id) => `<span class="tag cat-tag cat-${Math.max(0, postCategories.findIndex((category) => category.id === id))}">${escapeHtml(categoryName(id))}</span>`;
  const canFollow = () => ["investor", "company"].includes(profile.role);

  async function loadPostCategories() {
    const { data, error } = await supabaseClient.from("post_categories").select("id, name, sort_order").order("sort_order");
    if (error) throw error;
    postCategories = data || [];
    $("#post-chips").innerHTML = [["all", "Todas"], ...postCategories.map((category) => [category.id, category.name])].map(([id, label]) =>
      `<button class="chip${id === postsState.category ? " active" : ""}" data-post-cat="${id}" aria-pressed="${id === postsState.category}">${escapeHtml(label)}</button>`).join("");
    $("#post-category").innerHTML = `<option value="">Elige una categoría</option>${postCategories.map((category) => `<option value="${category.id}">${escapeHtml(category.name)}</option>`).join("")}`;
    $("#post-sector-filter").innerHTML = sectorOptions("all", true);
  }

  async function loadUpdates({ append = false } = {}) {
    const request = ++postsState.request; // descarta respuestas viejas si el usuario cambia de filtro rápido
    if (!append) postsState.offset = 0;
    const list = $("#update-list");
    const filtered = postsState.category !== "all" || postsState.sector !== "all" || postsState.followingOnly;
    const empty = filtered
      ? '<div class="empty-state"><span>◷</span><h3>Sin publicaciones con estos filtros</h3><p>Prueba con otra categoría o sector.</p></div>'
      : '<div class="empty-state"><span>◷</span><h3>Sin actualizaciones todavía</h3><p>Las novedades de startups chilenas aparecerán aquí.</p></div>';
    let query = supabaseClient.from("posts").select("*").order("created_at", { ascending: false });
    if (postsState.category !== "all") query = query.eq("category", postsState.category);
    let allowed = null; // startups permitidas por los filtros de sector y "solo de quienes sigo"
    if (postsState.sector !== "all") allowed = startups.filter((startup) => startup.sector_id === postsState.sector).map((startup) => startup.id);
    if (postsState.followingOnly) allowed = (allowed ?? [...followingIds]).filter((id) => followingIds.has(id));
    if (allowed && !allowed.length) {
      list.innerHTML = empty;
      $("#update-more").hidden = true;
      return;
    }
    if (allowed) query = query.in("startup_id", allowed);
    const { data, error } = await query.range(postsState.offset, postsState.offset + POSTS_PAGE); // una fila extra indica que hay más
    if (error) throw error;
    const page = (data || []).slice(0, POSTS_PAGE);
    const ids = [...new Set(page.map((post) => post.startup_id))];
    const { data: companies, error: companiesError } = ids.length
      ? await supabaseClient.from("startup_profiles").select("id, name, sector_id, logo_url").in("id", ids)
      : { data: [] };
    if (companiesError) throw companiesError;
    if (request !== postsState.request) return;
    postsState.offset += page.length;
    $("#update-more").hidden = (data || []).length <= POSTS_PAGE;
    if (!page.length && !append) {
      list.innerHTML = empty;
      return;
    }
    const lookup = new Map(companies.map((company) => [company.id, company]));
    const html = page.map((post) => {
      const company = lookup.get(post.startup_id);
      if (!company) return "";
      return `<article class="update-item"><span class="update-logo" data-bg="${escapeHtml(company.logo_url || "")}">${company.logo_url ? "" : escapeHtml(company.name.slice(0, 1))}</span><div class="update-copy"><strong>${escapeHtml(company.name)} <span class="tag">${escapeHtml(sectorName(company.sector_id))}</span> ${categoryTag(post.category)}</strong><small>${new Date(post.created_at).toLocaleString("es-CL")}</small><p>${escapeHtml(post.content)}</p></div></article>`;
    }).join("");
    if (append) list.insertAdjacentHTML("beforeend", html);
    else list.innerHTML = html;
    paintDataBg(list);
  }

  const reloadUpdates = () => loadUpdates().catch((error) => reportFailure("No pudimos cargar las actualizaciones", error));

  async function loadOwnPosts() {
    if (!startupProfile) return;
    const { data, error } = await supabaseClient.from("posts").select("*").eq("startup_id", startupProfile.id).order("created_at", { ascending: false }).limit(20);
    if (error) throw error;
    $("#founder-updates").innerHTML = (data || []).map((post) => `<article class="founder-update-card"><strong>${categoryTag(post.category)}</strong><small>${new Date(post.created_at).toLocaleString("es-CL")}</small><p>${escapeHtml(post.content)}</p></article>`).join("");
  }

  // ------------------------------------------------------------------
  // Buscar financiamiento: rondas que la startup abre, pausa y cierra cuando quiere
  // ------------------------------------------------------------------
  const ROUND_STATUS = { draft: "Borrador", open: "Abierta", paused: "Pausada", closed: "Cerrada" };

  async function loadFundingRounds() {
    if (!startupProfile) return;
    const { data, error } = await supabaseClient.from("funding_rounds").select("*").eq("startup_id", startupProfile.id).order("created_at", { ascending: false });
    if (error) throw error;
    fundingRounds = data || [];
    renderFundingPanel();
  }

  function renderFundingPanel() {
    const open = fundingRounds.find((round) => round.status === "open");
    const paused = fundingRounds.find((round) => round.status === "paused");
    $("#funding-switch").checked = Boolean(open);
    setText("#funding-switch-label", open ? "Sí" : "No");
    setText("#round-status", open ? "Ronda abierta" : paused ? "Ronda pausada" : "Perfil publicado");
    $("#funding-status").textContent = open
      ? `Ronda abierta · ${open.stage} · objetivo ${money(open.target_usd)} · ticket ${money(open.ticket_min_usd)}–${money(open.ticket_max_usd)}`
      : paused ? `Ronda pausada · ${paused.stage} · objetivo ${money(paused.target_usd)}` : "No estás buscando financiamiento.";
    $("#funding-actions").innerHTML = open
      ? `<button class="secondary-button" data-round-action="paused" data-round-id="${open.id}">Pausar</button><button class="secondary-button" data-round-action="closed" data-round-id="${open.id}">Cerrar ronda</button>`
      : paused
        ? `<button class="secondary-button" data-round-action="open" data-round-id="${paused.id}">Reabrir</button><button class="secondary-button" data-round-action="closed" data-round-id="${paused.id}">Cerrar ronda</button><button class="secondary-button" data-open-round-form>Abrir otra ronda</button>`
        : '<button class="secondary-button" data-open-round-form>Abrir una ronda</button>';
    $("#funding-history").innerHTML = fundingRounds.length
      ? fundingRounds.map((round) => `<div class="funding-row"><span class="tag round-${round.status}">${ROUND_STATUS[round.status]}</span><strong>${escapeHtml(round.stage)} · ${escapeHtml(money(round.target_usd))}</strong><small>Ticket ${escapeHtml(money(round.ticket_min_usd))}–${escapeHtml(money(round.ticket_max_usd))} · creada el ${new Date(round.created_at).toLocaleDateString("es-CL")}</small></div>`).join("")
      : "";
  }

  function openRoundForm() {
    if (!startupProfile) return openStartupEditor();
    const form = $("#round-form");
    form.elements.stage.value = startupProfile.stage;
    form.elements.target.value = startupProfile.target_amount_usd;
    form.elements.ticketMin.value = startupProfile.preferred_check_min_usd;
    form.elements.ticketMax.value = startupProfile.preferred_check_max_usd;
    form.elements.committed.value = 0;
    form.elements.closesAt.value = "";
    setError($("#round-error"), "");
    setModal($("#round-modal"), true);
  }

  async function refreshAfterRoundChange() {
    await loadFundingRounds();
    await loadStartups();
  }

  async function saveRound(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = {
      startup_id: startupProfile.id, status: "open", stage: form.elements.stage.value,
      target_usd: Number(form.elements.target.value), ticket_min_usd: Number(form.elements.ticketMin.value), ticket_max_usd: Number(form.elements.ticketMax.value),
      committed_pct: Number(form.elements.committed.value || 0), opens_at: new Date().toISOString(),
      closes_at: form.elements.closesAt.value ? new Date(`${form.elements.closesAt.value}T23:59:59`).toISOString() : null
    };
    const errorBox = $("#round-error");
    if (values.ticket_max_usd < values.ticket_min_usd) return setError(errorBox, "El ticket máximo debe ser igual o mayor que el mínimo.");
    if (values.committed_pct < 0 || values.committed_pct > 100) return setError(errorBox, "El capital comprometido debe estar entre 0 % y 100 %.");
    if (fundingRounds.some((round) => round.status === "open")) return setError(errorBox, "Ya tienes una ronda abierta. Pausa o ciérrala antes de abrir otra.");
    const { error } = await supabaseClient.from("funding_rounds").insert(values);
    if (error) {
      console.error("No pudimos abrir la ronda:", error);
      return setError(errorBox, error.message);
    }
    setModal($("#round-modal"), false);
    await refreshAfterRoundChange();
    notify("Ronda abierta. Tus seguidores recibirán un aviso.");
  }

  async function setRoundStatus(id, status) {
    const { error } = await supabaseClient.from("funding_rounds").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) {
      await loadFundingRounds(); // devuelve el interruptor a su estado real
      return reportFailure("No pudimos actualizar la ronda", error);
    }
    await refreshAfterRoundChange();
    notify({ open: "Ronda reabierta.", paused: "Ronda pausada.", closed: "Ronda cerrada." }[status]);
  }

  function handleFundingSwitch(event) {
    const input = event.currentTarget;
    if (input.checked) {
      input.checked = false; // se enciende recién cuando la ronda queda guardada
      return openRoundForm();
    }
    const open = fundingRounds.find((round) => round.status === "open");
    if (open) setRoundStatus(open.id, "paused");
  }

  function handleFundingClick(event) {
    if (event.target.closest("[data-open-round-form]")) return openRoundForm();
    const action = event.target.closest("[data-round-action]");
    if (action) setRoundStatus(action.dataset.roundId, action.dataset.roundAction);
  }

  // ------------------------------------------------------------------
  // Seguidores: botón Seguir y conteo separado entre inversionistas y empresas
  // ------------------------------------------------------------------
  async function refreshFollowIds() {
    const { data, error } = await supabaseClient.from("follows").select("startup_id").eq("follower_id", user.id);
    if (error) throw error;
    followingIds = new Set((data || []).map((row) => row.startup_id));
  }

  function renderFollowButtons() {
    const label = (id) => (followingIds.has(id) ? "Siguiendo ✓" : "Seguir");
    const current = rankedStartups[selectedIndex];
    const button = $("#follow-button");
    button.hidden = !canFollow() || !current;
    if (current) {
      button.textContent = label(current.id);
      button.setAttribute("aria-pressed", String(followingIds.has(current.id)));
    }
    $$("[data-follow]").forEach((element) => {
      element.textContent = label(element.dataset.follow);
      element.setAttribute("aria-pressed", String(followingIds.has(element.dataset.follow)));
    });
  }

  async function toggleFollow(startupId) {
    if (!canFollow()) return;
    const following = followingIds.has(startupId);
    const { error } = following
      ? await supabaseClient.from("follows").delete().eq("follower_id", user.id).eq("startup_id", startupId)
      : await supabaseClient.from("follows").insert({ follower_id: user.id, startup_id: startupId });
    if (error && error.code !== "23505") return reportFailure(following ? "No pudimos dejar de seguir" : "No pudimos seguir", error);
    if (following) followingIds.delete(startupId);
    else followingIds.add(startupId);
    renderFollowButtons();
    notify(`${following ? "Dejaste de seguir a" : "Ahora sigues a"} ${startups.find((startup) => startup.id === startupId)?.name ?? "la startup"}.`);
    if ($("#view-profile").classList.contains("active") && openProfileRef?.kind === "startup" && openProfileRef.id === startupId) {
      followerCounts(startupId).then((counts) => { const line = $("#follower-line"); if (line) line.outerHTML = followerLine(counts); }).catch(() => {});
    }
    if (profile.role === "company") loadFollowing().catch((failure) => reportFailure("No pudimos actualizar tus seguidos", failure));
  }

  async function followerCounts(startupId) {
    const { data, error } = await supabaseClient.rpc("follower_counts", { p_startup_id: startupId });
    if (error) throw error;
    const row = (Array.isArray(data) ? data[0] : data) || {};
    return { total: Number(row.total || 0), investors: Number(row.investors || 0), companies: Number(row.companies || 0) };
  }
  const followerLine = (counts) => `<p class="follower-line" id="follower-line"><strong>${counts.total}</strong> seguidores · <span class="role-investor">${counts.investors} inversionistas</span> · <span class="role-company">${counts.companies} empresas</span></p>`;

  async function loadFollowerStats() {
    if (!startupProfile) return;
    const counts = await followerCounts(startupProfile.id);
    setText("#followers-investors", counts.investors);
    setText("#followers-companies", counts.companies);
  }

  // ------------------------------------------------------------------
  // Notificaciones: campana, historial, aviso emergente y Realtime (con consulta cada 60 s si falla)
  // ------------------------------------------------------------------
  const notifications = { items: [], unread: 0, seen: new Set(), channel: null, pollTimer: null, guardTimer: null, subscribed: false };
  const NOTIFICATION_ROLE = { investor: "inversionista", company: "empresa", startup: "startup" };

  async function notificationContext(list) {
    const actorIds = [...new Set(list.map((item) => item.actor_id).filter(Boolean))];
    const entityIds = [...new Set(list.map((item) => item.entity_id).filter(Boolean))];
    const [actors, entities] = await Promise.all([
      actorIds.length ? supabaseClient.from("profiles").select("id, full_name, role, avatar_url").in("id", actorIds) : { data: [] },
      entityIds.length ? supabaseClient.from("startup_profiles").select("id, name").in("id", entityIds) : { data: [] }
    ]);
    const failed = firstError(actors, entities);
    if (failed) throw failed;
    return { actors: new Map(actors.data.map((row) => [row.id, row])), entities: new Map(entities.data.map((row) => [row.id, row])) };
  }

  function describeNotification(item, context) {
    const actor = context.actors.get(item.actor_id);
    const entity = context.entities.get(item.entity_id);
    const who = actor ? `${actor.full_name} (${NOTIFICATION_ROLE[actor.role] || "usuario"})` : "Alguien";
    const startupName = entity?.name ?? "una startup";
    if (item.type === "follow") return `${who} comenzó a seguir a ${startupName}`;
    if (item.type === "interest") return `${who} quiere conocer a ${startupName}`;
    if (item.type === "match") return `Match mutuo: ${startupName} aceptó tu interés`;
    if (item.type === "round_opened") return `${startupName} abrió una ronda de financiamiento`;
    if (item.type === "billing") return "Tu pago está pendiente: actualiza tu medio de pago para conservar Pro.";
    return "Tienes una notificación nueva";
  }

  function renderBadge() {
    const badge = $("#notif-badge");
    badge.hidden = !notifications.unread;
    badge.textContent = notifications.unread > 99 ? "99+" : String(notifications.unread);
    $("#notification-button").setAttribute("aria-label", notifications.unread ? `Notificaciones, ${notifications.unread} sin leer` : "Notificaciones");
  }

  async function loadNotifications() {
    const { data, error } = await supabaseClient.from("notifications").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(30);
    if (error) throw error;
    notifications.items = data || [];
    notifications.items.forEach((item) => notifications.seen.add(item.id));
    notifications.unread = notifications.items.filter((item) => !item.read_at).length; // cuenta sobre las últimas 30
    renderBadge();
  }

  async function renderNotificationPanel() {
    const panel = $("#notification-panel");
    if (!notifications.items.length) {
      panel.innerHTML = '<p class="search-empty">Aún no tienes notificaciones.</p>';
      return;
    }
    const context = await notificationContext(notifications.items);
    panel.innerHTML = `<h3>Notificaciones</h3>${notifications.items.map((item) => `<button class="notice-row${item.read_at ? "" : " unread"}" data-notice-open="${item.id}"><span>${escapeHtml(describeNotification(item, context))}</span><small>${new Date(item.created_at).toLocaleString("es-CL")}</small></button>`).join("")}`;
  }

  async function markNotificationsRead() {
    const stamp = new Date().toISOString();
    const { error } = await supabaseClient.from("notifications").update({ read_at: stamp }).eq("user_id", user.id).is("read_at", null);
    if (error) return reportFailure("No pudimos marcar las notificaciones como leídas", error);
    notifications.items.forEach((item) => { item.read_at ??= stamp; });
    notifications.unread = 0;
    renderBadge();
  }

  async function toggleNotificationPanel(event) {
    event?.stopPropagation();
    const panel = $("#notification-panel");
    panel.hidden = !panel.hidden;
    $("#notification-button").setAttribute("aria-expanded", String(!panel.hidden));
    if (panel.hidden) return;
    try {
      await renderNotificationPanel();
    } catch (error) {
      return reportFailure("No pudimos cargar tus notificaciones", error);
    }
    if (notifications.unread) await markNotificationsRead(); // el panel conserva el resaltado de lo nuevo hasta que se cierre
  }

  async function showNoticePopup(item) {
    let context = { actors: new Map(), entities: new Map() };
    try {
      context = await notificationContext([item]);
    } catch (error) {
      console.error("No pudimos completar el aviso:", error);
    }
    const actor = context.actors.get(item.actor_id);
    const card = document.createElement("div");
    card.className = "notice-card";
    card.setAttribute("role", "status");
    card.innerHTML = `<span class="avatar notice-avatar" data-bg="${escapeHtml(actor?.avatar_url || "")}">${actor?.avatar_url ? "" : escapeHtml(initialsOf(actor?.full_name || "V"))}</span><div class="notice-copy"><p>${escapeHtml(describeNotification(item, context))}</p><button class="text-button" data-notice-open="${item.id}">Ver perfil</button></div><button class="notice-close" aria-label="Cerrar aviso">×</button>`;
    paintDataBg(card);
    const stack = $("#notice-stack");
    stack.append(card);
    while (stack.children.length > 3) stack.firstElementChild.remove(); // máximo 3 apilados
    window.setTimeout(() => card.remove(), 6000);
  }

  function receiveNotification(item) {
    if (!item || notifications.seen.has(item.id)) return;
    notifications.seen.add(item.id);
    notifications.items.unshift(item);
    if (!item.read_at) notifications.unread++;
    renderBadge();
    if (!$("#notification-panel").hidden) renderNotificationPanel().catch(() => {});
    showNoticePopup(item);
  }

  async function pollNotifications() {
    const { data, error } = await supabaseClient.from("notifications").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(30);
    if (error) return console.error("No pudimos consultar las notificaciones:", error);
    [...(data || [])].reverse().forEach(receiveNotification);
  }

  function startPolling() {
    if (!notifications.pollTimer) notifications.pollTimer = window.setInterval(pollNotifications, config.notificationPollMs || 60000);
  }

  function stopPolling() {
    window.clearInterval(notifications.pollTimer);
    notifications.pollTimer = null;
  }

  function stopNotifications() {
    stopPolling();
    window.clearTimeout(notifications.guardTimer);
    if (notifications.channel) supabaseClient.removeChannel(notifications.channel);
    Object.assign(notifications, { items: [], unread: 0, seen: new Set(), channel: null, subscribed: false });
    $("#notice-stack").innerHTML = "";
    $("#notification-panel").hidden = true;
  }

  function startNotifications(signal) {
    stopNotifications();
    signal.addEventListener("abort", stopNotifications);
    loadNotifications().catch((error) => reportFailure("No pudimos cargar tus notificaciones", error));
    notifications.channel = supabaseClient.channel(`notifications-${user.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` }, (payload) => receiveNotification(payload.new))
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          notifications.subscribed = true;
          stopPolling();
        } else if (["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"].includes(status)) {
          notifications.subscribed = false;
          startPolling();
        }
      });
    notifications.guardTimer = window.setTimeout(() => { if (!notifications.subscribed) startPolling(); }, 10000);
  }

  async function openNotificationTarget(item) {
    if (item.type === "billing") return openPlan();
    if (["match", "round_opened"].includes(item.type)) return openProfile("startup", item.entity_id);
    const { data: actor, error } = await supabaseClient.from("profiles").select("id, role").eq("id", item.actor_id).maybeSingle();
    if (error || !actor) return notify("No pudimos abrir ese perfil.");
    if (actor.role === "company") {
      const { data: company } = await supabaseClient.from("company_profiles").select("id").eq("owner_id", actor.id).maybeSingle();
      return company ? openProfile("company", company.id) : notify("Esa empresa aún no tiene perfil publicado.");
    }
    return openProfile("investor", actor.id);
  }

  function handleNoticeClick(event) {
    if (event.target.closest(".notice-close")) return event.target.closest(".notice-card").remove();
    const open = event.target.closest("[data-notice-open]");
    if (!open) return;
    const item = notifications.items.find((entry) => entry.id === open.dataset.noticeOpen);
    $("#notification-panel").hidden = true;
    $("#notification-button").setAttribute("aria-expanded", "false");
    if (item) openNotificationTarget(item);
  }

  // ------------------------------------------------------------------
  // Planes y privilegios: la base de datos decide; la pantalla solo lo refleja
  // ------------------------------------------------------------------
  let entitlements = { effective_status: "free", is_pro: false, features: [], free_limits: {}, interests_used_month: 0, open_challenges: 0 };
  let proOwners = new Set();
  const advanced = { city: "", sector: "all", traction: 0, model: "all" };
  const hasFeature = (feature) => Boolean(entitlements.is_pro && (entitlements.features || []).includes(feature));
  const planDate = (value) => new Date(value).toLocaleDateString("es-CL", { day: "numeric", month: "short" });
  const daysLeft = (value) => Math.max(0, Math.ceil((new Date(value) - Date.now()) / 86400000));
  const interestLimit = () => Number(entitlements.free_limits?.interests_per_month) || null;
  const challengeLimit = () => Number(entitlements.free_limits?.open_challenges) || null;
  const PRO_TAG = '<span class="tag pro-tag">★ Pro</span>';

  // [texto, función que lo desbloquea (null = incluido en Free)]
  const PLAN_TABLE = {
    startup: {
      free: ["Perfil completo, banner, foto y video por enlace", "1 ronda abierta", "Número de seguidores", "Recibir intereses"],
      pro: [["Ver quién te sigue", "follower_list"], ["Estadísticas de visitas", "profile_stats"], ["Aparecer destacada en Descubrir", "featured"], ["Subir video propio", "video_upload"], ["Insignia Pro", "pro_badge"]]
    },
    investor: {
      free: ["10 «Me interesa» al mes", "Filtros por sector, etapa y ticket", "Seguir startups"],
      pro: [["«Me interesa» ilimitados", "unlimited_interests"], ["Filtros avanzados (tracción, modelo, ciudad)", "advanced_filters"], ["Alertas de nuevas rondas", "round_alerts"], ["Ver quién más sigue una startup", "followers_of_startup"]]
    },
    company: {
      free: ["1 desafío publicado", "10 «Me interesa» al mes", "Seguir startups"],
      pro: [["Desafíos ilimitados", "unlimited_challenges"], ["«Me interesa» ilimitados", "unlimited_interests"], ["Búsqueda avanzada", "advanced_search"], ["Exportar listas", "export_lists"], ["Insignia Pro", "pro_badge"]]
    }
  };

  async function loadEntitlements() {
    const { data, error } = await supabaseClient.from("my_entitlements").select("*").maybeSingle();
    if (error) throw error;
    if (data) entitlements = data; // sin fila (p. ej. administrador) se mantiene Free
    renderPlanCard();
    renderInterestMeter();
    renderAdvancedFilters();
    renderProRail();
    if ($("#view-plan").classList.contains("active")) renderPlanView();
  }

  function planSummary() {
    const e = entitlements;
    const free = profile.role === "startup"
      ? "Perfil completo, 1 ronda abierta y seguidores."
      : interestLimit() ? `${e.interests_used_month} de ${interestLimit()} «Me interesa» este mes.` : "Descubrimiento, perfiles y conexiones.";
    if (e.effective_status === "trialing") {
      const days = daysLeft(e.trial_ends_at);
      return { tag: "PRUEBA PRO", title: `Prueba Pro · quedan ${days} ${days === 1 ? "día" : "días"}`, copy: "Tienes todos los privilegios Pro hasta que termine la prueba.", cta: "Elegir plan Pro" };
    }
    if (e.effective_status === "active") return { tag: "PLAN PRO", title: e.current_period_end ? `Pro · se renueva el ${planDate(e.current_period_end)}` : "Pro activo", copy: "Tienes todos los privilegios Pro.", cta: null };
    if (e.effective_status === "past_due") return { tag: "PAGO PENDIENTE", title: "Pago pendiente · actualiza tu medio de pago", copy: `Conservas Pro hasta el ${planDate(e.grace_ends_at)}; después volverás a Free.`, cta: "Actualizar pago", alert: true };
    if (e.effective_status === "canceled") return { tag: "PRO HASTA", title: `Pro hasta el ${planDate(e.current_period_end)} · no se renovará`, copy: "Después volverás al plan Free.", cta: "Reactivar Pro" };
    if (e.effective_status === "expired") return { tag: "PLAN FREE", title: "Tu plan Pro venció", copy: "Volviste a Free: tus datos Pro se conservan, pero están bloqueados.", cta: "Volver a Pro" };
    return { tag: "PLAN FREE", title: "Estás en el plan Free.", copy: free, cta: "Mejorar a Pro" };
  }

  function renderPlanCard() {
    const summary = planSummary();
    setText("#plan-tag", summary.tag);
    setText("#plan-title", summary.title);
    setText("#plan-copy", summary.copy);
    $("#plan-card").classList.toggle("alert", Boolean(summary.alert));
    const button = $("#plan-cta");
    button.hidden = !summary.cta || !["startup", "investor", "company"].includes(profile.role);
    if (summary.cta) button.textContent = summary.cta;
    setText("#stat-plan", entitlements.is_pro ? "Pro" : "Free");
    setText("#stat-plan-note", entitlements.is_pro ? summary.title : summary.copy);
  }

  function renderProRail() {
    const copy = {
      startup: ["Destaca tu startup", "Ve quién te sigue, mide tus visitas, aparece destacada y sube tu propio video."],
      investor: ["Invierte sin tope", "«Me interesa» ilimitados, filtros avanzados y alertas de nuevas rondas."],
      company: ["Colabora sin límites", "Desafíos ilimitados, búsqueda avanzada y exportación de listas."]
    }[profile.role];
    $("#pro-rail").hidden = !copy || entitlements.is_pro;
    if (copy) {
      setText("#pro-rail-title", copy[0]);
      setText("#pro-rail-copy", copy[1]);
    }
  }

  function renderInterestMeter() {
    const meter = $("#interest-meter");
    const applies = ["investor", "company"].includes(profile.role);
    meter.hidden = !applies;
    if (!applies) return;
    const unlimited = hasFeature("unlimited_interests");
    const cap = interestLimit() ?? 10;
    meter.textContent = unlimited ? "Ilimitados · Pro" : `${entitlements.interests_used_month} de ${cap} este mes`;
    meter.classList.toggle("limit", !unlimited && entitlements.interests_used_month >= cap);
  }

  function renderPlanView() {
    const summary = planSummary();
    const table = PLAN_TABLE[profile.role];
    const meter = (label, used, cap) => `<div class="meter-row"><span>${label}</span><strong>${used} de ${cap}</strong><progress max="${cap}" value="${Math.min(used, cap)}"></progress></div>`;
    let usage = "";
    if (!entitlements.is_pro && ["investor", "company"].includes(profile.role)) usage += meter("«Me interesa» este mes", entitlements.interests_used_month, interestLimit() ?? 10);
    if (!entitlements.is_pro && profile.role === "company") usage += meter("Desafíos abiertos", entitlements.open_challenges, challengeLimit() ?? 1);
    $("#plan-status").innerHTML = `<div class="plan-status-card${summary.alert ? " alert" : ""}"><div><span class="pro-badge">${summary.tag}</span><h2>${escapeHtml(summary.title)}</h2><p>${escapeHtml(summary.copy)}</p></div>${summary.cta && table ? `<button class="primary-button" data-checkout>${summary.cta}</button>` : ""}</div>${usage}`;
    $("#plan-compare").innerHTML = table
      ? `<div class="plan-col"><h3>Free</h3><ul>${table.free.map((item) => `<li>✓ ${escapeHtml(item)}</li>`).join("")}</ul></div><div class="plan-col pro"><h3>Pro <span class="pro-badge">PRO</span></h3><ul>${table.pro.map(([label, key]) => `<li>${hasFeature(key) ? "✓" : "🔒"} ${escapeHtml(label)}</li>`).join("")}</ul></div>`
      : "";
  }

  function openPlan() {
    switchRemoteView("plan");
    loadEntitlements().catch((error) => reportFailure("No pudimos actualizar tu plan", error));
  }

  // Sin pasarela configurada no se inventa un pago: se explica y los estados se cambian a mano en Supabase.
  function startCheckout() {
    if (config.checkoutUrl) return window.open(config.checkoutUrl, "_blank", "noopener");
    notify("Los pagos aún no están habilitados. Escríbenos y activamos tu plan Pro manualmente.");
  }

  // Marca de "Pro" visible para todos (insignia y destacada). Para el propio usuario basta su suscripción.
  async function isProUser(userId) {
    if (userId === user.id) return entitlements.is_pro;
    if (proOwners.has(userId)) return true;
    const { data, error } = await supabaseClient.rpc("pro_user_ids", { p_ids: [userId] });
    if (error) return false;
    return (data || []).includes(userId);
  }

  function passesAdvanced(startup) {
    const feature = profile.role === "investor" ? "advanced_filters" : "advanced_search";
    if (!hasFeature(feature)) return true; // sin Pro, los filtros avanzados no se aplican
    if (advanced.city && !startup.city.toLocaleLowerCase().includes(advanced.city.toLocaleLowerCase())) return false;
    if (profile.role === "investor") {
      if (Number(startup.traction_score) < advanced.traction) return false;
      return advanced.model === "all" || startup.business_model === advanced.model;
    }
    return advanced.sector === "all" || startup.sector_id === advanced.sector;
  }

  function renderAdvancedFilters() {
    const applies = ["investor", "company"].includes(profile.role);
    $("#advanced-card").hidden = !applies;
    if (!applies) return;
    const investor = profile.role === "investor";
    const unlocked = hasFeature(investor ? "advanced_filters" : "advanced_search");
    $("#adv-sector").innerHTML = sectorOptions(advanced.sector, true);
    $("#adv-sector-label").hidden = investor;
    $("#adv-traction-label").hidden = !investor;
    $("#adv-model-label").hidden = !investor;
    $$("#advanced-fields input, #advanced-fields select").forEach((field) => { field.disabled = !unlocked; });
    $("#advanced-lock").hidden = unlocked;
  }

  async function applyAdvancedFilters() {
    Object.assign(advanced, { city: $("#adv-city").value.trim(), sector: $("#adv-sector").value, traction: Number($("#adv-traction").value), model: $("#adv-model").value });
    selectedIndex = 0;
    await loadStartups();
    renderRemoteCard();
    if (profile.role === "company" && companyProfile) renderCompanyRail();
  }

  async function loadVisitStats() {
    if (!startupProfile) return;
    const lock = () => {
      setText("#views-30d", "🔒");
      setText("#views-note", "Función Pro");
    };
    if (!hasFeature("profile_stats")) return lock();
    const { data, error } = await supabaseClient.rpc("startup_view_stats", { p_startup_id: startupProfile.id });
    if (/FEATURE_LOCKED/.test(error?.message || "")) return lock(); // la base manda: el plan cambió desde la última lectura
    if (error) throw error;
    const row = (Array.isArray(data) ? data[0] : data) || {};
    setText("#views-30d", Number(row.views_30d || 0));
    setText("#views-note", `${Number(row.views_7d || 0)} en los últimos 7 días`);
  }

  // Seguidores con nombre: la startup Pro ve a los suyos; el inversionista Pro, los de cualquier startup (la RLS lo decide).
  async function followerListSection(startup, own) {
    if (!own && profile.role !== "investor") return "";
    const unlocked = own ? hasFeature("follower_list") : hasFeature("followers_of_startup");
    if (!unlocked) return profileSection("Quién sigue", '<p class="locked-note">🔒 Ver los nombres de quienes siguen es una función del plan Pro. <button class="text-button" data-open-plan>Ver plan</button></p>');
    const { data: follows, error } = await supabaseClient.from("follows").select("follower_id").eq("startup_id", startup.id);
    if (error) throw error;
    const ids = [...new Set((follows || []).map((row) => row.follower_id))];
    if (!ids.length) return profileSection("Quién sigue", '<p class="field-hint">Aún no tiene seguidores.</p>');
    const { data: people, error: peopleError } = await supabaseClient.from("profiles").select("id, full_name, role").in("id", ids);
    if (peopleError) throw peopleError;
    return profileSection("Quién sigue", `<div class="tag-row">${people.map((person) => `<span class="tag ${person.role === "company" ? "follower-company" : "follower-investor"}">${escapeHtml(person.full_name)} · ${escapeHtml(NOTIFICATION_ROLE[person.role] || "")}</span>`).join("")}</div>`);
  }

  // Video propio: solo se reproduce desde nuestro Storage y mientras el plan Pro de su dueño esté vigente.
  const ownVideoUrl = (url) => typeof url === "string" && url.startsWith(`${config.supabaseUrl.replace(/\/$/, "")}/storage/v1/object/public/pitch-videos/`);

  async function exportLists() {
    if (!hasFeature("export_lists")) {
      notify("Exportar listas es una función del plan Pro.");
      return openPlan();
    }
    const [follows, interests] = await Promise.all([
      supabaseClient.from("follows").select("startup_id").eq("follower_id", user.id),
      supabaseClient.from("interests").select("startup_id, status").eq("investor_id", user.id)
    ]);
    const failed = firstError(follows, interests);
    if (failed) return reportFailure("No pudimos exportar tus listas", failed);
    const find = (id) => startups.find((startup) => startup.id === id);
    const row = (type, id, state) => { const s = find(id); return s ? [type, s.name, sectorName(s.sector_id), s.city, state] : null; };
    const rows = [["Lista", "Startup", "Sector", "Ciudad", "Estado"],
      ...(follows.data || []).map((item) => row("Seguida", item.startup_id, "Siguiendo")),
      ...(interests.data || []).map((item) => row("Interés", item.startup_id, { pending: "Pendiente", matched: "Match", rejected: "No aceptado" }[item.status] || item.status))
    ].filter(Boolean);
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob(["﻿", window.VentureaMedia.toCsv(rows)], { type: "text/csv;charset=utf-8" }));
    link.download = "venturea-mis-listas.csv";
    link.click();
    URL.revokeObjectURL(link.href);
    notify("Listas exportadas.");
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
    if (!target || (!["profile", "plan"].includes(name) && !MENUS[profile.role].some(([view]) => view === name))) return;
    $$(".view").forEach((view) => view.classList.toggle("active", view === target));
    $$(".nav-link[data-view]").forEach((link) => link.classList.toggle("active", link.dataset.view === name));
    $("#breadcrumb-current").textContent = VIEW_TITLES[name];
    if (name === "matches") (profile.role === "investor" ? loadInterests() : loadRequests()).catch((error) => reportFailure("No pudimos cargar tus conexiones", error));
    if (name === "updates") loadUpdates().catch((error) => reportFailure("No pudimos cargar las actualizaciones", error));
    if (name === "funds") renderRemoteFunds();
    if (name === "company") renderCompanyDashboard();
    if (name === "plan") renderPlanView();
    if (name === "challenges") loadChallenges().catch((error) => reportFailure("No pudimos cargar tus desafíos", error));
    if (name === "following") loadFollowing().catch((error) => reportFailure("No pudimos cargar tus seguidos", error));
    if (name === "startup") renderStartupDashboard();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function sendInterest() {
    const startup = rankedStartups[selectedIndex];
    if (startup && await sendInterestTo(startup.id)) nextStartup();
  }

  function nextStartup() {
    if (rankedStartups.length) selectedIndex = (selectedIndex + 1) % rankedStartups.length;
    renderRemoteCard();
  }

  // Casillas agrupadas por rubro, tomadas del catálogo (agregar un sector en la tabla lo hace aparecer aquí).
  function sectorChecklist(selected) {
    const active = sectors.filter((sector) => sector.is_active);
    return [...new Set(active.map((sector) => sector.group_name))].map((group) =>
      `<div class="preference-group"><div class="preference-group-title">${escapeHtml(group)}</div><div class="preference-chips">${active.filter((sector) => sector.group_name === group).map((sector) =>
        `<label class="preference-option"><input type="checkbox" name="sector" value="${sector.id}" ${selected.includes(sector.id) ? "checked" : ""}>${escapeHtml(sector.name)}</label>`).join("")}</div></div>`).join("");
  }

  function filterSectorChecklist() {
    const query = $("#sector-search").value.trim().toLocaleLowerCase();
    $$("#sector-options .preference-option").forEach((option) => { option.hidden = !option.textContent.toLocaleLowerCase().includes(query); });
    $$("#sector-options .preference-group").forEach((group) => { group.hidden = !$$(".preference-option:not([hidden])", group).length; });
  }

  function openPreferences() {
    const stages = ["Pre-seed", "Seed", "Serie A"];
    $("#sector-search").value = "";
    $("#sector-options").innerHTML = sectorChecklist(investorPreferences.sectors);
    $("#stage-options").innerHTML = stages.map((stage) => `<label class="preference-option"><input type="checkbox" name="stage" value="${stage}" ${investorPreferences.stages.includes(stage) ? "checked" : ""}>${stage}</label>`).join("");
    $("#preferences-form").elements.investorType.value = investorPreferences.investor_type;
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
    // Primero se agregan y después se quitan sectores: si algo falla, no se pierde la tesis anterior.
    const added = sectors.filter((sector) => !investorPreferences.sectors.includes(sector));
    const removed = investorPreferences.sectors.filter((sector) => !sectors.includes(sector));
    if (added.length) {
      const { error } = await supabaseClient.from("profile_sectors").insert(added.map((sector_id) => ({ profile_id: user.id, sector_id, kind: "interest" })));
      if (error) return reportFailure("No pudimos guardar tus sectores", error);
      investorPreferences.sectors = [...investorPreferences.sectors, ...added];
    }
    if (removed.length) {
      const { error } = await supabaseClient.from("profile_sectors").delete().eq("profile_id", user.id).eq("kind", "interest").in("sector_id", removed);
      if (error) return reportFailure("No pudimos guardar tus sectores", error);
    }
    const { data, error } = await supabaseClient.from("investor_preferences")
      .update({ stages, min_ticket_usd: minTicket, max_ticket_usd: maxTicket, investor_type: form.elements.investorType.value }).eq("user_id", user.id).select().single();
    if (error) {
      reportFailure("No pudimos guardar tu tesis", error);
      return;
    }
    investorPreferences = { ...data, sectors, sector_expertise: investorPreferences.sector_expertise };
    selectedIndex = 0;
    await loadStartups();
    renderRemoteCard();
    $("#investor-sector-pills").innerHTML = sectors.map((sector) => `<span>${escapeHtml(sectorName(sector))}</span>`).join("");
    $("#investor-stage-value").textContent = stages.join(" · ");
    $("#investor-ticket-value").textContent = `${money(minTicket)} – ${money(maxTicket)}`;
    setModal($("#preferences-modal"), false);
    notify("Tesis actualizada. Las startups se recalcularon.");
  }

  function openStartupEditor() {
    fillStartupProfileForm();
    setError($("#startup-profile-error"), "");
    const canUpload = hasFeature("video_upload");
    $("#pitch-file").value = "";
    $("#pitch-file").disabled = !canUpload;
    setText("#pitch-file-hint", canUpload ? "MP4 o WebM, hasta 100 MB. Se muestra en tu perfil." : "MP4 o WebM, hasta 100 MB. Disponible en el plan Pro.");
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
      sector_id: form.elements.sector.value,
      description: form.elements.description.value.trim(),
      stage: form.elements.stage.value,
      target_amount_usd: Number(form.elements.target.value),
      preferred_check_min_usd: Number(form.elements.checkMin.value),
      preferred_check_max_usd: Number(form.elements.checkMax.value),
      business_model: form.elements.businessModel.value,
      pitch_video_url: form.elements.pitchVideo.value.trim() || null,
      desired_investor_types: startupProfile?.desired_investor_types || ["Angel", "VC"],
      desired_stages: startupProfile?.desired_stages || [form.elements.stage.value],
      is_published: true
    };
    if (values.description.length < 20 || values.description.length > 1000) {
      setError($("#startup-profile-error"), "La descripción debe tener entre 20 y 1.000 caracteres.");
      return;
    }
    if (values.pitch_video_url && !window.VentureaMedia.toEmbedUrl(values.pitch_video_url)) {
      setError($("#startup-profile-error"), "El video debe ser un enlace de YouTube, Vimeo o Loom.");
      return;
    }
    if (values.preferred_check_max_usd < values.preferred_check_min_usd) {
      setError($("#startup-profile-error"), "El ticket máximo debe ser igual o mayor que el mínimo.");
      return;
    }
    // owner_id y country solo se escriben al crear; traction_score e is_fundraising no son editables desde el navegador.
    const videoFile = $("#pitch-file").files[0];
    if (videoFile) {
      const problem = hasFeature("video_upload") ? window.VentureaMedia.validateVideoFile(videoFile) : "Subir video propio es una función del plan Pro.";
      if (problem) return setError($("#startup-profile-error"), problem);
      const path = `${user.id}/pitch-${Date.now()}.${videoFile.type === "video/webm" ? "webm" : "mp4"}`; // la política exige la carpeta {user_id}/
      const { error: uploadError } = await supabaseClient.storage.from("pitch-videos").upload(path, videoFile, { contentType: videoFile.type });
      if (uploadError) return setError($("#startup-profile-error"), uploadError.message);
      values.pitch_video_file_url = supabaseClient.storage.from("pitch-videos").getPublicUrl(path).data.publicUrl;
    }
    const { owner_id, country, ...editable } = values;
    const query = startupProfile
      ? supabaseClient.from("startup_profiles").update(editable).eq("id", startupProfile.id)
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
    const category = $("#post-category").value;
    if (!content) return notify("Escribe una actualización antes de publicarla.");
    if (!category) return notify("Elige una categoría para tu publicación.");
    const { error } = await supabaseClient.from("posts").insert({
      startup_id: startupProfile.id,
      author_id: user.id,
      content,
      category
    });
    if (error) return reportFailure("No pudimos publicar la actualización", error);
    input.value = "";
    $("#post-category").value = "";
    loadOwnPosts().catch((failure) => reportFailure("No pudimos cargar tus publicaciones", failure));
    notify("Actualización publicada para la comunidad.");
    switchRemoteView("updates");
  }

  async function handleRemoteClick(event) {
    if (event.target.closest("[data-open-plan]")) return openPlan();
    if (event.target.closest("[data-checkout]")) return startCheckout();
    if (event.target.closest("[data-export-lists]")) return exportLists();
    const upload = event.target.closest("[data-upload]");
    if (upload) return openImageUploader(upload.dataset.upload);
    const follow = event.target.closest("[data-follow]");
    if (follow) return toggleFollow(follow.dataset.follow);
    const profileLink = event.target.closest("[data-open-profile]");
    if (profileLink) {
      const [kind, id] = profileLink.dataset.openProfile.split(":");
      return openProfile(kind, id);
    }
    if (event.target.closest("[data-edit-own]")) return openProfileEditor();
    const profileInterest = event.target.closest("[data-profile-interest]");
    if (profileInterest) return sendInterestTo(profileInterest.dataset.profileInterest);
    const challengeToggle = event.target.closest("[data-challenge-toggle]");
    if (challengeToggle) {
      const { error } = await supabaseClient.from("company_challenges").update({ status: challengeToggle.dataset.status }).eq("id", challengeToggle.dataset.challengeToggle);
      if (error) {
        if (/LIMIT_CHALLENGES/.test(error.message)) return notify("El plan Free permite un desafío abierto. Cierra el otro o pasa a Pro para reabrir este.");
        return reportFailure("No pudimos actualizar el desafío", error);
      }
      return loadChallenges();
    }
    const viewButton = event.target.closest("[data-open-view]");
    if (viewButton) switchRemoteView(viewButton.dataset.openView);
    const interestButton = event.target.closest("[data-fund-interest]");
    if (interestButton && ["investor", "company"].includes(profile.role)) {
      return sendInterestTo(interestButton.dataset.fundInterest);
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
  [["close-profile-modal", "profile-modal"], ["close-image-modal", "image-modal"], ["close-pitch-modal", "pitch-modal"], ["close-round-modal", "round-modal"]].forEach(([button, modal]) => {
    $(`#${button}`).addEventListener("click", () => setModal($(`#${modal}`), false));
    $(`#${modal}`).addEventListener("click", (event) => { if (event.target === $(`#${modal}`)) setModal($(`#${modal}`), false); });
  });
  $("#company-profile-form").addEventListener("submit", saveCompanyProfile);
  $("#profile-form").addEventListener("submit", saveProfile);
  $("#challenge-form").addEventListener("submit", saveChallenge);
  $("#image-file").addEventListener("change", pickImage);
  $("#image-zoom").addEventListener("input", (event) => { if (imageDraft) { imageDraft.zoom = Number(event.target.value); drawCrop(); } });
  $("#image-save").addEventListener("click", saveImage);
  $("#image-canvas").addEventListener("pointerdown", dragCrop);
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
