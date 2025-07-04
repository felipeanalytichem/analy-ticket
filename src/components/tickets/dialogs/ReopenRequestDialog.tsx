import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RotateCcw, Loader2, AlertTriangle, Info } from "lucide-react";
import { TicketWithDetails } from "@/lib/database";
import { ReopenService } from "@/lib/reopen-service";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "react-i18next";

interface ReopenRequestDialogProps {
  ticket: TicketWithDetails | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRequestSubmitted: () => void;
}

export const ReopenRequestDialog = ({ 
  ticket, 
  open, 
  onOpenChange, 
  onRequestSubmitted 
}: ReopenRequestDialogProps) => {
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const { userProfile } = useAuth();
  const { t } = useTranslation();

  const canRequestReopen = () => {
    if (!ticket || !userProfile) return false;
    
    // Apenas o criador do ticket pode solicitar reabertura
    return ticket.user_id === userProfile.id && ticket.status === 'closed';
  };

  const handleSubmit = async () => {
    if (!ticket || !userProfile) return;

    if (!reason.trim()) {
      toast({
        title: t('common.error'),
        description: t('tickets.reopen.reasonRequired'),
        variant: "destructive",
      });
      return;
    }

    if (!canRequestReopen()) {
      toast({
        title: t('common.error'),
        description: t('tickets.reopen.noPermission'),
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await ReopenService.createReopenRequest(ticket.id, userProfile.id, reason.trim());
      
      toast({
        title: t('tickets.reopen.sentTitle'),
        description: t('tickets.reopen.sentDesc'),
      });

      setReason("");
      onRequestSubmitted();
      onOpenChange(false);
    } catch (error) {
      console.error('Error creating reopen request:', error);
      toast({
        title: t('common.error'),
        description: error instanceof Error ? error.message : "Não foi possível enviar a solicitação.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!ticket) return null;

  const canRequest = canRequestReopen();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RotateCcw className="h-5 w-5 text-blue-600" />
            {t('tickets.reopen.title')}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
            <div className="flex items-start gap-3">
              <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
              <div>
                <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-1">
                  {t('tickets.reopen.infoTitle')}
                </h4>
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  {t('tickets.reopen.infoDesc')}
                </p>
              </div>
            </div>
          </div>

          {/* Informações do ticket */}
          <div className="space-y-2">
            <div className="text-sm">
              <span className="font-medium text-gray-700 dark:text-gray-300">{t('tickets.reopen.ticketLabel')}:</span>
              <span className="ml-2 text-gray-900 dark:text-gray-100">
                {ticket.ticket_number} - {ticket.title}
              </span>
            </div>
            <div className="text-sm">
              <span className="font-medium text-gray-700 dark:text-gray-300">{t('tickets.reopen.statusLabel')}:</span>
              <span className="ml-2 text-gray-900 dark:text-gray-100">{ticket.status}</span>
            </div>
            {ticket.resolution && (
              <div className="text-sm">
                <span className="font-medium text-gray-700 dark:text-gray-300">{t('tickets.reopen.previousResolutionLabel')}:</span>
                <div className="mt-1 p-2 bg-gray-50 dark:bg-gray-800 rounded text-gray-900 dark:text-gray-100 text-xs">
                  {ticket.resolution}
                </div>
              </div>
            )}
          </div>

          {/* Validação */}
          {!canRequest && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                {ticket.status !== 'closed' 
                  ? t('tickets.reopen.closedOnly')
                  : t('tickets.reopen.creatorOnly')
                }
              </AlertDescription>
            </Alert>
          )}

          {/* Campo de motivo */}
          {canRequest && (
            <div className="space-y-2">
              <Label htmlFor="reason" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('tickets.reopen.reasonLabel')} *
              </Label>
              <Textarea
                id="reason"
                placeholder={t('tickets.reopen.reasonPlaceholder')}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={4}
                className="resize-none"
                disabled={isSubmitting}
              />
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {t('tickets.reopen.reasonHelper')}
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            {t('common.cancel')}
          </Button>
          {canRequest && (
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || !reason.trim()}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t('tickets.reopen.sending')}
                </>
              ) : (
                <>
                  <RotateCcw className="h-4 w-4 mr-2" />
                  {t('tickets.reopen.sendButton')}
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}; 