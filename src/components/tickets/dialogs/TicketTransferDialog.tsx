import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { UserCheck, Loader2, Users, AlertCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { DatabaseService, TicketWithDetails } from "@/lib/database";
import { useTranslation } from "react-i18next";

interface Agent {
  id: string;
  full_name: string;
  email: string;
  avatar_url?: string | null;
  workload?: number;
}

interface TicketTransferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ticket: TicketWithDetails | null;
  onTransferred?: () => void;
}

export const TicketTransferDialog = ({ 
  open, 
  onOpenChange, 
  ticket, 
  onTransferred 
}: TicketTransferDialogProps) => {
  const [selectedAgent, setSelectedAgent] = useState<string>("");
  const [transferReason, setTransferReason] = useState("");
  const [agents, setAgents] = useState<Agent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingAgents, setIsLoadingAgents] = useState(false);
  const [error, setError] = useState("");
  
  const { toast } = useToast();
  const { userProfile } = useAuth();
  const { t } = useTranslation();

  useEffect(() => {
    if (open) {
      loadAgents();
      setSelectedAgent("");
      setTransferReason("");
      setError("");
    }
  }, [open]);

  const loadAgents = async () => {
    setIsLoadingAgents(true);
    try {
      // Buscar todos os agentes e admins
      const { data: users, error } = await supabase
        .from('users')
        .select('id, full_name, email, avatar_url, role')
        .in('role', ['agent', 'admin'])
        .neq('id', userProfile?.id || '') // Excluir o usuário atual
        .order('full_name');

      if (error) throw error;
      if (!users) {
        setAgents([]);
        return;
      }

      // Calcular workload para cada agente
      const agentsWithWorkload = await Promise.all(
        users.map(async (user) => {
          try {
            const assignedTickets = await DatabaseService.getTickets({
              userId: user.id,
              assignedOnly: true,
              userRole: 'agent',
              statusFilter: 'open' // tickets abertos
            });
            
            return {
              id: user.id,
              full_name: user.full_name,
              email: user.email,
              avatar_url: user.avatar_url,
              workload: assignedTickets.length
            };
          } catch (error) {
            console.error(`Error loading workload for agent ${user.id}:`, error);
            return {
              id: user.id,
              full_name: user.full_name,
              email: user.email,
              avatar_url: user.avatar_url,
              workload: 0
            };
          }
        })
      );

      // Ordenar por workload (menor primeiro)
      agentsWithWorkload.sort((a, b) => (a.workload || 0) - (b.workload || 0));
      
      setAgents(agentsWithWorkload);
    } catch (err) {
      console.error('Error loading agents:', err);
      setError(t('tickets.transfer.loadAgentsError'));
    } finally {
      setIsLoadingAgents(false);
    }
  };

  const handleTransfer = async () => {
    if (!selectedAgent) {
      setError(t('tickets.transfer.selectAgentError'));
      return;
    }

    if (!transferReason.trim()) {
      setError(t('tickets.transfer.reasonRequired'));
      return;
    }

    if (!ticket) return;

    setIsLoading(true);
    setError("");

    try {
      // 1. Atualizar o ticket
      const { error: updateError } = await supabase
        .from('tickets_new')
        .update({ 
          assigned_to: selectedAgent,
          updated_at: new Date().toISOString()
        })
        .eq('id', ticket.id);

      if (updateError) throw updateError;

      // 2. Adicionar comentário interno sobre a transferência
      try {
        await DatabaseService.addTicketComment(
          ticket.id,
          userProfile?.id || '',
          `Ticket transferido para outro agente.\n\nMotivo: ${transferReason}`,
          true // isInternal = true
        );
      } catch (commentError) {
        console.error('Error adding transfer comment:', commentError);
        // Não falhar a transferência por causa do comentário
      }

      // 3. Criar notificação para o novo agente
      try {
        await DatabaseService.createNotification({
          user_id: selectedAgent,
          type: 'ticket_assigned',
          title: 'Ticket Transferido para Você',
          message: `O ticket ${ticket.ticket_number || ticket.id} foi transferido para você por ${userProfile?.full_name}`,
          ticket_id: ticket.id,
          priority: 'medium'
        });
      } catch (notificationError) {
        console.error('Error creating notification:', notificationError);
        // Não falhar a transferência por causa da notificação
      }

      const targetAgent = agents.find(agent => agent.id === selectedAgent);
      
      toast({
        title: t('tickets.transfer.transferredTitle'),
        description: t('tickets.transfer.transferredDesc', { agent: targetAgent?.full_name || t('common.agent') }),
      });

      onOpenChange(false);
      if (onTransferred) {
        onTransferred();
      }
    } catch (err) {
      console.error('Error transferring ticket:', err);
      setError(t('tickets.transfer.transferError'));
      toast({
        title: t('common.error'),
        description: t('tickets.transfer.transferError'),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setSelectedAgent("");
    setTransferReason("");
    setError("");
    onOpenChange(false);
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "urgent": return "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800";
      case "high": return "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800";
      case "medium": return "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800";
      case "low": return "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800";
      default: return "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700";
    }
  };

  const getWorkloadColor = (workload: number) => {
    if (workload === 0) return "text-green-600 dark:text-green-400";
    if (workload <= 3) return "text-yellow-600 dark:text-yellow-400";
    if (workload <= 6) return "text-orange-600 dark:text-orange-400";
    return "text-red-600 dark:text-red-400";
  };

  if (!ticket) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCheck className="h-5 w-5" />
            {t('tickets.transfer.title')}
          </DialogTitle>
          <DialogDescription className="sr-only">{t('tickets.transfer.descriptionSr')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Informações do ticket */}
          <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border">
            <div className="flex items-center gap-2 mb-2">
              <h4 className="font-medium text-gray-900 dark:text-gray-100">
                {ticket.ticket_number && (
                  <span className="text-sm font-mono text-blue-600 dark:text-blue-400 mr-2">
                    {ticket.ticket_number}
                  </span>
                )}
                {ticket.title}
              </h4>
              <Badge className={getPriorityColor(ticket.priority)}>
                {ticket.priority.charAt(0).toUpperCase() + ticket.priority.slice(1)}
              </Badge>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {t('tickets.createdBy')}: {ticket.user?.name || t('common.unknownUser')}
            </p>
          </div>

          {/* Seleção do agente */}
          <div>
            <Label htmlFor="agent">{t('tickets.transfer.transferToLabel')}</Label>
            <Select value={selectedAgent} onValueChange={setSelectedAgent} disabled={isLoadingAgents}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder={isLoadingAgents ? t('tickets.transfer.loadingAgents') : t('tickets.transfer.selectAgentPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                {agents.map((agent) => (
                  <SelectItem key={agent.id} value={agent.id}>
                    <div className="flex items-center gap-3 w-full">
                      <Avatar className="h-6 w-6">
                        <AvatarFallback className="text-xs">
                          {agent.full_name?.charAt(0) || 'A'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{agent.full_name}</span>
                          <span className={`text-xs ${getWorkloadColor(agent.workload || 0)}`}>
                            {agent.workload || 0} tickets
                          </span>
                        </div>
                        <div className="text-xs text-gray-500">{agent.email}</div>
                      </div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Motivo da transferência */}
          <div>
            <Label htmlFor="reason">{t('tickets.transfer.reasonLabel')}</Label>
            <Textarea
              id="reason"
              placeholder={t('tickets.transfer.reasonPlaceholder')}
              value={transferReason}
              onChange={(e) => setTransferReason(e.target.value)}
              rows={3}
              className="mt-1"
            />
          </div>

          {/* Erro */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Informação sobre workload */}
          {agents.length > 0 && (
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="flex items-center gap-2 mb-2">
                <Users className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                  {t('tickets.transfer.workloadTitle')}
                </span>
              </div>
              <p className="text-xs text-blue-700 dark:text-blue-300">
                {t('tickets.transfer.workloadHint')}
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isLoading}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleTransfer} disabled={isLoading || !selectedAgent || !transferReason.trim()}>
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {t('tickets.transfer.transferring')}
              </>
            ) : (
              <>
                <UserCheck className="h-4 w-4 mr-2" />
                {t('tickets.transfer.title')}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}; 