import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, Loader2 } from "lucide-react";
import DatabaseService, { TicketWithDetails } from "@/lib/database";
import { toast } from "@/components/ui/sonner";
import { useTicketCount } from "@/contexts/TicketCountContext";
import { useTranslation } from "react-i18next";

interface TicketResolutionDialogProps {
  ticket: TicketWithDetails | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export const TicketResolutionDialog = ({ 
  ticket, 
  open, 
  onOpenChange, 
  onSuccess 
}: TicketResolutionDialogProps) => {
  const { t } = useTranslation();
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { triggerRefresh } = useTicketCount();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!ticket) return;
    
    if (!resolutionNotes.trim()) {
      setError(t("tickets.resolve.resolutionNotesRequired"));
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await DatabaseService.resolveTicket(
        ticket.id, 
        resolutionNotes.trim(),
        ticket.assigned_to || ticket.user_id
      );

      toast(t("tickets.resolve.successTitle"), {
        description: t("tickets.resolve.successDescription")
      });

      // Trigger sidebar count refresh
      triggerRefresh();

      setResolutionNotes("");
      onSuccess();
      onOpenChange(false);
    } catch (err) {
      console.error('Error resolving ticket:', err);
      const errorMessage = err instanceof Error ? err.message : t("tickets.resolve.errorDefault");
      setError(errorMessage);
      toast.error(t("tickets.resolve.error"), {
        description: errorMessage
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setResolutionNotes("");
    setError(null);
    onOpenChange(false);
  };

  if (!ticket) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader className="pb-4 border-b border-gray-200 dark:border-gray-700">
          <DialogTitle className="flex items-center gap-3 text-xl font-bold">
            <div className="h-10 w-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center">
              <CheckCircle className="h-6 w-6 text-white" />
            </div>
            <span className="bg-gradient-to-r from-green-700 to-emerald-700 dark:from-green-400 dark:to-emerald-400 bg-clip-text text-transparent">
              {t("tickets.resolve.title")}
            </span>
          </DialogTitle>
          <DialogDescription>
            Mark this ticket as resolved by providing resolution notes that explain how the issue was fixed.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 pt-2">
          <div className="space-y-2">
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 p-4 rounded-lg border border-blue-300 dark:border-blue-700 shadow-sm">
              <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
                {ticket.ticket_number && (
                  <span className="font-mono text-xs bg-blue-200 dark:bg-blue-800 px-2 py-1 rounded mr-2 text-blue-800 dark:text-blue-200">
                    #{ticket.ticket_number}
                  </span>
                )}
                {ticket.title}
              </h4>
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 bg-blue-500 rounded-full animate-pulse"></div>
                <p className="text-sm text-blue-800 dark:text-blue-200 font-medium">
                  {t("tickets.resolve.currentStatus")}: {ticket.status === 'open' ? t("tickets.status.open") : t("tickets.status.inProgress")}
                </p>
              </div>
            </div>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-3">
            <Label htmlFor="resolutionNotes" className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              📝 {t("tickets.resolve.resolutionNotes")} *
            </Label>
            <Textarea
              id="resolutionNotes"
              placeholder={t("tickets.resolve.resolutionNotesPlaceholder")}
              value={resolutionNotes}
              onChange={(e) => setResolutionNotes(e.target.value)}
              rows={5}
              required
              disabled={isLoading}
              className="border-2 focus:border-green-500 dark:focus:border-green-400 resize-none"
            />
            <div className="bg-gray-50 dark:bg-gray-800/50 p-3 rounded-md border border-gray-200 dark:border-gray-700">
              <p className="text-xs text-gray-700 dark:text-gray-300 font-medium">
                💡 <strong>{t("tickets.resolve.tip")}:</strong> {t("tickets.resolve.tipText")}
              </p>
            </div>
          </div>

          <DialogFooter className="gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={isLoading}
              className="flex-1 border-2 hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              ❌ {t("common.cancel")}
            </Button>
            <Button
              type="submit"
              disabled={isLoading || !resolutionNotes.trim()}
              className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-200"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t("tickets.resolve.resolving")}
                </>
              ) : (
                <>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  ✅ {t("tickets.resolve.resolveButton")}
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
