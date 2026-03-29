import { useRef, useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Trophy, Clock, CheckCircle2 } from "lucide-react";
import MatchCard from "./MatchCard";
import type { Match, Team } from "@shared/schema";

/** Scales a bracket container to fit its parent width without scrolling. */
function useFitScale(deps: any[]) {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [scaledHeight, setScaledHeight] = useState<number | undefined>(undefined);

  useEffect(() => {
    function compute() {
      const outer = outerRef.current;
      const inner = innerRef.current;
      if (!outer || !inner) return;
      // Temporarily remove transform to measure natural dimensions
      inner.style.transform = "none";
      const nw = inner.scrollWidth;
      const nh = inner.scrollHeight;
      inner.style.transform = "";
      const aw = outer.clientWidth;
      const s = nw > aw && aw > 0 ? aw / nw : 1;
      setScale(s);
      setScaledHeight(nh * s);
    }
    compute();
    const ro = new ResizeObserver(compute);
    if (outerRef.current) ro.observe(outerRef.current);
    return () => ro.disconnect();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { outerRef, innerRef, scale, scaledHeight };
}

// ── Types ────────────────────────────────────────────────────────────────────

interface TeamMember {
  userId: string;
  username: string;
  displayName?: string;
  avatarUrl?: string | null;
}

interface TeamWithMembers extends Team {
  members?: TeamMember[];
  teamLogoUrl?: string | null;
}

interface BracketViewProps {
  matches: Match[];
  teams: TeamWithMembers[];
  format: "single_elimination" | "round_robin" | "swiss";
  onMatchClick?: (matchId: string) => void;
}

// ── Scale ─────────────────────────────────────────────────────────────────────

interface BracketScale {
  slotH: number;
  colW: number;
  stubW: number;
  cardHalfH: number;
  avatarCls: string;
  nameCls: string;
  userCls: string;
  fallbackCls: string;
  truncate: boolean;
  cardPad: string;
}

function getBracketScale(totalMatches: number): BracketScale {
  if (totalMatches <= 4) {
    // 2–4 team bracket: large, fully readable
    return { slotH: 110, colW: 280, stubW: 14, cardHalfH: 46,
      avatarCls: "w-9 h-9", nameCls: "text-xs", userCls: "text-[11px]",
      fallbackCls: "text-[10px]", truncate: false, cardPad: "px-4 py-2" };
  }
  if (totalMatches <= 10) {
    // ~8-team bracket (7 matches): medium-large
    return { slotH: 100, colW: 250, stubW: 12, cardHalfH: 42,
      avatarCls: "w-8 h-8", nameCls: "text-[11px]", userCls: "text-[10px]",
      fallbackCls: "text-[9px]", truncate: false, cardPad: "px-3 py-1.5" };
  }
  if (totalMatches <= 20) {
    // ~16-team bracket (15 matches): medium
    return { slotH: 90, colW: 210, stubW: 10, cardHalfH: 38,
      avatarCls: "w-7 h-7", nameCls: "text-[10px]", userCls: "text-[9px]",
      fallbackCls: "text-[8px]", truncate: true, cardPad: "px-3 py-1.5" };
  }
  // 32+ matches: compact
  return { slotH: 80, colW: 180, stubW: 10, cardHalfH: 34,
    avatarCls: "w-6 h-6", nameCls: "text-[9px]", userCls: "text-[8px]",
    fallbackCls: "text-[7px]", truncate: true, cardPad: "px-2.5 py-1" };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getTeamName(team?: TeamWithMembers, teamId?: string | null): string {
  if (!teamId) return "TBD";
  return team?.name ?? "TBD";
}

function getUsername(team?: TeamWithMembers): string | null {
  return team?.members?.[0]?.username ?? null;
}

function getTeamLogo(team?: TeamWithMembers): string | null {
  return team?.teamLogoUrl ?? team?.members?.[0]?.avatarUrl ?? null;
}

function getTeamInitials(team?: TeamWithMembers, teamId?: string | null): string {
  if (!teamId || !team) return "?";
  return team.name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
}

// ── Match Box ────────────────────────────────────────────────────────────────

function MatchBox({
  match,
  team1,
  team2,
  onClick,
  scale,
}: {
  match: Match;
  team1?: TeamWithMembers;
  team2?: TeamWithMembers;
  onClick?: () => void;
  scale: BracketScale;
}) {
  const isCompleted = match.status === "completed";
  const isWinner = (id?: string | null) => !!match.winnerId && match.winnerId === id;

  const isTbd = !match.team1Id && !match.team2Id;
  if (isTbd) {
    return (
      <div className="select-none rounded-md border border-dashed border-border/30 bg-muted/10 px-2 py-1.5 text-[10px] text-muted-foreground/40 text-center">
        TBD
      </div>
    );
  }

  function PlayerSlot({ team, teamId, score }: { team?: TeamWithMembers; teamId?: string | null; score?: number | null }) {
    const won = isWinner(teamId);
    const logo = getTeamLogo(team);
    const username = getUsername(team);
    if (!teamId) {
      return (
        <div className="flex items-center gap-1.5 py-0.5 text-[10px] text-muted-foreground/50">
          <div className="w-5 h-5 rounded-full bg-muted/30 shrink-0" />
          <span>TBD</span>
        </div>
      );
    }
    return (
      <div className={`flex items-center gap-1.5 py-0.5 ${won ? "text-primary" : ""}`}>
        {won && <Trophy className="w-2.5 h-2.5 text-amber-500 shrink-0" />}
        <Avatar className={`${scale.avatarCls} shrink-0`}>
          {logo && <AvatarImage src={logo} alt={team?.name} />}
          <AvatarFallback className={`${scale.fallbackCls} bg-primary/10`}>{getTeamInitials(team, teamId)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className={`${scale.truncate ? "truncate" : ""} ${scale.nameCls} leading-tight ${won ? "font-bold" : "font-medium"}`}>
            {getTeamName(team, teamId)}
            {isCompleted && score !== null && score !== undefined && (
              <span className="ml-1 font-mono font-bold tabular-nums">{score}</span>
            )}
          </div>
          {username && (
            <div className={`${scale.truncate ? "truncate" : ""} ${scale.userCls} text-muted-foreground leading-tight`}>@{username}</div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      className={`cursor-pointer select-none rounded-md border ${scale.cardPad} text-xs transition-colors hover:bg-accent/50 ${
        isCompleted ? "border-border bg-card" : "border-border/70 bg-card/80"
      }`}
    >
      <div className="flex items-center gap-1">
        <div className="flex-1 min-w-0">
          <PlayerSlot team={team1} teamId={match.team1Id} score={match.team1Score} />
        </div>
        <span className="text-[9px] text-muted-foreground/60 shrink-0 px-0.5">vs</span>
        <div className="flex-1 min-w-0">
          <PlayerSlot team={team2} teamId={match.team2Id} score={match.team2Score} />
        </div>
      </div>
      {/* Status */}
      <div className="mt-1 flex items-center gap-0.5">
        {isCompleted ? (
          <CheckCircle2 className="w-2.5 h-2.5 text-emerald-500" />
        ) : match.status === "in_progress" ? (
          <Clock className="w-2.5 h-2.5 text-blue-500 animate-pulse" />
        ) : (
          <Clock className="w-2.5 h-2.5 text-muted-foreground/40" />
        )}
        <span className="text-[9px] text-muted-foreground capitalize">
          {match.status.replace("_", " ")}
        </span>
      </div>
    </div>
  );
}

// ── Single Elimination: Two-Sided Bracket ────────────────────────────────────

/**
 * Renders one column of matches.
 *
 * @param roundMatches   - matches for this round+side, ordered by matchIndex
 * @param r1MatchCount   - number of matches in round 1 of this side (for slot sizing)
 * @param round          - actual round number
 * @param connectorSide  - where to draw tree connectors ("right" for LEFT side, "left" for RIGHT side)
 * @param isAdjacentToFinal - whether the next/prev column is the FINAL
 */
function RoundColumn({
  roundMatches,
  r1MatchCount,
  round,
  connectorSide,
  showConnector,
  getTeam,
  onMatchClick,
  scale,
}: {
  roundMatches: Match[];
  r1MatchCount: number;
  round: number;
  connectorSide: "right" | "left";
  showConnector: boolean;
  getTeam: (id: string | null | undefined) => TeamWithMembers | undefined;
  onMatchClick?: (id: string) => void;
  scale: BracketScale;
}) {
  // Slot height doubles each round: R1=slotH, R2=2*slotH, R3=4*slotH…
  const slotH = scale.slotH * Math.pow(2, round - 1);
  const matchCount = r1MatchCount / Math.pow(2, round - 1);
  const totalH = r1MatchCount * scale.slotH;
  // Only draw vertical bar connector when there are multiple matches to pair up
  const showVerticalBar = matchCount > 1;

  return (
    <div
      className="relative shrink-0 flex flex-col"
      style={{ width: scale.colW + (showConnector ? scale.stubW : 0), height: totalH }}
    >
      {Array.from({ length: matchCount }, (_, i) => {
        const match = roundMatches[i];
        const slotTop = i * slotH;
        // Center the card vertically within its slot
        const cardTop = slotTop + slotH / 2 - scale.cardHalfH;
        const isUpperOfPair = i % 2 === 0;
        const edgeProp = connectorSide === "right" ? "right" : "left";

        return (
          <div key={i} className="absolute" style={{ top: cardTop, left: connectorSide === "right" ? 0 : scale.stubW, width: scale.colW }}>
            {match ? (
              <MatchBox
                match={match}
                team1={getTeam(match.team1Id)}
                team2={getTeam(match.team2Id)}
                onClick={
                  onMatchClick && match.team1Id && match.team2Id
                    ? () => onMatchClick(match.id)
                    : undefined
                }
                scale={scale}
              />
            ) : (
              <div className="rounded-lg border border-dashed border-border/20 bg-muted/10 px-3 py-2 text-xs text-muted-foreground/30 text-center">
                TBD
              </div>
            )}

            {/* Tree connector lines */}
            {showConnector && (
              <>
                {/* Horizontal stub */}
                <div
                  className="absolute bg-border/60"
                  style={{
                    top: "50%",
                    [edgeProp]: -scale.stubW,
                    width: scale.stubW,
                    height: 1,
                    transform: "translateY(-0.5px)",
                  }}
                />
                {/* Vertical bar connecting pair — only when 2+ matches exist */}
                {showVerticalBar && (
                  isUpperOfPair ? (
                    <div
                      className="absolute bg-border/60"
                      style={{
                        top: "50%",
                        [edgeProp]: -scale.stubW,
                        width: 1,
                        height: slotH,
                      }}
                    />
                  ) : (
                    <div
                      className="absolute bg-border/60"
                      style={{
                        bottom: "50%",
                        [edgeProp]: -scale.stubW,
                        width: 1,
                        height: slotH,
                      }}
                    />
                  )
                )}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Final column — centered vertically, connectors on both sides */
function FinalColumn({
  match,
  totalH,
  getTeam,
  onMatchClick,
  scale,
}: {
  match: Match | undefined;
  totalH: number;
  getTeam: (id: string | null | undefined) => TeamWithMembers | undefined;
  onMatchClick?: (id: string) => void;
  scale: BracketScale;
}) {
  const cardTop = totalH / 2 - scale.cardHalfH;
  return (
    <div className="relative shrink-0" style={{ width: scale.colW + scale.stubW * 2, height: totalH }}>
      {/* Left stub (from LEFT side) */}
      <div
        className="absolute bg-border/60"
        style={{ top: totalH / 2 - 0.5, left: 0, width: scale.stubW, height: 1 }}
      />
      {/* Right stub (from RIGHT side) */}
      <div
        className="absolute bg-border/60"
        style={{ top: totalH / 2 - 0.5, right: 0, width: scale.stubW, height: 1 }}
      />
      <div className="absolute" style={{ top: cardTop, left: scale.stubW, width: scale.colW }}>
        {match ? (
          <MatchBox
            match={match}
            team1={getTeam(match.team1Id)}
            team2={getTeam(match.team2Id)}
            onClick={
              onMatchClick && match.team1Id && match.team2Id
                ? () => onMatchClick(match.id)
                : undefined
            }
            scale={scale}
          />
        ) : (
          <div className="rounded-lg border border-dashed border-border/20 bg-muted/10 px-3 py-2 text-xs text-muted-foreground/30 text-center">
            Final
          </div>
        )}
      </div>
    </div>
  );
}

function SingleEliminationBracket({
  matches,
  teams,
  onMatchClick,
}: {
  matches: Match[];
  teams: TeamWithMembers[];
  onMatchClick?: (id: string) => void;
}) {
  const scale = getBracketScale(matches.length);
  const { outerRef, innerRef, scale: fitScale, scaledHeight } = useFitScale([matches.length]);

  if (matches.length === 0) return null;

  const getTeam = (id: string | null | undefined) =>
    teams.find((t) => t.id === id) as TeamWithMembers | undefined;

  // Determine if this is a "new" bracket with side information
  const hasSides = matches.some((m) => m.side);

  if (!hasSides) {
    // Legacy bracket: render old single-column layout
    return (
      <div ref={outerRef} className="w-full overflow-hidden" style={{ height: scaledHeight }}>
        <div ref={innerRef} className="w-fit" style={{ transform: fitScale < 1 ? `scale(${fitScale})` : undefined, transformOrigin: "top left" }}>
          <LegacyBracket matches={matches} teams={teams} onMatchClick={onMatchClick} scale={scale} />
        </div>
      </div>
    );
  }

  const finalMatch = matches.find((m) => m.side === "FINAL");

  const totalRounds = Math.max(...matches.map((m) => m.round));

  const byMatchIndex = (a: Match, b: Match) =>
    (a.matchIndex ?? a.matchPosition ?? 0) - (b.matchIndex ?? b.matchPosition ?? 0);
  const hasTeam = (m: Match) => !!(m.team1Id || m.team2Id);

  // ── Even distribution for R1 ─────────────────────────────────────────────
  // Sort: LEFT matches first (by matchIndex), then RIGHT matches (by matchIndex).
  // Split at ceil(total/2): visual LEFT gets ceil, visual RIGHT gets floor.
  const r1LeftMatches  = matches.filter((m) => m.side === "LEFT"  && m.round === 1 && hasTeam(m)).sort(byMatchIndex);
  const r1RightMatches = matches.filter((m) => m.side === "RIGHT" && m.round === 1 && hasTeam(m)).sort(byMatchIndex);
  const r1All = [...r1LeftMatches, ...r1RightMatches];
  const r1SplitAt = Math.ceil(r1All.length / 2);
  const r1VisualLeft  = r1All.slice(0, r1SplitAt);
  const r1VisualRight = r1All.slice(r1SplitAt);

  // r1MatchCount must be power-of-2 so RoundColumn slot sizes stay correct.
  function nextPow2(n: number): number {
    if (n <= 0) return 1;
    return Math.pow(2, Math.ceil(Math.log2(n)));
  }
  const r1MatchCountLeft  = nextPow2(r1VisualLeft.length);
  const r1MatchCountRight = nextPow2(r1VisualRight.length);

  // ── Ancestry tracking for R2+ ────────────────────────────────────────────
  // Build visual-side map from R1 assignments, then propagate to later rounds
  // by tracing each match backwards to its first R1 ancestor.
  const visualSideMap = new Map<string, "LEFT" | "RIGHT">();
  r1VisualLeft.forEach((m)  => visualSideMap.set(m.id, "LEFT"));
  r1VisualRight.forEach((m) => visualSideMap.set(m.id, "RIGHT"));

  // Reverse adjacency: nextMatchId → [feeder matches]
  const feedersMap = new Map<string, Match[]>();
  for (const m of matches) {
    if (m.nextMatchId) {
      const arr = feedersMap.get(m.nextMatchId) ?? [];
      arr.push(m);
      feedersMap.set(m.nextMatchId, arr);
    }
  }

  for (const m of matches) {
    if (m.round <= 1 || m.side === "FINAL" || !hasTeam(m)) continue;
    const queue = [m.id];
    const visited = new Set<string>();
    let found = false;
    while (queue.length > 0 && !found) {
      const id = queue.shift()!;
      if (visited.has(id)) continue;
      visited.add(id);
      for (const feeder of (feedersMap.get(id) ?? [])) {
        if (feeder.round === 1) {
          const vs = visualSideMap.get(feeder.id);
          if (vs) { visualSideMap.set(m.id, vs); found = true; break; }
        } else {
          queue.push(feeder.id);
        }
      }
    }
  }

  // 2-team bracket: no preliminary rounds, just the FINAL
  const isFinalOnly = r1All.length === 0;
  const totalH = isFinalOnly ? scale.slotH * 2 : r1MatchCountLeft * scale.slotH;

  // LEFT rounds: [1, 2, ..., totalRounds-1]
  const leftRounds = Array.from({ length: totalRounds - 1 }, (_, i) => i + 1);
  // RIGHT rounds displayed in REVERSED order near center: [totalRounds-1, ..., 1]
  const rightRoundsDisplay = leftRounds.slice().reverse();

  // Round name for column header
  function roundLabel(round: number): string {
    const distance = totalRounds - round;
    const names = ["Final", "Semi-finals", "Quarter-finals", "Round of 16", "Round of 32", "Round of 64"];
    return distance < names.length ? names[distance] : `Round ${round}`;
  }

  function roundMatchesForVisual(side: "LEFT" | "RIGHT", round: number): Match[] {
    if (round === 1) {
      return side === "LEFT" ? r1VisualLeft : r1VisualRight;
    }
    return matches
      .filter((m) => m.round === round && hasTeam(m) && visualSideMap.get(m.id) === side)
      .sort(byMatchIndex);
  }

  // 2-team bracket: just show the FINAL
  if (isFinalOnly) {
    return (
      <div ref={outerRef} className="w-full overflow-hidden" style={{ height: scaledHeight }}>
        <div ref={innerRef} className="w-fit mx-auto py-4" style={{ transform: fitScale < 1 ? `scale(${fitScale})` : undefined, transformOrigin: "top left" }}>
        <div style={{ width: scale.colW }}>
          <p className="text-xs font-semibold text-amber-500 text-center mb-2">Grand Final</p>
          {finalMatch ? (
            <MatchBox
              match={finalMatch}
              team1={getTeam(finalMatch.team1Id)}
              team2={getTeam(finalMatch.team2Id)}
              onClick={onMatchClick && finalMatch.team1Id && finalMatch.team2Id ? () => onMatchClick(finalMatch.id) : undefined}
              scale={scale}
            />
          ) : (
            <div className="rounded-lg border border-dashed border-border/30 bg-muted/10 px-3 py-2 text-xs text-muted-foreground/40 text-center">TBD</div>
          )}
        </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={outerRef} className="w-full overflow-hidden pb-2" style={{ height: scaledHeight }}>
      <div
        ref={innerRef}
        className="w-fit mx-auto"
        style={{ transform: fitScale < 1 ? `scale(${fitScale})` : undefined, transformOrigin: "top left" }}
      >
      {/* Round name headers */}
      <div className="flex mb-1 min-w-max">
        {leftRounds.map((r) => (
          <div key={`lh-${r}`} style={{ width: scale.colW + scale.stubW }} className="px-2 pb-1">
            <p className="text-xs font-semibold text-muted-foreground truncate">{roundLabel(r)}</p>
          </div>
        ))}
        <div style={{ width: scale.colW + scale.stubW * 2 }} className="px-2 pb-1 text-center">
          <p className="text-xs font-semibold text-amber-500">Grand Final</p>
        </div>
        {rightRoundsDisplay.map((r) => (
          <div key={`rh-${r}`} style={{ width: scale.colW + scale.stubW }} className="px-2 pb-1 text-right">
            <p className="text-xs font-semibold text-muted-foreground truncate">{roundLabel(r)}</p>
          </div>
        ))}
      </div>

      {/* Bracket body */}
      <div className="flex min-w-max items-start">
        {/* LEFT side columns: R1 → R(n-1), progressing right toward center */}
        {leftRounds.map((r) => (
          <RoundColumn
            key={`left-${r}`}
            roundMatches={roundMatchesForVisual("LEFT", r)}
            r1MatchCount={r1MatchCountLeft}
            round={r}
            connectorSide="right"
            showConnector={true}
            getTeam={getTeam}
            onMatchClick={onMatchClick}
            scale={scale}
          />
        ))}

        {/* FINAL */}
        <FinalColumn
          match={finalMatch}
          totalH={totalH}
          getTeam={getTeam}
          onMatchClick={onMatchClick}
          scale={scale}
        />

        {/* RIGHT side columns: R(n-1) → R1, progressing left toward center (mirrored) */}
        {rightRoundsDisplay.map((r) => (
          <RoundColumn
            key={`right-${r}`}
            roundMatches={roundMatchesForVisual("RIGHT", r)}
            r1MatchCount={r1MatchCountRight}
            round={r}
            connectorSide="left"
            showConnector={true}
            getTeam={getTeam}
            onMatchClick={onMatchClick}
            scale={scale}
          />
        ))}
      </div>
      </div>
    </div>
  );
}

/** Legacy bracket (no side info) — original single-column layout */
function LegacyBracket({
  matches,
  teams,
  onMatchClick,
  scale,
}: {
  matches: Match[];
  teams: TeamWithMembers[];
  onMatchClick?: (id: string) => void;
  scale: BracketScale;
}) {
  const getTeam = (id: string | null | undefined) =>
    teams.find((t) => t.id === id) as TeamWithMembers | undefined;

  const totalRounds = Math.max(...matches.map((m) => m.round));

  return (
    <div className="w-full overflow-x-auto pb-6">
      <div className="flex gap-0 p-4 min-w-max items-start">
        {Array.from({ length: totalRounds }, (_, i) => i + 1).map((round) => {
          const roundMatches = matches.filter((m) => m.round === round);
          const isLastRound = round === totalRounds;
          const r1Count = matches.filter((m) => m.round === 1).length;
          const slotsInRound = Math.ceil(r1Count / Math.pow(2, round - 1));
          const slotHeightPx = scale.slotH;

          return (
            <div key={round} className="flex flex-col shrink-0" style={{ width: scale.colW + 60 }}>
              <div className="px-3 pb-3 pt-1 border-b mb-0">
                <h3 className="font-semibold text-sm">Round {round}</h3>
                <p className="text-xs text-muted-foreground">
                  {roundMatches.length} matches
                </p>
              </div>
              <div className="relative flex flex-col" style={{ paddingTop: 8 }}>
                {Array.from({ length: slotsInRound }, (_, slotIdx) => {
                  const match = roundMatches[slotIdx];
                  const showConnector = !isLastRound;
                  const isUpperOfPair = slotIdx % 2 === 0;
                  return (
                    <div
                      key={slotIdx}
                      className="relative"
                      style={{ height: slotHeightPx, display: "flex", alignItems: "center", paddingRight: showConnector ? 20 : 0, paddingLeft: round > 1 ? 16 : 0 }}
                    >
                      {round > 1 && (
                        <div className="absolute left-0 top-1/2 bg-border" style={{ width: 16, height: 1 }} />
                      )}
                      <div className="flex-1">
                        {match ? (
                          <MatchBox
                            match={match}
                            team1={getTeam(match.team1Id)}
                            team2={getTeam(match.team2Id)}
                            onClick={onMatchClick && match.team1Id && match.team2Id ? () => onMatchClick(match.id) : undefined}
                            scale={scale}
                          />
                        ) : (
                          <div className="rounded-lg border border-dashed border-border/30 bg-muted/10 px-3 py-2 text-xs text-muted-foreground/40 text-center">
                            TBD
                          </div>
                        )}
                      </div>
                      {showConnector && (
                        <>
                          <div className="absolute right-0 top-1/2 bg-border" style={{ width: 16, height: 1 }} />
                          {isUpperOfPair ? (
                            <div className="absolute bg-border" style={{ right: 0, top: "50%", width: 1, height: slotHeightPx }} />
                          ) : (
                            <div className="absolute bg-border" style={{ right: 0, bottom: "50%", width: 1, height: slotHeightPx }} />
                          )}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main Export ───────────────────────────────────────────────────────────────

export default function BracketView({ matches, teams, format, onMatchClick }: BracketViewProps) {
  const getTeamById = (id: string | null | undefined) =>
    teams.find((t) => t.id === id) as TeamWithMembers | undefined;

  // ── Round Robin / Swiss: column-per-round layout ──────────────────────────
  if (format === "round_robin" || format === "swiss") {
    if (matches.length === 0) return null;
    const rounds = Math.max(...matches.map((m) => m.round));

    return (
      <div className="space-y-6">
        {Array.from({ length: rounds }, (_, i) => i + 1).map((round) => {
          const roundMatches = matches.filter((m) => m.round === round);
          return (
            <Card key={round}>
              <CardHeader>
                <CardTitle className="font-display flex items-center justify-between">
                  <span>Round {round}</span>
                  <Badge variant="outline">{roundMatches.length} matches</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {roundMatches.map((match) => (
                    <div key={match.id} onClick={() => onMatchClick?.(match.id)} className="cursor-pointer">
                      <MatchCard
                        match={match}
                        team1={getTeamById(match.team1Id)}
                        team2={getTeamById(match.team2Id)}
                      />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  }

  // ── Single Elimination ────────────────────────────────────────────────────
  if (matches.length === 0) return null;
  return (
    <SingleEliminationBracket
      matches={matches}
      teams={teams}
      onMatchClick={onMatchClick}
    />
  );
}
