// Core notification services
export { NotificationManager } from './NotificationManager';
export { NotificationCache } from './NotificationCache';
export { RealtimeConnectionManager } from './RealtimeConnectionManager';
export { NotificationQueue } from './NotificationQueue';
export { NotificationErrorHandler } from './NotificationErrorHandler';

// Types and interfaces
export type {
  NotificationQueryOptions,
  CreateNotificationRequest,
  NotificationCallback,
  Subscription,
  ConnectionStatus,
  NotificationPreferences,
  NotificationWithTicket
} from './NotificationManager';

export type {
  CacheEntry,
  CacheStats
} from './NotificationCache';

export type {
  RealtimeConnection
} from './RealtimeConnectionManager';

export type {
  QueueItem
} from './NotificationQueue';

export type {
  ErrorContext,
  ErrorLog
} from './NotificationErrorHandler';