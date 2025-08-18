import React, { useState, useEffect } from 'react';
import { Database, Download, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { offlineManager } from '@/services/OfflineManager';
import type { CachedData } from '@/services/OfflineManager';

interface OfflineDataIndicatorProps {
  table: string;
  itemId?: string;
  showDetails?: boolean;
  className?: string;
}

interface DataAvailability {
  isAvailable: boolean;
  isStale: boolean;
  lastUpdated: Date | null;
  dataSize: number;
  itemCount: number;
}

export const OfflineDataIndicator: React.FC<OfflineDataIndicatorProps> = ({
  table,
  itemId,
  showDetails = false,
  className = ''
}) => {
  const [availability, setAvailability] = useState<DataAvailability>({
    isAvailable: false,
    isStale: false,
    lastUpdated: null,
    dataSize: 0,
    itemCount: 0
  });
  
  const [isLoading, setIsLoading] = useState(true);
  const [cachedData, setCachedData] = useState<CachedData[]>([]);

  useEffect(() => {
    checkDataAvailability();
    
    // Set up periodic checks
    const interval = setInterval(checkDataAvailability, 30000); // Check every 30 seconds
    
    return () => clearInterval(interval);
  }, [table, itemId]);

  const checkDataAvailability = async () => {
    try {
      setIsLoading(true);
      
      // Initialize offline manager if not already done
      await offlineManager.initialize();
      
      // Get cached data for the table/item
      const data = await offlineManager.getCachedData(table, itemId);
      setCachedData(data);
      
      if (data.length === 0) {
        setAvailability({
          isAvailable: false,
          isStale: false,
          lastUpdated: null,
          dataSize: 0,
          itemCount: 0
        });
      } else {
        // Calculate data metrics
        const now = new Date();
        const dataSize = data.reduce((total, item) => {
          return total + new Blob([JSON.stringify(item.data)]).size;
        }, 0);
        
        const lastUpdated = data.reduce((latest, item) => {
          return !latest || item.timestamp > latest ? item.timestamp : latest;
        }, null as Date | null);
        
        // Check if data is stale (older than 1 hour)
        const isStale = lastUpdated ? (now.getTime() - lastUpdated.getTime()) > 60 * 60 * 1000 : false;
        
        setAvailability({
          isAvailable: true,
          isStale,
          lastUpdated,
          dataSize,
          itemCount: data.length
        });
      }
    } catch (error) {
      console.error('Failed to check data availability:', error);
      setAvailability({
        isAvailable: false,
        isStale: false,
        lastUpdated: null,
        dataSize: 0,
        itemCount: 0
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCacheData = async () => {
    try {
      // This would trigger caching of current data
      // In a real implementation, this would fetch fresh data and cache it
      console.log(`Caching data for ${table}${itemId ? `:${itemId}` : ''}`);
      
      // For now, just refresh the availability check
      await checkDataAvailability();
    } catch (error) {
      console.error('Failed to cache data:', error);
    }
  };

  const formatDataSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatLastUpdated = (date: Date | null) => {
    if (!date) return 'Never';
    
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  };

  const getStatusIcon = () => {
    if (isLoading) {
      return <Clock className="h-4 w-4 animate-pulse" />;
    }
    
    if (!availability.isAvailable) {
      return <AlertTriangle className="h-4 w-4 text-orange-500" />;
    }
    
    if (availability.isStale) {
      return <Database className="h-4 w-4 text-yellow-500" />;
    }
    
    return <CheckCircle className="h-4 w-4 text-green-500" />;
  };

  const getStatusText = () => {
    if (isLoading) return 'Checking...';
    if (!availability.isAvailable) return 'Not cached';
    if (availability.isStale) return 'Stale data';
    return 'Available offline';
  };

  const getStatusColor = () => {
    if (isLoading) return 'secondary';
    if (!availability.isAvailable) return 'destructive';
    if (availability.isStale) return 'outline';
    return 'default';
  };

  if (showDetails) {
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center space-x-2">
            {getStatusIcon()}
            <span>Offline Data - {table}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Status:</span>
            <Badge variant={getStatusColor() as any}>
              {getStatusText()}
            </Badge>
          </div>
          
          {availability.isAvailable && (
            <>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Items:</span>
                <span className="text-sm font-medium">{availability.itemCount}</span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Size:</span>
                <span className="text-sm font-medium">{formatDataSize(availability.dataSize)}</span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Last updated:</span>
                <span className="text-sm font-medium">{formatLastUpdated(availability.lastUpdated)}</span>
              </div>
            </>
          )}
          
          <div className="pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCacheData}
              disabled={isLoading}
              className="w-full"
            >
              <Download className="h-3 w-3 mr-2" />
              {availability.isAvailable ? 'Refresh Cache' : 'Cache Data'}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Compact indicator
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={`inline-flex items-center space-x-1 ${className}`}>
            {getStatusIcon()}
            <Badge variant={getStatusColor() as any} className="text-xs">
              {availability.isAvailable ? availability.itemCount : 0}
            </Badge>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <div className="space-y-1">
            <div className="font-medium">{getStatusText()}</div>
            {availability.isAvailable && (
              <>
                <div className="text-xs">
                  {availability.itemCount} items • {formatDataSize(availability.dataSize)}
                </div>
                <div className="text-xs text-muted-foreground">
                  Updated {formatLastUpdated(availability.lastUpdated)}
                </div>
              </>
            )}
            {!availability.isAvailable && (
              <div className="text-xs text-muted-foreground">
                Data not available offline
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default OfflineDataIndicator;