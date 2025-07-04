# 👨‍💼 Gerenciamento de Usuários - Guia do Administrador

## 📋 Visão Geral

O módulo de Gerenciamento de Usuários permite que administradores criem, editem e gerenciem todos os usuários da plataforma. Este guia detalha todas as funcionalidades disponíveis.

---

## 🎯 Acessando o Gerenciamento de Usuários

### Passo 1: Navegação
1. Faça login como **Administrador**
2. No menu lateral, clique em **"Administração"**
3. Selecione **"Gerenciamento de Usuários"**

![Screenshot: Menu de navegação para gerenciamento de usuários]()
*📸 Screenshot necessário: Menu lateral com destaque em Administração > Gerenciamento de Usuários*

---

## 👀 Interface Principal

### Visão Geral da Tela
A tela principal do gerenciamento de usuários contém:

![Screenshot: Tela principal do gerenciamento de usuários]()
*📸 Screenshot necessário: Tela completa mostrando a lista de usuários*

**Elementos da Interface:**
1. **Cabeçalho**: Título e contador total de usuários
2. **Botão "Criar Usuário"**: Para adicionar novos usuários
3. **Lista de Usuários**: Tabela com todos os usuários cadastrados
4. **Ações por Usuário**: Botões de editar, deletar e gerenciar senhas

---

## ➕ Criando um Novo Usuário

### Passo 1: Iniciar Criação
1. Clique no botão **"Criar Usuário"** (canto superior direito)
2. O modal de criação será exibido

![Screenshot: Botão Criar Usuário destacado]()
*📸 Screenshot necessário: Destaque no botão "Criar Usuário"*

### Passo 2: Preenchendo os Dados
Preencha os campos obrigatórios:

![Screenshot: Modal de criação de usuário]()
*📸 Screenshot necessário: Modal completo de criação com campos preenchidos*

**Campos Obrigatórios:**
- **Nome Completo**: Nome e sobrenome do usuário
- **Email**: Endereço de email (deve ser único)
- **Papel**: Selecione entre:
  - 👤 **Usuário**: Acesso básico (criar chamados)
  - 🛠️ **Agente**: Gerenciar chamados atribuídos
  - 👨‍💼 **Admin**: Acesso total ao sistema

**Opções Adicionais:**
- ☑️ **Gerar senha temporária**: Criar senha inicial para o usuário

### Passo 3: Confirmação
1. Revise os dados inseridos
2. Clique em **"Criar Usuário"**
3. Sistema exibirá confirmação de sucesso

![Screenshot: Confirmação de usuário criado]()
*📸 Screenshot necessário: Modal de confirmação com instruções para o usuário*

---

## 🔑 Sistema de Senhas Temporárias

### Quando Usar
- ✅ Novo funcionário precisa de acesso imediato
- ✅ Usuário esqueceu a senha
- ✅ Redefinição de segurança

### Como Funciona
1. Marque a opção **"Gerar senha temporária"** durante a criação
2. Sistema gera uma senha aleatória segura
3. Modal exibe as instruções para o novo usuário

![Screenshot: Modal com senha temporária gerada]()
*📸 Screenshot necessário: Modal mostrando senha temporária e link de registro*

**Informações Fornecidas:**
- 🔗 **Link de Registro**: URL para o usuário se cadastrar
- 📧 **Email do Usuário**: Confirmação do email
- 👤 **Nome**: Nome cadastrado
- 🎭 **Papel**: Nível de acesso atribuído

### Instruções para o Usuário
O modal fornece instruções claras:
1. Acessar o link de registro
2. Usar o email cadastrado
3. Criar uma senha forte
4. Completar o cadastro

---

## ✏️ Editando Usuários Existentes

### Passo 1: Localizar Usuário
1. Na lista de usuários, encontre o usuário desejado
2. Clique no ícone **✏️ Editar** na coluna "Ações"

![Screenshot: Lista de usuários com destaque no botão editar]()
*📸 Screenshot necessário: Tabela de usuários com destaque no ícone de editar*

### Passo 2: Modificar Dados
1. Modal de edição será exibido
2. Modifique os campos necessários
3. Clique em **"Salvar Alterações"**

![Screenshot: Modal de edição de usuário]()
*📸 Screenshot necessário: Modal de edição com dados preenchidos*

**Campos Editáveis:**
- Nome Completo
- Email
- Papel/Função

---

## 🔄 Resetar Senha Temporária

### Para Usuários Existentes
1. Na lista de usuários, clique em **🔑 Resetar Senha**
2. Sistema gera nova senha temporária
3. Modal exibe nova senha e instruções

![Screenshot: Modal de senha temporária para usuário existente]()
*📸 Screenshot necessário: Modal de reset de senha para usuário existente*

### Status da Senha
A tabela mostra o status atual:
- ✅ **Ativa**: Usuário já configurou senha
- ⏰ **Temporária**: Senha temporária ativa
- ❌ **Expirada**: Senha temporária vencida

---

## 🗑️ Removendo Usuários

### ⚠️ Importante
- Ação **irreversível**
- Remove todos os dados associados
- Chamados do usuário **permanecem** no sistema

### Processo de Remoção
1. Clique no ícone **🗑️ Deletar** na linha do usuário
2. Confirme a ação no modal de confirmação
3. Usuário será removido permanentemente

![Screenshot: Modal de confirmação de deleção]()
*📸 Screenshot necessário: Modal de confirmação para deletar usuário*

---

## 📊 Informações da Tabela

### Colunas Disponíveis
A tabela de usuários exibe:

| Coluna | Descrição |
|--------|-----------|
| **Avatar** | Foto do perfil (se disponível) |
| **Nome** | Nome completo do usuário |
| **Email** | Endereço de email |
| **Papel** | Função no sistema (User/Agent/Admin) |
| **Status da Senha** | Situação da senha temporária |
| **Criado em** | Data de criação da conta |
| **Ações** | Botões de editar, resetar senha e deletar |

### Indicadores Visuais
- 🟢 **Verde**: Papel Admin
- 🔵 **Azul**: Papel Agente  
- 🟡 **Amarelo**: Papel Usuário
- ⏰ **Relógio**: Senha temporária ativa
- ✅ **Check**: Conta ativa

---

## 🎯 Boas Práticas

### ✅ Recomendações
- **Sempre revisar** os dados antes de criar usuários
- **Usar senhas temporárias** para novos funcionários
- **Comunicar credenciais** de forma segura
- **Monitorar regularmente** usuários inativos
- **Remover usuários** que não precisam mais de acesso

### ❌ Evitar
- Criar usuários com emails incorretos
- Deixar senhas temporárias vencerem sem acompanhamento
- Atribuir privilégios administrativos desnecessariamente
- Reutilizar emails de usuários removidos

---

## 🆘 Resolução de Problemas

### Problema: "Email já existe"
**Causa**: Tentativa de criar usuário com email já cadastrado
**Solução**: Verificar se usuário já existe ou usar email alternativo

### Problema: Usuário não recebe instruções
**Causa**: Email incorreto ou problemas de entrega
**Solução**: Verificar email e enviar instruções manualmente

### Problema: Senha temporária não funciona
**Causa**: Senha pode ter expirado
**Solução**: Gerar nova senha temporária

---

## 📞 Suporte

Para dúvidas ou problemas técnicos:
- 📧 **Email**: suporte.tecnico@analytichem.com
- 📱 **Interno**: Ramal 1234
- 🆘 **Urgente**: Criar chamado com prioridade Alta

---

*Última atualização: Janeiro 2025* 