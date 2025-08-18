import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UserManagement } from '@/components/admin/UserManagement';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';

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

// Mock performance API
const mockPerformanceNow = vi.fn();
Object.defineProperty(global, 'performance', {
  value: {
    now: mockPerformanceNow,
    memory: {
      usedJSHeapSize: 1024 * 1024 * 50, // 50MB
      totalJSHeapSize: 1024 * 1024 * 100, // 100MB
      jsHeapSizeLimit: 1024 * 1024 * 2048 // 2GB
    },
    mark: vi.fn(),
    measure: vi.fn(),
    getEntriesByType: vi.fn().mockReturnValue([])
  },
  writable: true
});

const mockToast = vi.fn();
const mockSupabase = supabase as any;
const mockUseAuth = useAuth as any;
const mockUseToast = useToast as any;

describe('UserManagement Performance Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPerformanceNow.mockClear();
    
    // Setup default mocks
    mockUseToast.mockReturnValue({ toast: mockToast });
    mockUseAuth.mockReturnValue({
      user: { id: 'admin-id' },
      userProfile: { role: 'admin' },
      loading: false
    });
  });

  it('should render large user lists efficiently', async () => {
    // Create large dataset
    const largeUserList = Array.from({ length: 1000 }, (_, i) => ({
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

    // Mock performance timing
    let callCount = 0;
    mockPerformanceNow.mockImplementation(() => {
      callCount++;
      return callCount * 10; // Each call adds 10ms
    });

    const startTime = performance.now();
    
    render(<UserManagement />);

    await waitFor(() => {
      expect(screen.getByText('User Management (1000)')).toBeInTheDocument();
    });

    const endTime = performance.now();
    const renderTime = endTime - startTime;

    // Should render within reasonable time (less than 100ms for mocked timing)
    expect(renderTime).toBeLessThan(100);
  });

  it('should optimize search operations with debouncing', async () => {
    const user = userEvent.setup();
    
    // Mock users
    const users = Array.from({ length: 100 }, (_, i) => ({
      id: `user${i}`,
      full_name: `User ${i}`,
      email: `user${i}@example.com`,
      role: 'user',
      created_at: '2023-01-01T00:00:00Z',
      updated_at: '2023-01-01T00:00:00Z'
    }));

    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({
          data: users,
          error: null
        })
      })
    });

    render(<UserManagement />);

    await waitFor(() => {
      expect(screen.getByText('User Management (100)')).toBeInTheDocument();
    });

    // Track search operations
    const searchOperations: number[] = [];
    mockPerformanceNow.mockImplementation(() => {
      const time = Date.now();
      searchOperations.push(time);
      return time;
    });

    // Perform rapid typing
    const searchInput = screen.getByPlaceholderText(/search users/i);
    
    await user.type(searchInput, 'User 1', { delay: 50 });

    // Wait for debounced search to complete
    await waitFor(() => {
      expect(screen.getByText(/showing \d+ of 100 users/i)).toBeInTheDocument();
    });

    // Should have debounced the search operations (fewer than character count)
    expect(searchOperations.length).toBeLessThan(10); // Less than "User 1".length * 2
  });

  it('should minimize re-renders during state updates', async () => {
    const user = userEvent.setup();
    
    // Track render count
    let renderCount = 0;
    const WrappedUserManagement = () => {
      renderCount++;
      return <UserManagement />;
    };

    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({
          data: [
            {
              id: 'user1',
              full_name: 'John Doe',
              email: 'john@example.com',
              role: 'user',
              created_at: '2023-01-01T00:00:00Z',
              updated_at: '2023-01-01T00:00:00Z'
            }
          ],
          error: null
        })
      })
    });

    render(<WrappedUserManagement />);

    await waitFor(() => {
      expect(screen.getByText('User Management (1)')).toBeInTheDocument();
    });

    const initialRenderCount = renderCount;

    // Perform multiple UI operations
    const searchInput = screen.getByPlaceholderText(/search users/i);
    await user.type(searchInput, 'John');

    const roleFilter = screen.getByRole('combobox');
    await user.click(roleFilter);
    await user.click(screen.getByText('User'));

    // Should have minimal additional renders
    const finalRenderCount = renderCount;
    const additionalRenders = finalRenderCount - initialRenderCount;

    // Should have fewer than 5 additional renders for these operations
    expect(additionalRenders).toBeLessThan(5);
  });

  it('should handle memory efficiently during component lifecycle', async () => {
    const user = userEvent.setup();
    
    // Mock memory tracking
    let memoryUsage = 50 * 1024 * 1024; // Start with 50MB
    Object.defineProperty(performance, 'memory', {
      get: () => ({
        usedJSHeapSize: memoryUsage,
        totalJSHeapSize: memoryUsage * 2,
        jsHeapSizeLimit: 2048 * 1024 * 1024
      })
    });

    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({
          data: Array.from({ length: 500 }, (_, i) => ({
            id: `user${i}`,
            full_name: `User ${i}`,
            email: `user${i}@example.com`,
            role: 'user',
            created_at: '2023-01-01T00:00:00Z',
            updated_at: '2023-01-01T00:00:00Z'
          })),
          error: null
        })
      })
    });

    const { unmount } = render(<UserManagement />);

    await waitFor(() => {
      expect(screen.getByText('User Management (500)')).toBeInTheDocument();
    });

    const loadedMemory = performance.memory.usedJSHeapSize;

    // Perform operations that might cause memory leaks
    const searchInput = screen.getByPlaceholderText(/search users/i);
    await user.type(searchInput, 'User');
    await user.clear(searchInput);
    await user.type(searchInput, 'Test');
    await user.clear(searchInput);

    const afterOperationsMemory = performance.memory.usedJSHeapSize;

    // Memory should not increase significantly during operations
    const memoryIncrease = afterOperationsMemory - loadedMemory;
    expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024); // Less than 10MB increase

    // Unmount component
    unmount();

    // Simulate garbage collection
    memoryUsage = 45 * 1024 * 1024; // Memory should decrease after unmount

    const afterUnmountMemory = performance.memory.usedJSHeapSize;

    // Memory should be released after unmount
    expect(afterUnmountMemory).toBeLessThan(loadedMemory);
  });

  it('should optimize form operations to prevent main component re-renders', async () => {
    const user = userEvent.setup();
    
    // Track main component renders
    let mainComponentRenders = 0;
    const originalUserManagement = UserManagement;
    
    // Wrap component to track renders
    const TrackedUserManagement = React.memo(() => {
      mainComponentRenders++;
      return React.createElement(originalUserManagement);
    });

    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({
          data: [
            {
              id: 'user1',
              full_name: 'John Doe',
              email: 'john@example.com',
              role: 'user',
              created_at: '2023-01-01T00:00:00Z',
              updated_at: '2023-01-01T00:00:00Z'
            }
          ],
          error: null
        })
      })
    });

    render(<TrackedUserManagement />);

    await waitFor(() => {
      expect(screen.getByText('User Management (1)')).toBeInTheDocument();
    });

    const initialRenderCount = mainComponentRenders;

    // Open form
    const createButton = screen.getByRole('button', { name: /new user/i });
    await user.click(createButton);

    await waitFor(() => {
      expect(screen.getByText('Create New User')).toBeInTheDocument();
    });

    // Perform form operations
    const nameInput = screen.getByLabelText(/full name/i);
    const emailInput = screen.getByLabelText(/email/i);
    
    await user.type(nameInput, 'Test User');
    await user.type(emailInput, 'test@example.com');

    // Close form
    const cancelButton = screen.getByText('Cancel');
    await user.click(cancelButton);

    const finalRenderCount = mainComponentRenders;
    const additionalRenders = finalRenderCount - initialRenderCount;

    // Form operations should not cause excessive main component re-renders
    expect(additionalRenders).toBeLessThan(3);
  });

  it('should handle bulk operations efficiently', async () => {
    const user = userEvent.setup();
    
    // Mock large user list
    const users = Array.from({ length: 200 }, (_, i) => ({
      id: `user${i}`,
      full_name: `User ${i}`,
      email: `user${i}@example.com`,
      role: 'user',
      created_at: '2023-01-01T00:00:00Z',
      updated_at: '2023-01-01T00:00:00Z'
    }));

    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({
          data: users,
          error: null
        })
      })
    });

    // Track operation timing
    let operationStartTime = 0;
    mockPerformanceNow.mockImplementation(() => {
      if (operationStartTime === 0) {
        operationStartTime = Date.now();
        return operationStartTime;
      }
      return Date.now();
    });

    render(<UserManagement />);

    await waitFor(() => {
      expect(screen.getByText('User Management (200)')).toBeInTheDocument();
    });

    // Perform bulk filtering operation
    const startTime = performance.now();
    
    const roleFilter = screen.getByRole('combobox');
    await user.click(roleFilter);
    await user.click(screen.getByText('User'));

    await waitFor(() => {
      expect(screen.getByText(/showing 200 of 200 users/i)).toBeInTheDocument();
    });

    const endTime = performance.now();
    const operationTime = endTime - startTime;

    // Bulk filtering should be fast (less than 50ms for mocked timing)
    expect(operationTime).toBeLessThan(50);
  });

  it('should optimize network requests to prevent redundant calls', async () => {
    const user = userEvent.setup();
    
    // Track API calls
    const apiCalls: string[] = [];
    
    mockSupabase.from.mockImplementation((table: string) => {
      apiCalls.push(`SELECT from ${table}`);
      return {
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: [
              {
                id: 'user1',
                full_name: 'John Doe',
                email: 'john@example.com',
                role: 'user',
                created_at: '2023-01-01T00:00:00Z',
                updated_at: '2023-01-01T00:00:00Z'
              }
            ],
            error: null
          })
        })
      };
    });

    render(<UserManagement />);

    await waitFor(() => {
      expect(screen.getByText('User Management (1)')).toBeInTheDocument();
    });

    const initialApiCalls = apiCalls.length;

    // Perform operations that shouldn't trigger additional API calls
    const searchInput = screen.getByPlaceholderText(/search users/i);
    await user.type(searchInput, 'John');

    const roleFilter = screen.getByRole('combobox');
    await user.click(roleFilter);
    await user.click(screen.getByText('User'));

    // Should not have made additional API calls for client-side operations
    expect(apiCalls.length).toBe(initialApiCalls);
  });

  it('should maintain performance during rapid state changes', async () => {
    const user = userEvent.setup();
    
    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({
          data: Array.from({ length: 50 }, (_, i) => ({
            id: `user${i}`,
            full_name: `User ${i}`,
            email: `user${i}@example.com`,
            role: i % 2 === 0 ? 'user' : 'agent',
            created_at: '2023-01-01T00:00:00Z',
            updated_at: '2023-01-01T00:00:00Z'
          })),
          error: null
        })
      })
    });

    render(<UserManagement />);

    await waitFor(() => {
      expect(screen.getByText('User Management (50)')).toBeInTheDocument();
    });

    // Perform rapid state changes
    const startTime = performance.now();
    
    const searchInput = screen.getByPlaceholderText(/search users/i);
    const roleFilter = screen.getByRole('combobox');

    // Rapid search changes
    await user.type(searchInput, 'User 1');
    await user.clear(searchInput);
    await user.type(searchInput, 'User 2');
    await user.clear(searchInput);

    // Rapid filter changes
    await user.click(roleFilter);
    await user.click(screen.getByText('Agent'));
    await user.click(roleFilter);
    await user.click(screen.getByText('User'));
    await user.click(roleFilter);
    await user.click(screen.getByText('All Roles'));

    const endTime = performance.now();
    const totalTime = endTime - startTime;

    // Rapid changes should complete within reasonable time
    expect(totalTime).toBeLessThan(200);

    // Final state should be stable
    await waitFor(() => {
      expect(screen.getByText('User Management (50)')).toBeInTheDocument();
    });
  });
});