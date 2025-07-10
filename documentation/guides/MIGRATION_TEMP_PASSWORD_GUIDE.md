# Guia para Aplicar Migração de Senhas Temporárias

## Passos para aplicar a migração:

### 1. Acesse o Supabase Dashboard
- Vá para: https://supabase.com/dashboard
- Selecione seu projeto
- Vá para "SQL Editor"

### 2. Execute o SQL da Migração
Copie e cole o seguinte SQL no editor:

```sql
-- Add temporary password system to users table
-- This migration adds fields to track temporary passwords and their expiration

-- Add temporary password fields to users table
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS temporary_password TEXT,
ADD COLUMN IF NOT EXISTS temporary_password_created_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS temporary_password_expires_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS last_password_change TIMESTAMP WITH TIME ZONE;

-- Create function to generate temporary password
CREATE OR REPLACE FUNCTION generate_temporary_password()
RETURNS TEXT AS $$
DECLARE
    chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    result TEXT := '';
    i INTEGER := 0;
BEGIN
    -- Generate 8 character alphanumeric password
    FOR i IN 1..8 LOOP
        result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
    END LOOP;
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to set temporary password for user
CREATE OR REPLACE FUNCTION set_temporary_password(user_id UUID)
RETURNS TEXT AS $$
DECLARE
    temp_password TEXT;
    expiry_time TIMESTAMP WITH TIME ZONE;
BEGIN
    -- Generate temporary password
    temp_password := generate_temporary_password();
    
    -- Set expiry to 24 hours from now
    expiry_time := NOW() + INTERVAL '24 hours';
    
    -- Update user record
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

-- Create function to check if temporary password is expired
CREATE OR REPLACE FUNCTION is_temporary_password_expired(user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    expiry_time TIMESTAMP WITH TIME ZONE;
BEGIN
    SELECT temporary_password_expires_at INTO expiry_time
    FROM public.users 
    WHERE id = user_id;
    
    RETURN (expiry_time IS NOT NULL AND expiry_time < NOW());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to clear temporary password after successful change
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

-- Create function to reset temporary password (generates new one)
CREATE OR REPLACE FUNCTION reset_temporary_password(user_id UUID)
RETURNS TEXT AS $$
BEGIN
    RETURN set_temporary_password(user_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions to authenticated users for the functions they need
GRANT EXECUTE ON FUNCTION is_temporary_password_expired(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION clear_temporary_password(UUID) TO authenticated;

-- Grant execute permissions to admins only for password generation/reset functions
REVOKE EXECUTE ON FUNCTION generate_temporary_password() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION set_temporary_password(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION reset_temporary_password(UUID) FROM PUBLIC;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_temporary_password_expires_at ON public.users(temporary_password_expires_at);
CREATE INDEX IF NOT EXISTS idx_users_must_change_password ON public.users(must_change_password);

-- Create RLS policy for admin access to temporary password functions
CREATE OR REPLACE FUNCTION user_is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = auth.uid() AND role = 'admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comment for documentation
COMMENT ON COLUMN public.users.temporary_password IS 'Encrypted temporary password for new users';
COMMENT ON COLUMN public.users.temporary_password_created_at IS 'When the temporary password was created';
COMMENT ON COLUMN public.users.temporary_password_expires_at IS 'When the temporary password expires (24h from creation)';
COMMENT ON COLUMN public.users.must_change_password IS 'Whether user must change password on next login';
COMMENT ON COLUMN public.users.last_password_change IS 'When user last changed their password';
```

### 3. Execute o comando
- Clique em "Run" ou pressione Ctrl+Enter
- Aguarde a confirmação de sucesso

### 4. Verifique a aplicação
- A migração foi aplicada com sucesso quando não houver erros
- Agora o sistema de senhas temporárias estará funcional

## Funcionalidades Implementadas:

### ✅ **Sistema de Senhas Temporárias:**
- **Geração automática**: Senhas de 8 caracteres alfanuméricos
- **Expiração**: 24 horas a partir da criação
- **Renovação**: Admins podem gerar novas senhas temporárias
- **Segurança**: Funções protegidas com RLS

### ✅ **UI Melhorada:**
- **Popup de criação**: Checkbox para gerar senha temporária
- **Alertas informativos**: Explicações claras sobre o processo
- **Cópia rápida**: Botão para copiar senha gerada
- **Status visual**: Indicadores de expiração na lista de usuários

### ✅ **Popup de Primeira Alteração:**
- **Detecção automática**: Aparece automaticamente no primeiro login
- **Validação robusta**: Requisitos de senha seguros
- **Contador de tempo**: Mostra tempo restante para expiração
- **Bloqueio de acesso**: Usuário não pode usar o sistema sem alterar

### ✅ **Funcionalidades de Admin:**
- **Botão de renovação**: Para gerar nova senha temporária
- **Indicadores visuais**: Status da senha na lista de usuários
- **Gestão completa**: Controle total sobre senhas temporárias

## Como Usar:

1. **Criar usuário com senha temporária:**
   - Ir em Administração → Gerenciamento de Usuários
   - Clicar "Novo Usuário"
   - Marcar checkbox "Gerar senha temporária"
   - Preencher dados e clicar "Criar"
   - Copiar a senha gerada e enviar ao usuário

2. **Renovar senha temporária:**
   - Na lista de usuários, clicar no botão de renovação (🔄)
   - Nova senha será gerada automaticamente
   - Contagem de 24h recomeça

3. **Primeiro login do usuário:**
   - Usuário faz login com senha temporária
   - Popup aparece automaticamente exigindo mudança
   - Deve seguir requisitos de segurança
   - Após alterar, acesso total é liberado 