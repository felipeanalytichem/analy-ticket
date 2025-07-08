import { supabase } from '@/lib/supabase';
import type { Tables } from '@/integrations/supabase/types';
import { NotificationService } from './notificationService';

export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TicketStatus = 'open' | 'pending' | 'in_progress' | 'resolved' | 'closed';

// Use the actual database types
type TicketRow = Tables<'tickets_new'>;
type UserRow = Tables<'users'>;
type CommentRow = Tables<'ticket_comments_new'>;
type NotificationRow = Tables<'notifications'>;

// Type assertion to bypass TypeScript issues with generated types
const db = supabase as any;

// Basic types for our database entities
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

export interface Subcategory {
  id: string;
  category_id: string;
  name: string;
  description?: string;
  sort_order: number;
  response_time_hours: number;
  resolution_time_hours: number;
  specialized_agents: string[];
  created_at: string;
  updated_at: string;
  category?: Category;
}

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
  resolved_by?: string;
  resolution?: string;
  closed_at?: string;
  closed_by?: string;
  country?: string;
  // Employee onboarding specific fields
  first_name?: string;
  last_name?: string;
  username?: string;
  display_name?: string;
  job_title?: string;
  manager?: string;
  company_name?: string;
  department?: string;
  office_location?: string;
  business_phone?: string;
  mobile_phone?: string;
  start_date?: string;
  signature_group?: string;
  usage_location?: string;
  country_distribution_list?: string;
  license_type?: string;
  mfa_setup?: string;
  attached_form?: string;
  creator?: {
    name: string;
    email: string;
  };
  assignee?: {
    name: string;
    email: string;
  };
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

export interface TicketAttachment {
  id: string;
  ticket_id: string;
  file_name: string;
  file_path: string;
  file_size?: number | null;
  mime_type?: string | null;
  uploaded_by: string;
  uploaded_at?: string | null;
}

export interface KnowledgeArticle {
  id: string;
  title: string;
  content: string;
  knowledge_category_id: string | null;
  author_id: string;
  status: 'draft' | 'review' | 'published' | 'archived';
  tags?: string[];
  excerpt?: string;
  featured?: boolean;
  likes_count?: number;
  dislikes_count?: number;
  helpful_count?: number;
  not_helpful_count?: number;
  view_count?: number;
  reading_time_minutes?: number;
  version?: number;
  meta_description?: string;
  last_reviewed_at?: string | null;
  last_reviewed_by?: string | null;
  created_at?: string;
  updated_at?: string;
  author?: {
    id: string;
    full_name: string;
    email: string;
  };
  knowledge_category?: KnowledgeCategory;
}

export interface KnowledgeCategory {
  id: string;
  name: string;
  slug: string;
  description?: string;
  icon: string;
  color?: string;
  sort_order: number;
  is_active?: boolean;
  parent_id?: string | null;
  created_at?: string;
  updated_at?: string;
  parent?: KnowledgeCategory;
}

export interface KnowledgeArticleAttachment {
  id: string;
  article_id: string;
  filename: string;
  original_filename: string;
  file_url: string;
  file_size?: number;
  mime_type?: string;
  alt_text?: string;
  caption?: string;
  sort_order?: number;
  uploaded_by?: string;
  created_at?: string;
}

export interface KnowledgeArticleFeedback {
  id: string;
  article_id: string;
  user_id?: string;
  rating: 1 | -1; // 1 for helpful, -1 for not helpful
  feedback_text?: string;
  is_anonymous?: boolean;
  user_ip?: string;
  created_at?: string;
}

export interface SLARule {
  id: string;
  name: string;
  priority: string;
  response_time: unknown;
  resolution_time: unknown;
  is_active?: boolean | null;
  created_at?: string | null;
}

export interface SLAStatus {
  ticketId: string;
  responseStatus: 'ok' | 'warning' | 'overdue' | 'met' | 'stopped';
  resolutionStatus: 'ok' | 'warning' | 'overdue' | 'met' | 'stopped';
  responseTimeElapsed: number;
  totalTimeElapsed: number;
  firstResponseAt: Date | null;
  slaRule: SLARule;
  isActive: boolean;
}

export interface TicketTask {
  id: string;
  ticket_id: string;
  title: string;
  description?: string;
  assigned_to?: string;
  status: 'open' | 'in_progress' | 'done' | 'blocked';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  due_date?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  completed_at?: string;
  assignee?: UserBasic;
  creator?: UserBasic;
  comments?: TicketTaskComment[];
  comments_count?: number;
}

export interface TicketTaskComment {
  id: string;
  task_id: string;
  user_id: string;
  comment: string;
  created_at: string;
  updated_at: string;
  user?: UserBasic;
}

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string; // Note: database uses 'message' not 'content'
  ticket_id?: string; // Changed from related_ticket_id to ticket_id
  read: boolean; // Changed from is_read to read
  priority?: string;
  created_at: string;
}

// Extended types for joined data
export interface UserBasic {
  id: string;
  name: string;
  email: string;
  avatar_url?: string | null;
}

export interface CategoryBasic {
  id: string;
  name: string;
  description?: string | null;
}

export interface TicketFeedback {
  id: string;
  ticket_id: string;
  user_id: string;
  rating: number;
  satisfaction: "satisfied" | "neutral" | "unsatisfied";
  comment?: string | null;
  categories?: string[] | null;
  agent_name?: string | null;
  created_at: string;
  updated_at?: string | null;
}

export interface TicketActivityLog {
  id: string;
  ticket_id: string;
  user_id?: string | null;
  action_type: string;
  field_name?: string | null;
  old_value?: string | null;
  new_value?: string | null;
  description: string;
  metadata?: any;
  created_at: string;
  user?: UserBasic;
}

export interface TicketWithDetails extends Ticket {
  user?: UserBasic;
  assignee?: UserBasic;
  category?: CategoryBasic;
  comments?: TicketComment[];
  attachments?: TicketAttachment[];
  resolution?: string | null;
  resolved_at?: string | null;
  closed_at?: string | null;
  resolved_by?: string | null;
  closed_by?: string | null;
  resolved_by_user?: UserBasic;
  closed_by_user?: UserBasic;
  feedback?: TicketFeedback | null;
  feedback_received?: boolean;
  sla_status?: {
    responseTime: number;
    dueDate: string;
    hoursRemaining: number;
    isOverdue: boolean;
    isNearDue: boolean;
  } | null;
}

export interface CommentWithUser extends TicketComment {
  user?: UserBasic;
}

// Chat system interfaces
export interface TicketChat {
  id: string;
  ticket_id: string;
  created_at: string;
  updated_at: string;
  is_active: boolean;
}

export interface ChatMessage {
  id: string;
  chat_id: string;
  sender_id: string;
  message?: string;
  file_path?: string;
  file_name?: string;
  file_size?: number;
  mime_type?: string;
  is_read: boolean;
  is_internal: boolean;
  message_type: 'text' | 'file' | 'system';
  created_at: string;
  updated_at: string;
  sender?: UserBasic;
  mentions?: ChatMessageMention[];
}

export interface ChatParticipant {
  id: string;
  chat_id: string;
  user_id: string;
  joined_at: string;
  last_read_at?: string;
  can_write: boolean;
  user?: UserBasic;
}

export interface ChatMessageMention {
  id: string;
  message_id: string;
  mentioned_user_id: string;
  created_at: string;
  mentioned_user?: UserBasic;
}

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: 'user' | 'agent' | 'admin';
  created_at: string;
  updated_at: string;
  avatar_url?: string;
}

// Database service class
export class DatabaseService {
  // User operations
  static async getUsers(): Promise<User[]> {
    const { data, error } = await db
      .from('users')
      .select('*')
      .order('full_name');
    
    if (error) throw error;
    return (data || []).map(user => ({
      ...user,
      name: user.full_name || user.email || 'Unknown'
    }));
  }

  static async getUserById(id: string): Promise<User> {
    const { data, error } = await db
      .from('users')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return {
      ...data,
      name: data.full_name || data.email || 'Unknown'
    };
  }

  static async getAgents(): Promise<User[]> {
    const { data, error } = await db
      .from('users')
      .select('*')
      .in('role', ['agent', 'admin'])
      .order('full_name');
    
    if (error) throw error;
    return (data || []).map(user => ({
      ...user,
      name: user.full_name || user.email || 'Unknown'
    }));
  }

  // Category operations
  static async getCategories(): Promise<Category[]> {
    const { data, error } = await db
      .from('categories')
      .select('*')
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('Error fetching categories:', error);
      throw error;
    }

    return data || [];
  }

  static async getSubcategories(categoryId?: string): Promise<Subcategory[]> {
    let query = db
      .from('subcategories')
      .select(`
        *,
        category:categories(*)
      `)
      .order('sort_order', { ascending: true });

    if (categoryId) {
      query = query.eq('category_id', categoryId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching subcategories:', error);
      throw error;
    }

    return data || [];
  }

  static async createCategory(categoryData: Omit<Category, 'id' | 'created_at' | 'updated_at'>): Promise<Category> {
    const { data, error } = await db
      .from('categories')
      .insert(categoryData)
      .select()
      .single();

    if (error) {
      console.error('Error creating category:', error);
      throw error;
    }

    return data;
  }

  static async updateCategory(id: string, updates: Partial<Category>): Promise<Category> {
    const { data, error } = await db
      .from('categories')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating category:', error);
      throw error;
    }

    return data;
  }

  static async createSubcategory(subcategoryData: Omit<Subcategory, 'id' | 'created_at' | 'updated_at' | 'category'>): Promise<Subcategory> {
    const { data, error } = await db
      .from('subcategories')
      .insert(subcategoryData)
      .select(`
        *,
        category:categories(*)
      `)
      .single();

    if (error) {
      console.error('Error creating subcategory:', error);
      throw error;
    }

    return data;
  }

  static async updateSubcategory(id: string, updates: Partial<Subcategory>): Promise<Subcategory> {
    const { data, error } = await db
      .from('subcategories')
      .update(updates)
      .eq('id', id)
      .select(`
        *,
        category:categories(*)
      `)
      .single();

    if (error) throw error;
    return data;
  }

  // Delete operations
  static async deleteCategory(id: string): Promise<void> {
    const { error } = await db
      .from('categories')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  static async deleteCategories(ids: string[]): Promise<void> {
    const { error } = await db
      .from('categories')
      .delete()
      .in('id', ids);

    if (error) throw error;
  }

  static async deleteSubcategory(id: string): Promise<void> {
    const { error } = await db
      .from('subcategories')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  static async deleteSubcategories(ids: string[]): Promise<void> {
    const { error } = await db
      .from('subcategories')
      .delete()
      .in('id', ids);

    if (error) throw error;
  }

  // Enhanced category operations for new features
  static async toggleCategoryStatus(id: string, isEnabled: boolean): Promise<Category> {
    // Note: This assumes the database has an 'is_enabled' column
    // In the current implementation, we're handling this client-side
    const { data, error } = await db
      .from('categories')
      .update({ is_enabled: isEnabled })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error toggling category status:', error);
      throw error;
    }

    return data;
  }

  static async updateCategoryOrder(id: string, sortOrder: number): Promise<Category> {
    const { data, error } = await db
      .from('categories')
      .update({ sort_order: sortOrder })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating category order:', error);
      throw error;
    }

    return data;
  }

  static async updateSubcategoryOrder(id: string, sortOrder: number): Promise<Subcategory> {
    const { data, error } = await db
      .from('subcategories')
      .update({ sort_order: sortOrder })
      .eq('id', id)
      .select(`
        *,
        category:categories(*)
      `)
      .single();

    if (error) {
      console.error('Error updating subcategory order:', error);
      throw error;
    }

    return data;
  }

  static async saveDynamicFormSchema(categoryId: string, formSchema: any): Promise<void> {
    // Note: This assumes the database has a 'dynamic_form_schema' column
    // In the current implementation, we're handling this client-side
    const { error } = await db
      .from('categories')
      .update({ dynamic_form_schema: formSchema })
      .eq('id', categoryId);

    if (error) {
      console.error('Error saving form schema:', error);
      throw error;
    }
  }

  static async getCategoriesForTicketForm(): Promise<Array<{ id: string; name: string; subcategories: Array<{ id: string; name: string }> }>> {
    const { data: categories, error } = await db
      .from('categories')
      .select(`
        id,
        name,
        is_enabled,
        subcategories:subcategories(id, name)
      `)
      .eq('is_enabled', true)
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('Error fetching categories for ticket form:', error);
      throw error;
    }

    return categories?.map(cat => ({
      id: cat.id,
      name: cat.name,
      subcategories: cat.subcategories || []
    })) || [];
  }

  static async bulkUpdateCategoryOrder(updates: Array<{ id: string; sort_order: number }>): Promise<void> {
    // For bulk operations, we'll use multiple individual updates
    // In a real implementation, you might want to use a stored procedure or batch operation
    const promises = updates.map(update => 
      this.updateCategoryOrder(update.id, update.sort_order)
    );

    await Promise.all(promises);
  }

  static async bulkUpdateSubcategoryOrder(updates: Array<{ id: string; sort_order: number }>): Promise<void> {
    // For bulk operations, we'll use multiple individual updates
    const promises = updates.map(update => 
      this.updateSubcategoryOrder(update.id, update.sort_order)
    );

    await Promise.all(promises);
  }

  // Ticket operations
  static async getTickets(options: {
    userId?: string;
    showAll?: boolean;
    assignedOnly?: boolean;
    unassignedOnly?: boolean;
    statusFilter?: string;
    limit?: number;
    userRole?: string;
    searchTerm?: string;
  } = {}): Promise<TicketWithDetails[]> {
    try {
      // Get tickets using correct column names
      let query = db
        .from('tickets_new')
        .select('*');

      // Apply assignment filters FIRST
      if (options.assignedOnly && options.userId) {
        query = query.eq('assigned_to', options.userId);
      } else if (options.unassignedOnly) {
        query = query.is('assigned_to', null);
      }

      // Apply visibility rules based on user role and showAll setting
      if (!options.showAll && options.userId) {
        if (options.userRole === 'user') {
          // Users can only see tickets they created (regardless of assignment)
          query = query.eq('user_id', options.userId);
        } else if (options.userRole === 'agent' && !options.searchTerm && !options.assignedOnly && !options.unassignedOnly) {
          // Agents can see: unassigned tickets OR tickets assigned to them
          query = query.or(`assigned_to.is.null,assigned_to.eq.${options.userId}`);
        }
        // Admins with showAll=false will see all tickets (no additional filter)
      }

      // Apply status filters SECOND
      if (options.statusFilter) {
        if (options.statusFilter === 'my_tickets') {
          // For "My Tickets" - show all status of tickets assigned to user
          // (no status filter, but already filtered by assignment above)
        } else if (options.statusFilter === 'all') {
          // For "All Tickets" - no status filter (show all statuses)
        } else if (options.statusFilter === 'active') {
          // Special filter for active tickets - only open and in_progress
          query = query.in('status', ['open', 'in_progress']);
          
          // Apply agent visibility rules for "active" tickets
          if (options.userRole === 'agent' && options.userId && !options.searchTerm && !options.showAll) {
            // For agents without search: show unassigned tickets OR tickets assigned to them
            query = query.or(`assigned_to.is.null,assigned_to.eq.${options.userId}`);
          }
        } else {
          // Standard status filter
          query = query.eq('status', options.statusFilter);
        }
      }

      // Add search functionality
      if (options.searchTerm) {
        const searchPattern = `%${options.searchTerm}%`;
        query = query.or(`title.ilike.${searchPattern},description.ilike.${searchPattern}`);
      }

      // Add ordering and limit
      query = query.order('created_at', { ascending: false });

      if (options.limit) {
        query = query.limit(options.limit);
      }

      const { data, error } = await query;

      if (error) {
        throw new Error(`Failed to fetch tickets: ${error.message}`);
      }

      if (!data || data.length === 0) {
        return [];
      }

      // Get all unique user IDs from tickets
      const userIds = new Set<string>();
      data.forEach(ticket => {
        if (ticket.user_id) userIds.add(ticket.user_id);
        if (ticket.assigned_to) userIds.add(ticket.assigned_to);
        if (ticket.resolved_by) userIds.add(ticket.resolved_by);
        if (ticket.closed_by) userIds.add(ticket.closed_by);
      });

      // Fetch user data separately
      let users: UserRow[] = [];
      if (userIds.size > 0) {
        const { data: userData, error: userError } = await db
          .from('users')
          .select('*')
          .in('id', Array.from(userIds));

        if (!userError && userData) {
          users = userData;
        }
      }

      // Create a user lookup map
      const userMap = new Map(users.map(user => [user.id, user]));

      // Get all attachments for all tickets in one query
      const ticketIds = data.map(ticket => ticket.id);
      let allAttachments: TicketAttachment[] = [];
      if (ticketIds.length > 0) {
        const { data: attachmentData, error: attachmentError } = await db
          .from('ticket_attachments')
          .select('*')
          .in('ticket_id', ticketIds);
        
        if (!attachmentError && attachmentData) {
          allAttachments = attachmentData;
        }
      }

      // Create attachment lookup map
      const attachmentMap = new Map<string, TicketAttachment[]>();
      allAttachments.forEach(attachment => {
        const existing = attachmentMap.get(attachment.ticket_id) || [];
        attachmentMap.set(attachment.ticket_id, [...existing, attachment]);
      });

      // Combine tickets with user data and attachments
      const ticketsWithDetails = data.map(ticket => {
        return {
        ...ticket,
          sla_status: null, // Simplified for now
        user: ticket.user_id ? {
            id: ticket.user_id,
          name: userMap.get(ticket.user_id)?.full_name || userMap.get(ticket.user_id)?.email || 'Unknown',
            email: userMap.get(ticket.user_id)?.email || '',
            avatar_url: userMap.get(ticket.user_id)?.avatar_url || null
        } : undefined,
        creator: ticket.user_id ? {
            id: ticket.user_id,
          name: userMap.get(ticket.user_id)?.full_name || userMap.get(ticket.user_id)?.email || 'Unknown',
            email: userMap.get(ticket.user_id)?.email || '',
            avatar_url: userMap.get(ticket.user_id)?.avatar_url || null
        } : undefined,
        assignee: ticket.assigned_to ? {
            id: ticket.assigned_to,
          name: userMap.get(ticket.assigned_to)?.full_name || userMap.get(ticket.assigned_to)?.email || 'Unknown',
            email: userMap.get(ticket.assigned_to)?.email || '',
            avatar_url: userMap.get(ticket.assigned_to)?.avatar_url || null
        } : undefined,
        attachments: attachmentMap.get(ticket.id) || []
        };
      });

      return ticketsWithDetails;
    } catch (error) {
      throw error;
    }
  }

  static async getTicketById(ticketId: string): Promise<TicketWithDetails> {
    try {
      // Get ticket without foreign key relationships
      const { data: ticket, error } = await db
        .from('tickets_new')
        .select('*')
        .eq('id', ticketId)
        .single();
      
      if (error) throw error;
      if (!ticket) throw new Error('Ticket not found');

      // Get user data separately
      const userIds = new Set<string>();
      if (ticket.user_id) userIds.add(ticket.user_id);
      if (ticket.assigned_to) userIds.add(ticket.assigned_to);
      if (ticket.resolved_by) userIds.add(ticket.resolved_by);
      if (ticket.closed_by) userIds.add(ticket.closed_by);

      let users: UserRow[] = [];
      if (userIds.size > 0) {
        const { data: userData, error: userError } = await db
          .from('users')
          .select('*')
          .in('id', Array.from(userIds));

        if (!userError && userData) {
          users = userData;
        }
      }

      // Create user lookup map
      const userMap = new Map(users.map(user => [user.id, user]));

      // Get ticket attachments
      const attachments = await this.getTicketAttachments(ticketId);

      // Combine ticket with user data and attachments
      const ticketWithDetails = {
        ...ticket,
        creator: ticket.user_id ? {
          id: ticket.user_id,
          name: userMap.get(ticket.user_id)?.full_name || userMap.get(ticket.user_id)?.email || 'Unknown',
          email: userMap.get(ticket.user_id)?.email || '',
          avatar_url: userMap.get(ticket.user_id)?.avatar_url || null
        } : undefined,
        assignee: ticket.assigned_to ? {
          id: ticket.assigned_to,
          name: userMap.get(ticket.assigned_to)?.full_name || userMap.get(ticket.assigned_to)?.email || 'Unknown',
          email: userMap.get(ticket.assigned_to)?.email || '',
          avatar_url: userMap.get(ticket.assigned_to)?.avatar_url || null
        } : undefined,
        attachments
      };

      return ticketWithDetails;
    } catch (error) {
      throw error;
    }
  }

  static async createTicket(ticketData: Partial<TicketRow>, userFullName?: string) {
    try {
      // Create ticket object without ticket_number - let the database trigger generate it automatically
      const newTicket = {
        title: ticketData.title,
        description: ticketData.description,
        priority: ticketData.priority,
        category_id: ticketData.category_id,
        subcategory_id: ticketData.subcategory_id,
        country: ticketData.country,
        user_id: ticketData.user_id,
        first_name: ticketData.first_name,
        last_name: ticketData.last_name,
        username: ticketData.username,
        display_name: ticketData.display_name,
        job_title: ticketData.job_title,
        manager: ticketData.manager,
        company_name: ticketData.company_name,
        department: ticketData.department,
        office_location: ticketData.office_location,
        business_phone: ticketData.business_phone,
        mobile_phone: ticketData.mobile_phone,
        start_date: ticketData.start_date,
        signature_group: ticketData.signature_group,
        usage_location: ticketData.usage_location,
        country_distribution_list: ticketData.country_distribution_list,
        license_type: ticketData.license_type,
        mfa_setup: ticketData.mfa_setup,
        attached_form: ticketData.attached_form,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      // Remove undefined/null values
      Object.keys(newTicket).forEach(key => {
        if (newTicket[key] === undefined || newTicket[key] === null) {
          delete newTicket[key];
        }
      });

      console.log('🎫 Creating ticket with auto-generated ticket number (ACS-TK pattern)');
      console.log('📋 Dados completos do ticket:', JSON.stringify(newTicket, null, 2));
      console.log('🔑 user_id no newTicket:', newTicket.user_id, 'tipo:', typeof newTicket.user_id);
      
      // Log category and subcategory information
      if (newTicket.category_id) {
        console.log('📁 Category ID:', newTicket.category_id);
      }
      if (newTicket.subcategory_id) {
        console.log('📄 Subcategory ID:', newTicket.subcategory_id);
      }

      // Insert the ticket - o banco gerará automaticamente o ticket_number
      const { data, error } = await db
        .from('tickets_new')
        .insert([newTicket])
        .select('*')
        .single();

      if (error) {
        console.error('❌ Database error during ticket creation:', error);
        throw error;
      }

      console.log('✅ Ticket created successfully with auto-generated number:', data.ticket_number);

      // Create notifications for ticket creation
      try {
        await NotificationService.createTicketCreatedNotification(data.id, {
          ticketNumber: data.ticket_number,
          ticketTitle: data.title,
          userName: userFullName || 'Usuário'
        });
        console.log('🔔 Ticket creation notification sent successfully');
      } catch (notificationError) {
        console.warn('⚠️ Failed to create ticket notification (non-blocking):', notificationError);
      }

      return data;
    } catch (error) {
      console.error('💥 Failed to create ticket:', error);
      throw error;
    }
  }

  static async updateTicket(ticketId: string, updates: Partial<TicketRow>) {
    try {
      // Get current ticket data to compare changes
      const { data: currentTicket } = await db
        .from('tickets_new')
        .select('*')
        .eq('id', ticketId)
        .single();

      const updateData = {
        ...updates,
        updated_at: new Date().toISOString()
      };

      const { data, error } = await db
        .from('tickets_new')
        .update(updateData)
        .eq('id', ticketId)
        .select('*')
        .single();

      if (error) {
        throw error;
      }

      // Create notifications for significant changes
      try {
        if (currentTicket) {
          // Status change notification
          if (updates.status && updates.status !== currentTicket.status) {
            await this.createTicketNotification(ticketId, 'status_changed');
            console.log(`🔔 Status change notification sent: ${currentTicket.status} → ${updates.status}`);
          }

          // Assignment change notification
          if (updates.assigned_to !== undefined && updates.assigned_to !== currentTicket.assigned_to) {
            // Pass the previous assignee as target if removing assignment, new assignee if adding
            const targetUserId = updates.assigned_to || currentTicket.assigned_to;
            await this.createTicketNotification(ticketId, 'assignment_changed', targetUserId);
            console.log(`🔔 Assignment change notification sent: ${currentTicket.assigned_to} → ${updates.assigned_to}`);
          }

          // Priority change notification
          if (updates.priority && updates.priority !== currentTicket.priority) {
            await this.createTicketNotification(ticketId, 'priority_changed');
            console.log(`🔔 Priority change notification sent: ${currentTicket.priority} → ${updates.priority}`);
          }
        }
      } catch (notificationError) {
        console.warn('⚠️ Failed to create ticket update notification (non-blocking):', notificationError);
      }

      return data;
    } catch (error) {
      throw error;
    }
  }

  static async deleteTicket(id: string): Promise<void> {
    const { error } = await db
      .from('tickets_new')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  }

  // Comment operations
  static async getTicketComments(ticketId: string): Promise<CommentWithUser[]> {
    try {
      // Get comments without foreign key relationships
      const { data: comments, error } = await db
        .from('ticket_comments_new')
        .select('*')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      if (!comments || comments.length === 0) return [];

      // Get unique user IDs
      const userIds = Array.from(new Set(comments.map(comment => comment.user_id)));
      
      // Fetch user data separately
      let users: UserRow[] = [];
      if (userIds.length > 0) {
        const { data: userData, error: userError } = await db
          .from('users')
          .select('*')
          .in('id', userIds);

        if (!userError && userData) {
          users = userData;
        }
      }

      // Create user lookup map
      const userMap = new Map(users.map(user => [user.id, user]));

      // Combine comments with user data
      const commentsWithUsers = comments.map(comment => ({
        ...comment,
        user: userMap.get(comment.user_id)
      }));

      return commentsWithUsers;
    } catch (error) {
      throw error;
    }
  }

  static async addTicketComment(ticketId: string, userId: string, content: string, isInternal: boolean = false): Promise<CommentWithUser> {
    try {
      // Por enquanto, vamos inserir sem o campo is_internal até confirmarmos que existe no banco
      const insertData: any = {
        ticket_id: ticketId,
        user_id: userId,
        content,
        created_at: new Date().toISOString()
      };

      // Tentar adicionar is_internal se o campo existir
      try {
        insertData.is_internal = isInternal;
      } catch (e) {
        console.log('Campo is_internal não existe ainda, inserindo sem ele');
      }

      const { data, error } = await db
        .from('ticket_comments_new')
        .insert([insertData])
        .select('*')
        .single();

      if (error) {
        throw error;
      }

      // Get user data separately
      const { data: userData, error: userError } = await db
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      const commentWithUser = {
        ...data,
        is_internal: isInternal, // Adicionar localmente para compatibilidade
        user: userError ? undefined : userData
      };

      // Check if this is the first agent response for SLA tracking
      console.log(`🔍 SLA Debug: Checking user role for ${userData?.full_name}: ${userData?.role}`);
      if (userData && ['agent', 'admin'].includes(userData.role)) {
        console.log(`✅ User is agent/admin - proceeding with first response check`);
        try {
          // Get ticket details to check if this is first agent response
          const { data: ticket } = await db
            .from('tickets_new')
            .select('user_id, status, ticket_number')
            .eq('id', ticketId)
            .single();

          if (ticket && userData.id !== ticket.user_id && ['open', 'in_progress'].includes(ticket.status)) {
            console.log(`🔍 SLA Debug: Ticket checks passed - user ${userData.id} ≠ creator ${ticket.user_id}, status: ${ticket.status}`);
            // CRITICAL FIX: Check for previous agent responses BEFORE this comment's timestamp
            const commentTime = new Date(data.created_at);
            console.log(`🔍 SLA Debug: Checking for previous responses before ${commentTime.toISOString()}`);
            const previousResponse = await this.detectFirstAgentResponseBefore(ticketId, commentTime);
            console.log(`🔍 SLA Debug: Previous response found: ${previousResponse ? previousResponse.toISOString() : 'NONE'}`);
            
            
            if (!previousResponse) {
              console.log(`🎯 SLA Debug: THIS IS FIRST RESPONSE! Logging for ticket ${ticketId}`);
              // This IS the first agent response - log it and trigger notifications
              await this.logFirstResponse(ticketId, userData.id, commentTime);
              
              // Create first response notification for SLA tracking - notify ticket creator
              await NotificationService.createFirstResponseNotification(ticketId, ticket.user_id, {
                agentName: userData.full_name || userData.name || 'Agente',
                ticketNumber: ticket.ticket_number || '#' + ticketId.slice(-8)
              });
              
              console.log(`📋 First agent response detected for ticket ${ticketId} by ${userData.full_name}`);
            }
          }
                } catch (slaError) {
          console.error('❌ SLA tracking failed (non-blocking):', slaError);
        }
      } else {
        console.log(`❌ SLA Debug: User role check failed - userData: ${!!userData}, role: ${userData?.role}`);
      }

      // Create notification for non-internal comments
      if (!isInternal) {
        try {
          await NotificationService.createCommentNotification(ticketId, {
            userName: userData?.full_name || 'Usuário'
          });
          console.log('💬 Comment notification created successfully');
        } catch (notificationError) {
          console.warn('⚠️ Failed to create comment notification (non-blocking):', notificationError);
        }
      }

      return commentWithUser;
    } catch (error) {
      throw error;
    }
  }

  // Attachment operations
  static async getTicketAttachments(ticketId: string): Promise<TicketAttachment[]> {
    try {
      const { data, error } = await db
        .from('ticket_attachments')
        .select('*')
        .eq('ticket_id', ticketId)
        .order('uploaded_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error getting ticket attachments:', error);
      return [];
    }
  }

  static async createAttachment(attachmentData: Partial<TicketAttachment>): Promise<TicketAttachment> {
    try {
      const { data, error } = await db
        .from('ticket_attachments')
        .insert(attachmentData)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error creating attachment:', error);
      throw error;
    }
  }

  // Create ticket attachment from chat file
  static async createTicketAttachmentFromChatFile(
    ticketId: string,
    fileName: string,
    filePath: string,
    fileSize: number,
    mimeType: string,
    uploadedBy: string
  ): Promise<TicketAttachment> {
    try {
      const attachmentData = {
        ticket_id: ticketId,
        file_name: fileName,
        file_path: filePath,
        file_size: fileSize,
        mime_type: mimeType,
        uploaded_by: uploadedBy,
        uploaded_at: new Date().toISOString()
      };
      
      return await this.createAttachment(attachmentData);
    } catch (error) {
      console.error('Error creating ticket attachment from chat file:', error);
      throw error;
    }
  }

  // Tag operations
  static async getTicketTags(): Promise<TicketTag[]> {
    return [];
  }

  // Knowledge Base operations
  static async getKnowledgeArticles(options: {
    status?: 'draft' | 'review' | 'published' | 'archived';
    categoryId?: string;
    limit?: number;
  } = {}): Promise<KnowledgeArticle[]> {
    let query = db
      .from('knowledge_articles')
      .select(`
        *,
        author:users!knowledge_articles_author_id_fkey(id, full_name, email),
        knowledge_category:knowledge_categories!knowledge_articles_knowledge_category_id_fkey(
          id,
          name,
          slug,
          description,
          icon,
          color,
          sort_order,
          is_active,
          parent_id
        )
      `);

    if (options.status) {
      query = query.eq('status', options.status);
    }

    if (options.categoryId) {
      query = query.eq('knowledge_category_id', options.categoryId);
    }

    query = query.order('created_at', { ascending: false });

    if (options.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;
    
    if (error) throw error;
    return data || [];
  }

  static async getKnowledgeArticleById(id: string): Promise<any> {
    const { data, error } = await db
      .from('knowledge_articles')
      .select(`
        *,
        author:users!knowledge_articles_author_id_fkey(id, full_name, email),
        knowledge_category:knowledge_categories!knowledge_articles_knowledge_category_id_fkey(*)
      `)
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data;
  }

  static async createKnowledgeArticle(articleData: Partial<KnowledgeArticle>): Promise<any> {
    try {
      const { data, error } = await db
        .from('knowledge_articles')
        .insert({
          ...articleData,
          status: articleData.status ?? 'draft',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          version: 1
        })
        .select('*')
        .throwOnError()
        .single();

      if (error) {
        console.error('Error creating knowledge article:', error);
        throw new Error(error.message);
      }

      return data;
    } catch (error) {
      console.error('Error in createKnowledgeArticle:', error);
      throw error;
    }
  }

  static async updateKnowledgeArticle(id: string, updates: Partial<KnowledgeArticle>): Promise<any> {
    const { data, error } = await db
      .from('knowledge_articles')
      .update(updates)
      .eq('id', id)
      .select(`
        *,
        author:users!knowledge_articles_author_id_fkey(id, full_name, email),
        knowledge_category:knowledge_categories!knowledge_articles_knowledge_category_id_fkey(*)
      `)
      .single();
    
    if (error) throw error;
    return data;
  }

  // SLA operations
  static async getSLARules(): Promise<SLARule[]> {
    const { data, error } = await db
      .from('sla_rules')
      .select('*')
      .eq('is_active', true)
      .order('priority');
    
    if (error) throw error;
    return data || [];
  }

  static async getSLARuleByPriority(priority: string): Promise<SLARule> {
    const { data, error } = await db
      .from('sla_rules')
      .select('*')
      .eq('priority', priority)
      .eq('is_active', true)
      .single();
    
    if (error) throw error;
    return data;
  }

  // Notification operations
  static async getUserNotifications(userId: string, unreadOnly: boolean = false): Promise<Notification[]> {
    try {
      let query = db
        .from('notifications')
        .select('*')
        .eq('user_id', userId);

      if (unreadOnly) {
        query = query.eq('read', false);
      }

      query = query.order('created_at', { ascending: false });

      const { data, error } = await query;
      
      if (error) throw error;
      return data || [];
    } catch (error) {
      return [];
    }
  }

  static async createNotification(notificationData: Partial<NotificationRow>): Promise<Notification> {
    const { data, error } = await db
      .from('notifications')
      .insert(notificationData)
      .select('*')
      .single();
    
    if (error) throw error;
    return data;
  }

  static async markNotificationAsRead(id: string): Promise<Notification> {
    const { data, error } = await db
      .from('notifications')
      .update({ read: true })
      .eq('id', id)
      .select('*')
      .single();
    
    if (error) throw error;
    return data;
  }

  // NEW: Mark all notifications as read for a user
  static async markAllNotificationsAsRead(userId: string): Promise<boolean> {
    try {
      const { error } = await db
        .from('notifications')
        .update({
          read: true,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .eq('read', false);

      if (error) {
        console.error('Error marking all notifications as read:', error);
        return false;
      }
      return true;
    } catch (error) {
      console.error('Exception in markAllNotificationsAsRead:', error);
      return false;
    }
  }

  // NEW: Delete notification by ID
  static async deleteNotification(notificationId: string): Promise<boolean> {
    try {
      const { error } = await db
        .from('notifications')
        .delete()
        .eq('id', notificationId);

      if (error) {
        console.error('Error deleting notification:', error);
        return false;
      }
      return true;
    } catch (error) {
      console.error('Exception in deleteNotification:', error);
      return false;
    }
  }

  // Statistics operations
  static async getTicketStatistics(userId?: string, role?: string): Promise<any> {
    return {
      total: 0,
      open: 0,
      pending: 0,
      resolved: 0,
      closed: 0
    };
  }

  static async getSLAStatistics(): Promise<any> {
    const { data, error } = await db.rpc('get_sla_statistics');
    
    if (error) throw error;
    return data;
  }

  // Auto-assignment
  static async autoAssignTicket(ticketId: string): Promise<string> {
    const { data, error } = await db.rpc('auto_assign_ticket', {
      p_ticket_id: ticketId
    });
    
    if (error) throw error;
    return data;
  }

  // SLA Tracking and Communication Integration
  
  // Detect first agent response to a ticket from comments
  static async detectFirstAgentResponse(ticketId: string): Promise<Date | null> {
    try {
      // Method 1: Check if we have a logged first response in activity logs
      const { data: firstResponseLog, error: activityError } = await db
        .from('ticket_activity_logs')
        .select('new_value, created_at')
        .eq('ticket_id', ticketId)
        .eq('action_type', 'first_response')
        .order('created_at', { ascending: true })
        .limit(1);

      // If there's an error with the activity logs table or action type doesn't exist, continue to fallback
      if (!activityError && firstResponseLog && firstResponseLog.length > 0 && firstResponseLog[0].new_value) {
        return new Date(firstResponseLog[0].new_value);
      }

      // Method 1.5: Check for fallback records with is_first_response metadata
      const { data: fallbackLog, error: fallbackError } = await db
        .from('ticket_activity_logs')
        .select('new_value, created_at, metadata')
        .eq('ticket_id', ticketId)
        .eq('action_type', 'comment_added')
        .order('created_at', { ascending: true })
        .limit(10); // Check first 10 comment_added entries

      if (!fallbackError && fallbackLog && fallbackLog.length > 0) {
        for (const log of fallbackLog) {
          if (log.metadata && log.metadata.is_first_response && log.new_value) {
            return new Date(log.new_value);
          }
        }
      }

      // Method 2: Fallback to comment-based detection
      const { data: ticket } = await db
        .from('tickets_new')
        .select('user_id, assigned_to')
        .eq('id', ticketId)
        .single();

      if (!ticket) return null;

      // Find first comment from an agent (not the ticket creator)
      const { data: firstResponse } = await db
        .from('ticket_comments_new')
        .select(`
          created_at,
          user_id,
          users!ticket_comments_new_user_id_fkey(role)
        `)
        .eq('ticket_id', ticketId)
        .neq('user_id', ticket.user_id) // Not from ticket creator
        .in('users.role', ['agent', 'admin']) // From agents or admins
        .order('created_at', { ascending: true })
        .limit(1);

      return firstResponse && firstResponse.length > 0 ? new Date(firstResponse[0].created_at) : null;
    } catch (error) {
      console.error('Error detecting first agent response:', error);
      return null;
    }
  }

  // Detect first agent response before a specific timestamp (for proper first response detection)
  static async detectFirstAgentResponseBefore(ticketId: string, beforeTime: Date): Promise<Date | null> {
    try {
      // Get ticket details to know who created it
      const { data: ticket } = await db
        .from('tickets_new')
        .select('user_id')
        .eq('id', ticketId)
        .single();

      if (!ticket) return null;

      // Find first comment from an agent (not the ticket creator) BEFORE the specified time
      const { data: firstResponse } = await db
        .from('ticket_comments_new')
        .select(`
          created_at,
          user_id,
          users!ticket_comments_new_user_id_fkey(role)
        `)
        .eq('ticket_id', ticketId)
        .neq('user_id', ticket.user_id) // Not from ticket creator
        .in('users.role', ['agent', 'admin']) // From agents or admins
        .lt('created_at', beforeTime.toISOString()) // CRITICAL: Before this timestamp
        .order('created_at', { ascending: true })
        .limit(1)
        .single();

      return firstResponse ? new Date(firstResponse.created_at) : null;
    } catch (error) {
      // No previous response found or error occurred - this is expected for first responses
      return null;
    }
  }

  // Helper function to determine SLA status
  private static getSLAStatus(elapsed: number, target: number): 'ok' | 'warning' | 'overdue' {
    if (elapsed > target) return 'overdue';
    const percentage = (elapsed / target) * 100;
    if (percentage >= 75) return 'warning'; // Warning at 75% of target time
    return 'ok';
  }

  // Calculate comprehensive SLA status for a ticket
  static async calculateTicketSLAStatus(ticket: any): Promise<SLAStatus> {
    try {
      const slaRule = await this.getSLARuleByPriority(ticket.priority);
      const created = new Date(ticket.created_at);
      const now = new Date();
      
      // Check for first agent response
      const firstResponseAt = await this.detectFirstAgentResponse(ticket.id);
      
      const hoursElapsed = (now.getTime() - created.getTime()) / (1000 * 60 * 60);
      const responseTimeElapsed = firstResponseAt 
        ? (firstResponseAt.getTime() - created.getTime()) / (1000 * 60 * 60)
        : hoursElapsed;

      // Determine if SLA is still active
      const isActive = !['resolved', 'closed'].includes(ticket.status);

      let responseStatus: 'ok' | 'warning' | 'overdue' | 'met' | 'stopped';
      let resolutionStatus: 'ok' | 'warning' | 'overdue' | 'met' | 'stopped';

      if (!isActive) {
        responseStatus = firstResponseAt ? 'met' : 'overdue';
        resolutionStatus = ticket.status === 'resolved' || ticket.status === 'closed' ? 'met' : 'overdue';
      } else {
        responseStatus = firstResponseAt 
          ? 'met' 
          : this.getSLAStatus(responseTimeElapsed, slaRule.response_time as number);
        resolutionStatus = this.getSLAStatus(hoursElapsed, slaRule.resolution_time as number);
      }

      return {
        ticketId: ticket.id,
        responseStatus,
        resolutionStatus,
        responseTimeElapsed,
        totalTimeElapsed: hoursElapsed,
        firstResponseAt,
        slaRule,
        isActive
      };
    } catch (error) {
      console.error('Error calculating SLA status:', error);
      // Return default values on error
      const defaultRule = { response_time: 24, resolution_time: 72 } as SLARule;
      return {
        ticketId: ticket.id,
        responseStatus: 'ok',
        resolutionStatus: 'ok',
        responseTimeElapsed: 0,
        totalTimeElapsed: 0,
        firstResponseAt: null,
        slaRule: defaultRule,
        isActive: true
      };
    }
  }

  // Check for SLA warnings across all active tickets
  static async checkSLAWarnings(): Promise<{ warnings: number; breaches: number }> {
    try {
      console.log('🔍 Checking SLA warnings for all active tickets...');
      
      // Get all active tickets with SLA rules
      const { data: tickets, error } = await db
        .from('tickets_new')
        .select(`
          id,
          ticket_number,
          title,
          priority,
          status,
          created_at,
          assigned_to,
          user_id,
          users!tickets_new_user_id_fkey(id, full_name, email),
          assignee:users!tickets_new_assigned_to_fkey(id, full_name, email)
        `)
        .in('status', ['open', 'in_progress']);

      if (error) throw error;

      let warnings = 0;
      let breaches = 0;

      for (const ticket of tickets || []) {
        const slaStatus = await this.calculateTicketSLAStatus(ticket);
        
        if (slaStatus.responseStatus === 'overdue' || slaStatus.resolutionStatus === 'overdue') {
          breaches++;
          console.log(`🚨 SLA Breach detected for ticket ${ticket.ticket_number || ticket.id}`);
          // Create SLA breach notification
          await this.createSLABreachNotification(ticket, slaStatus);
        } else if (slaStatus.responseStatus === 'warning' || slaStatus.resolutionStatus === 'warning') {
          warnings++;
          console.log(`⚠️ SLA Warning for ticket ${ticket.ticket_number || ticket.id}`);
          // Create SLA warning notification
          await this.createSLAWarningNotification(ticket, slaStatus);
        }
      }

      console.log(`✅ SLA check completed: ${warnings} warnings, ${breaches} breaches`);
      return { warnings, breaches };
    } catch (error) {
      console.error('Error checking SLA warnings:', error);
      return { warnings: 0, breaches: 0 };
    }
  }

  // Create SLA warning notification
  static async createSLAWarningNotification(ticket: any, slaStatus: SLAStatus): Promise<void> {
    try {
      const notifications = [];
      
      // Notify assigned agent
      if (ticket.assigned_to) {
        notifications.push({
          user_id: ticket.assigned_to,
          type: 'sla_warning',
          title: '⚠️ SLA Warning',
          message: `Ticket ${ticket.ticket_number || '#' + ticket.id.slice(-8)} is approaching SLA deadline. ${slaStatus.responseStatus === 'warning' ? 'Response time' : 'Resolution time'} warning.`,
          ticket_id: ticket.id,
          priority: 'high',
          read: false,
          created_at: new Date().toISOString()
        });
      }
      
      // Notify ticket creator if resolution SLA is at risk and no agent assigned
      if (slaStatus.resolutionStatus === 'warning' && !ticket.assigned_to) {
        notifications.push({
          user_id: ticket.user_id,
          type: 'sla_warning',
          title: '⏰ Update on Your Ticket',
          message: `Your ticket ${ticket.ticket_number || '#' + ticket.id.slice(-8)} is being prioritized to meet our service commitment.`,
          ticket_id: ticket.id,
          priority: 'medium',
          read: false,
          created_at: new Date().toISOString()
        });
      }

      if (notifications.length > 0) {
        const { error } = await db.from('notifications').insert(notifications);
        if (error) {
          console.error('Error creating SLA warning notifications:', error);
        }
      }
    } catch (error) {
      console.error('Error in createSLAWarningNotification:', error);
    }
  }

  // Create SLA breach notification
  static async createSLABreachNotification(ticket: any, slaStatus: SLAStatus): Promise<void> {
    try {
      const notifications = [];
      
      // Notify assigned agent with high priority
      if (ticket.assigned_to) {
        notifications.push({
          user_id: ticket.assigned_to,
          type: 'sla_breach',
          title: '🚨 SLA Breach Alert',
          message: `URGENT: Ticket ${ticket.ticket_number || '#' + ticket.id.slice(-8)} has exceeded SLA deadline. Immediate action required.`,
          ticket_id: ticket.id,
          priority: 'urgent',
          read: false,
          created_at: new Date().toISOString()
        });
      }
      
      // Notify all admins about SLA breach
      const { data: admins } = await db
        .from('users')
        .select('id')
        .eq('role', 'admin');

      if (admins) {
        for (const admin of admins) {
          notifications.push({
            user_id: admin.id,
            type: 'sla_breach',
            title: '🚨 SLA Breach - Admin Alert',
            message: `SLA breach detected for ticket ${ticket.ticket_number || '#' + ticket.id.slice(-8)}. Agent: ${ticket.assignee?.full_name || 'Unassigned'}`,
            ticket_id: ticket.id,
            priority: 'urgent',
            read: false,
            created_at: new Date().toISOString()
          });
        }
      }

      if (notifications.length > 0) {
        const { error } = await db.from('notifications').insert(notifications);
        if (error) {
          console.error('Error creating SLA breach notifications:', error);
        }
      }
    } catch (error) {
      console.error('Error in createSLABreachNotification:', error);
    }
  }

  // Auto-close inactive resolved tickets
  static async autoCloseInactiveTickets(): Promise<number> {
    try {
      console.log('🔄 Checking for inactive resolved tickets to auto-close...');
      
      // Find resolved tickets older than 7 days with no recent activity
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data: candidateTickets, error } = await db
        .from('tickets_new')
        .select('id, ticket_number, resolved_at, updated_at, user_id')
        .eq('status', 'resolved')
        .lt('resolved_at', sevenDaysAgo.toISOString());

      if (error) throw error;

      let closedCount = 0;
      
      for (const ticket of candidateTickets || []) {
        // Check if there's been any recent activity (comments/chat)
        const hasRecentActivity = await this.hasRecentTicketActivity(ticket.id, sevenDaysAgo);
        
        if (!hasRecentActivity) {
          try {
            await this.closeTicket(ticket.id, 'system-auto-close');
            console.log(`✅ Auto-closed ticket ${ticket.ticket_number || ticket.id}`);
            closedCount++;
          } catch (closeError) {
            console.error(`❌ Failed to auto-close ticket ${ticket.id}:`, closeError);
          }
        }
      }

      console.log(`✅ Auto-close completed: ${closedCount} tickets closed`);
      return closedCount;
    } catch (error) {
      console.error('Error auto-closing tickets:', error);
      return 0;
    }
  }

  // Check if ticket has recent activity
  static async hasRecentTicketActivity(ticketId: string, since: Date): Promise<boolean> {
    try {
      // Check for recent comments
      const { data: recentComments } = await db
        .from('ticket_comments_new')
        .select('id')
        .eq('ticket_id', ticketId)
        .gte('created_at', since.toISOString())
        .limit(1);

      return (recentComments && recentComments.length > 0);
    } catch (error) {
      console.error('Error checking recent ticket activity:', error);
      return false;
    }
  }

  // Log first response for SLA tracking
  static async logFirstResponse(ticketId: string, agentId: string, responseTime: Date): Promise<void> {
    try {
      // Check if first response is already logged
      const { data: existingLog, error: checkError } = await db
        .from('ticket_activity_logs')
        .select('id')
        .eq('ticket_id', ticketId)
        .eq('action_type', 'first_response')
        .limit(1);

      // If check fails (action type might not exist), try using the RPC function
      if (checkError || (existingLog && existingLog.length > 0)) {
        if (!checkError && existingLog && existingLog.length > 0) {
          console.log('First response already logged for ticket:', ticketId);
          return;
        }
      }

      // Try using the security definer function first
      const { error: rpcError } = await db.rpc('log_ticket_activity', {
        p_ticket_id: ticketId,
        p_user_id: agentId,
        p_action_type: 'first_response',
        p_field_name: 'sla_first_response',
        p_old_value: null,
        p_new_value: responseTime.toISOString(),
        p_description: 'First agent response for SLA tracking',
        p_metadata: {
          first_response_at: responseTime.toISOString(),
          logged_by_system: true,
          sla_tracking: true
        }
      });

      if (rpcError) {
        console.warn('RPC logging failed, trying direct insert with fallback action type:', rpcError);
        
        // Fallback: use direct insert with existing action type
        const { error: directError } = await db
          .from('ticket_activity_logs')
          .insert({
            ticket_id: ticketId,
            user_id: agentId,
            action_type: 'comment_added', // Use existing action type as fallback
            field_name: 'sla_first_response',
            old_value: null,
            new_value: responseTime.toISOString(),
            description: 'First agent response for SLA tracking',
            metadata: {
              first_response_at: responseTime.toISOString(),
              logged_by_system: true,
              sla_tracking: true,
              is_first_response: true // Mark for identification
            }
          });

        if (directError) {
          console.error('Fallback logging also failed:', directError);
          // Don't throw here - make SLA logging non-blocking
        }
      }

      console.log(`📋 First response logged for ticket ${ticketId} by agent ${agentId} at ${responseTime.toISOString()}`);
    } catch (error) {
      console.error('Error logging first response (non-blocking):', error);
      // Don't throw - make SLA logging non-blocking
    }
  }

  // Ticket Resolution and Closure
  static async resolveTicket(ticketId: string, resolutionNotes: string, resolvedBy: string): Promise<TicketWithDetails> {
    try {
      // Verificar se o ticket existe primeiro
      const { data: existingTicket, error: checkError } = await db
        .from('tickets_new')
        .select('id, user_id, status, ticket_number')
        .eq('id', ticketId)
        .single();

      if (checkError || !existingTicket) {
        throw new Error(`Ticket não encontrado: ${ticketId}`);
      }

      // Keep resolved status and trigger feedback request manually
      const updateData = {
        status: 'resolved' as const,
        resolution: resolutionNotes,
        resolved_at: new Date().toISOString(),
        resolved_by: resolvedBy,
        updated_at: new Date().toISOString()
      };

      // Update the ticket
      const { error: updateError } = await db
        .from('tickets_new')
        .update(updateData)
        .eq('id', ticketId);

      if (updateError) {
        throw updateError;
      }

      // Log activity
      try {
        const { error: logError } = await db.rpc('log_ticket_activity', {
          p_ticket_id: ticketId,
          p_user_id: resolvedBy,
          p_action_type: 'status_changed',
          p_field_name: 'status',
          p_old_value: existingTicket.status,
          p_new_value: 'resolved',
          p_description: `Ticket resolvido por ${resolvedBy}`,
          p_metadata: null
        });

        if (logError) {
          console.warn('⚠️ Activity log creation failed (non-blocking):', logError);
        }
      } catch (logError) {
        console.warn('⚠️ Activity log creation failed (non-blocking):', logError);
      }

      // Get the complete ticket data with all relationships
      const { data: updatedTicket, error: getError } = await db
        .from('tickets_new')
        .select(`
          *,
          user:users!tickets_new_user_id_fkey(id, full_name, email),
          assignee:users!tickets_new_assigned_to_fkey(id, full_name, email),
          category:categories(id, name, description),
          comments:ticket_comments_new(
            id, content, created_at, is_internal,
            user:users(id, full_name, email)
          ),
          attachments:ticket_attachments(
            id, file_name, file_path, file_size, mime_type, uploaded_by, uploaded_at
          )
        `)
        .eq('id', ticketId)
        .single();

      if (getError) {
        throw getError;
      }

      // Create status change notification for the ticket creator
      await NotificationService.createTicketStatusNotification(
        ticketId,
        existingTicket.user_id,
        {
          ticketNumber: existingTicket.ticket_number,
          oldStatus: existingTicket.status,
          newStatus: 'resolved'
        }
      );

      // Create feedback request notification
      await NotificationService.createFeedbackRequestNotification(
        ticketId,
        existingTicket.user_id,
        {
          ticketNumber: existingTicket.ticket_number
        }
      );

      return updatedTicket;
    } catch (error) {
      console.error('Error in resolveTicket:', error);
      throw error;
    }
  }

  static async closeTicket(ticketId: string, closedBy: string): Promise<TicketWithDetails> {
    try {
      // 1. Verificar se o ticket pode ser fechado
      const { data: ticket, error: fetchError } = await supabase
        .from('tickets_new')
        .select('*')
        .eq('id', ticketId)
        .single();

      if (fetchError || !ticket) {
        throw new Error('Ticket não encontrado');
      }

      // 2. Validar condições obrigatórias para fechamento
      if (ticket.status !== 'resolved') {
        throw new Error('Apenas tickets com status "resolved" podem ser fechados');
      }

      if (!ticket.resolution || ticket.resolution.trim() === '') {
        throw new Error('Campo resolution_notes deve estar preenchido para fechar o ticket');
      }

      if (!ticket.resolved_at) {
        throw new Error('Data de resolução deve estar definida para fechar o ticket');
      }

      // 3. Verificar se o usuário tem permissão para fechar
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('role')
        .eq('id', closedBy)
        .single();

      if (userError || !user) {
        throw new Error('Usuário não encontrado');
      }

      const canClose = user.role === 'admin' || 
                      (user.role === 'agent' && ticket.assigned_to === closedBy);

      if (!canClose) {
        throw new Error('Apenas o agente atribuído ou administradores podem fechar tickets');
      }

      // 4. Fechar o ticket
      const updateData: { status: TicketStatus; closed_at: string; closed_by: string; updated_at: string } = {
        status: 'closed' as TicketStatus,
        closed_at: new Date().toISOString(),
        closed_by: closedBy,
        updated_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('tickets_new')
        .update(updateData)
        .eq('id', ticketId)
        .select('*, user:user_id(*), assignee:assigned_to(*)')
        .single();

      if (error) {
        console.error('Error closing ticket:', error);
        throw error;
      }

      // 5. Criar notificação para o usuário
      try {
        await this.createTicketNotification(ticketId, 'closed', ticket.user_id);
      } catch (notificationError) {
        console.warn('⚠️ Notification creation failed (non-blocking):', notificationError);
      }

      // 6. Criar log de auditoria
      try {
        const { error: logError } = await supabase.rpc('log_ticket_activity', {
          p_ticket_id: ticketId,
          p_user_id: closedBy,
          p_action_type: 'closed',
          p_field_name: 'status',
          p_old_value: 'resolved',
          p_new_value: 'closed',
          p_description: `Ticket fechado por usuário`,
          p_metadata: {
            closed_by: closedBy,
            closed_at: updateData.closed_at,
            auto_closed: false
          }
        });

        if (logError) {
          console.warn('⚠️ Activity log creation failed (non-blocking):', logError);
        }
      } catch (logError) {
        console.warn('⚠️ Activity log creation failed (non-blocking):', logError);
      }

      // Fetch the complete data with user details
      const completeTicket = await this.getTicketById(ticketId);
      return completeTicket;
    } catch (error) {
      console.error('💥 Failed to close ticket:', error);
      throw error;
    }
  }

  // Verificar se um ticket pode ser editado
  static async canEditTicket(ticketId: string, userId: string, fieldName?: string): Promise<boolean> {
    try {
      const { data: ticket, error } = await db
        .from('tickets_new')
        .select('status, user_id, assigned_to')
        .eq('id', ticketId)
        .single();

      if (error || !ticket) {
        return false;
      }

      // Tickets fechados não podem ser editados
      if (ticket.status === 'closed') {
        return false;
      }

      // Verificar se o usuário tem permissão
      const { data: user, error: userError } = await db
        .from('users')
        .select('role')
        .eq('id', userId)
        .single();

      if (userError || !user) {
        return false;
      }

      // Define field categories for permission checking
      const userInputFields = [
        'title', 'description', 'priority', 'category_id', 'subcategory_id',
        'first_name', 'last_name', 'username', 'display_name', 'job_title',
        'manager', 'company_name', 'department', 'office_location',
        'business_phone', 'mobile_phone', 'start_date', 'signature_group',
        'usage_location', 'country_distribution_list', 'license_type',
        'mfa_setup', 'attached_form'
      ];

      const agentFields = ['assigned_to', 'status'];
      const systemFields = ['user_id', 'resolved_by', 'closed_by', 'resolved_at', 'closed_at'];

      // Field-specific permission checking
      if (fieldName) {
        // Users can only edit their own tickets' user input fields when status is 'open'
        if (user.role === 'user') {
          return ticket.status === 'open' && 
                 ticket.user_id === userId && 
                 userInputFields.includes(fieldName);
        }

        // Agents can edit assignment fields and status, but not user input after ticket is open
        if (user.role === 'agent') {
          // Agents cannot edit user input fields after ticket is no longer 'open'
          if (userInputFields.includes(fieldName) && ticket.status !== 'open') {
            return false;
          }
          // Agents can edit assignment-related fields if ticket is assigned to them
          if (agentFields.includes(fieldName)) {
            return ticket.assigned_to === userId;
          }
          // Agents can edit user input fields only when ticket is 'open' and assigned to them
          if (userInputFields.includes(fieldName) && ticket.status === 'open') {
            return ticket.assigned_to === userId;
          }
          return false;
        }

        // Admins have broader access but still respect user input restrictions
        if (user.role === 'admin') {
          // Even admins cannot edit user input fields after ticket is no longer 'open'
          if (userInputFields.includes(fieldName) && ticket.status !== 'open') {
            return false;
          }
          // Admins cannot edit system fields through regular edit
          if (systemFields.includes(fieldName)) {
            return false;
          }
          return true;
        }
      }

      // General edit permissions (backward compatibility when no fieldName provided)
      if (user.role === 'admin') {
        return true;
      }

      // Agentes podem editar tickets atribuídos a eles
      if (user.role === 'agent' && ticket.assigned_to === userId) {
        return true;
      }

      // Usuários podem editar apenas seus próprios tickets quando estão 'open'
      if (user.role === 'user' && ticket.user_id === userId && ticket.status === 'open') {
        return true;
      }

      return false;
    } catch (error) {
      console.error('Error checking edit permissions:', error);
      return false;
    }
  }

  // Verificar se comentários podem ser adicionados
  static async canAddComment(ticketId: string, userId: string): Promise<boolean> {
    try {
      const { data: ticket, error } = await db
        .from('tickets_new')
        .select('status, user_id, assigned_to')
        .eq('id', ticketId)
        .single();

      if (error || !ticket) {
        return false;
      }

      // Tickets fechados não permitem novos comentários
      if (ticket.status === 'closed') {
        return false;
      }

      // Verificar se o usuário tem acesso ao ticket
      const { data: user, error: userError } = await db
        .from('users')
        .select('role')
        .eq('id', userId)
        .single();

      if (userError || !user) {
        return false;
      }

      // Admins e agentes podem comentar em qualquer ticket não fechado
      if (user.role === 'admin' || user.role === 'agent') {
        return true;
      }

      // Usuários podem comentar apenas em seus próprios tickets
      if (user.role === 'user' && ticket.user_id === userId) {
        return true;
      }

      return false;
    } catch (error) {
      console.error('Error checking comment permissions:', error);
      return false;
    }
  }

  // Reopen ticket
  static async reopenTicket(ticketId: string, reopenReason: string, reopenedBy: string): Promise<TicketWithDetails> {
    try {
      const updateData = {
        status: 'open' as const,
        reopen_reason: reopenReason,
        reopened_at: new Date().toISOString(),
        reopened_by: reopenedBy,
        updated_at: new Date().toISOString(),
        // Clear resolution/closure data
        resolved_at: null,
        resolved_by: null,
        resolution: null,
        closed_at: null,
        closed_by: null
      };

      const { data, error } = await db
        .from('tickets_new')
        .update(updateData)
        .eq('id', ticketId)
        .select('*')
        .single();

      if (error) {
        throw error;
      }
      
      // Fetch the complete data with user details
      const completeTicket = await this.getTicketById(ticketId);
      return completeTicket;
    } catch (error) {
      throw error;
    }
  }

  // Create notification manually
  static async createTicketNotification(ticketId: string, type: string, targetUserId?: string) {
    try {
      // Get ticket details for context
      const { data: ticket, error: ticketError } = await db
        .from('tickets_new')
        .select(`
          *,
          user:users!tickets_new_user_id_fkey(id, full_name, email),
          assignee:users!tickets_new_assigned_to_fkey(id, full_name, email)
        `)
        .eq('id', ticketId)
        .single();

      if (ticketError) {
        console.error('Error fetching ticket for notification:', ticketError);
        throw ticketError;
      }

      // Determine notification recipients and content
      let recipients: string[] = [];
      let title = '';
      let message = '';

      const context = {
        ticketNumber: ticket.ticket_number,
        ticketTitle: ticket.title,
        creatorName: ticket.user?.full_name || 'Unknown User',
        assigneeName: ticket.assignee?.full_name || 'Unassigned',
        status: ticket.status,
        priority: ticket.priority
      };

      switch (type) {
        case 'ticket_created':
          // Notify all agents when a new ticket is created
          const { data: agents, error: agentsError } = await db
            .from('users')
            .select('id')
            .eq('role', 'agent');

          if (!agentsError && agents) {
            recipients = agents.map(agent => agent.id);
          }

          title = JSON.stringify({
            key: 'notifications.types.ticket_created.title',
            params: { ticketNumber: context.ticketNumber || '#' + ticketId.slice(-8) }
          });
          message = JSON.stringify({
            key: 'notifications.types.ticket_created.message',
            params: { 
              ticketTitle: context.ticketTitle || 'notifications.fallback.noTitle',
              creatorName: context.creatorName || 'Unknown User'
            }
          });
          break;

        case 'status_changed':
          // Notify ticket creator and assignee about status changes
          recipients = [ticket.user_id];
          if (ticket.assigned_to && ticket.assigned_to !== ticket.user_id) {
            recipients.push(ticket.assigned_to);
          }

          title = JSON.stringify({
            key: 'notifications.types.status_changed.title',
            params: { ticketNumber: context.ticketNumber || '#' + ticketId.slice(-8) }
          });
          message = JSON.stringify({
            key: 'notifications.types.status_changed.message',
            params: { 
              ticketTitle: context.ticketTitle || 'notifications.fallback.noTitle',
              status: context.status || 'unknown'
            }
          });
          break;

        case 'ticket_assigned':
        case 'assignment_changed':
          // Handle different assignment scenarios
          if (ticket.assigned_to && ticket.assigned_to !== ticket.user_id) {
            // Ticket assigned to an agent - notify both creator and assigned agent
            recipients = [ticket.user_id, ticket.assigned_to];
            title = JSON.stringify({
              key: 'notifications.types.assignment_changed.assigned.title',
              params: { ticketNumber: context.ticketNumber || '#' + ticketId.slice(-8) }
            });
            message = JSON.stringify({
              key: 'notifications.types.assignment_changed.assigned.message',
              params: { 
                ticketTitle: context.ticketTitle || 'notifications.fallback.noTitle',
                assigneeName: context.assigneeName || 'notifications.fallback.defaultAgent'
              }
            });
          } else if (ticket.assigned_to && ticket.assigned_to === ticket.user_id) {
            // Self-assigned ticket
            recipients = [ticket.user_id];
            title = JSON.stringify({
              key: 'notifications.types.assignment_changed.selfAssigned.title',
              params: { ticketNumber: context.ticketNumber || '#' + ticketId.slice(-8) }
            });
            message = JSON.stringify({
              key: 'notifications.types.assignment_changed.selfAssigned.message',
              params: { ticketTitle: context.ticketTitle || 'notifications.fallback.noTitle' }
            });
          } else if (!ticket.assigned_to) {
            // Assignment removed
            recipients = [ticket.user_id];
            if (targetUserId) {
              recipients.push(targetUserId); // Notify the agent who lost the assignment
            }
            title = JSON.stringify({
              key: 'notifications.types.assignment_changed.removed.title',
              params: { ticketNumber: context.ticketNumber || '#' + ticketId.slice(-8) }
            });
            message = JSON.stringify({
              key: 'notifications.types.assignment_changed.removed.message',
              params: { ticketTitle: context.ticketTitle || 'notifications.fallback.noTitle' }
            });
          } else {
            // Fallback case - ensure we always have content
            recipients = [ticket.user_id];
            title = JSON.stringify({
              key: 'notifications.types.assignment_changed.fallback.title',
              params: { ticketNumber: context.ticketNumber || '#' + ticketId.slice(-8) }
            });
            message = JSON.stringify({
              key: 'notifications.types.assignment_changed.fallback.message',
              params: { ticketTitle: context.ticketTitle || 'notifications.fallback.noTitle' }
            });
          }
          break;

        case 'priority_changed':
          // Notify ticket creator and assignee about priority changes
          recipients = [ticket.user_id];
          if (ticket.assigned_to && ticket.assigned_to !== ticket.user_id) {
            recipients.push(ticket.assigned_to);
          }

          title = JSON.stringify({
            key: 'notifications.types.priority_changed.title',
            params: { ticketNumber: context.ticketNumber || '#' + ticketId.slice(-8) }
          });
          message = JSON.stringify({
            key: 'notifications.types.priority_changed.message',
            params: { 
              ticketTitle: context.ticketTitle || 'notifications.fallback.noTitle',
              priority: context.priority || 'unknown'
            }
          });
          break;

        case 'resolved':
          // Notify ticket creator when ticket is resolved
          recipients = [ticket.user_id];
          title = `Ticket Resolvido: ${context.ticketNumber}`;
          message = `Seu ticket "${context.ticketTitle}" foi resolvido. Por favor, avalie o atendimento.`;
          break;

        case 'closed':
          // Notify ticket creator when ticket is closed
          recipients = [ticket.user_id];
          title = `Ticket Fechado: ${context.ticketNumber}`;
          message = `Seu ticket "${context.ticketTitle}" foi fechado.`;
          break;

        case 'comment_added':
          // Notify relevant parties when a comment is added
          recipients = [ticket.user_id];
          if (ticket.assigned_to && ticket.assigned_to !== ticket.user_id) {
            recipients.push(ticket.assigned_to);
          }
          title = JSON.stringify({
            key: 'notifications.types.comment_added.title',
            params: { ticketNumber: context.ticketNumber || '#' + ticketId.slice(-8) }
          });
          message = JSON.stringify({
            key: 'notifications.types.comment_added.message',
            params: { ticketTitle: context.ticketTitle || 'notifications.fallback.noTitle' }
          });
          break;

        default:
          console.warn(`Unknown notification type: ${type}`);
          return;
      }

      // Override recipients if targetUserId is specified
      if (targetUserId) {
        recipients = [targetUserId];
      }

      // Create notifications for each recipient
      const notifications = recipients.map(userId => ({
        user_id: userId,
        type,
        title,
        message,
        ticket_id: ticketId,
        read: false,
        priority: ticket.priority === 'urgent' ? 'high' : 'medium'
      }));

      if (notifications.length > 0) {
        const { error: insertError } = await db
          .from('notifications')
          .insert(notifications);

        if (insertError) {
          console.error('Error creating notifications:', insertError);
          throw insertError;
        }

        console.log(`✅ Created ${notifications.length} notifications for ${type}`);
      }

    } catch (error) {
      console.error('Error in createTicketNotification:', error);
      throw error;
    }
  }

  // Reopen Request operations
  static async createReopenRequest(ticketId: string, requestedBy: string, reason: string): Promise<any> {
    const { data, error } = await db
      .from('reopen_requests')
      .insert({
        ticket_id: ticketId,
        user_id: requestedBy,
        reason: reason
      })
      .select('*')
      .single();
    
    if (error) throw error;

    // Fetch related data manually
    const { data: ticket } = await db
      .from('tickets_new')
      .select('id, title, status')
      .eq('id', ticketId)
      .single();

    const { data: requestedByUser } = await db
      .from('users')
      .select('id, name, email')
      .eq('id', requestedBy)
      .single();

    return {
      ...data,
      ticket,
      requested_by_user: requestedByUser
    };
  }

  static async getReopenRequests(options: {
    ticketId?: string;
    status?: string;
    requestedBy?: string;
  } = {}): Promise<any[]> {
    let query = db
      .from('reopen_requests')
      .select('*');

    if (options.ticketId) {
      query = query.eq('ticket_id', options.ticketId);
    }

    if (options.status) {
      query = query.eq('status', options.status);
    }

    if (options.requestedBy) {
      query = query.eq('user_id', options.requestedBy);
    }

    query = query.order('created_at', { ascending: false });

    const { data, error } = await query;
    
    if (error) throw error;

    // Manually fetch related data to avoid foreign key issues
    if (data && data.length > 0) {
      const enrichedData = await Promise.all(data.map(async (request) => {
        // Fetch ticket info
        const { data: ticket } = await db
          .from('tickets_new')
          .select('id, title, status')
          .eq('id', request.ticket_id)
          .single();

        // Fetch requested by user
        const { data: requestedByUser } = await db
          .from('users')
          .select('id, full_name, email')
          .eq('id', request.user_id)
          .single();

        // Fetch reviewed by user if exists
        let reviewedByUser = null;
        if (request.reviewed_by) {
          const { data: reviewedBy } = await db
            .from('users')
            .select('id, name, email')
            .eq('id', request.reviewed_by)
            .single();
          reviewedByUser = reviewedBy;
        }

        return {
          ...request,
          ticket,
          requested_by_user: requestedByUser,
          reviewed_by_user: reviewedByUser
        };
      }));

      return enrichedData;
    }
    
    return data || [];
  }

  static async reviewReopenRequest(
    requestId: string, 
    status: 'approved' | 'rejected', 
    reviewedBy: string
  ): Promise<any> {
    const { data, error } = await db
      .from('reopen_requests')
      .update({
        status: status,
        reviewed_by: reviewedBy,
        reviewed_at: new Date().toISOString()
      })
      .eq('id', requestId)
      .select('*')
      .single();
    
    if (error) throw error;
    return data;
  }

  // Get user profiles
  static async getUserProfiles() {
    const { data, error } = await db
      .from('users')
      .select('*')
      .order('full_name');
    
    if (error) throw error;
    return data || [];
  }

  // Get user profile by ID
  static async getUserProfile(userId: string) {
    const { data, error } = await db
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (error) throw error;
    return data;
  }

  // Update user profile
  static async updateUserProfile(userId: string, updates: Partial<UserProfile>) {
    const { data, error } = await db
      .from('users')
      .update(updates)
      .eq('id', userId)
      .select('*')
      .single();
    
    if (error) {
      throw error;
    }
    
    return data;
  }

  // Get dashboard statistics
  static async getDashboardStats(userId?: string, userRole?: string) {
    try {
      const stats = {
        totalTickets: 0,
        openTickets: 0,
        resolvedTickets: 0,
        closedTickets: 0,
        myTickets: 0,
        assignedToMe: 0,
        overdueTickets: 0
      };

      // Get total tickets count
      const { count: totalCount } = await db
        .from('tickets_new')
        .select('*', { count: 'exact', head: true });
      stats.totalTickets = totalCount || 0;

      // Get tickets by status
      const { data: statusCounts } = await db
        .from('tickets_new')
        .select('status')
        .not('status', 'is', null);

      if (statusCounts) {
        stats.openTickets = statusCounts.filter(t => t.status === 'open').length;
        stats.resolvedTickets = statusCounts.filter(t => t.status === 'resolved').length;
        stats.closedTickets = statusCounts.filter(t => t.status === 'closed').length;
      }

      // Get user-specific stats if userId provided
      if (userId) {
        // My tickets (created by user)
        const { count: myCount } = await db
          .from('tickets_new')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId);
        stats.myTickets = myCount || 0;

        // Assigned to me (for agents/admins)
        if (userRole === 'agent' || userRole === 'admin') {
          const { count: assignedCount } = await db
            .from('tickets_new')
            .select('*', { count: 'exact', head: true })
            .eq('assigned_to', userId);
          stats.assignedToMe = assignedCount || 0;
        }
      }

      return stats;
    } catch (error) {
      // Return empty stats on error
      return {
        totalTickets: 0,
        openTickets: 0,
        resolvedTickets: 0,
        closedTickets: 0,
        myTickets: 0,
        assignedToMe: 0,
        overdueTickets: 0
      };
    }
  }

  // Create comment notification
  static async createCommentNotification(ticketId: string, commentUserId: string) {
    try {
      console.log('💬 Creating comment notification for ticket:', ticketId, 'by user:', commentUserId);
      
      // Get ticket and involved users
      const { data: ticket, error: ticketError } = await db
        .from('tickets_new')
        .select('*')
        .eq('id', ticketId)
        .single();

      if (ticketError || !ticket) {
        console.warn('💬 Ticket not found for notification:', ticketId, ticketError);
        return;
      }

      console.log('💬 Ticket found:', {
        id: ticket.id,
        number: ticket.ticket_number,
        title: ticket.title,
        creator: ticket.user_id,
        assigned: ticket.assigned_to,
        status: ticket.status
      });

      const notifications = [];
      const notifiedUsers = new Set();

      // Notify ticket creator (if not the commenter and ticket is not closed)
      if (ticket.user_id !== commentUserId && ticket.status !== 'closed') {
                  const notification = {
            user_id: ticket.user_id,
            type: 'comment_added',
            title: '💬 Nova Resposta Recebida',
            message: `Você recebeu uma nova resposta no chamado ${ticket.ticket_number || '#' + ticket.id.slice(-8)}. Clique para ver a resposta e continuar a conversa.`,
            ticket_id: ticketId,
            read: false,
            priority: 'medium',
            created_at: new Date().toISOString()
          };
        
        notifications.push(notification);
        notifiedUsers.add(ticket.user_id);
        console.log('💬 Will notify ticket creator:', ticket.user_id);
      }

      // Notify assigned user (if not the commenter and not already notified and ticket is not closed)
      if (ticket.assigned_to && 
          ticket.assigned_to !== commentUserId && 
          !notifiedUsers.has(ticket.assigned_to) &&
          ticket.status !== 'closed') {
        
        const notification = {
          user_id: ticket.assigned_to,
          type: 'comment_added',
          title: 'Novo Comentário no Chamado',
          message: `Novo comentário no chamado ${ticket.ticket_number || '#' + ticket.id.slice(-8)} que você está atendendo.`,
          ticket_id: ticketId,
          read: false,
          priority: 'medium',
          created_at: new Date().toISOString()
        };
        
        notifications.push(notification);
        notifiedUsers.add(ticket.assigned_to);
        console.log('💬 Will notify assigned agent:', ticket.assigned_to);
      }

      // Insert notifications with better error handling
      if (notifications.length > 0) {
        console.log('💬 Inserting', notifications.length, 'notifications:', notifications);
        
        for (const notification of notifications) {
          try {
            const { data, error } = await db
              .from('notifications')
              .insert(notification)
              .select('*')
              .single();
            
            if (error) {
              console.error('💬 Error inserting individual notification:', error, notification);
            } else {
              console.log('💬 Successfully created notification:', data.id, 'for user:', notification.user_id);
            }
          } catch (individualError) {
            console.error('💬 Exception inserting individual notification:', individualError, notification);
          }
        }
      } else {
        console.log('💬 No notifications to create (commenter is the only involved user or ticket is closed)');
      }
    } catch (error) {
      console.error('⚠️ Comment notification error (non-blocking):', error);
    }
  }

  // Feedback operations
  static async submitTicketFeedback(feedbackData: {
    ticketId: string;
    userId: string;
    rating: number;
    satisfaction: "satisfied" | "neutral" | "unsatisfied";
    comment?: string;
    categories?: string[];
    agentName?: string;
  }): Promise<TicketFeedback> {
    try {
      const { data, error } = await db
        .from('ticket_feedback')
        .insert({
          ticket_id: feedbackData.ticketId,
          user_id: feedbackData.userId,
          rating: feedbackData.rating,
          satisfaction: feedbackData.satisfaction,
          comment: feedbackData.comment || null,
          categories: feedbackData.categories || null,
          agent_name: feedbackData.agentName || null
        })
        .select('*')
        .single();

      if (error) throw error;

      // Update ticket to mark feedback as received
      await db
        .from('tickets_new')
        .update({ feedback_received: true })
        .eq('id', feedbackData.ticketId);

      return data;
    } catch (error) {
      throw error;
    }
  }

  static async getTicketFeedback(ticketId: string): Promise<TicketFeedback | null> {
    try {
      const { data, error } = await db
        .from('ticket_feedback')
        .select('*')
        .eq('ticket_id', ticketId)
        .single();

      if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows found
      return data || null;
    } catch (error) {
      throw error;
    }
  }

  static async updateTicketFeedback(
    feedbackId: string, 
    updates: Partial<TicketFeedback>
  ): Promise<TicketFeedback> {
    try {
      const { data, error } = await db
        .from('ticket_feedback')
        .update(updates)
        .eq('id', feedbackId)
        .select('*')
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      throw error;
    }
  }

  static async getFeedbackStatistics(agentId?: string): Promise<any> {
    try {
      const { data, error } = await db
        .rpc('get_feedback_statistics', { 
          agent_uuid: agentId || null 
        });

      if (error) throw error;
      return data || {};
    } catch (error) {
      return {};
    }
  }

  // Create test feedback notification (for debugging)
  static async createTestFeedbackNotification(ticketId: string, userId: string) {
    try {
      const notificationData = {
        user_id: userId,
        type: 'status_changed',
        title: 'Avalie seu atendimento',
        message: `Seu chamado foi resolvido! Que tal avaliar o atendimento recebido? Sua opinião é muito importante para nós.`,
        priority: 'medium',
        ticket_id: ticketId,
        read: false,
        created_at: new Date().toISOString()
      };

      const { data: insertedNotification, error: notificationError } = await db
        .from('notifications')
        .insert(notificationData)
        .select('*')
        .single();

      if (notificationError) {
        return false;
      } else {
        return true;
      }
    } catch (error) {
      return false;
    }
  }

  // Simple test notification
  static async createSimpleTestNotification(userId: string) {
    try {
      // Try using the RPC function first
      const { data, error } = await db.rpc('create_notification', {
        p_user_id: userId,
        p_type: 'ticket_created',
        p_title: 'Teste de Notificação',
        p_message: 'Esta é uma notificação de teste para verificar se o sistema está funcionando.',
        p_priority: 'medium'
      });

      if (error) {
        // Fallback to direct insert
        const notificationData = {
          user_id: userId,
          type: 'ticket_created',
          title: 'Teste de Notificação',
          message: 'Esta é uma notificação de teste para verificar se o sistema está funcionando.',
          priority: 'medium',
          read: false,
          created_at: new Date().toISOString()
        };

        const { data: insertedNotification, error: notificationError } = await db
          .from('notifications')
          .insert(notificationData)
          .select('*')
          .single();

        if (notificationError) {
          return false;
        } else {
          return true;
        }
      } else {
        return true;
      }
    } catch (error) {
      return false;
    }
  }

  // Get ticket activity logs
  static async getTicketActivityLogs(ticketId: string): Promise<TicketActivityLog[]> {
    try {
      const { data, error } = await db
        .from('ticket_activity_logs')
        .select(`
          *,
          user:users!user_id (
            id,
            full_name,
            email,
            avatar_url
          )
        `)
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Transform data to match interface
      return (data || []).map(log => ({
        id: log.id,
        ticket_id: log.ticket_id,
        user_id: log.user_id,
        action_type: log.action_type,
        field_name: log.field_name,
        old_value: log.old_value,
        new_value: log.new_value,
        description: log.description,
        metadata: log.metadata,
        created_at: log.created_at,
        user: log.user ? {
          id: log.user.id,
          name: log.user.full_name || 'Sistema',
          email: log.user.email,
          avatar_url: log.user.avatar_url
        } : undefined
      }));
    } catch (error) {
      return [];
    }
  }

  // Helper function to check if todo_tasks table exists
  private static async checkTodoTasksTableExists(): Promise<boolean> {
    try {
      const { error } = await db
        .from('todo_tasks')
        .select('id')
        .limit(1);

      // If no error, table exists
      if (!error) return true;

      // Check for specific table not found errors
      if (error.code === 'PGRST106' || 
          error.message?.includes('relation "public.todo_tasks" does not exist') ||
          error.message?.includes('table "todo_tasks" does not exist')) {
        return false;
      }

      // For other errors (like permission issues), assume table exists
      return true;
    } catch (error) {
      // On any other error, assume table doesn't exist
      return false;
    }
  }

  // Todo Tasks operations
  static async getTodoTasks(userId?: string): Promise<any[]> {
    try {
      // Check if todo_tasks table exists first
      const tableExists = await this.checkTodoTasksTableExists();
      if (!tableExists) {
        console.log('📋 Todo tasks table not available yet');
        return [];
      }

      let query = db
        .from('todo_tasks')
        .select(`
          *,
          assigned_user:users!todo_tasks_assigned_to_fkey(id, full_name, email),
          ticket:tickets_new(id, ticket_number, title, user_id, users!tickets_new_user_id_fkey(full_name))
        `);

      if (userId) {
        query = query.eq('assigned_to', userId);
      }

      query = query.order('created_at', { ascending: false });

      const { data, error } = await query;
      
      if (error) throw error;
      return data || [];
    } catch (error) {
      // Return empty array instead of throwing to prevent app crash
      console.log('Error in getTodoTasks:', error);
      return [];
    }
  }

  static async createTodoTask(taskData: {
    title: string;
    description?: string;
    priority: string;
    assigned_to: string;
    ticket_id?: string;
    due_date?: string;
    estimated_hours?: number;
    tags?: string[];
  }): Promise<any> {
    try {
      // Check if todo_tasks table exists first
      const tableExists = await this.checkTodoTasksTableExists();
      if (!tableExists) {
        console.log('📋 Todo tasks table not available yet, task creation will be enabled after migration');
        throw new Error('Todo tasks functionality requires database migration to be applied');
      }

      // Basic task data that exists in the original schema
      const basicTaskData = {
        title: taskData.title,
        description: taskData.description,
        priority: taskData.priority,
        assigned_to: taskData.assigned_to,
        ticket_id: taskData.ticket_id,
        status: 'pending',
        created_at: new Date().toISOString()
      };

      // Try to create the task with enhanced fields first
      try {
        const { data, error } = await db
          .from('todo_tasks')
          .insert({
            ...basicTaskData,
            due_date: taskData.due_date,
            estimated_hours: taskData.estimated_hours,
            tags: taskData.tags,
          })
          .select('*')
          .single();

        if (error) throw error;
        return data;
      } catch (enhancedError: any) {
        // If enhanced fields fail (columns don't exist), try with basic fields only
        if (enhancedError.message?.includes('due_date') || 
            enhancedError.message?.includes('estimated_hours') || 
            enhancedError.message?.includes('tags')) {
          
          console.log('⚠️ Enhanced todo fields not yet available, creating basic task');
          
          const { data, error } = await db
            .from('todo_tasks')
            .insert(basicTaskData)
            .select('*')
            .single();

          if (error) throw error;
          return data;
        } else {
          throw enhancedError;
        }
      }
    } catch (error) {
      throw error;
    }
  }

  static async updateTodoTask(taskId: string, updates: {
    title?: string;
    description?: string;
    status?: string;
    priority?: string;
    due_date?: string;
    estimated_hours?: number;
    tags?: string[];
    assigned_to?: string;
    ticket_id?: string;
  }): Promise<any> {
    try {
      // Check if todo_tasks table exists first
      const tableExists = await this.checkTodoTasksTableExists();
      if (!tableExists) {
        console.log('📋 Todo tasks table not available yet, task update will be enabled after migration');
        throw new Error('Todo tasks functionality requires database migration to be applied');
      }

      // Update the task
      const { data, error } = await db
        .from('todo_tasks')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', taskId)
        .select('*')
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      throw error;
    }
  }

  static async deleteTodoTask(taskId: string): Promise<void> {
    try {
      // Check if todo_tasks table exists first
      const tableExists = await this.checkTodoTasksTableExists();
      if (!tableExists) {
        console.log('📋 Todo tasks table not available yet, task deletion will be enabled after migration');
        throw new Error('Todo tasks functionality requires database migration to be applied');
      }

      // Delete the task
      const { error } = await db
        .from('todo_tasks')
        .delete()
        .eq('id', taskId);

      if (error) throw error;
    } catch (error) {
      throw error;
    }
  }

  // ===============================
  // CHAT SYSTEM METHODS
  // ===============================

  // Helper function to check if chat tables exist
  private static async checkChatTablesExist(): Promise<boolean> {
    try {
      // Check if ticket_comments_new exists (which we know it does)
      const { error } = await db
        .from('ticket_comments_new')
        .select('id')
        .limit(1);

      return !error;
    } catch (error) {
      return false;
    }
  }

  // Get or create chat for a ticket (using ticket_comments_new as chat functionality)
  static async getTicketChat(ticketId: string): Promise<any> {
    try {
      // Use the existing comments as chat functionality
      const tableExists = await this.checkChatTablesExist();
      if (!tableExists) {
        console.log('💬 Comment tables not available yet, returning mock structure');
        return {
          id: `mock-chat-${ticketId}`,
          ticket_id: ticketId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          is_active: true
        };
      }

      // Return a chat structure that represents the ticket's comment thread
      return {
        id: `chat-${ticketId}`,
        ticket_id: ticketId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_active: true
      };
    } catch (error) {
      console.error('Error getting ticket chat:', error);
      throw error;
    }
  }

  // Get chat messages (using ticket comments as chat messages)
  static async getChatMessages(chatId: string): Promise<any[]> {
    try {
      const tableExists = await this.checkChatTablesExist();
      if (!tableExists) {
        console.log('💬 Comment tables not available yet, returning empty messages');
        return [];
      }

      // Extract ticket ID from chat ID (format: chat-{ticketId})
      const ticketId = chatId.replace('chat-', '').replace('mock-chat-', '');
      
      const { data, error } = await supabase
        .from('ticket_comments_new')
        .select(`
          id,
          content as message,
          created_at,
          updated_at,
          user_id as sender_id,
          is_internal,
          ticket_id,
          user:users!ticket_comments_new_user_id_fkey(id, full_name, email, avatar_url)
        `)
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      
      // Transform comments to chat message format
      return (data || []).map(comment => ({
        id: comment.id,
        chat_id: chatId,
        sender_id: comment.sender_id,
        message: comment.message,
        is_internal: comment.is_internal || false,
        message_type: 'text',
        created_at: comment.created_at,
        updated_at: comment.updated_at,
        sender: comment.user ? {
          id: comment.user.id,
          full_name: comment.user.full_name,
          email: comment.user.email,
          avatar_url: comment.user.avatar_url
        } : null
      }));
    } catch (error) {
      console.error('Error getting chat messages:', error);
      return [];
    }
  }

  // Send chat message (using ticket comments)
  static async sendChatMessage(
    chatId: string, 
    senderId: string, 
    message: string, 
    isInternal: boolean = false,
    mentions: string[] = []
  ): Promise<any> {
    try {
      const tableExists = await this.checkChatTablesExist();
      if (!tableExists) {
        console.log('💬 Comment tables not available yet, message sending will be enabled after migration');
        throw new Error('Chat functionality requires database migration to be applied');
      }

      // Extract ticket ID from chat ID (format: chat-{ticketId})
      const ticketId = chatId.replace('chat-', '').replace('mock-chat-', '');

      // Insert the message as a ticket comment
      const { data: messageData, error: messageError } = await supabase
        .from('ticket_comments_new')
        .insert({
          ticket_id: ticketId,
          user_id: senderId,
          content: message,
          is_internal: isInternal
        })
        .select(`
          id,
          content as message,
          created_at,
          updated_at,
          user_id as sender_id,
          is_internal,
          ticket_id,
          user:users!ticket_comments_new_user_id_fkey(id, full_name, email, avatar_url, role)
        `)
        .single();

      if (messageError) throw messageError;

      // CRITICAL FIX: Add SLA first response detection for chat messages (same as comments)
      console.log(`🔍 SLA Debug (Chat): Checking user role for ${messageData.user?.full_name}: ${messageData.user?.role}`);
      if (messageData.user && ['agent', 'admin'].includes(messageData.user.role)) {
        console.log(`✅ Chat: User is agent/admin - proceeding with first response check`);
        try {
          // Get ticket details to check if this is first agent response
          const { data: ticket } = await supabase
            .from('tickets_new')
            .select('user_id, status, ticket_number')
            .eq('id', ticketId)
            .single();

          if (ticket && senderId !== ticket.user_id && ['open', 'in_progress'].includes(ticket.status)) {
            console.log(`🔍 SLA Debug (Chat): Ticket checks passed - user ${senderId} ≠ creator ${ticket.user_id}, status: ${ticket.status}`);
            // CRITICAL FIX: Check for previous agent responses BEFORE this message's timestamp
            const messageTime = new Date(messageData.created_at);
            console.log(`🔍 SLA Debug (Chat): Checking for previous responses before ${messageTime.toISOString()}`);
            const previousResponse = await this.detectFirstAgentResponseBefore(ticketId, messageTime);
            console.log(`🔍 SLA Debug (Chat): Previous response found: ${previousResponse ? previousResponse.toISOString() : 'NONE'}`);
            
            if (!previousResponse) {
              console.log(`🎯 SLA Debug (Chat): THIS IS FIRST RESPONSE! Logging for ticket ${ticketId}`);
              // This IS the first agent response - log it and trigger notifications
              await this.logFirstResponse(ticketId, senderId, messageTime);
              
              // Create first response notification for SLA tracking - notify ticket creator
              await NotificationService.createFirstResponseNotification(ticketId, ticket.user_id, {
                agentName: messageData.user.full_name || messageData.user.email || 'Agente',
                ticketNumber: ticket.ticket_number || '#' + ticketId.slice(-8)
              });
              
              console.log(`📋 First agent response detected (via chat) for ticket ${ticketId} by ${messageData.user.full_name}`);
            }
          }
        } catch (slaError) {
          console.error('❌ SLA tracking failed for chat message (non-blocking):', slaError);
        }
      } else {
        console.log(`❌ SLA Debug (Chat): User role check failed - userData: ${!!messageData.user}, role: ${messageData.user?.role}`);
      }

      // Transform to chat message format
      const chatMessage = {
        id: messageData.id,
        chat_id: chatId,
        sender_id: messageData.sender_id,
        message: messageData.message,
        is_internal: messageData.is_internal || false,
        message_type: 'text',
        created_at: messageData.created_at,
        updated_at: messageData.updated_at,
        sender: messageData.user ? {
          id: messageData.user.id,
          full_name: messageData.user.full_name,
          email: messageData.user.email,
          avatar_url: messageData.user.avatar_url
        } : null
      };

      // Note: Mentions functionality would need to be implemented separately if needed

      return chatMessage;
    } catch (error) {
      console.error('Error sending chat message:', error);
      throw error;
    }
  }

  // Get chat participants (simplified - returns ticket users)
  static async getChatParticipants(chatId: string): Promise<any[]> {
    try {
      // Extract ticket ID from chat ID (format: chat-{ticketId})
      const ticketId = chatId.replace('chat-', '').replace('mock-chat-', '');
      
      // Get ticket details to find involved users
      const { data: ticket, error: ticketError } = await supabase
        .from('tickets_new')
        .select(`
          user_id,
          assigned_to,
          user:users!tickets_new_user_id_fkey(id, full_name, email, avatar_url, role),
          assignee:users!tickets_new_assigned_to_fkey(id, full_name, email, avatar_url, role)
        `)
        .eq('id', ticketId)
        .single();

      if (ticketError) throw ticketError;

      const participants = [];
      
      // Add ticket creator
      if (ticket.user) {
        participants.push({
          id: `participant-${ticket.user_id}`,
          chat_id: chatId,
          user_id: ticket.user_id,
          joined_at: new Date().toISOString(),
          can_write: true,
          user: ticket.user
        });
      }

      // Add assignee if different from creator
      if (ticket.assigned_to && ticket.assigned_to !== ticket.user_id && ticket.assignee) {
        participants.push({
          id: `participant-${ticket.assigned_to}`,
          chat_id: chatId,
          user_id: ticket.assigned_to,
          joined_at: new Date().toISOString(),
          can_write: true,
          user: ticket.assignee
        });
      }

      return participants;
    } catch (error) {
      console.error('Error getting chat participants:', error);
      return [];
    }
  }

  // Add participant to chat (simplified - not implemented as chat uses ticket permissions)
  static async addChatParticipant(chatId: string, userId: string, canWrite: boolean = true): Promise<any> {
    try {
      console.log('💬 Chat participant management not implemented - using ticket permissions');
      
      // Return mock participant structure
      return {
        id: `participant-${userId}`,
        chat_id: chatId,
        user_id: userId,
        joined_at: new Date().toISOString(),
        can_write: canWrite,
        user: null // Would need to fetch user details if needed
      };
    } catch (error) {
      console.error('Error adding chat participant:', error);
      throw error;
    }
  }

  // Mark chat as read (simplified - not implemented)
  static async markChatAsRead(chatId: string, userId: string): Promise<void> {
    try {
      console.log('💬 Chat read status not implemented - using ticket comment system');
      // This functionality would need to be implemented if chat read status is required
    } catch (error) {
      console.error('Error marking chat as read:', error);
    }
  }

  // Get unread chat messages count for user
  static async getUnreadChatCount(userId: string): Promise<number> {
    try {
      const tableExists = await this.checkChatTablesExist();
      if (!tableExists) {
        return 0;
      }

      // This would be implemented with a database function in production
      // For now, return 0 until the full migration is applied
      return 0;
    } catch (error) {
      console.error('Error getting unread chat count:', error);
      return 0;
    }
  }

  // Upload file to chat (simplified - uses ticket attachments)
  static async uploadChatFile(
    chatId: string,
    senderId: string,
    file: File
  ): Promise<any> {
    try {
      // Extract ticket ID from chat ID (format: chat-{ticketId})
      const ticketId = chatId.replace('chat-', '').replace('mock-chat-', '');

      // Upload file to Supabase storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `chat-files/${chatId}/${fileName}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('uploads')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Create attachment record for the ticket
      const attachment = await this.createTicketAttachmentFromChatFile(
        ticketId,
        file.name,
        uploadData.path,
        file.size,
        file.type,
        senderId
      );

      // Return in chat message format
      return {
        id: attachment.id,
        chat_id: chatId,
        sender_id: senderId,
        file_path: uploadData.path,
        file_name: file.name,
        file_size: file.size,
        mime_type: file.type,
        message_type: 'file',
        created_at: attachment.uploaded_at,
        updated_at: attachment.uploaded_at
      };
    } catch (error) {
      console.error('Error uploading chat file:', error);
      throw error;
    }
  }

  // Initialize categories on system startup
  static async initializeCategories(): Promise<void> {
    try {
      // Check if categories already exist
      const { data: existingCategories, error: checkError } = await supabase
        .from('categories')
        .select('id')
        .limit(1);

      if (checkError) {
        console.error('Error checking existing categories:', checkError);
        return;
      }

      // If categories already exist, don't reinitialize
      if (existingCategories && existingCategories.length > 0) {
        console.log('✅ Categories already initialized');
        return;
      }

      console.log('🚀 Initializing categories for the first time...');
      await this.updateCategoriesStructure();
    } catch (error) {
      console.error('Error initializing categories:', error);
    }
  }

  // Update categories with new structure
  static async updateCategoriesStructure(): Promise<void> {
    const newCategories = [
      {
        name: 'Users & Passwords',
        description: 'User management and authentication issues',
        color: '#3B82F6', // Blue
        icon: '👤',
        sort_order: 1,
        subcategories: [
          { name: '[Germany] New Employee Onboarding', sort_order: 1, response_time_hours: 24, resolution_time_hours: 48 },
          { name: '[Rest of Europe] Onboard new employees', sort_order: 2, response_time_hours: 24, resolution_time_hours: 48 },
          { name: 'Employee offboarding', sort_order: 3, response_time_hours: 8, resolution_time_hours: 24 },
          { name: 'Forgot my password', sort_order: 4, response_time_hours: 2, resolution_time_hours: 4 },
          { name: 'Multi factor authentication', sort_order: 5, response_time_hours: 4, resolution_time_hours: 8 }
        ]
      },
      {
        name: 'ERP',
        description: 'Enterprise Resource Planning systems',
        color: '#F59E0B', // Yellow
        icon: '📊',
        sort_order: 2,
        subcategories: [
          { name: 'ERP Belgium', sort_order: 1, response_time_hours: 4, resolution_time_hours: 24 },
          { name: 'ERP Germany (Dynamics NAV)', sort_order: 2, response_time_hours: 4, resolution_time_hours: 24 },
          { name: 'ERP Netherlands', sort_order: 3, response_time_hours: 4, resolution_time_hours: 24 },
          { name: 'ERP UK', sort_order: 4, response_time_hours: 4, resolution_time_hours: 24 },
          { name: 'SAP system', sort_order: 5, response_time_hours: 4, resolution_time_hours: 24 }
        ]
      },
      {
        name: 'Infrastructure & Hardware',
        description: 'Hardware and infrastructure support',
        color: '#EF4444', // Red
        icon: '🖥️',
        sort_order: 3,
        subcategories: [
          { name: 'Get a guest wifi account', sort_order: 1, response_time_hours: 2, resolution_time_hours: 4 },
          { name: 'New mobile device', sort_order: 2, response_time_hours: 8, resolution_time_hours: 48 },
          { name: 'Printer & Scanner', sort_order: 3, response_time_hours: 4, resolution_time_hours: 24 },
          { name: 'Request new hardware', sort_order: 4, response_time_hours: 24, resolution_time_hours: 72 }
        ]
      },
      {
        name: 'Other',
        description: 'General IT support and other issues',
        color: '#8B5CF6', // Purple
        icon: '❓',
        sort_order: 4,
        subcategories: [
          { name: 'Get IT help', sort_order: 1, response_time_hours: 4, resolution_time_hours: 24 }
        ]
      },
      {
        name: 'Website & Intranet',
        description: 'Website and intranet related issues',
        color: '#10B981', // Green
        icon: '🌐',
        sort_order: 5,
        subcategories: [
          { name: 'Intranet', sort_order: 1, response_time_hours: 4, resolution_time_hours: 24 },
          { name: 'Web shop / eCommerce', sort_order: 2, response_time_hours: 2, resolution_time_hours: 8 },
          { name: 'Website issue', sort_order: 3, response_time_hours: 2, resolution_time_hours: 8 }
        ]
      },
      {
        name: 'Office 365 & SharePoint',
        description: 'Microsoft Office 365 and SharePoint support',
        color: '#F97316', // Orange
        icon: '📧',
        sort_order: 6,
        subcategories: [
          { name: 'Outlook', sort_order: 1, response_time_hours: 2, resolution_time_hours: 8 },
          { name: 'SharePoint issues & permissions', sort_order: 2, response_time_hours: 4, resolution_time_hours: 24 },
          { name: 'Teams & OneDrive issues', sort_order: 3, response_time_hours: 2, resolution_time_hours: 8 },
          { name: 'Word / Excel / PowerPoint issues', sort_order: 4, response_time_hours: 2, resolution_time_hours: 8 }
        ]
      }
    ];

    try {
      console.log('🚀 Starting category update process...');

      // 1. Delete all existing subcategories first
      console.log('🗑️ Deleting existing subcategories...');
      const { error: deleteSubcategoriesError } = await supabase
        .from('subcategories')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

      if (deleteSubcategoriesError) {
        console.error('❌ Error deleting subcategories:', deleteSubcategoriesError);
        throw deleteSubcategoriesError;
      }

      // 2. Delete all existing categories
      console.log('🗑️ Deleting existing categories...');
      const { error: deleteCategoriesError } = await supabase
        .from('categories')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

      if (deleteCategoriesError) {
        console.error('❌ Error deleting categories:', deleteCategoriesError);
        throw deleteCategoriesError;
      }

      // 3. Create new categories and subcategories
      for (const categoryData of newCategories) {
        console.log(`📁 Creating category: ${categoryData.name}`);
        
        // Create category
        const { data: category, error: categoryError } = await supabase
          .from('categories')
          .insert({
            name: categoryData.name,
            description: categoryData.description,
            color: categoryData.color,
            icon: categoryData.icon,
            sort_order: categoryData.sort_order
          })
          .select()
          .single();

        if (categoryError) {
          console.error(`❌ Error creating category ${categoryData.name}:`, categoryError);
          throw categoryError;
        }

        console.log(`✅ Created category: ${category.name} (ID: ${category.id})`);

        // Create subcategories for this category
        for (const subcategoryData of categoryData.subcategories) {
          console.log(`  📄 Creating subcategory: ${subcategoryData.name}`);
          
          const { data: subcategory, error: subcategoryError } = await supabase
            .from('subcategories')
            .insert({
              category_id: category.id,
              name: subcategoryData.name,
              sort_order: subcategoryData.sort_order,
              response_time_hours: subcategoryData.response_time_hours,
              resolution_time_hours: subcategoryData.resolution_time_hours,
              specialized_agents: []
            })
            .select()
            .single();

          if (subcategoryError) {
            console.error(`❌ Error creating subcategory ${subcategoryData.name}:`, subcategoryError);
            throw subcategoryError;
          }

          console.log(`  ✅ Created subcategory: ${subcategory.name} (ID: ${subcategory.id})`);
        }
      }

      console.log('🎉 Category update completed successfully!');
      
      // 4. Display summary
      const { data: categoriesCount } = await supabase
        .from('categories')
        .select('id', { count: 'exact' });
      
      const { data: subcategoriesCount } = await supabase
        .from('subcategories')
        .select('id', { count: 'exact' });

      console.log(`📊 Summary:`);
      console.log(`   Categories created: ${categoriesCount?.length || 0}`);
      console.log(`   Subcategories created: ${subcategoriesCount?.length || 0}`);

    } catch (error) {
      console.error('💥 Fatal error during category update:', error);
      throw error;
    }
  }

  // Enhanced Knowledge Base operations
  static async getKnowledgeCategories(options: {
    activeOnly?: boolean;
    includeParent?: boolean;
  } = {}): Promise<KnowledgeCategory[]> {
    let query = supabase
      .from('knowledge_categories')
      .select(options.includeParent ? `*, parent:knowledge_categories!knowledge_categories_parent_id_fkey(*)` : '*');

    if (options.activeOnly) {
      query = query.eq('is_active', true);
    }

    query = query.order('sort_order');

    const { data, error } = await query;
    
    if (error) throw error;
    return data || [];
  }

  static async getKnowledgeCategoriesForAdmin(options: {
    activeOnly?: boolean;
  } = {}): Promise<KnowledgeCategory[]> {
    return this.getKnowledgeCategories(options);
  }

  static async createKnowledgeCategory(categoryData: Partial<KnowledgeCategory>): Promise<KnowledgeCategory> {
    const { data, error } = await supabase
      .from('knowledge_categories')
      .insert(categoryData)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  static async updateKnowledgeCategory(id: string, updates: Partial<KnowledgeCategory>): Promise<KnowledgeCategory> {
    const { data, error } = await supabase
      .from('knowledge_categories')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  static async deleteKnowledgeCategory(id: string): Promise<void> {
    const { error } = await supabase
      .from('knowledge_categories')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  }

  static async getEnhancedKnowledgeArticles(options: {
    status?: 'draft' | 'review' | 'published' | 'archived';
    categoryId?: string;
    limit?: number;
  } = {}): Promise<KnowledgeArticle[]> {
    return this.getKnowledgeArticles(options);
  }

  static async deleteKnowledgeArticle(id: string): Promise<void> {
    const { error } = await supabase
      .from('knowledge_articles')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  static async publishArticle(id: string, reviewerId: string): Promise<KnowledgeArticle> {
    const { data, error } = await supabase
      .from('knowledge_articles')
      .update({
        status: 'published',
        is_published: true,
        last_reviewed_at: new Date().toISOString(),
        last_reviewed_by: reviewerId
      })
      .eq('id', id)
      .select(`
        *,
        author:users!knowledge_articles_author_id_fkey(id, full_name, email),
        knowledge_category:knowledge_categories!knowledge_articles_knowledge_category_id_fkey(
          id,
          name,
          slug,
          description,
          icon,
          color,
          sort_order,
          is_active,
          parent_id
        )
      `)
      .single();

    if (error) throw error;
    return data;
  }

  static async archiveArticle(id: string): Promise<KnowledgeArticle> {
    const { data, error } = await supabase
      .from('knowledge_articles')
      .update({
        status: 'archived',
        is_published: false
      })
      .eq('id', id)
      .select(`
        *,
        author:users!knowledge_articles_author_id_fkey(id, full_name, email),
        knowledge_category:knowledge_categories!knowledge_articles_knowledge_category_id_fkey(
          id,
          name,
          slug,
          description,
          icon,
          color,
          sort_order,
          is_active,
          parent_id
        )
      `)
      .single();

    if (error) throw error;
    return data;
  }

  static async submitArticleFeedback(feedback: {
    article_id: string;
    rating: 1 | -1;
    feedback_text?: string;
    is_anonymous?: boolean;
  }): Promise<void> {
    const { error } = await supabase
      .from('knowledge_article_feedback')
      .insert({
        ...feedback,
        user_id: feedback.is_anonymous ? null : (await this.getCurrentUser())?.id
      });

    if (error) throw error;
  }

  static async getArticleStats(articleId: string): Promise<{
    total_views: number;
    helpful_votes: number;
    not_helpful_votes: number;
    total_feedback: number;
    helpfulness_ratio: number;
  }> {
    const { data, error } = await supabase
      .rpc('get_article_stats', { article_id: articleId });

    if (error) throw error;
    return data || {
      total_views: 0,
      helpful_votes: 0,
      not_helpful_votes: 0,
      total_feedback: 0,
      helpfulness_ratio: 0
    };
  }

  static async incrementArticleView(articleId: string): Promise<void> {
    const { error } = await supabase
      .from('knowledge_articles')
      .update({ view_count: supabase.sql`view_count + 1` })
      .eq('id', articleId);

    if (error) throw error;
  }

  // ============================
  // TICKET TASKS MANAGEMENT
  // ============================

  static async getTicketTasks(ticketId: string): Promise<TicketTask[]> {
    const { data, error } = await supabase
      .from('ticket_tasks')
      .select(`
        *,
        assignee:assigned_to(id, full_name, email, avatar_url),
        creator:created_by(id, full_name, email, avatar_url)
      `)
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true });

    if (error) throw error;

    // Get comment counts for each task
    const tasksWithCounts = await Promise.all(
      (data || []).map(async (task) => {
        const { count } = await supabase
          .from('ticket_task_comments')
          .select('*', { count: 'exact', head: true })
          .eq('task_id', task.id);

        return {
          ...task,
          comments_count: count || 0,
          assignee: task.assignee ? {
            id: task.assignee.id,
            name: task.assignee.full_name || task.assignee.email,
            email: task.assignee.email,
            avatar_url: task.assignee.avatar_url
          } : undefined,
          creator: {
            id: task.creator.id,
            name: task.creator.full_name || task.creator.email,
            email: task.creator.email,
            avatar_url: task.creator.avatar_url
          }
        };
      })
    );

    return tasksWithCounts;
  }

  static async createTicketTask(taskData: {
    ticket_id: string;
    title: string;
    description?: string;
    assigned_to?: string;
    priority?: 'low' | 'medium' | 'high' | 'urgent';
    due_date?: string;
    created_by: string;
  }): Promise<TicketTask> {
    const { data, error } = await supabase
      .from('ticket_tasks')
      .insert([{
        ticket_id: taskData.ticket_id,
        title: taskData.title,
        description: taskData.description,
        assigned_to: taskData.assigned_to,
        priority: taskData.priority || 'medium',
        due_date: taskData.due_date,
        created_by: taskData.created_by,
        status: 'open'
      }])
      .select(`
        *,
        assignee:assigned_to(id, full_name, email, avatar_url),
        creator:created_by(id, full_name, email, avatar_url)
      `)
      .single();

    if (error) throw error;

    return {
      ...data,
      comments_count: 0,
      assignee: data.assignee ? {
        id: data.assignee.id,
        name: data.assignee.full_name || data.assignee.email,
        email: data.assignee.email,
        avatar_url: data.assignee.avatar_url
      } : undefined,
      creator: {
        id: data.creator.id,
        name: data.creator.full_name || data.creator.email,
        email: data.creator.email,
        avatar_url: data.creator.avatar_url
      }
    };
  }

  static async updateTicketTask(taskId: string, updates: {
    title?: string;
    description?: string;
    assigned_to?: string;
    status?: 'open' | 'in_progress' | 'done' | 'blocked';
    priority?: 'low' | 'medium' | 'high' | 'urgent';
    due_date?: string;
  }): Promise<TicketTask> {
    const { data, error } = await supabase
      .from('ticket_tasks')
      .update(updates)
      .eq('id', taskId)
      .select(`
        *,
        assignee:assigned_to(id, full_name, email, avatar_url),
        creator:created_by(id, full_name, email, avatar_url)
      `)
      .single();

    if (error) throw error;

    // Get comment count
    const { count } = await supabase
      .from('ticket_task_comments')
      .select('*', { count: 'exact', head: true })
      .eq('task_id', taskId);

    return {
      ...data,
      comments_count: count || 0,
      assignee: data.assignee ? {
        id: data.assignee.id,
        name: data.assignee.full_name || data.assignee.email,
        email: data.assignee.email,
        avatar_url: data.assignee.avatar_url
      } : undefined,
      creator: {
        id: data.creator.id,
        name: data.creator.full_name || data.creator.email,
        email: data.creator.email,
        avatar_url: data.creator.avatar_url
      }
    };
  }

  static async deleteTicketTask(taskId: string): Promise<void> {
    const { error } = await supabase
      .from('ticket_tasks')
      .delete()
      .eq('id', taskId);

    if (error) throw error;
  }

  static async getTaskComments(taskId: string): Promise<TicketTaskComment[]> {
    const { data, error } = await supabase
      .from('ticket_task_comments')
      .select(`
        *,
        user:user_id(id, full_name, email, avatar_url)
      `)
      .eq('task_id', taskId)
      .order('created_at', { ascending: true });

    if (error) throw error;

    return (data || []).map(comment => ({
      ...comment,
      user: {
        id: comment.user.id,
        name: comment.user.full_name || comment.user.email,
        email: comment.user.email,
        avatar_url: comment.user.avatar_url
      }
    }));
  }

  static async addTaskComment(taskId: string, userId: string, comment: string): Promise<TicketTaskComment> {
    const { data, error } = await supabase
      .from('ticket_task_comments')
      .insert([{
        task_id: taskId,
        user_id: userId,
        comment: comment
      }])
      .select(`
        *,
        user:user_id(id, full_name, email, avatar_url)
      `)
      .single();

    if (error) throw error;

    return {
      ...data,
      user: {
        id: data.user.id,
        name: data.user.full_name || data.user.email,
        email: data.user.email,
        avatar_url: data.user.avatar_url
      }
    };
  }

  static async deleteTaskComment(commentId: string): Promise<void> {
    const { error } = await supabase
      .from('ticket_task_comments')
      .delete()
      .eq('id', commentId);

    if (error) throw error;
  }

  static async getTaskStatistics(ticketId?: string): Promise<{
    total: number;
    open: number;
    in_progress: number;
    done: number;
    blocked: number;
    overdue: number;
  }> {
    let query = supabase
      .from('ticket_tasks')
      .select('status, due_date');

    if (ticketId) {
      query = query.eq('ticket_id', ticketId);
    }

    const { data, error } = await query;
    if (error) throw error;

    const stats = {
      total: data?.length || 0,
      open: 0,
      in_progress: 0,
      done: 0,
      blocked: 0,
      overdue: 0
    };

    const now = new Date();
    data?.forEach(task => {
      stats[task.status as keyof typeof stats]++;
      
      // Check if task is overdue
      if (task.due_date && new Date(task.due_date) < now && task.status !== 'done') {
        stats.overdue++;
      }
    });

    return stats;
  }

  static async getAgentTaskLoad(agentId: string): Promise<{
    total: number;
    by_priority: Record<string, number>;
    by_status: Record<string, number>;
    overdue: number;
  }> {
    const { data, error } = await supabase
      .from('ticket_tasks')
      .select('status, priority, due_date')
      .eq('assigned_to', agentId)
      .neq('status', 'done');

    if (error) throw error;

    const load = {
      total: data?.length || 0,
      by_priority: { low: 0, medium: 0, high: 0, urgent: 0 },
      by_status: { open: 0, in_progress: 0, blocked: 0 },
      overdue: 0
    };

    const now = new Date();
    data?.forEach(task => {
      load.by_priority[task.priority as keyof typeof load.by_priority]++;
      load.by_status[task.status as keyof typeof load.by_status]++;
      
      if (task.due_date && new Date(task.due_date) < now) {
        load.overdue++;
      }
    });

    return load;
  }

}

// Utility functions
export const formatPriority = (priority: string) => {
  const labels = {
    urgent: "Urgente",
    high: "Alta",
    medium: "Média",
    low: "Baixa"
  };
  return labels[priority as keyof typeof labels] || priority;
};

export const formatStatus = (status: string) => {
  const labels = {
    open: "Aberto",
    in_progress: "Em Andamento",
    resolved: "Resolvido",
    closed: "Fechado"
  };
  return labels[status as keyof typeof labels] || status;
};

export const getPriorityColor = (priority: string) => {
  switch (priority) {
    case "urgent": return "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800";
    case "high": return "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800";
    case "medium": return "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800";
    case "low": return "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800";
    default: return "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700";
  }
};

export const getStatusColor = (status: string) => {
  switch (status) {
    case "open": return "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700";
    case "in_progress": return "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800";
    case "resolved": return "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800";
    case "closed": return "bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700";
    default: return "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700";
  }
};

// Add this line at the end of the file
export default DatabaseService;
