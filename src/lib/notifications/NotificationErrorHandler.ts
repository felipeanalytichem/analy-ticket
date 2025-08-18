export interface ErrorContext {
  operation: string;
  userId?: string;
  notificationId?: string;
  subscriptionId?: string;
  notification?: any;
  options?: any;
  preferences?: any;
}

export interface ErrorLog {
  id: string;
  timestamp: Date;
  error: Error;
  context: ErrorContext;
  severity: 'low' | 'medium' | 'high' | 'critical';
  resolved: boolean;
}

/**
 * NotificationErrorHandler - Comprehensive error handling and recovery
 */
export class NotificationErrorHandler {
  private errorLogs: Map<string, ErrorLog> = new Map();
  private readonly MAX_ERROR_LOGS = 1000;
  private retryStrategies: Map<string, (context: ErrorContext) => Promise<boolean>> = new Map();

  constructor() {
    this.setupRetryStrategies();
  }

  /**
   * Handle error with appropriate strategy
   */
  async handleError(error: Error, context: ErrorContext): Promise<void> {
    const errorLog = this.logError(error, context);
    
    console.error(`🚨 [${errorLog.severity.toUpperCase()}] Error in ${context.operation}:`, error.message);
    
    // Try to recover based on error type and context
    const recovered = await this.attemptRecovery(error, context);
    
    if (recovered) {
      errorLog.resolved = true;
      console.log(`✅ Recovered from error in ${context.operation}`);
    } else {
      console.error(`❌ Failed to recover from error in ${context.operation}`);
      
      // For critical errors, we might want to notify administrators
      if (errorLog.severity === 'critical') {
        await this.notifyAdministrators(errorLog);
      }
    }
  }

  /**
   * Log error with context
   */
  private logError(error: Error, context: ErrorContext): ErrorLog {
    // Ensure we don't exceed max logs
    if (this.errorLogs.size >= this.MAX_ERROR_LOGS) {
      this.removeOldestLog();
    }

    const errorLog: ErrorLog = {
      id: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      error,
      context,
      severity: this.determineSeverity(error, context),
      resolved: false
    };

    this.errorLogs.set(errorLog.id, errorLog);
    
    return errorLog;
  }

  /**
   * Determine error severity based on error type and context
   */
  private determineSeverity(error: Error, context: ErrorContext): 'low' | 'medium' | 'high' | 'critical' {
    // Network errors are usually temporary
    if (error.message.includes('network') || error.message.includes('fetch')) {
      return 'medium';
    }

    // Database errors are more serious
    if (error.message.includes('database') || error.message.includes('supabase')) {
      return 'high';
    }

    // Authentication errors
    if (error.message.includes('auth') || error.message.includes('permission')) {
      return 'high';
    }

    // Real-time connection errors
    if (context.operation.includes('subscribe') || context.operation.includes('realtime')) {
      return 'medium';
    }

    // Critical operations
    if (context.operation === 'createNotification' && context.notification?.priority === 'high') {
      return 'critical';
    }

    return 'low';
  }

  /**
   * Attempt to recover from error
   */
  private async attemptRecovery(error: Error, context: ErrorContext): Promise<boolean> {
    const strategy = this.retryStrategies.get(context.operation);
    
    if (strategy) {
      try {
        return await strategy(context);
      } catch (recoveryError) {
        console.error('Error during recovery attempt:', recoveryError);
        return false;
      }
    }

    // Default recovery strategies based on error type
    if (error.message.includes('network') || error.message.includes('fetch')) {
      return await this.handleNetworkError(context);
    }

    if (error.message.includes('timeout')) {
      return await this.handleTimeoutError(context);
    }

    return false;
  }

  /**
   * Setup retry strategies for different operations
   */
  private setupRetryStrategies(): void {
    // Strategy for getting notifications
    this.retryStrategies.set('getNotifications', async (context) => {
      // For read operations, we can try again after a short delay
      await this.delay(1000);
      return true; // Let the caller retry
    });

    // Strategy for creating notifications
    this.retryStrategies.set('createNotification', async (context) => {
      // For create operations, we should queue for retry
      console.log('Queueing notification for retry...');
      return false; // Will be handled by the queue
    });

    // Strategy for subscription errors
    this.retryStrategies.set('subscribe', async (context) => {
      // For subscription errors, try to reconnect after delay
      await this.delay(2000);
      return true;
    });

    // Strategy for marking as read
    this.retryStrategies.set('markAsRead', async (context) => {
      // For update operations, retry once after delay
      await this.delay(500);
      return true;
    });
  }

  /**
   * Handle network errors
   */
  private async handleNetworkError(context: ErrorContext): Promise<boolean> {
    console.log('🌐 Handling network error, will retry...');
    
    // Wait before allowing retry
    await this.delay(2000);
    
    // Check if we're back online
    if (navigator.onLine) {
      console.log('✅ Network appears to be back online');
      return true;
    }
    
    console.log('❌ Still offline, cannot recover');
    return false;
  }

  /**
   * Handle timeout errors
   */
  private async handleTimeoutError(context: ErrorContext): Promise<boolean> {
    console.log('⏱️ Handling timeout error, will retry with longer timeout...');
    
    // Wait before retry
    await this.delay(1000);
    
    return true;
  }

  /**
   * Notify administrators of critical errors
   */
  private async notifyAdministrators(errorLog: ErrorLog): Promise<void> {
    console.log('🚨 Critical error detected, notifying administrators...');
    
    // In a real implementation, this would send notifications to administrators
    // For now, we'll just log it
    console.error('CRITICAL ERROR LOG:', {
      id: errorLog.id,
      timestamp: errorLog.timestamp,
      operation: errorLog.context.operation,
      error: errorLog.error.message,
      context: errorLog.context
    });
  }

  /**
   * Get error statistics
   */
  getErrorStats(): {
    total: number;
    resolved: number;
    unresolved: number;
    bySeverity: Record<string, number>;
    byOperation: Record<string, number>;
  } {
    const logs = Array.from(this.errorLogs.values());
    
    const bySeverity: Record<string, number> = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0
    };
    
    const byOperation: Record<string, number> = {};
    
    let resolved = 0;
    
    for (const log of logs) {
      bySeverity[log.severity]++;
      byOperation[log.context.operation] = (byOperation[log.context.operation] || 0) + 1;
      if (log.resolved) resolved++;
    }
    
    return {
      total: logs.length,
      resolved,
      unresolved: logs.length - resolved,
      bySeverity,
      byOperation
    };
  }

  /**
   * Get recent errors
   */
  getRecentErrors(limit: number = 10): ErrorLog[] {
    return Array.from(this.errorLogs.values())
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  /**
   * Get errors by severity
   */
  getErrorsBySeverity(severity: 'low' | 'medium' | 'high' | 'critical'): ErrorLog[] {
    return Array.from(this.errorLogs.values())
      .filter(log => log.severity === severity)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Clear resolved errors
   */
  clearResolvedErrors(): number {
    const resolvedIds: string[] = [];
    
    for (const [id, log] of this.errorLogs.entries()) {
      if (log.resolved) {
        resolvedIds.push(id);
      }
    }
    
    for (const id of resolvedIds) {
      this.errorLogs.delete(id);
    }
    
    console.log(`🗑️ Cleared ${resolvedIds.length} resolved errors`);
    return resolvedIds.length;
  }

  /**
   * Clear all errors
   */
  clearAllErrors(): number {
    const count = this.errorLogs.size;
    this.errorLogs.clear();
    console.log(`🗑️ Cleared all ${count} error logs`);
    return count;
  }

  /**
   * Remove oldest error log when limit is reached
   */
  private removeOldestLog(): void {
    let oldestId = '';
    let oldestTime = Date.now();
    
    for (const [id, log] of this.errorLogs.entries()) {
      if (log.timestamp.getTime() < oldestTime) {
        oldestTime = log.timestamp.getTime();
        oldestId = id;
      }
    }
    
    if (oldestId) {
      this.errorLogs.delete(oldestId);
    }
  }

  /**
   * Utility method for delays
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Check if operation should be retried based on error history
   */
  shouldRetry(operation: string, maxRetries: number = 3): boolean {
    const recentErrors = Array.from(this.errorLogs.values())
      .filter(log => 
        log.context.operation === operation && 
        Date.now() - log.timestamp.getTime() < 60000 // Last minute
      );
    
    return recentErrors.length < maxRetries;
  }

  /**
   * Cleanup method for graceful shutdown
   */
  async cleanup(): Promise<void> {
    console.log('🧹 Cleaning up NotificationErrorHandler...');
    
    // Log final statistics
    const stats = this.getErrorStats();
    console.log('📊 Final error statistics:', stats);
    
    // Clear all errors
    this.clearAllErrors();
    
    console.log('✅ NotificationErrorHandler cleanup complete');
  }
}