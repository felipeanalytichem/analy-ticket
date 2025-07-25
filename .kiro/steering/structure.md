# Project Structure & Organization

## Root Directory Structure
```
analy-ticket/
├── src/                    # Main source code
├── supabase/              # Database migrations and functions
├── public/                # Static assets
├── docs/                  # Documentation
├── scripts/               # Build and maintenance scripts
├── e2e/                   # End-to-end tests
├── .kiro/                 # Kiro AI assistant configuration
└── config files           # Build and tool configurations
```

## Source Code Organization (`src/`)

### Core Application
- `App.tsx` - Main application component with routing
- `main.tsx` - Application entry point
- `index.css` - Global styles and CSS variables

### Components (`src/components/`)
- `ui/` - Base UI components (shadcn/ui library)
- `auth/` - Authentication components (Login, Register, Profile)
- `tickets/` - Ticket management components
- `dashboard/` - Dashboard widgets and analytics
- `admin/` - Administrative interface components
- `chat/` - Real-time chat system components
- `knowledge/` - Knowledge base components
- `notifications/` - Notification system components
- `layout/` - Layout and navigation components
- `reports/` - Reporting and analytics components
- `todo/` - Task management components

### Pages (`src/pages/`)
- `Index.tsx` - Main dashboard page
- `Login.tsx` / `Register.tsx` - Authentication pages
- `TicketsPage.tsx` / `TicketDetail.tsx` - Ticket management
- `DashboardPage.tsx` / `AgentDashboard.tsx` - Role-specific dashboards
- `KnowledgeBasePage.tsx` / `KnowledgeAdminPage.tsx` - Knowledge management
- `Profile.tsx` / `Settings.tsx` - User management
- Admin pages: `CategoryManagementPage.tsx`, `UserManagementPage.tsx`, etc.

### State Management (`src/contexts/`)
- `AuthContext.tsx` - Global authentication state
- `TicketCountContext.tsx` - Ticket counting and statistics

### Custom Hooks (`src/hooks/`)
- `useAuthRedirect.ts` - Authentication flow management
- `useCategories.ts` / `useCategoryManagement.ts` - Category operations
- `useChat.ts` - Real-time chat functionality
- `useNotifications.ts` - Notification management
- `useSessionTimeout.ts` - Session management
- `use-toast.ts` - Toast notification system

### Services & Utilities (`src/lib/`)
- `supabase.ts` - Supabase client configuration
- `utils.ts` - General utility functions
- `chatService.ts` - Chat system backend integration
- `notificationService.ts` - Notification handling
- `emailService.ts` - Email integration
- `adminService.ts` - Administrative operations
- `database.ts` - Database helper functions

### Backend Integration (`src/integrations/`)
- `supabase/` - Supabase configuration and types
  - `client.ts` - Supabase client setup
  - `types.ts` - Database type definitions

### Internationalization (`src/i18n/`)
- `index.ts` - i18n configuration
- `locales/` - Translation files for supported languages

### Type Definitions (`src/types/`)
- `supabase.ts` - Database and API type definitions

## Database Structure (`supabase/`)
- `migrations/` - Database schema migrations
- `functions/` - Supabase Edge Functions
- `config.toml` - Supabase configuration

## Documentation (`docs/`)
- `admin-guide/` - Administrator documentation
- `agent-guide/` - Support agent documentation
- `user-guide/` - End-user documentation
- `technical/` - Technical implementation docs
- `features/` - Feature-specific documentation

## Naming Conventions

### Files & Directories
- **Components**: PascalCase (e.g., `TicketDetail.tsx`)
- **Hooks**: camelCase with `use` prefix (e.g., `useCategories.ts`)
- **Services**: camelCase with service suffix (e.g., `chatService.ts`)
- **Pages**: PascalCase with Page suffix (e.g., `DashboardPage.tsx`)
- **Utilities**: camelCase (e.g., `utils.ts`)

### Code Conventions
- **React Components**: PascalCase function components
- **Props Interfaces**: Component name + `Props` (e.g., `TicketDetailProps`)
- **Custom Hooks**: Start with `use` prefix
- **Constants**: UPPER_SNAKE_CASE
- **CSS Classes**: Tailwind utility classes, kebab-case for custom classes

## Import Organization
1. React and external libraries
2. Internal components (using `@/` alias)
3. Hooks and utilities
4. Types and interfaces
5. Relative imports (if any)

## Component Structure Pattern
```typescript
// External imports
import React from 'react';
import { useQuery } from '@tanstack/react-query';

// Internal imports
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';

// Types
interface ComponentProps {
  // props definition
}

// Component
export function Component({ prop }: ComponentProps) {
  // hooks
  // state
  // effects
  // handlers
  // render
}
```

## Route Organization
- **Public Routes**: `/login`, `/register`
- **User Routes**: `/`, `/tickets`, `/profile`
- **Agent Routes**: `/agent-dashboard`, `/ticket/:id`
- **Admin Routes**: `/admin/*` - All admin functionality under admin prefix

## Asset Organization (`public/`)
- `icons/` - Application icons and favicons
- `lovable-uploads/` - User-uploaded content
- Static files: `robots.txt`, `site.webmanifest`

This structure promotes maintainability, scalability, and clear separation of concerns while following React and TypeScript best practices.