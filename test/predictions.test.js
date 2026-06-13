import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { STADIUMS, STADIUMS_BY_GROUND } from "../src/data/stadiums.js";
import { getMatchPrediction } from "../src/utils/predictions.js";

function match(overrides = {}) {
  return {
    team1: "France",
    team2: "Spain",
    kickoff: new Date("2026-06-20T18:00:00Z"),
    group: "Group A",
    round: "Matchday 10",
    stadiumInfo: { country: "Estados Unidos" },
    ...overrides,
  };
}

function finished(overrides = {}) {
  return {
    team1: "France",
    team2: "Spain",
    kickoff: new Date("2026-06-10T18:00:00Z"),
    group: "Group A",
    round: "Matchday 1",
    status: "finished",
    result: { team1Goals: 1, team2Goals: 0 },
    ...overrides,
  };
}

function assertValid(prediction) {
  assert.equal(prediction.homeWin + prediction.draw + prediction.awayWin, 100);
  for (const value of [prediction.homeWin, prediction.draw, prediction.awayWin]) {
    assert.ok(Number.isInteger(value));
    assert.ok(value >= 8 && value <= 78);
  }
  assert.equal(prediction.explanation, "Predicción estimada, no oficial.");
}

test("probabilities are balanced and bounded", () => {
  const prediction = getMatchPrediction(match({ team2: "Haiti" }));
  assertValid(prediction);
  assert.ok(prediction.homeWin > prediction.awayWin);
});

test("neutral fixture is symmetric when teams are swapped", () => {
  const first = getMatchPrediction(match());
  const swapped = getMatchPrediction(match({ team1: "Spain", team2: "France" }));
  assert.equal(first.homeWin, swapped.awayWin);
  assert.equal(first.awayWin, swapped.homeWin);
  assert.equal(first.draw, swapped.draw);
});

test("host advantage is modest and only applies in host country", () => {
  const neutral = getMatchPrediction(match({ team1: "USA", team2: "Canada", stadiumInfo: { country: "México" } }));
  const home = getMatchPrediction(match({ team1: "USA", team2: "Canada", stadiumInfo: { country: "Estados Unidos" } }));
  assert.ok(home.homeWin > neutral.homeWin);
  assert.ok(home.homeWin - neutral.homeWin <= 8);
});

test("knockout phase lowers draw probability", () => {
  const group = getMatchPrediction(match());
  const knockout = getMatchPrediction(match({ group: "", round: "Quarter-final" }));
  assert.ok(knockout.draw < group.draw);
});

test("future results never affect an earlier prediction", () => {
  const target = match();
  const future = finished({ kickoff: new Date("2026-06-25T18:00:00Z"), result: { team1Goals: 8, team2Goals: 0 } });
  const baseline = getMatchPrediction(target, { matches: [] });
  const withFuture = getMatchPrediction(target, { matches: [future] });
  assert.deepEqual(withFuture, baseline);
});

test("prior form affects prediction without overpowering ranking", () => {
  const target = match({ team1: "France", team2: "Spain" });
  const history = [
    finished({ team1: "France", team2: "Haiti", result: { team1Goals: 0, team2Goals: 2 } }),
    finished({ team1: "Spain", team2: "Haiti", result: { team1Goals: 3, team2Goals: 0 }, kickoff: new Date("2026-06-11T18:00:00Z") }),
  ];
  const baseline = getMatchPrediction(target, { matches: [] });
  const adjusted = getMatchPrediction(target, { matches: history });
  assert.ok(adjusted.homeWin < baseline.homeWin);
  assertValid(adjusted);
});


test("all fixture predictions satisfy production limits", () => {
  const fixture = JSON.parse(
    fs.readFileSync(new URL("../public/fixture/worldcup-2026.json", import.meta.url), "utf8"),
  );
  const stadiumsById = new Map(STADIUMS.map((stadium) => [stadium.id, stadium]));
  const matches = fixture.matches.map((item, index) => ({
    ...item,
    id: String(index),
    kickoff: new Date(`${item.date}T12:00:00Z`),
    stadiumInfo: stadiumsById.get(STADIUMS_BY_GROUND[item.ground]) || null,
    status: "scheduled",
    result: null,
  }));

  matches.forEach((item) => assertValid(getMatchPrediction(item, { matches })));
});
