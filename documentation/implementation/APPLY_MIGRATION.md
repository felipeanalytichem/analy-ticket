# 🔐 APLICAR MIGRAÇÃO DE SENHAS TEMPORÁRIAS

## ⚡ Passo a Passo Rápido:

### 1. Acesse o Supabase Dashboard
- Vá para: **https://supabase.com/dashboard**
- Selecione seu projeto
- Clique em **"SQL Editor"**

### 2. Copie e Cole este SQL:

```sql
-- Adicionar campos de senha temporária
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS temporary_password TEXT,
ADD COLUMN IF NOT EXISTS temporary_password_created_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS temporary_password_expires_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS last_password_change TIMESTAMP WITH TIME ZONE;

-- Função para gerar senha temporária
CREATE OR REPLACE FUNCTION generate_temporary_password()
RETURNS TEXT AS $$
DECLARE
    chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    result TEXT := '';
    i INTEGER := 0;
BEGIN
    FOR i IN 1..8 LOOP
        result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
    END LOOP;
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para definir senha temporária
CREATE OR REPLACE FUNCTION set_temporary_password(user_id UUID)
RETURNS TEXT AS $$
DECLARE
    temp_password TEXT;
    expiry_time TIMESTAMP WITH TIME ZONE;
BEGIN
    temp_password := generate_temporary_password();
    expiry_time := NOW() + INTERVAL '24 hours';
    
    UPDATE public.users 
    SET 
        temporary_password = temp_password,
        temporary_password_created_at = NOW(),
        temporary_password_expires_at = expiry_time,
        must_change_password = TRUE,
        updated_at = NOW()
    WHERE id = user_id;
    
    RETURN temp_password;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para limpar senha temporária
CREATE OR REPLACE FUNCTION clear_temporary_password(user_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE public.users 
    SET 
        temporary_password = NULL,
        temporary_password_created_at = NULL,
        temporary_password_expires_at = NULL,
        must_change_password = FALSE,
        last_password_change = NOW(),
        updated_at = NOW()
    WHERE id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Permissões
GRANT EXECUTE ON FUNCTION clear_temporary_password(UUID) TO authenticated;

-- Índices
CREATE INDEX IF NOT EXISTS idx_users_temporary_password_expires_at ON public.users(temporary_password_expires_at);
CREATE INDEX IF NOT EXISTS idx_users_must_change_password ON public.users(must_change_password);
```

### 3. Execute
- Clique em **"Run"** ou pressione **Ctrl+Enter**
- Aguarde a confirmação ✅

### 4. Pronto!
Agora o sistema de senhas temporárias estará funcionando!

---

## 🚀 Como Usar Depois:

1. **Criar usuário com senha temporária:**
   - Administração → Gerenciamento de Usuários → Novo Usuário
   - Marcar "Gerar senha temporária"
   - Copiar senha e enviar ao usuário

2. **Renovar senha expirada:**
   - Clicar no botão 🔄 ao lado do usuário
   - Nova senha de 24h será gerada

3. **Usuário altera senha:**
   - No primeiro login aparece popup automático
   - Deve seguir requisitos de segurança
   - Após alterar, acesso liberado

---

## 🔒 Correção de Políticas RLS (OBRIGATÓRIO)

Se você receber erro "violates row-level security policy", execute este SQL adicional:

```sql
-- Corrigir políticas RLS para criação de usuários
DROP POLICY IF EXISTS "Users can view own temporary password status" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.users;

-- Políticas corretas
CREATE POLICY "users_select_policy" ON public.users
    FOR SELECT USING (
        auth.uid() = id OR 
        EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY "users_insert_policy" ON public.users
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin') OR
        auth.uid() = id
    );

CREATE POLICY "users_update_policy" ON public.users
    FOR UPDATE USING (
        auth.uid() = id OR 
        EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
    );

-- Função helper para criação de usuários
CREATE OR REPLACE FUNCTION create_user_by_admin(
    user_email TEXT,
    user_name TEXT,
    user_role TEXT DEFAULT 'user'
)
RETURNS UUID AS $$
DECLARE
    new_user_id UUID;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin') THEN
        RAISE EXCEPTION 'Only admins can create users';
    END IF;
    
    new_user_id := gen_random_uuid();
    
    INSERT INTO public.users (id, email, full_name, role, created_at, updated_at)
    VALUES (new_user_id, user_email, user_name, user_role, NOW(), NOW());
    
    RETURN new_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION create_user_by_admin(TEXT, TEXT, TEXT) TO authenticated;
```

---

## ⚠️ CORREÇÃO CRÍTICA: Recursão Infinita (OBRIGATÓRIO)

Se você receber erro "infinite recursion detected in policy", execute este SQL:

```sql
-- Corrigir recursão infinita nas políticas RLS
DROP POLICY IF EXISTS "users_select_policy" ON public.users;
DROP POLICY IF EXISTS "users_insert_policy" ON public.users;
DROP POLICY IF EXISTS "users_update_policy" ON public.users;
DROP POLICY IF EXISTS "users_delete_policy" ON public.users;

-- Função helper para evitar recursão
CREATE OR REPLACE FUNCTION is_admin_user(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN (
        SELECT role = 'admin' 
        FROM public.users 
        WHERE id = user_id
        LIMIT 1
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER FUNCTION is_admin_user(UUID) SET search_path = public;

-- Políticas RLS sem recursão
CREATE POLICY "users_select_policy" ON public.users
    FOR SELECT USING (
        id = auth.uid() OR is_admin_user(auth.uid())
    );

CREATE POLICY "users_insert_policy" ON public.users
    FOR INSERT WITH CHECK (
        id = auth.uid() OR is_admin_user(auth.uid())
    );

CREATE POLICY "users_update_policy" ON public.users
    FOR UPDATE USING (
        id = auth.uid() OR is_admin_user(auth.uid())
    ) WITH CHECK (
        id = auth.uid() OR is_admin_user(auth.uid())
    );

-- Atualizar função de criação
CREATE OR REPLACE FUNCTION create_user_by_admin(
    user_email TEXT,
    user_name TEXT,
    user_role TEXT DEFAULT 'user'
)
RETURNS UUID AS $$
DECLARE
    new_user_id UUID;
BEGIN
    IF NOT is_admin_user(auth.uid()) THEN
        RAISE EXCEPTION 'Only admins can create users';
    END IF;
    
    new_user_id := gen_random_uuid();
    
    INSERT INTO public.users (id, email, full_name, role, created_at, updated_at)
    VALUES (new_user_id, user_email, user_name, user_role, NOW(), NOW());
    
    RETURN new_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER FUNCTION create_user_by_admin(TEXT, TEXT, TEXT) SET search_path = public;
GRANT EXECUTE ON FUNCTION is_admin_user(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION create_user_by_admin(TEXT, TEXT, TEXT) TO authenticated;
```

---

## 🔧 CORREÇÃO: Tipo de Role (user_role enum)

Se você receber erro sobre "column role is of type user_role but expression is of type text", execute:

```sql
-- Corrigir cast do tipo user_role na função
CREATE OR REPLACE FUNCTION create_user_by_admin(
    user_email TEXT,
    user_name TEXT,
    user_role TEXT DEFAULT 'user'
)
RETURNS UUID AS $$
DECLARE
    new_user_id UUID;
BEGIN
    IF NOT is_admin_user(auth.uid()) THEN
        RAISE EXCEPTION 'Only admins can create users';
    END IF;
    
    IF user_role NOT IN ('user', 'agent', 'admin') THEN
        RAISE EXCEPTION 'Invalid role. Must be one of: user, agent, admin';
    END IF;
    
    new_user_id := gen_random_uuid();
    
    INSERT INTO public.users (id, email, full_name, role, created_at, updated_at)
    VALUES (
        new_user_id, 
        user_email, 
        user_name, 
        user_role::user_role,  -- Cast text to user_role enum
        NOW(), 
        NOW()
    );
    
    RETURN new_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER FUNCTION create_user_by_admin(TEXT, TEXT, TEXT) SET search_path = public;
GRANT EXECUTE ON FUNCTION create_user_by_admin(TEXT, TEXT, TEXT) TO authenticated;
``` 