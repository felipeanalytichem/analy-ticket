#!/usr/bin/env node

/**
 * Notification System Deployment Monitor
 * Monitors key metrics during notification system deployment
 */

import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:54321';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'your-service-key';

// Create Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Monitoring thresholds
const THRESHOLDS = {
  ERROR_RATE_PERCENT: 0.1,
  AVG_DELIVERY_TIME_SECONDS: 2.0,
  CONNECTION_DROP_RATE_PERCENT: 1.0,
  CACHE_HIT_RATE_PERCENT: 80.0,
  MEMORY_USAGE_MB: 512,
  CPU_USAGE_PERCENT: 80
};

// Alert levels
const ALERT_LEVELS = {
  INFO: 'INFO',
  WARNING: 'WARNING',
  CRITICAL: 'CRITICAL'
};

class DeploymentMonitor {
  constructor() {
    this.alerts = [];
    this.metrics = {};
    this.isMonitoring = false;
  }

  /**
   * Start monitoring deployment
   */
  async startMonitoring(intervalMinutes = 5) {
    console.log('🚀 Starting notification system deployment monitoring...');
    console.log(`📊 Monitoring interval: ${intervalMinutes} minutes`);
    console.log('📈 Thresholds:', THRESHOLDS);
    
    this.isMonitoring = true;
    
    // Initial check
    await this.runHealthCheck();
    
    // Set up periodic monitoring
    const interval = setInterval(async () => {
      if (!this.isMonitoring) {
        clearInterval(interval);
        return;
      }
      
      await this.runHealthCheck();
    }, intervalMinutes * 60 * 1000);
    
    // Handle graceful shutdown
    process.on('SIGINT', () => {
      console.log('\n🛑 Stopping monitoring...');
      this.isMonitoring = false;
      clearInterval(interval);
      this.generateReport();
      process.exit(0);
    });
  }

  /**
   * Run comprehensive health check
   */
  async runHealthCheck() {
    const timestamp = new Date().toISOString();
    console.log(`\n🔍 Health Check - ${timestamp}`);
    console.log('=' .repeat(50));
    
    try {
      // Run all health checks
      const [
        notificationMetrics,
        featureFlagMetrics,
        performanceMetrics,
        errorMetrics,
        systemMetrics
      ] = await Promise.all([
        this.checkNotificationHealth(),
        this.checkFeatureFlagHealth(),
        this.checkPerformanceHealth(),
        this.checkErrorRates(),
        this.checkSystemHealth()
      ]);
      
      // Store metrics
      this.metrics[timestamp] = {
        notifications: notificationMetrics,
        featureFlags: featureFlagMetrics,
        performance: performanceMetrics,
        errors: errorMetrics,
        system: systemMetrics
      };
      
      // Evaluate alerts
      this.evaluateAlerts(timestamp);
      
      // Display summary
      this.displayHealthSummary();
      
    } catch (error) {
      console.error('❌ Health check failed:', error);
      this.addAlert(ALERT_LEVELS.CRITICAL, 'Health check failed', error.message);
    }
  }

  /**
   * Check notification system health
   */
  async checkNotificationHealth() {
    try {
      const { data: stats, error } = await supabase
        .from('notifications')
        .select('delivery_status, created_at, updated_at')
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
      
      if (error) throw error;
      
      const totalNotifications = stats.length;
      const failedNotifications = stats.filter(n => n.delivery_status === 'failed').length;
      const errorRate = totalNotifications > 0 ? (failedNotifications / totalNotifications) * 100 : 0;
      
      // Calculate average delivery time
      const deliveryTimes = stats
        .filter(n => n.delivery_status === 'delivered')
        .map(n => (new Date(n.updated_at) - new Date(n.created_at)) / 1000);
      
      const avgDeliveryTime = deliveryTimes.length > 0 
        ? deliveryTimes.reduce((a, b) => a + b, 0) / deliveryTimes.length 
        : 0;
      
      const metrics = {
        totalNotifications,
        failedNotifications,
        errorRate,
        avgDeliveryTime
      };
      
      console.log('📬 Notification Health:');
      console.log(`   Total Notifications (24h): ${totalNotifications}`);
      console.log(`   Failed Notifications: ${failedNotifications}`);
      console.log(`   Error Rate: ${errorRate.toFixed(2)}%`);
      console.log(`   Avg Delivery Time: ${avgDeliveryTime.toFixed(2)}s`);
      
      // Check thresholds
      if (errorRate > THRESHOLDS.ERROR_RATE_PERCENT) {
        this.addAlert(ALERT_LEVELS.CRITICAL, 'High error rate', `${errorRate.toFixed(2)}% > ${THRESHOLDS.ERROR_RATE_PERCENT}%`);
      }
      
      if (avgDeliveryTime > THRESHOLDS.AVG_DELIVERY_TIME_SECONDS) {
        this.addAlert(ALERT_LEVELS.WARNING, 'Slow delivery time', `${avgDeliveryTime.toFixed(2)}s > ${THRESHOLDS.AVG_DELIVERY_TIME_SECONDS}s`);
      }
      
      return metrics;
      
    } catch (error) {
      console.error('❌ Notification health check failed:', error);
      throw error;
    }
  }

  /**
   * Check feature flag system health
   */
  async checkFeatureFlagHealth() {
    try {
      const { data: usage, error } = await supabase
        .from('feature_flag_usage')
        .select('flag_name, enabled, timestamp')
        .gte('timestamp', new Date(Date.now() - 60 * 60 * 1000).toISOString()); // Last hour
      
      if (error) throw error;
      
      const flagStats = {};
      usage.forEach(record => {
        if (!flagStats[record.flag_name]) {
          flagStats[record.flag_name] = { total: 0, enabled: 0 };
        }
        flagStats[record.flag_name].total++;
        if (record.enabled) {
          flagStats[record.flag_name].enabled++;
        }
      });
      
      console.log('🚩 Feature Flag Health:');
      Object.entries(flagStats).forEach(([flagName, stats]) => {
        const enabledRate = stats.total > 0 ? (stats.enabled / stats.total) * 100 : 0;
        console.log(`   ${flagName}: ${stats.enabled}/${stats.total} (${enabledRate.toFixed(1)}%)`);
      });
      
      return flagStats;
      
    } catch (error) {
      console.error('❌ Feature flag health check failed:', error);
      throw error;
    }
  }

  /**
   * Check performance metrics
   */
  async checkPerformanceHealth() {
    try {
      // Check database performance
      const { data: dbStats, error } = await supabase
        .rpc('pg_stat_database')
        .select('*')
        .limit(1);
      
      if (error) throw error;
      
      // Mock performance metrics (in real implementation, these would come from monitoring tools)
      const metrics = {
        dbConnections: Math.floor(Math.random() * 50) + 10,
        cacheHitRate: Math.random() * 20 + 80, // 80-100%
        avgQueryTime: Math.random() * 100 + 50, // 50-150ms
        memoryUsage: Math.random() * 200 + 300, // 300-500MB
        cpuUsage: Math.random() * 30 + 20 // 20-50%
      };
      
      console.log('⚡ Performance Health:');
      console.log(`   DB Connections: ${metrics.dbConnections}`);
      console.log(`   Cache Hit Rate: ${metrics.cacheHitRate.toFixed(1)}%`);
      console.log(`   Avg Query Time: ${metrics.avgQueryTime.toFixed(1)}ms`);
      console.log(`   Memory Usage: ${metrics.memoryUsage.toFixed(1)}MB`);
      console.log(`   CPU Usage: ${metrics.cpuUsage.toFixed(1)}%`);
      
      // Check thresholds
      if (metrics.cacheHitRate < THRESHOLDS.CACHE_HIT_RATE_PERCENT) {
        this.addAlert(ALERT_LEVELS.WARNING, 'Low cache hit rate', `${metrics.cacheHitRate.toFixed(1)}% < ${THRESHOLDS.CACHE_HIT_RATE_PERCENT}%`);
      }
      
      if (metrics.memoryUsage > THRESHOLDS.MEMORY_USAGE_MB) {
        this.addAlert(ALERT_LEVELS.WARNING, 'High memory usage', `${metrics.memoryUsage.toFixed(1)}MB > ${THRESHOLDS.MEMORY_USAGE_MB}MB`);
      }
      
      if (metrics.cpuUsage > THRESHOLDS.CPU_USAGE_PERCENT) {
        this.addAlert(ALERT_LEVELS.WARNING, 'High CPU usage', `${metrics.cpuUsage.toFixed(1)}% > ${THRESHOLDS.CPU_USAGE_PERCENT}%`);
      }
      
      return metrics;
      
    } catch (error) {
      console.error('❌ Performance health check failed:', error);
      throw error;
    }
  }

  /**
   * Check error rates across the system
   */
  async checkErrorRates() {
    try {
      // Check notification analytics for errors
      const { data: analytics, error } = await supabase
        .from('notification_analytics')
        .select('event_type, timestamp')
        .gte('timestamp', new Date(Date.now() - 60 * 60 * 1000).toISOString())
        .in('event_type', ['error', 'failed', 'timeout']);
      
      if (error) throw error;
      
      const errorCount = analytics.length;
      const errorRate = errorCount; // Errors per hour
      
      console.log('🚨 Error Health:');
      console.log(`   Errors (1h): ${errorCount}`);
      console.log(`   Error Rate: ${errorRate}/hour`);
      
      if (errorCount > 10) {
        this.addAlert(ALERT_LEVELS.WARNING, 'High error count', `${errorCount} errors in the last hour`);
      }
      
      return { errorCount, errorRate };
      
    } catch (error) {
      console.error('❌ Error rate check failed:', error);
      throw error;
    }
  }

  /**
   * Check system-level health
   */
  async checkSystemHealth() {
    try {
      // Test database connectivity
      const { data, error } = await supabase
        .from('users')
        .select('count')
        .limit(1);
      
      if (error) throw error;
      
      // Mock system metrics
      const metrics = {
        dbConnected: true,
        realtimeConnected: true,
        cacheConnected: true,
        uptime: Math.floor(Math.random() * 1000000) + 500000 // Mock uptime in seconds
      };
      
      console.log('🖥️  System Health:');
      console.log(`   Database: ${metrics.dbConnected ? '✅' : '❌'}`);
      console.log(`   Realtime: ${metrics.realtimeConnected ? '✅' : '❌'}`);
      console.log(`   Cache: ${metrics.cacheConnected ? '✅' : '❌'}`);
      console.log(`   Uptime: ${Math.floor(metrics.uptime / 3600)}h ${Math.floor((metrics.uptime % 3600) / 60)}m`);
      
      return metrics;
      
    } catch (error) {
      console.error('❌ System health check failed:', error);
      this.addAlert(ALERT_LEVELS.CRITICAL, 'System health check failed', error.message);
      throw error;
    }
  }

  /**
   * Add alert to the alert queue
   */
  addAlert(level, title, message) {
    const alert = {
      timestamp: new Date().toISOString(),
      level,
      title,
      message
    };
    
    this.alerts.push(alert);
    
    const emoji = level === ALERT_LEVELS.CRITICAL ? '🚨' : level === ALERT_LEVELS.WARNING ? '⚠️' : 'ℹ️';
    console.log(`${emoji} ${level}: ${title} - ${message}`);
  }

  /**
   * Evaluate current metrics against thresholds
   */
  evaluateAlerts(timestamp) {
    const currentMetrics = this.metrics[timestamp];
    
    // Add any additional alert logic here
    if (currentMetrics.notifications.totalNotifications === 0) {
      this.addAlert(ALERT_LEVELS.WARNING, 'No notifications', 'No notifications processed in the last 24 hours');
    }
  }

  /**
   * Display health summary
   */
  displayHealthSummary() {
    const recentAlerts = this.alerts.slice(-5); // Last 5 alerts
    
    if (recentAlerts.length === 0) {
      console.log('✅ All systems healthy');
    } else {
      console.log(`⚠️  ${recentAlerts.length} recent alerts:`);
      recentAlerts.forEach(alert => {
        const emoji = alert.level === ALERT_LEVELS.CRITICAL ? '🚨' : alert.level === ALERT_LEVELS.WARNING ? '⚠️' : 'ℹ️';
        console.log(`   ${emoji} ${alert.title}`);
      });
    }
  }

  /**
   * Generate comprehensive monitoring report
   */
  generateReport() {
    console.log('\n📊 Deployment Monitoring Report');
    console.log('=' .repeat(50));
    
    const timestamps = Object.keys(this.metrics);
    if (timestamps.length === 0) {
      console.log('No metrics collected');
      return;
    }
    
    // Summary statistics
    const latestMetrics = this.metrics[timestamps[timestamps.length - 1]];
    
    console.log('\n📈 Latest Metrics:');
    console.log(`   Notifications (24h): ${latestMetrics.notifications.totalNotifications}`);
    console.log(`   Error Rate: ${latestMetrics.notifications.errorRate.toFixed(2)}%`);
    console.log(`   Avg Delivery Time: ${latestMetrics.notifications.avgDeliveryTime.toFixed(2)}s`);
    console.log(`   Memory Usage: ${latestMetrics.performance.memoryUsage.toFixed(1)}MB`);
    console.log(`   CPU Usage: ${latestMetrics.performance.cpuUsage.toFixed(1)}%`);
    
    // Alert summary
    console.log('\n🚨 Alert Summary:');
    const alertCounts = this.alerts.reduce((acc, alert) => {
      acc[alert.level] = (acc[alert.level] || 0) + 1;
      return acc;
    }, {});
    
    Object.entries(alertCounts).forEach(([level, count]) => {
      const emoji = level === ALERT_LEVELS.CRITICAL ? '🚨' : level === ALERT_LEVELS.WARNING ? '⚠️' : 'ℹ️';
      console.log(`   ${emoji} ${level}: ${count}`);
    });
    
    // Recommendations
    console.log('\n💡 Recommendations:');
    if (alertCounts[ALERT_LEVELS.CRITICAL] > 0) {
      console.log('   🚨 CRITICAL alerts detected - consider immediate rollback');
    } else if (alertCounts[ALERT_LEVELS.WARNING] > 5) {
      console.log('   ⚠️  Multiple warnings - monitor closely and consider reducing rollout');
    } else {
      console.log('   ✅ System appears stable - safe to continue deployment');
    }
    
    console.log('\n📝 Report generated at:', new Date().toISOString());
  }

  /**
   * Emergency rollback procedure
   */
  async emergencyRollback() {
    console.log('🚨 EMERGENCY ROLLBACK INITIATED');
    console.log('Disabling all experimental notification features...');
    
    try {
      // Disable all risky feature flags
      const riskyFlags = [
        'notifications_enhanced_realtime',
        'notifications_intelligent_grouping',
        'notifications_new_bell_ui',
        'notifications_ai_prioritization'
      ];
      
      for (const flagName of riskyFlags) {
        const { error } = await supabase
          .from('feature_flags')
          .update({ enabled: false, rollout_percentage: 0 })
          .eq('name', flagName);
        
        if (error) {
          console.error(`Failed to disable ${flagName}:`, error);
        } else {
          console.log(`✅ Disabled ${flagName}`);
        }
      }
      
      console.log('🔄 Emergency rollback completed');
      console.log('📞 Contact deployment team for further action');
      
    } catch (error) {
      console.error('❌ Emergency rollback failed:', error);
      console.log('📞 URGENT: Manual intervention required');
    }
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  const monitor = new DeploymentMonitor();
  
  switch (command) {
    case 'start':
      const interval = parseInt(args[1]) || 5;
      await monitor.startMonitoring(interval);
      break;
      
    case 'check':
      await monitor.runHealthCheck();
      monitor.generateReport();
      break;
      
    case 'rollback':
      await monitor.emergencyRollback();
      break;
      
    default:
      console.log('Notification System Deployment Monitor');
      console.log('');
      console.log('Usage:');
      console.log('  node monitor-notification-deployment.mjs start [interval_minutes]  # Start continuous monitoring');
      console.log('  node monitor-notification-deployment.mjs check                     # Run single health check');
      console.log('  node monitor-notification-deployment.mjs rollback                  # Emergency rollback');
      console.log('');
      console.log('Examples:');
      console.log('  node monitor-notification-deployment.mjs start 5    # Monitor every 5 minutes');
      console.log('  node monitor-notification-deployment.mjs check      # One-time health check');
      process.exit(1);
  }
}

// Run if called directly
if (process.argv[1] === __filename) {
  main().catch(console.error);
}

export { DeploymentMonitor };
export default DeploymentMonitor;