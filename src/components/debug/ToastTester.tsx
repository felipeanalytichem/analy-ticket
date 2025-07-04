import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { NotificationService } from '@/lib/notificationService';

export function ToastTester() {
  const { userProfile } = useAuth();
  const [testTicketTitle, setTestTicketTitle] = useState('Test Ticket for Notifications');
  const [isCreating, setIsCreating] = useState(false);

  const testSonnerToast = () => {
    console.log('🍞 Testing Sonner toast...');
    toast.success('✅ Sonner Toast System Working!', {
      description: 'This is a Sonner toast notification with action.',
      action: {
        label: 'Action',
        onClick: () => toast.info('Action clicked!')
      }
    });
  };

  const testErrorToast = () => {
    toast.error('❌ Error Toast Test', {
      description: 'This is an error notification example.'
    });
  };

  const testWarningToast = () => {
    toast.warning('⚠️ Warning Toast Test', {
      description: 'This is a warning notification example.'
    });
  };

  const testInfoToast = () => {
    toast.info('ℹ️ Info Toast Test', {
      description: 'This is an info notification example.'
    });
  };

  const testNotificationCreation = async () => {
    if (!userProfile?.id) {
      toast.error('Você precisa estar logado para testar notificações');
      return;
    }

    setIsCreating(true);
    try {
      // Create a test notification directly
      const success = await NotificationService.createTicketCreatedNotification('test-ticket-id', {
        ticketNumber: 'TKT-TEST-001',
        ticketTitle: testTicketTitle,
        userName: userProfile.full_name || 'Usuário de Teste'
      });

      if (success) {
        toast.success('🎫 Notificação de teste criada!', {
          description: 'Verifique o sininho de notificações para ver a nova notificação.'
        });
      } else {
        toast.error('Falha ao criar notificação de teste');
      }
    } catch (error) {
      console.error('Error creating test notification:', error);
      toast.error('Erro ao criar notificação de teste');
    } finally {
      setIsCreating(false);
    }
  };

  const testCommentNotification = async () => {
    if (!userProfile?.id) {
      toast.error('Você precisa estar logado para testar notificações');
      return;
    }

    setIsCreating(true);
    try {
      const success = await NotificationService.createCommentNotification('test-ticket-id', {
        userName: userProfile.full_name || 'Usuário de Teste'
      });

      if (success) {
        toast.success('💬 Notificação de comentário criada!');
      } else {
        toast.error('Falha ao criar notificação de comentário');
      }
    } catch (error) {
      console.error('Error creating comment notification:', error);
      toast.error('Erro ao criar notificação de comentário');
    } finally {
      setIsCreating(false);
    }
  };

  const testAssignmentNotification = async () => {
    if (!userProfile?.id) {
      toast.error('Você precisa estar logado para testar notificações');
      return;
    }

    setIsCreating(true);
    try {
      const success = await NotificationService.createTicketAssignedNotification(
        'test-ticket-id',
        userProfile.id,
        {
          ticketNumber: 'TKT-TEST-ASSIGN',
          ticketTitle: 'Ticket de Teste para Atribuição'
        }
      );

      if (success) {
        toast.success('👤 Notificação de atribuição criada!');
      } else {
        toast.error('Falha ao criar notificação de atribuição');
      }
    } catch (error) {
      console.error('Error creating assignment notification:', error);
      toast.error('Erro ao criar notificação de atribuição');
    } finally {
      setIsCreating(false);
    }
  };

  const testStatusNotification = async () => {
    if (!userProfile?.id) {
      toast.error('Você precisa estar logado para testar notificações');
      return;
    }

    setIsCreating(true);
    try {
      const success = await NotificationService.createTicketStatusNotification(
        'test-ticket-id',
        userProfile.id,
        {
          ticketNumber: 'TKT-TEST-STATUS',
          ticketTitle: 'Ticket de Teste para Mudança de Status',
          oldStatus: 'open',
          newStatus: 'resolved'
        }
      );

      if (success) {
        toast.success('🔄 Notificação de status criada!');
      } else {
        toast.error('Falha ao criar notificação de status');
      }
    } catch (error) {
      console.error('Error creating status notification:', error);
      toast.error('Erro ao criar notificação de status');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* User Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            🔔 Testador do Sistema de Notificações
            <Badge variant="outline">Sonner Toast System</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {userProfile ? (
            <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg space-y-2">
              <div className="text-sm">
                <strong>Usuário:</strong> {userProfile.full_name} ({userProfile.email})
              </div>
              <div className="text-sm flex items-center gap-2">
                <strong>Role:</strong> <Badge variant="secondary">{userProfile.role}</Badge>
              </div>
            </div>
          ) : (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
              <div className="text-sm text-red-600">Usuário não logado</div>
            </div>
          )}

          <div>
            <Label htmlFor="testTicketTitle">Título do Ticket de Teste</Label>
            <Input
              id="testTicketTitle"
              value={testTicketTitle}
              onChange={(e) => setTestTicketTitle(e.target.value)}
              placeholder="Digite o título do ticket para teste"
            />
          </div>
        </CardContent>
      </Card>

      {/* Toast Tests */}
      <Card>
        <CardHeader>
          <CardTitle>🍞 Testes de Toast</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={testSonnerToast} variant="default">
              ✅ Test Success Toast
            </Button>
            <Button onClick={testErrorToast} variant="destructive">
              ❌ Test Error Toast
            </Button>
            <Button onClick={testWarningToast} variant="secondary">
              ⚠️ Test Warning Toast
            </Button>
            <Button onClick={testInfoToast} variant="outline">
              ℹ️ Test Info Toast
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Notification Tests */}
      <Card>
        <CardHeader>
          <CardTitle>🎫 Testes de Notificações do Sistema</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2">
            <Button
              onClick={testNotificationCreation}
              disabled={isCreating || !userProfile}
              variant="default"
            >
              {isCreating ? 'Criando...' : '🎫 Test Ticket Created'}
            </Button>
            <Button
              onClick={testCommentNotification}
              disabled={isCreating || !userProfile}
              variant="secondary"
            >
              {isCreating ? 'Criando...' : '💬 Test Comment Added'}
            </Button>
            <Button
              onClick={testAssignmentNotification}
              disabled={isCreating || !userProfile}
              variant="outline"
            >
              {isCreating ? 'Criando...' : '👤 Test Ticket Assigned'}
            </Button>
            <Button
              onClick={testStatusNotification}
              disabled={isCreating || !userProfile}
              variant="outline"
            >
              {isCreating ? 'Criando...' : '🔄 Test Status Changed'}
            </Button>
          </div>
          
          {!userProfile && (
            <p className="text-sm text-muted-foreground mt-2">
              Faça login para testar as notificações do sistema
            </p>
          )}
        </CardContent>
      </Card>

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>📋 Instruções</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <p><strong>1.</strong> Teste os toasts básicos para verificar se o Sonner está funcionando</p>
            <p><strong>2.</strong> Teste as notificações do sistema (requer login)</p>
            <p><strong>3.</strong> Verifique o sininho de notificações 🔔 no topo da página</p>
            <p><strong>4.</strong> As notificações devem aparecer como toasts E no sininho</p>
            <p><strong>5.</strong> Teste a navegação clicando nas notificações</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 