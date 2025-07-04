import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { NotificationService } from '@/lib/notificationService';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';

export const NotificationDemo: React.FC = () => {
  const { userProfile } = useAuth();
  const { toast } = useToast();
  const [content, setContent] = useState('');
  const [type, setType] = useState('ticket_created');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [isLoading, setIsLoading] = useState(false);

  const handleCreateNotification = async () => {
    if (!userProfile?.id) return;
    
    setIsLoading(true);
    try {
      // Use smart notification with sample context
      const success = await NotificationService.createSmartNotification(
        userProfile.id,
        type,
        undefined, // no specific ticket
        {
          ticketNumber: 'TKT-' + Date.now(),
          ticketTitle: content || 'Chamado de Demonstração',
          userName: userProfile.full_name,
          agentName: 'Agente Demonstração',
          newStatus: type === 'status_changed' ? 'resolved' : undefined,
          rating: type === 'feedback_received' ? 5 : undefined,
          satisfaction: type === 'feedback_received' ? 'satisfied' : undefined
        }
      );

      if (success) {
        toast({
          title: "Sucesso",
          description: "Notificação criada com sucesso!",
        });
        setContent('');
      } else {
        toast({
          title: "Erro",
          description: "Falha ao criar notificação",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error creating notification:', error);
      toast({
        title: "Erro",
        description: "Erro inesperado ao criar notificação",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const createScenarioNotification = async (scenario: string) => {
    if (!userProfile?.id) return;
    
    setIsLoading(true);
    try {
      let notificationType = '';
      let context = {};

      switch (scenario) {
        case 'new_ticket':
          notificationType = 'ticket_created';
          context = {
            ticketNumber: 'TKT-' + Date.now(),
            ticketTitle: 'Problema com Sistema de Login',
            userName: 'João Silva'
          };
          break;
        case 'ticket_resolved':
          notificationType = 'status_changed';
          context = {
            ticketNumber: 'TKT-' + Date.now(),
            ticketTitle: 'Erro na Impressão de Relatórios',
            newStatus: 'resolved',
            agentName: 'Maria Santos'
          };
          break;
        case 'urgent_response':
          notificationType = 'comment_added';
          context = {
            ticketNumber: 'TKT-' + Date.now(),
            ticketTitle: 'Sistema Fora do Ar - URGENTE',
            userName: 'Carlos Oliveira'
          };
          break;
        case 'feedback_request':
          notificationType = 'feedback_request';
          context = {
            ticketNumber: 'TKT-' + Date.now(),
            ticketTitle: 'Configuração de Email'
          };
          break;
        case 'sla_warning':
          notificationType = 'sla_warning';
          context = {
            ticketNumber: 'TKT-' + Date.now(),
            ticketTitle: 'Lentidão no Sistema'
          };
          break;
      }

      const success = await NotificationService.createSmartNotification(
        userProfile.id,
        notificationType,
        undefined,
        context
      );

      if (success) {
        toast({
          title: "Cenário Criado",
          description: `Notificação de ${scenario} criada com sucesso!`,
        });
      }
    } catch (error) {
      console.error('Error creating scenario notification:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const notificationTypes = [
    { 
      value: 'ticket_created', 
      label: '🎫 Ticket Criado', 
      description: 'Novo chamado foi criado no sistema',
      priority: 'medium'
    },
    { 
      value: 'ticket_assigned', 
      label: '👤 Ticket Atribuído', 
      description: 'Chamado foi atribuído a um agente',
      priority: 'medium'
    },
    { 
      value: 'comment_added', 
      label: '💬 Comentário Adicionado', 
      description: 'Nova resposta foi adicionada ao chamado',
      priority: 'medium'
    },
    { 
      value: 'status_changed', 
      label: '🔄 Status Alterado', 
      description: 'Status do chamado foi modificado',
      priority: 'medium'
    },
    { 
      value: 'priority_changed', 
      label: '⚡ Prioridade Alterada', 
      description: 'Prioridade do chamado foi alterada',
      priority: 'low'
    },
    { 
      value: 'feedback_request', 
      label: '⭐ Solicitação de Avaliação', 
      description: 'Pedido para avaliar o atendimento',
      priority: 'low'
    },
    { 
      value: 'feedback_received', 
      label: '📊 Avaliação Recebida', 
      description: 'Nova avaliação foi enviada',
      priority: 'low'
    },
    { 
      value: 'sla_warning', 
      label: '⚠️ Aviso de SLA', 
      description: 'Prazo de SLA próximo do vencimento',
      priority: 'high'
    },
    { 
      value: 'sla_breach', 
      label: '🚨 SLA Violado', 
      description: 'Prazo de SLA foi ultrapassado',
      priority: 'high'
    }
  ];

  const scenarios = [
    {
      id: 'new_ticket',
      title: '🎫 Novo Chamado',
      description: 'Cliente criou um novo chamado',
      color: 'bg-blue-100 text-blue-800'
    },
    {
      id: 'ticket_resolved',
      title: '✅ Chamado Resolvido',
      description: 'Agente resolveu um chamado',
      color: 'bg-green-100 text-green-800'
    },
    {
      id: 'urgent_response',
      title: '💬 Resposta Urgente',
      description: 'Cliente respondeu em chamado urgente',
      color: 'bg-orange-100 text-orange-800'
    },
    {
      id: 'feedback_request',
      title: '⭐ Solicitar Avaliação',
      description: 'Pedir feedback do cliente',
      color: 'bg-purple-100 text-purple-800'
    },
    {
      id: 'sla_warning',
      title: '⚠️ Aviso de SLA',
      description: 'Prazo próximo do vencimento',
      color: 'bg-red-100 text-red-800'
    }
  ];

  if (!userProfile) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-center text-gray-500">Faça login para testar notificações</p>
        </CardContent>
      </Card>
    );
  }

  const selectedTypeInfo = notificationTypes.find(t => t.value === type);

  return (
    <div className="space-y-6">
      {/* Cenários Pré-definidos */}
      <Card>
        <CardHeader>
          <CardTitle>🎭 Cenários de Demonstração</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {scenarios.map((scenario) => (
              <Button
                key={scenario.id}
                onClick={() => createScenarioNotification(scenario.id)}
                disabled={isLoading}
                variant="outline"
                className="h-auto p-4 flex flex-col items-start text-left"
              >
                <div className="flex items-center justify-between w-full mb-2">
                  <span className="font-medium">{scenario.title}</span>
                  <Badge className={scenario.color} variant="secondary">
                    Demo
                  </Badge>
                </div>
                <span className="text-xs text-gray-500">{scenario.description}</span>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Criador Personalizado */}
      <Card>
        <CardHeader>
          <CardTitle>🛠️ Criar Notificação Personalizada</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="type">Tipo de Notificação</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {notificationTypes.map((notType) => (
                  <SelectItem key={notType.value} value={notType.value}>
                    <div className="flex flex-col">
                      <span>{notType.label}</span>
                      <span className="text-xs text-gray-500">{notType.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="priority">Prioridade</Label>
            <Select value={priority} onValueChange={(value: 'low' | 'medium' | 'high') => setPriority(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">
                  <span className="text-gray-600">🔵 Baixa</span>
                </SelectItem>
                <SelectItem value="medium">
                  <span className="text-blue-600">🟡 Média</span>
                </SelectItem>
                <SelectItem value="high">
                  <span className="text-red-600">🔴 Alta</span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="content">Título do Chamado (opcional)</Label>
            <Textarea
              id="content"
              placeholder="Digite o título do chamado para contextualizar a notificação..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={2}
            />
            <p className="text-xs text-gray-500">
              Se deixado vazio, será usado um título padrão baseado no tipo selecionado.
            </p>
          </div>

          <Button
            onClick={handleCreateNotification}
            disabled={isLoading}
            className="w-full"
          >
            {isLoading ? 'Criando...' : 'Criar Notificação'}
          </Button>
        </CardContent>
      </Card>

      {/* Prévia */}
      <Card>
        <CardHeader>
          <CardTitle>👁️ Prévia da Notificação</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg p-4 bg-blue-50 border-blue-200">
            <div className="flex items-start gap-3">
              <span className="text-2xl">
                {NotificationService.getNotificationIcon(type)}
              </span>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-medium text-gray-900">
                    {NotificationService.generateNotificationMessage(type, {
                      ticketNumber: 'TKT-123456',
                      ticketTitle: content || 'Exemplo de Chamado',
                      userName: userProfile.full_name,
                      agentName: 'Agente Exemplo',
                      newStatus: type === 'status_changed' ? 'resolved' : undefined
                    }).title}
                  </h4>
                  <Badge 
                    variant="secondary" 
                    className={`text-xs ${
                      priority === 'high' ? 'bg-red-100 text-red-700' :
                      priority === 'medium' ? 'bg-blue-100 text-blue-700' :
                      'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {priority === 'high' ? 'Alta' : priority === 'medium' ? 'Média' : 'Baixa'}
                  </Badge>
                </div>
                <p className="text-sm text-gray-600 mb-2">
                  {NotificationService.generateNotificationMessage(type, {
                    ticketNumber: 'TKT-123456',
                    ticketTitle: content || 'Exemplo de Chamado',
                    userName: userProfile.full_name,
                    agentName: 'Agente Exemplo',
                    newStatus: type === 'status_changed' ? 'resolved' : undefined
                  }).message}
                </p>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span>• Agora</span>
                  <span>• {selectedTypeInfo?.description}</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Informações */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <span className="text-blue-600 text-lg">ℹ️</span>
            <div className="space-y-2">
              <h4 className="font-medium text-blue-900">Como funciona:</h4>
              <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                <li>As notificações são geradas automaticamente com mensagens contextualizadas</li>
                <li>Cada tipo de notificação tem uma mensagem específica e apropriada</li>
                <li>As mensagens incluem informações relevantes como número do chamado e nomes</li>
                <li>A prioridade afeta a cor e urgência da notificação</li>
                <li>As notificações aparecem em tempo real no sino de notificações</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};