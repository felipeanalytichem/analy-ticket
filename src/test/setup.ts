import { vi } from 'vitest'
import '@testing-library/jest-dom'

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => {
    const mql = {
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(), // deprecated
      removeListener: vi.fn(), // deprecated
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }
    return mql
  }),
})

// Mock hasPointerCapture for Radix UI components
Object.defineProperty(Element.prototype, 'hasPointerCapture', {
  writable: true,
  value: vi.fn().mockReturnValue(false),
})

// Mock setPointerCapture for Radix UI components
Object.defineProperty(Element.prototype, 'setPointerCapture', {
  writable: true,
  value: vi.fn(),
})

// Mock releasePointerCapture for Radix UI components
Object.defineProperty(Element.prototype, 'releasePointerCapture', {
  writable: true,
  value: vi.fn(),
})

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation((callback) => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
  callback
}))

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))