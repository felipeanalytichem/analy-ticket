import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://plbmgjqitlxedsmdqpld.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYm1nanFpdGx4ZWRzbWRxcGxkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkxNTIyMjYsImV4cCI6MjA2NDcyODIyNn0.m6MsXWqI6TbJQ1EeaX8R7L7GHzA23ZaffCmKrVdVD_U";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function verifyTables() {
  try {
    // Check knowledge_categories table
    const { data: categories, error: categoriesError } = await supabase
      .from('knowledge_categories')
      .select('*')
      .limit(1);

    if (categoriesError) {
      console.error('Error checking knowledge_categories table:', categoriesError);
    } else {
      console.log('✅ knowledge_categories table exists');
    }

    // Check knowledge_articles table
    const { data: articles, error: articlesError } = await supabase
      .from('knowledge_articles')
      .select('*')
      .limit(1);

    if (articlesError) {
      console.error('Error checking knowledge_articles table:', articlesError);
    } else {
      console.log('✅ knowledge_articles table exists');
    }

    // Check knowledge_article_versions table
    const { data: versions, error: versionsError } = await supabase
      .from('knowledge_article_versions')
      .select('*')
      .limit(1);

    if (versionsError) {
      console.error('Error checking knowledge_article_versions table:', versionsError);
    } else {
      console.log('✅ knowledge_article_versions table exists');
    }

    // Check knowledge_article_attachments table
    const { data: attachments, error: attachmentsError } = await supabase
      .from('knowledge_article_attachments')
      .select('*')
      .limit(1);

    if (attachmentsError) {
      console.error('Error checking knowledge_article_attachments table:', attachmentsError);
    } else {
      console.log('✅ knowledge_article_attachments table exists');
    }

    // Check knowledge_article_feedback table
    const { data: feedback, error: feedbackError } = await supabase
      .from('knowledge_article_feedback')
      .select('*')
      .limit(1);

    if (feedbackError) {
      console.error('Error checking knowledge_article_feedback table:', feedbackError);
    } else {
      console.log('✅ knowledge_article_feedback table exists');
    }

    // Try to create a test category
    const { data: newCategory, error: createError } = await supabase
      .from('knowledge_categories')
      .insert([
        {
          name: 'Test Category',
          description: 'A test category'
        }
      ])
      .select();

    if (createError) {
      console.error('Error creating test category:', createError);
    } else {
      console.log('✅ Successfully created a test category');
      console.log('Test category:', newCategory[0]);

      // Clean up test data
      const { error: deleteError } = await supabase
        .from('knowledge_categories')
        .delete()
        .eq('id', newCategory[0].id);

      if (deleteError) {
        console.error('Error deleting test category:', deleteError);
      } else {
        console.log('✅ Successfully cleaned up test data');
      }
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

verifyTables(); 