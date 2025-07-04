import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { useNotifications } from '@/hooks/useNotifications';
import { NotificationService } from '@/lib/notificationService';
import DatabaseService from '@/lib/database';
import { toast } from 'sonner';
import { 
  Bell, 
  TestTube, 
  RefreshCw, 
  MessageSquare, 
  User, 
  CheckCircle,
  AlertCircle,
  Info
} from 'lucide-react';

export const NotificationDebugger: React.FC = () => {
  const { userProfile } = useAuth();
  const { notifications, unreadCount, loading, markAsRead, markAllAsRead, refresh } = useNotifications();
  
  const [testMessage, setTestMessage] = useState('');
  const [testTicketId, setTestTicketId] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [debugInfo, setDebugInfo] = useState<any[]>([]);

  // Test creating a notification
  const createTestNotification = async () => {
    if (!userProfile || !testMessage.trim()) {
      toast.error('Por favor, preencha a mensagem de teste');
      return;
    }

    setIsCreating(true);
    try {
      const success = await NotificationService.createNotification(
        userProfile.id,
        'Teste de Notificação',
        testMessage.trim(),
        'general',
        'medium',
        testTicketId || undefined
      );

      if (success) {
        toast.success('Notificação de teste criada!');
        setTestMessage('');
        setTestTicketId('');
        
        // Refresh notifications
        setTimeout(() => {
          refresh();
        }, 1000);
      } else {
        toast.error('Erro ao criar notificação de teste');
      }
    } catch (error) {
      console.error('Error creating test notification:', error);
      toast.error('Erro ao criar notificação de teste');
    } finally {
      setIsCreating(false);
    }
  };

  // Test comment notification
  const createTestCommentNotification = async () => {
    if (!userProfile || !testTicketId.trim()) {
      toast.error('Por favor, forneça um ID de ticket');
      return;
    }

    setIsCreating(true);
    try {
      // Simulate adding a comment and creating notification
      await DatabaseService.createCommentNotification(testTicketId, userProfile.id);
      toast.success('Notificação de comentário criada!');
      
      // Refresh notifications
      setTimeout(() => {
        refresh();
      }, 1000);
    } catch (error) {
      console.error('Error creating comment notification:', error);
      toast.error('Erro ao criar notificação de comentário');
    } finally {
      setIsCreating(false);
    }
  };

  // Test marking as read
  const testMarkAsRead = async (notificationId: string) => {
    try {
      const success = await markAsRead(notificationId);
      if (success) {
        toast.success('Notificação marcada como lida!');
      } else {
        toast.error('Erro ao marcar como lida');
      }
    } catch (error) {
      console.error('Error marking as read:', error);
      toast.error('Erro ao marcar como lida');
    }
  };

  // Test agent response notification (simulating agent responding to user ticket)
  const testAgentResponseNotification = async () => {
    if (!userProfile) {
      toast.error('Usuário não autenticado');
      return;
    }

    setIsCreating(true);
    try {
      // Create a test ticket first (simulating user creating ticket)
      const testTicket = {
        title: 'Ticket de Teste para Notificação',
        description: 'Este é um ticket de teste para verificar notificações de resposta',
        priority: 'medium' as const,
        category_id: null,
        user_id: userProfile.id // User creates the ticket
      };

      console.log('🎫 Creating test ticket for notification test...');
      const createdTicket = await DatabaseService.createTicket(testTicket);
      
      if (createdTicket) {
        console.log('🎫 Test ticket created:', createdTicket.id);
        
        // Now simulate an agent (different user) adding a comment
        // For testing, we'll use the same user but simulate the notification creation
        console.log('💬 Simulating agent response notification...');
        
        // Create notification directly as if an agent responded
        const success = await NotificationService.createNotification(
          userProfile.id, // Notify the ticket creator (user)
          'Nova Resposta no seu Chamado',
          `Você recebeu uma nova resposta no chamado ${createdTicket.ticket_number || '#' + createdTicket.id.slice(-8)}. Clique para ver a resposta.`,
          'comment_added',
          'medium',
          createdTicket.id
        );

        if (success) {
          toast.success('Notificação de resposta de agente criada!');
          
          // Refresh notifications
          setTimeout(() => {
            refresh();
          }, 1000);
        } else {
          toast.error('Erro ao criar notificação de resposta');
        }
      } else {
        toast.error('Erro ao criar ticket de teste');
      }
    } catch (error) {
      console.error('Error creating agent response notification:', error);
      toast.error('Erro ao criar notificação de resposta');
    } finally {
      setIsCreating(false);
    }
  };

  // Collect debug information
  const collectDebugInfo = async () => {
    if (!userProfile) return;

    try {
      const info = [];
      
      // User info
      info.push({
        type: 'info',
        title: 'Informações do Usuário',
        data: {
          id: userProfile.id,
          email: userProfile.email,
          role: userProfile.role,
          full_name: userProfile.full_name
        }
      });

      // Notifications count
      info.push({
        type: 'info',
        title: 'Contadores de Notificação',
        data: {
          total: notifications.length,
          unread: unreadCount,
          loading: loading
        }
      });

      // Recent notifications
      const recentNotifications = notifications.slice(0, 5).map(n => ({
        id: n.id,
        title: n.title,
        message: n.message,
        type: n.type,
        read: n.read,
        created_at: n.created_at
      }));

      info.push({
        type: 'info',
        title: 'Notificações Recentes',
        data: recentNotifications
      });

      setDebugInfo(info);
    } catch (error) {
      console.error('Error collecting debug info:', error);
    }
  };

  useEffect(() => {
    collectDebugInfo();
  }, [notifications, unreadCount, loading, userProfile]);

  if (!userProfile) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-center text-gray-500">Usuário não autenticado</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TestTube className="h-5 w-5" />
            Debug de Notificações
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Test notification creation */}
          <div className="space-y-2">
            <Label>Criar Notificação de Teste</Label>
            <Textarea
              placeholder="Mensagem da notificação..."
              value={testMessage}
              onChange={(e) => setTestMessage(e.target.value)}
              className="min-h-20"
            />
            <Input
              placeholder="ID do Ticket (opcional)"
              value={testTicketId}
              onChange={(e) => setTestTicketId(e.target.value)}
            />
            <div className="flex gap-2">
              <Button 
                onClick={createTestNotification}
                disabled={isCreating || !testMessage.trim()}
                size="sm"
              >
                <Bell className="h-4 w-4 mr-2" />
                Criar Notificação
              </Button>
              <Button 
                onClick={createTestCommentNotification}
                disabled={isCreating || !testTicketId.trim()}
                variant="outline"
                size="sm"
              >
                <MessageSquare className="h-4 w-4 mr-2" />
                Simular Comentário
              </Button>
              <Button 
                onClick={testAgentResponseNotification}
                disabled={isCreating}
                variant="outline"
                size="sm"
              >
                <User className="h-4 w-4 mr-2" />
                Resposta Agente
              </Button>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-4 border-t">
            <Button onClick={refresh} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Atualizar
            </Button>
            <Button onClick={markAllAsRead} variant="outline" size="sm">
              <CheckCircle className="h-4 w-4 mr-2" />
              Marcar Todas como Lidas
            </Button>
            <Button onClick={collectDebugInfo} variant="outline" size="sm">
              <Info className="h-4 w-4 mr-2" />
              Coletar Info
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Current notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notificações Atuais ({notifications.length})
            {unreadCount > 0 && (
              <Badge variant="destructive">{unreadCount} não lidas</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center text-gray-500">Carregando...</p>
          ) : notifications.length === 0 ? (
            <p className="text-center text-gray-500">Nenhuma notificação encontrada</p>
          ) : (
            <div className="space-y-2">
              {notifications.slice(0, 10).map((notification) => (
                <div 
                  key={notification.id}
                  className={`p-3 rounded-lg border ${
                    !notification.read ? 'bg-blue-50 border-blue-200' : 'bg-gray-50'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">
                          {notification.title || 'Sem título'}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {notification.type}
                        </Badge>
                        {!notification.read && (
                          <Badge variant="destructive" className="text-xs">
                            Não lida
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mt-1">
                        {notification.message}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(notification.created_at).toLocaleString()}
                      </p>
                    </div>
                    {!notification.read && (
                      <Button
                        onClick={() => testMarkAsRead(notification.id)}
                        size="sm"
                        variant="outline"
                      >
                        Marcar como Lida
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Debug information */}
      {debugInfo.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Informações de Debug
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {debugInfo.map((info, index) => (
                <div key={index} className="p-3 bg-gray-50 rounded-lg">
                  <h4 className="font-medium text-sm mb-2">{info.title}</h4>
                  <pre className="text-xs bg-white p-2 rounded border overflow-auto">
                    {JSON.stringify(info.data, null, 2)}
                  </pre>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}; 