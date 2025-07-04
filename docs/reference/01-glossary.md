# 📚 Glossário de Termos - Sistema de Gestão de Chamados

## 🎯 Termos Principais

### 📋 **Chamado (Ticket)**
Solicitação de suporte técnico criada por um usuário para reportar um problema, solicitar uma funcionalidade ou obter assistência.

### 🎟️ **Número do Chamado**
Identificador único gerado automaticamente pelo sistema (ex: TKT-1704567890-123) usado para rastreamento e referência.

### 👤 **Usuário (User)**
Pessoa que utiliza o sistema para criar chamados e solicitar suporte. Tem acesso limitado às suas próprias solicitações.

### 🛠️ **Agente (Agent)**
Profissional de suporte responsável por analisar, trabalhar e resolver os chamados atribuídos a ele.

### 👨‍💼 **Administrador (Admin)**
Usuário com privilégios elevados que pode gerenciar usuários, configurações do sistema e acessar todos os chamados.

---

## 🔄 Status dos Chamados

### 🔴 **Aberto (Open)**
- Chamado recém-criado pelo usuário
- Ainda não foi atribuído a um agente
- Aguarda triagem e atribuição

### 🟡 **Em Andamento (In Progress)**
- Chamado atribuído a um agente
- Agente está trabalhando ativamente na resolução
- Pode incluir investigação, testes e implementação de soluções

### ✅ **Resolvido (Resolved)**
- Agente implementou uma solução
- Aguarda confirmação do usuário
- Usuário tem prazo para validar ou reabrir

### 🔒 **Fechado (Closed)**
- Usuário confirmou que o problema foi resolvido
- Chamado finalizado definitivamente
- Conta nas métricas de sucesso

---

## ⚡ Níveis de Prioridade

### 🔴 **Urgente (Urgent)**
- Sistema completamente inoperante
- Afeta múltiplos usuários ou operações críticas
- Requer atenção imediata
- SLA: 1 hora para primeira resposta

### 🟠 **Alta (High)**
- Problema significativo que afeta produtividade
- Funcionalidade importante indisponível
- Tem workaround temporário
- SLA: 4 horas para primeira resposta

### 🟡 **Média (Medium)**
- Problema moderado com impacto limitado
- Alternativas disponíveis
- Não bloqueia trabalho crítico
- SLA: 1 dia útil para primeira resposta

### 🟢 **Baixa (Low)**
- Problema menor ou solicitação de melhoria
- Não afeta produtividade atual
- Pode ser agendado conforme disponibilidade
- SLA: 2 dias úteis para primeira resposta

---

## 🏷️ Categorias de Chamados

### 💻 **Hardware**
- Problemas com equipamentos físicos
- Computadores, impressoras, monitores
- Falhas de componentes
- Solicitações de equipamentos

### 🖥️ **Software**
- Problemas com programas e aplicações
- Erros de sistema operacional
- Instalação e configuração de software
- Bugs e funcionalidades

### 🌐 **Rede/Internet**
- Problemas de conectividade
- Lentidão de internet
- Acesso a recursos de rede
- Configurações de WiFi

### 🖨️ **Impressão**
- Problemas com impressoras
- Qualidade de impressão
- Configuração de drivers
- Papel e suprimentos

### 📧 **Email**
- Problemas com email corporativo
- Configuração de clientes de email
- Spam e segurança
- Quotas e armazenamento

### 🔐 **Acesso**
- Problemas de login
- Esquecimento de senhas
- Permissões e autorizações
- Criação de contas

### ❓ **Outros**
- Problemas que não se encaixam nas outras categorias
- Solicitações especiais
- Dúvidas gerais

---

## 🔔 Sistema de Notificações

### 📧 **Notificação por Email**
Emails automáticos enviados para informar sobre:
- Criação de novos chamados
- Mudanças de status
- Novos comentários
- Atribuições de chamados

### 🔔 **Notificação no Sistema**
Alertas exibidos na interface da plataforma:
- Sino de notificações no topo da tela
- Contador de notificações não lidas
- Popup com detalhes da notificação

### 📱 **Push Notifications**
Notificações instantâneas (quando configuradas):
- Chamados urgentes
- Atualizações críticas
- Lembretes de SLA

---

## 🕐 Termos de SLA (Service Level Agreement)

### ⏱️ **Tempo de Primeira Resposta**
Prazo máximo para o agente responder pela primeira vez ao chamado após sua criação ou atribuição.

### 🎯 **Tempo de Resolução**
Prazo máximo para resolver completamente o chamado, variando conforme a prioridade e complexidade.

### 📊 **Taxa de Resolução no Primeiro Contato**
Percentual de chamados resolvidos na primeira interação do agente, sem necessidade de followups.

### 🔄 **Taxa de Reabertura**
Percentual de chamados que foram reabertos pelo usuário após serem marcados como resolvidos.

---

## 💬 Tipos de Comentários

### 👁️ **Comentário Público**
- Visível para o usuário que criou o chamado
- Usado para comunicação com o solicitante
- Inclui atualizações de progresso e solicitações de informações

### 🔒 **Comentário Interno**
- Visível apenas para agentes e administradores
- Usado para documentação técnica
- Coordenação entre membros da equipe

### 📋 **Atualização de Status**
- Comentário que também altera o status do chamado
- Notifica automaticamente os envolvidos
- Registra mudanças no histórico

---

## ✅ Sistema de To-Do

### 📋 **Tarefa (Task)**
Item de trabalho criado por agentes ou administradores para organizar atividades relacionadas ao suporte.

### 📊 **Status da Tarefa**
- **Pendente**: Tarefa criada, aguarda início
- **Em Progresso**: Tarefa sendo executada
- **Concluída**: Tarefa finalizada

### ⚡ **Prioridade da Tarefa**
- **Alta**: Requer atenção imediata
- **Média**: Importante, mas não urgente
- **Baixa**: Pode ser feita quando houver tempo

---

## 💬 Sistema de Feedback

### ⭐ **Avaliação de Satisfação**
Nota de 1 a 5 estrelas que o usuário pode dar ao atendimento recebido após a resolução do chamado.

### 📝 **Comentário de Feedback**
Texto livre onde o usuário pode detalhar sua experiência e sugerir melhorias no atendimento.

### 📊 **NPS (Net Promoter Score)**
Métrica que mede a satisfação geral dos usuários com base nas avaliações recebidas.

---

## 🔧 Termos Técnicos

### 🗄️ **RLS (Row Level Security)**
Sistema de segurança que controla o acesso aos dados baseado no usuário logado e suas permissões.

### 🔄 **Migration**
Script que atualiza a estrutura do banco de dados, adicionando novas funcionalidades ou corrigindo problemas.

### 🔑 **UUID (Universally Unique Identifier)**
Identificador único de 128 bits usado para identificar registros de forma única no sistema.

### 📊 **Dashboard**
Painel com visualização resumida de informações importantes, métricas e ações rápidas.

### 🔗 **API (Application Programming Interface)**
Interface que permite integração entre diferentes sistemas e aplicações.

---

## 📞 Canais de Suporte

### 🏃‍♂️ **Suporte Urgente**
- Telefone: (11) 1234-5678
- Ramal interno: 1234
- Para problemas críticos que não podem esperar

### 💬 **Chat Online**
- Disponível na plataforma
- Horário comercial: 8h às 18h
- Resposta em tempo real

### 📧 **Email de Suporte**
- suporte@analytichem.com
- Para dúvidas não urgentes
- Resposta em até 24 horas

### 🎓 **Treinamento**
- Agendamento de capacitações
- Material de apoio
- Contato: treinamento@analytichem.com

---

*Última atualização: Janeiro 2025* 