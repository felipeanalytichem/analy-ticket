# Analy-Ticket - Request Resolve System

## 📋 Project Overview

**Analy-Ticket** is a comprehensive ticket management and help desk system built with modern web technologies. This application provides a complete solution for managing support requests, tracking tickets, analytics, knowledge base management, and administrative functions.

### 🎯 Key Features

- **Dashboard & Analytics**: Real-time statistics, KPIs, and data visualization
- **Ticket Management**: Full CRUD operations for support tickets
- **User Role Management**: Multi-role support (User, Agent, Admin)
- **Knowledge Base**: Integrated documentation and solution database
- **SLA Configuration**: Service Level Agreement monitoring and management
- **Report Generation**: Advanced reporting and data export capabilities
- **External Integrations**: Support for third-party service integrations
- **Real-time Communication**: Chat functionality for ticket collaboration
- **Theme Support**: Light/Dark mode with customizable theming

## 🛠 Technology Stack

### Frontend Framework
- **React 18.3.1** - Main UI framework
- **TypeScript 5.5.3** - Type safety and development experience
- **Vite 5.4.1** - Build tool and development server
- **React Router DOM 6.26.2** - Client-side routing

### UI/UX Libraries
- **Tailwind CSS 3.4.11** - Utility-first CSS framework
- **shadcn/ui** - Modern React component library based on Radix UI
- **Radix UI** - Comprehensive set of accessible components
- **Lucide React** - Beautiful icon library
- **Next Themes** - Theme management system

### State Management & Data Fetching
- **TanStack React Query 5.56.2** - Server state management
- **React Hook Form 7.53.0** - Form handling and validation
- **Zod 3.23.8** - Schema validation

### Backend Integration
- **Supabase 2.49.10** - Backend-as-a-Service (Database, Auth, Real-time)

### Development Tools
- **ESLint 9.9.0** - Code linting and quality
- **TypeScript ESLint** - TypeScript-specific linting rules
- **Lovable Tagger** - Development tagging system

## 📁 Project Structure

```
request-resolve-system-1/
├── src/
│   ├── components/           # Reusable UI components
│   │   ├── ui/              # Base UI components (shadcn/ui)
│   │   ├── admin/           # Admin-specific components
│   │   ├── dashboard/       # Dashboard widgets and charts
│   │   ├── integrations/    # External integration components
│   │   ├── knowledge/       # Knowledge base components
│   │   ├── reports/         # Report generation components
│   │   └── tickets/         # Ticket management components
│   ├── pages/               # Application pages
│   │   ├── Index.tsx        # Main dashboard page
│   │   ├── TicketDetail.tsx # Detailed ticket view
│   │   └── NotFound.tsx     # 404 error page
│   ├── integrations/        # External service integrations
│   │   └── supabase/        # Supabase configuration and types
│   ├── hooks/               # Custom React hooks
│   ├── lib/                 # Utility functions and configurations
│   └── App.tsx              # Main application component
├── supabase/                # Supabase configuration
├── public/                  # Static assets
└── config files             # Various configuration files
```

## 🚀 Getting Started

### Prerequisites
- Node.js (Latest LTS version)
- npm or yarn package manager
- Git

### Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd request-resolve-system-1
```

2. **Install dependencies**
```bash
npm install
```

3. **Start development server**
```bash
npm run dev
```

The application will be available at `http://localhost:8080`

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run build:dev` - Build for development
- `npm run lint` - Run ESLint
- `npm run preview` - Preview production build

## 🔧 Configuration

### Environment Setup
The project uses Supabase as the backend service. Configuration is handled through:
- Supabase URL: `https://pjuafgoklmvgckkkrnft.supabase.co`
- Public API key configured in `src/integrations/supabase/client.ts`

### Theme Configuration
- Default theme: Light mode
- Storage key: `analy-ticket-theme`
- Supports system theme detection
- Custom CSS variables for theme colors

### Build Configuration
- **Vite Configuration**: Custom port (8080), path aliases, React SWC
- **TypeScript**: Strict mode enabled with multiple tsconfig files
- **Tailwind**: Custom design system with extended color palette

## 🎨 UI Components & Design System

### Component Library
The project uses a custom implementation of shadcn/ui components built on top of Radix UI:

- **Forms**: Input, Textarea, Select, Checkbox, Radio, Switch
- **Navigation**: Sidebar, Breadcrumb, Pagination, Tabs
- **Feedback**: Toast, Sonner, Alert, Progress, Skeleton
- **Overlay**: Dialog, Sheet, Popover, Hover Card, Tooltip
- **Data Display**: Table, Card, Badge, Avatar, Calendar
- **Layout**: Resizable panels, Scroll Area, Separator

### Design Tokens
- **Colors**: CSS custom properties with light/dark mode support
- **Typography**: Responsive font sizes and spacing
- **Spacing**: Consistent margin and padding scale
- **Borders**: Configurable border radius system

## 📊 Application Features

### Dashboard
- **Statistics Cards**: Real-time ticket metrics
- **Advanced Analytics**: KPI tracking and performance metrics
- **Charts & Visualizations**: Ticket trends and data insights
- **Recent Activity**: Latest ticket updates and changes

### Ticket Management
- **CRUD Operations**: Create, read, update, delete tickets
- **Advanced Filtering**: Multi-criteria ticket filtering
- **Priority & Status Management**: Configurable ticket states
- **Assignment System**: User and agent assignment
- **Tag System**: Categorization and labeling
- **SLA Monitoring**: Service level tracking

### User Management
- **Role-based Access**: User, Agent, Admin roles
- **Permission System**: Feature access control
- **User Profile Management**: User information and preferences

### Knowledge Base
- **Article Management**: Create and manage help articles
- **Search Functionality**: Full-text search capabilities
- **Category Organization**: Structured content organization

### Reporting
- **Data Export**: Multiple format support
- **Custom Reports**: Configurable report generation
- **Analytics Dashboard**: Performance metrics and insights

## 🔒 Security & Authentication

### Authentication System ✅ IMPLEMENTED
- **Supabase Auth Integration**: Complete authentication system with email/password
- **User Registration**: New user signup with role selection (user/agent/admin)
- **Login System**: Secure login with email and password
- **Password Reset**: Forgot password functionality with email recovery
- **Session Management**: Automatic session handling and persistence
- **Protected Routes**: Route-level authentication protection

### User Management ✅ IMPLEMENTED
- **Role-based Access Control**: Three-tier permission system (user/agent/admin)
- **User Profiles**: Complete user profile management with avatars
- **Authentication Context**: React context for global auth state
- **Automatic Redirects**: Smart routing based on authentication status

### Security Features ✅ IMPLEMENTED
- **Row Level Security (RLS)**: Database-level security policies
- **Secure API Communication**: HTTPS and API key authentication
- **Data Validation**: Comprehensive input validation
- **Session Protection**: Automatic logout on session expiry

## 🌐 Deployment

### Production Build
```bash
npm run build
```

### Deployment Options
- **Lovable Platform**: Direct deployment through Lovable interface
- **Custom Domain**: Configurable through project settings
- **Static Hosting**: Compatible with Vercel, Netlify, etc.

## 🔐 Authentication Implementation

### Authentication Flow
1. **User Registration**: Users can create accounts with email, password, name, and role
2. **Email Verification**: Optional email confirmation (configurable in Supabase)
3. **Login Process**: Secure authentication with session management
4. **Protected Routes**: Automatic redirection for unauthenticated users
5. **Role-based Access**: Different permissions based on user roles

### Authentication Components
- **`AuthContext`**: Global authentication state management
- **`ProtectedRoute`**: Route wrapper for authentication protection
- **`UserProfile`**: User profile dropdown with logout functionality
- **`Login`**: Beautiful login form with validation
- **`Register`**: Registration form with role selection
- **`ForgotPassword`**: Password reset functionality

### Database Integration
- **Users Table**: Custom user profiles linked to Supabase Auth
- **RLS Policies**: Row-level security for data protection
- **Role Hierarchy**: user < agent < admin permission levels
- **Automatic Profile Creation**: User profiles created on registration

### Usage Examples
```typescript
// Using authentication in components
import { useAuth } from '@/contexts/AuthContext';

function MyComponent() {
  const { user, userProfile, signOut } = useAuth();
  
  if (!user) return <div>Please login</div>;
  
  return (
    <div>
      Welcome, {userProfile?.name}!
      <button onClick={signOut}>Logout</button>
    </div>
  );
}

// Protected routes
<ProtectedRoute requiredRole="admin">
  <AdminPanel />
</ProtectedRoute>
```

## 🧪 Development Guidelines

### Code Quality
- **ESLint**: Configured with React and TypeScript rules
- **TypeScript**: Strict mode for type safety
- **Component Structure**: Modular and reusable components
- **Custom Hooks**: Reusable logic extraction

### File Organization
- **Component Co-location**: Related files grouped together
- **Barrel Exports**: Clean import statements
- **Type Definitions**: Comprehensive TypeScript types
- **Utility Functions**: Shared logic in lib directory

## 📚 Key Dependencies

### Core Dependencies
- **React Ecosystem**: React, React DOM, React Router
- **UI Framework**: Radix UI components, Tailwind CSS
- **Data Management**: TanStack Query, React Hook Form
- **Backend**: Supabase client and authentication
- **Utilities**: Date-fns, Class Variance Authority, CLSX

### Development Dependencies
- **Build Tools**: Vite, TypeScript, PostCSS
- **Linting**: ESLint with React and TypeScript plugins
- **Styling**: Tailwind CSS, Autoprefixer

## 🔄 Project Status

This is an active development project with the following characteristics:
- **Version**: 0.0.0 (Development phase)
- **License**: Private project
- **Build System**: Vite-based with hot module replacement
- **Package Manager**: npm with lock file committed
- **Database**: ✅ **Fully implemented** with complete schema and migrations

## 🗄️ Database Implementation Status

### ✅ Completed Database Features:

1. **Core Tables Implemented**:
   - `users` - User management with roles and agent levels
   - `categories` - Ticket categorization system
   - `tickets_new` - Main ticket management table
   - `ticket_comments_new` - Comments and internal notes
   - `ticket_attachments` - File attachment support
   - `sla_rules` - Service Level Agreement configuration
   - `ticket_sla_logs` - SLA tracking and compliance
   - `notifications` - User notification system
   - `knowledge_articles` - Knowledge base articles
   - `ticket_tags` - Tagging system for better organization
   - `ticket_tag_assignments` - Many-to-many tag relationships
   - `category_change_requests` - Category change workflow

2. **Advanced Features**:
   - **Row Level Security (RLS)** - Complete security policies implemented
   - **Automatic SLA Assignment** - Triggers for automatic SLA rule application
   - **Notification System** - Automated notifications for ticket events
   - **Escalation System** - Automatic priority escalation for overdue tickets
   - **Auto-Assignment** - Intelligent agent assignment based on workload
   - **Statistics Functions** - Real-time dashboard statistics
   - **Maintenance Tasks** - Automated cleanup and maintenance functions

3. **Database Functions**:
   - `get_ticket_statistics()` - Role-based ticket statistics
   - `get_sla_statistics()` - SLA compliance metrics
   - `auto_assign_ticket()` - Intelligent ticket assignment
   - `escalate_overdue_tickets()` - Automatic escalation
   - `create_notification()` - Notification creation
   - `maintenance_tasks()` - Scheduled maintenance

4. **Performance Optimizations**:
   - Comprehensive indexing strategy
   - Optimized queries for dashboard views
   - Efficient foreign key relationships
   - Proper data types and constraints

5. **Data Migration**:
   - ✅ Existing data migrated from old schema
   - ✅ Backward compatibility views created
   - ✅ Default data populated (categories, SLA rules, tags)
   - ✅ Sample knowledge articles created

### 🔧 Migration Files Applied:
- `20241206000001_initial_schema.sql` - Core table structure
- `20241206000002_migrate_existing_data.sql` - Data migration and triggers
- `20241206000003_finalize_schema.sql` - Functions and optimizations

## 📝 Notes

- The project appears to be built using the Lovable platform integration
- Supabase is configured for backend services but may need additional setup
- The codebase includes comprehensive TypeScript types and modern React patterns
- UI components follow accessibility best practices through Radix UI
- The application supports both Portuguese and English interfaces

## 🤝 Contributing

When contributing to this project:
1. Follow the existing code style and patterns
2. Use TypeScript for all new code
3. Ensure components are accessible and responsive
4. Add appropriate error handling and validation
5. Update documentation for new features

## 📞 Support

For project-related questions or issues, refer to the Lovable project dashboard or check the integrated knowledge base within the application.


## 🧱 Estrutura do Banco de Dados (Supabase)

### Tabela: `users`
```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'agent', 'admin')),
    agent_level INTEGER CHECK (agent_level IN (1, 2)),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

### Tabela: `categories`
```sql
CREATE TABLE categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT
);
```

### Tabela: `tickets`
```sql
CREATE TABLE tickets (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    assigned_agent_id INTEGER REFERENCES users(id),
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    category_id INTEGER REFERENCES categories(id),
    priority VARCHAR(10) NOT NULL CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
    sla_due_date TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

### Tabela: `category_change_requests`
```sql
CREATE TABLE category_change_requests (
    id SERIAL PRIMARY KEY,
    ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    requested_by INTEGER NOT NULL REFERENCES users(id),
    old_category_id INTEGER REFERENCES categories(id),
    new_category_id INTEGER NOT NULL REFERENCES categories(id),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    reviewed_by INTEGER REFERENCES users(id),
    decision_date TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);
```

### Tabela: `ticket_comments`
```sql
CREATE TABLE ticket_comments (
    id SERIAL PRIMARY KEY,
    ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id),
    comment TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);
```

### Tabela: `ticket_attachments`
```sql
CREATE TABLE ticket_attachments (
    id SERIAL PRIMARY KEY,
    ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    file_path TEXT NOT NULL,
    uploaded_by INTEGER NOT NULL REFERENCES users(id),
    uploaded_at TIMESTAMP DEFAULT NOW()
);
```

### Tabela: `sla_rules`
```sql
CREATE TABLE sla_rules (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    priority VARCHAR(10) NOT NULL CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    response_time INTERVAL NOT NULL,
    resolution_time INTERVAL NOT NULL
);
```

### Tabela: `ticket_sla_logs`
```sql
CREATE TABLE ticket_sla_logs (
    id SERIAL PRIMARY KEY,
    ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    sla_rule_id INTEGER NOT NULL REFERENCES sla_rules(id),
    applied_at TIMESTAMP DEFAULT NOW()
);
```

### Tabela: `notifications`
```sql
CREATE TABLE notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    content TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);
```