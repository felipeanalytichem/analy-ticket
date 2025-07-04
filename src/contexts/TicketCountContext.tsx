import React, { createContext, useContext, useState, useCallback } from 'react';

interface TicketCountContextType {
  refreshKey: number;
  triggerRefresh: () => void;
}

const TicketCountContext = createContext<TicketCountContextType | undefined>(undefined);

export const TicketCountProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [refreshKey, setRefreshKey] = useState(0);

  const triggerRefresh = useCallback(() => {
    setRefreshKey(prev => prev + 1);
  }, []);

  return (
    <TicketCountContext.Provider value={{ refreshKey, triggerRefresh }}>
      {children}
    </TicketCountContext.Provider>
  );
};

export const useTicketCount = () => {
  const context = useContext(TicketCountContext);
  if (context === undefined) {
    throw new Error('useTicketCount must be used within a TicketCountProvider');
  }
  return context;
}; 