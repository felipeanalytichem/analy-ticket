import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UserManagement } from '@/components/admin/UserManagement';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { adminService } from '@/lib/adminService';

// Mock dependencies
vi.mock('@/integrations/supabase/client');
vi.mock('@/contexts/AuthContext');
vi.mock('@/components/ui/use-toast');
vi.mock('@/lib/adminService');
vi.mock('@/lib/emailService');
vi.mock('@/lib/utils', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    transformUserName: vi.fn((fullName, email) => fullName || email?.split('@')[0] || 'No name provided')
  };
});

const mockToast = vi.fn();
const mockSupabase = supabase as any;
const mockUseAuth = useAuth as any;
const mockUseToast = useToast as any;
const mockAdminService = adminService as any;

describe('UserManagement Workflow Integration Tests', () => {
  const mockUsers = [
    { 
      id: 'user1', 
      full_name: 'John Doe', 
      email: 'john@example.com', 
      role: 'user',
      created_at: '2023-01-01T00:00:00Z',
      updated_at: '2023-01-01T00:00:00Z'
    },
    { 
      id: 'user2', 
      full_name: 'Jane Smith', 
      email: 'jane@example.com', 
      role: 'agent',
      created_at: '2023-01-02T00:00:00Z',
      updated_at: '2023-01-02T00:00:00Z'
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup default mocks
    mockUseToast.mockReturnValue({ toast: mockToast });
    mockUseAuth.mockReturnValue({
      user: { id: 'admin-id' },
      userProfile: { role: 'admin' },
      loading: false
    });

    // Mock successful user loading by default
    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({
          data: mockUsers,
          error: null
        }),
        eq: vi.fn().mockReturnValue({
          update: vi.fn().mockResolvedValue({ error: null }),
          delete: vi.fn().mockResolvedValue({ error: null })
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null })
        }),
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null })
        }),
        limit: vi.fn().mockResolvedValue({ data: [], error: null })
      })
    });

    // Mock auth admin methods
    mockSupabase.auth = {
      admin: {
        updateUserById: vi.fn().mockResolvedValue({ error: null })
      }
    };
  });

  it('should complete full user creation workflow without flickering', async () => {
    const user = userEvent.setup();
    
    // Mock admin service for user creation
    mockAdminService.createUser = vi.fn().mockResolvedValue({
      user: {
        id: 'new-user-id',
        full_name: 'New User',
        email: 'newuser@example.com',
        role: 'user',
        created_at: '2023-01-03T00:00:00Z',
        updated_at: '2023-01-03T00:00:00Z'
      },
      temporaryPassword: 'temp123'
    });

    render(<UserManagement />);

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByText('User Management (2)')).toBeInTheDocument();
    });

    // Start user creation workflow
    const createButton = screen.getByRole('button', { name: /new user/i });
    await user.click(createButton);

    // Form should open
    await waitFor(() => {
      expect(screen.getByText('Create New User')).toBeInTheDocument();
    });

    // Fill form
    const nameInput = screen.getByLabelText(/full name/i);
    const emailInput = screen.getByLabelText(/email/i);
    
    await user.type(nameInput, 'New User');
    await user.type(emailInput, 'newuser@example.com');

    // Submit form
    const submitButton = screen.getByRole('button', { name: /create/i });
    await user.click(submitButton);

    // Should show success and password dialog
    await waitFor(() => {
      expect(screen.getByText('User Created - Invitation Instructions')).toBeInTheDocument();
      expect(screen.getByDisplayValue('temp123')).toBeInTheDocument();
    });

    // User should be added to list optimistically
    expect(screen.getByText('User Management (3)')).toBeInTheDocument();
    expect(screen.getByText('New User')).toBeInTheDocument();

    // Close password dialog
    const closeButton = screen.getByText('I Understand');
    await user.click(closeButton);

    // Dialog should close and form should be reset
    await waitFor(() => {
      expect(screen.queryByText('User Created - Invitation Instructions')).not.toBeInTheDocument();
      expect(screen.queryByText('Create New User')).not.toBeInTheDocument();
    });

    // Verify admin service was called correctly
    expect(mockAdminService.createUser).toHaveBeenCalledWith({
      email: 'newuser@example.com',
      name: 'New User',
      role: 'user',
      generateTempPassword: false
    });
  });

  it('should complete full user editing workflow with stable state transitions', async () => {
    const user = userEvent.setup();

    render(<UserManagement />);

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByText('User Management (2)')).toBeInTheDocument();
    });

    // Find and click edit button for first user
    const editButtons = screen.getAllByTitle(/edit user/i);
    await user.click(editButtons[0]);

    // Form should open with existing data
    await waitFor(() => {
      expect(screen.getByText('Edit User')).toBeInTheDocument();
      expect(screen.getByDisplayValue('John Doe')).toBeInTheDocument();
      expect(screen.getByDisplayValue('john@example.com')).toBeInTheDocument();
    });

    // Modify user data
    const nameInput = screen.getByDisplayValue('John Doe');
    await user.clear(nameInput);
    await user.type(nameInput, 'John Updated');

    // Submit changes
    const saveButton = screen.getByRole('button', { name: /save/i });
    await user.click(saveButton);

    // Should show success toast
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        title: "User Updated",
        description: "User details have been successfully updated.",
      });
    });

    // User should be updated in list optimistically
    expect(screen.getByText('John Updated')).toBeInTheDocument();
    expect(screen.queryByText('John Doe')).not.toBeInTheDocument();

    // Form should close
    await waitFor(() => {
      expect(screen.queryByText('Edit User')).not.toBeInTheDocument();
    });
  });

  it('should handle user deletion workflow with confirmation', async () => {
    const user = userEvent.setup();

    render(<UserManagement />);

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByText('User Management (2)')).toBeInTheDocument();
    });

    // Find and click delete button for first user
    const deleteButtons = screen.getAllByTitle(/delete user/i);
    await user.click(deleteButtons[0]);

    // Confirmation dialog should appear
    await waitFor(() => {
      expect(screen.getByText('Confirm Removal')).toBeInTheDocument();
      expect(screen.getByText('Are you sure you want to remove this user?')).toBeInTheDocument();
    });

    // Confirm deletion
    const confirmButton = screen.getByRole('button', { name: /remove/i });
    await user.click(confirmButton);

    // Should show success toast
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        title: "User Removed",
        description: "User has been removed successfully.",
      });
    });

    // User should be removed from list
    expect(screen.getByText('User Management (1)')).toBeInTheDocument();
    expect(screen.queryByText('John Doe')).not.toBeInTheDocument();

    // Dialog should close
    await waitFor(() => {
      expect(screen.queryByText('Confirm Removal')).not.toBeInTheDocument();
    });
  });

  it('should handle search and filter workflows smoothly', async () => {
    const user = userEvent.setup();

    render(<UserManagement />);

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByText('User Management (2)')).toBeInTheDocument();
    });

    // Test search functionality
    const searchInput = screen.getByPlaceholderText(/search users/i);
    await user.type(searchInput, 'John');

    // Should show filtered results
    await waitFor(() => {
      expect(screen.getByText('Showing 1 of 2 users for "John"')).toBeInTheDocument();
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.queryByText('Jane Smith')).not.toBeInTheDocument();
    });

    // Clear search
    await user.clear(searchInput);

    // Should show all users again
    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    });

    // Test role filter
    const roleFilter = screen.getByRole('combobox');
    await user.click(roleFilter);
    
    const agentOption = screen.getByText('Agent');
    await user.click(agentOption);

    // Should show only agents
    await waitFor(() => {
      expect(screen.getByText('Jane Smith')).toBeInTheDocument();
      expect(screen.queryByText('John Doe')).not.toBeInTheDocument();
    });
  });

  it('should handle error recovery workflows gracefully', async () => {
    const user = userEvent.setup();

    // Mock initial success, then failure on update
    let callCount = 0;
    mockSupabase.from.mockImplementation(() => ({
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({
          data: mockUsers,
          error: null
        })
      }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 1) {
            return Promise.resolve({ error: new Error('Network error') });
          }
          return Promise.resolve({ error: null });
        })
      })
    }));

    render(<UserManagement />);

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByText('User Management (2)')).toBeInTheDocument();
    });

    // Try to edit user
    const editButtons = screen.getAllByTitle(/edit user/i);
    await user.click(editButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Edit User')).toBeInTheDocument();
    });

    // Modify and save
    const nameInput = screen.getByDisplayValue('John Doe');
    await user.clear(nameInput);
    await user.type(nameInput, 'John Updated');

    const saveButton = screen.getByRole('button', { name: /save/i });
    await user.click(saveButton);

    // Should show error toast
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Error Saving User",
          variant: "destructive",
        })
      );
    });

    // Form should remain open for retry
    expect(screen.getByText('Edit User')).toBeInTheDocument();

    // Try again - should succeed
    await user.click(saveButton);

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        title: "User Updated",
        description: "User details have been successfully updated.",
      });
    });
  });

  it('should handle concurrent operations without state conflicts', async () => {
    const user = userEvent.setup();

    render(<UserManagement />);

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByText('User Management (2)')).toBeInTheDocument();
    });

    // Start multiple operations simultaneously
    const createButton = screen.getByRole('button', { name: /new user/i });
    const editButtons = screen.getAllByTitle(/edit user/i);

    // Open create form
    await user.click(createButton);

    await waitFor(() => {
      expect(screen.getByText('Create New User')).toBeInTheDocument();
    });

    // Try to open edit form while create is open
    await user.click(editButtons[0]);

    // Should close create form and open edit form
    await waitFor(() => {
      expect(screen.queryByText('Create New User')).not.toBeInTheDocument();
      expect(screen.getByText('Edit User')).toBeInTheDocument();
    });

    // State should be stable
    expect(screen.getByText('User Management (2)')).toBeInTheDocument();
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
  });

  it('should maintain performance during bulk operations', async () => {
    const user = userEvent.setup();

    // Mock large user list
    const largeUserList = Array.from({ length: 100 }, (_, i) => ({
      id: `user${i}`,
      full_name: `User ${i}`,
      email: `user${i}@example.com`,
      role: i % 3 === 0 ? 'admin' : i % 2 === 0 ? 'agent' : 'user',
      created_at: '2023-01-01T00:00:00Z',
      updated_at: '2023-01-01T00:00:00Z'
    }));

    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({
          data: largeUserList,
          error: null
        })
      })
    });

    const startTime = performance.now();
    
    render(<UserManagement />);

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByText('User Management (100)')).toBeInTheDocument();
    });

    const loadTime = performance.now() - startTime;

    // Should load within reasonable time (less than 2 seconds)
    expect(loadTime).toBeLessThan(2000);

    // Test search performance with large dataset
    const searchStartTime = performance.now();
    
    const searchInput = screen.getByPlaceholderText(/search users/i);
    await user.type(searchInput, 'User 1');

    await waitFor(() => {
      expect(screen.getByText(/showing \d+ of 100 users/i)).toBeInTheDocument();
    });

    const searchTime = performance.now() - searchStartTime;

    // Search should be fast (less than 500ms)
    expect(searchTime).toBeLessThan(500);
  });
});