import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NotificationPreferences } from '../NotificationPreferences'
import { createDefaultNotificationPreferences } from '@/types/notifications'

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))

// Mock dependencies
vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, defaultValue?: string) => defaultValue || key
    })
}))

vi.mock('sonner', () => ({
    toast: {
        success: vi.fn(),
        error: vi.fn()
    }
}))

vi.mock('@/contexts/AuthContext', () => ({
    useAuth: () => ({
        user: { id: 'test-user-id' }
    })
}))

vi.mock('@/lib/notifications/PreferencesManager', () => ({
    preferencesManager: {
        getUserPreferences: vi.fn(),
        updateUserPreferences: vi.fn(),
        resetToDefaults: vi.fn()
    }
}))

import { preferencesManager } from '@/lib/notifications/PreferencesManager'
const mockPreferencesManager = preferencesManager as any

// Mock UI components that might cause issues in tests
vi.mock('@/components/ui/scroll-area', () => ({
    ScrollArea: ({ children }: { children: React.ReactNode }) => <div data-testid="scroll-area">{children}</div>
}))

describe('NotificationPreferences', () => {
    const mockUserId = 'test-user-id'
    const mockPreferences = createDefaultNotificationPreferences(mockUserId)

    beforeEach(() => {
        vi.clearAllMocks()
        mockPreferencesManager.getUserPreferences.mockResolvedValue(mockPreferences)
        mockPreferencesManager.updateUserPreferences.mockResolvedValue(mockPreferences)
        mockPreferencesManager.resetToDefaults.mockResolvedValue(mockPreferences)
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('should render loading state initially', async () => {
        mockPreferencesManager.getUserPreferences.mockImplementation(
            () => new Promise(resolve => setTimeout(() => resolve(mockPreferences), 100))
        )

        render(<NotificationPreferences />)

        expect(screen.getByText('Loading preferences...')).toBeInTheDocument()
    })

    it('should render preferences form after loading', async () => {
        render(<NotificationPreferences />)

        await waitFor(() => {
            expect(screen.getByText('Notification Preferences')).toBeInTheDocument()
        })

        expect(screen.getByText('General Settings')).toBeInTheDocument()
        expect(screen.getByText('Quiet Hours')).toBeInTheDocument()
        expect(screen.getByText('Language & Timezone')).toBeInTheDocument()
        expect(screen.getByText('Notification Types')).toBeInTheDocument()
    })

    it('should display general notification settings', async () => {
        render(<NotificationPreferences />)

        await waitFor(() => {
            expect(screen.getByText('Email Notifications')).toBeInTheDocument()
        })

        expect(screen.getByText('Browser Notifications')).toBeInTheDocument()
        expect(screen.getByText('Sound Notifications')).toBeInTheDocument()
    })

    it('should toggle email notifications', async () => {
        const user = userEvent.setup()
        render(<NotificationPreferences />)

        await waitFor(() => {
            expect(screen.getByText('Email Notifications')).toBeInTheDocument()
        })

        const emailSwitch = screen.getByRole('switch', { name: /email notifications/i })
        expect(emailSwitch).toBeChecked() // Default is true

        await user.click(emailSwitch)
        expect(emailSwitch).not.toBeChecked()

        // Should show unsaved changes badge
        expect(screen.getByText('Unsaved changes')).toBeInTheDocument()
    })

    it('should toggle toast notifications', async () => {
        const user = userEvent.setup()
        render(<NotificationPreferences />)

        await waitFor(() => {
            expect(screen.getByText('Browser Notifications')).toBeInTheDocument()
        })

        const toastSwitch = screen.getByRole('switch', { name: /browser notifications/i })
        expect(toastSwitch).toBeChecked() // Default is true

        await user.click(toastSwitch)
        expect(toastSwitch).not.toBeChecked()
    })

    it('should toggle sound notifications', async () => {
        const user = userEvent.setup()
        render(<NotificationPreferences />)

        await waitFor(() => {
            expect(screen.getByText('Sound Notifications')).toBeInTheDocument()
        })

        const soundSwitch = screen.getByRole('switch', { name: /sound notifications/i })
        expect(soundSwitch).not.toBeChecked() // Default is false

        await user.click(soundSwitch)
        expect(soundSwitch).toBeChecked()
    })

    it('should enable and configure quiet hours', async () => {
        const user = userEvent.setup()
        render(<NotificationPreferences />)

        await waitFor(() => {
            expect(screen.getByText('Enable Quiet Hours')).toBeInTheDocument()
        })

        const quietHoursSwitch = screen.getByRole('switch', { name: /enable quiet hours/i })
        expect(quietHoursSwitch).not.toBeChecked() // Default is false

        await user.click(quietHoursSwitch)
        expect(quietHoursSwitch).toBeChecked()

        // Should show time inputs when enabled
        await waitFor(() => {
            expect(screen.getByLabelText(/start time/i)).toBeInTheDocument()
            expect(screen.getByLabelText(/end time/i)).toBeInTheDocument()
        })
    })

    it('should update quiet hours time', async () => {
        const user = userEvent.setup()
        const preferencesWithQuietHours = {
            ...mockPreferences,
            quietHours: { enabled: true, start: '22:00', end: '08:00' }
        }

        mockPreferencesManager.getUserPreferences.mockResolvedValue(preferencesWithQuietHours)

        render(<NotificationPreferences />)

        await waitFor(() => {
            expect(screen.getByText('Enable Quiet Hours')).toBeInTheDocument()
        })

        // Find the start time input
        const startTimeInput = screen.getByLabelText(/start time/i)
        expect(startTimeInput).toHaveValue('22:00')

        await user.clear(startTimeInput)
        await user.type(startTimeInput, '23:00')

        expect(startTimeInput).toHaveValue('23:00')
    })

    it('should change language preference', async () => {
        const user = userEvent.setup()
        render(<NotificationPreferences />)

        await waitFor(() => {
            expect(screen.getByText('Language')).toBeInTheDocument()
        })

        // Find and click the language select trigger
        const languageSelect = screen.getByRole('combobox', { name: /language/i })
        await user.click(languageSelect)

        // Select Portuguese
        const portugueseOption = screen.getByRole('option', { name: /português/i })
        await user.click(portugueseOption)

        expect(screen.getByText('Unsaved changes')).toBeInTheDocument()
    })

    it('should change timezone preference', async () => {
        const user = userEvent.setup()
        render(<NotificationPreferences />)

        await waitFor(() => {
            expect(screen.getByText('Timezone')).toBeInTheDocument()
        })

        // Find and click the timezone select trigger
        const timezoneSelect = screen.getByRole('combobox', { name: /timezone/i })
        await user.click(timezoneSelect)

        // Select São Paulo timezone
        const saoPauloOption = screen.getByRole('option', { name: /são paulo/i })
        await user.click(saoPauloOption)

        expect(screen.getByText('Unsaved changes')).toBeInTheDocument()
    })

    it('should display notification type preferences', async () => {
        render(<NotificationPreferences />)

        await waitFor(() => {
            expect(screen.getByText('Notification Types')).toBeInTheDocument()
        })

        // Should show all notification types
        expect(screen.getByText('Ticket Created')).toBeInTheDocument()
        expect(screen.getByText('Ticket Assigned')).toBeInTheDocument()
        expect(screen.getByText('Comment Added')).toBeInTheDocument()
        expect(screen.getByText('SLA Warning')).toBeInTheDocument()
        expect(screen.getByText('SLA Breach')).toBeInTheDocument()
    })

    it('should toggle notification type preferences', async () => {
        const user = userEvent.setup()
        render(<NotificationPreferences />)

        await waitFor(() => {
            expect(screen.getByText('Ticket Created')).toBeInTheDocument()
        })

        // Find the switch for ticket_created notifications
        const switches = screen.getAllByRole('switch')
        const ticketCreatedSwitch = switches.find(sw =>
            sw.closest('.space-y-3')?.textContent?.includes('Ticket Created')
        )

        expect(ticketCreatedSwitch).toBeChecked() // Default is enabled

        if (ticketCreatedSwitch) {
            await user.click(ticketCreatedSwitch)
            expect(ticketCreatedSwitch).not.toBeChecked()
        }
    })

    it('should save preferences successfully', async () => {
        const user = userEvent.setup()
        const onPreferencesChange = vi.fn()

        render(<NotificationPreferences onPreferencesChange={onPreferencesChange} />)

        await waitFor(() => {
            expect(screen.getByText('Email Notifications')).toBeInTheDocument()
        })

        // Make a change
        const emailSwitch = screen.getByRole('switch', { name: /email notifications/i })
        await user.click(emailSwitch)

        // Save preferences
        const saveButton = screen.getByRole('button', { name: /save preferences/i })
        await user.click(saveButton)

        await waitFor(() => {
            expect(mockPreferencesManager.updateUserPreferences).toHaveBeenCalledWith(
                mockUserId,
                expect.objectContaining({
                    emailNotifications: false
                })
            )
        })

        expect(onPreferencesChange).toHaveBeenCalledWith(mockPreferences)
    })

    it('should handle save errors gracefully', async () => {
        const user = userEvent.setup()
        mockPreferencesManager.updateUserPreferences.mockRejectedValue(new Error('Save failed'))

        render(<NotificationPreferences />)

        await waitFor(() => {
            expect(screen.getByText('Email Notifications')).toBeInTheDocument()
        })

        // Make a change
        const emailSwitch = screen.getByRole('switch', { name: /email notifications/i })
        await user.click(emailSwitch)

        // Try to save
        const saveButton = screen.getByRole('button', { name: /save preferences/i })
        await user.click(saveButton)

        await waitFor(() => {
            expect(mockPreferencesManager.updateUserPreferences).toHaveBeenCalled()
        })

        // Should still show unsaved changes after error
        expect(screen.getByText('Unsaved changes')).toBeInTheDocument()
    })

    it('should reset to defaults', async () => {
        const user = userEvent.setup()
        const onPreferencesChange = vi.fn()

        render(<NotificationPreferences onPreferencesChange={onPreferencesChange} />)

        await waitFor(() => {
            expect(screen.getByText('Email Notifications')).toBeInTheDocument()
        })

        // Make a change first
        const emailSwitch = screen.getByRole('switch', { name: /email notifications/i })
        await user.click(emailSwitch)

        // Reset to defaults
        const resetButton = screen.getByRole('button', { name: /reset to defaults/i })
        await user.click(resetButton)

        await waitFor(() => {
            expect(mockPreferencesManager.resetToDefaults).toHaveBeenCalledWith(mockUserId)
        })

        expect(onPreferencesChange).toHaveBeenCalledWith(mockPreferences)
    })

    it('should disable save button when no changes', async () => {
        render(<NotificationPreferences />)

        await waitFor(() => {
            expect(screen.getByRole('button', { name: /save preferences/i })).toBeDisabled()
        })
    })

    it('should enable save button when changes are made', async () => {
        const user = userEvent.setup()
        render(<NotificationPreferences />)

        await waitFor(() => {
            expect(screen.getByText('Email Notifications')).toBeInTheDocument()
        })

        // Make a change
        const emailSwitch = screen.getByRole('switch', { name: /email notifications/i })
        await user.click(emailSwitch)

        // Save button should be enabled
        expect(screen.getByRole('button', { name: /save preferences/i })).toBeEnabled()
    })

    it('should show loading state when saving', async () => {
        const user = userEvent.setup()

        // Make updateUserPreferences take some time
        mockPreferencesManager.updateUserPreferences.mockImplementation(
            () => new Promise(resolve => setTimeout(() => resolve(mockPreferences), 100))
        )

        render(<NotificationPreferences />)

        await waitFor(() => {
            expect(screen.getByText('Email Notifications')).toBeInTheDocument()
        })

        // Make a change
        const emailSwitch = screen.getByRole('switch', { name: /email notifications/i })
        await user.click(emailSwitch)

        // Click save
        const saveButton = screen.getByRole('button', { name: /save preferences/i })
        await user.click(saveButton)

        // Should show saving state
        expect(screen.getByText('Saving...')).toBeInTheDocument()
        expect(saveButton).toBeDisabled()
    })

    it('should handle loading error gracefully', async () => {
        mockPreferencesManager.getUserPreferences.mockRejectedValue(new Error('Load failed'))

        render(<NotificationPreferences />)

        // Should show the component with default preferences instead of error state
        await waitFor(() => {
            expect(screen.getByText('Notification Preferences')).toBeInTheDocument()
        })

        // Should show general settings with defaults
        expect(screen.getByText('General Settings')).toBeInTheDocument()
        expect(screen.getByText('Email Notifications')).toBeInTheDocument()
    })

    it('should handle loading error and show defaults', async () => {
        mockPreferencesManager.getUserPreferences.mockRejectedValue(new Error('Load failed'))

        render(<NotificationPreferences />)

        // Should show the component with default preferences
        await waitFor(() => {
            expect(screen.getByText('Notification Preferences')).toBeInTheDocument()
        })

        // Should show general settings with defaults
        expect(screen.getByText('General Settings')).toBeInTheDocument()
        expect(screen.getByText('Email Notifications')).toBeInTheDocument()
        
        // Should have called getUserPreferences once
        expect(mockPreferencesManager.getUserPreferences).toHaveBeenCalledTimes(1)
    })

    it('should be accessible with keyboard navigation', async () => {
        const user = userEvent.setup()
        render(<NotificationPreferences />)

        await waitFor(() => {
            expect(screen.getByText('Email Notifications')).toBeInTheDocument()
        })

        // Tab through switches
        await user.tab()
        const emailSwitch = screen.getByRole('switch', { name: /email notifications/i })
        expect(emailSwitch).toHaveFocus()

        // Toggle with space
        await user.keyboard(' ')
        expect(emailSwitch).not.toBeChecked()

        // Continue tabbing
        await user.tab()
        const toastSwitch = screen.getByRole('switch', { name: /browser notifications/i })
        expect(toastSwitch).toHaveFocus()
    })
})