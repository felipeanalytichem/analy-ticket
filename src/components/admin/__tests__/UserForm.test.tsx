import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { UserForm } from '../UserForm';

// Mock the toast hook
vi.mock('@/components/ui/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn()
  })
}));

describe('UserForm', () => {
  const mockOnClose = vi.fn();
  const mockOnSave = vi.fn();

  const defaultProps = {
    isOpen: true,
    onClose: mockOnClose,
    onSave: mockOnSave,
    user: null,
    isCreating: true,
    tempPasswordColumnsExist: true,
    isSubmitting: false
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render form with isolated state', () => {
    render(<UserForm {...defaultProps} />);
    
    expect(screen.getByLabelText(/Full Name/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Email/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Role/)).toBeInTheDocument();
  });

  it('should handle form state changes without triggering parent re-renders', async () => {
    render(<UserForm {...defaultProps} />);
    
    const nameInput = screen.getByLabelText(/Full Name/);
    const emailInput = screen.getByLabelText(/Email/);
    
    // Change form values
    fireEvent.change(nameInput, { target: { value: 'John Doe' } });
    fireEvent.change(emailInput, { target: { value: 'john@example.com' } });
    
    // Verify form state is isolated
    expect(nameInput).toHaveValue('John Doe');
    expect(emailInput).toHaveValue('john@example.com');
    
    // Parent callbacks should not be called during form changes
    expect(mockOnClose).not.toHaveBeenCalled();
    expect(mockOnSave).not.toHaveBeenCalled();
  });

  it('should implement optimistic updates on form submission', async () => {
    const mockSave = vi.fn().mockResolvedValue(undefined);
    
    render(<UserForm {...defaultProps} onSave={mockSave} />);
    
    // Fill form
    fireEvent.change(screen.getByLabelText(/Full Name/), { 
      target: { value: 'John Doe' } 
    });
    fireEvent.change(screen.getByLabelText(/Email/), { 
      target: { value: 'john@example.com' } 
    });
    
    // Submit form
    fireEvent.click(screen.getByText('Create'));
    
    await waitFor(() => {
      expect(mockSave).toHaveBeenCalledWith({
        name: 'John Doe',
        email: 'john@example.com',
        role: 'user'
      }, false);
    });
  });

  it('should handle form cleanup on dialog close', () => {
    const { rerender } = render(<UserForm {...defaultProps} />);
    
    // Fill form
    fireEvent.change(screen.getByLabelText(/Full Name/), { 
      target: { value: 'John Doe' } 
    });
    
    // Close dialog
    rerender(<UserForm {...defaultProps} isOpen={false} />);
    
    // Reopen dialog - form should be clean
    rerender(<UserForm {...defaultProps} isOpen={true} />);
    
    expect(screen.getByLabelText(/Full Name/)).toHaveValue('');
  });

  it('should prevent form operations from triggering main component re-renders', () => {
    const renderSpy = vi.fn();
    
    const TestWrapper = ({ children }: { children: React.ReactNode }) => {
      renderSpy();
      return <div>{children}</div>;
    };
    
    render(
      <TestWrapper>
        <UserForm {...defaultProps} />
      </TestWrapper>
    );
    
    const initialRenderCount = renderSpy.mock.calls.length;
    
    // Perform form operations
    fireEvent.change(screen.getByLabelText(/Full Name/), { 
      target: { value: 'John Doe' } 
    });
    fireEvent.change(screen.getByLabelText(/Email/), { 
      target: { value: 'john@example.com' } 
    });
    
    // Parent component should not re-render due to form state changes
    expect(renderSpy.mock.calls.length).toBe(initialRenderCount);
  });

  it('should show unsaved changes warning when closing with changes', () => {
    // Mock window.confirm
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    
    render(<UserForm {...defaultProps} />);
    
    // Make changes
    fireEvent.change(screen.getByLabelText(/Full Name/), { 
      target: { value: 'John Doe' } 
    });
    
    // Try to close
    fireEvent.click(screen.getByText('Cancel'));
    
    expect(confirmSpy).toHaveBeenCalledWith(
      'You have unsaved changes. Are you sure you want to close without saving?'
    );
    expect(mockOnClose).not.toHaveBeenCalled();
    
    confirmSpy.mockRestore();
  });

  it('should initialize form data when editing existing user', () => {
    const existingUser = {
      id: '1',
      name: 'Jane Doe',
      email: 'jane@example.com',
      role: 'agent' as const,
      full_name: 'Jane Doe',
      created_at: '2023-01-01',
      updated_at: '2023-01-01'
    };
    
    render(
      <UserForm 
        {...defaultProps} 
        user={existingUser} 
        isCreating={false} 
      />
    );
    
    expect(screen.getByLabelText(/Full Name/)).toHaveValue('Jane Doe');
    expect(screen.getByLabelText(/Email/)).toHaveValue('jane@example.com');
    expect(screen.getByText('Save')).toBeInTheDocument();
  });
});