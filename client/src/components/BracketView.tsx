import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, Clock, CheckCircle2, MessageSquare } from "lucide-react";
import MatchCard from "./MatchCard";
import type { Match, Team } from "@shared/schema";

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

function getRoundName(round: number, totalRounds: number): string {
  const distance = totalRounds - round;
  const names = ["Final", "Semi-Final", "Quarter-Final", "Round of 16", "Round of 32", "Round of 64"];
  return distance < names.length ? names[distance] : `Round ${round}`;
}

/** Compact bracket slot — shown for placeholder (TBD) matches */
function BracketSlot({
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
  const isTbd = !match.team1Id && !match.team2Id;
  const isCompleted = match.status === "completed";

  const getDisplayName = (team?: TeamWithMembers, teamId?: string | null) => {
    if (!teamId) return "TBD";
    if (team?.members && team.members.length > 0) return `@${team.members[0].username}`;
    return team?.name || "TBD";
  };

  const isWinner = (teamId?: string | null) =>
    !!match.winnerId && match.winnerId === teamId;

  if (match.isBye) {
    return (
      <div
        onClick={onClick}
        className="cursor-default select-none rounded-lg border border-dashed border-border/50 bg-muted/30 px-3 py-2 text-sm text-muted-foreground"
      >
        <span className="font-medium">{getDisplayName(team1, match.team1Id)}</span>
        <span className="ml-2 text-xs opacity-60">BYE — advances</span>
      </div>
    );
  }

  if (isTbd) {
    return (
      <div className="select-none rounded-lg border border-dashed border-border/40 bg-muted/20 px-3 py-2 text-sm text-muted-foreground/50">
        <div className="flex items-center justify-between">
          <span>TBD</span>
          <span className="text-xs">vs</span>
          <span>TBD</span>
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      className={`cursor-pointer select-none rounded-lg border px-3 py-2 text-sm transition-colors hover:bg-accent/50 ${
        isCompleted
          ? "border-border bg-card"
          : "border-border/70 bg-card/80"
      }`}
    >
      {/* Team 1 row */}
      <div
        className={`flex items-center justify-between gap-2 py-0.5 ${
          isWinner(match.team1Id) ? "font-bold text-primary" : ""
        }`}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          {isWinner(match.team1Id) && <Trophy className="w-3 h-3 text-amber-500 shrink-0" />}
          <span className="truncate">{getDisplayName(team1, match.team1Id)}</span>
        </div>
        {isCompleted && match.team1Score !== null && (
          <span className="font-mono font-bold tabular-nums">{match.team1Score}</span>
        )}
      </div>

      {/* Divider */}
      <div className="border-t border-border/30 my-1" />

      {/* Team 2 row */}
      <div
        className={`flex items-center justify-between gap-2 py-0.5 ${
          isWinner(match.team2Id) ? "font-bold text-primary" : ""
        }`}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          {isWinner(match.team2Id) && <Trophy className="w-3 h-3 text-amber-500 shrink-0" />}
          <span className="truncate">{getDisplayName(team2, match.team2Id)}</span>
        </div>
        {isCompleted && match.team2Score !== null && (
          <span className="font-mono font-bold tabular-nums">{match.team2Score}</span>
        )}
      </div>

      {/* Status badge */}
      <div className="mt-1.5 flex items-center gap-1">
        {isCompleted ? (
          <CheckCircle2 className="w-3 h-3 text-emerald-500" />
        ) : match.status === "in_progress" ? (
          <Clock className="w-3 h-3 text-blue-500 animate-pulse" />
        ) : (
          <Clock className="w-3 h-3 text-muted-foreground/40" />
        )}
        <span className="text-[10px] text-muted-foreground capitalize">
          {match.status.replace("_", " ")}
        </span>
        {onClick && match.team1Id && match.team2Id && (
          <MessageSquare className="w-3 h-3 text-muted-foreground/50 ml-auto" />
        )}
      </div>
    </div>
  );
}

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
                    <div
                      key={match.id}
                      onClick={() => onMatchClick?.(match.id)}
                      className="cursor-pointer"
                    >
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

  // ── Single Elimination: horizontal bracket tree ───────────────────────────
  if (matches.length === 0) return null;
  const totalRounds = Math.max(...matches.map((m) => m.round));

  return (
    <div className="w-full overflow-x-auto pb-6">
      <div className="flex gap-0 p-4 min-w-max items-start">
        {Array.from({ length: totalRounds }, (_, i) => i + 1).map((round) => {
          const roundMatches = matches.filter((m) => m.round === round);
          const isLastRound = round === totalRounds;
          // Number of matches in R1 tells us total bracket slots; use it for spacing
          const r1Count = matches.filter((m) => m.round === 1).length;
          const slotsInRound = Math.ceil(r1Count / Math.pow(2, round - 1));
          // Each slot height (card ~72px + gap). Matches are centered within their slot.
          const slotHeightPx = 88; // px per slot — card ~72px + gap 16px

          return (
            <div key={round} className="flex flex-col shrink-0" style={{ width: 240 }}>
              {/* Round header */}
              <div className="px-3 pb-3 pt-1 border-b mb-0">
                <h3 className="font-display font-semibold text-sm">
                  {getRoundName(round, totalRounds)}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {roundMatches.filter((m) => !m.isBye).length} matches
                </p>
              </div>

              {/* Match slots with connector lines */}
              <div className="relative flex flex-col" style={{ paddingTop: 8 }}>
                {Array.from({ length: slotsInRound }, (_, slotIdx) => {
                  const match = roundMatches[slotIdx];
                  const slotTop = slotIdx * slotHeightPx;
                  // Connector lines: right-side bracket lines connecting to next round
                  const showConnector = !isLastRound;
                  const isUpperOfPair = slotIdx % 2 === 0;

                  return (
                    <div
                      key={slotIdx}
                      className="relative"
                      style={{
                        height: slotHeightPx,
                        display: "flex",
                        alignItems: "center",
                        paddingRight: showConnector ? 20 : 0,
                        paddingLeft: round > 1 ? 16 : 0,
                      }}
                    >
                      {/* Left incoming connector (round 2+) */}
                      {round > 1 && (
                        <div
                          className="absolute left-0 top-1/2 bg-border"
                          style={{ width: 16, height: 1 }}
                        />
                      )}

                      {/* Match card or empty slot */}
                      <div className="flex-1">
                        {match ? (
                          <BracketSlot
                            match={match}
                            team1={getTeamById(match.team1Id)}
                            team2={getTeamById(match.team2Id)}
                            onClick={
                              onMatchClick && match.team1Id && match.team2Id
                                ? () => onMatchClick(match.id)
                                : undefined
                            }
                          />
                        ) : (
                          <div className="rounded-lg border border-dashed border-border/30 bg-muted/10 px-3 py-2 text-xs text-muted-foreground/40 text-center">
                            TBD
                          </div>
                        )}
                      </div>

                      {/* Right outgoing connector */}
                      {showConnector && (
                        <>
                          {/* Horizontal stub right */}
                          <div
                            className="absolute right-0 top-1/2 bg-border"
                            style={{ width: 16, height: 1 }}
                          />
                          {/* Vertical bar connecting pair → next round */}
                          {isUpperOfPair ? (
                            <div
                              className="absolute bg-border"
                              style={{
                                right: 0,
                                top: "50%",
                                width: 1,
                                height: slotHeightPx, // spans down to mid of next (odd) slot
                              }}
                            />
                          ) : (
                            <div
                              className="absolute bg-border"
                              style={{
                                right: 0,
                                bottom: "50%",
                                width: 1,
                                height: slotHeightPx, // spans up to mid of prev (even) slot
                              }}
                            />
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
