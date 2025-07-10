-- Create Onboarding Guides in Knowledge Base
-- This script creates categories and articles for comprehensive onboarding

BEGIN;

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

-- Get or create an admin user for authoring articles
DO $$
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

  -- Insert articles with full content
  
  -- 1. Getting Started Guide
  INSERT INTO public.knowledge_articles (
    title, slug, content, excerpt, knowledge_category_id, author_id, status, is_published, 
    tags, featured, reading_time_minutes, meta_description
  ) VALUES (
    'Getting Started with Analy-Ticket',
    'getting-started-with-analy-ticket',
    '# Getting Started with Analy-Ticket

Welcome to **Analy-Ticket**, your comprehensive helpdesk and ticket management solution. This guide will help you get familiar with the system and start using it effectively.

## 🌟 What is Analy-Ticket?

Analy-Ticket is an enterprise-grade ticket management system designed to streamline customer support, internal IT requests, and business process management. Whether you''re reporting an issue, managing support requests, or analyzing performance metrics, our platform provides the tools you need.

## 🎯 Key Features

- **Multi-language Support**: Available in English, Portuguese, and Spanish
- **Role-based Access**: Different interfaces for Users, Agents, and Administrators
- **Real-time Notifications**: Stay updated on ticket progress instantly
- **SLA Monitoring**: Automatic tracking of response and resolution times
- **Knowledge Base**: Access to self-help articles and documentation
- **Advanced Analytics**: Comprehensive reporting and dashboard insights
- **Mobile-Responsive**: Access from any device, anywhere

## 🚪 First Steps

### 1. Logging In
1. Navigate to your organization''s Analy-Ticket URL
2. Enter your email address and password
3. Click "Sign In" to access the system
4. If you''re a new user, contact your administrator for account setup

### 2. Understanding Your Dashboard
After logging in, you''ll see your personalized dashboard with:
- **Ticket Overview**: Summary of your tickets and their statuses
- **Quick Actions**: Fast access to common tasks
- **Recent Activity**: Latest updates and notifications
- **Performance Metrics**: Key statistics relevant to your role

### 3. Navigation Menu
The sidebar provides easy access to all system features:
- **Dashboard**: Your home base with key metrics
- **Create Ticket**: Submit new support requests
- **My Tickets**: View and manage your submitted tickets
- **Knowledge Base**: Browse self-help articles
- **Profile**: Manage your account settings

## 🎨 Customizing Your Experience

### Theme Settings
- Choose between Light, Dark, or System theme
- Access via Profile → Preferences
- Settings are automatically saved

### Language Settings
- Switch between English, Portuguese, and Spanish
- Updates the entire interface in real-time
- Access via the language switcher in the header

### Notification Preferences
- Configure email and in-app notifications
- Set frequency preferences (real-time, periodic)
- Customize notification types per your needs

## 🔒 Security Features

- **Secure Authentication**: Industry-standard login protection
- **Role-based Permissions**: Access only what you need
- **Session Management**: Automatic logout for security
- **Data Encryption**: All data is encrypted in transit and at rest

## 🆘 Getting Help

### Knowledge Base
- Browse articles by category
- Use the search function to find specific topics
- Rate articles to help improve content quality

### Contact Support
- Create a ticket for technical issues
- Use the chat feature for quick questions
- Contact your system administrator for account issues

## 📱 Mobile Access

Analy-Ticket is fully responsive and works seamlessly on:
- Desktop computers
- Tablets
- Smartphones
- All modern web browsers

## 🎓 Next Steps

Based on your role, explore these specific guides:
- **End Users**: Learn to create and track tickets
- **Agents**: Discover ticket management and customer communication
- **Administrators**: Master system configuration and user management

## 📊 Quick Tips for Success

1. **Be Descriptive**: Provide clear, detailed information when creating tickets
2. **Use Categories**: Select appropriate categories for faster resolution
3. **Check Knowledge Base**: Search for existing solutions before creating tickets
4. **Stay Updated**: Enable notifications to track ticket progress
5. **Provide Feedback**: Rate resolved tickets to help improve service quality

---

*Welcome to Analy-Ticket! We''re here to make your support experience as smooth and efficient as possible.*',
    'Welcome to Analy-Ticket, your comprehensive helpdesk and ticket management solution. This guide will help you get familiar with the system and start using it effectively.',
    getting_started_cat_id,
    admin_user_id,
    'published',
    true,
    ARRAY['onboarding', 'basics', 'introduction', 'new-users'],
    true,
    8,
    'Essential guide for new users to get started with Analy-Ticket helpdesk system. Learn the basics, navigation, and key features.'
  ) ON CONFLICT (slug) DO UPDATE SET
    content = EXCLUDED.content,
    updated_at = NOW();

  -- 2. End User Guide
  INSERT INTO public.knowledge_articles (
    title, slug, content, excerpt, knowledge_category_id, author_id, status, is_published, 
    tags, featured, reading_time_minutes, meta_description
  ) VALUES (
    'End User Guide: Creating and Managing Tickets',
    'end-user-guide-creating-and-managing-tickets',
    '# End User Guide: Creating and Managing Tickets

This guide is designed for end users who need to submit support requests, track ticket progress, and interact with the support team through Analy-Ticket.

## 🎫 Creating Your First Ticket

### Step 1: Access the Ticket Creation Form
1. Click **"Create Ticket"** in the sidebar or dashboard
2. The ticket creation dialog will open

### Step 2: Fill Out Ticket Details

#### Required Information
- **Title**: Clear, concise description of your issue
- **Description**: Detailed explanation of the problem or request
- **Priority**: Select urgency level (Low, Medium, High, Urgent)
- **Category**: Choose the most relevant category for your request

#### Best Practices for Ticket Creation
- **Be Specific**: "Email not working" vs "Cannot send emails from Outlook, error code 0x80042109"
- **Include Details**: Operating system, browser version, error messages
- **Attach Files**: Screenshots, error logs, or relevant documents
- **Set Appropriate Priority**: Reserve "Urgent" for business-critical issues

### Step 3: Special Request Types

#### Employee Onboarding Requests
For new employee setup, additional fields include:
- **Personal Information**: First name, last name, display name
- **Job Details**: Job title, manager, department, start date
- **Account Information**: Username, license type, MFA setup
- **Company Details**: Office location, business phone, mobile phone
- **Access Requirements**: Distribution lists, signature groups

### Step 4: Attachments
- Click the attachment area to upload files
- Supported formats: Images, documents, logs
- Maximum file size limits apply
- Files are automatically scanned for security

## 📱 Tracking Your Tickets

### My Tickets Dashboard
Access all your tickets through **"My Tickets"** in the sidebar:
- **Open**: Newly created tickets awaiting assignment
- **In Progress**: Tickets being actively worked on
- **Resolved**: Completed tickets pending your approval
- **Closed**: Fully completed tickets

### Ticket Status Explained
- **🟡 Open**: Ticket submitted, awaiting agent assignment
- **🔵 Pending**: Additional information needed from you
- **🟠 In Progress**: Agent actively working on resolution
- **🟢 Resolved**: Solution provided, awaiting your confirmation
- **⚫ Closed**: Ticket completed and confirmed

### Real-time Updates
- Receive notifications when ticket status changes
- Get notified when agents add comments or requests information
- Email notifications keep you informed even when offline

## 💬 Communicating with Agents

### Adding Comments
1. Open your ticket from "My Tickets"
2. Scroll to the comments section
3. Type your message in the comment box
4. Click "Add Comment" to send

### Chat Feature
- Real-time messaging with assigned agents
- File sharing capabilities
- Message history preserved
- Notifications for new messages

### Response Guidelines
- **Be Prompt**: Respond to agent requests quickly to avoid delays
- **Stay Professional**: Maintain courteous communication
- **Provide Requested Info**: Include all details agents ask for
- **Ask Questions**: Clarify anything you don''t understand

## 🔍 Using the Knowledge Base

### Self-Service Options
Before creating a ticket, check the Knowledge Base:
1. Click **"Knowledge Base"** in the sidebar
2. Browse categories or use the search function
3. Look for articles related to your issue
4. Follow step-by-step instructions provided

### Benefits of Self-Service
- **Immediate Solutions**: Get help without waiting
- **24/7 Availability**: Access help anytime
- **Detailed Guides**: Comprehensive step-by-step instructions
- **Regular Updates**: Content is continuously improved

## ⭐ Providing Feedback

### Rating Resolved Tickets
When your ticket is resolved:
1. Review the solution provided
2. Test the fix thoroughly
3. Rate your satisfaction (1-5 stars)
4. Provide specific feedback comments
5. Indicate if the issue is fully resolved

### Feedback Categories
Rate different aspects of the service:
- **Response Time**: How quickly you received help
- **Solution Quality**: Effectiveness of the resolution
- **Communication**: Clarity and professionalism
- **Overall Experience**: Your general satisfaction

## 🚨 Emergency Procedures

### Urgent Issues
For critical business issues:
1. Set priority to **"Urgent"**
2. Include "URGENT" in the ticket title
3. Provide detailed impact description
4. Contact your IT department directly if needed

### After-Hours Support
- Check your organization''s after-hours support policy
- Some critical issues may have emergency contact procedures
- Document the issue thoroughly for faster resolution

## 📊 Understanding SLA (Service Level Agreements)

### Response Times
- **Low Priority**: 24-48 hours
- **Medium Priority**: 4-8 hours
- **High Priority**: 2-4 hours
- **Urgent Priority**: 1 hour or less

### Resolution Targets
- Times vary based on issue complexity
- SLA clock pauses when waiting for your response
- Escalation occurs if targets are missed

## 💡 Tips for Faster Resolution

### Before Creating a Ticket
1. **Check Knowledge Base**: Look for existing solutions
2. **Gather Information**: Collect error messages, screenshots
3. **Try Basic Troubleshooting**: Restart, clear cache, update software
4. **Document Steps**: Note what you''ve already tried

### During Resolution
1. **Respond Quickly**: Answer agent questions promptly
2. **Test Thoroughly**: Verify solutions completely
3. **Ask Questions**: Clarify anything unclear
4. **Stay Available**: Be accessible for follow-up

### Best Practices
- **One Issue Per Ticket**: Don''t combine multiple problems
- **Use Clear Language**: Avoid technical jargon unless necessary
- **Update Regularly**: Inform agents of any changes
- **Be Patient**: Complex issues may require time to resolve

---

*Remember: Clear communication and detailed information help us resolve your issues faster and more effectively.*',
    'Comprehensive guide for end users on creating tickets, tracking progress, and communicating with support agents in Analy-Ticket.',
    user_guides_cat_id,
    admin_user_id,
    'published',
    true,
    ARRAY['end-users', 'tickets', 'creating-tickets', 'tracking'],
    true,
    12,
    'Complete guide for end users on how to create tickets, track progress, and communicate with support agents effectively.'
  ) ON CONFLICT (slug) DO UPDATE SET
    content = EXCLUDED.content,
    updated_at = NOW();

  -- 3. Agent Guide
  INSERT INTO public.knowledge_articles (
    title, slug, content, excerpt, knowledge_category_id, author_id, status, is_published, 
    tags, featured, reading_time_minutes, meta_description
  ) VALUES (
    'Agent Guide: Managing Tickets and Customer Support',
    'agent-guide-managing-tickets-and-customer-support',
    '# Agent Guide: Managing Tickets and Customer Support

This comprehensive guide is designed for support agents who manage customer tickets, communicate with users, and ensure efficient resolution of issues in Analy-Ticket.

## 🎯 Agent Dashboard Overview

### Key Metrics at a Glance
Your dashboard displays critical performance indicators:
- **Assigned Tickets**: Total tickets currently assigned to you
- **Open Tickets**: New tickets requiring immediate attention
- **In Progress**: Tickets you''re actively working on
- **SLA Status**: Response and resolution time tracking
- **Daily Goals**: Performance targets and progress

### Quick Actions Panel
- **Create Ticket**: Submit tickets on behalf of users
- **Assign to Me**: Take ownership of unassigned tickets
- **Transfer Ticket**: Move tickets to other agents
- **Bulk Actions**: Perform operations on multiple tickets

## 📋 Ticket Management Workflow

### 1. Taking Ownership of Tickets

#### Auto-Assignment
- System automatically assigns tickets based on:
  - Category expertise
  - Current workload
  - Agent availability
  - Skill matching

#### Manual Assignment
- **Assign to Me**: Click on unassigned tickets
- **Review Details**: Check category, priority, and description
- **Accept Assignment**: Confirm you can handle the request
- **Set Expectations**: Provide initial response within SLA

### 2. Initial Ticket Review

#### Information Assessment
- **Read Thoroughly**: Understand the complete issue
- **Check Attachments**: Review screenshots, logs, and documents
- **Verify Category**: Ensure proper categorization
- **Assess Priority**: Confirm urgency level is appropriate

#### First Response Best Practices
- **Acknowledge Receipt**: Confirm you''ve received the ticket
- **Set Expectations**: Provide realistic timeline estimates
- **Ask Clarifying Questions**: Gather any missing information
- **Document Investigation**: Record initial findings and next steps

### 3. Investigation and Resolution

#### Troubleshooting Process
1. **Gather Information**: Collect all relevant details
2. **Research Solutions**: Check Knowledge Base and previous tickets
3. **Test Hypotheses**: Try potential solutions systematically
4. **Document Steps**: Record everything you attempt
5. **Escalate if Needed**: Involve specialists when necessary

#### Communication During Resolution
- **Regular Updates**: Keep users informed of progress
- **Explain Technical Terms**: Use language users understand
- **Set Realistic Timelines**: Don''t over-promise on delivery
- **Ask for Feedback**: Ensure users understand your instructions

## 💬 Customer Communication Excellence

### Professional Communication Standards

#### Response Tone
- **Empathetic**: Acknowledge user frustration
- **Professional**: Maintain courteous language
- **Clear**: Use simple, understandable explanations
- **Positive**: Focus on solutions, not problems

#### Email and Comment Guidelines
```
Subject: Re: [Ticket #12345] - Email Configuration Issue

Hello [User Name],

Thank you for contacting support regarding your email configuration issue.

I''ve reviewed your ticket and understand that you''re unable to send emails from Outlook with error code 0x80042109. This typically indicates an SMTP authentication problem.

I''ve scheduled some time to investigate this further and will have an update for you within 2 hours. In the meantime, could you please verify:

1. Your email address: [user@company.com]
2. The exact time when the issue started
3. Whether you can receive emails normally

I''ll be in touch soon with next steps.

Best regards,
[Your Name]
Support Agent | Analy-Ticket
```

### Chat Communication

#### Real-time Messaging Best Practices
- **Quick Acknowledgment**: Respond within 5 minutes during business hours
- **Active Listening**: Ask follow-up questions for clarity
- **Share Screens**: Use remote assistance when appropriate
- **Document Key Points**: Summarize important chat discussions in ticket comments

#### File Sharing
- **Screenshots**: Guide users through visual steps
- **Documentation**: Share relevant guides and procedures
- **Logs and Diagnostics**: Request technical files when needed
- **Solution Files**: Provide configuration files or scripts

## 📊 SLA Management and Monitoring

### Understanding SLA Metrics

#### Response Time Targets
- **Urgent**: 1 hour first response
- **High**: 2-4 hours first response
- **Medium**: 4-8 hours first response
- **Low**: 24-48 hours first response

#### Resolution Time Expectations
- Times vary based on complexity
- Clock pauses when waiting for user response
- Escalation triggers before SLA breach

### SLA Best Practices
1. **Monitor Dashboard**: Check SLA status regularly
2. **Prioritize Urgent**: Handle critical issues first
3. **Update Estimates**: Adjust timelines as investigation progresses
4. **Communicate Delays**: Inform users if resolution will take longer
5. **Document Escalations**: Record when and why escalation occurred

### Warning and Breach Management
- **Yellow Warning**: 75% of SLA time elapsed
- **Red Alert**: 90% of SLA time elapsed
- **Breach**: SLA target exceeded
- **Automatic Escalation**: System notifies supervisors

## 🎯 Advanced Agent Features

### Ticket Assignment and Transfer

#### Assigning Tickets to Others
1. Open the ticket details
2. Click "Assign" or "Transfer"
3. Select the appropriate agent
4. Provide transfer reason and context
5. Confirm the assignment

#### Transfer Best Practices
- **Include Context**: Explain current status and actions taken
- **Attach Documentation**: Share investigation notes
- **Communicate with User**: Inform them of the change
- **Follow Up**: Ensure smooth transition

### Bulk Operations
- **Status Updates**: Change multiple tickets simultaneously
- **Category Adjustments**: Correct miscategorized tickets
- **Assignment Changes**: Redistribute workload
- **Comment Addition**: Add updates to multiple related tickets

### Template Responses
Create and use templates for common scenarios:
- **Initial Acknowledgment**: Standard first response
- **Information Request**: Asking for additional details
- **Solution Provided**: Explaining resolution steps
- **Closure Notification**: Confirming ticket completion

## 🚨 Escalation Procedures

### When to Escalate
- **Technical Complexity**: Issue beyond your expertise
- **SLA Risk**: Cannot meet response/resolution targets
- **Security Issues**: Potential security implications
- **User Requests**: Customer specifically asks for supervisor
- **Policy Questions**: Unclear procedural guidance

### Escalation Process
1. **Document Thoroughly**: Record all investigation steps
2. **Provide Context**: Explain the situation clearly
3. **Suggest Solutions**: Include your recommendations
4. **Set Expectations**: Inform user about escalation
5. **Follow Up**: Stay involved in resolution

### Working with Specialists
- **Provide Clear Handoff**: Complete context transfer
- **Stay Engaged**: Remain available for questions
- **Learn from Experts**: Use escalations as learning opportunities
- **Document Solutions**: Record specialist recommendations

---

*Excellence in customer support comes from combining technical expertise with genuine care for customer experience. Every interaction is an opportunity to build trust and demonstrate value.*',
    'Professional guide for support agents on managing tickets, customer communication, SLA monitoring, and best practices for excellent customer service.',
    agent_guides_cat_id,
    admin_user_id,
    'published',
    true,
    ARRAY['agents', 'support', 'sla', 'customer-service'],
    true,
    15,
    'Comprehensive guide for support agents on managing tickets, customer communication, and delivering excellent customer service.'
  ) ON CONFLICT (slug) DO UPDATE SET
    content = EXCLUDED.content,
    updated_at = NOW();

  -- 4. Administrator Guide
  INSERT INTO public.knowledge_articles (
    title, slug, content, excerpt, knowledge_category_id, author_id, status, is_published, 
    tags, featured, reading_time_minutes, meta_description
  ) VALUES (
    'Administrator Guide: System Management and Configuration',
    'administrator-guide-system-management-and-configuration',
    '# Administrator Guide: System Management and Configuration

This comprehensive guide is designed for system administrators who manage Analy-Ticket, configure system settings, oversee user management, and ensure optimal system performance.

## 🎛️ Administrator Dashboard Overview

### System Health Monitoring
Your admin dashboard provides real-time insights into:
- **System Performance**: Response times, uptime, and resource usage
- **User Activity**: Active sessions, login metrics, and usage patterns
- **Ticket Statistics**: Volume trends, resolution rates, and SLA performance
- **Agent Workload**: Distribution, capacity, and efficiency metrics

### Quick Administrative Actions
- **User Management**: Add, modify, or deactivate user accounts
- **System Configuration**: Adjust global settings and preferences
- **Category Management**: Create and maintain ticket categories
- **SLA Configuration**: Set and modify service level agreements
- **Knowledge Base Admin**: Manage articles and categories
- **Reporting**: Generate comprehensive system reports

## 👥 User Management

### Creating New Users

#### User Account Setup
1. Navigate to **Administration** → **User Management**
2. Click **"Add New User"**
3. Fill in required information:
   - **Full Name**: Complete user name
   - **Email Address**: Primary contact email
   - **Role**: User, Agent, or Administrator
   - **Department**: Organizational unit
   - **Manager**: Reporting structure
   - **Start Date**: Account activation date

#### Role Definitions
- **User**: Can create and track their own tickets
- **Agent**: Can manage assigned tickets and assist users
- **Administrator**: Full system access and configuration rights

### Bulk User Management
- **CSV Import**: Upload multiple users simultaneously
- **Active Directory Integration**: Sync with corporate directory
- **Automated Provisioning**: Set up automatic account creation
- **License Management**: Track and allocate user licenses

### User Account Lifecycle

#### Account Activation
- **Welcome Email**: Automatic notification with login instructions
- **Temporary Password**: Secure initial access credentials
- **Profile Completion**: Guide users through initial setup
- **Role Assignment**: Ensure appropriate permissions

#### Account Modifications
- **Role Changes**: Promote users to agents or administrators
- **Department Transfers**: Update organizational assignments
- **Permission Adjustments**: Modify access levels as needed
- **Profile Updates**: Maintain current user information

#### Account Deactivation
- **Graceful Transition**: Transfer ticket ownership
- **Data Retention**: Preserve historical records
- **Access Revocation**: Immediate system lockout
- **Archive Process**: Maintain compliance requirements

## 🏷️ Category and Subcategory Management

### Creating Category Structure

#### Main Categories
Design logical groupings for your organization:
- **IT Support**: Hardware, software, network issues
- **HR Services**: Employee onboarding, benefits, policy questions
- **Facilities**: Office space, equipment, maintenance requests
- **Finance**: Expense reports, budget questions, procurement
- **Custom Categories**: Industry-specific or departmental needs

#### Subcategory Configuration
1. **Select Parent Category**: Choose the main category
2. **Define Subcategory**: Specific issue types
3. **Set SLA Targets**: Response and resolution times
4. **Assign Specialists**: Agents with relevant expertise
5. **Create Forms**: Custom fields for specific request types

### Category Properties
- **Icon Selection**: Visual identification in interfaces
- **Color Coding**: Quick visual categorization
- **Sort Order**: Display priority in dropdown menus
- **Enabled Status**: Active/inactive category control
- **Description**: Help text for users

### Employee Onboarding Category
Special configuration for new employee setup:
- **Personal Information Fields**: Name, contact details
- **Job Information**: Title, department, manager, start date
- **Account Setup**: Username, email, license requirements
- **Access Permissions**: System access, groups, distributions
- **Equipment Requests**: Hardware, software, phone setup

## ⏰ SLA Configuration and Management

### Setting Service Level Agreements

#### Priority-Based SLA Rules
Configure response and resolution targets by priority:

**Urgent Priority**
- **First Response**: 1 hour
- **Resolution Target**: 4 hours
- **Escalation**: 30 minutes before breach
- **Notification**: Immediate supervisor alert

**High Priority**
- **First Response**: 2-4 hours
- **Resolution Target**: 8-24 hours
- **Escalation**: 1 hour before breach
- **Notification**: Team lead notification

**Medium Priority**
- **First Response**: 4-8 hours
- **Resolution Target**: 1-3 business days
- **Escalation**: 2 hours before breach
- **Notification**: Standard escalation process

**Low Priority**
- **First Response**: 24-48 hours
- **Resolution Target**: 3-5 business days
- **Escalation**: 4 hours before breach
- **Notification**: Weekly review process

### SLA Monitoring and Reporting

#### Real-time Tracking
- **Dashboard Widgets**: Current SLA status overview
- **Warning Alerts**: Proactive breach prevention
- **Escalation Triggers**: Automatic supervisor notification
- **Performance Metrics**: Team and individual SLA compliance

#### SLA Reporting
- **Compliance Rates**: Percentage of SLAs met by priority
- **Breach Analysis**: Root cause analysis of missed targets
- **Trend Analysis**: Historical performance patterns
- **Agent Performance**: Individual SLA compliance metrics

## 📚 Knowledge Base Administration

### Content Management Strategy

#### Article Categories
Organize knowledge base content logically:
- **Getting Started**: Basic system orientation
- **How-To Guides**: Step-by-step procedures
- **Troubleshooting**: Common issues and solutions
- **FAQs**: Frequently asked questions
- **Policies**: Company policies and procedures
- **Best Practices**: Recommended approaches

#### Content Creation Workflow
1. **Article Planning**: Identify content needs from ticket trends
2. **Author Assignment**: Designate subject matter experts
3. **Content Development**: Write clear, actionable content
4. **Review Process**: Technical and editorial review
5. **Approval**: Final approval for publication
6. **Publishing**: Make content available to users
7. **Maintenance**: Regular updates and improvements

---

*Effective system administration requires balancing user needs, business requirements, and technical constraints while maintaining security, performance, and compliance standards.*',
    'Advanced guide for system administrators covering user management, configuration, SLA setup, and knowledge base administration.',
    admin_guides_cat_id,
    admin_user_id,
    'published',
    true,
    ARRAY['administrators', 'configuration', 'user-management', 'system-admin'],
    true,
    18,
    'Complete guide for system administrators on managing users, configuring settings, and optimizing system performance.'
  ) ON CONFLICT (slug) DO UPDATE SET
    content = EXCLUDED.content,
    updated_at = NOW();

  -- 5. Knowledge Base Guide
  INSERT INTO public.knowledge_articles (
    title, slug, content, excerpt, knowledge_category_id, author_id, status, is_published, 
    tags, featured, reading_time_minutes, meta_description
  ) VALUES (
    'Knowledge Base Guide: Self-Service and Content Management',
    'knowledge-base-guide-self-service-and-content-management',
    '# Knowledge Base Guide: Self-Service and Content Management

This guide covers everything you need to know about using and managing the Knowledge Base in Analy-Ticket, from finding answers to creating and maintaining content.

## 🔍 Using the Knowledge Base (End Users)

### Accessing the Knowledge Base
- Click **"Knowledge Base"** in the sidebar navigation
- Use the search bar from any page
- Browse by categories on the main Knowledge Base page
- Access articles linked in ticket responses

### Searching for Solutions

#### Basic Search
1. Enter your keywords in the search box
2. Use specific terms related to your issue
3. Try different variations of your query
4. Review the search results for relevant articles

#### Advanced Search Tips
- **Use Specific Terms**: "email not sending" vs "email problem"
- **Include Error Messages**: Search for exact error codes or messages
- **Try Synonyms**: Different words for the same concept
- **Use Categories**: Filter results by topic area

#### Search Examples
- ✅ **Good**: "outlook error 0x80042109 cannot send email"
- ✅ **Good**: "reset password forgot login credentials"
- ❌ **Poor**: "email broke"
- ❌ **Poor**: "computer problem"

### Browsing by Categories

#### Main Categories
- **Getting Started**: Basic system orientation and setup
- **How-To Guides**: Step-by-step instructions for common tasks
- **Troubleshooting**: Solutions to common problems
- **FAQ**: Frequently asked questions
- **Policies**: Company policies and procedures
- **Software Guides**: Application-specific instructions

#### Category Navigation
1. Click on a category card or link
2. Browse subcategories if available
3. Use the breadcrumb navigation to go back
4. Filter articles within categories

### Reading Articles Effectively

#### Article Structure
Most articles follow a consistent format:
- **Title**: Clear description of the topic
- **Overview**: Brief explanation of what you'll learn
- **Prerequisites**: What you need before starting
- **Step-by-Step Instructions**: Detailed procedures
- **Screenshots**: Visual guides when helpful
- **Additional Resources**: Related articles or external links

#### Following Instructions
- **Read Completely**: Review the entire article before starting
- **Follow Order**: Complete steps in the sequence provided
- **Check Prerequisites**: Ensure you have necessary access or tools
- **Take Notes**: Document your progress for future reference

### Rating and Feedback

#### Rating Articles
After reading an article:
1. Scroll to the bottom of the article
2. Rate its helpfulness (1-5 stars or thumbs up/down)
3. Provide specific feedback if prompted
4. Submit your rating

#### Feedback Guidelines
- **Be Specific**: Explain what was helpful or missing
- **Suggest Improvements**: What could make the article better?
- **Report Issues**: Note outdated information or broken links
- **Share Results**: Did the solution work for your situation?

## 📝 Creating Knowledge Base Content (Agents & Administrators)

### Content Planning

#### Identifying Content Needs
Create articles based on:
- **Frequent Tickets**: Issues that come up repeatedly
- **Complex Solutions**: Multi-step procedures worth documenting
- **User Requests**: Specific help requests from users
- **System Changes**: New features or process updates
- **Training Gaps**: Areas where users need more guidance

#### Content Types
- **How-To Guides**: Step-by-step procedures
- **Troubleshooting**: Problem diagnosis and solutions
- **FAQs**: Common questions and quick answers
- **Policies**: Official company procedures
- **Quick References**: Cheat sheets and summaries

### Writing Effective Articles

#### Article Planning
Before you start writing:
1. **Define Your Audience**: Who will read this article?
2. **Set Clear Objectives**: What should readers accomplish?
3. **Gather Information**: Collect all necessary details
4. **Test Procedures**: Verify all steps work correctly
5. **Plan Structure**: Organize information logically

#### Writing Guidelines

##### Title Best Practices
- **Be Descriptive**: Clearly state what the article covers
- **Use Keywords**: Include terms users might search for
- **Keep It Concise**: Aim for clarity over clever wording

Examples:
- ✅ **Good**: "How to Reset Your Password in Office 365"
- ✅ **Good**: "Troubleshoot VPN Connection Issues on Windows 10"
- ❌ **Poor**: "Password Stuff"
- ❌ **Poor**: "Network Problems"

##### Writing Style
- **Use Clear Language**: Write for your audience''s knowledge level
- **Be Specific**: Include exact button names, menu locations
- **Use Active Voice**: "Click Save" not "Save should be clicked"
- **Include Context**: Explain why steps are necessary
- **Test Everything**: Verify all instructions work correctly

### Adding Visual Elements

#### Screenshots
- **Capture Key Steps**: Show important interface elements
- **Highlight Actions**: Use arrows, circles, or callouts
- **Keep Current**: Update images when interfaces change
- **Optimize Size**: Balance clarity with page load speed

#### Other Visual Elements
- **Diagrams**: Illustrate processes or relationships
- **Videos**: For complex procedures
- **Code Blocks**: For technical configurations
- **Tables**: Compare options or list requirements

## 🎯 Content Management Strategy

### Content Lifecycle

#### Creation Phase
1. **Identify Need**: Recognize content gap
2. **Plan Article**: Define scope and audience
3. **Research and Write**: Develop comprehensive content
4. **Review and Test**: Ensure accuracy and usability
5. **Publish**: Make available to users

#### Maintenance Phase
- **Regular Reviews**: Check content every 6 months
- **Update Procedures**: Reflect system changes
- **Refresh Screenshots**: Keep images current
- **Monitor Usage**: Track views and feedback
- **Archive Outdated**: Remove obsolete content

#### Performance Monitoring
Track article effectiveness through:
- **View Counts**: Most and least accessed content
- **User Ratings**: Helpfulness feedback
- **Search Analytics**: What users look for but don''t find
- **Ticket Reduction**: Decrease in related support requests

### Content Organization

#### Category Strategy
Organize content logically:
- **By Department**: IT, HR, Finance, etc.
- **By Function**: Setup, troubleshooting, how-to
- **By Product**: Software applications, systems
- **By User Type**: New employees, managers, specialists

#### Tagging System
Use consistent tags to improve discoverability:
- **Functional Tags**: setup, troubleshooting, configuration
- **Product Tags**: office365, salesforce, vpn
- **Audience Tags**: beginners, advanced, managers
- **Topic Tags**: email, security, mobile

## 🎓 Best Practices Summary

### For Content Creators
1. **Know Your Audience**: Write for specific user needs
2. **Test Everything**: Verify all procedures work
3. **Use Clear Language**: Write simply and directly
4. **Include Visuals**: Screenshots enhance understanding
5. **Keep It Current**: Update content regularly
6. **Gather Feedback**: Listen to user suggestions

### For Knowledge Base Managers
1. **Organize Logically**: Structure content for easy navigation
2. **Monitor Performance**: Track usage and effectiveness
3. **Maintain Quality**: Regular reviews and updates
4. **Promote Usage**: Encourage self-service adoption
5. **Train Contributors**: Help others create good content
6. **Measure Impact**: Track reduction in support tickets

### For End Users
1. **Search First**: Check knowledge base before creating tickets
2. **Be Specific**: Use precise search terms
3. **Follow Completely**: Read entire articles before starting
4. **Provide Feedback**: Rate articles and suggest improvements
5. **Share Knowledge**: Help colleagues find useful articles
6. **Report Issues**: Let us know about outdated content

---

*A well-maintained knowledge base empowers users to solve problems independently while reducing support ticket volume and improving overall efficiency.*',
    'Comprehensive guide on using and managing the Knowledge Base, from finding answers to creating and maintaining high-quality content.',
    knowledge_mgmt_cat_id,
    admin_user_id,
    'published',
    true,
    ARRAY['knowledge-base', 'self-service', 'content', 'articles'],
    true,
    16,
    'Complete guide on using and managing the Knowledge Base for self-service support and content creation.'
  ) ON CONFLICT (slug) DO UPDATE SET
    content = EXCLUDED.content,
    updated_at = NOW();

  -- 6. Notifications and Communication Guide
  INSERT INTO public.knowledge_articles (
    title, slug, content, excerpt, knowledge_category_id, author_id, status, is_published, 
    tags, featured, reading_time_minutes, meta_description
  ) VALUES (
    'Notifications and Communication Guide',
    'notifications-and-communication-guide',
    '# Notifications and Communication Guide

This guide covers all aspects of staying connected and informed in Analy-Ticket, from configuring notifications to using chat features and managing your communication preferences.

## 🔔 Understanding Notifications

### Types of Notifications

#### System Notifications
Automatic alerts generated by the system:
- **Ticket Status Changes**: When tickets move between statuses
- **Assignment Notifications**: When tickets are assigned to you
- **SLA Warnings**: When response/resolution deadlines approach
- **Comment Additions**: When someone adds comments to your tickets
- **Resolution Confirmations**: When tickets are marked as resolved

#### User-Triggered Notifications
Notifications from direct user actions:
- **@Mentions**: When someone mentions you in comments or chat
- **Direct Messages**: Personal communications
- **Follow-up Requests**: When users request updates
- **Escalation Notices**: When tickets are escalated to supervisors

#### Administrative Notifications
System-wide communications:
- **System Maintenance**: Scheduled downtime announcements
- **Feature Updates**: New functionality announcements
- **Policy Changes**: Important procedural updates
- **Security Alerts**: Critical security notifications

### Notification Channels

#### In-App Notifications
- **Notification Bell**: Click the bell icon in the header
- **Badge Counters**: Red numbers indicating unread notifications
- **Real-time Updates**: Instant notifications without page refresh
- **Notification History**: Access to past notifications

#### Email Notifications
- **Immediate Alerts**: Critical notifications sent instantly
- **Daily Digest**: Summary of activity (configurable)
- **Weekly Summary**: High-level overview of activity
- **Custom Triggers**: Notifications for specific events

#### Browser Notifications
- **Desktop Alerts**: Pop-up notifications on your computer
- **Mobile Alerts**: Push notifications on mobile devices
- **Sound Alerts**: Audio notifications for urgent items
- **Persistent Alerts**: Notifications that stay visible until acknowledged

## ⚙️ Configuring Your Notification Preferences

### Accessing Notification Settings
1. Click on your profile picture or name
2. Select **"Profile"** or **"Settings"**
3. Navigate to **"Notification Preferences"**
4. Configure your preferred settings

### Email Notification Options

#### Frequency Settings
- **Real-time**: Immediate email for each notification
- **Hourly Digest**: Summary every hour during business hours
- **Daily Digest**: One email per day with all activity
- **Weekly Summary**: High-level weekly overview
- **Custom Schedule**: Set specific times for notifications

#### Event-Specific Settings
Configure emails for specific events:
- ☑️ **New ticket assignments**
- ☑️ **Ticket status changes**
- ☑️ **Comment additions**
- ☑️ **SLA warnings**
- ☑️ **Resolution notifications**
- ☑️ **System announcements**

### In-App Notification Settings

#### Notification Types
Choose which events trigger in-app notifications:
- **All Activity**: Every system event
- **Assigned Tickets Only**: Only tickets assigned to you
- **High Priority**: Urgent items only
- **Mentions Only**: When you''re specifically mentioned
- **Custom Selection**: Choose specific event types

#### Display Preferences
- **Sound Alerts**: Enable/disable notification sounds
- **Desktop Notifications**: Browser pop-up alerts
- **Notification Duration**: How long alerts stay visible
- **Auto-Mark Read**: Automatically mark notifications as read

### Mobile and Browser Settings

#### Browser Notifications
1. **Enable Permission**: Allow browser to show notifications
2. **Configure Display**: Set notification appearance and duration
3. **Quiet Hours**: Disable notifications during specific times
4. **Priority Filtering**: Show only critical notifications

## 💬 Chat and Real-Time Communication

### Ticket Chat Feature

#### Accessing Ticket Chat
- Open any ticket from your ticket list
- Click on the **"Chat"** tab within the ticket details
- Start typing to begin conversation

#### Chat Functionality
- **Real-time Messaging**: Instant communication with team members
- **File Sharing**: Upload and share documents, screenshots
- **Message History**: Complete conversation history preserved
- **Participant Management**: Add or remove team members from chat
- **Read Receipts**: See when messages have been read

#### Chat Best Practices
- **Stay Professional**: Maintain courteous communication
- **Be Clear**: Use specific language and avoid ambiguity
- **Share Context**: Provide background for new participants
- **Use @Mentions**: Tag specific users for attention
- **Document Decisions**: Summarize important chat decisions in ticket comments

### @Mentions and Direct Communication

#### Using @Mentions
- Type **@** followed by a person''s name
- Select from the dropdown list of available users
- @Mentioned users receive immediate notifications
- Use for urgent attention or specific questions

#### @Mention Best Practices
- **Be Specific**: Clearly state what you need from the person
- **Provide Context**: Explain the situation or urgency
- **Use Sparingly**: Don''t overuse mentions to avoid notification fatigue
- **Follow Up**: Check if your message was received and understood

### Chat Etiquette and Guidelines

#### Professional Communication
- **Greeting**: Start conversations with appropriate greetings
- **Clarity**: Be clear and concise in your messages
- **Tone**: Maintain professional and respectful tone
- **Timing**: Consider time zones and working hours
- **Privacy**: Keep sensitive information in private channels

#### Response Expectations
- **Business Hours**: Respond within 1-2 hours during work time
- **Urgent Issues**: Respond immediately to critical situations
- **Off Hours**: No expectation of immediate response
- **Status Updates**: Use status indicators when away or busy

## 🎯 Notification Management Strategies

### Avoiding Notification Overload

#### Prioritization Strategies
1. **Critical Only**: Configure notifications for urgent items only
2. **Role-Based**: Set notifications relevant to your specific role
3. **Time-Based**: Use quiet hours during focused work time
4. **Digest Mode**: Consolidate multiple notifications into summaries

#### Filtering Techniques
- **Keyword Filters**: Set up alerts for specific terms or categories
- **Priority Filters**: Receive notifications only for high-priority items
- **Team Filters**: Get alerts only for your team or department
- **Project Filters**: Focus on specific initiatives or projects

### Staying Informed Without Overwhelm

#### Strategic Notification Setup
- **Morning Digest**: Daily summary to start your day
- **Urgent Alerts**: Immediate notifications for critical issues
- **End-of-Day Summary**: Review of daily activity
- **Weekly Overview**: High-level performance and trends

#### Regular Review Process
- **Weekly Settings Review**: Adjust notification preferences weekly
- **Feedback Loop**: Modify settings based on actual notification value
- **Seasonal Adjustments**: Change settings during busy or quiet periods
- **Role Changes**: Update preferences when responsibilities change

## 🔧 Troubleshooting Notification Issues

### Common Problems and Solutions

#### Not Receiving Notifications
**Check These Settings:**
1. **Email Settings**: Verify correct email address in profile
2. **Spam Filters**: Check spam/junk folders for system emails
3. **Browser Permissions**: Ensure browser allows notifications
4. **Notification Preferences**: Verify settings are configured correctly
5. **System Status**: Check if there are known system issues

#### Too Many Notifications
**Reduce Notification Volume:**
1. **Switch to Digest Mode**: Consolidate multiple alerts
2. **Adjust Priorities**: Receive only high-priority notifications
3. **Filter by Category**: Limit to relevant ticket categories
4. **Use Quiet Hours**: Set specific times for no notifications
5. **Review Event Types**: Disable unnecessary notification types

#### Delayed Notifications
**Improve Notification Speed:**
1. **Check Internet Connection**: Ensure stable connectivity
2. **Browser Issues**: Try different browser or clear cache
3. **Mobile App Updates**: Ensure app is current version
4. **System Load**: High traffic may delay notifications
5. **Contact Support**: Report persistent delays

### Best Practices Summary

#### For All Users
1. **Start Conservative**: Begin with fewer notifications, add as needed
2. **Use Digests**: Consolidate when possible to reduce email volume
3. **Set Priorities**: Focus on notifications that require immediate action
4. **Regular Maintenance**: Review and adjust settings monthly
5. **Respect Others**: Be mindful when using @mentions and urgent flags

#### For Agents
1. **Monitor SLA Alerts**: Ensure you receive timely warnings
2. **Assignment Notifications**: Get immediate alerts for new assignments
3. **Customer Communications**: Track all customer interactions
4. **Escalation Alerts**: Stay informed about ticket escalations
5. **Team Coordination**: Use chat effectively for collaboration

#### For Administrators
1. **System Monitoring**: Receive alerts for system issues
2. **Performance Metrics**: Get regular performance summaries
3. **User Activity**: Monitor unusual user behavior patterns
4. **Security Alerts**: Immediate notification of security events
5. **Compliance Reporting**: Regular reports for audit purposes

---

*Effective notification management helps you stay informed without becoming overwhelmed, enabling you to respond quickly to important events while maintaining focus on your primary responsibilities.*',
    'Complete guide on notifications, chat, and communication features to help you stay connected and informed while managing communication effectively.',
    communication_cat_id,
    admin_user_id,
    'published',
    true,
    ARRAY['notifications', 'communication', 'chat', 'email'],
    true,
    14,
    'Comprehensive guide on managing notifications, using chat features, and optimizing communication in Analy-Ticket.'
  ) ON CONFLICT (slug) DO UPDATE SET
    content = EXCLUDED.content,
    updated_at = NOW();

END;

COMMIT; 