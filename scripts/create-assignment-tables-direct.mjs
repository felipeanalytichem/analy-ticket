#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

// Supabase configuration
const supabaseUrl = 'https://plbmgjqitlxedsmdqpld.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceKey) {
  console.error('SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function createAssignmentTables() {
  try {
    console.log('🚀 Creating assignment system tables...');

    // Create assignment_rules table
    console.log('📝 Creating assignment_rules table...');
    const { error: rulesError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS public.assignment_rules (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name TEXT NOT NULL,
          description TEXT,
          priority INTEGER NOT NULL,
          enabled BOOLEAN NOT NULL DEFAULT true,
          conditions JSONB NOT NULL DEFAULT '{}'::jsonb,
          actions JSONB NOT NULL DEFAULT '{}'::jsonb,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
        );
      `
    });

    if (rulesError && !rulesError.message.includes('already exists')) {
      console.error('❌ Error creating assignment_rules table:', rulesError.message);
    } else {
      console.log('✅ assignment_rules table created/verified');
    }

    // Create assignment_config table
    console.log('📝 Creating assignment_config table...');
    const { error: configError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS public.assignment_config (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          workload_weight INTEGER NOT NULL DEFAULT 40,
          performance_weight INTEGER NOT NULL DEFAULT 30,
          availability_weight INTEGER NOT NULL DEFAULT 30,
          max_concurrent_tickets INTEGER NOT NULL DEFAULT 10,
          business_hours JSONB NOT NULL DEFAULT '{"start": "09:00", "end": "17:00", "timezone": "UTC"}'::jsonb,
          auto_rebalance BOOLEAN NOT NULL DEFAULT false,
          rebalance_threshold INTEGER NOT NULL DEFAULT 80,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
        );
      `
    });

    if (configError && !configError.message.includes('already exists')) {
      console.error('❌ Error creating assignment_config table:', configError.message);
    } else {
      console.log('✅ assignment_config table created/verified');
    }

    // Insert default configuration
    console.log('📝 Inserting default configuration...');
    const { error: insertConfigError } = await supabase
      .from('assignment_config')
      .upsert({
        workload_weight: 40,
        performance_weight: 30,
        availability_weight: 30,
        max_concurrent_tickets: 10,
        business_hours: { start: "09:00", end: "17:00", timezone: "UTC" },
        auto_rebalance: false,
        rebalance_threshold: 80
      }, { onConflict: 'id' });

    if (insertConfigError) {
      console.error('❌ Error inserting default config:', insertConfigError.message);
    } else {
      console.log('✅ Default configuration inserted');
    }

    // Insert default rules
    console.log('📝 Inserting default assignment rules...');
    const defaultRules = [
      {
        name: 'Urgent Tickets to Senior Agents',
        description: 'Assign urgent priority tickets to experienced agents',
        priority: 1,
        enabled: true,
        conditions: { priorities: ["urgent"] },
        actions: { requireSkills: ["senior"], maxResponseTime: 15, notifyManager: true }
      },
      {
        name: 'Technical Issues to IT Team',
        description: 'Route technical category tickets to IT specialists',
        priority: 2,
        enabled: true,
        conditions: { categories: ["technical", "software"], keywords: ["server", "network", "database", "api", "bug", "error"] },
        actions: { assignToTeam: "it-team", requireSkills: ["technical"], maxResponseTime: 30 }
      },
      {
        name: 'High Priority Business Hours',
        description: 'Assign high priority tickets during business hours to available agents',
        priority: 3,
        enabled: true,
        conditions: { priorities: ["high"], timeOfDay: { start: "09:00", end: "17:00" } },
        actions: { maxResponseTime: 20, notifyManager: false }
      },
      {
        name: 'After Hours to On-Call',
        description: 'Assign tickets outside business hours to on-call agents',
        priority: 4,
        enabled: false,
        conditions: { timeOfDay: { start: "18:00", end: "08:00" } },
        actions: { assignToTeam: "on-call", escalateAfter: 60, notifyManager: true }
      }
    ];

    for (const rule of defaultRules) {
      const { error: ruleError } = await supabase
        .from('assignment_rules')
        .upsert(rule, { onConflict: 'name' });

      if (ruleError) {
        console.error(`❌ Error inserting rule "${rule.name}":`, ruleError.message);
      } else {
        console.log(`✅ Rule "${rule.name}" inserted`);
      }
    }

    // Enable RLS
    console.log('🔒 Enabling Row Level Security...');
    await supabase.rpc('exec_sql', {
      sql: `
        ALTER TABLE public.assignment_rules ENABLE ROW LEVEL SECURITY;
        ALTER TABLE public.assignment_config ENABLE ROW LEVEL SECURITY;
      `
    });

    // Create RLS policies
    console.log('🔒 Creating RLS policies...');
    await supabase.rpc('exec_sql', {
      sql: `
        DROP POLICY IF EXISTS assignment_rules_admin_policy ON public.assignment_rules;
        CREATE POLICY assignment_rules_admin_policy ON public.assignment_rules
          FOR ALL
          TO authenticated
          USING (
            EXISTS (
              SELECT 1 FROM public.users 
              WHERE users.id = auth.uid() 
              AND users.role = 'admin'
            )
          );

        DROP POLICY IF EXISTS assignment_config_admin_policy ON public.assignment_config;
        CREATE POLICY assignment_config_admin_policy ON public.assignment_config
          FOR ALL
          TO authenticated
          USING (
            EXISTS (
              SELECT 1 FROM public.users 
              WHERE users.id = auth.uid() 
              AND users.role = 'admin'
            )
          );
      `
    });

    console.log('✅ RLS policies created');

    // Create indexes
    console.log('📊 Creating indexes...');
    await supabase.rpc('exec_sql', {
      sql: `
        CREATE INDEX IF NOT EXISTS idx_assignment_rules_priority ON public.assignment_rules(priority);
        CREATE INDEX IF NOT EXISTS idx_assignment_rules_enabled ON public.assignment_rules(enabled);
      `
    });

    console.log('✅ Indexes created');

    // Verify tables
    console.log('🔍 Verifying tables...');
    const { data: rules, error: verifyRulesError } = await supabase
      .from('assignment_rules')
      .select('count', { count: 'exact', head: true });

    const { data: config, error: verifyConfigError } = await supabase
      .from('assignment_config')
      .select('count', { count: 'exact', head: true });

    if (verifyRulesError) {
      console.error('❌ Rules table verification failed:', verifyRulesError.message);
    } else {
      console.log('✅ assignment_rules table verified');
    }

    if (verifyConfigError) {
      console.error('❌ Config table verification failed:', verifyConfigError.message);
    } else {
      console.log('✅ assignment_config table verified');
    }

    console.log('🎉 Assignment system tables setup completed successfully!');

  } catch (error) {
    console.error('❌ Failed to create assignment tables:', error);
    process.exit(1);
  }
}

createAssignmentTables();