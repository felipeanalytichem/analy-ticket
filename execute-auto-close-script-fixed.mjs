import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseUrl = 'https://plbmgjqitlxedsmdqpld.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYm1nanFpdGx4ZWRzbWRxcGxkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkxNTIyMjYsImV4cCI6MjA2NDcyODIyNn0.m6MsXWqI6TbJQ1EeaX8R7L7GHzA23ZaffCmKrVdVD_U';

const supabase = createClient(supabaseUrl, supabaseKey);

async function executeAutoCloseScript() {
  try {
    console.log('🔄 Executando script de fechamento automático...');
    
    // Ler o arquivo SQL
    const sqlContent = fs.readFileSync('supabase-auto-close-resolved-tickets.sql', 'utf8');
    
    // Executar cada função/comando separadamente
    console.log('📝 Criando função auto_close_resolved_tickets...');
    
    // 1. Criar função auto_close_resolved_tickets
    const { error: error1 } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE OR REPLACE FUNCTION auto_close_resolved_tickets()
        RETURNS INTEGER
        LANGUAGE plpgsql
        SECURITY DEFINER
        AS $$
        DECLARE
            ticket_record RECORD;
            closed_count INTEGER := 0;
        BEGIN
            FOR ticket_record IN 
                SELECT id, title, ticket_number, user_id, resolved_at, resolved_by
                FROM public.tickets_new 
                WHERE status = 'resolved' 
                AND resolved_at IS NOT NULL
                AND resolved_at < NOW() - INTERVAL '2 days'
            LOOP
                UPDATE public.tickets_new 
                SET 
                    status = 'closed',
                    closed_at = NOW(),
                    closed_by = resolved_by,
                    updated_at = NOW()
                WHERE id = ticket_record.id;
                
                INSERT INTO public.notifications (
                    user_id,
                    type,
                    title,
                    message,
                    priority,
                    ticket_id,
                    read,
                    created_at
                ) VALUES (
                    ticket_record.user_id,
                    'status_changed',
                    'Ticket Fechado Automaticamente',
                    'Seu ticket ' || COALESCE(ticket_record.ticket_number, ticket_record.id::TEXT) || ' foi fechado automaticamente após 2 dias de resolução.',
                    'low',
                    ticket_record.id,
                    FALSE,
                    NOW()
                );
                
                closed_count := closed_count + 1;
            END LOOP;
            
            RETURN closed_count;
        END;
        $$;
      `
    });
    
    if (error1) {
      console.error('❌ Erro ao criar função auto_close_resolved_tickets:', error1);
    } else {
      console.log('✅ Função auto_close_resolved_tickets criada');
    }
    
    // 2. Criar tabela auto_close_schedule
    console.log('📝 Criando tabela auto_close_schedule...');
    const { error: error2 } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS public.auto_close_schedule (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            ticket_id UUID REFERENCES public.tickets_new(id) ON DELETE CASCADE NOT NULL,
            scheduled_close_at TIMESTAMPTZ NOT NULL,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            UNIQUE(ticket_id)
        );
      `
    });
    
    if (error2) {
      console.error('❌ Erro ao criar tabela auto_close_schedule:', error2);
    } else {
      console.log('✅ Tabela auto_close_schedule criada');
    }
    
    // 3. Criar índice
    console.log('📝 Criando índice...');
    const { error: error3 } = await supabase.rpc('exec_sql', {
      sql: `CREATE INDEX IF NOT EXISTS idx_auto_close_schedule_time ON public.auto_close_schedule(scheduled_close_at);`
    });
    
    if (error3) {
      console.error('❌ Erro ao criar índice:', error3);
    } else {
      console.log('✅ Índice criado');
    }
    
    // 4. Criar função check_auto_close_on_update
    console.log('📝 Criando função check_auto_close_on_update...');
    const { error: error4 } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE OR REPLACE FUNCTION check_auto_close_on_update()
        RETURNS TRIGGER
        LANGUAGE plpgsql
        AS $$
        BEGIN
            IF NEW.status = 'resolved' AND OLD.status != 'resolved' THEN
                INSERT INTO public.auto_close_schedule (
                    ticket_id,
                    scheduled_close_at,
                    created_at
                ) VALUES (
                    NEW.id,
                    NOW() + INTERVAL '2 days',
                    NOW()
                )
                ON CONFLICT (ticket_id) DO UPDATE SET
                    scheduled_close_at = NOW() + INTERVAL '2 days',
                    created_at = NOW();
            END IF;
            
            IF NEW.status != 'resolved' AND OLD.status = 'resolved' THEN
                DELETE FROM public.auto_close_schedule WHERE ticket_id = NEW.id;
            END IF;
            
            RETURN NEW;
        END;
        $$;
      `
    });
    
    if (error4) {
      console.error('❌ Erro ao criar função check_auto_close_on_update:', error4);
    } else {
      console.log('✅ Função check_auto_close_on_update criada');
    }
    
    // 5. Criar trigger
    console.log('📝 Criando trigger...');
    const { error: error5 } = await supabase.rpc('exec_sql', {
      sql: `
        DROP TRIGGER IF EXISTS trigger_schedule_auto_close ON public.tickets_new;
        CREATE TRIGGER trigger_schedule_auto_close
            AFTER UPDATE ON public.tickets_new
            FOR EACH ROW
            EXECUTE FUNCTION check_auto_close_on_update();
      `
    });
    
    if (error5) {
      console.error('❌ Erro ao criar trigger:', error5);
    } else {
      console.log('✅ Trigger criado');
    }
    
    // 6. Criar função process_auto_close_schedule
    console.log('📝 Criando função process_auto_close_schedule...');
    const { error: error6 } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE OR REPLACE FUNCTION process_auto_close_schedule()
        RETURNS INTEGER
        LANGUAGE plpgsql
        SECURITY DEFINER
        AS $$
        DECLARE
            schedule_record RECORD;
            closed_count INTEGER := 0;
        BEGIN
            FOR schedule_record IN 
                SELECT s.*, t.title, t.ticket_number, t.user_id, t.resolved_by, t.status
                FROM public.auto_close_schedule s
                JOIN public.tickets_new t ON s.ticket_id = t.id
                WHERE s.scheduled_close_at <= NOW()
                AND t.status = 'resolved'
            LOOP
                UPDATE public.tickets_new 
                SET 
                    status = 'closed',
                    closed_at = NOW(),
                    closed_by = schedule_record.resolved_by,
                    updated_at = NOW()
                WHERE id = schedule_record.ticket_id;
                
                INSERT INTO public.notifications (
                    user_id,
                    type,
                    title,
                    message,
                    priority,
                    ticket_id,
                    read,
                    created_at
                ) VALUES (
                    schedule_record.user_id,
                    'status_changed',
                    'Ticket Fechado Automaticamente',
                    'Seu ticket ' || COALESCE(schedule_record.ticket_number, schedule_record.ticket_id::TEXT) || ' foi fechado automaticamente após 2 dias de resolução.',
                    'low',
                    schedule_record.ticket_id,
                    FALSE,
                    NOW()
                );
                
                DELETE FROM public.auto_close_schedule WHERE id = schedule_record.id;
                
                closed_count := closed_count + 1;
            END LOOP;
            
            RETURN closed_count;
        END;
        $$;
      `
    });
    
    if (error6) {
      console.error('❌ Erro ao criar função process_auto_close_schedule:', error6);
    } else {
      console.log('✅ Função process_auto_close_schedule criada');
    }
    
    // 7. Configurar RLS
    console.log('📝 Configurando RLS...');
    const { error: error7 } = await supabase.rpc('exec_sql', {
      sql: `
        ALTER TABLE public.auto_close_schedule ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "Only system can access auto close schedule" ON public.auto_close_schedule;
        CREATE POLICY "Only system can access auto close schedule" ON public.auto_close_schedule
            FOR ALL USING (false);
      `
    });
    
    if (error7) {
      console.error('❌ Erro ao configurar RLS:', error7);
    } else {
      console.log('✅ RLS configurado');
    }
    
    console.log('🎉 Sistema de fechamento automático configurado com sucesso!');
    console.log('📋 Para usar: Execute process_auto_close_schedule() periodicamente');
    
  } catch (error) {
    console.error('💥 Erro ao executar script:', error);
  }
}

executeAutoCloseScript(); 