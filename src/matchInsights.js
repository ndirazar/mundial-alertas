export function normalizeEspnEventPayload(competition, teamNames = {}) {
  if (!competition) {
    return {
      statistics: null,
      timeline: [],
      playerOfMatch: null,
      performanceByTeam: {},
    };
  }

  const competitors = competition.competitors || [];
  const home = competitors.find((team) => team.homeAway === "home");
  const away = competitors.find((team) => team.homeAway === "away");

  const statistics = normalizeStatistics(
    competitors,
    home?.team?.displayName || "",
    away?.team?.displayName || "",
  );
  const timeline = normalizeTimeline(
    competition.details || [],
    teamNames,
    home?.team?.displayName || "",
    away?.team?.displayName || "",
  );
  const performanceByTeam = summarizePerformanceByTeam(timeline);
  const playerOfMatch = selectPlayerOfMatch(timeline, teamNames, performanceByTeam);

  return {
    statistics,
    timeline,
    playerOfMatch,
    performanceByTeam,
  };
}

function normalizeStatistics(competitors, homeTeamName, awayTeamName) {
  if (!Array.isArray(competitors) || competitors.length < 2) return null;

  const home = competitors.find((team) => team.homeAway === "home") || competitors[0];
  const away = competitors.find((team) => team.homeAway === "away") || competitors[1];
  const homeStats = indexStatistics(home.statistics || []);
  const awayStats = indexStatistics(away.statistics || []);

  const rows = [
    createStatRow("Posesión", ["possessionPct", "possession"], homeStats, awayStats, "percent"),
    createStatRow("Remates", ["shotsTotal", "totalShots"], homeStats, awayStats),
    createStatRow("Al arco", ["shotsOnTarget", "onTargetShots"], homeStats, awayStats),
    createStatRow("Corners", ["wonCorners", "corners"], homeStats, awayStats),
    createStatRow("Faltas", ["foulsCommitted", "fouls"], homeStats, awayStats),
    createStatRow("Offsides", ["offsides"], homeStats, awayStats),
    createStatRow("Amarillas", ["yellowCards"], homeStats, awayStats),
    createStatRow("Rojas", ["redCards"], homeStats, awayStats),
    createStatRow("Atajadas", ["saves"], homeStats, awayStats),
    createStatRow("Cambios", ["substitutions", "subs"], homeStats, awayStats),
  ].filter(Boolean);

  if (!rows.length) return null;

  return {
    team1: homeTeamName,
    team2: awayTeamName,
    rows,
  };
}

function indexStatistics(statistics) {
  return statistics.reduce((acc, item) => {
    const keys = [
      item.name,
      item.abbreviation,
      item.displayName,
      item.shortDisplayName,
    ]
      .filter(Boolean)
      .map(normalizeKey);
    keys.forEach((key) => {
      acc[key] = item.displayValue ?? item.value ?? "";
    });
    return acc;
  }, {});
}

function createStatRow(label, keys, homeStats, awayStats, format = "number") {
  const homeRaw = firstStatValue(keys, homeStats);
  const awayRaw = firstStatValue(keys, awayStats);
  if (homeRaw === null || awayRaw === null) return null;

  const homeNumeric = parseNumericValue(homeRaw);
  const awayNumeric = parseNumericValue(awayRaw);
  if (homeNumeric === null || awayNumeric === null) return null;
  const total = Math.max(homeNumeric + awayNumeric, 1);
  const maxValue = Math.max(homeNumeric, awayNumeric, 1);

  return {
    label,
    team1Value: formatStatValue(homeNumeric, format),
    team2Value: formatStatValue(awayNumeric, format),
    team1Width: Math.max(14, Math.round((homeNumeric / maxValue) * 100)),
    team2Width: Math.max(14, Math.round((awayNumeric / maxValue) * 100)),
    team1Share: Math.round((homeNumeric / total) * 100),
    team2Share: Math.round((awayNumeric / total) * 100),
  };
}

function firstStatValue(keys, stats) {
  for (const key of keys.map(normalizeKey)) {
    if (key in stats) return stats[key];
  }
  return null;
}

function formatStatValue(value, format) {
  if (format === "percent") return `${Math.round(value)}%`;
  return String(Math.round(value));
}

function normalizeTimeline(details, teamNames, homeTeamName, awayTeamName) {
  const parsed = (details || [])
    .map((detail, index) => normalizeTimelineEvent(detail, index, teamNames))
    .filter(Boolean)
    .sort((eventA, eventB) => eventA.minuteValue - eventB.minuteValue || eventA.order - eventB.order);

  const phaseEvents = createPhaseEvents(parsed, homeTeamName, awayTeamName);
  const allEvents = [...parsed, ...phaseEvents]
    .sort((eventA, eventB) => eventA.minuteValue - eventB.minuteValue || eventA.order - eventB.order)
    .map((event, index) => ({ ...event, order: index }));

  return allEvents.length ? allEvents : [];
}

function normalizeTimelineEvent(detail, index, teamNames) {
  const rawText = detail.text || detail.shortText || detail.type?.text || "";
  const text = String(rawText).trim();
  if (!text) return null;

  const type = inferTimelineType(detail, text);
  if (!type) return null;

  const minuteLabel = detail.clock?.displayValue || inferMinuteLabel(text);
  const minuteValue = parseMinuteValue(minuteLabel);
  const athlete = detail.athletesInvolved?.[0];
  const assistant = detail.athletesInvolved?.[1];
  const teamName = teamNames[String(detail.team?.id)] || detail.team?.displayName || "";

  return {
    order: index,
    type,
    minuteLabel: minuteLabel || "—",
    minuteValue,
    team: teamName,
    player: athlete?.displayName || inferPlayerName(text),
    assist: assistant?.displayName || "",
    label: buildEventLabel(type, text, athlete?.displayName || ""),
    detail: text,
    ownGoal: Boolean(detail.ownGoal),
  };
}

function createPhaseEvents(events, homeTeamName, awayTeamName) {
  if (!events.length) return [];

  const scheduled = [];
  const firstMinute = events[0]?.minuteValue ?? 0;
  const lastMinute = events.at(-1)?.minuteValue ?? 90;
  const lastTeamEvent = events.at(-1);
  const alreadyHasBreak = events.some((event) => event.type === "halftime");
  const alreadyHasRestart = events.some((event) => event.type === "second-half");
  const alreadyHasFinal = events.some((event) => event.type === "fulltime");

  scheduled.push({
    order: -3,
    type: "kickoff",
    minuteLabel: "0'",
    minuteValue: Math.min(firstMinute, 0),
    team: "",
    player: "",
    assist: "",
    label: `Comenzó ${homeTeamName} vs ${awayTeamName}`,
    detail: "Inicio del partido",
  });
  if (!alreadyHasBreak && lastMinute >= 40) {
    scheduled.push({
      order: 9991,
      type: "halftime",
      minuteLabel: "45'",
      minuteValue: 45,
      team: "",
      player: "",
      assist: "",
      label: "Entretiempo",
      detail: "Fin del primer tiempo",
    });
  }
  if (!alreadyHasRestart && lastMinute >= 46) {
    scheduled.push({
      order: 9992,
      type: "second-half",
      minuteLabel: "46'",
      minuteValue: 46,
      team: "",
      player: "",
      assist: "",
      label: "Segundo tiempo",
      detail: "Comenzó el segundo tiempo",
    });
  }
  if (!alreadyHasFinal && lastMinute >= 88) {
    scheduled.push({
      order: 9993,
      type: "fulltime",
      minuteLabel: "90'",
      minuteValue: Math.max(lastMinute, 90),
      team: lastTeamEvent?.team || "",
      player: "",
      assist: "",
      label: "Final del partido",
      detail: "Partido finalizado",
    });
  }

  return scheduled;
}

function summarizePerformanceByTeam(events) {
  return events.reduce((acc, event) => {
    if (!event.team) return acc;
    if (!acc[event.team]) {
      acc[event.team] = {
        goals: 0,
        assists: 0,
        shots: 0,
        yellows: 0,
        reds: 0,
        substitutions: 0,
      };
    }
    const team = acc[event.team];
    if (event.type === "goal") {
      team.goals += 1;
      team.shots += 1;
      if (event.assist) team.assists += 1;
    }
    if (event.type === "shot") team.shots += 1;
    if (event.type === "yellow") team.yellows += 1;
    if (event.type === "red") team.reds += 1;
    if (event.type === "substitution") team.substitutions += 1;
    return acc;
  }, {});
}

function selectPlayerOfMatch(events, teamNames, performanceByTeam) {
  const players = new Map();

  events.forEach((event) => {
    if (!event.player) return;
    const key = `${normalizeKey(event.player)}|${normalizeKey(event.team)}`;
    if (!players.has(key)) {
      players.set(key, {
        name: event.player,
        team: event.team,
        goals: 0,
        assists: 0,
        shots: 0,
        yellows: 0,
        reds: 0,
        rating: null,
        score: 0,
      });
    }
    const player = players.get(key);
    if (event.type === "goal") {
      player.goals += 1;
      player.shots += 1;
      player.score += 5;
      if (event.assist) player.assists += 1;
    }
    if (event.type === "yellow") {
      player.yellows += 1;
      player.score -= 1.2;
    }
    if (event.type === "red") {
      player.reds += 1;
      player.score -= 2.4;
    }
    if (event.type === "shot") {
      player.shots += 1;
      player.score += 0.6;
    }
    if (event.assist && event.type !== "goal") {
      player.assists += 1;
      player.score += 2.2;
    }
  });

  const best = [...players.values()]
    .map((player) => {
      const teamPerformance = performanceByTeam[player.team] || {};
      const teamGoals = teamPerformance.goals || 0;
      const baselineRating = 6.2 +
        player.goals * 1.1 +
        player.assists * 0.7 +
        player.shots * 0.12 -
        player.yellows * 0.18 -
        player.reds * 0.6 +
        teamGoals * 0.05;
      return {
        ...player,
        rating: Number(clamp(baselineRating, 6.0, 9.8).toFixed(1)),
      };
    })
    .sort((playerA, playerB) =>
      playerB.score - playerA.score ||
      playerB.goals - playerA.goals ||
      playerB.assists - playerA.assists ||
      playerB.shots - playerA.shots,
    )[0];

  if (!best || best.score < 2.4) return null;
  return best;
}

function inferTimelineType(detail, text) {
  const typeText = normalizeKey(detail.type?.text || detail.type?.name || detail.type?.abbreviation || "");
  const normalizedText = normalizeKey(text);
  if (detail.scoringPlay || typeText.includes("goal") || normalizedText.includes("goal")) return "goal";
  if (normalizedText.includes("yellow")) return "yellow";
  if (normalizedText.includes("red card") || normalizedText.includes("red")) return "red";
  if (normalizedText.includes("substitution") || normalizedText.includes("change")) return "substitution";
  if (normalizedText.includes("halftime") || normalizedText.includes("entretiempo")) return "halftime";
  if (normalizedText.includes("second half") || normalizedText.includes("segundo tiempo")) return "second-half";
  if (normalizedText.includes("full time") || normalizedText.includes("final del partido") || normalizedText === "end of match") return "fulltime";
  if (normalizedText.includes("shot")) return "shot";
  return "";
}

function buildEventLabel(type, text, playerName) {
  const labels = {
    goal: "⚽ Gol",
    yellow: "🟨 Tarjeta amarilla",
    red: "🟥 Tarjeta roja",
    substitution: "🔄 Cambio",
    halftime: "⏸ Entretiempo",
    "second-half": "▶ Inicio segundo tiempo",
    fulltime: "🏁 Final",
    shot: "Remate",
    kickoff: "Inicio",
  };
  return playerName ? `${labels[type] || "Evento"} · ${playerName}` : labels[type] || text;
}

function inferMinuteLabel(text) {
  const match = text.match(/(\d{1,3}(?:\+\d{1,2})?)'/);
  return match ? `${match[1]}'` : "";
}

function inferPlayerName(text) {
  const playerText = String(text).split(" for ")[0].split(" by ")[0];
  const compact = playerText.replace(/\d{1,3}(?:\+\d{1,2})?'/g, "").trim();
  return compact.length > 2 ? compact : "";
}

function parseMinuteValue(value) {
  if (!value) return 0;
  const normalized = String(value).replace(/[^\d+]/g, "");
  if (!normalized) return 0;
  const [base, extra] = normalized.split("+").map(Number);
  return Number(base || 0) + Number(extra || 0) / 100;
}

function parseNumericValue(value) {
  if (value === null || value === undefined || value === "") return null;
  const normalized = String(value).replace(",", ".").replace(/[^\d.-]/g, "");
  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? numeric : null;
}

function normalizeKey(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
