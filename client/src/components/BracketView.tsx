import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, Clock, CheckCircle2, MessageSquare } from "lucide-react";
import MatchCard from "./MatchCard";
import type { Match, Team } from "@shared/schema";

// ── Types ────────────────────────────────────────────────────────────────────

interface TeamMember {
  userId: string;
  username: string;
  displayName?: string;
  avatarUrl?: string | null;
}

interface TeamWithMembers extends Team {
  members?: TeamMember[];
}

interface BracketViewProps {
  matches: Match[];
  teams: TeamWithMembers[];
  format: "single_elimination" | "round_robin" | "swiss";
  onMatchClick?: (matchId: string) => void;
}

// ── Constants ────────────────────────────────────────────────────────────────

/** Height (px) of one R1 slot — card ~60px + 12px gap */
const SLOT_H = 72;
/** Fixed width of each round column */
const COL_W = 140;
/** Width of connector stub */
const STUB_W = 10;

// ── Helpers ──────────────────────────────────────────────────────────────────

function getDisplayName(team?: TeamWithMembers, teamId?: string | null): string {
  if (!teamId) return "TBD";
  if (team?.members && team.members.length > 0) return `@${team.members[0].username}`;
  return team?.name ?? "TBD";
}

// ── Match Box ────────────────────────────────────────────────────────────────

function MatchBox({
  match,
  team1,
  team2,
  onClick,
}: {
  match: Match;
  team1?: TeamWithMembers;
  team2?: TeamWithMembers;
  onClick?: () => void;
}) {
  const isCompleted = match.status === "completed";
  const isWinner = (id?: string | null) => !!match.winnerId && match.winnerId === id;

  if (match.isBye) {
    return (
      <div className="select-none rounded-md border border-dashed border-border/50 bg-muted/30 px-2 py-1.5 text-xs text-muted-foreground">
        <span className="font-medium">{getDisplayName(team1, match.team1Id)}</span>
        <span className="ml-1.5 text-[10px] opacity-60">BYE</span>
      </div>
    );
  }

  const isTbd = !match.team1Id && !match.team2Id;
  if (isTbd) {
    return (
      <div className="select-none rounded-md border border-dashed border-border/30 bg-muted/10 px-2 py-1.5 text-[10px] text-muted-foreground/40 text-center">
        TBD
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      className={`cursor-pointer select-none rounded-md border px-2 py-1.5 text-xs transition-colors hover:bg-accent/50 ${
        isCompleted ? "border-border bg-card" : "border-border/70 bg-card/80"
      }`}
    >
      {/* Players on one line: Team1  vs  Team2 */}
      <div className="flex items-center gap-1 py-px">
        <div className={`flex items-center gap-0.5 min-w-0 flex-1 ${isWinner(match.team1Id) ? "font-bold text-primary" : ""}`}>
          {isWinner(match.team1Id) && <Trophy className="w-2.5 h-2.5 text-amber-500 shrink-0" />}
          {isCompleted && match.team1Score !== null && (
            <span className="font-mono font-bold tabular-nums shrink-0">{match.team1Score}</span>
          )}
          <span className="truncate">{getDisplayName(team1, match.team1Id)}</span>
        </div>
        <span className="text-[9px] text-muted-foreground/60 shrink-0 px-0.5">vs</span>
        <div className={`flex items-center gap-0.5 min-w-0 flex-1 justify-end ${isWinner(match.team2Id) ? "font-bold text-primary" : ""}`}>
          <span className="truncate text-right">{getDisplayName(team2, match.team2Id)}</span>
          {isCompleted && match.team2Score !== null && (
            <span className="font-mono font-bold tabular-nums shrink-0">{match.team2Score}</span>
          )}
          {isWinner(match.team2Id) && <Trophy className="w-2.5 h-2.5 text-amber-500 shrink-0" />}
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
        {onClick && match.team1Id && match.team2Id && (
          <MessageSquare className="w-2.5 h-2.5 text-muted-foreground/50 ml-auto" />
        )}
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
}: {
  roundMatches: Match[];
  r1MatchCount: number;
  round: number;
  connectorSide: "right" | "left";
  showConnector: boolean;
  getTeam: (id: string | null | undefined) => TeamWithMembers | undefined;
  onMatchClick?: (id: string) => void;
}) {
  // Slot height doubles each round: R1=SLOT_H, R2=2*SLOT_H, R3=4*SLOT_H…
  const slotH = SLOT_H * Math.pow(2, round - 1);
  const matchCount = r1MatchCount / Math.pow(2, round - 1);
  const totalH = r1MatchCount * SLOT_H;
  // Only draw vertical bar connector when there are multiple matches to pair up
  const showVerticalBar = matchCount > 1;

  return (
    <div
      className="relative shrink-0 flex flex-col"
      style={{ width: COL_W + (showConnector ? STUB_W : 0), height: totalH }}
    >
      {Array.from({ length: matchCount }, (_, i) => {
        const match = roundMatches[i];
        const slotTop = i * slotH;
        // Center the card vertically within its slot
        const cardTop = slotTop + slotH / 2 - 30; // 30 = approx half card height
        const isUpperOfPair = i % 2 === 0;
        const edgeProp = connectorSide === "right" ? "right" : "left";

        return (
          <div key={i} className="absolute" style={{ top: cardTop, left: connectorSide === "right" ? 0 : STUB_W, width: COL_W }}>
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
                    [edgeProp]: -STUB_W,
                    width: STUB_W,
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
                        [edgeProp]: -STUB_W,
                        width: 1,
                        height: slotH,
                      }}
                    />
                  ) : (
                    <div
                      className="absolute bg-border/60"
                      style={{
                        bottom: "50%",
                        [edgeProp]: -STUB_W,
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
}: {
  match: Match | undefined;
  totalH: number;
  getTeam: (id: string | null | undefined) => TeamWithMembers | undefined;
  onMatchClick?: (id: string) => void;
}) {
  const cardTop = totalH / 2 - 30;
  return (
    <div className="relative shrink-0" style={{ width: COL_W + STUB_W * 2, height: totalH }}>
      {/* Left stub (from LEFT side) */}
      <div
        className="absolute bg-border/60"
        style={{ top: totalH / 2 - 0.5, left: 0, width: STUB_W, height: 1 }}
      />
      {/* Right stub (from RIGHT side) */}
      <div
        className="absolute bg-border/60"
        style={{ top: totalH / 2 - 0.5, right: 0, width: STUB_W, height: 1 }}
      />
      <div className="absolute" style={{ top: cardTop, left: STUB_W, width: COL_W }}>
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
  if (matches.length === 0) return null;

  const getTeam = (id: string | null | undefined) =>
    teams.find((t) => t.id === id) as TeamWithMembers | undefined;

  // Determine if this is a "new" bracket with side information
  const hasSides = matches.some((m) => m.side);

  if (!hasSides) {
    // Legacy bracket: render old single-column layout
    return <LegacyBracket matches={matches} teams={teams} onMatchClick={onMatchClick} />;
  }

  const finalMatch = matches.find((m) => m.side === "FINAL");

  const totalRounds = Math.max(...matches.map((m) => m.round));
  // Number of R1 matches per side
  const r1LeftCount = matches.filter((m) => m.side === "LEFT" && m.round === 1).length;
  // 2-team bracket: no preliminary rounds, just the FINAL
  const isFinalOnly = r1LeftCount === 0;
  const totalH = isFinalOnly ? SLOT_H * 2 : r1LeftCount * SLOT_H;

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

  function sortedRoundMatches(side: "LEFT" | "RIGHT", round: number): Match[] {
    return matches
      .filter((m) => m.side === side && m.round === round)
      .sort((a, b) => (a.matchIndex ?? a.matchPosition ?? 0) - (b.matchIndex ?? b.matchPosition ?? 0));
  }

  // 2-team bracket: just show the FINAL
  if (isFinalOnly) {
    return (
      <div className="w-full flex justify-center py-4">
        <div style={{ width: COL_W }}>
          <p className="text-xs font-semibold text-amber-500 text-center mb-2">Grand Final</p>
          {finalMatch ? (
            <MatchBox
              match={finalMatch}
              team1={getTeam(finalMatch.team1Id)}
              team2={getTeam(finalMatch.team2Id)}
              onClick={onMatchClick && finalMatch.team1Id && finalMatch.team2Id ? () => onMatchClick(finalMatch.id) : undefined}
            />
          ) : (
            <div className="rounded-lg border border-dashed border-border/30 bg-muted/10 px-3 py-2 text-xs text-muted-foreground/40 text-center">TBD</div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full overflow-x-auto pb-6">
      {/* Round name headers */}
      <div className="flex mb-1 min-w-max">
        {leftRounds.map((r) => (
          <div key={`lh-${r}`} style={{ width: COL_W + STUB_W }} className="px-2 pb-1">
            <p className="text-xs font-semibold text-muted-foreground truncate">{roundLabel(r)}</p>
          </div>
        ))}
        <div style={{ width: COL_W + STUB_W * 2 }} className="px-2 pb-1 text-center">
          <p className="text-xs font-semibold text-amber-500">Grand Final</p>
        </div>
        {rightRoundsDisplay.map((r) => (
          <div key={`rh-${r}`} style={{ width: COL_W + STUB_W }} className="px-2 pb-1 text-right">
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
            roundMatches={sortedRoundMatches("LEFT", r)}
            r1MatchCount={r1LeftCount}
            round={r}
            connectorSide="right"
            showConnector={true}
            getTeam={getTeam}
            onMatchClick={onMatchClick}
          />
        ))}

        {/* FINAL */}
        <FinalColumn
          match={finalMatch}
          totalH={totalH}
          getTeam={getTeam}
          onMatchClick={onMatchClick}
        />

        {/* RIGHT side columns: R(n-1) → R1, progressing left toward center (mirrored) */}
        {rightRoundsDisplay.map((r) => (
          <RoundColumn
            key={`right-${r}`}
            roundMatches={sortedRoundMatches("RIGHT", r)}
            r1MatchCount={r1LeftCount}
            round={r}
            connectorSide="left"
            showConnector={true}
            getTeam={getTeam}
            onMatchClick={onMatchClick}
          />
        ))}
      </div>
    </div>
  );
}

/** Legacy bracket (no side info) — original single-column layout */
function LegacyBracket({
  matches,
  teams,
  onMatchClick,
}: {
  matches: Match[];
  teams: TeamWithMembers[];
  onMatchClick?: (id: string) => void;
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
          const slotHeightPx = SLOT_H;

          return (
            <div key={round} className="flex flex-col shrink-0" style={{ width: 240 }}>
              <div className="px-3 pb-3 pt-1 border-b mb-0">
                <h3 className="font-semibold text-sm">Round {round}</h3>
                <p className="text-xs text-muted-foreground">
                  {roundMatches.filter((m) => !m.isBye).length} matches
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
