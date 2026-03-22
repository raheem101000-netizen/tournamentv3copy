import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { MessageCircleQuestion, CheckCircle2 } from "lucide-react";

interface ContactSupportModalProps {
  open: boolean;
  onClose: () => void;
}

export function ContactSupportModal({ open, onClose }: ContactSupportModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [submitted, setSubmitted] = useState(false);

  const [form, setForm] = useState({
    platformUsername: (user as any)?.username || "",
    email: "",
    discordUsername: "",
    subject: "",
    message: "",
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/support-tickets", {
        platformUsername: form.platformUsername || undefined,
        email: form.email,
        discordUsername: form.discordUsername || undefined,
        subject: form.subject,
        message: form.message,
      });
    },
    onSuccess: () => {
      setSubmitted(true);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send message. Please try again.",
        variant: "destructive",
      });
    },
  });

  function handleClose() {
    setSubmitted(false);
    setForm({
      platformUsername: (user as any)?.username || "",
      email: "",
      discordUsername: "",
      subject: "",
      message: "",
    });
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-md mx-4">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircleQuestion className="w-5 h-5" />
            Contact Support
          </DialogTitle>
        </DialogHeader>

        {submitted ? (
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <CheckCircle2 className="w-12 h-12 text-green-500" />
            <h3 className="text-lg font-semibold">Message Sent!</h3>
            <p className="text-sm text-muted-foreground">
              We've received your message and will get back to you soon via email or Discord.
            </p>
            <Button onClick={handleClose} className="w-full">Close</Button>
          </div>
        ) : (
          <div className="space-y-4">
            {user && (
              <div className="space-y-1">
                <Label>Platform Username</Label>
                <Input
                  value={form.platformUsername}
                  onChange={(e) => setForm({ ...form, platformUsername: e.target.value })}
                  placeholder="Your username"
                />
              </div>
            )}

            <div className="space-y-1">
              <Label>Email <span className="text-destructive">*</span></Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="your@email.com"
              />
            </div>

            <div className="space-y-1">
              <Label>Discord Username</Label>
              <Input
                value={form.discordUsername}
                onChange={(e) => setForm({ ...form, discordUsername: e.target.value })}
                placeholder="username#0000"
              />
            </div>

            <div className="space-y-1">
              <Label>Subject <span className="text-destructive">*</span></Label>
              <Input
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                placeholder="What's this about?"
              />
            </div>

            <div className="space-y-1">
              <Label>Message <span className="text-destructive">*</span></Label>
              <Textarea
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                placeholder="Describe your issue or question..."
                rows={4}
              />
            </div>

            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={handleClose} className="flex-1">
                Cancel
              </Button>
              <Button
                onClick={() => submitMutation.mutate()}
                disabled={!form.email || !form.subject || !form.message || submitMutation.isPending}
                className="flex-1"
              >
                {submitMutation.isPending ? "Sending..." : "Send Message"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
