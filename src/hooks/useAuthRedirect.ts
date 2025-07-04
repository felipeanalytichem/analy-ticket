import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

export function useAuthRedirect() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!loading) {
      // If user is authenticated and on auth pages, redirect to dashboard
      if (user && ['/login', '/register', '/forgot-password'].includes(location.pathname)) {
        const from = (location.state as any)?.from?.pathname || '/';
        navigate(from, { replace: true });
      }
      
      // If user is not authenticated and not on auth pages, redirect to login
      if (!user && !['/login', '/register', '/forgot-password'].includes(location.pathname)) {
        navigate('/login', { 
          replace: true, 
          state: { from: location } 
        });
      }
    }
  }, [user, loading, location, navigate]);

  return { user, loading };
} 