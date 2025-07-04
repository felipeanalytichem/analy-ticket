import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { NotificationService } from '@/lib/notificationService';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

const NOTIFICATION_TYPES = [
  { value: 'ticket_created', label: '🎫 Chamado Criado', priority: 'medium' },
  { value: 'ticket_assigned', label: '👤 Chamado Atribuído', priority: 'medium' },
  { value: 'agent_assigned', label: '👨‍💼 Agente Designado', priority: 'medium' },
  { value: 'comment_added', label: '💬 Comentário Adicionado', priority: 'medium' },
  { value: 'message_received', label: '📨 Mensagem Recebida', priority: 'medium' },
  { value: 'status_changed', label: '📋 Status Alterado', priority: 'medium' },
  { value: 'priority_changed', label: '⚡ Prioridade Alterada', priority: 'medium' },
  { value: 'ticket_resolved', label: '✅ Chamado Resolvido', priority: 'medium' },
  { value: 'ticket_closed', label: '🔒 Chamado Fechado', priority: 'medium' },
  { value: 'ticket_closed_auto', label: '🔒 Fechamento Automático', priority: 'high' },
  { value: 'ticket_transfer', label: '🔄 Chamado Transferido', priority: 'medium' },
  { value: 'escalation', label: '📈 Escalação', priority: 'high' },
  { value: 'feedback_request', label: '⭐ Solicitação de Avaliação', priority: 'low' },
  { value: 'satisfaction_survey', label: '📊 Pesquisa de Satisfação', priority: 'low' },
  { value: 'sla_warning', label: '⚠️ Aviso de SLA', priority: 'medium' },
  { value: 'sla_breach', label: '🚨 Violação de SLA', priority: 'high' },
  { value: 'reopen_request', label: '🔄 Solicitação de Reabertura', priority: 'low' },
  { value: 'reopen_approved', label: '✅ Reabertura Aprovada', priority: 'medium' },
  { value: 'reopen_rejected', label: '❌ Reabertura Rejeitada', priority: 'medium' },
  { value: 'reminder', label: '🔔 Lembrete', priority: 'low' },
  { value: 'follow_up', label: '📞 Acompanhamento', priority: 'low' }
];

const QUICK_SCENARIOS = [
  {
    name: 'Novo Chamado Criado',
    type: 'ticket_created',
    context: { ticketNumber: 'TK-2024-001', ticketTitle: 'Problema com login', agentName: 'João Silva' }
  },
  {
    name: 'Resposta do Agente',
    type: 'message_received',
    context: { ticketNumber: 'TK-2024-001', agentName: 'Maria Santos' }
  },
  {
    name: 'Chamado Resolvido',
    type: 'ticket_resolved',
    context: { ticketNumber: 'TK-2024-001', resolvedBy: 'Carlos Oliveira' }
  },
  {
    name: 'Fechamento Automático',
    type: 'ticket_closed_auto',
    context: { ticketNumber: 'TK-2024-001', daysOpen: 2 }
  },
  {
    name: 'Violação de SLA',
    type: 'sla_breach',
    context: { ticketNumber: 'TK-2024-001' }
  },
  {
    name: 'Escalação',
    type: 'escalation',
    context: { ticketNumber: 'TK-2024-001' }
  }
];

export function NotificationTester() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedType, setSelectedType] = useState<string>('');
  const [customTitle, setCustomTitle] = useState('');
  const [customMessage, setCustomMessage] = useState('');
  const [ticketNumber, setTicketNumber] = useState('TK-2024-001');
  const [agentName, setAgentName] = useState('João Silva');
  const [isLoading, setIsLoading] = useState(false);
  const [lastResult, setLastResult] = useState<string>('');

  const handleQuickTest = async (scenario: typeof QUICK_SCENARIOS[0]) => {
    if (!user?.id) return;
    
    setIsLoading(true);
    try {
      const success = await NotificationService.createSmartNotification(
        user.id,
        scenario.type,
        undefined,
        scenario.context
      );
      
      setLastResult(success ? 
        `✅ Notificação "${scenario.name}" criada com sucesso!` : 
        `❌ Erro ao criar notificação "${scenario.name}"`
      );
    } catch (error) {
      setLastResult(`❌ Erro: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCustomTest = async () => {
    if (!user?.id || !selectedType) return;
    
    setIsLoading(true);
    try {
      let success;
      
      if (customTitle && customMessage) {
        // Use custom title and message
        const typeInfo = NOTIFICATION_TYPES.find(t => t.value === selectedType);
        success = await NotificationService.createNotification(
          user.id,
          customTitle,
          customMessage,
          selectedType,
          typeInfo?.priority as any || 'medium'
        );
      } else {
        // Use smart notification with context
        success = await NotificationService.createSmartNotification(
          user.id,
          selectedType,
          undefined,
          {
            ticketNumber,
            agentName,
            userName: user.name
          }
        );
      }
      
      setLastResult(success ? 
        `✅ Notificação personalizada criada com sucesso!` : 
        `❌ Erro ao criar notificação personalizada`
      );
    } catch (error) {
      setLastResult(`❌ Erro: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  const getPreview = () => {
    if (!selectedType) return null;
    
    const typeInfo = NOTIFICATION_TYPES.find(t => t.value === selectedType);
    if (!typeInfo) return null;

    if (customTitle && customMessage) {
      return {
        title: customTitle,
        message: customMessage,
        icon: NotificationService.getNotificationIcon(selectedType),
        priority: typeInfo.priority
      };
    }

    const { title, message } = NotificationService.generateNotificationMessage(
      selectedType,
      {
        ticketNumber,
        agentName,
        userName: user?.name
      }
    );

    return {
      title,
      message,
      icon: NotificationService.getNotificationIcon(selectedType),
      priority: typeInfo.priority
    };
  };

  const preview = getPreview();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>🧪 Testador de Notificações</CardTitle>
          <CardDescription>
            Teste diferentes tipos de notificações para verificar mensagens e comportamento
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Quick Test Scenarios */}
          <div>
            <Label className="text-base font-semibold">Cenários Rápidos</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mt-3">
              {QUICK_SCENARIOS.map((scenario, index) => (
                <Button
                  key={index}
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuickTest(scenario)}
                  disabled={isLoading || !user?.id}
                  className="justify-start h-auto p-3"
                >
                  <div className="text-left">
                    <div className="font-medium">{scenario.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {NOTIFICATION_TYPES.find(t => t.value === scenario.type)?.label}
                    </div>
                  </div>
                </Button>
              ))}
            </div>
          </div>

          <Separator />

          {/* Custom Notification Creator */}
          <div className="space-y-4">
            <Label className="text-base font-semibold">Criador Personalizado</Label>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="type">Tipo de Notificação</Label>
                  <Select value={selectedType} onValueChange={setSelectedType}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um tipo..." />
                    </SelectTrigger>
                    <SelectContent>
                      {NOTIFICATION_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          <div className="flex items-center gap-2">
                            {type.label}
                            <Badge variant={
                              type.priority === 'high' ? 'destructive' :
                              type.priority === 'medium' ? 'default' : 'secondary'
                            } className="text-xs">
                              {type.priority}
                            </Badge>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="ticketNumber">Número do Chamado</Label>
                    <Input
                      id="ticketNumber"
                      value={ticketNumber}
                      onChange={(e) => setTicketNumber(e.target.value)}
                      placeholder="TK-2024-001"
                    />
                  </div>
                  <div>
                    <Label htmlFor="agentName">Nome do Agente</Label>
                    <Input
                      id="agentName"
                      value={agentName}
                      onChange={(e) => setAgentName(e.target.value)}
                      placeholder="João Silva"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="customTitle">Título Personalizado (opcional)</Label>
                  <Input
                    id="customTitle"
                    value={customTitle}
                    onChange={(e) => setCustomTitle(e.target.value)}
                    placeholder="Deixe vazio para usar mensagem automática"
                  />
                </div>

                <div>
                  <Label htmlFor="customMessage">Mensagem Personalizada (opcional)</Label>
                  <Textarea
                    id="customMessage"
                    value={customMessage}
                    onChange={(e) => setCustomMessage(e.target.value)}
                    placeholder="Deixe vazio para usar mensagem automática"
                    rows={3}
                  />
                </div>

                <Button 
                  onClick={handleCustomTest}
                  disabled={isLoading || !selectedType || !user?.id}
                  className="w-full"
                >
                  {isLoading ? 'Criando...' : 'Criar Notificação'}
                </Button>
              </div>

              {/* Live Preview */}
              <div className="space-y-4">
                <Label className="text-base font-semibold">Pré-visualização</Label>
                {preview ? (
                  <Card className="border-2 border-dashed">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="text-2xl">{preview.icon}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-semibold text-sm">{preview.title}</h4>
                            <Badge variant={
                              preview.priority === 'high' ? 'destructive' :
                              preview.priority === 'medium' ? 'default' : 'secondary'
                            } className="text-xs">
                              {preview.priority}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground leading-relaxed">
                            {preview.message}
                          </p>
                          <div className="text-xs text-muted-foreground mt-2">
                            Agora • Para: {user?.name || 'Usuário'}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <Card className="border-2 border-dashed border-muted">
                    <CardContent className="p-8 text-center text-muted-foreground">
                      Selecione um tipo de notificação para ver a pré-visualização
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </div>

          {/* Result Display */}
          {lastResult && (
            <div className="p-4 rounded-lg bg-muted">
              <div className="font-medium text-sm">{lastResult}</div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}