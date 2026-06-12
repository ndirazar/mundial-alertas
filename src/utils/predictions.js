import { TEAM_RANKING } from "../data/teamRanking.js";

const MODEL_UPDATED_AT = "2026-06-12";
const MARKET_VALUES = {};

export function getMatchPrediction(match, context = {}) {
  const localPrediction = buildLocalPrediction(match, context);
  return {
    source: "local",
    ...localPrediction,
  };
}

function buildLocalPrediction(match, context) {
  const matches = Array.isArray(context.matches) ? context.matches : [];
  const team1 = getTeamSnapshot(match.team1, matches);
  const team2 = getTeamSnapshot(match.team2, matches);
  const h2h = getHeadToHeadSnapshot(match.team1, match.team2, matches);
  const marketEdge = getMarketValueEdge(match.team1, match.team2);
  const rankingEdge = (team1.rankStrength - team2.rankStrength) * 45;
  const recentEdge = (team1.recentScore - team2.recentScore) * 20;
  const tournamentEdge = (team1.tournamentScore - team2.tournamentScore) * 15;
  const goalsEdge = (team1.goalScore - team2.goalScore) * 10;
  const h2hEdge = h2h.score * 5;
  const teamOrderBias = 2;
  const totalEdge =
    rankingEdge +
    recentEdge +
    tournamentEdge +
    goalsEdge +
    h2hEdge +
    marketEdge * 5 +
    teamOrderBias;
  const probabilities = edgeToProbabilities(totalEdge);
  const expectedGoals = getExpectedGoals(team1, team2, totalEdge);
  const predictedScore = getMostLikelyScore(expectedGoals.team1, expectedGoals.team2);
  const confidence = getConfidence(team1, team2, Math.abs(totalEdge));

  return {
    homeWin: probabilities.team1,
    draw: probabilities.draw,
    awayWin: probabilities.team2,
    predictedScore: {
      home: predictedScore.team1,
      away: predictedScore.team2,
      label: `${match.team1} ${predictedScore.team1}-${predictedScore.team2} ${match.team2}`,
    },
    confidence,
    explanation:
      "Estimación estadística basada en ranking FIFA, rendimiento reciente y estadísticas disponibles. No representa una predicción oficial.",
    updatedAt: MODEL_UPDATED_AT,
  };
}

function getTeamSnapshot(team, matches) {
  const rank = TEAM_RANKING.find((item) => item.name === team)?.rank || null;
  const rankStrength = rank ? clamp((86 - rank) / 85, 0.02, 1) : 0.42;
  const recentMatches = getFinishedMatches(team, matches).slice(0, 5);
  const tournamentMatches = getFinishedMatches(team, matches).filter((match) => Boolean(match.group));
  const recent = summarizeMatchesForTeam(team, recentMatches);
  const tournament = summarizeMatchesForTeam(team, tournamentMatches);
  const recentScore = recent.played ? recent.points / (recent.played * 3) : 0.5;
  const tournamentScore = tournament.played ? tournament.points / (tournament.played * 3) : recentScore;
  const goalsForAvg = recent.played ? recent.goalsFor / recent.played : 0.85 + rankStrength * 0.85;
  const goalsAgainstAvg = recent.played ? recent.goalsAgainst / recent.played : 1.38 - rankStrength * 0.58;
  const goalScore = clamp((goalsForAvg - goalsAgainstAvg) / 2.6, -1, 1);

  return {
    rank,
    rankStrength,
    recentScore,
    tournamentScore,
    goalsForAvg,
    goalsAgainstAvg,
    goalScore,
    played: recent.played,
    tournamentPlayed: tournament.played,
  };
}

function getFinishedMatches(team, matches) {
  return matches
    .filter(
      (match) =>
        (match.team1 === team || match.team2 === team) &&
        match.result &&
        match.status === "finished",
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

function getHeadToHeadSnapshot(team1, team2, matches) {
  const meetings = matches
    .filter(
      (match) =>
        match.result &&
        ((match.team1 === team1 && match.team2 === team2) ||
          (match.team1 === team2 && match.team2 === team1)),
    )
    .slice(0, 5);

  if (!meetings.length) return { score: 0 };

  const points = meetings.reduce((total, match) => {
    const team1Goals = match.team1 === team1 ? match.result.team1Goals : match.result.team2Goals;
    const team2Goals = match.team1 === team1 ? match.result.team2Goals : match.result.team1Goals;
    if (team1Goals > team2Goals) return total + 1;
    if (team1Goals < team2Goals) return total - 1;
    return total;
  }, 0);

  return { score: clamp(points / meetings.length, -1, 1) };
}

function getMarketValueEdge(team1, team2) {
  const team1Value = MARKET_VALUES[team1];
  const team2Value = MARKET_VALUES[team2];
  if (!team1Value || !team2Value) return 0;
  return clamp(Math.log(team1Value / team2Value) / 2.6, -1, 1);
}

function edgeToProbabilities(edge) {
  const draw = clamp(28 - Math.abs(edge) * 0.55, 9, 30);
  const decisive = 100 - draw;
  const team1Share = 1 / (1 + Math.exp(-edge / 12));
  const team1 = Math.round(decisive * team1Share);
  const roundedDraw = Math.round(draw);
  const team2 = Math.max(0, 100 - team1 - roundedDraw);
  return balanceProbabilities({ team1, draw: roundedDraw, team2 });
}

function balanceProbabilities(probabilities) {
  const total = probabilities.team1 + probabilities.draw + probabilities.team2;
  const balanced = total === 100
    ? probabilities
    : {
    ...probabilities,
    team2: Math.max(0, probabilities.team2 + (100 - total)),
  };
  if (balanced.team1 > 85 && balanced.team2 < 4) {
    return { ...balanced, team1: balanced.team1 - (4 - balanced.team2), team2: 4 };
  }
  if (balanced.team2 > 85 && balanced.team1 < 4) {
    return { ...balanced, team2: balanced.team2 - (4 - balanced.team1), team1: 4 };
  }
  return balanced;
}

function getExpectedGoals(team1, team2, edge) {
  return {
    team1: clamp(
      1.18 + (team1.goalsForAvg - 1.2) * 0.32 + (team2.goalsAgainstAvg - 1.1) * 0.22 + edge * 0.018,
      0.45,
      3.2,
    ),
    team2: clamp(
      1.08 + (team2.goalsForAvg - 1.2) * 0.32 + (team1.goalsAgainstAvg - 1.1) * 0.22 - edge * 0.018,
      0.25,
      2.9,
    ),
  };
}

function getMostLikelyScore(expectedTeam1, expectedTeam2) {
  const maxGoals = 6;
  const team1Distribution = createPoissonDistribution(expectedTeam1, maxGoals);
  const team2Distribution = createPoissonDistribution(expectedTeam2, maxGoals);
  let best = { team1: 1, team2: 1, probability: 0 };

  for (let team1Goals = 0; team1Goals <= maxGoals; team1Goals += 1) {
    for (let team2Goals = 0; team2Goals <= maxGoals; team2Goals += 1) {
      const probability = team1Distribution[team1Goals] * team2Distribution[team2Goals];
      if (probability > best.probability) {
        best = { team1: team1Goals, team2: team2Goals, probability };
      }
    }
  }

  return best;
}

function createPoissonDistribution(lambda, maxGoals) {
  const distribution = [];
  let total = 0;
  for (let goals = 0; goals <= maxGoals; goals += 1) {
    const probability = (Math.exp(-lambda) * lambda ** goals) / factorial(goals);
    distribution.push(probability);
    total += probability;
  }
  return distribution.map((probability) => probability / total);
}

function factorial(value) {
  if (value <= 1) return 1;
  let result = 1;
  for (let index = 2; index <= value; index += 1) result *= index;
  return result;
}

function getConfidence(team1, team2, edge) {
  const dataScore =
    0.46 +
    Math.min(team1.played + team2.played, 8) * 0.04 +
    Math.min(team1.tournamentPlayed + team2.tournamentPlayed, 6) * 0.03 +
    Math.min(edge, 32) / 160;
  if (dataScore >= 0.78) return "high";
  if (dataScore >= 0.58) return "medium";
  return "low";
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
