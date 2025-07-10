# 🔬 Debug Avançado - Sistema Completo de Rastreamento

## 🎯 **Objetivo**
Identificar **exatamente** onde e por que o usuário está sendo deslogado ao pressionar F5.

## 🔧 **Sistema de Debug Implementado**

### 1. **Storage Debug Wrapper**
```typescript
// src/lib/supabase.ts
const debugStorage = {
  getItem: (key) => {
    // Loga TODA leitura do localStorage
    debugLog(`STORAGE GET: ${key}`, value ? 'Found token' : 'No token');
  },
  setItem: (key, value) => {
    // Loga TODA escrita no localStorage
    debugLog(`STORAGE SET: ${key}`, 'Setting token');
  },
  removeItem: (key) => {
    // Loga TODA remoção do localStorage
    debugLog(`STORAGE REMOVE: ${key}`, 'Removing token');
  }
}
```

### 2. **AuthContext Debug Completo**
- ✅ **Timestamp em todos os logs**
- ✅ **Estado completo em cada mudança**
- ✅ **Stack trace em logouts**
- ✅ **Análise detalhada de tokens**
- ✅ **Rastreamento de inicialização**

### 3. **Supabase Client Debug**
- ✅ **Eventos de auth state com detalhes completos**
- ✅ **Análise de expiração de tokens**
- ✅ **Stack trace em SIGNED_OUT**
- ✅ **Verificação pós-login de storage**

### 4. **LogoutDetector Component**
- ✅ **Detecta mudanças de visibilidade**
- ✅ **Rastreia focus/blur da janela**
- ✅ **Monitora page unload/reload**
- ✅ **Analisa causas de logout**

### 5. **App-Level Debug**
- ✅ **Verificação completa de localStorage**
- ✅ **Teste de funcionalidade de storage**
- ✅ **Informações de browser/ambiente**

## 📋 **Como Usar o Debug**

### **1. Faça Login**
Observe os logs:
```
🔬 [TIMESTAMP] SUPABASE CLIENT: Initializing with config
🔬 [TIMESTAMP] STORAGE GET: supabase.auth.token
🔬 [TIMESTAMP] AUTH STATE CHANGE: SIGNED_IN
🔬 [TIMESTAMP] STORAGE SET: supabase.auth.token
🔬 [TIMESTAMP] POST-LOGIN STORAGE CHECK: Token stored successfully
```

### **2. Antes de Pressionar F5**
Execute no console:
```javascript
// Verificar token
localStorage.getItem('supabase.auth.token')

// Ver todos os logs até agora
// (procure por padrões nos logs anteriores)
```

### **3. Pressione F5**
Observe a sequência **EXATA** de logs:
- ✅ **Page unload** logs
- ✅ **Storage get** attempts
- ✅ **Auth initialization** logs
- ✅ **Session recovery** attempts
- ❌ **Onde falha?**

### **4. Logs Esperados em F5 (Sucesso)**
```
🔬 [LOGOUT DETECTOR] PAGE UNLOADING: hasUser=true, localStorage=Present
🔬 [APP] DETAILED LOCALSTORAGE DEBUG: hasSupabaseToken=true
🔬 [AUTH CONTEXT] === STARTING AUTH INITIALIZATION ===
🔬 [STORAGE GET]: supabase.auth.token: Found token
🔬 [AUTH CONTEXT] STORED TOKEN ANALYSIS: isExpired=false
🔬 [AUTH CONTEXT] SESSION FOUND: email=user@email.com
```

### **5. Logs de Falha (O que procurar)**
```
❌ 🔬 [STORAGE GET]: supabase.auth.token: No token
❌ 🔬 [AUTH CONTEXT] NO SESSION FOUND
❌ 🔬 [AUTH STATE CHANGE]: SIGNED_OUT
❌ 🔬 [LOGOUT DETECTOR] USER LOGGED OUT - INVESTIGATING
```

## 🕵️ **Pontos de Investigação**

### **Se localStorage está vazio após F5:**
- Browser limpou storage
- Extensões interferindo
- Modo privado/incógnito
- Configurações de privacy

### **Se localStorage tem token mas sessão falha:**
- Token corrompido
- Problema de parsing
- Supabase não reconhece token
- Network issues

### **Se tudo parece OK mas logout acontece:**
- Erro no perfil de usuário forçando logout
- Problema de RLS no banco
- Async race condition

## 🔍 **Comandos de Debug no Console**

```javascript
// 1. Verificar estado atual
localStorage.getItem('supabase.auth.token')

// 2. Testar storage
localStorage.setItem('test', 'value')
localStorage.getItem('test')
localStorage.removeItem('test')

// 3. Verificar sessão Supabase
supabase.auth.getSession()

// 4. Verificar usuário
supabase.auth.getUser()

// 5. Ver todos os listeners ativos
console.dir(supabase.auth)
```

## ✅ **Próximos Passos**

1. **Faça login no sistema**
2. **Pressione F5**
3. **Copie TODOS os logs do console**
4. **Identifique onde a sequência quebra**
5. **Compare com os padrões esperados**

## 🎯 **O que Isso Vai Revelar**

Este sistema de debug vai mostrar **exatamente**:
- ✅ Se o token está sendo salvo no localStorage
- ✅ Se o token está sendo recuperado do localStorage
- ✅ Se o token está sendo perdido em algum ponto
- ✅ Se há erros de parsing ou validação
- ✅ Se há problemas de timing/async
- ✅ Se há eventos externos causando logout

**Agora teste e compartilhe os logs!** 🔍 