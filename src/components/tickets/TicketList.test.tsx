import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@/test/utils/test-utils';
import { TicketList } from '@/components/tickets/TicketList';
import { mockSupabase } from '@/test/utils/test-utils';
import { supabase } from '@/lib/supabase';

vi.mock('@/lib/supabase', () => ({
  supabase: mockSupabase
}));

const mockTickets = [
  {
    id: 1,
    ticket_number: 'TK-2024-001',
    title: 'Network Issue',
    description: 'Unable to connect to VPN',
    status: 'open',
    priority: 'high',
    category_id: 1,
    subcategory_id: 1,
    created_at: '2024-03-20T10:00:00Z',
    created_by: 'user123',
    assigned_to: 'agent123'
  },
  {
    id: 2,
    ticket_number: 'TK-2024-002',
    title: 'Software Installation',
    description: 'Need MS Office installed',
    status: 'pending',
    priority: 'medium',
    category_id: 2,
    subcategory_id: 2,
    created_at: '2024-03-20T11:00:00Z',
    created_by: 'user456',
    assigned_to: null
  }
];

describe('TicketList Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase.from().select().mockResolvedValue({ data: mockTickets, error: null });
  });

  it('renders ticket list correctly', async () => {
    render(<TicketList />);
    
    await waitFor(() => {
      expect(screen.getByText('TK-2024-001')).toBeInTheDocument();
      expect(screen.getByText('Network Issue')).toBeInTheDocument();
      expect(screen.getByText('TK-2024-002')).toBeInTheDocument();
      expect(screen.getByText('Software Installation')).toBeInTheDocument();
    });
  });

  it('displays loading state', () => {
    mockSupabase.from().select().mockImplementation(() => new Promise(() => {}));
    render(<TicketList />);
    
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('handles empty ticket list', async () => {
    mockSupabase.from().select().mockResolvedValue({ data: [], error: null });
    render(<TicketList />);
    
    await waitFor(() => {
      expect(screen.getByText(/no tickets found/i)).toBeInTheDocument();
    });
  });

  it('handles error state', async () => {
    mockSupabase.from().select().mockResolvedValue({ 
      data: null, 
      error: { message: 'Failed to fetch tickets' } 
    });
    
    render(<TicketList />);
    
    await waitFor(() => {
      expect(screen.getByText(/failed to fetch tickets/i)).toBeInTheDocument();
    });
  });

  it('filters tickets by status', async () => {
    render(<TicketList />);
    
    await waitFor(() => {
      expect(screen.getByText('TK-2024-001')).toBeInTheDocument();
    });

    const statusFilter = screen.getByRole('combobox', { name: /status/i });
    fireEvent.change(statusFilter, { target: { value: 'pending' } });

    await waitFor(() => {
      expect(screen.queryByText('TK-2024-001')).not.toBeInTheDocument();
      expect(screen.getByText('TK-2024-002')).toBeInTheDocument();
    });
  });

  it('sorts tickets by date', async () => {
    render(<TicketList />);
    
    const sortButton = screen.getByRole('button', { name: /sort/i });
    fireEvent.click(sortButton);

    await waitFor(() => {
      const tickets = screen.getAllByRole('row');
      expect(tickets[1]).toHaveTextContent('TK-2024-002');
      expect(tickets[2]).toHaveTextContent('TK-2024-001');
    });
  });

  it('handles ticket selection', async () => {
    render(<TicketList />);
    
    await waitFor(() => {
      expect(screen.getByText('TK-2024-001')).toBeInTheDocument();
    });

    const ticketRow = screen.getByText('TK-2024-001').closest('tr');
    fireEvent.click(ticketRow);

    expect(window.location.pathname).toBe('/tickets/1');
  });
}); 