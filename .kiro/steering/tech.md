# Technology Stack & Build System

## Frontend Framework
- **React 18.3.1** - Modern UI framework with hooks and concurrent features
- **TypeScript 5.5.3** - Type-safe development with strict mode enabled
- **Vite 5.4.1** - Fast build tool and development server (port 8080)
- **React Router DOM 6.26.2** - Client-side routing and navigation

## UI/UX Framework
- **Tailwind CSS 3.4.11** - Utility-first CSS framework with custom design system
- **shadcn/ui** - High-quality React component library based on Radix UI
- **Radix UI** - Accessible, unstyled component primitives
- **Lucide React 0.462.0** - Consistent icon system
- **Next Themes 0.4.6** - Dark/light theme management with system detection

## State Management & Data
- **TanStack React Query 5.56.2** - Server state management and caching
- **React Hook Form 7.53.0** - Performant form handling with validation
- **Zod 3.23.8** - Schema validation and type inference

## Backend & Database
- **Supabase 2.50.0** - Backend-as-a-Service with PostgreSQL
- **Row Level Security (RLS)** - Database-level security policies
- **Real-time subscriptions** - Live data updates and notifications

## Internationalization
- **i18next 25.2.1** - Internationalization framework
- **react-i18next 15.5.2** - React integration for i18n
- **Supported Languages**: English (US), Portuguese (BR), Spanish (ES)

## Testing & Quality
- **Vitest 3.2.4** - Unit testing framework
- **Playwright 1.53.1** - End-to-end testing
- **ESLint 9.9.0** - Code linting with TypeScript rules
- **Husky 9.0.9** - Git hooks for pre-commit validation

## Common Commands

### Development
```bash
npm run dev              # Start development server (localhost:8080)
npm run build            # Production build
npm run build:dev        # Development build
npm run preview          # Preview production build
npm run lint             # Run ESLint
```

### Testing
```bash
npm run test             # Run unit tests with Vitest
npm run test:ui          # Run tests with UI
npm run test:coverage    # Run tests with coverage report
npm run test:e2e         # Run Playwright e2e tests
npm run test:e2e:ui      # Run e2e tests with UI
npm run test:all         # Run all tests (unit, e2e, accessibility, performance)
```

### Database & Backup
```bash
npm run backup:quick     # Quick JSON backup
npm run backup:full      # Complete database backup
npm run backup:cli       # CLI-based backup
npm run backup:help      # Show backup options
```

## Path Aliases
- `@/*` maps to `./src/*` for clean imports
- Components: `@/components`
- Utils: `@/lib/utils`
- UI: `@/components/ui`
- Hooks: `@/hooks`

## Build Configuration
- **TypeScript**: Strict mode with relaxed settings for development velocity
- **Vite**: SWC for fast compilation, path aliases configured
- **Tailwind**: CSS variables for theming, custom color system
- **Component Tagger**: Lovable platform integration for development mode