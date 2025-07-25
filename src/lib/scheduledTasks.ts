import DatabaseService from './database';

export class ScheduledTasks {
  private static intervals: NodeJS.Timeout[] = [];

  /**
   * Start all scheduled tasks
   */
  static startAll() {
    console.log('🕐 Starting scheduled tasks...');
    
    // Auto-close tickets every hour
    const autoCloseInterval = setInterval(async () => {
      try {
        console.log('🔄 Running auto-close task...');
        const closedCount = await DatabaseService.autoCloseInactiveTickets();
        if (closedCount && closedCount > 0) {
          console.log(`✅ Auto-closed ${closedCount} tickets`);
        }
      } catch (error) {
        console.error('❌ Error in auto-close task:', error);
      }
    }, 60 * 60 * 1000); // Every hour

    // Check SLA warnings every 2 hours (reduced frequency to prevent spam)
    const slaCheckInterval = setInterval(async () => {
      try {
        console.log('🔄 Running SLA check task...');
        const result = await DatabaseService.checkSLAWarnings();
        if (result.warnings > 0 || result.breaches > 0) {
          console.log(`⚠️ SLA Check: ${result.warnings} warnings, ${result.breaches} breaches`);
        } else {
          console.log('✅ SLA Check: No warnings or breaches detected');
        }
      } catch (error) {
        console.error('❌ Error in SLA check task:', error);
      }
    }, 2 * 60 * 60 * 1000); // Every 2 hours

    this.intervals.push(autoCloseInterval, slaCheckInterval);
    console.log('✅ Scheduled tasks started');
  }

  /**
   * Stop all scheduled tasks
   */
  static stopAll() {
    console.log('🛑 Stopping scheduled tasks...');
    this.intervals.forEach(interval => clearInterval(interval));
    this.intervals = [];
    console.log('✅ Scheduled tasks stopped');
  }

  /**
   * Run auto-close task manually
   */
  static async runAutoClose() {
    console.log('🔄 Running manual auto-close task...');
    try {
      const closedCount = await DatabaseService.autoCloseInactiveTickets();
      console.log(`✅ Manual auto-close completed: ${closedCount || 0} tickets closed`);
      return closedCount || 0;
    } catch (error) {
      console.error('❌ Error in manual auto-close task:', error);
      return 0;
    }
  }

  /**
   * Run SLA check task manually
   */
  static async runSLACheck() {
    console.log('🔄 Running manual SLA check task...');
    try {
      const result = await DatabaseService.checkSLAWarnings();
      console.log(`✅ Manual SLA check completed: ${result.warnings} warnings, ${result.breaches} breaches`);
      return result;
    } catch (error) {
      console.error('❌ Error in manual SLA check task:', error);
      return { warnings: 0, breaches: 0 };
    }
  }

  /**
   * Get task status
   */
  static getStatus() {
    return {
      running: this.intervals.length > 0,
      taskCount: this.intervals.length
    };
  }
}

// Auto-start tasks when module is imported (only in browser environment)
if (typeof window !== 'undefined') {
  // Start tasks after a short delay to ensure everything is initialized
  setTimeout(() => {
    ScheduledTasks.startAll();
  }, 5000);

  // Stop tasks when page is unloaded
  window.addEventListener('beforeunload', () => {
    ScheduledTasks.stopAll();
  });
}
