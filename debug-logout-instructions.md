# 🔍 Debug do Logout Após Refresh

## 🎯 **Situação Atual**

- ✅ Teste de login funcionou perfeitamente
- ❌ Logout ainda acontece ao atualizar página
- 🔍 Precisamos identificar a diferença entre teste e uso real

## 🛠️ **Sistema de Debug Ativo**

Agora você tem um **painel de debug vermelho** no canto superior direito da tela que mostra:

- Status atual (usuário e sessão)
- Logs em tempo real de mudanças de autenticação
- Botão "Check Now" para verificação manual

## 📋 **Instruções para Debug**

### Passo 1: Verificar Estado Inicial
1. Acesse: **http://localhost:8082**
2. Observe o painel de debug vermelho
3. Verifique se você está logado inicialmente

### Passo 2: Executar o Teste de Refresh
1. **COM O PAINEL VISÍVEL**, pressione **F5** para atualizar
2. **Observe imediatamente** os logs no painel
3. **Anote** o que acontece nos primeiros segundos

### Passo 3: Analisar os Logs
Procure por estas mensagens específicas:

#### ✅ **Se estiver funcionando:**
```
localStorage token: EXISTS
Supabase session: EXISTS
AuthContext user: seu-email@exemplo.com
```

#### ❌ **Se houver problema:**
```
localStorage token: MISSING
Supabase session: MISSING
AUTH STATE CHANGE: SIGNED_OUT
```

## 🎯 **Principais Cenários a Investigar**

### Cenário A: Token Expira Rapidamente
```
Token expires at: [data]
Token expired: true
```
**Indicação**: Token com expiração muito curta

### Cenário B: Token Removido do Storage
```
STORAGE CHANGE - supabase.auth.token
Old value: HAD TOKEN
New value: NO TOKEN
```
**Indicação**: Algo está removendo o token

### Cenário C: Auth State Change Inesperado
```
AUTH STATE CHANGE: SIGNED_OUT
Token in localStorage during logout: EXISTS
```
**Indicação**: Logout forçado mesmo com token válido

### Cenário D: Erro de Sessão
```
Supabase error: [erro específico]
```
**Indicação**: Problema de comunicação com Supabase

## 📊 **Informações que Preciso**

Após fazer o teste de refresh, me envie:

1. **Status antes do refresh**: User/Session do painel
2. **Logs completos** que aparecem durante/após o refresh
3. **Console do navegador** (F12 → Console)
4. **Quanto tempo** leva para ser desconectado

## 🔧 **Comandos Adicionais**

Se necessário, abra o DevTools (F12) e execute:

```javascript
// Verificar estado completo
console.log('=== AUTH DEBUG ===');
console.log('localStorage token:', localStorage.getItem('supabase.auth.token'));
console.log('All localStorage keys:', Object.keys(localStorage));

// Verificar sessão Supabase
supabase.auth.getSession().then(({data, error}) => {
  console.log('Supabase session:', data.session);
  console.log('Supabase error:', error);
});
```

## 🎯 **Objetivo**

Descobrir **exatamente quando e por que** o logout acontece:
- É imediato no refresh?
- Acontece após alguns segundos?
- É um evento específico que dispara?
- O token realmente desaparece ou só a sessão?

---
**🚨 IMPORTANTE**: Execute este debug o mais rápido possível para capturar o problema em ação! 