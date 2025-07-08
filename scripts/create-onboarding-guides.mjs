import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize Supabase client
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://xrppcrvjgxwlcbbafxzh.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhycHBjcnZqZ3h3bGNiYmFmeHpoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzUzOTE3OTMsImV4cCI6MjA1MDk2Nzc5M30.qoAZUZNqF5OzU0pIAXPY5F-xGt_2l0DMGZS9idbGP6Y';

const supabase = createClient(supabaseUrl, supabaseKey);

// Utility function to create URL-safe slugs
function createSlug(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Calculate reading time (words per minute average: 200)
function calculateReadingTime(content) {
  const wordCount = content.split(/\s+/).length;
  return Math.ceil(wordCount / 200);
}

// Generate excerpt from content
function generateExcerpt(content, maxLength = 200) {
  // Remove markdown headers, lists, and other formatting
  const cleanContent = content
    .replace(/#{1,6}\s+/g, '') // Remove headers
    .replace(/[-*+]\s+/g, '') // Remove list items
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Remove links, keep text
    .replace(/`([^`]+)`/g, '$1') // Remove inline code
    .replace(/\*\*([^*]+)\*\*/g, '$1') // Remove bold
    .replace(/\*([^*]+)\*/g, '$1') // Remove italic
    .replace(/\n+/g, ' ') // Replace newlines with spaces
    .trim();

  if (cleanContent.length <= maxLength) {
    return cleanContent;
  }

  return cleanContent.substring(0, maxLength).replace(/\s+\w*$/, '') + '...';
}

// Onboarding guides data
const onboardingGuides = [
  {
    title: 'Getting Started with Analy-Ticket',
    filename: '01-getting-started.md',
    categoryName: 'Getting Started',
    featured: true,
    tags: ['onboarding', 'basics', 'introduction', 'new-users']
  },
  {
    title: 'End User Guide: Creating and Managing Tickets',
    filename: '02-end-user-guide.md',
    categoryName: 'User Guides',
    featured: true,
    tags: ['end-users', 'tickets', 'creating-tickets', 'tracking']
  },
  {
    title: 'Agent Guide: Managing Tickets and Customer Support',
    filename: '03-agent-guide.md',
    categoryName: 'Agent Guides',
    featured: true,
    tags: ['agents', 'support', 'sla', 'customer-service']
  },
  {
    title: 'Administrator Guide: System Management and Configuration',
    filename: '04-administrator-guide.md',
    categoryName: 'Administrator Guides',
    featured: true,
    tags: ['administrators', 'configuration', 'user-management', 'system-admin']
  },
  {
    title: 'Knowledge Base Guide: Self-Service and Content Management',
    filename: '05-knowledge-base-guide.md',
    categoryName: 'Knowledge Management',
    featured: true,
    tags: ['knowledge-base', 'self-service', 'content', 'articles']
  },
  {
    title: 'Notifications and Communication Guide',
    filename: '06-notifications-communication.md',
    categoryName: 'Communication',
    featured: true,
    tags: ['notifications', 'communication', 'chat', 'email']
  }
];

// Knowledge Base categories
const categories = [
  {
    name: 'Getting Started',
    slug: 'getting-started',
    description: 'Essential guides for new users to get started with Analy-Ticket',
    icon: 'BookOpen',
    color: '#3B82F6',
    sort_order: 1
  },
  {
    name: 'User Guides',
    slug: 'user-guides',
    description: 'Comprehensive guides for end users creating and managing tickets',
    icon: 'User',
    color: '#10B981',
    sort_order: 2
  },
  {
    name: 'Agent Guides',
    slug: 'agent-guides',
    description: 'Professional guides for support agents managing customer requests',
    icon: 'UserCheck',
    color: '#F59E0B',
    sort_order: 3
  },
  {
    name: 'Administrator Guides',
    slug: 'administrator-guides',
    description: 'Advanced guides for system administrators and configuration',
    icon: 'Settings',
    color: '#8B5CF6',
    sort_order: 4
  },
  {
    name: 'Knowledge Management',
    slug: 'knowledge-management',
    description: 'Guides for managing and creating knowledge base content',
    icon: 'Database',
    color: '#EF4444',
    sort_order: 5
  },
  {
    name: 'Communication',
    slug: 'communication',
    description: 'Guides for notifications, chat, and communication features',
    icon: 'MessageCircle',
    color: '#06B6D4',
    sort_order: 6
  }
];

async function getAdminUser() {
  const { data: users, error } = await supabase
    .from('users')
    .select('id')
    .eq('role', 'admin')
    .limit(1);

  if (error) {
    console.error('Error finding admin user:', error);
    return null;
  }

  if (!users || users.length === 0) {
    console.log('No admin user found. Creating with default admin...');
    // Try to find any user that could be an admin
    const { data: anyUsers, error: anyError } = await supabase
      .from('users')
      .select('id')
      .limit(1);

    if (anyError || !anyUsers || anyUsers.length === 0) {
      console.error('No users found in the system');
      return null;
    }

    return anyUsers[0].id;
  }

  return users[0].id;
}

async function createCategories() {
  console.log('Creating knowledge base categories...');
  
  for (const category of categories) {
    const { data, error } = await supabase
      .from('knowledge_categories')
      .upsert(category, { onConflict: 'slug' })
      .select();

    if (error) {
      console.error(`Error creating category ${category.name}:`, error);
    } else {
      console.log(`✓ Created/updated category: ${category.name}`);
    }
  }
}

async function createArticles(authorId) {
  console.log('Creating onboarding guide articles...');

  for (const guide of onboardingGuides) {
    try {
      // Read the markdown file
      const filePath = join(__dirname, '..', 'docs', 'onboarding-guides', guide.filename);
      const content = readFileSync(filePath, 'utf-8');

      // Get the category ID
      const { data: category } = await supabase
        .from('knowledge_categories')
        .select('id')
        .eq('name', guide.categoryName)
        .single();

      if (!category) {
        console.error(`Category not found: ${guide.categoryName}`);
        continue;
      }

      // Prepare article data
      const articleData = {
        title: guide.title,
        slug: createSlug(guide.title),
        content: content,
        excerpt: generateExcerpt(content),
        knowledge_category_id: category.id,
        author_id: authorId,
        status: 'published',
        is_published: true,
        tags: guide.tags,
        featured: guide.featured,
        reading_time_minutes: calculateReadingTime(content),
        meta_description: generateExcerpt(content, 150)
      };

      // Check if article already exists
      const { data: existingArticle } = await supabase
        .from('knowledge_articles')
        .select('id')
        .eq('slug', articleData.slug)
        .single();

      if (existingArticle) {
        // Update existing article
        const { data, error } = await supabase
          .from('knowledge_articles')
          .update(articleData)
          .eq('id', existingArticle.id)
          .select();

        if (error) {
          console.error(`Error updating article ${guide.title}:`, error);
        } else {
          console.log(`✓ Updated article: ${guide.title}`);
        }
      } else {
        // Create new article
        const { data, error } = await supabase
          .from('knowledge_articles')
          .insert(articleData)
          .select();

        if (error) {
          console.error(`Error creating article ${guide.title}:`, error);
        } else {
          console.log(`✓ Created article: ${guide.title}`);
        }
      }
    } catch (error) {
      console.error(`Error processing guide ${guide.filename}:`, error);
    }
  }
}

async function main() {
  console.log('🚀 Starting onboarding guides creation...');

  try {
    // Get admin user
    const adminId = await getAdminUser();
    if (!adminId) {
      console.error('❌ No admin user found. Please create an admin user first.');
      process.exit(1);
    }

    console.log(`📝 Using admin user ID: ${adminId}`);

    // Create categories
    await createCategories();

    // Create articles
    await createArticles(adminId);

    console.log('✅ Onboarding guides creation completed successfully!');
    console.log('\n📚 The following guides have been added to your Knowledge Base:');
    
    onboardingGuides.forEach((guide, index) => {
      console.log(`${index + 1}. ${guide.title}`);
    });

    console.log('\n🎯 You can now access these guides from the Knowledge Base section in your application.');
    console.log('💡 Users can browse these guides to learn how to use the system effectively.');

  } catch (error) {
    console.error('❌ Error creating onboarding guides:', error);
    process.exit(1);
  }
}

// Run the script
main(); 