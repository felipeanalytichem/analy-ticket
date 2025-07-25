#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Supabase configuration
const supabaseUrl = 'https://plbmgjqitlxedsmdqpld.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceKey) {
  console.error('SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyTables() {
  try {
    console.log('🚀 Creating assignment and category expertise tables...');

    // Create assignment_rules table
    console.log('📝 Creating assignment_rules table...');
    await supabase.rpc('exec_sql', {
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

    // Create assignment_config table
    console.log('📝 Creating assignment_config table...');
    await supabase.rpc('exec_sql', {
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

    console.log('✅ Assignment tables created');
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

applyTables();