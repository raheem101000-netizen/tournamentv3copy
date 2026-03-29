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
 * Two-sided single elimination bracket.
 *
 * Rules:
 *   - ALL match slots for ALL rounds are generated upfront, even if empty.
 *   - Every R2+ match has nextMatchId (forward) AND prevMatch1Id/prevMatch2Id (backward).
 *   - R1 matches have nextMatchId set, prevMatch fields null.
 *   - FINAL has prevMatch fields set, nextMatchId null.
 *   - No slots are created later. No fallback logic. No guessing.
 */
export function generateSingleEliminationBracket(
  tournamentId: string,
  teams: Team[]
): BracketGenerationResult {
  const n = teams.length;
  if (n < 2) return { matches: [] };

  const bracketSize = Math.pow(2, Math.ceil(Math.log2(n)));
  const totalRounds = Math.log2(bracketSize);
  const halfSize = bracketSize / 2;

  // Pre-assign all IDs upfront so every slot can reference its neighbors
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
    nextMatchId: string | null,   // forward pointer — where this winner goes
    prevMatch1Id: string | null,  // backward pointer — match whose winner fills team1Id
    prevMatch2Id: string | null,  // backward pointer — match whose winner fills team2Id
  ): BracketMatch {
    const hasBye = (!!team1 && !team2) || (!team1 && !!team2);
    const winner = hasBye ? (team1 ?? team2) : null;
    return {
      id,
      tournamentId,
      round,
      matchIndex,
      matchPosition: matchIndex,
      side,
      nextMatchId,
      prevMatch1Id,
      prevMatch2Id,
      team1Id: team1?.id ?? null,
      team2Id: team2?.id ?? null,
      winnerId: winner?.id ?? null,
      status: winner ? "completed" : "pending",
      team1Score: null,
      team2Score: null,
      roundName: getRoundName(round, totalRounds),
      isBye: hasBye ? 1 : 0,
      matchType: "auto" as const,
    };
  }

  // ── LEFT side ─────────────────────────────────────────────────────────────
  for (let r = 1; r < totalRounds; r++) {
    const count = halfSize / Math.pow(2, r);
    for (let i = 0; i < count; i++) {
      // Teams only assigned in R1; later rounds start empty
      const team1 = r === 1 ? (teams[i * 2] ?? null) : null;
      const team2 = r === 1 ? (teams[i * 2 + 1] ?? null) : null;

      // Forward: last LEFT round feeds FINAL, earlier rounds feed next LEFT round
      const nextMatchId = r < totalRounds - 1
        ? idMap.LEFT[r + 1][Math.floor(i / 2)]
        : finalId;

      // Backward: R1 has no predecessors; R2+ point to their two feeder matches
      const prev1 = r > 1 ? idMap.LEFT[r - 1][i * 2] : null;
      const prev2 = r > 1 ? idMap.LEFT[r - 1][i * 2 + 1] : null;

      result.push(makeMatch(idMap.LEFT[r][i], r, i, "LEFT", team1, team2, nextMatchId, prev1, prev2));
    }
  }

  // ── RIGHT side ────────────────────────────────────────────────────────────
  for (let r = 1; r < totalRounds; r++) {
    const count = halfSize / Math.pow(2, r);
    for (let i = 0; i < count; i++) {
      const team1 = r === 1 ? (teams[halfSize + i * 2] ?? null) : null;
      const team2 = r === 1 ? (teams[halfSize + i * 2 + 1] ?? null) : null;

      const nextMatchId = r < totalRounds - 1
        ? idMap.RIGHT[r + 1][Math.floor(i / 2)]
        : finalId;

      const prev1 = r > 1 ? idMap.RIGHT[r - 1][i * 2] : null;
      const prev2 = r > 1 ? idMap.RIGHT[r - 1][i * 2 + 1] : null;

      result.push(makeMatch(idMap.RIGHT[r][i], r, i, "RIGHT", team1, team2, nextMatchId, prev1, prev2));
    }
  }

  // ── FINAL ─────────────────────────────────────────────────────────────────
  // 2-team bracket (totalRounds=1): teams play directly in the FINAL.
  // N-team bracket: LEFT last-round winner → team1Id, RIGHT last-round winner → team2Id.
  const finalTeam1 = totalRounds === 1 ? (teams[0] ?? null) : null;
  const finalTeam2 = totalRounds === 1 ? (teams[1] ?? null) : null;
  const finalPrev1 = totalRounds > 1 ? idMap.LEFT[totalRounds - 1][0] : null;
  const finalPrev2 = totalRounds > 1 ? idMap.RIGHT[totalRounds - 1][0] : null;
  result.push(makeMatch(finalId, totalRounds, 0, "FINAL", finalTeam1, finalTeam2, null, finalPrev1, finalPrev2));

  // ── Propagate BYEs into parent slots at generation time ───────────────────
  // Any R1 match with one team and no opponent is a BYE — pre-fill the parent slot.
  const parentOf = new Map<string, BracketMatch>();
  for (const m of result) {
    if (m.prevMatch1Id) parentOf.set(m.prevMatch1Id, m);
    if (m.prevMatch2Id) parentOf.set(m.prevMatch2Id, m);
  }
  for (const m of result) {
    if (m.isBye && m.winnerId) {
      const parent = parentOf.get(m.id);
      if (!parent) continue;
      if (parent.prevMatch1Id === m.id) {
        parent.team1Id = m.winnerId;
      } else {
        parent.team2Id = m.winnerId;
      }
    }
  }

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
      } else if (homeTeam && !awayTeam) {
        out.push({
          id: randomUUID(), tournamentId,
          team1Id: homeTeam.id, team2Id: null,
          round, matchIndex: null as any, matchPosition: null as any,
          side: null as any, nextMatchId: null,
          status: "completed", winnerId: homeTeam.id,
          team1Score: null, team2Score: null, roundName: null as any, isBye: 1,
        });
      } else if (!homeTeam && awayTeam) {
        out.push({
          id: randomUUID(), tournamentId,
          team1Id: awayTeam.id, team2Id: null,
          round, matchIndex: null as any, matchPosition: null as any,
          side: null as any, nextMatchId: null,
          status: "completed", winnerId: awayTeam.id,
          team1Score: null, team2Score: null, roundName: null as any, isBye: 1,
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
      } else {
        out.push({
          id: randomUUID(), tournamentId,
          team1Id: shuffled[i].id, team2Id: null,
          round, matchIndex: null as any, matchPosition: null as any,
          side: null as any, nextMatchId: null,
          status: "completed", winnerId: shuffled[i].id,
          team1Score: null, team2Score: null, roundName: null as any, isBye: 1,
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
      } else {
        out.push({
          id: randomUUID(), tournamentId,
          team1Id: t1.id, team2Id: null,
          round, matchIndex: null as any, matchPosition: null as any,
          side: null as any, nextMatchId: null,
          status: "completed", winnerId: t1.id,
          team1Score: null, team2Score: null, roundName: null as any, isBye: 1,
        });
        paired.add(t1.id);
      }
    }
  }
  return { matches: out };
}
