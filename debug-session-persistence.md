# Debug Session Persistence - Investigação do Problema F5

## 🔍 Problema Reportado
Usuário continua sendo deslogado após pressionar F5 (atualizar página), mesmo após as correções anteriores.

## 🔧 Melhorias Implementadas

### 1. **Configuração Explícita do localStorage**
```typescript
// src/lib/supabase.ts
auth: {
  autoRefreshToken: true,
  persistSession: true,
  detectSessionInUrl: true,
  flowType: 'pkce',
  storage: window.localStorage,        // ← NOVO: Força uso do localStorage
  storageKey: 'supabase.auth.token',  // ← NOVO: Chave específica
}
```

### 2. **Função loadUserProfile Mais Robusta**
- ✅ Retorna `boolean` para indicar sucesso/falha
- ✅ Não força logout em caso de falha
- ✅ Logs mais detalhados
- ✅ Melhor tratamento de erros

### 3. **Inicialização Melhorada**
- ✅ Verifica localStorage antes de tudo
- ✅ Não falha se perfil não carrega
- ✅ Mantém sessão mesmo com erros de perfil
- ✅ Logs detalhados para debug

### 4. **Logs de Debug Melhorados**
- 🔍 Verificação de localStorage no App
- 🔍 Verificação de localStorage na inicialização
- 🔍 Logs detalhados do cliente Supabase
- 🔍 Timestamps de expiração de token

## 📋 Passos para Testar e Debugar

### 1. **Abra o Navegador em http://localhost:8081**

### 2. **Abra o Console do Navegador (F12)**

### 3. **Faça Login e Observe os Logs**
Você deve ver:
```
🌐 App: Language forced to English
🔍 App: Supabase auth token in localStorage: Missing
🔐 Inicializando autenticação...
🔍 Verificando localStorage: No token
ℹ️ Nenhuma sessão ativa
```

### 4. **Após Login Bem-sucedido, Deve Ver:**
```
🔑 [SUPABASE CLIENT] User signed in: seu@email.com
⏰ [SUPABASE CLIENT] Session expires at: [timestamp]
🔍 Loading profile for user ID: [id] (email: seu@email.com)
✅ Profile found: seu@email.com
```

### 5. **Antes de Pressionar F5, Verifique:**
- Console: `localStorage.getItem('supabase.auth.token')`
- Deve retornar um token JSON

### 6. **Pressione F5 e Observe:**
```
🔍 App: Supabase auth token in localStorage: Present
🔐 Inicializando autenticação...
🔍 Verificando localStorage: Token found
✅ Sessão encontrada: seu@email.com
```

## 🚨 Possíveis Problemas a Investigar

### **Se localStorage está vazio após login:**
- Problema com domínio/porta
- Configuração de cookies/localStorage bloqueada
- Extensões do navegador interferindo

### **Se sessão não é recuperada apesar do token:**
- Token corrompido
- Expiração de token
- Configuração do Supabase

### **Se perfil não carrega:**
- Problema de permissões RLS
- Dados inconsistentes no banco
- Erro de rede

## 🔧 Comandos de Debug no Console

```javascript
// Verificar token no localStorage
localStorage.getItem('supabase.auth.token')

// Verificar sessão atual
supabase.auth.getSession()

// Verificar usuário atual
supabase.auth.getUser()

// Forçar refresh do token
supabase.auth.refreshSession()
```

## 📊 O Que Mudou

1. **Configuração explícita do storage** - elimina ambiguidade
2. **Logs detalhados** - facilita debug
3. **Recuperação robusta** - não falha por problemas de perfil
4. **Verificações múltiplas** - localStorage + sessão + perfil

## ✅ Teste Final

Se ainda houver logout após F5:
1. ✅ Copie **TODOS** os logs do console
2. ✅ Verifique se o token existe no localStorage
3. ✅ Teste em modo anônimo/incógnito
4. ✅ Teste em navegador diferente
5. ✅ Verifique se há extensões bloqueando localStorage 