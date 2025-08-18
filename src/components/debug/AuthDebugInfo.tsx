import { useAuth } from '@/contexts/AuthContext';

export function AuthDebugInfo() {
  const { user, userProfile, loading, isInitialized, sessionHealth } = useAuth();

  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 bg-black text-green-400 p-4 rounded-lg font-mono text-xs max-w-sm z-50">
      <div className="mb-2 text-yellow-400 font-bold">🔐 SESSION DEBUG</div>
      <div>Status: <span className="text-white">{sessionHealth?.isValid ? 'ACTIVE' : 'INACTIVE'}</span></div>
      <div>Time Left: <span className="text-white">{sessionHealth ? `${Math.round(sessionHealth.timeUntilExpiry / 1000 / 60)}m ${Math.round((sessionHealth.timeUntilExpiry / 1000) % 60)}s` : 'N/A'}</span></div>
      <div>Warning: <span className="text-white">{sessionHealth?.needsRefresh ? 'Expires Soon' : 'None'}</span></div>
      <div>Last Activity: <span className="text-white">{new Date().toLocaleTimeString()}</span></div>
      <div className="text-xs text-gray-400 mt-2">Updates every second</div>
      
      <div className="mt-4 border-t border-gray-600 pt-2">
        <div>Loading: <span className="text-white">{loading ? 'YES' : 'NO'}</span></div>
        <div>Initialized: <span className="text-white">{isInitialized ? 'YES' : 'NO'}</span></div>
        <div>User: <span className="text-white">{user ? 'EXISTS' : 'NULL'}</span></div>
        <div>Profile: <span className="text-white">{userProfile ? 'LOADED' : 'NULL'}</span></div>
        {user && (
          <div>User ID: <span className="text-white">{user.id.slice(0, 8)}...</span></div>
        )}
        {userProfile && (
          <div>Profile Role: <span className="text-white">{userProfile.role}</span></div>
        )}
      </div>
    </div>
  );
}