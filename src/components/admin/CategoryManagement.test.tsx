import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@/test/utils/test-utils';
import { CategoryManagement } from '@/components/admin/CategoryManagement';
import { mockSupabase, simulateAuthState } from '@/test/utils/test-utils';
import { supabase } from '@/lib/supabase';

vi.mock('@/lib/supabase', () => ({
  supabase: mockSupabase
}));

const mockCategories = [
  {
    id: 1,
    name: 'IT Support',
    description: 'IT related issues',
    color: '#3B82F6',
    icon: 'computer',
    sort_order: 1,
    is_enabled: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 2,
    name: 'HR',
    description: 'Human Resources',
    color: '#10B981',
    icon: 'users',
    sort_order: 2,
    is_enabled: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
];

const mockSubcategories = [
  {
    id: 1,
    category_id: 1,
    name: 'Hardware Issues',
    description: 'Computer hardware problems',
    response_time_hours: 4,
    resolution_time_hours: 24,
    sort_order: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 2,
    category_id: 1,
    name: 'Software Issues',
    description: 'Software and applications',
    response_time_hours: 2,
    resolution_time_hours: 8,
    sort_order: 2,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
];

describe('CategoryManagement Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Simulate authenticated admin user
    simulateAuthState(true);
    mockSupabase.auth.getUser.mockResolvedValue({
      data: {
        user: {
          ...mockSupabase.auth.getUser().data.user,
          role: 'admin'
        }
      },
      error: null
    });

    // Setup category and subcategory mocks
    mockSupabase.from.mockImplementation((table) => ({
      select: vi.fn().mockImplementation(() => {
        const data = table === 'categories' ? mockCategories : mockSubcategories;
        return Promise.resolve({ data, error: null });
      }),
      insert: vi.fn().mockImplementation((data) => {
        return Promise.resolve({
          data: Array.isArray(data) ? data : [{ ...data, id: Math.random() }],
          error: null
        });
      }),
      update: vi.fn().mockImplementation((data) => {
        return Promise.resolve({ data, error: null });
      }),
      delete: vi.fn().mockResolvedValue({ error: null }),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      throwOnError: vi.fn().mockReturnThis(),
    }));
  });

  it('renders categories and subcategories', async () => {
    render(<CategoryManagement />);
    
    await waitFor(() => {
      expect(screen.getByText('IT Support')).toBeInTheDocument();
      expect(screen.getByText('HR')).toBeInTheDocument();
      expect(screen.getByText('Hardware Issues')).toBeInTheDocument();
      expect(screen.getByText('Software Issues')).toBeInTheDocument();
    });
  });

  it('creates a new category', async () => {
    const newCategory = {
      id: 3,
      name: 'Finance',
      description: 'Financial issues',
      color: '#EF4444',
      icon: 'dollar',
      sort_order: 3,
      is_enabled: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    mockSupabase.from().insert.mockResolvedValueOnce({
      data: [newCategory],
      error: null
    });

    render(<CategoryManagement />);
    
    const addButton = screen.getByRole('button', { name: /add category/i });
    fireEvent.click(addButton);

    const nameInput = screen.getByLabelText(/category name/i);
    const descInput = screen.getByLabelText(/description/i);
    const colorInput = screen.getByLabelText(/color/i);
    const iconInput = screen.getByLabelText(/icon/i);

    fireEvent.change(nameInput, { target: { value: 'Finance' } });
    fireEvent.change(descInput, { target: { value: 'Financial issues' } });
    fireEvent.change(colorInput, { target: { value: '#EF4444' } });
    fireEvent.change(iconInput, { target: { value: 'dollar' } });

    const saveButton = screen.getByRole('button', { name: /save/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText('Finance')).toBeInTheDocument();
      expect(mockSupabase.from().insert).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Finance',
          description: 'Financial issues',
          color: '#EF4444',
          icon: 'dollar'
        })
      );
    });
  });

  it('updates category status', async () => {
    render(<CategoryManagement />);
    
    await waitFor(() => {
      expect(screen.getByText('IT Support')).toBeInTheDocument();
    });

    const toggleButton = screen.getByRole('switch', { name: /it support status/i });
    fireEvent.click(toggleButton);

    await waitFor(() => {
      expect(mockSupabase.from().update).toHaveBeenCalledWith(
        expect.objectContaining({
          is_enabled: false
        })
      );
    });
  });

  it('updates subcategory SLA times', async () => {
    render(<CategoryManagement />);
    
    await waitFor(() => {
      expect(screen.getByText('Hardware Issues')).toBeInTheDocument();
    });

    const editButton = screen.getByRole('button', { name: /edit hardware issues/i });
    fireEvent.click(editButton);

    const responseTimeInput = screen.getByLabelText(/response time/i);
    const resolutionTimeInput = screen.getByLabelText(/resolution time/i);

    fireEvent.change(responseTimeInput, { target: { value: '6' } });
    fireEvent.change(resolutionTimeInput, { target: { value: '48' } });

    const saveButton = screen.getByRole('button', { name: /save changes/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockSupabase.from().update).toHaveBeenCalledWith(
        expect.objectContaining({
          response_time_hours: 6,
          resolution_time_hours: 48
        })
      );
    });
  });

  it('deletes a subcategory', async () => {
    render(<CategoryManagement />);
    
    await waitFor(() => {
      expect(screen.getByText('Hardware Issues')).toBeInTheDocument();
    });

    const deleteButton = screen.getByRole('button', { name: /delete hardware issues/i });
    fireEvent.click(deleteButton);

    const confirmButton = screen.getByRole('button', { name: /confirm delete/i });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(mockSupabase.from().delete).toHaveBeenCalled();
      expect(screen.queryByText('Hardware Issues')).not.toBeInTheDocument();
    });
  });

  it('reorders categories', async () => {
    render(<CategoryManagement />);
    
    await waitFor(() => {
      expect(screen.getByText('IT Support')).toBeInTheDocument();
      expect(screen.getByText('HR')).toBeInTheDocument();
    });

    const moveUpButton = screen.getByRole('button', { name: /move hr up/i });
    fireEvent.click(moveUpButton);

    await waitFor(() => {
      expect(mockSupabase.from().update).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ id: 2, sort_order: 1 }),
          expect.objectContaining({ id: 1, sort_order: 2 })
        ])
      );
    });
  });

  it('handles API errors gracefully', async () => {
    // Mock API error
    mockSupabase.from.mockImplementationOnce(() => ({
      select: vi.fn().mockRejectedValue(new Error('Failed to load categories'))
    }));

    render(<CategoryManagement />);

    await waitFor(() => {
      expect(screen.getByText(/failed to load categories/i)).toBeInTheDocument();
    });
  });

  it('validates required fields when creating category', async () => {
    render(<CategoryManagement />);
    
    const addButton = screen.getByRole('button', { name: /add category/i });
    fireEvent.click(addButton);

    const saveButton = screen.getByRole('button', { name: /save/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText(/name is required/i)).toBeInTheDocument();
      expect(screen.getByText(/description is required/i)).toBeInTheDocument();
    });
  });

  it('validates SLA times when updating subcategory', async () => {
    render(<CategoryManagement />);
    
    await waitFor(() => {
      expect(screen.getByText('Hardware Issues')).toBeInTheDocument();
    });

    const editButton = screen.getByRole('button', { name: /edit hardware issues/i });
    fireEvent.click(editButton);

    const responseTimeInput = screen.getByLabelText(/response time/i);
    const resolutionTimeInput = screen.getByLabelText(/resolution time/i);

    fireEvent.change(responseTimeInput, { target: { value: '-1' } });
    fireEvent.change(resolutionTimeInput, { target: { value: '0' } });

    const saveButton = screen.getByRole('button', { name: /save changes/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText(/response time must be positive/i)).toBeInTheDocument();
      expect(screen.getByText(/resolution time must be positive/i)).toBeInTheDocument();
    });
  });
}); 