import { randomUUID } from "crypto";
import type { Team, Match, InsertMatch } from "../shared/schema.js";

export type BracketMatch = InsertMatch & { id: string };

export interface BracketGenerationResult {
  matches: BracketMatch[];
}

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function getRoundName(round: number, totalRounds: number): string {
  const distance = totalRounds - round;
  const names = ["Final", "Semi-finals", "Quarter-finals", "Round of 16", "Round of 32", "Round of 64"];
  return distance < names.length ? names[distance] : `Round ${round}`;
}

/**
 * Generates standard bracket seedings for a bracket of the given size (must be power of 2).
 * Returns seedings[pos] = seed number for position pos (0-indexed).
 *
 * Seed 1 is always at position 0 (top of LEFT half).
 * Seed 2 is always at position halfSize (top of RIGHT half).
 * This guarantees seeds 1 and 2 can only meet in the FINAL.
 * When participantCount < bracketSize the highest seeds receive BYEs automatically,
 * because seeds > participantCount correspond to empty (BYE) bracket slots.
 */
function generateSeedings(bracketSize: number): number[] {
  let seeds = [1, 2];
  while (seeds.length < bracketSize) {
    const n = seeds.length * 2;
    const next: number[] = [];
    for (const s of seeds) {
      next.push(s);
      next.push(n + 1 - s);
    }
    seeds = next;
  }
  return seeds;
}

/**
 * Two-sided single elimination bracket — Challonge-style logic.
 *
 * Accepts any participant count ≥ 2 (not just powers of 2).
 * bracketSize = next power of 2 ≥ teams.length.
 * byeCount = bracketSize − teams.length; BYEs are distributed to top seeds.
 *
 * teams[0] = seed 1 (best), teams[1] = seed 2, …, teams[n-1] = seed n.
 * Assign seeds randomly or in registration order before calling this function
 * if explicit seeding is not available.
 *
 * BYE R1 matches:  isBye=1, status="completed", winnerId=real participant.
 * Real R1 matches: isBye=0, status="pending".
 * R2+ matches:     team IDs null initially; filled by progressWinner propagation.
 *
 * After saving all matches to the DB, call progressWinner for every BYE match
 * (sorted ascending by round) to propagate winners into R2+ slots and create
 * match threads for rounds where both participants are already known.
 */
export function generateSingleEliminationBracket(
  tournamentId: string,
  teams: Team[]
): BracketGenerationResult {
  const n = teams.length;
  if (n < 2) return { matches: [] };

  // Round participant count up to the next power of 2
  const bracketSize = n <= 2 ? 2 : Math.pow(2, Math.ceil(Math.log2(n)));
  const totalRounds = Math.log2(bracketSize);
  const halfSize = bracketSize / 2;

  // seedings[pos] = seed number at that bracket position (0-indexed).
  // teams[seed-1] is the participant; seeds > n are BYE slots.
  const seedings = generateSeedings(bracketSize);
  const getTeamBySeed = (seed: number): Team | null =>
    seed >= 1 && seed <= n ? (teams[seed - 1] ?? null) : null;

  // Pre-assign all match IDs upfront so every slot can reference its neighbors
  const idMap: Record<string, Record<number, Record<number, string>>> = {
    LEFT: {}, RIGHT: {}, FINAL: {},
  };
  for (let r = 1; r < totalRounds; r++) {
    idMap.LEFT[r] = {};
    idMap.RIGHT[r] = {};
    const count = halfSize / Math.pow(2, r);
    for (let i = 0; i < count; i++) {
      idMap.LEFT[r][i] = randomUUID();
      idMap.RIGHT[r][i] = randomUUID();
    }
  }
  idMap.FINAL[totalRounds] = { 0: randomUUID() };
  const finalId = idMap.FINAL[totalRounds][0];

  const result: BracketMatch[] = [];

  function makeMatch(
    id: string,
    round: number,
    matchIndex: number,
    side: string,
    team1: Team | null,
    team2: Team | null,
    nextMatchId: string | null,
    prevMatch1Id: string | null,
    prevMatch2Id: string | null,
    isByeMatch = false,
  ): BracketMatch {
    const winner = isByeMatch ? (team1 ?? team2) : null;
    return {
      id, tournamentId, round, matchIndex, matchPosition: matchIndex, side,
      nextMatchId, prevMatch1Id, prevMatch2Id,
      team1Id: team1?.id ?? null,
      team2Id: team2?.id ?? null,
      winnerId: winner?.id ?? null,
      status: isByeMatch ? "completed" : "pending",
      team1Score: null, team2Score: null,
      roundName: getRoundName(round, totalRounds),
      isBye: isByeMatch ? 1 : 0,
      matchType: "auto" as const,
    };
  }

  // ── LEFT side ─────────────────────────────────────────────────────────────
  // Seedings positions 0 .. halfSize-1
  for (let r = 1; r < totalRounds; r++) {
    const count = halfSize / Math.pow(2, r);
    for (let i = 0; i < count; i++) {
      const nextMatchId = r < totalRounds - 1
        ? idMap.LEFT[r + 1][Math.floor(i / 2)]
        : finalId;
      const prev1 = r > 1 ? idMap.LEFT[r - 1][i * 2] : null;
      const prev2 = r > 1 ? idMap.LEFT[r - 1][i * 2 + 1] : null;

      let team1: Team | null = null;
      let team2: Team | null = null;
      let isByeMatch = false;

      if (r === 1) {
        team1 = getTeamBySeed(seedings[i * 2]);
        team2 = getTeamBySeed(seedings[i * 2 + 1]);
        isByeMatch = !team1 || !team2;
      }

      result.push(makeMatch(idMap.LEFT[r][i], r, i, "LEFT", team1, team2, nextMatchId, prev1, prev2, isByeMatch));
    }
  }

  // ── RIGHT side ────────────────────────────────────────────────────────────
  // Seedings positions halfSize .. bracketSize-1
  for (let r = 1; r < totalRounds; r++) {
    const count = halfSize / Math.pow(2, r);
    for (let i = 0; i < count; i++) {
      const nextMatchId = r < totalRounds - 1
        ? idMap.RIGHT[r + 1][Math.floor(i / 2)]
        : finalId;
      const prev1 = r > 1 ? idMap.RIGHT[r - 1][i * 2] : null;
      const prev2 = r > 1 ? idMap.RIGHT[r - 1][i * 2 + 1] : null;

      let team1: Team | null = null;
      let team2: Team | null = null;
      let isByeMatch = false;

      if (r === 1) {
        team1 = getTeamBySeed(seedings[halfSize + i * 2]);
        team2 = getTeamBySeed(seedings[halfSize + i * 2 + 1]);
        isByeMatch = !team1 || !team2;
      }

      result.push(makeMatch(idMap.RIGHT[r][i], r, i, "RIGHT", team1, team2, nextMatchId, prev1, prev2, isByeMatch));
    }
  }

  // ── FINAL ─────────────────────────────────────────────────────────────────
  // 2-team bracket (totalRounds=1): teams play directly in the FINAL.
  // Larger brackets: FINAL team slots are populated via winner propagation.
  const finalTeam1 = totalRounds === 1 ? (teams[0] ?? null) : null;
  const finalTeam2 = totalRounds === 1 ? (teams[1] ?? null) : null;
  const finalPrev1 = totalRounds > 1 ? idMap.LEFT[totalRounds - 1][0] : null;
  const finalPrev2 = totalRounds > 1 ? idMap.RIGHT[totalRounds - 1][0] : null;
  result.push(makeMatch(finalId, totalRounds, 0, "FINAL", finalTeam1, finalTeam2, null, finalPrev1, finalPrev2, false));

  return { matches: result };
}

// ── Round Robin ───────────────────────────────────────────────────────────────
export function generateRoundRobinBracket(
  tournamentId: string,
  teams: Team[]
): { matches: BracketMatch[] } {
  const out: BracketMatch[] = [];
  let round = 1;

  if (teams.length < 2) return { matches: out };

  const teamCount = teams.length;
  const hasOddTeams = teamCount % 2 === 1;
  const eff = hasOddTeams ? teamCount + 1 : teamCount;

  for (let r = 0; r < eff - 1; r++) {
    for (let i = 0; i < eff / 2; i++) {
      let home = (r + i) % (eff - 1);
      let away = (eff - 1 - i + r) % (eff - 1);
      if (i === 0) away = eff - 1;

      const homeTeam = teams[home];
      const awayTeam = teams[away];

      if (homeTeam && awayTeam) {
        out.push({
          id: randomUUID(), tournamentId,
          team1Id: homeTeam.id, team2Id: awayTeam.id,
          round, matchIndex: null as any, matchPosition: null as any,
          side: null as any, nextMatchId: null,
          status: "pending", winnerId: null,
          team1Score: null, team2Score: null, roundName: null as any, isBye: 0,
        });
      }
    }
    round++;
  }
  return { matches: out };
}

// ── Swiss System ──────────────────────────────────────────────────────────────
export function generateSwissSystemRound(
  tournamentId: string,
  teams: Team[],
  round: number,
  previousMatches: Match[]
): { matches: BracketMatch[] } {
  const out: BracketMatch[] = [];
  if (teams.length < 2) return { matches: out };

  if (round === 1) {
    const shuffled = shuffleArray(teams);
    for (let i = 0; i < shuffled.length; i += 2) {
      if (i + 1 < shuffled.length) {
        out.push({
          id: randomUUID(), tournamentId,
          team1Id: shuffled[i].id, team2Id: shuffled[i + 1].id,
          round, matchIndex: null as any, matchPosition: null as any,
          side: null as any, nextMatchId: null,
          status: "pending", winnerId: null,
          team1Score: null, team2Score: null, roundName: null as any, isBye: 0,
        });
      }
    }
  } else {
    const sorted = [...teams].sort((a, b) => {
      const ap = a.points ?? 0, bp = b.points ?? 0;
      const aw = a.wins ?? 0, bw = b.wins ?? 0;
      const al = a.losses ?? 0, bl = b.losses ?? 0;
      if (bp !== ap) return bp - ap;
      if (bw !== aw) return bw - aw;
      return al - bl;
    });

    const paired = new Set<string>();
    const prevOpponents = new Map<string, Set<string>>();
    for (const m of previousMatches) {
      if (!m.team1Id || !m.team2Id) continue;
      if (!prevOpponents.has(m.team1Id)) prevOpponents.set(m.team1Id, new Set());
      if (!prevOpponents.has(m.team2Id)) prevOpponents.set(m.team2Id, new Set());
      prevOpponents.get(m.team1Id)!.add(m.team2Id);
      prevOpponents.get(m.team2Id)!.add(m.team1Id);
    }

    for (let i = 0; i < sorted.length; i++) {
      const t1 = sorted[i];
      if (paired.has(t1.id)) continue;
      let t2: Team | null = null;
      for (let j = i + 1; j < sorted.length; j++) {
        const c = sorted[j];
        if (paired.has(c.id)) continue;
        const opp = prevOpponents.get(t1.id);
        if (!opp || !opp.has(c.id)) { t2 = c; break; }
      }
      if (t2) {
        out.push({
          id: randomUUID(), tournamentId,
          team1Id: t1.id, team2Id: t2.id,
          round, matchIndex: null as any, matchPosition: null as any,
          side: null as any, nextMatchId: null,
          status: "pending", winnerId: null,
          team1Score: null, team2Score: null, roundName: null as any, isBye: 0,
        });
        paired.add(t1.id);
        paired.add(t2.id);
      }
    }
  }
  return { matches: out };
}
