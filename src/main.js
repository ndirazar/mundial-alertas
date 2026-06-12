import "./style.css";
import { normalizeEspnEventPayload } from "./matchInsights.js";
import { getBroadcastInfo } from "./data/broadcasts.js";
import { TEAM_RANKING } from "./data/teamRanking.js";
import { STADIUMS, STADIUMS_BY_GROUND } from "./data/stadiums.js";
import { SQUADS } from "./data/squads.js";
import SQUADS_2026 from "./data/squads-2026-app.json";
import { getMatchPrediction } from "./utils/predictions.js";

const FIXTURE_URL =
  "https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json";
const LOCAL_FIXTURE_URL = "/fixture/worldcup-2026.json";
const RESULTS_URL =
  "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=20260611-20260719&limit=200";
const TEAMS_URL =
  "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/teams?limit=100";
const ROSTER_URL =
  "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/teams";
const BALLDONTLIE_API_URL = "https://api.balldontlie.io/fifa/worldcup/v1";
const BALLDONTLIE_API_KEY = import.meta.env.VITE_BALLDONTLIE_API_KEY?.trim();
const SQUAD_SEASON = 2026;
const SQUAD_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const RESULTS_REFRESH_INTERVAL_MS = 60 * 1000;
const RESULTS_REQUEST_TTL_MS = 2 * 60 * 1000;
const ARGENTINA_TIME_ZONE = "America/Argentina/Buenos_Aires";
const ARGENTINA_LOCALE = "es-AR";

const IMPORTANT_TEAMS_DEFAULT = [
  "Argentina",
  "Brazil",
  "France",
  "Germany",
  "Spain",
  "England",
  "Portugal",
  "Uruguay",
  "Netherlands",
  "Italy",
  "Mexico",
  "Ecuador",
  "Paraguay",
  "Colombia",
];

const STORAGE_KEYS = {
  importantOnly: "mundial.importantOnly",
  importantTeams: "mundial.importantTeams",
  resultsCache: "mundial.resultsCache",
  squadCache: "mundial.squadCache",
  pwaInstalled: "mundial.pwaInstalled",
};

const SQUAD_COACH_OVERRIDES = {
  Germany: "Julian Nagelsmann",
  "Saudi Arabia": "Georgios Donis",
  Algeria: "Vladimir Petkovic",
  Argentina: "Lionel Scaloni",
  Australia: "Tony Popovic",
  Austria: "Ralf Rangnick",
  Belgium: "Rudi Garcia",
  "Bosnia & Herzegovina": "Sergej Barbarez",
  Brazil: "Carlo Ancelotti",
  "Cape Verde": "Bubista",
  Canada: "Jesse Marsch",
  Qatar: "Julen Lopetegui",
  Colombia: "Néstor Lorenzo",
  "South Korea": "Hong Hyung-Bo",
  "Ivory Coast": "Emerse Fae",
  Croatia: "Zlatko Dalic",
  "Curaçao": "Dick Advocaat",
  Ecuador: "Sebastián Beccacece",
  Egypt: "Hossam Hassan",
  Scotland: "Steve Clarke",
  Spain: "Luis de la Fuente",
  USA: "Mauricio Pochettino",
  France: "Didier Deschamps",
  Ghana: "Carlos Queiroz",
  Haiti: "Sébastien Migné",
  England: "Thomas Tuchel",
  Iraq: "Graham Arnold",
  Iran: "Amir Ghalenoei",
  Japan: "Hajime Moriyasu",
  Jordan: "Jamal Sellami",
  Morocco: "Mohamed Ouahbi",
  Mexico: "Javier Aguirre",
  Norway: "Stale Solbakken",
  "New Zealand": "Darren Bazeley",
  Netherlands: "Ronald Koeman",
  Panama: "Thomas Christiansen",
  Paraguay: "Gustavo Alfaro",
  Portugal: "Roberto Martínez",
  "Czech Republic": "Miroslav Koubek",
  "DR Congo": "Sébastien Desabre",
  Senegal: "Pape Thiaw",
  "South Africa": "Hugo Broos",
  Sweden: "Graham Potter",
  Switzerland: "Murat Yakin",
  Tunisia: "Sabri Lamouchi",
  Turkey: "Vincenzo Montella",
  Uruguay: "Marcelo Bielsa",
  Uzbekistan: "Fabio Cannavaro",
};

const SQUAD_2026_TEAM_ALIASES = {
  "Bosnia & Herzegovina": "Bosnia and Herzegovina",
  "Czech Republic": "Czechia",
  "Curaçao": "Curacao",
};

const SQUAD_TEAM_ALIASES = {
  Netherlands: "Países Bajos",
  "United States": "Estados Unidos",
  USA: "Estados Unidos",
  "South Korea": "Corea del Sur",
  "Ivory Coast": "Costa de Marfil",
};

const TEAM_ESPN_IDS = {
  Algeria: "624",
  Argentina: "202",
  Australia: "628",
  Austria: "474",
  Belgium: "459",
  "Bosnia & Herzegovina": "452",
  Brazil: "205",
  Canada: "206",
  "Cape Verde": "2597",
  Colombia: "208",
  "DR Congo": "2850",
  Croatia: "477",
  Curaçao: "11678",
  "Czech Republic": "450",
  Ecuador: "209",
  Egypt: "2620",
  England: "448",
  France: "478",
  Germany: "481",
  Ghana: "4469",
  Haiti: "2654",
  Iran: "469",
  Iraq: "4375",
  "Ivory Coast": "4789",
  Japan: "627",
  Jordan: "2917",
  Mexico: "203",
  Morocco: "2869",
  Netherlands: "449",
  "New Zealand": "2666",
  Norway: "464",
  Panama: "2659",
  Paraguay: "210",
  Portugal: "482",
  Qatar: "4398",
  "Saudi Arabia": "655",
  Scotland: "580",
  Senegal: "654",
  "South Africa": "467",
  "South Korea": "451",
  Spain: "164",
  Sweden: "466",
  Switzerland: "475",
  Tunisia: "659",
  Turkey: "465",
  USA: "660",
  Uruguay: "212",
  Uzbekistan: "2570",
};

const RESULTS_TEAM_ALIASES = {
  czechia: "czech republic",
  "korea republic": "south korea",
  "united states": "usa",
  "cote d ivoire": "ivory coast",
  "congo dr": "dr congo",
  turkiye: "turkey",
};

const TEAM_TRANSLATIONS = {
  Algeria: "Argelia",
  Argentina: "Argentina",
  Australia: "Australia",
  Austria: "Austria",
  Belgium: "Bélgica",
  "Bosnia & Herzegovina": "Bosnia y Herzegovina",
  Brazil: "Brasil",
  Canada: "Canadá",
  "Cape Verde": "Cabo Verde",
  Colombia: "Colombia",
  Croatia: "Croacia",
  "Czech Republic": "República Checa",
  "DR Congo": "RD Congo",
  Curaçao: "Curazao",
  Ecuador: "Ecuador",
  Egypt: "Egipto",
  England: "Inglaterra",
  France: "Francia",
  Germany: "Alemania",
  Ghana: "Ghana",
  Haiti: "Haití",
  Iran: "Irán",
  Iraq: "Irak",
  "Ivory Coast": "Costa de Marfil",
  Japan: "Japón",
  Jordan: "Jordania",
  Mexico: "México",
  Morocco: "Marruecos",
  Netherlands: "Países Bajos",
  "New Zealand": "Nueva Zelanda",
  Norway: "Noruega",
  Panama: "Panamá",
  Paraguay: "Paraguay",
  Portugal: "Portugal",
  Qatar: "Catar",
  "Saudi Arabia": "Arabia Saudita",
  Scotland: "Escocia",
  Senegal: "Senegal",
  "South Africa": "Sudáfrica",
  "South Korea": "Corea del Sur",
  Spain: "España",
  Sweden: "Suecia",
  Switzerland: "Suiza",
  Tunisia: "Túnez",
  Turkey: "Turquía",
  Uruguay: "Uruguay",
  USA: "Estados Unidos",
  Uzbekistan: "Uzbekistán",
};

const TEAM_EMOJIS = {
  Algeria: "🇩🇿",
  Argentina: "🇦🇷",
  Australia: "🇦🇺",
  Austria: "🇦🇹",
  Belgium: "🇧🇪",
  England: "🏴",
  Scotland: "🏴",
  "Bosnia & Herzegovina": "🇧🇦",
  Brazil: "🇧🇷",
  Canada: "🇨🇦",
  "Cape Verde": "🇨🇻",
  Colombia: "🇨🇴",
  Croatia: "🇭🇷",
  Curaçao: "🇨🇼",
  "Czech Republic": "🇨🇿",
  "DR Congo": "🇨🇩",
  Ecuador: "🇪🇨",
  Egypt: "🇪🇬",
  France: "🇫🇷",
  Germany: "🇩🇪",
  Ghana: "🇬🇭",
  Haiti: "🇭🇹",
  Iran: "🇮🇷",
  Iraq: "🇮🇶",
  "Ivory Coast": "🇨🇮",
  Japan: "🇯🇵",
  Jordan: "🇯🇴",
  Mexico: "🇲🇽",
  Morocco: "🇲🇦",
  Netherlands: "🇳🇱",
  "New Zealand": "🇳🇿",
  Norway: "🇳🇴",
  Panama: "🇵🇦",
  Paraguay: "🇵🇾",
  Portugal: "🇵🇹",
  Qatar: "🇶🇦",
  "Saudi Arabia": "🇸🇦",
  Senegal: "🇸🇳",
  "South Africa": "🇿🇦",
  "South Korea": "🇰🇷",
  Spain: "🇪🇸",
  Sweden: "🇸🇪",
  Switzerland: "🇨🇭",
  Tunisia: "🇹🇳",
  Turkey: "🇹🇷",
  USA: "🇺🇸",
  Uruguay: "🇺🇾",
  Uzbekistan: "🇺🇿",
};

const TEAM_FLAG_IMAGES = {
  England: "/flags/england.svg",
  Scotland: "/flags/scotland.svg",
};

const GROUND_TRANSLATIONS = {
  "Mexico City": "Ciudad de México",
  "Guadalajara (Zapopan)": "Guadalajara (Zapopan)",
  Atlanta: "Atlanta",
  "Monterrey (Guadalupe)": "Monterrey (Guadalupe)",
  Toronto: "Toronto",
  "San Francisco Bay Area (Santa Clara)":
    "Área de la Bahía de San Francisco (Santa Clara)",
  "Los Angeles (Inglewood)": "Los Ángeles (Inglewood)",
  Vancouver: "Vancouver",
  Seattle: "Seattle",
  "New York/New Jersey (East Rutherford)":
    "Nueva York/Nueva Jersey (East Rutherford)",
  "Boston (Foxborough)": "Boston (Foxborough)",
  Philadelphia: "Filadelfia",
  "Miami (Miami Gardens)": "Miami (Miami Gardens)",
  Houston: "Houston",
  "Dallas (Arlington)": "Dallas (Arlington)",
  "Kansas City": "Kansas City",
};

function supportsRegionalFlagEmojis() {
  if (typeof document === "undefined") return true;

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) return true;

  context.font = '32px Arial';
  const regionalA = context.measureText("🇦🇺").width;
  const fallback = context.measureText("A").width;
  return regionalA > fallback * 1.2;
}

const FLAG_EMOJI_SUPPORTED = supportsRegionalFlagEmojis();
const app = document.querySelector("#app");

const state = {
  matches: [],
  loading: false,
  error: "",
  selectedDate: "",
  selectedTeam: "",
  selectedMatchId: "",
  selectedTeamProfile: "",
  teamDirectory: new Map(),
  teamDirectoryPromise: null,
  ballDontLieTeamDirectory: new Map(),
  ballDontLieTeamDirectoryPromise: null,
  teamsLoading: false,
  squadLoading: false,
  selectedSquad: null,
  importantOnly: readBoolean(STORAGE_KEYS.importantOnly, false),
  importantTeams: [
    ...new Set([
      ...readJson(STORAGE_KEYS.importantTeams, []),
      ...IMPORTANT_TEAMS_DEFAULT,
    ]),
  ],
  lastUpdated: "",
  resultsLoading: false,
  resultsError: "",
  resultsSource: "",
  resultsLastUpdated: "",
  resultsLastRequestAt: 0,
  resultsRequestPromise: null,
  resultsRefreshTimer: null,
  nextArgentinaCountdownTimer: null,
  toastTimer: null,
  installingApp: false,
  deferredInstallPrompt: null,
  installButtonFallbackVisible: false,
  installCompletionNotified: false,
  installCompletionTimer: null,
  lastInstallActivationAt: 0,
};

writeJson(STORAGE_KEYS.importantTeams, state.importantTeams);

app.innerHTML = `
  <section class="app-shell">
    <header class="topbar">
      <div class="hero-copy">
        <p class="eyebrow">Mundial 2026</p>
        <h1 class="hero-title">
          <span class="hero-title-text">Mundial 2026 ⚽</span>
        </h1>
        <p class="subtitle">Partidos, horarios y datos del Mundial en hora de Argentina.</p>
      </div>
      <div class="header-actions">
        <button class="secondary-button install-button" id="install-app" type="button" hidden>Instalar app</button>
      </div>
    </header>

    <section class="feature-card" id="next-argentina-card" aria-label="Próximo partido de Argentina"></section>

    <nav class="main-menu" aria-label="Secciones del Mundial">
      <button class="menu-button" id="open-teams" type="button">Selecciones</button>
      <button class="menu-button" id="open-groups" type="button">Grupos</button>
      <button class="menu-button" id="open-results" type="button">Resultados</button>
      <button class="menu-button" id="open-standings" type="button">Tabla</button>
    </nav>

    <section class="controls" aria-label="Filtros de la programación">
      <label class="field">
        <span>Fecha</span>
        <input id="date-filter" type="date" />
      </label>

      <button class="secondary-button" id="today-button" type="button">Hoy</button>
      <button class="secondary-button" id="next-button" type="button">Sig.</button>

      <label class="toggle">
        <input id="important-filter" type="checkbox" />
        <span>Solo importantes</span>
      </label>

      <label class="field search-field">
        <span>Buscar equipo · Ranking FIFA</span>
        <select id="team-search">
          <option value="">Todos los equipos</option>
        </select>
      </label>
      <button class="secondary-button clear-team-button" id="clear-team" type="button" hidden>
        Limpiar selección
      </button>

    </section>

    <section class="status-row" aria-live="polite">
      <p id="status-text">Cargando partidos...</p>
      <p id="updated-text"></p>
    </section>

    <section class="summary" id="summary"></section>
    <section class="matches" id="matches" aria-label="Partidos"></section>
    <footer class="app-footer">By Nicolás Dirazar • Copyright © 2026</footer>
  </section>
  <div class="app-toast" id="app-toast" hidden role="status" aria-live="polite"></div>

  <div class="section-modal" id="section-modal" hidden>
    <div class="modal-backdrop" data-close-section></div>
    <section class="section-panel" role="dialog" aria-modal="true" aria-labelledby="section-title">
      <div class="panel-heading">
        <h2 id="section-title"></h2>
        <button class="close-button" id="close-section" type="button" aria-label="Cerrar">×</button>
      </div>
      <div class="section-content" id="section-content"></div>
    </section>
  </div>

  <div class="teams-modal" id="teams-modal" hidden>
    <div class="modal-backdrop" data-close-teams></div>
    <section class="teams-panel" role="dialog" aria-modal="true" aria-labelledby="teams-title">
      <div class="panel-heading">
        <h2 id="teams-title">Selecciones</h2>
        <button class="close-button" id="close-teams" type="button" aria-label="Cerrar">×</button>
      </div>
      <div class="teams-content" id="teams-content"></div>
    </section>
  </div>

  <div class="squad-modal" id="squad-modal" hidden>
    <div class="modal-backdrop" data-close-squad></div>
    <section class="squad-panel" role="dialog" aria-modal="true" aria-labelledby="squad-title">
      <div class="panel-heading">
        <h2 id="squad-title">Convocados</h2>
        <button class="close-button" id="close-squad" type="button" aria-label="Cerrar">×</button>
      </div>
      <div class="squad-content" id="squad-content"></div>
    </section>
  </div>
`;

const elements = {
  openGroups: document.querySelector("#open-groups"),
  openTeams: document.querySelector("#open-teams"),
  openResults: document.querySelector("#open-results"),
  teamsModal: document.querySelector("#teams-modal"),
  closeTeams: document.querySelector("#close-teams"),
  teamsContent: document.querySelector("#teams-content"),
  squadModal: document.querySelector("#squad-modal"),
  closeSquad: document.querySelector("#close-squad"),
  squadTitle: document.querySelector("#squad-title"),
  squadContent: document.querySelector("#squad-content"),
  openStandings: document.querySelector("#open-standings"),
  installApp: document.querySelector("#install-app"),
  appToast: document.querySelector("#app-toast"),
  nextArgentinaCard: document.querySelector("#next-argentina-card"),
  sectionModal: document.querySelector("#section-modal"),
  sectionTitle: document.querySelector("#section-title"),
  sectionContent: document.querySelector("#section-content"),
  closeSection: document.querySelector("#close-section"),
  dateFilter: document.querySelector("#date-filter"),
  todayButton: document.querySelector("#today-button"),
  nextButton: document.querySelector("#next-button"),
  importantFilter: document.querySelector("#important-filter"),
  teamSearch: document.querySelector("#team-search"),
  clearTeam: document.querySelector("#clear-team"),
  statusText: document.querySelector("#status-text"),
  updatedText: document.querySelector("#updated-text"),
  summary: document.querySelector("#summary"),
  matches: document.querySelector("#matches"),
};

elements.openGroups.addEventListener("click", () => openSectionModal("groups"));
elements.openTeams.addEventListener("pointerup", (event) => {
  event.preventDefault();
  openTeamsModal();
});
elements.openResults.addEventListener("click", () => openSectionModal("results"));
elements.openStandings.addEventListener("click", () => openSectionModal("standings"));
elements.closeSection.addEventListener("click", closeSectionModal);
elements.sectionModal.addEventListener("click", (event) => {
  if (event.target.hasAttribute("data-close-section")) closeSectionModal();
});
elements.closeTeams.addEventListener("click", closeTeamsModal);
elements.teamsModal.addEventListener("click", (event) => {
  if (event.target.hasAttribute("data-close-teams")) closeTeamsModal();
});
elements.closeSquad.addEventListener("click", closeSquadModal);
elements.squadModal.addEventListener("click", (event) => {
  if (event.target.hasAttribute("data-close-squad")) closeSquadModal();
});
elements.installApp.addEventListener("click", handleInstallButtonActivation);
document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  if (!elements.squadModal.hidden) {
    closeSquadModal();
    return;
  }
  if (!elements.teamsModal.hidden) closeTeamsModal();
  if (!elements.sectionModal.hidden) closeSectionModal();
});
elements.dateFilter.addEventListener("change", (event) => {
  state.selectedDate = event.target.value;
  render();
});
elements.todayButton.addEventListener("click", () => {
  state.selectedDate = todayArgentinaKey();
  elements.dateFilter.value = state.selectedDate;
  render();
});
elements.nextButton.addEventListener("click", () => {
  state.selectedDate = getNextMatchDate();
  elements.dateFilter.value = state.selectedDate;
  render();
});
elements.importantFilter.addEventListener("change", (event) => {
  state.importantOnly = event.target.checked;
  writeJson(STORAGE_KEYS.importantOnly, state.importantOnly);
  render();
});
elements.teamSearch.addEventListener("change", (event) => {
  state.selectedTeam = event.target.value;
  render();
});
elements.clearTeam.addEventListener("click", () => {
  state.selectedTeam = "";
  elements.teamSearch.value = "";
  render();
});
elements.matches.addEventListener("click", handleMatchCardClick);
elements.matches.addEventListener("keydown", handleMatchCardKeydown);
elements.sectionContent.addEventListener("error", handleStadiumImageError, true);
elements.teamsContent.addEventListener("click", handleSquadSelectionClick);

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  if (isAppInstalled()) {
    state.deferredInstallPrompt = null;
    updateInstallButtonVisibility();
    return;
  }
  state.deferredInstallPrompt = event;
  updateInstallButtonVisibility();
});

window.addEventListener("appinstalled", () => {
  markAppInstalled({ notify: true });
});

const standaloneModeQuery = window.matchMedia("(display-mode: standalone)");
standaloneModeQuery.addEventListener?.("change", updateInstallButtonVisibility);
window.addEventListener("pageshow", updateInstallButtonVisibility);
updateInstallButtonVisibility();
registerServiceWorker();
loadFixture();
startArgentinaCountdown();

async function loadFixture() {
  state.loading = true;
  state.error = "";
  render();

  try {
    const data = await fetchFixture();
    state.matches = (data.matches || [])
      .map((match, index) => normalizeMatch(match, index))
      .sort((a, b) => a.kickoff.getTime() - b.kickoff.getTime());
    populateTeamSelector();

    if (!state.selectedDate && state.matches.length > 0) {
      state.selectedDate = todayArgentinaKey();
    }

    state.lastUpdated = formatTimeArgentina(new Date());
    await loadResults();
  } catch (error) {
    state.error = error.message || "No se pudieron cargar los partidos.";
  } finally {
    state.loading = false;
    elements.dateFilter.value = state.selectedDate;
    render();
  }
}

async function fetchFixture() {
  try {
    return await fetchJson(`${FIXTURE_URL}?t=${Date.now()}`, 5000);
  } catch (remoteError) {
    console.warn("No se pudo cargar GitHub, usando fixture local.", remoteError);
    return fetchJson(`${LOCAL_FIXTURE_URL}?t=${Date.now()}`);
  }
}

async function fetchJson(url, timeoutMs = 0, options = {}) {
  const controller = timeoutMs ? new AbortController() : null;
  const timeoutId = timeoutMs
    ? window.setTimeout(() => controller.abort(), timeoutMs)
    : null;

  let response;

  try {
    response = await fetch(url, {
      cache: "no-store",
      signal: controller?.signal,
      ...options,
    });
  } finally {
    if (timeoutId) {
      window.clearTimeout(timeoutId);
    }
  }

  if (!response.ok) {
    throw new Error(`La solicitud falló (${response.status})`);
  }

  return response.json();
}

function normalizeMatch(match, index) {
  const kickoff = parseKickoff(match.date, match.time);
  const round = match.round || "";
  const group = match.group || "";
  const team1 = match.team1 || "Por definir";
  const team2 = match.team2 || "Por definir";
  const stadium = match.stadium || match.ground || "";
  const stadiumInfo = resolveStadiumInfo(match);
  const result = extractFixtureResult(match);
  const id = (
    match.num?.toString() ||
    `${match.date}-${match.time}-${team1}-${team2}-${index}`
  )
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  return {
    id,
    date: toArgentinaDateInputValue(kickoff),
    time: formatTimeArgentina(kickoff),
    kickoff,
    team1,
    team2,
    team1Label: translateTeam(team1),
    team2Label: translateTeam(team2),
    group,
    groupLabel: translateGroup(group),
    round,
    roundLabel: translateRound(round),
    stadium,
    stadiumLabel: translateGround(stadium),
    city: stadiumInfo?.city || translateGround(match.city || stadium),
    stadiumInfo,
    important: isImportantMatch(team1, team2, round, group),
    result,
    status: extractFixtureStatus(match, result, kickoff),
    scorers: [],
    statistics: null,
    timeline: [],
    playerOfMatch: null,
  };
}

function extractFixtureResult(match) {
  const candidates = [
    match.score?.ft,
    match.score?.fullTime,
    match.score?.fulltime,
    match.result,
    match.goals,
    Number.isFinite(Number(match.score1)) && Number.isFinite(Number(match.score2))
      ? [match.score1, match.score2]
      : null,
  ];
  const score = candidates.find(
    (value) => Array.isArray(value) && value.length >= 2,
  );
  if (!score) return null;

  const team1Goals = Number(score[0]);
  const team2Goals = Number(score[1]);
  if (!Number.isInteger(team1Goals) || !Number.isInteger(team2Goals)) return null;
  if (team1Goals < 0 || team2Goals < 0) return null;
  return { team1Goals, team2Goals };
}

function extractFixtureStatus(match, result, kickoff) {
  const rawStatus = String(
    match.status ||
      match.state ||
      match.matchStatus ||
      match.score?.status ||
      "",
  ).toLowerCase();

  if (/live|in.?progress|playing|half.?time|ht|paused/.test(rawStatus)) {
    return "live";
  }
  if (
    /finished|final|full.?time|ft|ended|completed|played/.test(rawStatus) ||
    result
  ) {
    return "finished";
  }
  if (/scheduled|not.?started|fixture|upcoming|timed/.test(rawStatus)) {
    return "scheduled";
  }

  const now = Date.now();
  const kickoffTime = kickoff.getTime();
  if (now >= kickoffTime && now < kickoffTime + 3 * 60 * 60 * 1000) {
    return "live";
  }
  return "scheduled";
}

function parseKickoff(date, time) {
  const [, hour, minute, sign, offsetHour, offsetMinute = "0"] =
    time.match(/^(\d{1,2}):(\d{2})\s+UTC([+-])(\d{1,2})(?::(\d{2}))?$/) || [];

  if (!hour) {
    return new Date(`${date}T00:00:00`);
  }

  const [year, month, day] = date.split("-").map(Number);
  const signedOffset =
    (sign === "-" ? -1 : 1) * (Number(offsetHour) * 60 + Number(offsetMinute));
  const sourceMinutes = Number(hour) * 60 + Number(minute);
  const utcMinutes = sourceMinutes - signedOffset;

  return new Date(Date.UTC(year, month - 1, day, 0, utcMinutes));
}

function isImportantMatch(team1, team2, round, group) {
  const teams = new Set(state.importantTeams.map((team) => team.toLowerCase()));
  const hasImportantTeam =
    teams.has(team1.toLowerCase()) || teams.has(team2.toLowerCase());
  const knockout = !group || !/^matchday/i.test(round);

  return hasImportantTeam || knockout;
}

function translateTeam(team) {
  return TEAM_TRANSLATIONS[team] || team;
}

function translateGroup(group) {
  const match = group.match(/^Group\s+([A-Z])$/i);
  return match ? `Grupo ${match[1].toUpperCase()}` : group;
}

function translateRound(round) {
  const matchday = round.match(/^Matchday\s+(\d+)$/i);
  if (matchday) return `Fecha ${matchday[1]}`;

  const translations = {
    "Round of 32": "Ronda de 32",
    "Round of 16": "Octavos de final",
    "Quarter-final": "Cuartos de final",
    "Semi-final": "Semifinal",
    "Match for third place": "Partido por el tercer puesto",
    Final: "Final",
  };

  return translations[round] || round;
}

function translateGround(ground) {
  return GROUND_TRANSLATIONS[ground] || ground;
}

function normalizeLookup(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const STADIUMS_BY_ID = new Map(STADIUMS.map((stadium) => [stadium.id, stadium]));
const STADIUM_LOOKUP = new Map(
  STADIUMS.flatMap((stadium) =>
    [stadium.name, stadium.commonName, stadium.city]
      .filter(Boolean)
      .map((value) => [normalizeLookup(value), stadium.id]),
  ),
);

function resolveStadiumInfo(match) {
  const rawCandidates = [
    match.stadium,
    match.ground,
    match.city,
    match.venue,
    translateGround(match.ground || ""),
  ].filter(Boolean);

  const mappedId = rawCandidates
    .map(
      (candidate) =>
        STADIUMS_BY_GROUND[candidate] ||
        STADIUM_LOOKUP.get(normalizeLookup(candidate)),
    )
    .find(Boolean);

  if (mappedId) return STADIUMS_BY_ID.get(mappedId) || null;

  const normalizedCandidates = rawCandidates.map(normalizeLookup);
  return (
    STADIUMS.find((stadium) => {
      const values = [stadium.name, stadium.commonName, stadium.city]
        .filter(Boolean)
        .map(normalizeLookup);
      return normalizedCandidates.some((candidate) =>
        values.some(
          (value) =>
            candidate === value ||
            candidate.includes(value) ||
            value.includes(candidate),
        ),
      );
    }) || null
  );
}

function render() {
  elements.importantFilter.checked = state.importantOnly;
  elements.dateFilter.value = state.selectedDate;
  elements.clearTeam.hidden = !state.selectedTeam;

  const filteredMatches = getFilteredMatches();

  elements.statusText.textContent = getStatusText(filteredMatches.length);
  elements.statusText.className = state.error ? "error-text" : "";
  const updatedTime = state.resultsLastUpdated || state.lastUpdated;
  elements.updatedText.textContent = updatedTime
    ? `Actualizado ${updatedTime} ARG`
    : "";
  elements.summary.textContent = state.matches.length
    ? state.selectedTeam
      ? `Partidos de ${translateTeam(state.selectedTeam)}`
      : `${filteredMatches.length} de ${state.matches.length} partidos`
    : "";
  renderNextArgentinaCard();

  elements.matches.innerHTML = "";

  if (state.loading) {
    elements.matches.innerHTML = `<article class="empty-card">Cargando partidos...</article>`;
    return;
  }

  if (state.error) {
    elements.matches.innerHTML = `<article class="empty-card">Revisá tu conexión y volvé a intentar.</article>`;
    return;
  }

  if (!filteredMatches.length) {
    elements.matches.innerHTML = `<article class="empty-card">${
      state.selectedTeam
        ? "No hay partidos disponibles para este equipo."
        : "No hay partidos para los filtros seleccionados."
    }</article>`;
    return;
  }

  const fragment = document.createDocumentFragment();
  filteredMatches.forEach((match) => fragment.appendChild(renderMatchCard(match)));
  elements.matches.appendChild(fragment);
}

function renderMatchCard(match) {
  const card = document.createElement("article");
  card.className = `match-card${match.important ? " is-important" : ""}`;
  card.dataset.matchId = match.id;
  card.tabIndex = 0;
  card.setAttribute("role", "button");
  card.setAttribute("aria-label", `Ver detalle de ${translateTeam(match.team1)} vs ${translateTeam(match.team2)}`);

  const result = match.result;
  const phaseLabel = match.groupLabel || "Fase eliminatoria";
  const meta = [phaseLabel, match.roundLabel].filter(Boolean).join(" · ");
  const statusBadge =
    match.status === "live" || match.status === "finished"
      ? `<span class="match-card-status is-${match.status}">${getMatchStatusLabel(match.status)}</span>`
      : "";

  card.innerHTML = `
    <div class="match-card-header">
      <div class="match-card-meta">
        <p class="match-date">${formatDate(match.kickoff)}</p>
        <p class="match-phase">${escapeHtml(phaseLabel)}</p>
      </div>
      <div class="card-badges">
        ${match.important ? `<span class="badge">Importante</span>` : ""}
        ${statusBadge}
      </div>
    </div>
    ${renderMatchTeamsRow(match.team1, match.team2, result ? `${result.team1Goals} - ${result.team2Goals}` : "vs")}
    <div class="match-info">
      <span class="match-time">${match.time} ARG</span>
      <span>${escapeHtml(meta)}</span>
      ${match.stadiumLabel ? `<span class="match-city">${escapeHtml(match.stadiumLabel)}</span>` : ""}
    </div>
  `;

  return card;
}

function handleMatchCardClick(event) {
  const card = event.target.closest(".match-card");
  if (!card?.dataset.matchId) return;
  openSectionModal("match-detail", card.dataset.matchId);
}

function handleMatchCardKeydown(event) {
  if (event.key !== "Enter" && event.key !== " ") return;
  const card = event.target.closest(".match-card");
  if (!card?.dataset.matchId) return;
  event.preventDefault();
  openSectionModal("match-detail", card.dataset.matchId);
}

function renderNextArgentinaCard() {
  const match = getNextArgentinaMatch();
  if (state.loading) {
    elements.nextArgentinaCard.innerHTML = `
      <article class="feature-card-shell">
        <p class="feature-kicker">Próximo partido de Argentina</p>
        <strong class="feature-title">Cargando partido...</strong>
      </article>
    `;
    return;
  }

  if (!match) {
    elements.nextArgentinaCard.innerHTML = `
      <article class="feature-card-shell">
        <p class="feature-kicker">Próximo partido de Argentina</p>
        <strong class="feature-title">Sin partidos futuros de Argentina</strong>
      </article>
    `;
    return;
  }

  const rivalTeam = match.team1 === "Argentina" ? match.team2 : match.team1;
  const countdownLabel = getArgentinaCountdownLabel(match);

  elements.nextArgentinaCard.innerHTML = `
    <article class="feature-card-shell ${match.important ? "is-important" : ""}">
      <div class="feature-card-top">
        <div>
          <p class="feature-kicker">Próximo partido de Argentina</p>
          ${renderMatchTeamsRow("Argentina", rivalTeam, "vs")}
          <p class="feature-countdown">${escapeHtml(countdownLabel)}</p>
        </div>
        <span class="feature-pill">${escapeHtml(match.groupLabel || "Fase eliminatoria")}</span>
      </div>
      <div class="feature-card-body">
        <div class="feature-meta">
          <strong>${formatDate(match.kickoff)}</strong>
          <span>${match.time} ARG</span>
        </div>
      </div>
    </article>
  `;

}

function getNextArgentinaMatch() {
  const argentinaMatches = state.matches.filter(
    (match) => match.team1 === "Argentina" || match.team2 === "Argentina",
  );
  if (!argentinaMatches.length) return null;

  const now = Date.now();
  const liveMatch = argentinaMatches.find((match) => isMatchLive(match, now));
  if (liveMatch) return liveMatch;

  const upcomingMatch = argentinaMatches.find((match) => match.kickoff.getTime() >= now);
  if (upcomingMatch) return upcomingMatch;

  return argentinaMatches.at(-1) || null;
}

function getMatchById(matchId) {
  return state.matches.find((match) => match.id === matchId) || null;
}

function getTeamRanking(team) {
  return TEAM_RANKING.find((item) => item.name === team)?.rank || null;
}

function getAllNamedTeams() {
  const teams = new Set();
  state.matches.forEach((match) => {
    if (isNamedTeam(match.team1)) teams.add(match.team1);
    if (isNamedTeam(match.team2)) teams.add(match.team2);
  });
  return [...teams];
}

function getSortedTeams() {
  return getAllNamedTeams().sort((teamA, teamB) => {
    const rankA = getTeamRanking(teamA);
    const rankB = getTeamRanking(teamB);
    if (rankA !== null && rankB !== null) return rankA - rankB;
    if (rankA !== null) return -1;
    if (rankB !== null) return 1;
    return translateTeam(teamA).localeCompare(translateTeam(teamB), ARGENTINA_LOCALE);
  });
}

function getTeamMatches(team) {
  return state.matches.filter((match) => match.team1 === team || match.team2 === team);
}

function getTeamGroups(team) {
  return [...new Set(getTeamMatches(team).map((match) => match.group).filter(Boolean))];
}

function formatCapacity(value) {
  if (!Number.isFinite(Number(value))) return "Sin dato";
  return new Intl.NumberFormat(ARGENTINA_LOCALE).format(Number(value));
}

function getTeamFlagMarkup(team, className = "flag") {
  const localFlag = TEAM_FLAG_IMAGES[team];
  if (localFlag) {
    const alt = translateTeam(team);
    return `<img class="${className} is-image" src="${localFlag}" alt="${escapeHtml(alt)}" />`;
  }

  const emoji = TEAM_EMOJIS[team];
  if (emoji) {
    return `<span class="${className}" aria-hidden="true">${emoji}</span>`;
  }

  return "";
}

function renderTeamLabel(team) {
  const flag = getTeamFlagMarkup(team, "team-emoji");
  const label = escapeHtml(translateTeam(team));
  return flag
    ? `${flag}<span class="team-name">${label}</span>`
    : `<span class="team-name">${label}</span>`;
}

function renderMatchTeamParts(team) {
  const flag = getTeamFlagMarkup(team, "flag");
  const label = escapeHtml(translateTeam(team));
  return `${flag}<span class="match-team-name name">${label}</span>`;
}

function renderMatchTeamsRow(homeTeam, awayTeam, centerText = "vs") {
  const isScore = /\d+\s*-\s*\d+/.test(centerText);
  const centerClass = isScore ? "match-score" : "match-vs";

  return `
    <div class="match-score-row">
      <div class="match-team match-team-home">
        ${renderMatchTeamParts(homeTeam)}
      </div>

      <span class="${centerClass}">${escapeHtml(centerText)}</span>

      <div class="match-team match-team-away">
        ${renderMatchTeamParts(awayTeam)}
      </div>
    </div>
  `;
}

function isAppInstalled() {
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true;
  const persisted =
    readBoolean(STORAGE_KEYS.pwaInstalled, false) ||
    localStorage.getItem("pwa-installed") === "true";

  if (standalone && !persisted) {
    writeJson(STORAGE_KEYS.pwaInstalled, true);
    localStorage.setItem("pwa-installed", "true");
  }

  return standalone || persisted;
}

function isIosDevice() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

function isMobileDevice() {
  return (
    isIosDevice() ||
    /android/i.test(window.navigator.userAgent) ||
    window.matchMedia("(pointer: coarse)").matches
  );
}

function getInstallFallbackMessage() {
  if (isIosDevice()) {
    return "En iPhone: Compartir → Agregar a inicio";
  }

  return "En Android: menú ⋮ → Agregar a pantalla de inicio";
}

function markAppInstalled({ notify = false } = {}) {
  completeAppInstall();

  if (notify && !state.installCompletionNotified) {
    state.installCompletionNotified = true;
    showToast("App instalada ✅");
  }
}

function setInstalling(isInstalling, label = "Instalando...") {
  if (!elements.installApp) return;
  state.installingApp = isInstalling;
  elements.installApp.disabled = isInstalling;
  elements.installApp.setAttribute("aria-busy", String(isInstalling));
  elements.installApp.innerHTML = isInstalling
    ? `<span class="install-spinner" aria-hidden="true"></span><span>${label}</span>`
    : "Instalar app";
}

function setInstallButtonIdle() {
  setInstalling(false);
}

function completeAppInstall() {
  state.deferredInstallPrompt = null;
  state.installButtonFallbackVisible = false;
  window.clearTimeout(state.installCompletionTimer);
  state.installCompletionTimer = null;
  writeJson(STORAGE_KEYS.pwaInstalled, true);
  localStorage.setItem("pwa-installed", "true");
  setInstalling(false);
  updateInstallButtonVisibility();
}

function updateInstallButtonVisibility() {
  const installed = isAppInstalled();
  const installable = Boolean(state.deferredInstallPrompt);
  const fallbackAvailable = state.installButtonFallbackVisible || isMobileDevice();
  elements.installApp.hidden = installed || (!installable && !fallbackAvailable);
  if (!elements.installApp.hidden && !state.installingApp) setInstallButtonIdle();
}

function handleInstallButtonActivation(event) {
  const now = Date.now();

  if (now - state.lastInstallActivationAt < 700) return;

  state.lastInstallActivationAt = now;
  promptAppInstall();
}

async function promptAppInstall() {
  if (isAppInstalled()) {
    markAppInstalled();
    return;
  }

  if (!state.deferredInstallPrompt) {
    state.installButtonFallbackVisible = true;
    setInstallButtonIdle();
    updateInstallButtonVisibility();
    showToast(getInstallFallbackMessage());
    return;
  }

  setInstalling(true, "Instalando...");

  try {
    state.deferredInstallPrompt.prompt();
    const choice = await state.deferredInstallPrompt.userChoice;
    state.deferredInstallPrompt = null;
    if (choice?.outcome === "accepted") {
      setInstalling(true, "Finalizando instalación...");
      state.installCompletionTimer = window.setTimeout(() => {
        markAppInstalled({ notify: true });
      }, 8000);
      return;
    }

    state.installButtonFallbackVisible = true;
  } catch (error) {
    state.deferredInstallPrompt = null;
    state.installButtonFallbackVisible = true;
    showToast(getInstallFallbackMessage());
  } finally {
    const installed = isAppInstalled();
    if (installed) {
      completeAppInstall();
      return;
    }

    if (!state.installCompletionTimer) {
      setInstallButtonIdle();
      updateInstallButtonVisibility();
    }
  }
}

function showToast(message) {
  if (!elements.appToast) return;
  elements.appToast.textContent = message;
  elements.appToast.hidden = false;
  window.clearTimeout(state.toastTimer);
  state.toastTimer = window.setTimeout(() => {
    if (elements.appToast) elements.appToast.hidden = true;
  }, 3200);
}

function populateTeamSelector() {
  const fixtureTeams = new Set(
    state.matches.flatMap((match) => [match.team1, match.team2]).filter(isNamedTeam),
  );
  const rankingByTeam = new Map(TEAM_RANKING.map((team) => [team.name, team.rank]));
  const sortedTeams = [...fixtureTeams].sort((teamA, teamB) => {
    const rankA = rankingByTeam.get(teamA);
    const rankB = rankingByTeam.get(teamB);
    if (rankA !== undefined && rankB !== undefined) return rankA - rankB;
    if (rankA !== undefined) return -1;
    if (rankB !== undefined) return 1;
    return teamA.localeCompare(teamB, ARGENTINA_LOCALE);
  });

  elements.teamSearch.innerHTML = `<option value="">Todos los equipos</option>`;
  sortedTeams.forEach((team) => {
    const option = document.createElement("option");
    const rank = rankingByTeam.get(team);
    option.value = team;
    option.textContent = rank
      ? `#${rank} ${translateTeam(team)}`
      : translateTeam(team);
    elements.teamSearch.appendChild(option);
  });
  elements.teamSearch.value = fixtureTeams.has(state.selectedTeam)
    ? state.selectedTeam
    : "";
}

function isNamedTeam(team) {
  return team && !/^\d/.test(team) && !/^[WL]\d+$/.test(team);
}

function getFilteredMatches() {
  return state.matches.filter((match) => {
    const sameDate =
      state.selectedTeam || !state.selectedDate || matchArgentinaDateKey(match) === state.selectedDate;
    const important = !state.importantOnly || match.important;
    const selectedTeam =
      !state.selectedTeam ||
      match.team1 === state.selectedTeam ||
      match.team2 === state.selectedTeam;

    return sameDate && important && selectedTeam;
  });
}

function openSectionModal(view, item = "") {
  const titles = {
    groups: "Grupos",
    results: "Resultados",
    standings: "Tabla de posiciones",
    teams: "Selecciones",
    "match-detail": "Detalle del partido",
  };
  elements.sectionModal.dataset.view = view;
  if (item) elements.sectionModal.dataset.item = item;
  else delete elements.sectionModal.dataset.item;
  elements.sectionTitle.textContent = titles[view];
  elements.sectionModal.hidden = false;
  document.body.classList.add("modal-open");
  renderSectionView();
  elements.closeSection.focus();
  if (view === "results") {
    loadResults();
    startResultsRefresh();
  }
}

function closeSectionModal() {
  stopResultsRefresh();
  elements.sectionModal.hidden = true;
  document.body.classList.remove("modal-open");
  delete elements.sectionModal.dataset.item;
}

function openTeamsModal() {
  elements.teamsModal.hidden = false;
  document.body.classList.add("modal-open");
  renderTeamsView(elements.teamsContent);
  elements.closeTeams?.focus();
}

function loadTeamDirectory() {
  if (state.teamDirectory.size) return Promise.resolve();
  if (state.teamDirectoryPromise) return state.teamDirectoryPromise;

  state.teamsLoading = true;
  renderTeamsView(elements.teamsContent);
  state.teamDirectoryPromise = fetchJson(TEAMS_URL, 7000)
    .then((data) => {
      const apiTeams = data.sports?.[0]?.leagues?.[0]?.teams || [];
      state.teamDirectory = new Map(
        apiTeams.map(({ team }) => [normalizeResultTeam(team.displayName), team]),
      );
    })
    .catch((error) => {
      console.warn("No se pudieron cargar IDs de selecciones.", error);
    })
    .finally(() => {
      state.teamsLoading = false;
      state.teamDirectoryPromise = null;
      renderTeamsView(elements.teamsContent);
    });
  return state.teamDirectoryPromise;
}

function closeTeamsModal() {
  closeSquadModal();
  elements.teamsModal.hidden = true;
  document.body.classList.remove("modal-open");
}

function renderSectionView() {
  const view = elements.sectionModal.dataset.view;
  if (view === "groups") renderGroupsView();
  if (view === "results") renderResultsView();
  if (view === "standings") renderStandingsView();
  if (view === "teams") renderTeamsView(elements.sectionContent);
  if (view === "match-detail") renderMatchDetailView();
}

function getGroups() {
  const groups = new Map();
  state.matches
    .filter((match) => match.group)
    .forEach((match) => {
      if (!groups.has(match.group)) groups.set(match.group, new Set());
      if (isNamedTeam(match.team1)) groups.get(match.group).add(match.team1);
      if (isNamedTeam(match.team2)) groups.get(match.group).add(match.team2);
    });
  return [...groups.entries()].sort(([groupA], [groupB]) =>
    groupA.localeCompare(groupB, "en"),
  );
}

function renderGroupsView(container = elements.sectionContent) {
  const groups = getGroups();
  container.innerHTML = `
    <div class="groups-grid">
      ${groups
        .map(
          ([group, teams]) => `
            <article class="group-card">
              <h3>${translateGroup(group)}</h3>
              <ul>
                ${[...teams]
                  .map((team) => {
                    const isImportant = state.importantTeams.includes(team);
                    return `<li class="${isImportant ? "is-important-team" : ""}">
                      <span>${escapeHtml(translateTeam(team))}</span>
                      ${isImportant ? `<small>Importante</small>` : ""}
                    </li>`;
                  })
                  .join("")}
              </ul>
            </article>
          `,
        )
        .join("")}
    </div>
  `;
}

function renderResultsView(container = elements.sectionContent) {
  const visibleMatches = state.matches.filter(
    (match) =>
      match.result ||
      match.status === "live" ||
      match.kickoff.getTime() >= Date.now(),
  );
  const sourceLabels = {
    api: "API externa",
    cache: "caché local",
    local: "datos locales",
  };

  container.innerHTML = `
    <div class="results-toolbar" aria-live="polite">
      <div>
        <strong>${state.resultsLoading ? "Actualizando resultados..." : "Resultados actualizados automáticamente"}</strong>
        <span>${
          state.resultsLastUpdated
            ? `Actualizado ${escapeHtml(state.resultsLastUpdated)} ARG · ${sourceLabels[state.resultsSource] || "datos disponibles"}`
            : "Consultando API del Mundial"
        }</span>
      </div>
      ${state.resultsLoading ? `<span class="results-spinner" aria-hidden="true"></span>` : ""}
    </div>
    ${
      state.resultsError
        ? `<p class="results-warning">${escapeHtml(state.resultsError)}</p>`
        : ""
    }
    <div class="results-list">
      ${
        visibleMatches.length
          ? visibleMatches
              .map(
                (match) => `
                  <article class="result-row">
                    <div class="result-meta">
                      <span>${formatDate(match.kickoff)} · ${match.time} ARG</span>
                      <span>${escapeHtml([match.groupLabel || "Fase eliminatoria", match.roundLabel].filter(Boolean).join(" · "))}</span>
                    </div>
                    <div class="result-score">
                      <strong>${renderTeamLabel(match.team1)}</strong>
                      <b>${match.result ? `${match.result.team1Goals} - ${match.result.team2Goals}` : "vs"}</b>
                      <strong>${renderTeamLabel(match.team2)}</strong>
                    </div>
                    <span class="match-status is-${match.status}">${getMatchStatusLabel(match.status)}</span>
                  </article>
                `,
              )
              .join("")
          : `<p class="section-empty">No hay partidos disponibles.</p>`
      }
    </div>
  `;
}

function loadResults() {
  if (state.resultsRequestPromise) return state.resultsRequestPromise;

  const now = Date.now();
  if (
    state.resultsLastRequestAt &&
    now - state.resultsLastRequestAt < RESULTS_REQUEST_TTL_MS
  ) {
    renderResultsIfOpen();
    return Promise.resolve(false);
  }

  state.resultsLastRequestAt = now;
  state.resultsRequestPromise = fetchAndApplyResults().finally(() => {
    state.resultsRequestPromise = null;
  });
  return state.resultsRequestPromise;
}

async function fetchAndApplyResults() {
  state.resultsLoading = true;
  state.resultsError = "";
  renderResultsIfOpen();

  try {
    const data = await fetchJson(`${RESULTS_URL}&t=${Date.now()}`, 7000);
    applyResultsData(data);
    const savedAt = new Date();
    writeJson(STORAGE_KEYS.resultsCache, {
      savedAt: savedAt.toISOString(),
      data,
    });
    state.resultsSource = "api";
    state.resultsLastUpdated = formatTimeArgentina(savedAt);
    state.lastUpdated = state.resultsLastUpdated;
    return true;
  } catch (apiError) {
    console.warn("No se pudo consultar la API de resultados.", apiError);
    try {
      await loadResultsFallback();
    } catch (fallbackError) {
      console.error("No se pudieron cargar resultados locales.", fallbackError);
      state.resultsError = "No se pudieron actualizar los resultados. Se mantienen los datos disponibles.";
    }
    return false;
  } finally {
    state.resultsLoading = false;
    render();
    renderResultsIfOpen();
  }
}

async function loadResultsFallback() {
  const cached = readJson(STORAGE_KEYS.resultsCache, null);
  const hasCachedResults =
    cached?.data?.events?.length || cached?.data?.matches?.length;
  if (hasCachedResults) {
    applyResultsData(cached.data);
    state.resultsSource = "cache";
    state.resultsLastUpdated = isValidDateValue(cached.savedAt)
      ? formatTimeArgentina(new Date(cached.savedAt))
      : formatTimeArgentina(new Date());
    state.lastUpdated = state.resultsLastUpdated;
    state.resultsError = "La API no respondió. Mostrando la última consulta guardada.";
    return;
  }

  const localData = await fetchJson(`${LOCAL_FIXTURE_URL}?t=${Date.now()}`);
  applyResultsData(localData);
  state.resultsSource = "local";
  state.resultsLastUpdated = formatTimeArgentina(new Date());
  state.lastUpdated = state.resultsLastUpdated;
  state.resultsError = "La API no respondió. Mostrando datos locales.";
}

function applyResultsData(data) {
  if (Array.isArray(data.events)) {
    mergeEspnResults(data.events);
  } else {
    const matches = (data.matches || [])
      .map((match, index) => normalizeMatch(match, index))
      .sort((a, b) => a.kickoff.getTime() - b.kickoff.getTime());
    if (!matches.length) throw new Error("La API no devolvió partidos.");
    state.matches = matches;
  }
  populateTeamSelector();
}

function mergeEspnResults(events) {
  if (!events.length) throw new Error("La API no devolvió resultados.");

  const updates = new Map();
  events.forEach((event) => {
    const competition = event.competitions?.[0];
    const competitors = competition?.competitors || [];
    const home = competitors.find((team) => team.homeAway === "home");
    const away = competitors.find((team) => team.homeAway === "away");
    if (!home?.team?.displayName || !away?.team?.displayName) return;

    const statusState = competition.status?.type?.state || event.status?.type?.state;
    const status = statusState === "post"
      ? "finished"
      : statusState === "in"
        ? "live"
        : "scheduled";
    const homeScore = Number(home.score);
    const awayScore = Number(away.score);
    const hasScore =
      status !== "scheduled" &&
      Number.isInteger(homeScore) &&
      Number.isInteger(awayScore);
    const teamNamesById = new Map(
      competitors.map((competitor) => [
        String(competitor.id),
        competitor.team.displayName,
      ]),
    );
    const insights = normalizeEspnEventPayload(
      competition,
      Object.fromEntries(teamNamesById),
    );
    const scorers = (competition.details || [])
      .filter((detail) => detail.scoringPlay)
      .map((detail) => ({
        team: teamNamesById.get(String(detail.team?.id)) || "",
        name:
          detail.athletesInvolved?.[0]?.displayName ||
          (detail.ownGoal ? "Gol en contra" : "Gol"),
        minute: detail.clock?.displayValue || "",
        ownGoal: Boolean(detail.ownGoal),
      }));

    updates.set(
      getResultMatchKey(home.team.displayName, away.team.displayName),
      {
        status,
        homeTeam: home.team.displayName,
        awayTeam: away.team.displayName,
        homeScore: hasScore ? homeScore : null,
        awayScore: hasScore ? awayScore : null,
        scorers,
        statistics: insights.statistics,
        timeline: insights.timeline,
        playerOfMatch: insights.playerOfMatch,
      },
    );
  });

  let matched = 0;
  state.matches = state.matches.map((match) => {
    const update = updates.get(getResultMatchKey(match.team1, match.team2));
    if (!update) return match;
    matched += 1;
    const team1IsHome =
      normalizeResultTeam(match.team1) === normalizeResultTeam(update.homeTeam);
    const result = update.homeScore === null
      ? null
      : {
          team1Goals: team1IsHome ? update.homeScore : update.awayScore,
          team2Goals: team1IsHome ? update.awayScore : update.homeScore,
        };
    const scorers = update.scorers.map((scorer) => ({
      ...scorer,
      side:
        normalizeResultTeam(scorer.team) === normalizeResultTeam(match.team1)
          ? "team1"
          : "team2",
    }));
    const statistics = alignStatisticsToMatch(update.statistics, match, team1IsHome);
    const timeline = (update.timeline || []).map((event) => ({
      ...event,
      side:
        normalizeResultTeam(event.team) === normalizeResultTeam(match.team1)
          ? "team1"
          : normalizeResultTeam(event.team) === normalizeResultTeam(match.team2)
            ? "team2"
            : "",
    }));
    const playerOfMatch = update.playerOfMatch
      ? {
          ...update.playerOfMatch,
          side:
            normalizeResultTeam(update.playerOfMatch.team) === normalizeResultTeam(match.team1)
              ? "team1"
              : normalizeResultTeam(update.playerOfMatch.team) === normalizeResultTeam(match.team2)
                ? "team2"
                : "",
        }
      : null;
    return {
      ...match,
      status: update.status,
      result,
      scorers,
      statistics,
      timeline,
      playerOfMatch,
    };
  });
  if (!matched) throw new Error("No se pudieron asociar los resultados al fixture.");
}

function alignStatisticsToMatch(statistics, match, team1IsHome) {
  if (!statistics?.rows?.length) return null;

  const rows = team1IsHome
    ? statistics.rows
    : statistics.rows.map((row) => ({
        ...row,
        team1Value: row.team2Value,
        team2Value: row.team1Value,
        team1Width: row.team2Width,
        team2Width: row.team1Width,
        team1Share: row.team2Share,
        team2Share: row.team1Share,
      }));

  return {
    ...statistics,
    team1: match.team1,
    team2: match.team2,
    rows,
  };
}

function getResultMatchKey(team1, team2) {
  return [normalizeResultTeam(team1), normalizeResultTeam(team2)].sort().join("|");
}

function normalizeResultTeam(team) {
  const normalized = normalizeLookup(team);
  return RESULTS_TEAM_ALIASES[normalized] || normalized;
}

function renderResultsIfOpen() {
  if (
    !elements.sectionModal.hidden &&
    elements.sectionModal.dataset.view === "results"
  ) {
    renderResultsView();
  }
}

function startResultsRefresh() {
  stopResultsRefresh();
  state.resultsRefreshTimer = window.setInterval(() => {
    if (
      !elements.sectionModal.hidden &&
      elements.sectionModal.dataset.view === "results"
    ) {
      loadResults();
    }
  }, RESULTS_REFRESH_INTERVAL_MS);
}

function stopResultsRefresh() {
  if (!state.resultsRefreshTimer) return;
  window.clearInterval(state.resultsRefreshTimer);
  state.resultsRefreshTimer = null;
}

function getMatchStatusLabel(status) {
  return {
    scheduled: "Programado",
    live: "En vivo",
    finished: "Finalizado",
  }[status] || "Programado";
}

function renderStandingsView(container = elements.sectionContent) {
  const standings = calculateStandings();
  container.innerHTML = `
    <div class="standings-grid">
      ${standings
        .map(
          ([group, rows]) => `
            <article class="standings-card">
              <h3>${translateGroup(group)}</h3>
              <div class="table-scroll">
                <table>
                  <thead>
                    <tr><th>Equipo</th><th>PJ</th><th>PG</th><th>PE</th><th>PP</th><th>GF</th><th>GC</th><th>DG</th><th>PTS</th></tr>
                  </thead>
                  <tbody>
                    ${rows
                      .map((row, index) => {
                        const isImportant = state.importantTeams.includes(row.team);
                        const isTopTwo = index < 2;
                        return `
                          <tr class="${[isTopTwo ? "is-top-two" : "", isImportant ? "is-important-team" : ""].filter(Boolean).join(" ")}">
                            <td>${renderTeamLabel(row.team)}</td>
                            <td>${row.played}</td><td>${row.won}</td><td>${row.drawn}</td><td>${row.lost}</td>
                            <td>${row.goalsFor}</td><td>${row.goalsAgainst}</td><td>${formatGoalDifference(row.goalDifference)}</td><td><strong>${row.points}</strong></td>
                          </tr>
                        `;
                      })
                      .join("")}
                  </tbody>
                </table>
              </div>
            </article>
          `,
        )
        .join("")}
    </div>
  `;
}

function renderTeamsView(container = elements.sectionContent) {
  const teams = getSortedTeams();
  if (!teams.length) {
    container.innerHTML = `<p class="section-empty">Todavía no hay selecciones cargadas.</p>`;
    return;
  }

  container.innerHTML = `
    ${state.teamsLoading ? `<p class="teams-loading">Actualizando selecciones...</p>` : ""}
    <div class="simple-teams-list" role="list" aria-label="Lista de selecciones">
      ${teams.map((team) => `
        <button class="simple-team-button" type="button" data-squad-team="${escapeHtml(team)}">
          <span>${renderTeamLabel(team)}</span>
          <span class="simple-team-arrow" aria-hidden="true">›</span>
        </button>
      `).join("")}
    </div>
  `;
}

async function handleSquadSelectionClick(event) {
  const button = event.target.closest("[data-squad-team]");
  if (!button) return;
  await openSquadModal(button.dataset.squadTeam);
}

async function openSquadModal(selectedTeam) {
  const teamName = String(selectedTeam?.name || selectedTeam || "").trim();
  const squadKey = SQUAD_TEAM_ALIASES[teamName] || teamName;
  const legacyLocalSquad = SQUADS[teamName] || SQUADS[squadKey];
  const localSquad = getLocal2026Squad(teamName);
  const cachedSquad = readCachedSquad(teamName);

  state.selectedTeamProfile = teamName;
  state.selectedSquad = cachedSquad || localSquad || legacyLocalSquad || null;
  state.squadLoading = !state.selectedSquad;
  elements.squadTitle.textContent = `Convocados · ${translateTeam(teamName)}`;
  elements.squadModal.hidden = false;
  renderSquadView();
  elements.closeSquad.focus();

  const espnSquadPromise = fetchEspnSquad(teamName).catch((error) => {
    console.warn(`No se pudo cargar el fallback ESPN de ${teamName}.`, error);
    return null;
  });

  try {
    if (!BALLDONTLIE_API_KEY) {
      throw new Error("Falta VITE_BALLDONTLIE_API_KEY");
    }

    const [ballDontLieSquad, espnSquad] = await Promise.all([
      fetchBallDontLieSquad(teamName),
      espnSquadPromise,
    ]);
    const supplementalSquad = localSquad
      ? enrichSquad(localSquad, espnSquad)
      : espnSquad || legacyLocalSquad;
    const squad = enrichSquad(ballDontLieSquad, supplementalSquad);
    writeCachedSquad(teamName, squad);
    setSelectedSquad(teamName, squad);
    return;
  } catch (error) {
    console.warn(`No se pudieron cargar convocados BALLDONTLIE de ${teamName}.`, error);
  }

  const espnSquad = await espnSquadPromise;
  const fallbackSquad = localSquad
    ? enrichSquad(localSquad, espnSquad)
    : espnSquad || legacyLocalSquad || cachedSquad;
  if (fallbackSquad) writeCachedSquad(teamName, fallbackSquad);
  setSelectedSquad(teamName, fallbackSquad || null);
}

function setSelectedSquad(teamName, squad) {
  if (state.selectedTeamProfile !== teamName || elements.squadModal.hidden) return;
  state.selectedSquad = applySquadCoachOverride(teamName, squad);
  state.squadLoading = false;
  renderSquadView();
}

async function fetchBallDontLieSquad(teamName) {
  const team = await findBallDontLieTeam(teamName);
  if (!team?.id) throw new Error("Selección no encontrada en BALLDONTLIE");

  const query = new URLSearchParams({
    "seasons[]": String(SQUAD_SEASON),
    "team_ids[]": String(team.id),
    per_page: "100",
  });
  const [rosterResponse, playersResponse] = await Promise.all([
    fetchBallDontLieJson(`/rosters?${query}`),
    fetchBallDontLieJson(`/players?${query}`),
  ]);
  const roster = Array.isArray(rosterResponse.data) ? rosterResponse.data : [];
  const players = Array.isArray(playersResponse.data) ? playersResponse.data : [];
  if (!roster.length) throw new Error(`Roster ${SQUAD_SEASON} vacío`);

  return normalizeBallDontLieSquad(roster, players);
}

async function findBallDontLieTeam(teamName) {
  if (!state.ballDontLieTeamDirectory.size) {
    if (!state.ballDontLieTeamDirectoryPromise) {
      state.ballDontLieTeamDirectoryPromise = fetchBallDontLieJson(
        `/teams?seasons[]=${SQUAD_SEASON}`,
      )
        .then((response) => {
          const teams = Array.isArray(response.data) ? response.data : [];
          state.ballDontLieTeamDirectory = new Map(
            teams.map((team) => [normalizeResultTeam(team.name), team]),
          );
        })
        .finally(() => {
          state.ballDontLieTeamDirectoryPromise = null;
        });
    }
    await state.ballDontLieTeamDirectoryPromise;
  }

  return state.ballDontLieTeamDirectory.get(normalizeResultTeam(teamName));
}

function fetchBallDontLieJson(path) {
  return fetchJson(`${BALLDONTLIE_API_URL}${path}`, 7000, {
    headers: {
      Authorization: BALLDONTLIE_API_KEY,
    },
  });
}

async function fetchEspnSquad(teamName) {
  const apiTeamId = TEAM_ESPN_IDS[teamName];
  if (!apiTeamId) await loadTeamDirectory();

  const fallbackApiTeam = state.teamDirectory.get(normalizeResultTeam(teamName));
  const rosterTeamId = apiTeamId || fallbackApiTeam?.id;
  if (!rosterTeamId) return null;

  const data = await fetchJson(`${ROSTER_URL}/${rosterTeamId}/roster`, 7000);
  return normalizeSquad(data);
}

function closeSquadModal() {
  elements.squadModal.hidden = true;
  state.selectedTeamProfile = "";
  state.squadLoading = false;
  state.selectedSquad = null;
}

function getLocal2026Squad(teamName) {
  const dataKey = SQUAD_2026_TEAM_ALIASES[teamName] || teamName;
  const data = SQUADS_2026[dataKey];
  if (!data?.players?.length) return null;

  const groups = createSquadGroups();
  data.players.forEach((player) => {
    const group = getSquadPositionGroup(player.position);
    if (!group) return;
    groups[group].push({
      name: player.name || "Sin nombre",
      number: player.number || "—",
      club: player.club || "",
    });
  });
  sortSquadGroups(groups);

  return {
    coach: data.coach || "No disponible",
    groups,
  };
}

function createSquadGroups() {
  return {
    goalkeepers: [],
    defenders: [],
    midfielders: [],
    forwards: [],
  };
}

function normalizeSquad(data) {
  const positions = {
    Goalkeeper: "goalkeepers",
    Defender: "defenders",
    Midfielder: "midfielders",
    Forward: "forwards",
  };
  const groups = createSquadGroups();

  (data.athletes || []).forEach((player) => {
    const group = positions[player.position?.name];
    if (!group) return;
    groups[group].push({
      name: player.displayName || player.fullName || "Sin nombre",
      number: player.jersey || "—",
      club: player.club?.displayName || player.team?.displayName || "",
    });
  });

  sortSquadGroups(groups);

  const coach = data.coach?.[0];
  return {
    coach: coach ? [coach.firstName, coach.lastName].filter(Boolean).join(" ").trim() : "No disponible",
    groups,
  };
}

function normalizeBallDontLieSquad(roster, players) {
  const playersById = new Map(players.map((player) => [String(player.id), player]));
  const groups = createSquadGroups();

  roster.forEach((entry) => {
    const rosterPlayer = entry.player || {};
    const player = {
      ...rosterPlayer,
      ...(playersById.get(String(rosterPlayer.id)) || {}),
    };
    const group = getSquadPositionGroup(entry.position || player.position);
    if (!group) return;

    groups[group].push({
      name: player.name || player.short_name || "Sin nombre",
      number: player.jersey_number ?? entry.jersey_number ?? "—",
      club:
        player.club?.name ||
        player.club_name ||
        entry.club?.name ||
        entry.club_name ||
        "",
    });
  });

  sortSquadGroups(groups);
  return {
    coach: "No disponible",
    groups,
  };
}

function getSquadPositionGroup(position) {
  const normalized = normalizeLookup(position);
  if (["goalkeeper", "keeper", "gk", "g", "arquero"].includes(normalized)) return "goalkeepers";
  if (["defender", "defence", "defense", "df", "d", "defensor"].includes(normalized)) return "defenders";
  if (["midfielder", "midfield", "mf", "m", "mediocampista"].includes(normalized)) return "midfielders";
  if (["forward", "striker", "attacker", "fw", "f", "delantero"].includes(normalized)) return "forwards";
  return "";
}

function sortSquadGroups(groups) {
  Object.values(groups).forEach((players) => {
    players.sort(
      (a, b) =>
        (Number(a.number) || Number.MAX_SAFE_INTEGER) -
          (Number(b.number) || Number.MAX_SAFE_INTEGER) ||
        a.name.localeCompare(b.name, ARGENTINA_LOCALE),
    );
  });
}

function enrichSquad(primarySquad, supplementalSquad) {
  if (!supplementalSquad) return primarySquad;

  const supplementalPlayers = new Map(
    Object.values(supplementalSquad.groups)
      .flat()
      .map((player) => [normalizeLookup(player.name), player]),
  );
  const groups = Object.fromEntries(
    Object.entries(primarySquad.groups).map(([group, players]) => [
      group,
      players.map((player) => {
        const supplementalPlayer = supplementalPlayers.get(normalizeLookup(player.name));
        return {
          ...player,
          number:
            player.number && player.number !== "—"
              ? player.number
              : supplementalPlayer?.number || "—",
          club: player.club || supplementalPlayer?.club || "",
        };
      }),
    ]),
  );

  return {
    coach:
      primarySquad.coach && primarySquad.coach !== "No disponible"
        ? primarySquad.coach
        : supplementalSquad.coach || "No disponible",
    groups,
  };
}

function getSquadCacheKey(teamName) {
  return `${SQUAD_SEASON}:${normalizeLookup(teamName)}`;
}

function readCachedSquad(teamName) {
  const cache = readJson(STORAGE_KEYS.squadCache, {});
  const entry = cache[getSquadCacheKey(teamName)];
  if (
    !entry?.squad?.groups ||
    Date.now() - Number(entry.cachedAt) > SQUAD_CACHE_TTL_MS
  ) {
    return null;
  }
  return applySquadCoachOverride(teamName, entry.squad);
}

function applySquadCoachOverride(teamName, squad) {
  if (!squad) return squad;
  return {
    ...squad,
    coach: SQUAD_COACH_OVERRIDES[teamName] || squad.coach || "No disponible",
  };
}

function writeCachedSquad(teamName, squad) {
  try {
    const normalizedSquad = applySquadCoachOverride(teamName, squad);
    const cache = readJson(STORAGE_KEYS.squadCache, {});
    cache[getSquadCacheKey(teamName)] = {
      season: SQUAD_SEASON,
      cachedAt: Date.now(),
      squad: normalizedSquad,
    };
    writeJson(STORAGE_KEYS.squadCache, cache);
  } catch (error) {
    console.warn("No se pudo guardar el caché de convocados.", error);
  }
}

function renderSquadView() {
  if (state.squadLoading) {
    elements.squadContent.innerHTML = `<p class="section-empty">Cargando convocados...</p>`;
    return;
  }

  const squad = state.selectedSquad;
  const hasPlayers = squad && Object.values(squad.groups).some((players) => players.length);
  if (!hasPlayers) {
    elements.squadContent.innerHTML = `<p class="section-empty">Convocados no disponibles</p>`;
    return;
  }

  const sections = [
    ["Arqueros", squad.groups.goalkeepers],
    ["Defensores", squad.groups.defenders],
    ["Mediocampistas", squad.groups.midfielders],
    ["Delanteros", squad.groups.forwards],
  ];

  elements.squadContent.innerHTML = `
    <div class="squad-coach"><span>DT</span><strong>${escapeHtml(squad.coach)}</strong></div>
    <div class="squad-groups">
      ${sections.map(([title, players]) => `
        <section class="squad-group">
          <h3>${title}</h3>
          ${players.length ? `<div class="squad-players">
            ${players.map((player) => `
              <article class="squad-player">
                <span class="player-number">${escapeHtml(player.number)}</span>
                <div>
                  <strong>${escapeHtml(player.name)}</strong>
                  ${player.club ? `<small>${escapeHtml(player.club)}</small>` : ""}
                </div>
              </article>
            `).join("")}
          </div>` : `<p class="squad-group-empty">Sin datos</p>`}
        </section>
      `).join("")}
    </div>
  `;
}

function renderScorerList(scorers) {
  if (!scorers.length) return `<span class="no-goals">Sin goles</span>`;
  return scorers
    .map(
      (goal) => `
        <span class="goal-item">
          <strong>${escapeHtml(goal.name)}</strong>
          <small>${escapeHtml(goal.minute)}${goal.ownGoal ? " · en contra" : ""}</small>
        </span>
      `,
    )
    .join("");
}

function renderPredictionCard(match) {
  const prediction = getMatchPrediction(match, { matches: state.matches });
  if (!prediction) return "";

  const entries = [
    { label: translateTeam(match.team1), value: prediction.homeWin },
    { label: "Empate", value: prediction.draw },
    { label: translateTeam(match.team2), value: prediction.awayWin },
  ];
  const confidence = getPredictionConfidenceLabel(prediction.confidence);

  return `
    <section class="premium-section prediction-card" aria-label="Predicción IA">
      <div class="premium-section-heading">
        <span>🤖 Predicción IA</span>
        <strong>${escapeHtml(prediction.predictedScore.label)}</strong>
      </div>
      <div class="prediction-bars">
        ${entries.map((entry) => `
          <div class="prediction-row">
            <div>
              <span>${escapeHtml(entry.label)}</span>
              <strong>${entry.value}%</strong>
            </div>
            <span class="prediction-track" aria-hidden="true">
              <span style="width: ${entry.value}%"></span>
            </span>
          </div>
        `).join("")}
      </div>
      <div class="prediction-confidence is-${escapeHtml(prediction.confidence)}">
        <span>${escapeHtml(confidence.icon)}</span>
        <strong>Confianza ${escapeHtml(confidence.label)}</strong>
      </div>
      <div class="prediction-reasons">
        <span>Fuente: ${prediction.source === "api" ? "API externa" : "modelo local"}</span>
        <span>Actualizado: ${formatPredictionDate(prediction.updatedAt)}</span>
      </div>
      <p class="prediction-disclaimer">${escapeHtml(prediction.explanation)}</p>
    </section>
  `;
}

function getPredictionConfidenceLabel(confidence) {
  const labels = {
    high: { icon: "🟢", label: "Alta" },
    medium: { icon: "🟡", label: "Media" },
    low: { icon: "🔴", label: "Baja" },
  };
  return labels[confidence] || labels.low;
}

function formatPredictionDate(value) {
  if (!value) return "sin fecha";
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00` : value);
  if (!Number.isFinite(date.getTime())) return escapeHtml(value);
  return date.toLocaleDateString(ARGENTINA_LOCALE, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: ARGENTINA_TIME_ZONE,
  });
}

function renderBroadcastSection(match) {
  const broadcast = getBroadcastInfo(match);
  const hasChannels = broadcast.status === "confirmed" && broadcast.channels.length > 0;

  return `
    <section class="premium-section broadcast-card" aria-label="Dónde verlo en Argentina">
      <div class="premium-section-heading">
        <span>📺 Dónde verlo en Argentina</span>
        ${broadcast.updatedAt ? `<strong>${escapeHtml(formatPredictionDate(broadcast.updatedAt))}</strong>` : ""}
      </div>
      ${
        hasChannels
          ? `
            <div class="broadcast-chips">
              ${broadcast.channels.map((channel) => `
                <span class="broadcast-chip">
                  ${channel.logo ? `<img src="${escapeHtml(channel.logo)}" alt="" loading="lazy" />` : ""}
                  <strong>${escapeHtml(channel.name)}</strong>
                </span>
              `).join("")}
            </div>
            <p class="broadcast-source">
              Fuente:
              ${
                broadcast.sourceUrl
                  ? `<a href="${escapeHtml(broadcast.sourceUrl)}" target="_blank" rel="noreferrer">${escapeHtml(broadcast.sourceName || "fuente oficial")}</a>`
                  : escapeHtml(broadcast.sourceName || "fuente oficial")
              }
            </p>
          `
          : `<p class="broadcast-pending">Transmisión en Argentina pendiente de confirmación oficial.</p>`
      }
    </section>
  `;
}

function renderStatisticsSection(statistics) {
  if (!statistics?.rows?.length) return "";

  return `
    <section class="premium-section match-statistics" aria-label="Estadísticas del Partido">
      <div class="premium-section-heading">
        <span>Estadísticas del Partido</span>
        <strong>${escapeHtml(translateTeam(statistics.team1))} vs ${escapeHtml(translateTeam(statistics.team2))}</strong>
      </div>
      <div class="stats-list">
        ${statistics.rows.map((row) => `
          <div class="stat-row">
            <div class="stat-values">
              <strong>${escapeHtml(row.team1Value)}</strong>
              <span>${escapeHtml(row.label)}</span>
              <strong>${escapeHtml(row.team2Value)}</strong>
            </div>
            <div class="stat-bars" aria-hidden="true">
              <span class="stat-bar is-team1"><i style="width: ${row.team1Width}%"></i></span>
              <span class="stat-bar is-team2"><i style="width: ${row.team2Width}%"></i></span>
            </div>
          </div>
        `).join("")}
      </div>
    </section>
  `;
}

function renderTimelineSection(timeline) {
  const visibleEvents = (timeline || []).filter((event) =>
    ["goal", "yellow", "red", "substitution", "halftime", "second-half", "fulltime", "kickoff"].includes(event.type),
  );
  if (!visibleEvents.length) return "";

  return `
    <section class="premium-section match-timeline" aria-label="Timeline del partido">
      <div class="premium-section-heading">
        <span>Timeline</span>
        <strong>${visibleEvents.length} eventos</strong>
      </div>
      <ol class="timeline-list">
        ${visibleEvents.map((event) => `
          <li class="timeline-event is-${escapeHtml(event.type)} ${event.side ? `is-${event.side}` : "is-neutral"}">
            <span class="timeline-minute">${escapeHtml(event.minuteLabel)}</span>
            <div class="timeline-dot" aria-hidden="true"></div>
            <div class="timeline-content">
              <strong>${escapeHtml(event.label)}</strong>
              ${event.team ? `<span>${escapeHtml(translateTeam(event.team))}</span>` : ""}
              ${event.assist ? `<small>Asistencia: ${escapeHtml(event.assist)}</small>` : ""}
              ${event.ownGoal ? `<small>Gol en contra</small>` : ""}
            </div>
          </li>
        `).join("")}
      </ol>
    </section>
  `;
}

function renderPlayerOfMatchSection(playerOfMatch) {
  if (!playerOfMatch?.name || !playerOfMatch.team) return "";
  const hasEnoughData =
    playerOfMatch.goals ||
    playerOfMatch.assists ||
    playerOfMatch.shots ||
    playerOfMatch.rating;
  if (!hasEnoughData) return "";

  return `
    <section class="premium-section player-of-match" aria-label="Figura del partido">
      <div class="premium-section-heading">
        <span>Figura del partido</span>
        ${playerOfMatch.rating ? `<strong>${escapeHtml(playerOfMatch.rating)} rating</strong>` : ""}
      </div>
      <div class="player-card">
        <div>
          <strong>${escapeHtml(playerOfMatch.name)}</strong>
          <span>${escapeHtml(translateTeam(playerOfMatch.team))}</span>
        </div>
        <dl>
          <div><dt>Goles</dt><dd>${playerOfMatch.goals || 0}</dd></div>
          <div><dt>Asist.</dt><dd>${playerOfMatch.assists || 0}</dd></div>
          <div><dt>Remates</dt><dd>${playerOfMatch.shots || 0}</dd></div>
          ${playerOfMatch.rating ? `<div><dt>Rating</dt><dd>${escapeHtml(playerOfMatch.rating)}</dd></div>` : ""}
        </dl>
      </div>
    </section>
  `;
}

function handleStadiumImageError(event) {
  const image = event.target.closest("[data-stadium-image]");
  if (!image || image.src.endsWith("/stadiums/placeholder.svg")) return;
  image.src = "/stadiums/placeholder.svg";
}

function renderMatchDetailView() {
  const match = getMatchById(elements.sectionModal.dataset.item);
  if (!match) {
    elements.sectionContent.innerHTML = `<p class="section-empty">No se encontró el partido seleccionado.</p>`;
    return;
  }

  const stadium = match.stadiumInfo;
  const played = match.status === "finished" || match.status === "live";
  const team1Scorers = (match.scorers || []).filter((goal) => goal.side === "team1");
  const team2Scorers = (match.scorers || []).filter((goal) => goal.side === "team2");

  elements.sectionContent.innerHTML = `
    <article class="match-detail-card">
      <div class="match-detail-hero">
        <div class="match-detail-hero-copy">
          <span class="team-detail-rank">${escapeHtml(match.groupLabel || match.roundLabel || "Fase eliminatoria")}</span>
          <h3>${renderTeamLabel(match.team1)} <span>vs</span> ${renderTeamLabel(match.team2)}</h3>
          <p>${formatDate(match.kickoff)} · ${match.time} ARG</p>
        </div>
      </div>
      ${renderPredictionCard(match)}
      ${renderBroadcastSection(match)}
      ${played && match.result ? `
        <section class="match-result-detail" aria-label="Resultado del partido">
          <span class="match-result-status is-${match.status}">${getMatchStatusLabel(match.status)}</span>
          <div class="match-result-scoreboard">
            <strong>${renderTeamLabel(match.team1)}</strong>
            <b>${match.result.team1Goals} - ${match.result.team2Goals}</b>
            <strong>${renderTeamLabel(match.team2)}</strong>
          </div>
          <div class="match-goals">
            <div>
              ${renderScorerList(team1Scorers)}
            </div>
            <div>
              ${renderScorerList(team2Scorers)}
            </div>
          </div>
        </section>
      ` : ""}
      <figure class="stadium-visual">
        <img src="${escapeHtml(stadium?.image || "/stadiums/placeholder.svg")}" alt="${escapeHtml(stadium?.name || "Estadio del partido")}" loading="lazy" data-stadium-image />
        <figcaption>
          <strong>${escapeHtml(stadium?.name || match.stadiumLabel || "Estadio por confirmar")}</strong>
          ${stadium?.commonName ? `<span>${escapeHtml(stadium.commonName)}</span>` : ""}
        </figcaption>
      </figure>
      <div class="match-detail-grid">
        <div><span>Ciudad</span><strong>${escapeHtml(stadium?.city || match.city || "Por confirmar")}</strong></div>
        <div><span>Estadio</span><strong>${escapeHtml(stadium?.name || match.stadiumLabel || "Por confirmar")}</strong></div>
        <div><span>País</span><strong>${escapeHtml(stadium?.country || "Por confirmar")}</strong></div>
        <div><span>Capacidad</span><strong>${formatCapacity(stadium?.capacity)}</strong></div>
      </div>
      ${renderStatisticsSection(match.statistics)}
      ${renderTimelineSection(match.timeline)}
      ${renderPlayerOfMatchSection(match.playerOfMatch)}
    </article>
  `;

}

function calculateStandings() {

  return getGroups().map(([group, teams]) => {
    const rows = new Map(
      [...teams].map((team) => [
        team,
        {
          team,
          played: 0,
          won: 0,
          drawn: 0,
          lost: 0,
          goalsFor: 0,
          goalsAgainst: 0,
          goalDifference: 0,
          points: 0,
        },
      ]),
    );

    state.matches
      .filter(
        (match) =>
          match.group === group &&
          match.result &&
          match.status === "finished",
      )
      .forEach((match) => {
        const result = match.result;
        const home = rows.get(match.team1);
        const away = rows.get(match.team2);
        if (!home || !away) return;

        home.played += 1;
        away.played += 1;
        home.goalsFor += result.team1Goals;
        home.goalsAgainst += result.team2Goals;
        away.goalsFor += result.team2Goals;
        away.goalsAgainst += result.team1Goals;

        if (result.team1Goals > result.team2Goals) {
          home.won += 1;
          home.points += 3;
          away.lost += 1;
        } else if (result.team1Goals < result.team2Goals) {
          away.won += 1;
          away.points += 3;
          home.lost += 1;
        } else {
          home.drawn += 1;
          away.drawn += 1;
          home.points += 1;
          away.points += 1;
        }
      });

    const sortedRows = [...rows.values()]
      .map((row) => ({
        ...row,
        goalDifference: row.goalsFor - row.goalsAgainst,
      }))
      .sort(
        (rowA, rowB) =>
          rowB.points - rowA.points ||
          rowB.goalDifference - rowA.goalDifference ||
          rowB.goalsFor - rowA.goalsFor ||
          translateTeam(rowA.team).localeCompare(translateTeam(rowB.team), ARGENTINA_LOCALE),
      );

    return [group, sortedRows];
  });
}

function formatGoalDifference(value) {
  return value > 0 ? `+${value}` : String(value);
}

async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  try {
    await navigator.serviceWorker.register("/sw.js");
  } catch (error) {
    console.warn("Service worker no disponible.", error);
  }
}

function isValidDateValue(value) {
  return value !== null && value !== "" && Number.isFinite(new Date(value).getTime());
}

function getStatusText(count) {
  if (state.loading) return "Cargando partidos...";
  if (state.error) return state.error;
  if (!state.matches.length) return "Sin partidos cargados.";
  return `${count} partidos visibles`;
}

function getNextMatchDate() {
  const currentDate = state.selectedDate || todayArgentinaKey();
  const nextMatch = state.matches.find((match) => matchArgentinaDateKey(match) > currentDate);

  return nextMatch ? matchArgentinaDateKey(nextMatch) : currentDate;
}

function formatDate(date) {
  return date.toLocaleDateString(ARGENTINA_LOCALE, {
    weekday: "short",
    day: "2-digit",
    month: "short",
    timeZone: ARGENTINA_TIME_ZONE,
  });
}

function getArgentinaDateKey(date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: ARGENTINA_TIME_ZONE,
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  return `${year}-${month}-${day}`;
}

function todayArgentinaKey() {
  return getArgentinaDateKey(new Date());
}

function matchArgentinaDateKey(match) {
  if (match?.kickoff) return getArgentinaDateKey(match.kickoff);
  if (match?.date) return match.date;
  return "";
}

function formatTimeArgentina(date) {
  const parts = new Intl.DateTimeFormat("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: ARGENTINA_TIME_ZONE,
  }).formatToParts(date);
  const hour = parts.find((part) => part.type === "hour").value;
  const minute = parts.find((part) => part.type === "minute").value;
  return `${hour}:${minute}`;
}

function isMatchLive(match, now = Date.now()) {
  if (!match?.kickoff) return false;
  if (match.status === "finished") return false;
  if (match.status === "live") return true;
  return now >= match.kickoff.getTime();
}

function getArgentinaCountdownLabel(match, now = Date.now()) {
  if (!match?.kickoff) return "";
  if (match.status === "finished") return "Finalizado";
  if (isMatchLive(match, now)) return "🔴 EN VIVO";

  const diffMs = Math.max(0, match.kickoff.getTime() - now);
  const totalSeconds = Math.floor(diffMs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (days >= 1) {
    return `⏳ ${formatCountdownPart(days, "día", "días")} · ${formatCountdownPart(hours, "h", "h")} · ${formatCountdownPart(minutes, "min", "min")} · ${formatCountdownPart(seconds, "s", "s")}`;
  }

  if (hours >= 1) {
    return `⏳ ${formatCountdownPart(hours, "h", "h")} · ${formatCountdownPart(minutes, "min", "min")} · ${formatCountdownPart(seconds, "s", "s")}`;
  }

  return `🔴 Comienza en ${formatCountdownPart(minutes, "min", "min")} · ${formatCountdownPart(seconds, "s", "s")}`;
}

function formatCountdownPart(value, singular, plural) {
  const suffix = value === 1 ? singular : plural;
  return `${value} ${suffix}`;
}

function startArgentinaCountdown() {
  if (state.nextArgentinaCountdownTimer) return;
  state.nextArgentinaCountdownTimer = window.setInterval(() => {
    if (elements.nextArgentinaCard) renderNextArgentinaCard();
  }, 1000);
}

function toArgentinaDateInputValue(date) {
  return getArgentinaDateKey(date);
}

function readJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function readBoolean(key, fallback) {
  const value = localStorage.getItem(key);
  if (value === null) return fallback;
  return value === "true";
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
