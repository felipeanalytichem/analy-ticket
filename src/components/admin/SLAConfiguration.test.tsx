import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@/test/utils/test-utils';
import { SLAConfiguration } from './SLAConfiguration';
import { mockSupabase, simulateAuthState } from '@/test/utils/test-utils';
import { supabase } from '@/lib/supabase';

vi.mock('@/lib/supabase', () => ({
  supabase: mockSupabase
}));

describe('SLAConfiguration Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
  });

  it('renders all priority levels with default values', () => {
    render(<SLAConfiguration />);
    
    // Check priority labels
    expect(screen.getByText(/🔴 Crítica/)).toBeInTheDocument();
    expect(screen.getByText(/🟠 Alta/)).toBeInTheDocument();
    expect(screen.getByText(/🟡 Média/)).toBeInTheDocument();
    expect(screen.getByText(/🟢 Baixa/)).toBeInTheDocument();

    // Check default values for urgent priority
    const urgentSection = screen.getByText(/🔴 Crítica/).closest('div');
    expect(urgentSection).toBeInTheDocument();
    expect(urgentSection?.textContent).toContain('1h'); // Response time
    expect(urgentSection?.textContent).toContain('4h'); // Resolution time
    expect(urgentSection?.textContent).toContain('0.5h'); // Escalation time
  });

  it('allows editing SLA values', async () => {
    render(<SLAConfiguration />);
    
    // Click edit button for urgent priority
    const editButtons = screen.getAllByText('Editar');
    fireEvent.click(editButtons[0]);

    // Find input fields
    const inputs = screen.getAllByRole('spinbutton');
    expect(inputs).toHaveLength(3);

    // Change values
    fireEvent.change(inputs[0], { target: { value: '2' } }); // Response time
    fireEvent.change(inputs[1], { target: { value: '6' } }); // Resolution time
    fireEvent.change(inputs[2], { target: { value: '1' } }); // Escalation time

    // Save changes
    const saveButton = screen.getByText('Salvar');
    fireEvent.click(saveButton);

    // Verify new values are displayed
    await waitFor(() => {
      const urgentSection = screen.getByText(/🔴 Crítica/).closest('div');
      expect(urgentSection?.textContent).toContain('2h');
      expect(urgentSection?.textContent).toContain('6h');
      expect(urgentSection?.textContent).toContain('1h');
    });

    // Verify toast message
    expect(screen.getByText(/Configuration for 🔴 Crítica priority was saved successfully/)).toBeInTheDocument();
  });

  it('validates input values', async () => {
    render(<SLAConfiguration />);
    
    // Click edit button for urgent priority
    const editButtons = screen.getAllByText('Editar');
    fireEvent.click(editButtons[0]);

    // Find input fields
    const inputs = screen.getAllByRole('spinbutton');

    // Try to set invalid values
    fireEvent.change(inputs[0], { target: { value: '0' } }); // Response time below minimum
    fireEvent.change(inputs[1], { target: { value: '0' } }); // Resolution time below minimum
    fireEvent.change(inputs[2], { target: { value: '0' } }); // Escalation time below minimum

    // Save changes
    const saveButton = screen.getByText('Salvar');
    fireEvent.click(saveButton);

    // Verify validation messages
    await waitFor(() => {
      expect(inputs[0]).toHaveAttribute('min', '0.5');
      expect(inputs[1]).toHaveAttribute('min', '1');
      expect(inputs[2]).toHaveAttribute('min', '0.25');
    });
  });

  it('allows canceling edits', async () => {
    render(<SLAConfiguration />);
    
    // Get original values
    const urgentSection = screen.getByText(/🔴 Crítica/).closest('div');
    const originalValues = {
      responseTime: '1h',
      resolutionTime: '4h',
      escalationTime: '0.5h'
    };

    // Click edit button
    const editButtons = screen.getAllByText('Editar');
    fireEvent.click(editButtons[0]);

    // Change values
    const inputs = screen.getAllByRole('spinbutton');
    fireEvent.change(inputs[0], { target: { value: '2' } });
    fireEvent.change(inputs[1], { target: { value: '6' } });
    fireEvent.change(inputs[2], { target: { value: '1' } });

    // Cancel changes
    const cancelButton = screen.getByText('Cancelar');
    fireEvent.click(cancelButton);

    // Verify original values are preserved
    await waitFor(() => {
      expect(urgentSection?.textContent).toContain(originalValues.responseTime);
      expect(urgentSection?.textContent).toContain(originalValues.resolutionTime);
      expect(urgentSection?.textContent).toContain(originalValues.escalationTime);
    });
  });

  it('resets to default values', async () => {
    render(<SLAConfiguration />);
    
    // Change some values first
    const editButtons = screen.getAllByText('Editar');
    fireEvent.click(editButtons[0]);

    const inputs = screen.getAllByRole('spinbutton');
    fireEvent.change(inputs[0], { target: { value: '2' } });
    fireEvent.change(inputs[1], { target: { value: '6' } });
    fireEvent.change(inputs[2], { target: { value: '1' } });

    const saveButton = screen.getByText('Salvar');
    fireEvent.click(saveButton);

    // Click reset button
    const resetButton = screen.getByText('Restaurar Padrões');
    fireEvent.click(resetButton);

    // Verify default values are restored
    await waitFor(() => {
      const urgentSection = screen.getByText(/🔴 Crítica/).closest('div');
      expect(urgentSection?.textContent).toContain('1h'); // Default response time
      expect(urgentSection?.textContent).toContain('4h'); // Default resolution time
      expect(urgentSection?.textContent).toContain('0.5h'); // Default escalation time
    });

    // Verify toast message
    expect(screen.getByText(/Todas as configurações de SLA foram restauradas para os valores padrão/)).toBeInTheDocument();
  });

  it('displays help information', () => {
    render(<SLAConfiguration />);
    
    expect(screen.getByText(/Response Time:/)).toBeInTheDocument();
    expect(screen.getByText(/Resolution Time:/)).toBeInTheDocument();
    expect(screen.getByText(/Escalation Time:/)).toBeInTheDocument();
    
    expect(screen.getByText(/Maximum time for first response to ticket/)).toBeInTheDocument();
    expect(screen.getByText(/Maximum time for complete ticket resolution/)).toBeInTheDocument();
    expect(screen.getByText(/Time after which the ticket is automatically escalated if no response/)).toBeInTheDocument();
  });
}); 