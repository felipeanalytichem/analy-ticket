# API Documentation - Ticket Management System

## Table of Contents

1. [Project Overview](#project-overview)
2. [Core Services](#core-services)
3. [Custom Hooks](#custom-hooks)
4. [Component Library](#component-library)
5. [Types & Interfaces](#types--interfaces)
6. [Usage Examples](#usage-examples)

## Project Overview

This is a modern React TypeScript ticket management system built with:
- **Frontend**: React 18, TypeScript 5, Vite, Tailwind CSS, shadcn/ui
- **Backend**: Supabase (PostgreSQL, Auth, Real-time, Storage)
- **State Management**: React Query, React Hook Form
- **Validation**: Zod schemas
- **UI Components**: Radix UI primitives with custom styling

## Core Services

### DatabaseService

Central service for all database operations with Supabase.

#### Ticket Operations

```typescript
// Get tickets with filtering options
static async getTickets(options: {
  userId?: string;
  showAll?: boolean;
  assignedOnly?: boolean;
  unassignedOnly?: boolean;
  statusFilter?: string;
  limit?: number;
  userRole?: string;
  searchTerm?: string;
}): Promise<TicketWithDetails[]>

// Create new ticket
static async createTicket(ticketData: Partial<TicketRow>, userFullName?: string): Promise<Ticket>

// Update ticket
static async updateTicket(ticketId: string, updates: Partial<TicketRow>): Promise<TicketWithDetails>

// Get ticket by ID with full details
static async getTicketById(ticketId: string): Promise<TicketWithDetails>

// Resolve ticket
static async resolveTicket(ticketId: string, resolutionNotes: string, resolvedBy: string): Promise<TicketWithDetails>

// Close ticket
static async closeTicket(ticketId: string, closedBy: string): Promise<TicketWithDetails>

// Reopen ticket
static async reopenTicket(ticketId: string, reopenReason: string, reopenedBy: string): Promise<TicketWithDetails>
```

#### Comment Operations

```typescript
// Get ticket comments
static async getTicketComments(ticketId: string): Promise<CommentWithUser[]>

// Add comment to ticket
static async addTicketComment(ticketId: string, userId: string, content: string, isInternal?: boolean): Promise<CommentWithUser>
```

#### Category Operations

```typescript
// Get all categories
static async getCategories(): Promise<Category[]>

// Get subcategories (optionally filtered by category)
static async getSubcategories(categoryId?: string): Promise<Subcategory[]>

// Create new category
static async createCategory(categoryData: Omit<Category, 'id' | 'created_at' | 'updated_at'>): Promise<Category>

// Update category
static async updateCategory(id: string, updates: Partial<Category>): Promise<Category>
```

#### User Operations

```typescript
// Get all users
static async getUsers(): Promise<User[]>

// Get user by ID
static async getUserById(id: string): Promise<User>

// Get agents (users with agent/admin roles)
static async getAgents(): Promise<User[]>

// Get user profiles
static async getUserProfiles(): Promise<UserProfile[]>
```

#### Task Management

```typescript
// Get tasks for ticket
static async getTicketTasks(ticketId: string): Promise<TicketTask[]>

// Create task
static async createTicketTask(taskData: {
  ticket_id: string;
  title: string;
  description?: string;
  assigned_to?: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  due_date?: string;
  created_by: string;
}): Promise<TicketTask>

// Update task
static async updateTicketTask(taskId: string, updates: Partial<TicketTask>): Promise<TicketTask>
```

### NotificationService

Handles all notification operations and real-time subscriptions.

```typescript
// Get notifications for user
static async getNotifications(userId?: string, limit = 50): Promise<NotificationWithTicket[]>

// Get unread count
static async getUnreadCount(userId: string): Promise<number>

// Mark as read
static async markAsRead(notificationId: string): Promise<boolean>

// Mark all as read
static async markAllAsRead(userId: string): Promise<boolean>

// Subscribe to real-time notifications
static subscribeToNotifications(
  userId: string,
  onNotification: (notification: any) => void
): RealtimeChannel

// Create specific notification types
static async createTicketCreatedNotification(ticketId: string, context: NotificationContext): Promise<boolean>
static async createTicketAssignedNotification(ticketId: string, assignedUserId: string, context: NotificationContext): Promise<boolean>
static async createTicketStatusNotification(ticketId: string, ticketUserId: string, context: NotificationContext): Promise<boolean>
```

### EmailService

Email functionality with template support.

```typescript
// Send email
static async sendEmail(emailData: EmailData): Promise<{ success: boolean; error?: string }>

// Send user invitation via magic link
static async sendUserInvitationMagicLink(userEmail: string, userName: string): Promise<{ success: boolean; error?: string }>

// Send ticket notifications
static async sendNewTicketNotification(
  agentEmail: string, 
  agentName: string, 
  ticketNumber: string, 
  ticketTitle: string,
  userEmail: string,
  priority: string
): Promise<{ success: boolean; error?: string }>
```

### EnhancedChatService

Real-time chat system for tickets.

```typescript
// Get or create ticket chat
static async getTicketChat(ticketId: string): Promise<TicketChat>

// Get chat messages
static async getChatMessages(chatId: string): Promise<ChatMessage[]>

// Send message
static async sendChatMessage(
  chatId: string, 
  senderId: string, 
  message: string, 
  isInternal?: boolean,
  replyTo?: string
): Promise<ChatMessage>

// Upload file
static async uploadChatFile(chatId: string, senderId: string, file: File): Promise<ChatMessage>

// Message reactions
static async addReaction(messageId: string, userId: string, emoji: string): Promise<MessageReaction>
static async removeReaction(messageId: string, userId: string, emoji: string): Promise<void>

// Typing indicators
static async broadcastTyping(chatId: string, userId: string, userName: string): Promise<void>
static async stopTyping(chatId: string, userId: string): Promise<void>
```

## Custom Hooks

### useChat

Real-time chat functionality for tickets.

```typescript
function useChat(ticketId: string): {
  chat: TicketChat | null;
  messages: ChatMessage[];
  isLoading: boolean;
  error: string | null;
  connectionStatus: 'SUBSCRIBED' | 'CHANNEL_ERROR' | 'CLOSED' | 'polling' | 'error';
  typingUsers: TypingIndicator[];
  sendMessage: (message: string, isInternal?: boolean, replyTo?: string) => Promise<ChatMessage>;
  uploadFile: (file: File) => Promise<ChatMessage>;
  addReaction: (messageId: string, emoji: string) => Promise<void>;
  removeReaction: (messageId: string, emoji: string) => Promise<void>;
  markAsRead: () => Promise<void>;
  startTyping: () => Promise<void>;
  stopTyping: () => Promise<void>;
  reload: () => Promise<void>;
  forceRefresh: () => Promise<void>;
}
```

**Usage:**
```typescript
const {
  messages,
  sendMessage,
  uploadFile,
  typingUsers,
  connectionStatus
} = useChat(ticketId);

// Send a message
await sendMessage("Hello, how can I help?", false);

// Upload a file
await uploadFile(selectedFile);
```

### useNotifications

Notification management with real-time updates.

```typescript
function useNotifications(userId?: string): {
  notifications: NotificationWithTicket[];
  unreadCount: number;
  isLoading: boolean;
  error: string | null;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
  refetch: () => Promise<void>;
}
```

### useCategoryManagement

Category and subcategory management.

```typescript
function useCategoryManagement(): {
  categories: Category[];
  subcategories: Subcategory[];
  isLoading: boolean;
  error: string | null;
  createCategory: (data: Omit<Category, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  updateCategory: (id: string, updates: Partial<Category>) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
  createSubcategory: (data: Omit<Subcategory, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  updateSubcategory: (id: string, updates: Partial<Subcategory>) => Promise<void>;
  deleteSubcategory: (id: string) => Promise<void>;
  reorderCategories: (updates: Array<{ id: string; sort_order: number }>) => Promise<void>;
}
```

### useUser

User authentication and profile management.

```typescript
function useUser(): {
  user: User | null;
  profile: UserProfile | null;
  isLoading: boolean;
  error: string | null;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
}
```

## Component Library

### UI Components (shadcn/ui)

#### Button
```typescript
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  asChild?: boolean;
}

// Usage
<Button variant="outline" size="sm" onClick={handleClick}>
  Click me
</Button>
```

#### Dialog
```typescript
// Components: Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter

// Usage
<Dialog>
  <DialogTrigger asChild>
    <Button>Open Dialog</Button>
  </DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Dialog Title</DialogTitle>
    </DialogHeader>
    <p>Dialog content here</p>
  </DialogContent>
</Dialog>
```

#### Form Components
```typescript
// Input
<Input 
  type="email" 
  placeholder="Enter email"
  value={value}
  onChange={handleChange}
/>

// Select
<Select value={value} onValueChange={handleChange}>
  <SelectTrigger>
    <SelectValue placeholder="Select option" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="option1">Option 1</SelectItem>
    <SelectItem value="option2">Option 2</SelectItem>
  </SelectContent>
</Select>

// Textarea
<Textarea 
  placeholder="Enter description"
  value={value}
  onChange={handleChange}
/>
```

### Business Components

#### TicketList
Displays list of tickets with filtering and sorting.

```typescript
interface TicketListProps {
  tickets: TicketWithDetails[];
  isLoading?: boolean;
  onTicketClick?: (ticket: TicketWithDetails) => void;
  showFilters?: boolean;
  showPagination?: boolean;
  currentUser?: User | null;
}

// Usage
<TicketList 
  tickets={tickets}
  isLoading={isLoading}
  onTicketClick={(ticket) => navigate(`/ticket/${ticket.id}`)}
  showFilters={true}
  currentUser={user}
/>
```

#### TicketDialog
Full-featured ticket creation/editing dialog.

```typescript
interface TicketDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ticket?: TicketWithDetails | null;
  mode?: 'create' | 'edit';
  onSuccess?: (ticket: TicketWithDetails) => void;
  categories?: Category[];
  subcategories?: Subcategory[];
  agents?: User[];
}
```

#### AgentResponseInterface
Complete interface for agents to respond to tickets.

```typescript
interface AgentResponseInterfaceProps {
  ticket: TicketWithDetails;
  onTicketUpdate?: (ticket: TicketWithDetails) => void;
  onClose?: () => void;
}
```

#### TaskManagement
Task management component for tickets.

```typescript
interface TaskManagementProps {
  ticketId: string;
  currentUser: User;
  readOnly?: boolean;
}
```

#### SLAMonitor
SLA monitoring and alerts.

```typescript
interface SLAMonitorProps {
  tickets: TicketWithDetails[];
  showOnlyOverdue?: boolean;
  refreshInterval?: number;
}
```

## Types & Interfaces

### Core Types

```typescript
export interface Ticket {
  id: string;
  ticket_number?: string;
  title: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  category_id?: string;
  subcategory_id?: string;
  user_id: string;
  assigned_to?: string;
  created_at: string;
  updated_at?: string;
  resolved_at?: string;
  closed_at?: string;
  // ... additional fields
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  agent_level?: number | null;
  avatar_url?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface Category {
  id: string;
  name: string;
  description?: string;
  color: string;
  icon: string;
  sort_order: number;
  is_enabled?: boolean;
  created_at: string;
  updated_at: string;
}

export interface TicketComment {
  id: string;
  ticket_id: string;
  user_id: string;
  content: string;
  is_internal?: boolean;
  created_at: string;
  user?: {
    name: string;
    email: string;
  };
}
```

### Chat Types

```typescript
export interface ChatMessage {
  id: string;
  chat_id: string;
  sender_id: string;
  message?: string;
  file_path?: string;
  file_name?: string;
  is_read: boolean;
  is_internal: boolean;
  message_type: 'text' | 'file' | 'system';
  created_at: string;
  sender?: UserBasic;
  reactions?: MessageReaction[];
}

export interface MessageReaction {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
  user?: UserBasic;
}
```

### Notification Types

```typescript
export interface Notification {
  id?: string;
  user_id: string;
  message: string;
  type: 'ticket_created' | 'ticket_updated' | 'ticket_assigned' | 'comment_added' | 'status_changed';
  ticket_id?: string;
  read?: boolean;
  priority?: 'low' | 'medium' | 'high';
  created_at: string;
  title: string;
}
```

## Usage Examples

### Creating a Ticket

```typescript
import { DatabaseService } from '@/lib/database';
import { NotificationService } from '@/lib/notificationService';

const createTicket = async (ticketData: {
  title: string;
  description: string;
  priority: TicketPriority;
  category_id?: string;
  user_id: string;
}) => {
  try {
    // Create the ticket
    const ticket = await DatabaseService.createTicket(ticketData);
    
    // Send notifications to agents
    await NotificationService.createTicketCreatedNotification(ticket.id, {
      ticketNumber: ticket.ticket_number,
      ticketTitle: ticket.title,
      userName: 'User Name'
    });
    
    return ticket;
  } catch (error) {
    console.error('Error creating ticket:', error);
    throw error;
  }
};
```

### Setting Up Real-time Chat

```typescript
import { useChat } from '@/hooks/useChat';

const TicketChatComponent = ({ ticketId }: { ticketId: string }) => {
  const {
    messages,
    sendMessage,
    uploadFile,
    typingUsers,
    connectionStatus,
    startTyping,
    stopTyping
  } = useChat(ticketId);

  const handleSendMessage = async (message: string) => {
    try {
      await sendMessage(message, false);
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  const handleFileUpload = async (file: File) => {
    try {
      await uploadFile(file);
    } catch (error) {
      console.error('Failed to upload file:', error);
    }
  };

  return (
    <div className="chat-container">
      <div className="messages">
        {messages.map(message => (
          <div key={message.id} className="message">
            {message.message}
          </div>
        ))}
      </div>
      
      {typingUsers.length > 0 && (
        <div className="typing-indicator">
          {typingUsers.map(user => user.user_name).join(', ')} is typing...
        </div>
      )}
      
      <div className="connection-status">
        Status: {connectionStatus}
      </div>
    </div>
  );
};
```

### Managing Categories

```typescript
import { useCategoryManagement } from '@/hooks/useCategoryManagement';

const CategoryManager = () => {
  const {
    categories,
    createCategory,
    updateCategory,
    deleteCategory,
    isLoading
  } = useCategoryManagement();

  const handleCreateCategory = async () => {
    await createCategory({
      name: 'New Category',
      description: 'Category description',
      color: '#3b82f6',
      icon: 'folder',
      sort_order: categories.length
    });
  };

  const handleUpdateCategory = async (id: string) => {
    await updateCategory(id, {
      name: 'Updated Name'
    });
  };

  if (isLoading) return <div>Loading...</div>;

  return (
    <div>
      {categories.map(category => (
        <div key={category.id}>
          {category.name}
          <button onClick={() => handleUpdateCategory(category.id)}>
            Update
          </button>
        </div>
      ))}
      <button onClick={handleCreateCategory}>
        Add Category
      </button>
    </div>
  );
};
```

### Form Validation with Zod

```typescript
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

const ticketSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title too long'),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
  category_id: z.string().optional(),
});

type TicketFormData = z.infer<typeof ticketSchema>;

const TicketForm = () => {
  const form = useForm<TicketFormData>({
    resolver: zodResolver(ticketSchema),
    defaultValues: {
      title: '',
      description: '',
      priority: 'medium',
    }
  });

  const onSubmit = async (data: TicketFormData) => {
    try {
      await DatabaseService.createTicket(data);
    } catch (error) {
      console.error('Error:', error);
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <input {...form.register('title')} placeholder="Title" />
      {form.formState.errors.title && (
        <span>{form.formState.errors.title.message}</span>
      )}
      
      <textarea {...form.register('description')} placeholder="Description" />
      {form.formState.errors.description && (
        <span>{form.formState.errors.description.message}</span>
      )}
      
      <button type="submit">Create Ticket</button>
    </form>
  );
};
```

---

This documentation covers the main public APIs, functions, and components in the ticket management system. For specific implementation details, refer to the individual component files and service implementations.