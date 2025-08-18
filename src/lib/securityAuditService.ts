import { supabase } from '@/lib/supabase';
import type { Tables, TablesInsert } from '@/integrations/supabase/types';

// Type for security audit log entries
export type SecurityAuditLog = Tables<'security_audit_logs'>;
export type SecurityAuditLogInsert = TablesInsert<'security_audit_logs'>;

// Supported audit actions
export type SecurityAuditAction = 
  | 'unauthorized_ticket_access' 
  | 'invalid_ticket_query' 
  | 'ticket_access_denied';

// Interface for audit log entry data
export interface AuditLogData {
  userId?: string;
  action: SecurityAuditAction;
  ticketId?: string;
  userRole: 'user' | 'agent' | 'admin';
  ipAddress?: string;
  userAgent?: string;
  errorMessage?: string;
  metadata?: Record<string, any>;
}

// Interface for getting client information from request
export interface ClientInfo {
  ipAddress?: string;
  userAgent?: string;
}

export class SecurityAuditService {
  /**
   * Log a security audit event
   */
  static async logSecurityEvent(data: AuditLogData): Promise<void> {
    try {
      console.log('🔒 SecurityAuditService: Logging security event:', {
        action: data.action,
        userId: data.userId,
        ticketId: data.ticketId,
        userRole: data.userRole
      });

      const auditEntry: SecurityAuditLogInsert = {
        user_id: data.userId || null,
        action: data.action,
        ticket_id: data.ticketId || null,
        user_role: data.userRole,
        ip_address: data.ipAddress || null,
        user_agent: data.userAgent || null,
        error_message: data.errorMessage || null,
        metadata: data.metadata || null
      };

      const { error } = await supabase
        .from('security_audit_logs')
        .insert(auditEntry);

      if (error) {
        console.error('🔒 SecurityAuditService: Failed to log security event:', error);
        // Don't throw error to avoid breaking the main flow
        // Security logging should be non-blocking
      } else {
        console.log('🔒 SecurityAuditService: Security event logged successfully');
      }
    } catch (error) {
      console.error('🔒 SecurityAuditService: Exception while logging security event:', error);
      // Don't throw error to avoid breaking the main flow
    }
  }

  /**
   * Log unauthorized ticket access attempt
   */
  static async logUnauthorizedTicketAccess(
    userId: string,
    ticketId: string,
    userRole: 'user' | 'agent' | 'admin',
    errorMessage?: string,
    clientInfo?: ClientInfo
  ): Promise<void> {
    await this.logSecurityEvent({
      userId,
      action: 'unauthorized_ticket_access',
      ticketId,
      userRole,
      errorMessage,
      ipAddress: clientInfo?.ipAddress,
      userAgent: clientInfo?.userAgent,
      metadata: {
        timestamp: new Date().toISOString(),
        attemptedResource: `ticket:${ticketId}`,
        accessType: 'direct_access'
      }
    });
  }

  /**
   * Log invalid ticket query attempt
   */
  static async logInvalidTicketQuery(
    userId: string,
    userRole: 'user' | 'agent' | 'admin',
    errorMessage?: string,
    queryDetails?: Record<string, any>,
    clientInfo?: ClientInfo
  ): Promise<void> {
    await this.logSecurityEvent({
      userId,
      action: 'invalid_ticket_query',
      userRole,
      errorMessage,
      ipAddress: clientInfo?.ipAddress,
      userAgent: clientInfo?.userAgent,
      metadata: {
        timestamp: new Date().toISOString(),
        queryDetails: queryDetails || {},
        accessType: 'query_access'
      }
    });
  }

  /**
   * Log ticket access denied event
   */
  static async logTicketAccessDenied(
    userId: string,
    ticketId: string,
    userRole: 'user' | 'agent' | 'admin',
    reason: string,
    clientInfo?: ClientInfo
  ): Promise<void> {
    await this.logSecurityEvent({
      userId,
      action: 'ticket_access_denied',
      ticketId,
      userRole,
      errorMessage: reason,
      ipAddress: clientInfo?.ipAddress,
      userAgent: clientInfo?.userAgent,
      metadata: {
        timestamp: new Date().toISOString(),
        denialReason: reason,
        accessType: 'permission_check'
      }
    });
  }

  /**
   * Get client information from browser (for client-side usage)
   */
  static getClientInfo(): ClientInfo {
    const clientInfo: ClientInfo = {};

    // Get user agent
    if (typeof navigator !== 'undefined') {
      clientInfo.userAgent = navigator.userAgent;
    }

    // Note: IP address cannot be reliably obtained from client-side JavaScript
    // This would typically be handled by the server or edge functions
    // For now, we'll leave it undefined and it can be added by server-side code

    return clientInfo;
  }

  /**
   * Get security audit logs (admin only)
   */
  static async getAuditLogs(
    limit: number = 100,
    offset: number = 0,
    filters?: {
      userId?: string;
      action?: SecurityAuditAction;
      ticketId?: string;
      dateFrom?: string;
      dateTo?: string;
    }
  ): Promise<SecurityAuditLog[]> {
    try {
      let query = supabase
        .from('security_audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      // Apply filters if provided
      if (filters?.userId) {
        query = query.eq('user_id', filters.userId);
      }

      if (filters?.action) {
        query = query.eq('action', filters.action);
      }

      if (filters?.ticketId) {
        query = query.eq('ticket_id', filters.ticketId);
      }

      if (filters?.dateFrom) {
        query = query.gte('created_at', filters.dateFrom);
      }

      if (filters?.dateTo) {
        query = query.lte('created_at', filters.dateTo);
      }

      const { data, error } = await query;

      if (error) {
        console.error('🔒 SecurityAuditService: Failed to fetch audit logs:', error);
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('🔒 SecurityAuditService: Exception while fetching audit logs:', error);
      throw error;
    }
  }

  /**
   * Get audit log statistics (admin only)
   */
  static async getAuditStats(dateFrom?: string, dateTo?: string): Promise<{
    totalEvents: number;
    eventsByAction: Record<SecurityAuditAction, number>;
    recentEvents: SecurityAuditLog[];
  }> {
    try {
      let query = supabase
        .from('security_audit_logs')
        .select('*');

      if (dateFrom) {
        query = query.gte('created_at', dateFrom);
      }

      if (dateTo) {
        query = query.lte('created_at', dateTo);
      }

      const { data, error } = await query;

      if (error) {
        console.error('🔒 SecurityAuditService: Failed to fetch audit stats:', error);
        throw error;
      }

      const logs = data || [];
      
      // Calculate statistics
      const eventsByAction: Record<SecurityAuditAction, number> = {
        'unauthorized_ticket_access': 0,
        'invalid_ticket_query': 0,
        'ticket_access_denied': 0
      };

      logs.forEach(log => {
        if (log.action in eventsByAction) {
          eventsByAction[log.action as SecurityAuditAction]++;
        }
      });

      // Get recent events (last 10)
      const recentEvents = logs
        .sort((a, b) => new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime())
        .slice(0, 10);

      return {
        totalEvents: logs.length,
        eventsByAction,
        recentEvents
      };
    } catch (error) {
      console.error('🔒 SecurityAuditService: Exception while fetching audit stats:', error);
      throw error;
    }
  }
}