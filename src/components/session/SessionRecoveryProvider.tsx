import React, { createContext, useContext } from 'react';
import { useSessionRecovery } from '@/hooks/useSessionRecovery';

interface SessionRecoveryContextType {
  recoveryState: {
    isRecovering: boolean;
    lastRecoveryAttempt: Date | null;
    recoveryAttempts: number;
  };
  attemptRecovery: () => Promise<boolean>;
  handleApiError: (error: any) => Promise<boolean>;
}

const SessionRecoveryContext = createContext<SessionRecoveryContextType | undefined>(undefined);

export function useSessionRecoveryContext() {
  const context = useContext(SessionRecoveryContext);
  if (!context) {
    throw new Error('useSessionRecoveryContext must be used within a SessionRecoveryProvider');
  }
  return context;
}

interface SessionRecoveryProviderProps {
  children: React.ReactNode;
}

export function SessionRecoveryProvider({ children }: SessionRecoveryProviderProps) {
  const sessionRecovery = useSessionRecovery();

  return (
    <SessionRecoveryContext.Provider value={sessionRecovery}>
      {children}
    </SessionRecoveryContext.Provider>
  );
}