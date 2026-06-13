import { TEAM_RANKING } from "../data/teamRanking.js";

const MODEL_UPDATED_AT = "2026-06-13";
const DEFAULT_RANK = 48;
const HOST_COUNTRIES = {
  Canada: "Canadá",
  Mexico: "México",
  USA: "Estados Unidos",
};

export function getMatchPrediction(match, context = {}) {
  if (!match?.team1 || !match?.team2) return null;

  const matches = Array.isArray(context.matches) ? context.matches : [];
  const team1 = getTeamSnapshot(match.team1, match, matches);
  const team2 = getTeamSnapshot(match.team2, match, matches);
  const rankingEdge = getRankingRating(team1.rank) - getRankingRating(team2.rank);
  const formEdge = team1.formAdjustment - team2.formAdjustment;
  const tournamentEdge = team1.tournamentAdjustment - team2.tournamentAdjustment;
  const venueEdge = getVenueEdge(match);
  const totalEdge = clamp(rankingEdge + formEdge + tournamentEdge + venueEdge, -520, 520);
  const knockout = isKnockoutMatch(match);
  const probabilities = ratingEdgeToProbabilities(totalEdge, knockout);
  return {
    source: "local",
    homeWin: probabilities.team1,
    draw: probabilities.draw,
    awayWin: probabilities.team2,
    confidence: getConfidence(team1, team2),
    factors: buildFactorLabels(match, team1, team2, venueEdge, knockout),
    explanation: "Predicción estimada, no oficial.",
    updatedAt: MODEL_UPDATED_AT,
  };
}

function getTeamSnapshot(team, targetMatch, matches) {
  const rank = TEAM_RANKING.find((item) => item.name === team)?.rank || DEFAULT_RANK;
  const previousMatches = getPreviousFinishedMatches(team, targetMatch, matches);
  const recent = summarizeMatchesForTeam(team, previousMatches.slice(0, 5));
  const tournament = summarizeMatchesForTeam(
    team,
    previousMatches.filter((match) => Boolean(match.group)).slice(0, 3),
  );

  return {
    rank,
    played: recent.played,
    tournamentPlayed: tournament.played,
    formAdjustment: getPerformanceAdjustment(recent, 105),
    tournamentAdjustment: getPerformanceAdjustment(tournament, 45),
  };
}

function getPreviousFinishedMatches(team, targetMatch, matches) {
  const targetTime = targetMatch.kickoff instanceof Date
    ? targetMatch.kickoff.getTime()
    : Number.POSITIVE_INFINITY;

  return matches
    .filter(
      (match) =>
        match !== targetMatch &&
        (match.team1 === team || match.team2 === team) &&
        match.result &&
        match.status === "finished" &&
        match.kickoff instanceof Date &&
        match.kickoff.getTime() < targetTime,
    )
    .sort((matchA, matchB) => matchB.kickoff.getTime() - matchA.kickoff.getTime());
}

function summarizeMatchesForTeam(team, matches) {
  return matches.reduce(
    (summary, match) => {
      const isTeam1 = match.team1 === team;
      const goalsFor = isTeam1 ? match.result.team1Goals : match.result.team2Goals;
      const goalsAgainst = isTeam1 ? match.result.team2Goals : match.result.team1Goals;
      summary.played += 1;
      summary.goalsFor += goalsFor;
      summary.goalsAgainst += goalsAgainst;
      if (goalsFor > goalsAgainst) summary.points += 3;
      else if (goalsFor === goalsAgainst) summary.points += 1;
      return summary;
    },
    { played: 0, points: 0, goalsFor: 0, goalsAgainst: 0 },
  );
}

function getRankingRating(rank) {
  return 1720 - 205 * Math.log(Math.max(rank, 1));
}

function getPerformanceAdjustment(summary, maxAdjustment) {
  if (!summary.played) return 0;
  const reliability = Math.min(summary.played / 5, 1);
  const pointsRate = summary.points / (summary.played * 3);
  const goalDifference = (summary.goalsFor - summary.goalsAgainst) / summary.played;
  const rawAdjustment = (pointsRate - 0.5) * 150 + clamp(goalDifference, -2, 2) * 24;
  return clamp(rawAdjustment * reliability, -maxAdjustment, maxAdjustment);
}

function getVenueEdge(match) {
  const venueCountry = match.stadiumInfo?.country || "";
  const team1IsHost = HOST_COUNTRIES[match.team1] === venueCountry;
  const team2IsHost = HOST_COUNTRIES[match.team2] === venueCountry;
  if (team1IsHost === team2IsHost) return 0;
  return team1IsHost ? 52 : -52;
}

function isKnockoutMatch(match) {
  return !match.group || /round of|quarter|semi|third place|final/i.test(match.round || "");
}

function ratingEdgeToProbabilities(edge, knockout) {
  const drawBase = knockout ? 21 : 27;
  const draw = Math.round(
    clamp(drawBase - Math.abs(edge) / 85, knockout ? 17 : 20, knockout ? 23 : 29),
  );
  const decisive = 100 - draw;
  const team1Share = 1 / (1 + 10 ** (-edge / 400));
  const team1 = clamp(Math.round(decisive * team1Share), 8, decisive - 8);
  return { team1, draw, team2: decisive - team1 };
}

function getConfidence(team1, team2) {
  const knownFormMatches = team1.played + team2.played;
  if (knownFormMatches >= 8) return "high";
  if (knownFormMatches >= 3) return "medium";
  return "low";
}

function buildFactorLabels(match, team1, team2, venueEdge, knockout) {
  const labels = [
    `Ranking FIFA #${team1.rank} vs #${team2.rank}`,
    team1.played + team2.played
      ? `Forma reciente: ${team1.played + team2.played} partidos previos`
      : "Forma reciente: sin datos suficientes",
    venueEdge === 0
      ? "Sede neutral"
      : `Localía de ${venueEdge > 0 ? match.team1 : match.team2}`,
    knockout ? "Fase eliminatoria" : "Fase de grupos",
  ];
  return labels;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
