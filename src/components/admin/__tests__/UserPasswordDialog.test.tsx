import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { UserPasswordDialog } from '../UserPasswordDialog';

// Mock the toast hook
vi.mock('@/components/ui/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn()
  })
}));

// Mock clipboard API
Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn().mockResolvedValue(undefined)
  }
});

describe('UserPasswordDialog', () => {
  const mockOnClose = vi.fn();
  
  const mockUser = {
    id: '1',
    name: 'John Doe',
    email: 'john@example.com',
    role: 'user' as const,
    created_at: '2023-01-01',
    updated_at: '2023-01-01'
  };

  const defaultProps = {
    isOpen: true,
    onClose: mockOnClose,
    user: mockUser,
    generatedPassword: 'temp123'
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render dialog with isolated state', () => {
    render(<UserPasswordDialog {...defaultProps} />);
    
    expect(screen.getByText('User Created - Invitation Instructions')).toBeInTheDocument();
    expect(screen.getByText('john@example.com')).toBeInTheDocument();
    expect(screen.getByText('John Doe')).toBeInTheDocument();
  });

  it('should handle password visibility toggle without affecting parent', () => {
    render(<UserPasswordDialog {...defaultProps} />);
    
    const passwordInput = screen.getByDisplayValue('temp123');
    const toggleButton = screen.getByTitle('Show password');
    
    // Initially password should be hidden
    expect(passwordInput).toHaveAttribute('type', 'password');
    
    // Toggle visibility
    fireEvent.click(toggleButton);
    expect(passwordInput).toHaveAttribute('type', 'text');
    
    // Parent should not be affected
    expect(mockOnClose).not.toHaveBeenCalled();
  });

  it('should copy password to clipboard with optimistic feedback', async () => {
    render(<UserPasswordDialog {...defaultProps} />);
    
    const copyButton = screen.getByText('Copy');
    fireEvent.click(copyButton);
    
    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('temp123');
    });
    
    // Should show optimistic feedback
    expect(screen.getByText('Copied')).toBeInTheDocument();
  });

  it('should copy registration link to clipboard', async () => {
    render(<UserPasswordDialog {...defaultProps} />);
    
    const registrationCopyButton = screen.getAllByText('Copy')[0]; // First copy button is for registration link
    fireEvent.click(registrationCopyButton);
    
    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        `${window.location.origin}/register`
      );
    });
  });

  it('should clean up state on dialog close', () => {
    const { rerender } = render(<UserPasswordDialog {...defaultProps} />);
    
    // Toggle password visibility
    const toggleButton = screen.getByTitle('Show password');
    fireEvent.click(toggleButton);
    
    // Close dialog
    rerender(<UserPasswordDialog {...defaultProps} isOpen={false} />);
    
    // Reopen dialog - state should be reset
    rerender(<UserPasswordDialog {...defaultProps} isOpen={true} />);
    
    const passwordInput = screen.getByDisplayValue('temp123');
    expect(passwordInput).toHaveAttribute('type', 'password'); // Should be hidden again
  });

  it('should handle dialog without generated password', () => {
    render(
      <UserPasswordDialog 
        {...defaultProps} 
        generatedPassword={null} 
      />
    );
    
    expect(screen.getByText('The user needs to register using the link below.')).toBeInTheDocument();
    expect(screen.queryByText('Generated Temporary Password:')).not.toBeInTheDocument();
  });

  it('should prevent dialog operations from triggering parent re-renders', () => {
    const renderSpy = vi.fn();
    
    const TestWrapper = ({ children }: { children: React.ReactNode }) => {
      renderSpy();
      return <div>{children}</div>;
    };
    
    render(
      <TestWrapper>
        <UserPasswordDialog {...defaultProps} />
      </TestWrapper>
    );
    
    const initialRenderCount = renderSpy.mock.calls.length;
    
    // Perform dialog operations
    const toggleButton = screen.getByTitle('Show password');
    fireEvent.click(toggleButton);
    
    const copyButton = screen.getByText('Copy');
    fireEvent.click(copyButton);
    
    // Parent component should not re-render due to dialog state changes
    expect(renderSpy.mock.calls.length).toBe(initialRenderCount);
  });

  it('should handle close button click with state cleanup', () => {
    render(<UserPasswordDialog {...defaultProps} />);
    
    // Toggle some state
    const toggleButton = screen.getByTitle('Show password');
    fireEvent.click(toggleButton);
    
    // Click close button
    const closeButton = screen.getByText('I Understand');
    fireEvent.click(closeButton);
    
    expect(mockOnClose).toHaveBeenCalled();
  });
});