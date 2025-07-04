import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@/test/utils/test-utils';
import { CreateTicketDialog } from './dialogs/CreateTicketDialog';
import { mockSupabase } from '@/test/utils/test-utils';
import { supabase } from '@/lib/supabase';

vi.mock('@/lib/supabase', () => ({
  supabase: mockSupabase
}));

const mockCategories = [
  {
    id: 1,
    name: 'IT Support',
    description: 'IT related issues',
    is_enabled: true,
    subcategories: [
      {
        id: 1,
        name: 'Hardware Issues',
        response_time_hours: 4,
        resolution_time_hours: 24
      }
    ]
  }
];

describe('CreateTicketDialog Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase.from().select().mockResolvedValue({ data: mockCategories, error: null });
  });

  it('renders ticket creation form correctly', async () => {
    render(<CreateTicketDialog open={true} onOpenChange={() => {}} />);
    
    await waitFor(() => {
      expect(screen.getByLabelText(/title/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/category/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /create ticket/i })).toBeInTheDocument();
    });
  });

  it('validates required fields', async () => {
    render(<CreateTicketDialog open={true} onOpenChange={() => {}} />);
    
    const submitButton = screen.getByRole('button', { name: /create ticket/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/title is required/i)).toBeInTheDocument();
      expect(screen.getByText(/description is required/i)).toBeInTheDocument();
      expect(screen.getByText(/category is required/i)).toBeInTheDocument();
    });
  });

  it('loads categories and subcategories', async () => {
    render(<CreateTicketDialog open={true} onOpenChange={() => {}} />);
    
    await waitFor(() => {
      expect(screen.getByText('IT Support')).toBeInTheDocument();
    });

    const categorySelect = screen.getByLabelText(/category/i);
    fireEvent.change(categorySelect, { target: { value: '1' } });

    await waitFor(() => {
      expect(screen.getByText('Hardware Issues')).toBeInTheDocument();
    });
  });

  it('creates a ticket successfully', async () => {
    mockSupabase.from().insert().mockResolvedValue({
      data: [{
        id: 1,
        ticket_number: 'TK-2024-001',
        title: 'Test Ticket',
        description: 'Test Description',
        category_id: 1,
        subcategory_id: 1,
        status: 'open'
      }],
      error: null
    });

    const onSuccessMock = vi.fn();
    render(<CreateTicketDialog open={true} onOpenChange={() => {}} onSuccess={onSuccessMock} />);
    
    // Fill form
    fireEvent.change(screen.getByLabelText(/title/i), {
      target: { value: 'Test Ticket' }
    });
    fireEvent.change(screen.getByLabelText(/description/i), {
      target: { value: 'Test Description' }
    });
    fireEvent.change(screen.getByLabelText(/category/i), {
      target: { value: '1' }
    });
    await waitFor(() => {
      fireEvent.change(screen.getByLabelText(/subcategory/i), {
        target: { value: '1' }
      });
    });

    // Submit form
    fireEvent.click(screen.getByRole('button', { name: /create ticket/i }));

    await waitFor(() => {
      expect(onSuccessMock).toHaveBeenCalled();
      expect(mockSupabase.from().insert).toHaveBeenCalledWith({
        title: 'Test Ticket',
        description: 'Test Description',
        category_id: 1,
        subcategory_id: 1
      });
    });
  });

  it('handles file attachments', async () => {
    render(<CreateTicketDialog open={true} onOpenChange={() => {}} />);
    
    const file = new File(['test'], 'test.txt', { type: 'text/plain' });
    const input = screen.getByLabelText(/attachments/i);
    
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText('test.txt')).toBeInTheDocument();
    });
  });

  it('shows error message on API failure', async () => {
    mockSupabase.from().insert().mockResolvedValue({
      data: null,
      error: { message: 'Failed to create ticket' }
    });

    render(<CreateTicketDialog open={true} onOpenChange={() => {}} />);
    
    // Fill form
    fireEvent.change(screen.getByLabelText(/title/i), {
      target: { value: 'Test Ticket' }
    });
    fireEvent.change(screen.getByLabelText(/description/i), {
      target: { value: 'Test Description' }
    });
    fireEvent.change(screen.getByLabelText(/category/i), {
      target: { value: '1' }
    });

    // Submit form
    fireEvent.click(screen.getByRole('button', { name: /create ticket/i }));

    await waitFor(() => {
      expect(screen.getByText(/failed to create ticket/i)).toBeInTheDocument();
    });
  });

  it('validates file size and type', async () => {
    render(<CreateTicketDialog open={true} onOpenChange={() => {}} />);
    
    const largeFile = new File(['x'.repeat(5 * 1024 * 1024)], 'large.txt', { type: 'text/plain' });
    const input = screen.getByLabelText(/attachments/i);
    
    fireEvent.change(input, { target: { files: [largeFile] } });

    await waitFor(() => {
      expect(screen.getByText(/file size exceeds/i)).toBeInTheDocument();
    });
  });
}); 