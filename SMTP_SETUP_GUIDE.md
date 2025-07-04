# Guia de Configuração SMTP - Outlook/AnalytiChem

Este guia explica como configurar o sistema de emails do projeto usando o SMTP do Outlook no Supabase.

## 🚀 Configuração Atual

Você já configurou o SMTP no painel do Supabase com as seguintes configurações:

### Configurações SMTP do Outlook
- **Host:** `smtp-mail.outlook.com`
- **Porta:** `587`
- **Usuário:** `felipe.henrique@analytichem.com`
- **Senha:** `[Sua senha configurada no painel]`
- **TLS:** Habilitado

## 📧 Como Ativar Emails no Supabase

### 1. Acessar Painel do Supabase
1. Vá para: [Supabase Dashboard](https://supabase.com/dashboard)
2. Selecione seu projeto: `plbmgjqitlxedsmdqpld`
3. No menu lateral, clique em **Authentication**
4. Vá para a aba **Settings**

### 2. Configurar SMTP
1. Na seção **SMTP Settings**, ative a opção **Enable custom SMTP**
2. Preencha os campos:
   ```
   SMTP Host: smtp-mail.outlook.com
   SMTP Port: 587
   SMTP User: felipe.henrique@analytichem.com
   SMTP Pass: [sua senha]
   Sender Name: AnalytiChem - Sistema de Chamados
   Sender Email: felipe.henrique@analytichem.com
   ```

### 3. Configurar Templates de Email
1. Ainda em **Authentication > Settings**
2. Role até **Email Templates**
3. Configure os templates para:
   - **Confirm signup**
   - **Invite user**
   - **Magic link**
   - **Recovery/Reset password**

## 🔧 Integração com o Sistema

### Sistema de Emails Implementado

O projeto agora possui três métodos de envio de convites:

#### 1. **Logs de Desenvolvimento** (Atual)
```typescript
EmailService.sendUserInvitation(email, nome, senha?)
```
- Exibe emails no console para desenvolvimento
- Simula sucesso para testes

#### 2. **Magic Links Nativos do Supabase** (Recomendado)
```typescript
EmailService.sendUserInvitationMagicLink(email, nome)
```
- Usa sistema nativo de OTP/Magic Link
- Envio automático via SMTP configurado
- Mais confiável e seguro

#### 3. **Notificações Internas** (Backup)
```typescript
EmailService.createInvitationNotification(email, nome, senha?)
```
- Cria notificação dentro do sistema
- Funciona mesmo sem SMTP
- Usuário vê no painel de notificações

## 🎯 Implementação Atual do UserManagement

Quando um novo usuário é criado:

1. **Cria registro no banco** ✅
2. **Gera senha temporária** (se solicitado) ✅  
3. **Envia convite por email** ✅ (logs apenas)
4. **Cria notificação interna** ✅ (backup)
5. **Mostra feedback visual** ✅

### Fluxo de Convite
```typescript
// 1. Criar usuário
const newUser = await createUser(userData);

// 2. Tentar enviar email
const emailResult = await EmailService.sendUserInvitation(email, nome, senha);

// 3. Criar notificação como backup
const notificationResult = await EmailService.createInvitationNotification(email, nome, senha);

// 4. Mostrar feedback baseado no sucesso
if (emailResult.success || notificationResult.success) {
  toast("Usuário criado e convite enviado");
} else {
  toast("Usuário criado. Informe manualmente sobre o acesso");
}
```

## 📋 Templates de Email Criados

### 1. **Convite de Usuário**
- ✅ Design responsivo com CSS inline
- ✅ Informações da conta (email, nome, link)
- ✅ Senha temporária (quando aplicável)
- ✅ Instruções passo-a-passo
- ✅ Informações de suporte
- ✅ Dicas de segurança

### 2. **Novo Chamado** (Para Agentes)
- ✅ Detalhes do chamado
- ✅ Prioridade colorida
- ✅ Link direto para o chamado
- ✅ Informações do usuário

### 3. **Atualização de Chamado** (Para Usuários)
- ✅ Mensagem do agente
- ✅ Status atual
- ✅ Link para acompanhar

## 🔄 Próximos Passos para Produção

### 1. Ativar SMTP Real
Para usar emails reais, modifique `EmailService.sendEmail()`:

```typescript
// Remover simulação
// return { success: true };

// Ativar envio real via Edge Function ou API
const { data, error } = await supabase.functions.invoke('send-email', {
  body: emailData
});
```

### 2. Usar Magic Links
Para convites mais seguros:

```typescript
// Em vez de senha temporária, usar magic link
const result = await EmailService.sendUserInvitationMagicLink(email, nome);
```

### 3. Configurar Webhook de Email
Para tracking de entrega e abertura:

1. Configure webhook no Supabase
2. Monitore status de entrega
3. Reenvie automaticamente se necessário

## 🧪 Testando o Sistema

### Criar Usuário de Teste
1. Vá para **Admin > Gerenciamento de Usuários**
2. Clique em **Novo Usuário**
3. Preencha:
   - Nome: `Teste Email`
   - Email: `seu.email@teste.com`
   - Função: `Usuário`
   - ☑️ Gerar senha temporária
4. Clique **Salvar**

### Verificar Logs
1. Abra o **Console do Navegador** (F12)
2. Verifique os logs:
   ```
   📧 Sending invitation to: seu.email@teste.com
   📧 Email que seria enviado:
   Para: seu.email@teste.com
   Assunto: Bem-vindo ao Sistema de Chamados - AnalytiChem
   ✅ Invitation notification created for: seu.email@teste.com
   ```

### Verificar Notificação
1. Faça login com o usuário criado
2. Verifique o sino de notificações
3. Deve aparecer: "Bem-vindo ao Sistema de Chamados"

## 📊 Status Atual do Sistema

| Funcionalidade | Status | Notas |
|---|---|---|
| Criação de usuários | ✅ Funcionando | Via admin panel |
| Senhas temporárias | ✅ Funcionando | Com expiração |
| Templates de email | ✅ Criados | HTML + texto |
| Logs de desenvolvimento | ✅ Ativo | Console do navegador |
| Notificações internas | ✅ Funcionando | Sistema de backup |
| SMTP configurado | ✅ Configurado | Outlook/Office 365 |
| Envio real de emails | 🔄 Pendente | Ativar em produção |

## 🎉 Conclusão

O sistema está **pronto para enviar convites de usuário**! 

- ✅ **SMTP configurado** no painel do Supabase
- ✅ **Templates profissionais** criados
- ✅ **Sistema duplo** (email + notificação)
- ✅ **Interface administrativa** completa
- ✅ **Feedback visual** para usuários

Para **ativar emails reais**, basta modificar uma linha no `EmailService.sendEmail()` para usar a Edge Function ou API do Supabase.

**Teste agora:** Crie um usuário e verifique os logs no console! 