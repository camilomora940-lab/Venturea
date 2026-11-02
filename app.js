const investorProfile = {
  type: "Angel",
  sectors: { Healthtech: 1, "Climate tech": 0.9, "Inteligencia artificial": 0.65 },
  stages: ["Pre-seed", "Seed"],
  minTicketUsd: 25000,
  maxTicketUsd: 250000,
  markets: ["Chile"],
  preferredModels: ["B2B", "B2B2C", "B2C"],
  minTraction: 0.3,
  sectorExpertise: ["Healthtech", "Climate tech", "Inteligencia artificial"],
  localSupport: ["Chile"]
};

const startups = [
  {
    name: "Nébula Health", location: "Santiago, Chile · Fundada en 2022", logo: "N", founder: "Camila López", initials: "CL",
    description: "Diagnóstico preventivo con IA que detecta señales tempranas de enfermedades a partir de análisis de sangre de rutina.",
    sector: "Healthtech", tags: ["Healthtech", "Inteligencia artificial", "Seed"], round: "Seed · USD 1.2M", traction: "3.4x crecimiento", cover: "", progress: 42, amount: "USD 1.2M", stage: "Seed", roundTargetUsd: 1200000, preferredCheckMinUsd: 50000, preferredCheckMaxUsd: 200000, businessModel: "B2B2C", tractionScore: 0.8, desiredInvestorTypes: ["Angel", "VC"], desiredInvestorStages: ["Seed", "Serie A"],
    update: "Cerramos un piloto con 3 clínicas en Santiago. Nuestro modelo detecta 4 biomarcadores con un 96% de precisión."
  },
  {
    name: "Lumen Terra", location: "Valparaíso, Chile · Fundada en 2021", logo: "L", founder: "Andrés Mora", initials: "AM",
    description: "Sensores inteligentes y analítica predictiva para reducir el consumo de agua en operaciones agrícolas.",
    sector: "Climate tech", tags: ["Climate tech", "Agrotech", "Pre-seed"], round: "Pre-seed · USD 650k", traction: "2.1x ahorro hídrico", cover: "cover-climate", progress: 61, amount: "USD 650k", stage: "Pre-seed", roundTargetUsd: 650000, preferredCheckMinUsd: 25000, preferredCheckMaxUsd: 150000, businessModel: "B2B", tractionScore: 0.65, desiredInvestorTypes: ["Angel", "VC", "Corporate"], desiredInvestorStages: ["Pre-seed", "Seed"],
    update: "Nuestra tecnología ya monitorea más de 800 hectáreas y ayudó a reducir el consumo de agua un 31%."
  },
  {
    name: "Finova", location: "Santiago, Chile · Fundada en 2023", logo: "F", founder: "Lucía Herrera", initials: "LH",
    description: "Infraestructura de pagos transfronterizos que hace que las transferencias para pymes sean rápidas y transparentes.",
    sector: "Fintech", tags: ["Fintech", "Pagos", "Seed"], round: "Seed · USD 2.4M", traction: "18k pymes activas", cover: "cover-fintech", progress: 36, amount: "USD 2.4M", stage: "Seed", roundTargetUsd: 2400000, preferredCheckMinUsd: 100000, preferredCheckMaxUsd: 250000, businessModel: "B2B", tractionScore: 0.8, desiredInvestorTypes: ["VC", "Corporate"], desiredInvestorStages: ["Seed", "Serie A"],
    update: "Lanzamos pagos instantáneos en dos nuevos corredores y superamos las 18,000 pymes activas."
  },
  {
    name: "Nodo", location: "Concepción, Chile · Fundada en 2020", logo: "n", founder: "Mateo Ruiz", initials: "MR",
    description: "Una plataforma de automatización que conecta los datos y herramientas de equipos operativos sin código.",
    sector: "SaaS", tags: ["SaaS", "Automatización", "Serie A"], round: "Serie A · USD 5M", traction: "126% retención neta", cover: "cover-saas", progress: 72, amount: "USD 5M", stage: "Serie A", roundTargetUsd: 5000000, preferredCheckMinUsd: 250000, preferredCheckMaxUsd: 1000000, businessModel: "B2B", tractionScore: 1, desiredInvestorTypes: ["VC", "Corporate"], desiredInvestorStages: ["Seed", "Serie A"],
    update: "Alcanzamos 126% de retención neta de ingresos y lanzamos 15 integraciones nuevas para equipos."
  },
  {
    name: "Prisma AI", location: "Santiago, Chile · Fundada en 2022", logo: "P", founder: "Sofía Vidal", initials: "SV",
    description: "Modelos de IA que ayudan a equipos de atención al cliente a resolver consultas complejas con contexto.",
    sector: "Inteligencia artificial", tags: ["IA", "SaaS", "Seed"], round: "Seed · USD 900k", traction: "4.2x crecimiento", cover: "cover-ai", progress: 48, amount: "USD 900k", stage: "Seed", roundTargetUsd: 900000, preferredCheckMinUsd: 50000, preferredCheckMaxUsd: 200000, businessModel: "B2B", tractionScore: 0.75, desiredInvestorTypes: ["Angel", "VC"], desiredInvestorStages: ["Pre-seed", "Seed"],
    update: "Nuestro copiloto ya resuelve el 62% de las consultas sin escalamiento en 14 empresas."
  },
  {
    name: "Raíz", location: "Temuco, Chile · Fundada en 2023", logo: "R", founder: "Diego Paredes", initials: "DP",
    description: "Ingredientes funcionales de origen vegetal para alimentos más nutritivos y cadenas de suministro regenerativas.",
    sector: "Climate tech", tags: ["Foodtech", "Climate tech", "Pre-seed"], round: "Pre-seed · USD 400k", traction: "12 productores asociados", cover: "cover-food", progress: 29, amount: "USD 400k", stage: "Pre-seed", roundTargetUsd: 400000, preferredCheckMinUsd: 25000, preferredCheckMaxUsd: 100000, businessModel: "B2B", tractionScore: 0.55, desiredInvestorTypes: ["Angel", "VC", "Corporate"], desiredInvestorStages: ["Pre-seed", "Seed"],
    update: "Sumamos 12 productores a nuestra red y comenzamos pruebas de nuestro ingrediente en dos marcas."
  }
];

const extraFunds = [
  { name: "BioLoop", logo: "B", location: "Santiago, Chile", sector: "Climate tech", stage: "Pre-seed", description: "Transformamos residuos orgánicos en bioplásticos compostables para empaques.", amount: "USD 500k", progress: 33 },
  { name: "Kipu", logo: "K", location: "Santiago, Chile", sector: "Fintech", stage: "Seed", description: "Crédito accesible para pequeñas empresas, con evaluación basada en datos alternativos.", amount: "USD 1.8M", progress: 57 },
  { name: "MedLink", logo: "M", location: "Valparaíso, Chile", sector: "Healthtech", stage: "Serie A", description: "Conectamos laboratorios y clínicas con una red de diagnóstico digital.", amount: "USD 4M", progress: 68 },
  { name: "Orbit", logo: "O", location: "Concepción, Chile", sector: "SaaS", stage: "Seed", description: "Software financiero para equipos de operaciones en empresas de alto crecimiento.", amount: "USD 1.1M", progress: 44 },
  { name: "Solaris", logo: "S", location: "Antofagasta, Chile", sector: "Climate tech", stage: "Serie A", description: "Energía solar como servicio para comercios y pequeñas industrias.", amount: "USD 3.2M", progress: 71 },
  { name: "Vita", logo: "V", location: "Puerto Montt, Chile", sector: "Healthtech", stage: "Pre-seed", description: "Atención preventiva personalizada para comunidades poco atendidas.", amount: "USD 350k", progress: 22 }
];

const initialUpdates = [
  { company: "Nébula Health", logo: "N", sector: "Healthtech", time: "hace 2 horas", text: startups[0].update },
  { company: "Lumen Terra", logo: "L", sector: "Climate tech", time: "hace 1 día", text: startups[1].update },
  { company: "Finova", logo: "F", sector: "Fintech", time: "hace 2 días", text: startups[2].update }
];

const store = {
  read(key, fallback) {
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : fallback;
    } catch (error) {
      console.error(`No se pudo leer ${key} del almacenamiento local.`, error);
      return fallback;
    }
  },
  write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error(`No se pudo guardar ${key} en el almacenamiento local.`, error);
      showToast("No pudimos guardar el cambio en este navegador.");
    }
  }
};

const chileanStartupNames = new Set(startups.map((startup) => startup.name));
let pendingInterests = store.read("venturea-interests", store.read("venturea-matches", [])).filter((interest) => chileanStartupNames.has(interest.name));
let confirmedMatches = store.read("venturea-confirmed-matches", []).filter((match) => chileanStartupNames.has(match.name));
let updates = store.read("venturea-updates", initialUpdates).filter((update) => chileanStartupNames.has(update.company));
let publishedRounds = store.read("venturea-rounds", []).map((round) => ({
  ...round,
  location: round.location || "Santiago, Chile",
  country: "Chile"
}));
let seen = store.read("venturea-seen", []).filter((name) => chileanStartupNames.has(name));
let rankedStartups = [];
let currentIndex = 0;
let currentAssessment = null;
let toastTimer;
const storedPreferences = store.read("venturea-investor-preferences", {});
let investorPreferences = {
  ...investorProfile,
  ...storedPreferences,
  sectors: storedPreferences.sectors || investorProfile.sectors
};
const availableSectors = {
  Healthtech: 1,
  "Climate tech": 0.9,
  "Inteligencia artificial": 0.65,
  Fintech: 0.6,
  SaaS: 0.55
};
const availableStages = ["Pre-seed", "Seed", "Serie A"];

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("visible"), 2600);
}

function ticketFit(startup) {
  if (investorPreferences.minTicketUsd === investorPreferences.maxTicketUsd) {
    return investorPreferences.minTicketUsd >= startup.preferredCheckMinUsd && investorPreferences.minTicketUsd <= startup.preferredCheckMaxUsd ? 1 : 0;
  }
  const overlap = Math.max(0, Math.min(investorPreferences.maxTicketUsd, startup.preferredCheckMaxUsd) - Math.max(investorPreferences.minTicketUsd, startup.preferredCheckMinUsd));
  const startupRange = startup.preferredCheckMaxUsd - startup.preferredCheckMinUsd;
  return startupRange > 0 ? Math.min(1, overlap / startupRange) : 0;
}

function calculateCompatibility(startup) {
  const sectorAffinity = investorPreferences.sectors[startup.sector] || 0;
  const stageFit = investorPreferences.stages.includes(startup.stage) ? 1 : 0;
  const checkFit = ticketFit(startup);
  const marketFit = investorPreferences.markets.includes("Chile") && startup.location.includes("Chile") ? 1 : 0;
  const modelFit = investorPreferences.preferredModels.includes(startup.businessModel) ? 1 : 0;
  const tractionFit = Math.min(1, startup.tractionScore / investorPreferences.minTraction);
  const investorScore = Math.round(100 * (
    sectorAffinity * 0.25 + stageFit * 0.2 + checkFit * 0.2 +
    marketFit * 0.15 + modelFit * 0.1 + tractionFit * 0.1
  ));

  const typeFit = startup.desiredInvestorTypes.includes(investorPreferences.type) ? 1 : 0;
  const expertiseFit = investorPreferences.sectorExpertise.includes(startup.sector) ? 1 : 0;
  const localSupportFit = investorPreferences.localSupport.includes("Chile") && startup.location.includes("Chile") ? 1 : 0;
  const startupStageFit = startup.desiredInvestorStages.some((stage) => investorPreferences.stages.includes(stage)) ? 1 : 0;
  const startupScore = Math.round(100 * (
    typeFit * 0.25 + checkFit * 0.25 + expertiseFit * 0.25 +
    localSupportFit * 0.15 + startupStageFit * 0.1
  ));

  return {
    investorScore,
    startupScore,
    combinedScore: Math.round(Math.sqrt(investorScore * startupScore)),
    checkFit
  };
}

function passesHardFilters(startup) {
  return Object.hasOwn(investorPreferences.sectors, startup.sector) &&
    investorPreferences.stages.includes(startup.stage) &&
    ticketFit(startup) > 0 &&
    startup.location.includes("Chile") &&
    startup.desiredInvestorTypes.includes(investorPreferences.type) &&
    startup.desiredInvestorStages.some((stage) => investorPreferences.stages.includes(stage)) &&
    startup.tractionScore >= investorPreferences.minTraction;
}

function diversifyBySector(candidates) {
  const sectors = new Map();
  candidates.forEach((candidate) => {
    const sectorCandidates = sectors.get(candidate.sector) || [];
    sectorCandidates.push(candidate);
    sectors.set(candidate.sector, sectorCandidates);
  });
  const diversified = [];
  while (sectors.size) {
    for (const [sector, sectorCandidates] of sectors) {
      diversified.push(sectorCandidates.shift());
      if (!sectorCandidates.length) sectors.delete(sector);
    }
  }
  return diversified;
}

function prepareDiscovery() {
  const eligible = startups
    .filter(passesHardFilters)
    .map((startup) => ({ ...startup, assessment: calculateCompatibility(startup) }))
    .sort((a, b) => b.assessment.combinedScore - a.assessment.combinedScore);
  const unseen = eligible.filter((startup) => !seen.includes(startup.name));
  if (!unseen.length && eligible.length) {
    seen = [];
    store.write("venturea-seen", seen);
  }
  rankedStartups = diversifyBySector(unseen.length ? unseen : eligible);
  currentIndex = 0;
}

function renderCard() {
  const startup = rankedStartups[currentIndex];
  if (!startup) {
    $("#startup-card").hidden = true;
    $("#no-compatible-startups").hidden = false;
    $("#card-number").textContent = "00 / 00";
    return;
  }
  $("#startup-card").hidden = false;
  $("#no-compatible-startups").hidden = true;
  currentAssessment = startup.assessment;
  $("#card-number").textContent = `${String(currentIndex + 1).padStart(2, "0")} / ${String(rankedStartups.length).padStart(2, "0")}`;
  $("#card-cover").className = `startup-cover ${startup.cover}`;
  $("#company-logo").textContent = startup.logo;
  $("#company-name").textContent = startup.name;
  $("#company-location").textContent = startup.location;
  $("#company-description").textContent = startup.description;
  $("#company-round").textContent = startup.round;
  $("#company-traction").textContent = startup.traction;
  $("#company-fit").innerHTML = `${currentAssessment.combinedScore}% <span>✦</span>`;
  $("#score-breakdown").textContent = `Tu encaje ${currentAssessment.investorScore}% · Encaje con lo que busca la startup ${currentAssessment.startupScore}%`;
  $("#score-reasons").innerHTML = [
    `Sector ${escapeHtml(startup.sector)}`,
    `Etapa ${escapeHtml(startup.stage)}`,
    `Ticket USD ${investorPreferences.minTicketUsd.toLocaleString("en-US")}–${investorPreferences.maxTicketUsd.toLocaleString("en-US")}`,
    "Mercado chileno"
  ].map((reason) => `<span>${reason}</span>`).join("");
  $("#founder-name").textContent = startup.founder;
  $("#founder-avatar").textContent = startup.initials;
  $("#company-tags").innerHTML = startup.tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("");
  $("#bookmark-button").classList.toggle("saved", store.read("venturea-saved", []).includes(startup.name));
  $("#bookmark-button").textContent = $("#bookmark-button").classList.contains("saved") ? "♥" : "♡";
}

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
}

function goToNext() {
  if (!rankedStartups.length) return;
  seen = [...new Set([...seen, rankedStartups[currentIndex].name])];
  store.write("venturea-seen", seen);
  if (currentIndex + 1 >= rankedStartups.length) {
    prepareDiscovery();
    showToast("¡Exploraste todas! Te mostramos nuevas opciones.");
  } else {
    currentIndex += 1;
  }
  renderCard();
}

function updateMatchCount() {
  $("#match-count").textContent = pendingInterests.length;
  $("#stat-matches").textContent = String(startups.filter(passesHardFilters).length).padStart(2, "0");
  $("#interested-count").textContent = 37 + pendingInterests.length;
}

function renderMatches() {
  const target = $("#match-list");
  if (!pendingInterests.length && !confirmedMatches.length) {
    target.innerHTML = `<div class="empty-state"><span>♡</span><h3>Tu próximo match empieza aquí</h3><p>Explora startups y envía interés. Solo habrá match cuando la startup también acepte.</p><button class="primary-button" data-open-view="discover">Descubrir startups</button></div>`;
    return;
  }
  const confirmed = confirmedMatches.map((startup) => `<article class="match-item"><span class="match-logo">${escapeHtml(startup.logo)}</span><div class="match-item-info"><strong>${escapeHtml(startup.name)}</strong><small>Match mutuo · ${escapeHtml(startup.sector)} · ${escapeHtml(startup.location.split("·")[0].trim())}</small></div><button class="text-button" data-contact="${escapeHtml(startup.name)}">Iniciar conversación →</button></article>`).join("");
  const pending = pendingInterests.map((startup) => `<article class="match-item"><span class="match-logo">${escapeHtml(startup.logo)}</span><div class="match-item-info"><strong>${escapeHtml(startup.name)}</strong><small>Interés enviado · Compatibilidad ${startup.assessment?.combinedScore || calculateCompatibility(startups.find((item) => item.name === startup.name)).combinedScore}% · Esperando respuesta</small></div><span class="interest-pending">Pendiente</span></article>`).join("");
  target.innerHTML = `${confirmed ? `<h2 class="match-section-title">Matches mutuos</h2>${confirmed}` : ""}${pending ? `<h2 class="match-section-title">Intereses enviados</h2>${pending}` : ""}`;
}

function renderInvestorProfile() {
  const sectors = Object.keys(investorPreferences.sectors);
  $("#investor-sector-pills").innerHTML = sectors.length
    ? sectors.map((sector) => `<span>${escapeHtml(sector)}</span>`).join("")
    : "<span>Sin sectores</span>";
  $("#investor-stage-value").textContent = investorPreferences.stages.join(" · ") || "Sin etapas";
  $("#investor-ticket-value").textContent = `USD ${investorPreferences.minTicketUsd.toLocaleString("en-US")} – ${investorPreferences.maxTicketUsd.toLocaleString("en-US")}`;
  $("#investor-compatible-count").textContent = `${startups.filter(passesHardFilters).length} startups pasan tus filtros`;
}

function openPreferencesModal() {
  $("#sector-options").innerHTML = Object.keys(availableSectors).map((sector) => `<label class="preference-option"><input type="checkbox" name="sector" value="${escapeHtml(sector)}" ${Object.hasOwn(investorPreferences.sectors, sector) ? "checked" : ""} />${escapeHtml(sector)}</label>`).join("");
  $("#stage-options").innerHTML = availableStages.map((stage) => `<label class="preference-option"><input type="checkbox" name="stage" value="${escapeHtml(stage)}" ${investorPreferences.stages.includes(stage) ? "checked" : ""} />${escapeHtml(stage)}</label>`).join("");
  $("input[name='minTicket']").value = investorPreferences.minTicketUsd;
  $("input[name='maxTicket']").value = investorPreferences.maxTicketUsd;
  $("#preferences-modal").classList.add("open");
  $("#preferences-modal").setAttribute("aria-hidden", "false");
}

function closePreferencesModal() {
  $("#preferences-modal").classList.remove("open");
  $("#preferences-modal").setAttribute("aria-hidden", "true");
}

function renderUpdates() {
  const target = $("#update-list");
  target.innerHTML = updates.map((update) => `<article class="update-item"><span class="update-logo">${escapeHtml(update.logo)}</span><div class="update-copy"><strong>${escapeHtml(update.company)} <span class="tag">${escapeHtml(update.sector)}</span></strong><small>Actualización para inversores</small><p>${escapeHtml(update.text)}</p></div><span class="update-meta">${escapeHtml(update.time)}</span></article>`).join("");
}

function renderFunds() {
  const sector = $("#fund-filter").value;
  const stage = $("#stage-filter").value;
  const fundItems = [
    ...startups.map((startup) => ({ ...startup, description: startup.description, country: "Chile" })),
    ...extraFunds.map((fund) => ({ ...fund, country: "Chile" })),
    ...publishedRounds.filter((round) => round.country === "Chile")
  ];
  const filtered = fundItems.filter((fund) => (sector === "all" || fund.sector === sector) && (stage === "all" || fund.stage === stage));
  $("#fund-opportunity-count").textContent = filtered.length;
  $("#fund-grid").innerHTML = filtered.length ? filtered.map((fund) => `<article class="fund-card"><div class="fund-card-top"><span class="fund-card-logo">${escapeHtml(fund.logo)}</span><span class="fund-stage">${escapeHtml(fund.stage)}</span></div><h3>${escapeHtml(fund.name)}</h3><span class="fund-sector">${escapeHtml(fund.sector)} · ${escapeHtml(fund.location || "Chile")}</span><p>${escapeHtml(fund.description)}</p><div class="fund-progress-row"><span>Capital comprometido</span><strong>${fund.progress}%</strong></div><div class="progress-track"><span style="width:${Math.min(100, Math.max(0, Number(fund.progress) || 0))}%"></span></div><div class="fund-card-footer"><span>Objetivo <strong>${escapeHtml(fund.amount)}</strong></span><button data-fund-interest="${escapeHtml(fund.name)}">Me interesa →</button></div></article>`).join("") : `<div class="no-results">No hay rondas que coincidan. Prueba otro filtro.</div>`;
}

function renderFounderUpdates() {
  const ownUpdates = updates.filter((update) => update.company === "Nébula Health");
  $("#founder-updates").innerHTML = ownUpdates.map((update) => `<article class="founder-update-card"><strong>Actualización para inversores</strong><small>${escapeHtml(update.time)}</small><p>${escapeHtml(update.text)}</p></article>`).join("");
}

function switchView(name) {
  const target = $(`#view-${name}`);
  if (!target) return;
  $$(".view").forEach((view) => view.classList.remove("active"));
  target.classList.add("active");
  $$(".nav-link[data-view]").forEach((link) => link.classList.toggle("active", link.dataset.view === name));
  $("#breadcrumb-current").textContent = ({ discover: "Descubrir", matches: "Intereses y matches", updates: "Actualizaciones", funds: "Rondas abiertas", startup: "Mi startup" })[name];
  if (name === "matches") renderMatches();
  if (name === "updates") renderUpdates();
  if (name === "funds") renderFunds();
  if (name === "startup") renderFounderUpdates();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function addMatch() {
  const startup = rankedStartups[currentIndex];
  if (!startup) return;
  if (!pendingInterests.some((interest) => interest.name === startup.name) && !confirmedMatches.some((match) => match.name === startup.name)) {
    pendingInterests = [...pendingInterests, { ...startup, assessment: currentAssessment }];
    store.write("venturea-interests", pendingInterests);
    updateMatchCount();
    showToast(`Interés enviado a ${startup.name}. El match requiere aceptación mutua.`);
  } else {
    showToast(`Ya tienes un interés registrado en ${startup.name}.`);
  }
  goToNext();
}

function openModal() {
  $("#fund-modal").classList.add("open");
  $("#fund-modal").setAttribute("aria-hidden", "false");
  $("input[name='amount']").focus();
}

function closeModal() {
  $("#fund-modal").classList.remove("open");
  $("#fund-modal").setAttribute("aria-hidden", "true");
}

function closeOpenModal() {
  closeModal();
  closePreferencesModal();
}

function initializeDemo() {
$$(".nav-link[data-view]").forEach((link) => link.addEventListener("click", () => switchView(link.dataset.view)));
$("#like-button").addEventListener("click", addMatch);
$("#pass-button").addEventListener("click", goToNext);
$("#bookmark-button").addEventListener("click", () => {
  const saved = store.read("venturea-saved", []);
  const name = rankedStartups[currentIndex].name;
  const next = saved.includes(name) ? saved.filter((item) => item !== name) : [...saved, name];
  store.write("venturea-saved", next);
  renderCard();
  showToast(next.includes(name) ? "Startup guardada en tu lista." : "Startup quitada de tu lista.");
});
$("#info-button").addEventListener("click", () => showToast("Vista de perfil completa: próximamente."));
$("#tip-close").addEventListener("click", (event) => event.currentTarget.closest(".bottom-tip").remove());
$("#fund-filter").addEventListener("change", renderFunds);
$("#stage-filter").addEventListener("change", renderFunds);
$("#open-fund-modal").addEventListener("click", openModal);
$("#startup-create-fund").addEventListener("click", openModal);
$("#close-fund-modal").addEventListener("click", closeModal);
$("#fund-modal").addEventListener("click", (event) => { if (event.target === $("#fund-modal")) closeModal(); });
$("#edit-filters").addEventListener("click", openPreferencesModal);
$("#empty-edit-filters").addEventListener("click", openPreferencesModal);
$("#close-preferences-modal").addEventListener("click", closePreferencesModal);
$("#preferences-modal").addEventListener("click", (event) => { if (event.target === $("#preferences-modal")) closePreferencesModal(); });
$("#preferences-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const sectors = data.getAll("sector").map(String);
  const stages = data.getAll("stage").map(String);
  const minTicketUsd = Number(data.get("minTicket"));
  const maxTicketUsd = Number(data.get("maxTicket"));
  if (!sectors.length || !stages.length || minTicketUsd <= 0 || maxTicketUsd < minTicketUsd) {
    showToast("Selecciona al menos un sector y una etapa, y revisa el rango de inversión.");
    return;
  }
  investorPreferences = {
    ...investorPreferences,
    sectors: Object.fromEntries(sectors.map((sector) => [sector, availableSectors[sector]])),
    stages,
    minTicketUsd,
    maxTicketUsd
  };
  store.write("venturea-investor-preferences", investorPreferences);
  seen = [];
  store.write("venturea-seen", seen);
  prepareDiscovery();
  renderCard();
  renderInvestorProfile();
  updateMatchCount();
  closePreferencesModal();
  showToast("Tu tesis se actualizó y el ranking fue recalculado.");
});
document.addEventListener("keydown", (event) => { if (event.key === "Escape") closeOpenModal(); });
$("#fund-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const round = {
    name: String(data.get("startup")).trim(),
    logo: String(data.get("startup")).trim().charAt(0).toUpperCase(),
    location: `${String(data.get("city")).trim()}, Chile`,
    country: "Chile",
    sector: String(data.get("sector")),
    stage: String(data.get("stage")),
    description: String(data.get("description")).trim(),
    amount: `USD ${Number(data.get("amount")).toLocaleString("en-US")}`,
    progress: Math.max(0, Math.min(100, Number(data.get("committed")) || 0))
  };
  if (!round.name || !String(data.get("city")).trim() || !round.description || Number(data.get("amount")) < 1000) {
    showToast("Completa la ciudad en Chile y revisa que el objetivo sea de al menos USD 1,000.");
    return;
  }
  publishedRounds = [round, ...publishedRounds.filter((item) => item.name.toLowerCase() !== round.name.toLowerCase())];
  store.write("venturea-rounds", publishedRounds);
  $("#round-status").textContent = "Publicada";
  event.currentTarget.reset();
  closeModal();
  renderFunds();
  showToast("Tu ronda se publicó en esta demo.");
});
$("#publish-update").addEventListener("click", () => {
  const field = $("#update-input");
  const text = field.value.trim();
  if (!text) {
    showToast("Escribe una actualización antes de publicarla.");
    field.focus();
    return;
  }
  updates = [{ company: "Nébula Health", logo: "N", sector: "Healthtech", time: "ahora", text }, ...updates];
  store.write("venturea-updates", updates);
  field.value = "";
  renderFounderUpdates();
  showToast("Actualización publicada en tu perfil.");
});
$("#global-search").addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    const query = event.currentTarget.value.trim().toLowerCase();
    const found = rankedStartups.findIndex((startup) => `${startup.name} ${startup.sector} ${startup.tags.join(" ")}`.toLowerCase().includes(query));
    if (found >= 0) {
      currentIndex = found;
      renderCard();
      switchView("discover");
    } else {
      showToast("No encontramos startups compatibles con esa búsqueda.");
    }
  }
});
document.addEventListener("click", (event) => {
  const viewButton = event.target.closest("[data-open-view]");
  if (viewButton) switchView(viewButton.dataset.openView);
  const contactButton = event.target.closest("[data-contact]");
  if (contactButton) showToast(`La conversación con ${contactButton.dataset.contact} estará disponible próximamente.`);
  const interestButton = event.target.closest("[data-fund-interest]");
  if (interestButton) showToast(`Marcaste interés en ${interestButton.dataset.fundInterest}.`);
});
$("#notification-button").addEventListener("click", () => switchView("updates"));
$("#profile-button").addEventListener("click", () => switchView("startup"));
$("#edit-startup").addEventListener("click", () => showToast("La edición avanzada del perfil estará disponible próximamente."));

prepareDiscovery();
renderCard();
updateMatchCount();
renderInvestorProfile();
renderFounderUpdates();
}

if (window.VENTUREA_CONFIG?.supabaseUrl && window.VENTUREA_CONFIG?.supabaseAnonKey) {
  window.initializeSupabaseApp();
} else {
  const status = document.querySelector("#backend-status");
  status.hidden = false;
  status.textContent = "Modo demo: perfiles de ejemplo y datos guardados solo en este navegador. Configura Supabase para habilitar cuentas y datos compartidos.";
  initializeDemo();
}
