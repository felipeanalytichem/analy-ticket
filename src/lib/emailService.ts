import { supabase } from '@/integrations/supabase/client';

export interface EmailTemplate {
  subject: string;
  htmlContent: string;
  textContent?: string;
}

export interface EmailData {
  to: string;
  subject: string;
  htmlContent: string;
  textContent?: string;
  templateData?: Record<string, any>;
}

export class EmailService {
  private static readonly BASE_URL = window.location.origin;

  /**
   * Sends email using Supabase Edge Function
   * Edge Function is working and processing email requests correctly
   */
  static async sendEmail(emailData: EmailData): Promise<{ success: boolean; error?: string }> {
    try {
      // Validate input data
      if (!emailData.to || !emailData.subject || !emailData.htmlContent) {
        console.error('❌ Missing required email data:', { 
          to: !!emailData.to, 
          subject: !!emailData.subject, 
          htmlContent: !!emailData.htmlContent 
        });
        return { 
          success: false, 
          error: 'Missing required email data: to, subject, or htmlContent' 
        };
      }

      // Check if we're in development mode
      const isDevelopment = process.env.NODE_ENV === 'development' || window.location.hostname === 'localhost';
      
      console.log('📧 Sending email via Edge Function:');
      console.log('To:', emailData.to);
      console.log('Subject:', emailData.subject);
      console.log('Content length:', emailData.htmlContent.length);
      
      if (isDevelopment) {
        console.log('Content preview:', emailData.htmlContent.substring(0, 100) + '...');
      }

      // Create a timeout promise
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Email function timeout after 30 seconds')), 30000);
      });

      // Call the Supabase Edge Function with timeout protection
      const functionPromise = supabase.functions.invoke('send-email', {
        body: {
          to: emailData.to,
          subject: emailData.subject,
          html: emailData.htmlContent,
          text: emailData.textContent || undefined
        },
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const { data, error } = await Promise.race([functionPromise, timeoutPromise]) as any;

      if (error) {
        console.error('❌ Error calling Edge Function:', error);
        return { 
          success: false, 
          error: `Edge Function error: ${error.message || error}` 
        };
      }

      // Handle successful response
      if (data && data.success) {
        console.log('✅ Email processed successfully via Edge Function');
        console.log('Response:', data.message || 'Email sent');
        return { success: true };
      } 
      
      // Handle error response from function
      if (data && data.error) {
        console.error('❌ Edge Function returned error:', data);
        return { 
          success: false, 
          error: data.error || 'Unknown error from Edge Function' 
        };
      }

      // Handle unexpected response format
      console.warn('⚠️ Unexpected response format:', data);
      return { 
        success: false, 
        error: 'Unexpected response format from Edge Function' 
      };
      
    } catch (error) {
      console.error('❌ Unexpected error calling Edge Function:', error);
      
      // Check for specific error types
      if (error instanceof Error) {
        if (error.message.includes('timeout')) {
          return { 
            success: false, 
            error: 'Email service timeout - please try again' 
          };
        }
        return { 
          success: false, 
          error: error.message 
        };
      }
      
      return { 
        success: false, 
        error: 'Unknown error occurred while sending email' 
      };
    }
  }

  /**
   * Envia convite de acesso usando magic link do Supabase
   * Esta é a abordagem recomendada usando as funcionalidades nativas
   */
  static async sendUserInvitationMagicLink(userEmail: string, userName: string) {
    try {
      console.log('🔗 Enviando magic link para:', userEmail);
      
      // Usa o sistema de magic link do Supabase
      const { data, error } = await supabase.auth.signInWithOtp({
        email: userEmail,
        options: {
          emailRedirectTo: `${this.BASE_URL}/dashboard`,
          data: {
            full_name: userName,
            invitation: true
          }
        }
      });

      if (error) {
        console.error('❌ Error sending magic link:', error);
        return { success: false, error: error.message };
      }

      console.log('✅ Magic link sent successfully:', data);
      return { success: true };
    } catch (error) {
      console.error('❌ Unexpected error sending magic link:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Envia email de convite para registro de usuário (versão completa)
   */
  static async sendUserInvitation(userEmail: string, userName: string, temporaryPassword?: string) {
    const registrationLink = `${this.BASE_URL}/register`;
    
    const template = this.getUserInvitationTemplate({
      userName,
      userEmail,
      registrationLink,
      temporaryPassword,
      supportEmail: 'suporte@analytichem.com',
      companyName: 'AnalytiChem'
    });

    return this.sendEmail({
      to: userEmail,
      subject: template.subject,
      htmlContent: template.htmlContent,
      textContent: template.textContent,
      templateData: {
        userName,
        userEmail,
        registrationLink,
        temporaryPassword
      }
    });
  }

  /**
   * Cria uma notificação interna no sistema como alternativa ao email
   */
  static async createInvitationNotification(userEmail: string, userName: string, temporaryPassword?: string) {
    try {
      // Busca o usuário pelo email
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('email', userEmail)
        .single();

      if (userError || !user) {
        console.warn('⚠️ User not found for notification:', userEmail);
        return { success: false, error: 'User not found' };
      }

      // Cria notificação de convite
      const notificationMessage = temporaryPassword 
        ? `Bem-vindo ${userName}! Sua conta foi criada com senha temporária. Acesse o sistema para alterar sua senha.`
        : `Bem-vindo ${userName}! Sua conta foi criada. Complete seu registro no sistema.`;

      const { error: notificationError } = await supabase
        .from('notifications')
        .insert([{
          user_id: user.id,
          title: 'Bem-vindo ao Sistema de Chamados',
          message: notificationMessage,
          type: 'ticket_created', // Usando tipo existente
          priority: 'high',
          read: false
        }]);

      if (notificationError) {
        console.error('❌ Error creating notification:', notificationError);
        return { success: false, error: notificationError.message };
      }

      console.log('✅ Invitation notification created for:', userEmail);
      return { success: true };
    } catch (error) {
      console.error('❌ Error creating invitation notification:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Envia notificação de novo chamado para agentes
   */
  static async sendNewTicketNotification(
    agentEmail: string, 
    agentName: string, 
    ticketNumber: string, 
    ticketTitle: string,
    userEmail: string,
    priority: string
  ) {
    const ticketLink = `${this.BASE_URL}/ticket/${ticketNumber}`;
    
    const template = this.getNewTicketTemplate({
      agentName,
      ticketNumber,
      ticketTitle,
      userEmail,
      priority,
      ticketLink,
      companyName: 'AnalytiChem'
    });

    return this.sendEmail({
      to: agentEmail,
      subject: template.subject,
      htmlContent: template.htmlContent,
      textContent: template.textContent
    });
  }

  /**
   * Envia notificação de atualização de chamado
   */
  static async sendTicketUpdateNotification(
    userEmail: string,
    userName: string,
    ticketNumber: string,
    ticketTitle: string,
    updateMessage: string,
    agentName: string
  ) {
    const ticketLink = `${this.BASE_URL}/ticket/${ticketNumber}`;
    
    const template = this.getTicketUpdateTemplate({
      userName,
      ticketNumber,
      ticketTitle,
      updateMessage,
      agentName,
      ticketLink,
      companyName: 'AnalytiChem'
    });

    return this.sendEmail({
      to: userEmail,
      subject: template.subject,
      htmlContent: template.htmlContent,
      textContent: template.textContent
    });
  }

  /**
   * Template para convite de usuário
   */
  private static getUserInvitationTemplate(data: {
    userName: string;
    userEmail: string;
    registrationLink: string;
    temporaryPassword?: string;
    supportEmail: string;
    companyName: string;
  }): EmailTemplate {
    const subject = `Bem-vindo ao Sistema de Chamados - ${data.companyName}`;
    
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>${subject}</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; }
          .container { max-width: 600px; margin: 0 auto; background: #fff; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          .header { background: #1e40af; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center; }
          .content { padding: 30px; }
          .button { display: inline-block; background: #1e40af; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .password-box { background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 5px; padding: 15px; margin: 15px 0; font-family: monospace; }
          .footer { background: #f8f9fa; padding: 20px; border-radius: 0 0 8px 8px; text-align: center; font-size: 12px; color: #666; }
          .warning { background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 5px; padding: 15px; margin: 15px 0; }
          .info-box { background: #e1f5fe; border: 1px solid #01579b; border-radius: 5px; padding: 15px; margin: 15px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Conta Criada com Sucesso!</h1>
            <p>Sistema de Gestão de Chamados</p>
          </div>
          
          <div class="content">
            <p>Olá <strong>${data.userName}</strong>,</p>
            
            <p>Sua conta foi criada no Sistema de Gestão de Chamados da <strong>${data.companyName}</strong>!</p>
            
            <div class="info-box">
              <h3>📋 Informações da sua conta:</h3>
              <ul>
                <li><strong>Email:</strong> ${data.userEmail}</li>
                <li><strong>Nome:</strong> ${data.userName}</li>
                <li><strong>Sistema:</strong> <a href="${data.registrationLink}">${data.registrationLink}</a></li>
              </ul>
            </div>
            
            ${data.temporaryPassword ? `
              <div class="warning">
                <h3>🔑 Senha Temporária Gerada</h3>
                <p>Uma senha temporária foi gerada para facilitar seu primeiro acesso:</p>
                <div class="password-box">
                  <strong>Senha:</strong> ${data.temporaryPassword}
                </div>
                <p><small>⚠️ Esta senha é temporária e deve ser alterada no primeiro login.</small></p>
              </div>
            ` : `
              <div class="info-box">
                <h3>🔐 Primeiro Acesso</h3>
                <p>Para acessar o sistema pela primeira vez:</p>
                <ol>
                  <li>Clique no link abaixo</li>
                  <li>Use seu email: <code>${data.userEmail}</code></li>
                  <li>Crie uma senha forte</li>
                  <li>Complete seu perfil</li>
                </ol>
              </div>
            `}
            
            <h3>🚀 Como começar:</h3>
            <ol>
              <li><strong>Acesse o sistema</strong> clicando no botão abaixo</li>
              <li><strong>Faça login</strong> com seu email e senha</li>
              <li><strong>Explore o dashboard</strong> e suas funcionalidades</li>
              <li><strong>Crie seu primeiro chamado</strong> se necessário</li>
            </ol>
            
            <div style="text-align: center;">
              <a href="${data.registrationLink}" class="button">🔗 Acessar Sistema de Chamados</a>
            </div>
            
            <h3>📞 Precisa de ajuda?</h3>
            <p>Nossa equipe de suporte está disponível para ajudá-lo:</p>
            <ul>
              <li>📧 <strong>Email:</strong> ${data.supportEmail}</li>
              <li>🏢 <strong>Suporte interno:</strong> Ramal 1234</li>
              <li>⏰ <strong>Horário:</strong> Segunda a Sexta, 8h às 18h</li>
            </ul>
            
            <div class="info-box">
              <h3>💡 Dicas importantes:</h3>
              <ul>
                <li>Mantenha suas informações de contato atualizadas</li>
                <li>Use senhas fortes e únicas</li>
                <li>Categorize seus chamados corretamente</li>
                <li>Acompanhe o status dos seus chamados</li>
              </ul>
            </div>
          </div>
          
          <div class="footer">
            <p>Este email foi enviado automaticamente pelo Sistema de Gestão de Chamados da ${data.companyName}.</p>
            <p>Se você não solicitou esta conta, entre em contato com o suporte.</p>
            <p>© 2024 ${data.companyName} - Todos os direitos reservados</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const textContent = `
Bem-vindo ao Sistema de Chamados - ${data.companyName}

Olá ${data.userName},

Sua conta foi criada com sucesso!

Informações da conta:
- Email: ${data.userEmail}
- Nome: ${data.userName}
- Link do sistema: ${data.registrationLink}

${data.temporaryPassword ? `
SENHA TEMPORÁRIA: ${data.temporaryPassword}
(Esta senha deve ser alterada no primeiro login)
` : ''}

Como começar:
1. Acesse: ${data.registrationLink}
2. Faça login com seu email: ${data.userEmail}
${data.temporaryPassword ? '3. Use a senha temporária fornecida' : '3. Crie uma senha forte'}
4. Complete seu perfil
5. Explore o sistema e suas funcionalidades

Suporte:
- Email: ${data.supportEmail}
- Ramal: 1234
- Horário: Segunda a Sexta, 8h às 18h

---
${data.companyName} - Sistema de Gestão de Chamados
Este email foi enviado automaticamente.
    `;

    return { subject, htmlContent, textContent };
  }

  /**
   * Template para novo chamado
   */
  private static getNewTicketTemplate(data: {
    agentName: string;
    ticketNumber: string;
    ticketTitle: string;
    userEmail: string;
    priority: string;
    ticketLink: string;
    companyName: string;
  }): EmailTemplate {
    const priorityColor = {
      'urgent': '#dc2626',
      'high': '#ea580c',
      'medium': '#ca8a04',
      'low': '#16a34a'
    }[data.priority.toLowerCase()] || '#6b7280';

    const subject = `🎫 Novo Chamado: ${data.ticketNumber} - ${data.ticketTitle}`;
    
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>${subject}</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; }
          .container { max-width: 600px; margin: 0 auto; background: #fff; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          .header { background: #1e40af; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center; }
          .content { padding: 30px; }
          .ticket-info { background: #f8f9fa; border-radius: 5px; padding: 15px; margin: 15px 0; }
          .priority { color: ${priorityColor}; font-weight: bold; }
          .button { display: inline-block; background: #1e40af; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { background: #f8f9fa; padding: 20px; border-radius: 0 0 8px 8px; text-align: center; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎫 Novo Chamado Atribuído</h1>
            <p>Sistema de Gestão de Chamados</p>
          </div>
          
          <div class="content">
            <p>Olá <strong>${data.agentName}</strong>,</p>
            
            <p>Um novo chamado foi atribuído a você:</p>
            
            <div class="ticket-info">
              <h3>📋 Detalhes do Chamado</h3>
              <ul>
                <li><strong>Número:</strong> ${data.ticketNumber}</li>
                <li><strong>Título:</strong> ${data.ticketTitle}</li>
                <li><strong>Usuário:</strong> ${data.userEmail}</li>
                <li><strong>Prioridade:</strong> <span class="priority">${data.priority.toUpperCase()}</span></li>
              </ul>
            </div>
            
            <p>Clique no botão abaixo para visualizar e começar o atendimento:</p>
            
            <div style="text-align: center;">
              <a href="${data.ticketLink}" class="button">🔍 Ver Chamado</a>
            </div>
          </div>
          
          <div class="footer">
            <p>Sistema de Gestão de Chamados - ${data.companyName}</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const textContent = `
Novo Chamado Atribuído - ${data.companyName}

Olá ${data.agentName},

Um novo chamado foi atribuído a você:

Detalhes:
- Número: ${data.ticketNumber}
- Título: ${data.ticketTitle}
- Usuário: ${data.userEmail}
- Prioridade: ${data.priority.toUpperCase()}

Link: ${data.ticketLink}

---
Sistema de Gestão de Chamados - ${data.companyName}
    `;

    return { subject, htmlContent, textContent };
  }

  /**
   * Template para atualização de chamado
   */
  private static getTicketUpdateTemplate(data: {
    userName: string;
    ticketNumber: string;
    ticketTitle: string;
    updateMessage: string;
    agentName: string;
    ticketLink: string;
    companyName: string;
  }): EmailTemplate {
    const subject = `📬 Atualização do Chamado ${data.ticketNumber}`;
    
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>${subject}</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; }
          .container { max-width: 600px; margin: 0 auto; background: #fff; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          .header { background: #1e40af; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center; }
          .content { padding: 30px; }
          .update-box { background: #e0f2fe; border-left: 4px solid #0284c7; padding: 15px; margin: 15px 0; }
          .button { display: inline-block; background: #1e40af; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { background: #f8f9fa; padding: 20px; border-radius: 0 0 8px 8px; text-align: center; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📬 Chamado Atualizado</h1>
            <p>Sistema de Gestão de Chamados</p>
          </div>
          
          <div class="content">
            <p>Olá <strong>${data.userName}</strong>,</p>
            
            <p>Seu chamado <strong>${data.ticketNumber}</strong> foi atualizado:</p>
            <p><strong>Título:</strong> ${data.ticketTitle}</p>
            
            <div class="update-box">
              <h3>💬 Nova Mensagem do Agente ${data.agentName}:</h3>
              <p>${data.updateMessage}</p>
            </div>
            
            <p>Clique no botão abaixo para ver todos os detalhes:</p>
            
            <div style="text-align: center;">
              <a href="${data.ticketLink}" class="button">🔍 Ver Chamado</a>
            </div>
          </div>
          
          <div class="footer">
            <p>Sistema de Gestão de Chamados - ${data.companyName}</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const textContent = `
Chamado Atualizado - ${data.companyName}

Olá ${data.userName},

Seu chamado ${data.ticketNumber} foi atualizado.
Título: ${data.ticketTitle}

Nova mensagem do agente ${data.agentName}:
${data.updateMessage}

Link: ${data.ticketLink}

---
Sistema de Gestão de Chamados - ${data.companyName}
    `;

    return { subject, htmlContent, textContent };
  }
} 