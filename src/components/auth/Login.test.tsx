import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@/test/utils/test-utils';
import { Login } from '@/pages/Login';
import { mockSupabase } from '@/test/utils/test-utils';
import { supabase } from '@/lib/supabase';

vi.mock('@/lib/supabase', () => ({
  supabase: mockSupabase
}));

// Mock user profile data
const mockUserProfile = {
  id: '123',
  email: 'test@example.com',
  full_name: 'Test User',
  role: 'user',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
};

// Mock successful auth response
const mockAuthResponse = {
  data: {
    user: { id: '123', email: 'test@example.com' },
    session: { 
      access_token: 'mock-token',
      refresh_token: 'mock-refresh-token',
      expires_at: Date.now() + 3600000 // 1 hour from now
    }
  },
  error: null
};

describe('Login Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Reset location
    window.history.pushState({}, '', '/');
    
    // Mock Supabase responses
    mockSupabase.auth.signInWithPassword.mockReset();
    mockSupabase.from('users').select.mockReset();
    
    // Mock successful profile fetch
    mockSupabase.from('users').select.mockResolvedValue({
      data: [mockUserProfile],
      error: null
    });
  });

  it('renders login form correctly', () => {
    render(<Login />);
    
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('shows validation errors for empty form submission', async () => {
    render(<Login />);
    
    const submitButton = screen.getByRole('button', { name: /sign in/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/email is required/i)).toBeInTheDocument();
      expect(screen.getByText(/password is required/i)).toBeInTheDocument();
    });
  });

  it('shows error message for invalid credentials', async () => {
    // Mock auth failure
    mockSupabase.auth.signInWithPassword.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: 'Invalid credentials' }
    });
    
    render(<Login />);
    
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'test@example.com' }
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: 'wrongpassword' }
    });
    
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument();
    });
  });

  it('redirects on successful login', async () => {
    // Mock successful auth
    mockSupabase.auth.signInWithPassword.mockResolvedValue(mockAuthResponse);
    
    // Mock successful profile fetch
    mockSupabase.from('users').select.mockResolvedValue({
      data: [mockUserProfile],
      error: null
    });
    
    render(<Login />);
    
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'test@example.com' }
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: 'password123' }
    });
    
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      // Verify auth was called with correct credentials
      expect(mockSupabase.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123'
      });
      
      // Verify profile was fetched
      expect(mockSupabase.from('users').select).toHaveBeenCalled();
      
      // Verify redirect
      expect(window.location.pathname).toBe('/dashboard');
    });
  });

  it('handles network errors gracefully', async () => {
    // Mock network failure
    mockSupabase.auth.signInWithPassword.mockRejectedValue(new Error('Network error'));
    
    render(<Login />);
    
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'test@example.com' }
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: 'password123' }
    });
    
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText(/network error/i)).toBeInTheDocument();
    });
  });

  it('handles missing user profile gracefully', async () => {
    // Mock successful auth but no profile
    mockSupabase.auth.signInWithPassword.mockResolvedValue(mockAuthResponse);
    mockSupabase.from('users').select.mockResolvedValue({
      data: [],
      error: null
    });
    
    render(<Login />);
    
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'test@example.com' }
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: 'password123' }
    });
    
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText(/profile not found/i)).toBeInTheDocument();
    });
  });

  it('handles password reset link click', () => {
    render(<Login />);
    
    const resetLink = screen.getByText(/forgot password/i);
    fireEvent.click(resetLink);
    
    expect(window.location.pathname).toBe('/forgot-password');
  });
}); 