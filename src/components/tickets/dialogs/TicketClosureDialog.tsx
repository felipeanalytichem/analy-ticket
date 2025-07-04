import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, Loader2, AlertTriangle, Lock, XCircle } from "lucide-react";
import DatabaseService, { TicketWithDetails, TicketStatus } from "@/lib/database";
import { toast } from "@/components/ui/sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "react-i18next";

interface TicketClosureDialogProps {
  ticket: TicketWithDetails | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onClosed: () => void;
}

export const TicketClosureDialog = ({ 
  ticket, 
  open, 
  onOpenChange, 
  onClosed 
}: TicketClosureDialogProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const { t } = useTranslation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!ticket || !user) return;
    
    // Pre-validate before attempting to close
    if (ticket.status !== 'resolved') {
      setError(t('tickets.close.errors.notResolved', { status: getStatusLabel(ticket.status) }));
      return;
    }

    if (!ticket.resolution || ticket.resolution.trim() === '') {
      setError(t('tickets.close.errors.emptyResolution'));
      return;
    }

    if (!ticket.resolved_at) {
      setError(t('tickets.close.errors.noResolvedDate'));
      return;
    }
    
    setIsLoading(true);
    setError(null);

    try {
      await DatabaseService.closeTicket(ticket.id, user.id);

      toast.success(t('tickets.close.success.title'), {
        description: t('tickets.close.success.description')
      });

      onClosed();
      onOpenChange(false);
    } catch (err) {
      console.error('Error closing ticket:', err);
      const errorMessage = err instanceof Error ? err.message : t('tickets.close.errors.generic');
      setError(errorMessage);
      toast.error(t('tickets.close.errors.title'), {
        description: errorMessage
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setError(null);
    onOpenChange(false);
  };

  const getStatusLabel = (status: TicketStatus) => {
    const statusMap: Record<TicketStatus, string> = {
      'open': t('tickets.status.open'),
      'pending': t('tickets.status.pending'),
      'in_progress': t('tickets.status.inProgress'),
      'resolved': t('tickets.status.resolved'),
      'closed': t('tickets.status.closed')
    };
    return statusMap[status] || status;
  };

  const getStatusColor = (status: TicketStatus) => {
    switch (status) {
      case "open": return "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-300";
      case "in_progress": return "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300";
      case "resolved": return "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300";
      case "closed": return "bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800 dark:text-slate-300";
      default: return "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-300";
    }
  };

  const canCloseTicket = () => {
    if (!ticket) return false;
    return ticket.status === 'resolved' && 
           ticket.resolution && 
           ticket.resolution.trim() !== '' && 
           ticket.resolved_at;
  };

  if (!ticket) return null;

  const isTicketReadyToClose = canCloseTicket();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader className="pb-4 border-b border-gray-200 dark:border-gray-700">
          <DialogTitle className="flex items-center gap-3 text-xl font-bold">
            <div className="h-10 w-10 bg-gradient-to-br from-red-500 to-rose-600 rounded-full flex items-center justify-center">
              <Lock className="h-6 w-6 text-white" />
            </div>
            <span className="bg-gradient-to-r from-red-700 to-rose-700 dark:from-red-400 dark:to-rose-400 bg-clip-text text-transparent">
              {t('tickets.close.title')}
            </span>
          </DialogTitle>
          <DialogDescription className="text-gray-600 dark:text-gray-400 mt-2">
            {t('tickets.close.infoDesc')}
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
                <div className={`h-2 w-2 rounded-full ${ticket.status === 'resolved' ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <p className="text-sm text-blue-800 dark:text-blue-200 font-medium">
                  {t('tickets.close.statusLabel')}: 
                  <span className={`ml-1 px-2 py-1 rounded text-xs ${getStatusColor(ticket.status)}`}>
                    {getStatusLabel(ticket.status)}
                  </span>
                </p>
              </div>
            </div>
          </div>

          {/* Validation warnings for tickets that can't be closed */}
          {!isTicketReadyToClose && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertDescription>
                <div className="font-semibold mb-2">{t('tickets.close.errors.cannotClose')}</div>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  {ticket.status !== 'resolved' && (
                    <li>{t('tickets.close.errors.statusMustBeResolved', { status: getStatusLabel(ticket.status) })}</li>
                  )}
                  {(!ticket.resolution || ticket.resolution.trim() === '') && (
                    <li>{t('tickets.close.errors.resolutionRequired')}</li>
                  )}
                  {!ticket.resolved_at && (
                    <li>{t('tickets.close.errors.resolvedDateRequired')}</li>
                  )}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {isTicketReadyToClose && (
          <div className="bg-amber-50 dark:bg-amber-950/30 p-4 rounded-lg border border-amber-200 dark:border-amber-800">
            <div className="flex items-start gap-3">
              <div className="mt-1">
                <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-500" />
              </div>
              <div>
                <h4 className="font-semibold text-amber-900 dark:text-amber-100">
                    {t('tickets.close.infoTitle')}
                </h4>
                <p className="text-sm text-amber-800 dark:text-amber-200 mt-1">
                    {t('tickets.close.infoDesc')}
                </p>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={isLoading}
            >
              {t('common.cancel')}
            </Button>
            <Button
              type="submit"
              variant="destructive"
              disabled={!isTicketReadyToClose || isLoading}
              className="gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t('tickets.close.closing')}
                </>
              ) : (
                <>
                  <Lock className="h-4 w-4" />
                  {t('tickets.close.confirm')}
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
