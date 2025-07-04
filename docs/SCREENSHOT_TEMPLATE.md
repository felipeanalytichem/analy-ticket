# 📸 Template para Captura de Screenshots - Knowledge Base

## 🎯 Objetivo

Este documento define os padrões para captura de screenshots destinados à documentação da knowledge base, garantindo consistência visual e qualidade das imagens.

---

## 📋 Checklist Pré-Captura

### ✅ **Preparação do Ambiente**
- [ ] Navegador limpo (sem extensões visíveis)
- [ ] Zoom da página em 100%
- [ ] Resolução mínima: 1920x1080
- [ ] Dados de exemplo realistas (não usar dados reais de clientes)
- [ ] Interface em português brasileiro
- [ ] Tema claro ativado (para melhor contraste)

### ✅ **Dados de Exemplo**
- [ ] **Usuários fictícios**: João Silva, Maria Santos, Pedro Oliveira
- [ ] **Emails**: joao.silva@analytichem.com, maria.santos@analytichem.com
- [ ] **Chamados**: Use números de exemplo como TKT-1704567890-123
- [ ] **Datas**: Use datas recentes mas fictícias
- [ ] **Problemas**: Cenários realistas mas genéricos

---

## 🖼️ Padrões de Captura

### 📐 **Dimensões e Qualidade**
- **Formato**: PNG (melhor qualidade para interfaces)
- **Resolução mínima**: 1920x1080 para desktop
- **Resolução mobile**: 375x812 (iPhone padrão)
- **DPI**: 72 dpi (suficiente para web)
- **Compressão**: Mínima (priorizar qualidade)

### 🎨 **Elementos Visuais**

#### 🔴 **Destaques**
- **Bordas vermelhas**: #FF0000, espessura 3px
- **Setas**: Vermelhas, tamanho médio
- **Círculos**: Para destacar botões ou ícones pequenos
- **Retângulos**: Para áreas maiores

#### 📝 **Anotações**
- **Números**: Círculos brancos com números vermelhos
- **Fonte**: Arial ou similar, tamanho 14-16px
- **Contraste**: Sempre garantir legibilidade

### 📱 **Responsividade**
- Capture versões desktop e mobile quando relevante
- Mobile: Foque em gestos e navegação touch
- Desktop: Mostre todas as funcionalidades da interface

---

## 📂 Organização de Arquivos

### 🗂️ **Estrutura de Pastas**
```
docs/
├── screenshots/
│   ├── admin/
│   │   ├── user-management/
│   │   ├── categories/
│   │   └── settings/
│   ├── agent/
│   │   ├── dashboard/
│   │   ├── tickets/
│   │   └── reports/
│   ├── user/
│   │   ├── create-ticket/
│   │   ├── dashboard/
│   │   └── profile/
│   └── general/
│       ├── login/
│       ├── navigation/
│       └── notifications/
```

### 📝 **Nomenclatura**
- **Formato**: `[seção]-[funcionalidade]-[ordem].png`
- **Exemplos**:
  - `admin-user-creation-01.png`
  - `agent-ticket-details-03.png`
  - `user-dashboard-overview-01.png`
- **Sequência**: Sempre usar 2 dígitos (01, 02, 03...)

---

## 🎯 Screenshots Específicos por Seção

### 👨‍💼 **Administração**

#### **Gerenciamento de Usuários**
- [ ] `admin-user-list-overview-01.png` - Lista completa de usuários
- [ ] `admin-user-create-button-02.png` - Destaque no botão "Criar Usuário"
- [ ] `admin-user-create-modal-03.png` - Modal de criação preenchido
- [ ] `admin-user-temp-password-04.png` - Modal de senha temporária
- [ ] `admin-user-edit-modal-05.png` - Modal de edição
- [ ] `admin-user-delete-confirm-06.png` - Confirmação de exclusão

#### **Menu de Navegação**
- [ ] `admin-menu-navigation-01.png` - Menu lateral expandido
- [ ] `admin-breadcrumb-02.png` - Navegação breadcrumb

### 🛠️ **Agentes**

#### **Dashboard**
- [ ] `agent-dashboard-overview-01.png` - Dashboard completo
- [ ] `agent-metrics-cards-02.png` - Cards de métricas
- [ ] `agent-ticket-list-03.png` - Lista de chamados atribuídos

#### **Gerenciamento de Chamados**
- [ ] `agent-ticket-details-01.png` - Tela de detalhes completa
- [ ] `agent-ticket-comments-02.png` - Seção de comentários
- [ ] `agent-ticket-status-change-03.png` - Dropdown de mudança de status
- [ ] `agent-ticket-attachments-04.png` - Área de anexos

### 👤 **Usuários**

#### **Criação de Chamados**
- [ ] `user-create-ticket-form-01.png` - Formulário completo
- [ ] `user-category-dropdown-02.png` - Seleção de categoria
- [ ] `user-priority-selection-03.png` - Seleção de prioridade
- [ ] `user-file-upload-04.png` - Área de upload de arquivos
- [ ] `user-ticket-confirmation-05.png` - Confirmação de criação

#### **Dashboard**
- [ ] `user-dashboard-overview-01.png` - Dashboard principal
- [ ] `user-ticket-list-02.png` - Lista "Meus Chamados"

### 🔔 **Sistema Geral**

#### **Notificações**
- [ ] `general-notification-bell-01.png` - Sino de notificações
- [ ] `general-notification-popup-02.png` - Popup de notificação
- [ ] `general-notification-list-03.png` - Lista de notificações

#### **Login e Autenticação**
- [ ] `general-login-form-01.png` - Tela de login
- [ ] `general-forgot-password-02.png` - Recuperação de senha

---

## 🛠️ Ferramentas Recomendadas

### 📱 **Captura**
- **Windows**: Ferramenta de Captura (Snipping Tool)
- **Mac**: Screenshot (Cmd + Shift + 4)
- **Browser**: Extensões como Lightshot ou Awesome Screenshot
- **Profissional**: Snagit ou Greenshot

### 🎨 **Edição**
- **Básica**: Paint, Preview (Mac)
- **Intermediária**: GIMP (gratuito)
- **Profissional**: Photoshop, Sketch
- **Online**: Canva, Figma

### 🔧 **Anotações**
- **Arrows e shapes**: Use ferramentas nativas da captura
- **Números**: Círculos pequenos com números
- **Texto**: Apenas quando necessário para clareza

---

## ✅ Checklist Pós-Captura

### 🔍 **Revisão de Qualidade**
- [ ] Imagem nítida e sem pixelização
- [ ] Elementos destacados claramente visíveis
- [ ] Anotações legíveis e bem posicionadas
- [ ] Dados sensíveis removidos ou mascarados
- [ ] Proporções corretas da interface

### 📁 **Organização**
- [ ] Arquivo salvo na pasta correta
- [ ] Nome seguindo convenção estabelecida
- [ ] Tamanho otimizado (máximo 500KB por imagem)
- [ ] Backup em local seguro

### 📝 **Documentação**
- [ ] Screenshot referenciado no arquivo .md correspondente
- [ ] Descrição alt-text adicionada
- [ ] Contexto explicado no texto

---

## 📋 Template de Referência

### 🖼️ **No Markdown**
```markdown
![Screenshot: Descrição clara do que está sendo mostrado]()
*📸 Screenshot necessário: [descrição detalhada para quem vai capturar]*
```

### 📝 **Exemplo Prático**
```markdown
![Screenshot: Modal de criação de usuário com campos preenchidos](./screenshots/admin/user-management/admin-user-create-modal-03.png)
*📸 Screenshot necessário: Modal de criação aberto, com todos os campos preenchidos com dados de exemplo, destaque no botão "Criar Usuário"*
```

---

## 📞 Dúvidas e Suporte

### 🆘 **Problemas Técnicos**
- Qualidade da imagem ruim
- Problemas de captura
- Ferramentas não funcionando

### 💡 **Sugestões de Melhoria**
- Novos padrões visuais
- Ferramentas mais eficientes
- Automatização de processos

### 📧 **Contato**
- **Email**: documentacao@analytichem.com
- **Interno**: Ramal 5678
- **Chat**: Canal #documentacao no Teams

---

*Última atualização: Janeiro 2025* 