import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { 
  MessageSquare, 
  Send, 
  Globe, 
  Lock, 
  Clock, 
  AlertCircle, 
  CheckCircle, 
  XCircle,
  Loader2,
  Plus,
  ArrowLeft,
  Settings,
  Target,
  History,
  UserCheck,
  RotateCcw,
  File,
  FileText,
  Image,
  AlertTriangle,
  User
} from "lucide-react";
import { DatabaseService, TicketWithDetails, CommentWithUser } from "@/lib/database";
import { useAuth } from "@/contexts/AuthContext";
import { InternalComments } from "./InternalComments";
import { ActivityLog } from "./ActivityLog";
import { SLAMonitor } from "./SLAMonitor";
// TicketTransferDialog removed - functionality moved to UnifiedTicketDetail
import { TicketClosureDialog } from "./dialogs/TicketClosureDialog";
import { supabase } from "@/lib/supabase";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useTranslation } from 'react-i18next';

interface AgentResponseInterfaceProps {
  ticket: TicketWithDetails;
  onTicketUpdate?: () => void;
  onClose?: () => void;
}

interface ResponseData {
  message: string;
  status: string;
  isInternal: boolean;
  attachments: File[];
}

export const AgentResponseInterface = ({ 
  ticket, 
  onTicketUpdate,
  onClose 
}: AgentResponseInterfaceProps) => {
  const { t } = useTranslation();
  const [currentTicket, setCurrentTicket] = useState<TicketWithDetails>(ticket);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Transfer dialog state removed - functionality moved to UnifiedTicketDetail
  const [isClosureDialogOpen, setIsClosureDialogOpen] = useState(false);
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);
  const [isResponseFormCollapsed, setIsResponseFormCollapsed] = useState(false);
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);
  const [taskData, setTaskData] = useState({
    title: '',
    description: '',
    priority: 'medium' as 'low' | 'medium' | 'high' | 'urgent'
  });
  
  const [response, setResponse] = useState<ResponseData>({
    message: "",
    status: ticket.status,
    isInternal: false,
    attachments: []
  });

  const { userProfile } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    setCurrentTicket(ticket);
    setResponse(prev => ({ ...prev, status: ticket.status }));
  }, [ticket]);

  const refreshTicketData = async () => {
    try {
      const updatedTicket = await DatabaseService.getTicketById(ticket.id);
      setCurrentTicket(updatedTicket);
      setRefreshKey(prev => prev + 1);
      if (onTicketUpdate) {
        onTicketUpdate();
      }
    } catch (error) {
      console.error('Error refreshing ticket data:', error);
    }
  };

  // Verificar se o ticket pode ser editado
  const canEditTicket = () => {
    if (currentTicket.status === 'closed') return false;
    if (!userProfile) return false;
    
    return userProfile.role === 'admin' || 
           (userProfile.role === 'agent' && currentTicket.assigned_to === userProfile.id);
  };

  // Verificar se comentários podem ser adicionados
  const canAddComment = () => {
    if (currentTicket.status === 'closed') return false;
    if (!userProfile) return false;
    
    return userProfile.role === 'admin' || 
           userProfile.role === 'agent' || 
           (userProfile.role === 'user' && currentTicket.user_id === userProfile.id);
  };

  // Verificar se pode fechar o ticket
  const canCloseTicket = () => {
    if (!userProfile) return false;
    
    // Ticket must be resolved first
    if (currentTicket.status !== 'resolved') return false;
    
    // Must have resolution notes
    if (!currentTicket.resolution || currentTicket.resolution.trim() === '') return false;
    
    // Must have resolved_at timestamp
    if (!currentTicket.resolved_at) return false;
    
    // Permission check
    return userProfile.role === 'admin' || 
           (userProfile.role === 'agent' && currentTicket.assigned_to === userProfile.id);
  };

  const handleSubmitResponse = async () => {
    if (!response.message.trim()) return;
    
    setIsSubmitting(true);
    
    try {
      // Upload de anexos primeiro
      const uploadedAttachments = [];
      for (const file of response.attachments) {
        const attachment = await uploadAttachment(file);
        if (attachment !== null) {
          uploadedAttachments.push(attachment);
        }
      }

      const { data, error } = await supabase
        .from('ticket_comments_new')
        .insert({
          ticket_id: currentTicket.id,
          user_id: userProfile?.id,
          content: response.message,
          is_internal: response.isInternal,
          attachments: uploadedAttachments.length > 0 ? uploadedAttachments : null
        });

      if (error) throw error;

      // Atualizar status do ticket se necessário
      if (response.status !== currentTicket.status) {
        const { error: statusError } = await supabase
          .from('tickets_new')
          .update({ 
            status: response.status as "open" | "closed" | "resolved" | "pending" | "in_progress",
            updated_at: new Date().toISOString()
          })
          .eq('id', currentTicket.id);

        if (statusError) throw statusError;
      }

      // Mostrar animação de sucesso
      setShowSuccessAnimation(true);
      setTimeout(() => setShowSuccessAnimation(false), 3000);

      // Colapsar formulário após envio
      setIsResponseFormCollapsed(true);
      setTimeout(() => setIsResponseFormCollapsed(false), 5000);

      // Limpar formulário
      setResponse({
        message: '',
        status: response.status,
        isInternal: false,
        attachments: []
      });

      // Atualizar dados
      setRefreshKey(prev => prev + 1);
      await refreshTicketData();
      onTicketUpdate?.();

    } catch (error) {
      console.error('Erro ao enviar resposta:', error);
      toast({
        title: "Erro",
        description: "Não foi possível enviar a resposta. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const uploadAttachment = async (file: File) => {
    // Funcionalidade de upload simplificada - apenas para demonstração
    console.log('Upload de arquivo:', file.name);
    // Em uma implementação real, seria feito o upload para o storage
    return null;
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    setResponse(prev => ({
      ...prev,
      attachments: [...prev.attachments, ...files]
    }));
  };

  const removeAttachment = (index: number) => {
    setResponse(prev => ({
      ...prev,
      attachments: prev.attachments.filter((_, i) => i !== index)
    }));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "open": return "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700";
      case "in_progress": return "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800";
      case "resolved": return "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800";
      case "closed": return "bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700";
      default: return "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700";
    }
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

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return <Image className="h-4 w-4" />;
    if (mimeType.includes('pdf')) return <FileText className="h-4 w-4" />;
    return <File className="h-4 w-4" />;
  };

  const canTransferTicket = userProfile?.role === 'admin' || userProfile?.role === 'agent';

  // Função para criar tarefa
  const handleCreateTask = async () => {
    if (!taskData.title.trim() || !userProfile) return;

    try {
      await DatabaseService.createTodoTask({
        title: taskData.title,
        description: taskData.description || undefined,
        priority: taskData.priority,
        assigned_to: userProfile.id,
        ticket_id: currentTicket.id
      });

      // Reset form
      setTaskData({
        title: '',
        description: '',
        priority: 'medium'
      });
      
      setIsTaskDialogOpen(false);
      
      toast({
        title: "Sucesso",
        description: "Tarefa criada e adicionada ao To-Do!",
      });
      
      // Trigger refresh for sidebar todo count
      onTicketUpdate?.();
    } catch (error) {
      console.error('Error creating task:', error);
      toast({
        title: "Erro",
        description: "Não foi possível criar a tarefa",
        variant: "destructive",
      });
    }
  };

  const formatPriority = (priority: string) => {
    const priorityMap = {
      urgent: "🔴 Crítica",
      high: "🟠 Alta",
      medium: "🟡 Média",
      low: "🟢 Baixa"
    };
    return priorityMap[priority as keyof typeof priorityMap] || priority;
  };

  // Função para calcular e exibir alertas de SLA
  const getSLAAlert = () => {
    if (!currentTicket.created_at) return null;
    
    const createdAt = new Date(currentTicket.created_at);
    const now = new Date();
    const hoursElapsed = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
    
    // SLA baseado na prioridade (em horas)
    const slaHours = {
      'urgent': 4,
      'high': 8,
      'medium': 24,
      'low': 48
    };
    
    const slaLimit = slaHours[currentTicket.priority as keyof typeof slaHours] || 24;
    const remainingHours = slaLimit - hoursElapsed;
    
    if (remainingHours <= 0) {
      return (
        <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <div className="p-1 rounded-full bg-red-100 dark:bg-red-900/30">
            <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
          </div>
          <span className="text-sm font-medium text-red-700 dark:text-red-300">
            ⚠️ SLA Vencido há {Math.abs(remainingHours).toFixed(1)} horas
          </span>
        </div>
      );
    } else if (remainingHours <= 2) {
      return (
        <div className="flex items-center gap-2 p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg">
          <div className="p-1 rounded-full bg-orange-100 dark:bg-orange-900/30">
            <Clock className="h-4 w-4 text-orange-600 dark:text-orange-400" />
          </div>
          <span className="text-sm font-medium text-orange-700 dark:text-orange-300">
            ⏰ SLA próximo do vencimento ({remainingHours.toFixed(1)} horas restantes)
          </span>
        </div>
      );
    }
    
    return null;
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header com informações do ticket */}
      <Card className="border-l-4 border-l-blue-500">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-3">
              <div className="flex items-center gap-4">
                <h1 className="text-3xl font-semibold text-gray-900 dark:text-gray-100 leading-tight">
                  {currentTicket.title}
                </h1>
              </div>
              
              <div className="flex items-center gap-3 flex-wrap">
                <Badge className={getStatusColor(currentTicket.status)}>
                  {currentTicket.status === 'open' && <AlertCircle className="h-3 w-3 mr-1" />}
                  {currentTicket.status === 'in_progress' && <Clock className="h-3 w-3 mr-1" />}
                  {currentTicket.status === 'resolved' && <CheckCircle className="h-3 w-3 mr-1" />}
                  {currentTicket.status === 'closed' && <XCircle className="h-3 w-3 mr-1" />}
                  {currentTicket.status.charAt(0).toUpperCase() + currentTicket.status.slice(1)}
                </Badge>
                
                <Badge className={getPriorityColor(currentTicket.priority)}>
                  {currentTicket.priority.charAt(0).toUpperCase() + currentTicket.priority.slice(1)}
                </Badge>
              </div>
            </div>
            
            <div className="text-right space-y-2">
              {currentTicket.ticket_number && (
                <div className="text-lg font-mono text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-3 py-1 rounded-lg border border-blue-200 dark:border-blue-800">
                  {currentTicket.ticket_number}
                </div>
              )}
              <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                <div className="flex items-center gap-1 justify-end">
                  <Clock className="h-4 w-4" />
                  <span title={t('tickets.createdOn', { date: formatDate(currentTicket.created_at) })}>
                    Criado em {formatDate(currentTicket.created_at)}
                  </span>
                </div>
                <div className="flex items-center gap-1 justify-end">
                  <History className="h-4 w-4" />
                  <span title={t('tickets.updatedOn', { date: formatDate(currentTicket.updated_at || '') })}>
                    Atualizado em {formatDate(currentTicket.updated_at || '')}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </CardHeader>
        
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <h4 className="font-semibold mb-3 text-gray-900 dark:text-gray-100">Solicitante</h4>
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                    {currentTicket.user?.name?.charAt(0) || 'U'}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium text-gray-900 dark:text-gray-100">
                    {currentTicket.user?.name || 'Usuário Desconhecido'}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {currentTicket.user?.email}
                  </p>
                </div>
              </div>
            </div>
            
            <div>
              <h4 className="font-semibold mb-3 text-gray-900 dark:text-gray-100">Atribuído para</h4>
              {currentTicket.assignee ? (
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                      {currentTicket.assignee.name?.charAt(0) || 'A'}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-gray-100">
                      {currentTicket.assignee.name}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {currentTicket.assignee.email}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-gray-500 dark:text-gray-400 italic">Não atribuído</p>
              )}
            </div>
          </div>
          
          <div>
            <h4 className="font-semibold mb-3 text-gray-900 dark:text-gray-100">Descrição</h4>
            <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-lg border">
              <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
                {currentTicket.description}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* SLA Monitor */}
      <SLAMonitor 
        ticketId={currentTicket.id}
        priority={currentTicket.priority}
        createdAt={currentTicket.created_at}
        status={currentTicket.status}
        userRole="agent"
        resolvedAt={currentTicket.resolved_at || undefined}
        closedAt={currentTicket.closed_at || undefined}
      />

      {/* Layout principal com duas colunas */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Coluna principal - Conversação Unificada */}
        <div className="xl:col-span-2 space-y-6">
          {/* Conversação Unificada com Resposta Integrada */}
          <Card className="shadow-sm border-0 bg-gradient-to-br from-white to-gray-50/50 dark:from-gray-900 dark:to-gray-800/50">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-3 text-xl">
                  <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                    <MessageSquare className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  Conversação
                </CardTitle>
                <Badge variant="outline" className="text-xs">
                  {currentTicket.status === 'open' && 'Aguardando Resposta'}
                  {currentTicket.status === 'in_progress' && 'Em Andamento'}
                  {currentTicket.status === 'resolved' && 'Resolvido'}
                  {currentTicket.status === 'closed' && 'Fechado'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-0 space-y-6">
              {/* Histórico de Conversas */}
              <div className="max-h-[500px] overflow-y-auto border rounded-lg bg-white dark:bg-gray-900/50">
                <div className="p-4">
                  <InternalComments 
                    key={`conversation-${refreshKey}`}
                    ticketId={currentTicket.id} 
                    userRole="agent"
                  />
                </div>
              </div>

              {/* Formulário de Resposta Integrado */}
              {currentTicket.status === 'closed' ? (
                <div className="border-2 border-red-200 dark:border-red-800 rounded-lg p-6 bg-red-50/50 dark:bg-red-900/20">
                  <div className="text-center">
                    <Lock className="h-8 w-8 text-red-400 mx-auto mb-3" />
                    <h3 className="text-lg font-medium text-red-700 dark:text-red-300 mb-2">
                      Ticket Fechado
                    </h3>
                    <p className="text-red-600 dark:text-red-400 text-sm">
                      Este ticket está fechado e não aceita mais respostas.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="border-t pt-6 space-y-4">
                  {/* Animação de confirmação */}
                  {showSuccessAnimation && (
                    <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg animate-in fade-in-0 slide-in-from-top-2 duration-300">
                      <div className="p-2 rounded-full bg-green-100 dark:bg-green-900/30">
                        <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                      </div>
                      <div>
                        <h4 className="text-sm font-medium text-green-800 dark:text-green-200">
                          ✅ Resposta enviada com sucesso!
                        </h4>
                        <p className="text-xs text-green-600 dark:text-green-400">
                          {response.isInternal ? 'Nota interna adicionada' : 'Resposta pública enviada'}
                        </p>
                      </div>
                    </div>
                  )}

                  {!isResponseFormCollapsed && (
                    <>
                      <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                          <Send className="h-4 w-4 text-green-600 dark:text-green-400" />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                          Adicionar Resposta
                        </h3>
                      </div>

                      {/* Tipo de resposta compacto */}
                      <div className="flex gap-3">
                        <button
                          type="button"
                          className={`flex-1 p-3 rounded-lg border-2 transition-all duration-200 ${
                            !response.isInternal 
                              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-400' 
                              : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                          }`}
                          onClick={() => setResponse(prev => ({ ...prev, isInternal: false }))}
                        >
                          <div className="flex items-center gap-2 justify-center">
                            <Globe className={`h-4 w-4 ${!response.isInternal ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500'}`} />
                            <span className={`text-sm font-medium ${!response.isInternal ? 'text-blue-900 dark:text-blue-100' : 'text-gray-700 dark:text-gray-300'}`}>
                              Resposta Pública
                            </span>
                          </div>
                        </button>
                        
                        <button
                          type="button"
                          className={`flex-1 p-3 rounded-lg border-2 transition-all duration-200 ${
                            response.isInternal 
                              ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-400' 
                              : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                          }`}
                          onClick={() => setResponse(prev => ({ ...prev, isInternal: true }))}
                        >
                          <div className="flex items-center gap-2 justify-center">
                            <Lock className={`h-4 w-4 ${response.isInternal ? 'text-amber-600 dark:text-amber-400' : 'text-gray-500'}`} />
                            <span className={`text-sm font-medium ${response.isInternal ? 'text-amber-900 dark:text-amber-100' : 'text-gray-700 dark:text-gray-300'}`}>
                              Nota Interna
                            </span>
                          </div>
                        </button>
                      </div>

                      {/* Editor de mensagem */}
                      <div className="space-y-2">
                        <Textarea
                          placeholder={response.isInternal ? t('agent.internalNotePlaceholder') : t('agent.responsePlaceholder')}
                          value={response.message}
                          onChange={(e) => setResponse(prev => ({ ...prev, message: e.target.value }))}
                          rows={4}
                          className="resize-none border-gray-200 dark:border-gray-700 focus:border-blue-500 dark:focus:border-blue-400 transition-colors"
                        />
                      </div>

                      {/* Anexos melhorados */}
                      <div className="space-y-3">
                        <div className="flex items-center gap-3">
                          <label className="flex-1 cursor-pointer">
                            <div className="flex items-center gap-2 p-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-blue-400 dark:hover:border-blue-500 transition-colors">
                              <div className="p-1 rounded bg-blue-100 dark:bg-blue-900/30">
                                <File className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                              </div>
                              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                📎 Anexar arquivo
                              </span>
                            </div>
                            <Input
                              type="file"
                              multiple
                              onChange={handleFileSelect}
                              className="hidden"
                            />
                          </label>
                        </div>
                        
                        {response.attachments.length > 0 && (
                          <div className="space-y-2">
                            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Arquivos anexados:</h4>
                            {response.attachments.map((file, index) => (
                              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
                                <div className="flex items-center gap-3">
                                  <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                                    {getFileIcon(file.type)}
                                  </div>
                                  <div>
                                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{file.name}</span>
                                    <div className="text-xs text-gray-500 dark:text-gray-400">
                                      {Math.round(file.size / 1024)} KB
                                    </div>
                                  </div>
                                </div>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => removeAttachment(index)}
                                  className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                                  title="Remover arquivo"
                                >
                                  <XCircle className="h-4 w-4" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Botões de ação */}
                      <div className="flex items-center justify-between pt-4 border-t">
                        <div className="flex items-center gap-2">
                          {onClose && (
                            <Button variant="outline" onClick={onClose} size="sm">
                              <ArrowLeft className="h-4 w-4 mr-1" />
                              Voltar
                            </Button>
                          )}
                        </div>
                        
                        <Button 
                          onClick={handleSubmitResponse}
                          disabled={isSubmitting || !response.message.trim()}
                          className={`${response.isInternal ? 'bg-amber-600 hover:bg-amber-700' : 'bg-blue-600 hover:bg-blue-700'} transition-all duration-200`}
                        >
                          {isSubmitting ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Send className="h-4 w-4 mr-2" />
                          )}
                          {isSubmitting ? 'Enviando...' : (response.isInternal ? 'Adicionar Nota' : 'Enviar Resposta')}
                        </Button>
                      </div>
                    </>
                  )}

                  {isResponseFormCollapsed && (
                    <div className="text-center py-4">
                      <Button 
                        variant="outline" 
                        onClick={() => setIsResponseFormCollapsed(false)}
                        className="gap-2"
                      >
                        <Plus className="h-4 w-4" />
                        Adicionar Nova Resposta
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Coluna lateral - Ações e Informações */}
        <div className="space-y-6">
          {/* Status e Ações Rápidas */}
          <Card className="shadow-sm border-0 bg-gradient-to-br from-white to-gray-50/50 dark:from-gray-900 dark:to-gray-800/50">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-3 text-lg">
                <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                  <Settings className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                </div>
                Status do Ticket
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">Alterar Status</Label>
                <Select value={response.status} onValueChange={(value) => setResponse(prev => ({ ...prev, status: value }))}>
                  <SelectTrigger className="border-gray-200 dark:border-gray-700">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-gray-500"></div>
                        Aberto
                      </div>
                    </SelectItem>
                    <SelectItem value="in_progress">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                        Em Progresso
                      </div>
                    </SelectItem>
                    <SelectItem value="resolved">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-500"></div>
                        Resolvido
                      </div>
                    </SelectItem>
                    <SelectItem value="closed">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-gray-400"></div>
                        Fechado
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Ações do Ticket */}
          <Card className="shadow-sm border-0 bg-gradient-to-br from-white to-gray-50/50 dark:from-gray-900 dark:to-gray-800/50">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-3 text-lg">
                <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-900/30">
                  <Target className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                </div>
                Ações
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Transfer button removed - functionality moved to UnifiedTicketDetail */}
              
              {canCloseTicket() && (
                <Button 
                  variant="outline" 
                  className="w-full justify-start gap-3 h-12 border-red-200 dark:border-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-700 dark:text-red-300 hover:border-red-300 dark:hover:border-red-600 transition-all duration-200"
                  onClick={() => setIsClosureDialogOpen(true)}
                >
                  <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30">
                    <Lock className="h-5 w-5 text-red-600 dark:text-red-400" />
                  </div>
                  <span className="font-medium">Fechar Ticket</span>
                </Button>
              )}
              
              <Button 
                variant="outline" 
                className="w-full justify-start gap-3 h-12 border-gray-200 dark:border-gray-700 hover:bg-green-50 dark:hover:bg-green-900/20 hover:border-green-300 dark:hover:border-green-600 transition-all duration-200"
                onClick={() => setIsTaskDialogOpen(true)}
              >
                <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                  <Plus className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                <span className="font-medium">Adicionar Tarefa</span>
              </Button>
            </CardContent>
          </Card>

          {/* Atividades Recentes */}
          <Card className="shadow-sm border-0 bg-gradient-to-br from-white to-gray-50/50 dark:from-gray-900 dark:to-gray-800/50">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-3 text-lg">
                <div className="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-900/30">
                  <History className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                </div>
                Atividades
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="max-h-[300px] overflow-y-auto">
                <ActivityLog 
                  key={`activity-${refreshKey}`}
                  ticketId={currentTicket.id} 
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Transfer functionality moved to UnifiedTicketDetail */}

      {/* Closure Dialog */}
      <TicketClosureDialog
        open={isClosureDialogOpen}
        onOpenChange={setIsClosureDialogOpen}
        ticket={currentTicket}
        onClosed={refreshTicketData}
      />

      {/* Task Creation Dialog */}
      <Dialog open={isTaskDialogOpen} onOpenChange={setIsTaskDialogOpen}>
        <DialogContent className="dark:bg-gray-900 dark:border-gray-700 max-w-md">
          <DialogHeader>
            <DialogTitle className="dark:text-gray-100 flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Adicionar Tarefa ao Ticket
            </DialogTitle>
            <DialogDescription className="sr-only">
              Formulário para criar uma nova tarefa vinculada a este ticket.
            </DialogDescription>
          </DialogHeader>

          {/* Ticket Info */}
          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800 mb-4">
            <div className="flex items-center gap-2 text-sm">
              <FileText className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <span className="font-medium text-blue-900 dark:text-blue-100">
                {currentTicket.ticket_number}: {currentTicket.title}
              </span>
            </div>
            {currentTicket.user?.name && (
              <div className="flex items-center gap-1 mt-2 text-xs text-blue-700 dark:text-blue-300">
                <User className="h-3 w-3" />
                <span>Solicitante: {currentTicket.user.name}</span>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium dark:text-gray-200">Título da Tarefa</Label>
              <Input
                value={taskData.title}
                onChange={(e) => setTaskData({ ...taskData, title: e.target.value })}
                placeholder="Ex: Verificar configuração do servidor..."
                className="dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
              />
            </div>
            
            <div>
              <Label className="text-sm font-medium dark:text-gray-200">Descrição (opcional)</Label>
              <Textarea
                value={taskData.description}
                onChange={(e) => setTaskData({ ...taskData, description: e.target.value })}
                placeholder="Detalhes sobre o que precisa ser feito..."
                className="dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100 min-h-20"
                rows={3}
              />
            </div>
            
            <div>
              <Label className="text-sm font-medium dark:text-gray-200">Prioridade</Label>
              <Select 
                value={taskData.priority} 
                onValueChange={(value: any) => setTaskData({ ...taskData, priority: value })}
              >
                <SelectTrigger className="dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="dark:bg-gray-800 dark:border-gray-600">
                  <SelectItem value="low">{formatPriority('low')}</SelectItem>
                  <SelectItem value="medium">{formatPriority('medium')}</SelectItem>
                  <SelectItem value="high">{formatPriority('high')}</SelectItem>
                  <SelectItem value="urgent">{formatPriority('urgent')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex justify-end gap-2 pt-4">
              <Button 
                variant="outline" 
                onClick={() => setIsTaskDialogOpen(false)}
                className="dark:border-gray-600 dark:text-gray-300"
              >
                Cancelar
              </Button>
              <Button 
                onClick={handleCreateTask}
                disabled={!taskData.title.trim()}
                className="bg-green-600 hover:bg-green-700"
              >
                <Plus className="h-4 w-4 mr-2" />
                Criar Tarefa
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};