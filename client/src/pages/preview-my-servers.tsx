import { useState } from "react";
import { MobileLayout } from "@/components/layouts/MobileLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Users, Server as ServerIcon, Search, Crown, Star } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { OptimizedImage } from "@/components/ui/optimized-image";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import type { Server, Tournament } from "@shared/schema";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import ImageUploadField from "@/components/ImageUploadField";
import TournamentCard from "@/components/TournamentCard";

export default function PreviewMyServers() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [createServerOpen, setCreateServerOpen] = useState(false);
  const [serverName, setServerName] = useState("");
  const [serverDescription, setServerDescription] = useState("");
  const [selectedGameTags, setSelectedGameTags] = useState<string[]>([]);
  const [gameTagInput, setGameTagInput] = useState("");
  const [welcomeMessage, setWelcomeMessage] = useState("");
  const [serverIconUrl, setServerIconUrl] = useState("");
  const [serverBackgroundUrl, setServerBackgroundUrl] = useState("");
  const [createServerStep, setCreateServerStep] = useState(1);
  const [activeTab, setActiveTab] = useState<"servers" | "registered" | "saved">("servers");

  // Fetch servers where user is a member
  const { data: memberServersData, isLoading: memberLoading } = useQuery<Server[]>({
    queryKey: [`/api/users/${user?.id}/servers`],
    enabled: !!user?.id,
  });

  // Fetch saved tournaments
  const { data: savedTournaments } = useQuery<(Tournament & { savedAt: string })[]>({
    queryKey: ['/api/users/me/saved-tournaments'],
    enabled: !!user,
  });

  // Fetch registered tournaments (tournaments user signed up for)
  const { data: registeredTournaments } = useQuery<(Tournament & { registeredAt: string; registrationStatus: string })[]>({
    queryKey: ['/api/users/me/registered-tournaments'],
    enabled: !!user,
  });

  const createServerMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("You must be logged in to create a server");
      const response = await apiRequest('POST', `/api/servers`, {
        name: serverName,
        description: serverDescription,
        gameTags: selectedGameTags,
        category: "Gaming",
        isPublic: 1,
        welcomeMessage: welcomeMessage,
        iconUrl: serverIconUrl,
        backgroundUrl: serverBackgroundUrl,
      });
      return response;
    },
    onSuccess: (data) => {
      toast({
        title: "Server created!",
        description: "Your server has been created successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/mobile-preview/servers'] });
      queryClient.invalidateQueries({ queryKey: [`/api/users/${user?.id}/servers`] });
      setCreateServerOpen(false);
      setServerName("");
      setServerDescription("");
      setSelectedGameTags([]);
      setWelcomeMessage("");
      setServerIconUrl("");
      setServerBackgroundUrl("");
      setCreateServerStep(1);
      setLocation(`/server/${data.id}`);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to create server",
        description: error.message || "Please try again later.",
        variant: "destructive",
      });
    },
  });

  const handleCreateServer = () => {
    if (!serverName.trim()) {
      toast({
        title: "Server name required",
        description: "Please enter a name for your server.",
        variant: "destructive",
      });
      return;
    }
    createServerMutation.mutate();
  };

  const myServers = memberServersData || [];

  return (
    <MobileLayout>
      <>
      <div className="p-4 pb-24 space-y-4">
        {/* Header */}
        <div className="relative flex items-center justify-center">
          <h1 className="text-2xl font-bold">My Page</h1>
          <Button size="sm" onClick={() => setCreateServerOpen(true)} data-testid="button-create-server" className="absolute right-0">
            <Plus className="w-4 h-4 mr-2" />
            Create
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2">
          {(["servers", "registered", "saved"] as const).map((tab) => (
            <Button
              key={tab}
              variant={activeTab === tab ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveTab(tab)}
              className="rounded-full h-9 px-4 capitalize flex-1"
            >
              {tab === "servers" ? (
                <>Servers{myServers.length > 0 && <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5 h-5">{myServers.length}</Badge>}</>
              ) : tab === "registered" ? (
                <>Registered{registeredTournaments && registeredTournaments.length > 0 && <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5 h-5">{registeredTournaments.length}</Badge>}</>
              ) : (
                <>Saved{savedTournaments && savedTournaments.length > 0 && <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5 h-5">{savedTournaments.length}</Badge>}</>
              )}
            </Button>
          ))}
        </div>

        {/* Servers Tab */}
        {activeTab === "servers" && (
          memberLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Card key={i} className="overflow-hidden">
                  <div className="aspect-[16/9] bg-muted animate-pulse" />
                  <div className="px-4 pb-4 pt-0">
                    <div className="w-10 h-10 rounded-full bg-muted animate-pulse -mt-5" />
                    <div className="mt-2 space-y-2">
                      <div className="h-4 w-3/4 bg-muted animate-pulse rounded" />
                      <div className="h-3 w-full bg-muted animate-pulse rounded" />
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : myServers.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {myServers.map((server) => {
                const isOwned = server.ownerId === user?.id;
                const isVerified = (server as any).isVerified === 1;
                const categories = (server as any).gameTags?.length > 0 ? (server as any).gameTags : [];
                return (
                  <Card
                    key={server.id}
                    className="overflow-hidden hover-elevate cursor-pointer group"
                    data-testid={isOwned ? `server-owned-${server.id}` : `server-member-${server.id}`}
                    onClick={() => setLocation(`/server/${server.id}`)}
                  >
                    {/* Banner — 16:9 */}
                    <div className="relative aspect-[16/9] bg-gradient-to-br from-primary/30 to-primary/10">
                      {isVerified && (
                        <div className="absolute top-2 right-2 z-20 flex items-center gap-1 px-2 py-1 rounded-md bg-blue-500 text-white text-xs font-medium">
                          <Star className="w-3 h-3 fill-white" />
                          Verified
                        </div>
                      )}
                      {isOwned && (
                        <div className="absolute top-2 left-2 z-20 flex items-center gap-1 px-2 py-1 rounded-md bg-yellow-500 text-white text-xs font-medium">
                          <Crown className="w-3 h-3" />
                          Owner
                        </div>
                      )}
                      <OptimizedImage
                        src={(server as any).backgroundUrl || null}
                        alt={server.name}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        thumbnailSize="lg"
                        fallback={
                          <div className="w-full h-full bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center">
                            <ServerIcon className="h-8 w-8 text-muted-foreground/40" />
                          </div>
                        }
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />
                    </div>

                    {/* Card content with overlapping avatar */}
                    <div className="relative px-4 pb-4 pt-0">
                      <Avatar className="w-10 h-10 -mt-5 border-[3px] border-card bg-card flex-shrink-0 shadow-md">
                        <AvatarImage src={server.iconUrl || undefined} alt={server.name} />
                        <AvatarFallback className="text-xs font-bold">{server.name.charAt(0).toUpperCase()}</AvatarFallback>
                      </Avatar>

                      <div className="mt-2 space-y-1.5">
                        <h3 className="font-bold text-base leading-tight truncate" data-testid={`server-name-${server.id}`}>
                          {server.name}
                        </h3>
                        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                          {server.description || "No description"}
                        </p>
                        <div className="flex items-center gap-3 pt-1 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-muted-foreground/50" />
                            {(server.memberCount || 0).toLocaleString()} Members
                          </span>
                          {categories[0] && (
                            <Badge variant="secondary" className="text-[10px] h-5 px-1.5">
                              {categories[0]}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-20 bg-muted/20 rounded-lg border border-dashed">
              <ServerIcon className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-50" />
              <p className="text-muted-foreground font-medium">No servers yet</p>
              <Link href="/discovery">
                <Button variant="ghost" className="mt-2 text-xs" data-testid="button-go-to-discovery">
                  <Search className="w-3 h-3 mr-1" />
                  Discover servers
                </Button>
              </Link>
            </div>
          )
        )}

        {/* Registered Tab */}
        {activeTab === "registered" && (
          registeredTournaments && registeredTournaments.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {registeredTournaments.map((tournament) => (
                <TournamentCard
                  key={tournament.id}
                  tournament={tournament}
                  onView={() => {
                    if (tournament.serverId) {
                      setLocation(`/server/${tournament.serverId}`);
                      return;
                    }
                    setLocation(`/tournament/${tournament.id}/view`);
                  }}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-20 bg-muted/20 rounded-lg border border-dashed">
              <p className="text-muted-foreground font-medium">No registered tournaments</p>
            </div>
          )
        )}

        {/* Saved Tab */}
        {activeTab === "saved" && (
          savedTournaments && savedTournaments.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {savedTournaments.map((tournament) => (
                <TournamentCard
                  key={tournament.id}
                  tournament={tournament}
                  onView={() => setLocation(`/tournament/${tournament.id}/view`)}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-20 bg-muted/20 rounded-lg border border-dashed">
              <p className="text-muted-foreground font-medium">No saved tournaments</p>
            </div>
          )
        )}
      </div>

        {/* Create Server Dialog */}
        <Dialog open={createServerOpen} onOpenChange={(open) => {
          setCreateServerOpen(open);
          if (!open) setCreateServerStep(1);
        }}>
          <DialogContent className="max-w-md max-h-[90vh] flex flex-col p-0 overflow-hidden">
            <DialogHeader className="p-6 pb-0">
              <DialogTitle>Create Your Server</DialogTitle>
              <DialogDescription>
                {createServerStep === 1 ? "Step 1 of 2: Basic Information" : "Step 2 of 2: Welcome & Branding"}
              </DialogDescription>
            </DialogHeader>

            <ScrollArea className="flex-1 px-6 overflow-y-auto">
              <div className="py-4 min-h-0 flex-shrink-0">
                {createServerStep === 1 ? (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="server-name">Server Name *</Label>
                      <Input
                        id="server-name"
                        placeholder="Enter server name..."
                        value={serverName}
                        onChange={(e) => setServerName(e.target.value)}
                        data-testid="input-server-name"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="server-description">Description</Label>
                      <Textarea
                        id="server-description"
                        placeholder="Tell people what your server is about..."
                        value={serverDescription}
                        onChange={(e) => setServerDescription(e.target.value)}
                        rows={3}
                        data-testid="textarea-server-description"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Game Tags (optional)</Label>
                      <p className="text-xs text-muted-foreground">
                        Type game names and press Enter to add them as tags
                      </p>
                      <div className="space-y-2">
                        <Input
                          placeholder="e.g. Valorant, Dragon Ball Z, Fortnite..."
                          value={gameTagInput}
                          onChange={(e) => setGameTagInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && gameTagInput.trim()) {
                              e.preventDefault();
                              const tag = gameTagInput.trim();
                              if (!selectedGameTags.includes(tag)) {
                                setSelectedGameTags(prev => [...prev, tag]);
                              }
                              setGameTagInput("");
                            }
                          }}
                          data-testid="input-game-tags"
                        />
                        {selectedGameTags.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {selectedGameTags.map((tag) => (
                              <Badge
                                key={tag}
                                variant="default"
                                className="cursor-pointer"
                                onClick={() => {
                                  setSelectedGameTags(prev => prev.filter(t => t !== tag));
                                }}
                                data-testid={`tag-${tag.toLowerCase().replace(/\s+/g, '-')}`}
                              >
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="welcome-message">Welcome Message (Optional)</Label>
                      <Textarea
                        id="welcome-message"
                        placeholder="Welcome to our server! Here you'll find..."
                        value={welcomeMessage}
                        onChange={(e) => setWelcomeMessage(e.target.value)}
                        rows={4}
                        data-testid="textarea-welcome-message"
                      />
                      <p className="text-xs text-muted-foreground">
                        This message will be displayed to everyone who previews or joins your server.
                      </p>
                    </div>

                    <ImageUploadField
                      label="Server Icon"
                      value={serverIconUrl}
                      onChange={setServerIconUrl}
                      placeholder="Upload your server icon"
                      required
                    />

                    <ImageUploadField
                      label="Server Background"
                      value={serverBackgroundUrl}
                      onChange={setServerBackgroundUrl}
                      placeholder="Upload your server background image"
                      required
                    />
                  </div>
                )}
              </div>
            </ScrollArea>

            <div className="p-6 pt-2 border-t bg-background">
              <div className="flex gap-2">
                {createServerStep === 1 ? (
                  <>
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => setCreateServerOpen(false)}
                      data-testid="button-cancel-create"
                    >
                      Cancel
                    </Button>
                    <Button
                      className="flex-1"
                      onClick={() => setCreateServerStep(2)}
                      disabled={!serverName.trim()}
                      data-testid="button-next-step"
                    >
                      Next
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => setCreateServerStep(1)}
                      disabled={createServerMutation.isPending}
                      data-testid="button-back-step"
                    >
                      Back
                    </Button>
                    <Button
                      className="flex-1"
                      onClick={handleCreateServer}
                      disabled={createServerMutation.isPending || !serverIconUrl}
                      data-testid="button-confirm-create"
                    >
                      {createServerMutation.isPending ? "Creating..." : "Create Server"}
                    </Button>
                  </>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </>
    </MobileLayout>
  );
}
