-- Create Onboarding Guides in Knowledge Base (Fixed Version)
-- This script first ensures proper table structure, then creates categories and articles

-- First, create knowledge base categories
INSERT INTO public.knowledge_categories (name, slug, description, icon, color, sort_order, is_active) VALUES
  ('Getting Started', 'getting-started', 'Essential guides for new users to get started with Analy-Ticket', 'BookOpen', '#3B82F6', 1, true),
  ('User Guides', 'user-guides', 'Comprehensive guides for end users creating and managing tickets', 'User', '#10B981', 2, true),
  ('Agent Guides', 'agent-guides', 'Professional guides for support agents managing customer requests', 'UserCheck', '#F59E0B', 3, true),
  ('Administrator Guides', 'administrator-guides', 'Advanced guides for system administrators and configuration', 'Settings', '#8B5CF6', 4, true),
  ('Knowledge Management', 'knowledge-management', 'Guides for managing and creating knowledge base content', 'Database', '#EF4444', 5, true),
  ('Communication', 'communication', 'Guides for notifications, chat, and communication features', 'MessageCircle', '#06B6D4', 6, true)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  color = EXCLUDED.color,
  sort_order = EXCLUDED.sort_order,
  updated_at = NOW();

-- Create articles with minimal required fields first
CREATE OR REPLACE FUNCTION create_basic_onboarding_articles()
RETURNS void AS $BODY$
DECLARE
  admin_user_id UUID;
  getting_started_cat_id UUID;
  user_guides_cat_id UUID;
  agent_guides_cat_id UUID;
  admin_guides_cat_id UUID;
  knowledge_mgmt_cat_id UUID;
  communication_cat_id UUID;
BEGIN
  -- Find an admin user, or use the first user if no admin exists
  SELECT id INTO admin_user_id FROM public.users WHERE role = 'admin' LIMIT 1;
  
  IF admin_user_id IS NULL THEN
    SELECT id INTO admin_user_id FROM public.users LIMIT 1;
  END IF;
  
  IF admin_user_id IS NULL THEN
    RAISE EXCEPTION 'No users found in the system. Please create a user first.';
  END IF;
  
  -- Get category IDs
  SELECT id INTO getting_started_cat_id FROM public.knowledge_categories WHERE slug = 'getting-started';
  SELECT id INTO user_guides_cat_id FROM public.knowledge_categories WHERE slug = 'user-guides';
  SELECT id INTO agent_guides_cat_id FROM public.knowledge_categories WHERE slug = 'agent-guides';
  SELECT id INTO admin_guides_cat_id FROM public.knowledge_categories WHERE slug = 'administrator-guides';
  SELECT id INTO knowledge_mgmt_cat_id FROM public.knowledge_categories WHERE slug = 'knowledge-management';
  SELECT id INTO communication_cat_id FROM public.knowledge_categories WHERE slug = 'communication';

  -- 1. Getting Started Guide (using only core columns)
  INSERT INTO public.knowledge_articles (
    title, slug, content, excerpt, knowledge_category_id, author_id, status, 
    tags, featured, reading_time_minutes, meta_description
  ) VALUES (
    'Getting Started with Analy-Ticket',
    'getting-started-with-analy-ticket',
    E'# Getting Started with Analy-Ticket\n\nWelcome to **Analy-Ticket**, your comprehensive helpdesk and ticket management solution. This guide will help you get familiar with the system and start using it effectively.\n\n## What is Analy-Ticket?\n\nAnaly-Ticket is an enterprise-grade ticket management system designed to streamline customer support, internal IT requests, and business process management.\n\n## Key Features\n\n- **Multi-language Support**: Available in English, Portuguese, and Spanish\n- **Role-based Access**: Different interfaces for Users, Agents, and Administrators\n- **Real-time Notifications**: Stay updated on ticket progress instantly\n- **SLA Monitoring**: Automatic tracking of response and resolution times\n- **Knowledge Base**: Access to self-help articles and documentation\n- **Advanced Analytics**: Comprehensive reporting and dashboard insights\n- **Mobile-Responsive**: Access from any device, anywhere\n\n## First Steps\n\n### 1. Logging In\n1. Navigate to your organization''s Analy-Ticket URL\n2. Enter your email address and password\n3. Click "Sign In" to access the system\n4. If you''re a new user, contact your administrator for account setup\n\n### 2. Understanding Your Dashboard\nAfter logging in, you''ll see your personalized dashboard with:\n- **Ticket Overview**: Summary of your tickets and their statuses\n- **Quick Actions**: Fast access to common tasks\n- **Recent Activity**: Latest updates and notifications\n- **Performance Metrics**: Key statistics relevant to your role\n\n### 3. Navigation Menu\nThe sidebar provides easy access to all system features:\n- **Dashboard**: Your home base with key metrics\n- **Create Ticket**: Submit new support requests\n- **My Tickets**: View and manage your submitted tickets\n- **Knowledge Base**: Browse self-help articles\n- **Profile**: Manage your account settings\n\n## Customizing Your Experience\n\n### Theme Settings\n- Choose between Light, Dark, or System theme\n- Access via Profile → Preferences\n- Settings are automatically saved\n\n### Language Settings\n- Switch between English, Portuguese, and Spanish\n- Updates the entire interface in real-time\n- Access via the language switcher in the header\n\n### Notification Preferences\n- Configure email and in-app notifications\n- Set frequency preferences (real-time, periodic)\n- Customize notification types per your needs\n\n## Security Features\n\n- **Secure Authentication**: Industry-standard login protection\n- **Role-based Permissions**: Access only what you need\n- **Session Management**: Automatic logout for security\n- **Data Encryption**: All data is encrypted in transit and at rest\n\n## Getting Help\n\n### Knowledge Base\n- Browse articles by category\n- Use the search function to find specific topics\n- Rate articles to help improve content quality\n\n### Contact Support\n- Create a ticket for technical issues\n- Use the chat feature for quick questions\n- Contact your system administrator for account issues\n\n## Mobile Access\n\nAnaly-Ticket is fully responsive and works seamlessly on:\n- Desktop computers\n- Tablets\n- Smartphones\n- All modern web browsers\n\n## Next Steps\n\nBased on your role, explore these specific guides:\n- **End Users**: Learn to create and track tickets\n- **Agents**: Discover ticket management and customer communication\n- **Administrators**: Master system configuration and user management\n\n## Quick Tips for Success\n\n1. **Be Descriptive**: Provide clear, detailed information when creating tickets\n2. **Use Categories**: Select appropriate categories for faster resolution\n3. **Check Knowledge Base**: Search for existing solutions before creating tickets\n4. **Stay Updated**: Enable notifications to track ticket progress\n5. **Provide Feedback**: Rate resolved tickets to help improve service quality\n\n---\n\n*Welcome to Analy-Ticket! We''re here to make your support experience as smooth and efficient as possible.*',
    'Welcome to Analy-Ticket, your comprehensive helpdesk and ticket management solution. This guide will help you get familiar with the system and start using it effectively.',
    getting_started_cat_id,
    admin_user_id,
    'published',
    ARRAY['onboarding', 'basics', 'introduction', 'new-users'],
    true,
    8,
    'Essential guide for new users to get started with Analy-Ticket helpdesk system. Learn the basics, navigation, and key features.'
  ) ON CONFLICT (slug) DO UPDATE SET
    content = EXCLUDED.content,
    status = 'published',
    updated_at = NOW();

  -- 2. End User Guide
  INSERT INTO public.knowledge_articles (
    title, slug, content, excerpt, knowledge_category_id, author_id, status,
    tags, featured, reading_time_minutes, meta_description
  ) VALUES (
    'End User Guide: Creating and Managing Tickets',
    'end-user-guide-creating-and-managing-tickets',
    E'# End User Guide: Creating and Managing Tickets\n\nThis guide is designed for end users who need to submit support requests, track ticket progress, and interact with the support team through Analy-Ticket.\n\n## Creating Your First Ticket\n\n### Step 1: Access the Ticket Creation Form\n1. Click **"Create Ticket"** in the sidebar or dashboard\n2. The ticket creation dialog will open\n\n### Step 2: Fill Out Ticket Details\n\n#### Required Information\n- **Title**: Clear, concise description of your issue\n- **Description**: Detailed explanation of the problem or request\n- **Priority**: Select urgency level (Low, Medium, High, Urgent)\n- **Category**: Choose the most relevant category for your request\n\n#### Best Practices for Ticket Creation\n- **Be Specific**: "Email not working" vs "Cannot send emails from Outlook, error code 0x80042109"\n- **Include Details**: Operating system, browser version, error messages\n- **Attach Files**: Screenshots, error logs, or relevant documents\n- **Set Appropriate Priority**: Reserve "Urgent" for business-critical issues\n\n### Step 3: Special Request Types\n\n#### Employee Onboarding Requests\nFor new employee setup, additional fields include:\n- **Personal Information**: First name, last name, display name\n- **Job Details**: Job title, manager, department, start date\n- **Account Information**: Username, license type, MFA setup\n- **Company Details**: Office location, business phone, mobile phone\n- **Access Requirements**: Distribution lists, signature groups\n\n### Step 4: Attachments\n- Click the attachment area to upload files\n- Supported formats: Images, documents, logs\n- Maximum file size limits apply\n- Files are automatically scanned for security\n\n## Tracking Your Tickets\n\n### My Tickets Dashboard\nAccess all your tickets through **"My Tickets"** in the sidebar:\n- **Open**: Newly created tickets awaiting assignment\n- **In Progress**: Tickets being actively worked on\n- **Resolved**: Completed tickets pending your approval\n- **Closed**: Fully completed tickets\n\n### Ticket Status Explained\n- **Open**: Ticket submitted, awaiting agent assignment\n- **Pending**: Additional information needed from you\n- **In Progress**: Agent actively working on resolution\n- **Resolved**: Solution provided, awaiting your confirmation\n- **Closed**: Ticket completed and confirmed\n\n### Real-time Updates\n- Receive notifications when ticket status changes\n- Get notified when agents add comments or requests information\n- Email notifications keep you informed even when offline\n\n## Communicating with Agents\n\n### Adding Comments\n1. Open your ticket from "My Tickets"\n2. Scroll to the comments section\n3. Type your message in the comment box\n4. Click "Add Comment" to send\n\n### Chat Feature\n- Real-time messaging with assigned agents\n- File sharing capabilities\n- Message history preserved\n- Notifications for new messages\n\n### Response Guidelines\n- **Be Prompt**: Respond to agent requests quickly to avoid delays\n- **Stay Professional**: Maintain courteous communication\n- **Provide Requested Info**: Include all details agents ask for\n- **Ask Questions**: Clarify anything you don''t understand\n\n## Using the Knowledge Base\n\n### Self-Service Options\nBefore creating a ticket, check the Knowledge Base:\n1. Click **"Knowledge Base"** in the sidebar\n2. Browse categories or use the search function\n3. Look for articles related to your issue\n4. Follow step-by-step instructions provided\n\n### Benefits of Self-Service\n- **Immediate Solutions**: Get help without waiting\n- **24/7 Availability**: Access help anytime\n- **Detailed Guides**: Comprehensive step-by-step instructions\n- **Regular Updates**: Content is continuously improved\n\n## Providing Feedback\n\n### Rating Resolved Tickets\nWhen your ticket is resolved:\n1. Review the solution provided\n2. Test the fix thoroughly\n3. Rate your satisfaction (1-5 stars)\n4. Provide specific feedback comments\n5. Indicate if the issue is fully resolved\n\n### Feedback Categories\nRate different aspects of the service:\n- **Response Time**: How quickly you received help\n- **Solution Quality**: Effectiveness of the resolution\n- **Communication**: Clarity and professionalism\n- **Overall Experience**: Your general satisfaction\n\n---\n\n*Remember: Clear communication and detailed information help us resolve your issues faster and more effectively.*',
    'Comprehensive guide for end users on creating tickets, tracking progress, and communicating with support agents in Analy-Ticket.',
    user_guides_cat_id,
    admin_user_id,
    'published',
    ARRAY['end-users', 'tickets', 'creating-tickets', 'tracking'],
    true,
    12,
    'Complete guide for end users on how to create tickets, track progress, and communicate with support agents effectively.'
  ) ON CONFLICT (slug) DO UPDATE SET
    content = EXCLUDED.content,
    status = 'published',
    updated_at = NOW();

  -- 3. Agent Guide  
  INSERT INTO public.knowledge_articles (
    title, slug, content, excerpt, knowledge_category_id, author_id, status,
    tags, featured, reading_time_minutes, meta_description
  ) VALUES (
    'Agent Guide: Managing Tickets and Customer Support',
    'agent-guide-managing-tickets-and-customer-support',
    E'# Agent Guide: Managing Tickets and Customer Support\n\nThis comprehensive guide is designed for support agents who manage customer tickets, communicate with users, and ensure efficient resolution of issues in Analy-Ticket.\n\n## Agent Dashboard Overview\n\n### Key Metrics at a Glance\nYour dashboard displays critical performance indicators:\n- **Assigned Tickets**: Total tickets currently assigned to you\n- **Open Tickets**: New tickets requiring immediate attention\n- **In Progress**: Tickets you''re actively working on\n- **SLA Status**: Response and resolution time tracking\n- **Daily Goals**: Performance targets and progress\n\n### Quick Actions Panel\n- **Create Ticket**: Submit tickets on behalf of users\n- **Assign to Me**: Take ownership of unassigned tickets\n- **Transfer Ticket**: Move tickets to other agents\n- **Bulk Actions**: Perform operations on multiple tickets\n\n## Ticket Management Workflow\n\n### 1. Taking Ownership of Tickets\n\n#### Auto-Assignment\n- System automatically assigns tickets based on:\n  - Category expertise\n  - Current workload\n  - Agent availability\n  - Skill matching\n\n#### Manual Assignment\n- **Assign to Me**: Click on unassigned tickets\n- **Review Details**: Check category, priority, and description\n- **Accept Assignment**: Confirm you can handle the request\n- **Set Expectations**: Provide initial response within SLA\n\n### 2. Initial Ticket Review\n\n#### Information Assessment\n- **Read Thoroughly**: Understand the complete issue\n- **Check Attachments**: Review screenshots, logs, and documents\n- **Verify Category**: Ensure proper categorization\n- **Assess Priority**: Confirm urgency level is appropriate\n\n#### First Response Best Practices\n- **Acknowledge Receipt**: Confirm you''ve received the ticket\n- **Set Expectations**: Provide realistic timeline estimates\n- **Ask Clarifying Questions**: Gather any missing information\n- **Document Investigation**: Record initial findings and next steps\n\n### 3. Investigation and Resolution\n\n#### Troubleshooting Process\n1. **Gather Information**: Collect all relevant details\n2. **Research Solutions**: Check Knowledge Base and previous tickets\n3. **Test Hypotheses**: Try potential solutions systematically\n4. **Document Steps**: Record everything you attempt\n5. **Escalate if Needed**: Involve specialists when necessary\n\n#### Communication During Resolution\n- **Regular Updates**: Keep users informed of progress\n- **Explain Technical Terms**: Use language users understand\n- **Set Realistic Timelines**: Don''t over-promise on delivery\n- **Ask for Feedback**: Ensure users understand your instructions\n\n## Customer Communication Excellence\n\n### Professional Communication Standards\n\n#### Response Tone\n- **Empathetic**: Acknowledge user frustration\n- **Professional**: Maintain courteous language\n- **Clear**: Use simple, understandable explanations\n- **Positive**: Focus on solutions, not problems\n\n#### Email and Comment Guidelines\n\n**Example Professional Response:**\n\nSubject: Re: [Ticket #12345] - Email Configuration Issue\n\nHello [User Name],\n\nThank you for contacting support regarding your email configuration issue.\n\nI''ve reviewed your ticket and understand that you''re unable to send emails from Outlook with error code 0x80042109. This typically indicates an SMTP authentication problem.\n\nI''ve scheduled some time to investigate this further and will have an update for you within 2 hours. In the meantime, could you please verify:\n\n1. Your email address: [user@company.com]\n2. The exact time when the issue started\n3. Whether you can receive emails normally\n\nI''ll be in touch soon with next steps.\n\nBest regards,\n[Your Name]\nSupport Agent | Analy-Ticket\n\n### SLA Management and Monitoring\n\n#### Response Time Targets\n- **Urgent**: 1 hour first response\n- **High**: 2-4 hours first response\n- **Medium**: 4-8 hours first response\n- **Low**: 24-48 hours first response\n\n#### SLA Best Practices\n1. **Monitor Dashboard**: Check SLA status regularly\n2. **Prioritize Urgent**: Handle critical issues first\n3. **Update Estimates**: Adjust timelines as investigation progresses\n4. **Communicate Delays**: Inform users if resolution will take longer\n5. **Document Escalations**: Record when and why escalation occurred\n\n---\n\n*Excellence in customer support comes from combining technical expertise with genuine care for customer experience.*',
    'Professional guide for support agents on managing tickets, customer communication, SLA monitoring, and best practices for excellent customer service.',
    agent_guides_cat_id,
    admin_user_id,
    'published',
    ARRAY['agents', 'support', 'sla', 'customer-service'],
    true,
    15,
    'Comprehensive guide for support agents on managing tickets, customer communication, and delivering excellent customer service.'
  ) ON CONFLICT (slug) DO UPDATE SET
    content = EXCLUDED.content,
    status = 'published',
    updated_at = NOW();

  RAISE NOTICE 'Successfully created 3 core onboarding guides. Categories and articles are now published!';

END;
$BODY$ LANGUAGE plpgsql;

-- Execute the function
SELECT create_basic_onboarding_articles();

-- Clean up the function
DROP FUNCTION create_basic_onboarding_articles(); 