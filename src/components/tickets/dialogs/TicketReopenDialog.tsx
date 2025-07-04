import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, Loader2, AlertTriangle, Lock } from "lucide-react";
import DatabaseService, { TicketWithDetails } from "@/lib/database";
import { toast } from "@/components/ui/sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "react-i18next";

interface TicketReopenDialogProps {
  ticket: TicketWithDetails | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export const TicketReopenDialog = ({ 
  ticket, 
  open, 
  onOpenChange, 
  onSuccess 
}: TicketReopenDialogProps) => {
  const [reopenReason, setReopenReason] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const { t } = useTranslation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!ticket || !user) return;
    
    if (!reopenReason.trim()) {
      setError("Por favor, adicione um motivo para a reabertura.");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await DatabaseService.reopenTicket(
        ticket.id, 
        reopenReason.trim(),
        user.id
      );

      toast.success("Ticket Reaberto", {
        description: "O ticket foi reaberto com sucesso."
      });

      setReopenReason("");
      if (onSuccess) {
        onSuccess();
      }
      onOpenChange(false);
    } catch (err) {
      console.error('Error reopening ticket:', err);
      const errorMessage = err instanceof Error ? err.message : 'Erro ao reabrir o ticket. Tente novamente.';
      setError(errorMessage);
      toast.error("Erro ao reabrir ticket", {
        description: errorMessage
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setReopenReason("");
    setError(null);
    onOpenChange(false);
  };

  if (!ticket) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader className="pb-4 border-b border-gray-200 dark:border-gray-700">
          <DialogTitle className="flex items-center gap-3 text-xl font-bold">
            <div className="h-10 w-10 bg-gradient-to-br from-amber-500 to-orange-600 rounded-full flex items-center justify-center">
              <Lock className="h-6 w-6 text-white" />
            </div>
            <span className="bg-gradient-to-r from-amber-700 to-orange-700 dark:from-amber-400 dark:to-orange-400 bg-clip-text text-transparent">
              Reabrir Ticket
            </span>
          </DialogTitle>
          <DialogDescription className="text-gray-600 dark:text-gray-400 mt-2">
            Informe o motivo para reabrir este ticket.
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
                <div className="h-2 w-2 bg-amber-500 rounded-full"></div>
                <p className="text-sm text-blue-800 dark:text-blue-200 font-medium">
                  Status atual: {ticket.status === 'closed' ? 'Fechado' : 'Resolvido'}
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
            <label htmlFor="reopenReason" className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              📝 Motivo da Reabertura *
            </label>
            <textarea
              id="reopenReason"
              placeholder="Descreva o motivo para reabrir este ticket..."
              value={reopenReason}
              onChange={(e) => setReopenReason(e.target.value)}
              rows={5}
              required
              disabled={isLoading}
              className="w-full border-2 rounded-md focus:border-amber-500 dark:focus:border-amber-400 resize-none"
            />
            <div className="bg-gray-50 dark:bg-gray-800/50 p-3 rounded-md border border-gray-200 dark:border-gray-700">
              <p className="text-xs text-gray-700 dark:text-gray-300 font-medium">
                💡 <strong>Dica:</strong> Explique claramente por que o ticket precisa ser reaberto.
                Inclua informações relevantes que justifiquem a reabertura.
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
              ❌ Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isLoading || !reopenReason.trim()}
              className="flex-1 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-200"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Reabrindo...
                </>
              ) : (
                <>
                  <Lock className="mr-2 h-4 w-4" />
                  🔓 Reabrir Ticket
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
