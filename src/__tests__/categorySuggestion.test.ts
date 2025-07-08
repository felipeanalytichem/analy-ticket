import { CategorySuggestionService } from '@/lib/categorySuggestionService';
import { Category, Subcategory } from '@/lib/database';

// Mock categories for testing
const mockCategories: Category[] = [
  {
    id: 'cat-1',
    name: 'Users & Passwords',
    description: 'User management and authentication',
    color: '#3B82F6',
    icon: '👤',
    sort_order: 1,
    is_enabled: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z'
  },
  {
    id: 'cat-2',
    name: 'Infrastructure & Hardware',
    description: 'Hardware and infrastructure support',
    color: '#EF4444',
    icon: '🖥️',
    sort_order: 2,
    is_enabled: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z'
  },
  {
    id: 'cat-3',
    name: 'Office 365 & SharePoint',
    description: 'Microsoft Office 365 suite support',
    color: '#F97316',
    icon: '📧',
    sort_order: 3,
    is_enabled: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z'
  }
];

const mockSubcategories: Subcategory[] = [
  {
    id: 'sub-1',
    category_id: 'cat-1',
    name: 'Forgot my password',
    description: 'Password reset requests',
    response_time_hours: 2,
    resolution_time_hours: 4,
    sort_order: 1,
    specialized_agents: [],
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z'
  },
  {
    id: 'sub-2',
    category_id: 'cat-1',
    name: 'Multi factor authentication',
    description: 'MFA setup and issues',
    response_time_hours: 4,
    resolution_time_hours: 8,
    sort_order: 2,
    specialized_agents: [],
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z'
  },
  {
    id: 'sub-3',
    category_id: 'cat-2',
    name: 'Printer & Scanner',
    description: 'Printer and scanner support',
    response_time_hours: 4,
    resolution_time_hours: 24,
    sort_order: 1,
    specialized_agents: [],
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z'
  },
  {
    id: 'sub-4',
    category_id: 'cat-3',
    name: 'Outlook',
    description: 'Email and calendar support',
    response_time_hours: 2,
    resolution_time_hours: 8,
    sort_order: 1,
    specialized_agents: [],
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z'
  }
];

describe('CategorySuggestionService', () => {
  describe('suggestCategories', () => {
    test('suggests password category for password-related issues', () => {
      const description = "I forgot my password and cannot login to my account";
      const result = CategorySuggestionService.suggestCategories(
        description,
        mockCategories,
        mockSubcategories
      );

      expect(result.suggestions.length).toBeGreaterThan(0);
      expect(result.topCategory?.category.name).toBe('Users & Passwords');
      expect(result.topSubcategory?.subcategory?.name).toBe('Forgot my password');
      expect(result.topSubcategory?.confidence).toBeGreaterThan(0.8);
    });

    test('suggests printer category for printing issues', () => {
      const description = "My printer is not working and I cannot print documents";
      const result = CategorySuggestionService.suggestCategories(
        description,
        mockCategories,
        mockSubcategories
      );

      expect(result.suggestions.length).toBeGreaterThan(0);
      expect(result.topCategory?.category.name).toBe('Infrastructure & Hardware');
      expect(result.topSubcategory?.subcategory?.name).toBe('Printer & Scanner');
    });

    test('suggests Outlook category for email issues', () => {
      const description = "I cannot send emails from Outlook and getting error messages";
      const result = CategorySuggestionService.suggestCategories(
        description,
        mockCategories,
        mockSubcategories
      );

      expect(result.suggestions.length).toBeGreaterThan(0);
      expect(result.topCategory?.category.name).toBe('Office 365 & SharePoint');
      expect(result.topSubcategory?.subcategory?.name).toBe('Outlook');
    });

    test('suggests MFA category for multi-factor authentication issues', () => {
      const description = "I'm having trouble with my 2FA setup and authenticator app";
      const result = CategorySuggestionService.suggestCategories(
        description,
        mockCategories,
        mockSubcategories
      );

      expect(result.suggestions.length).toBeGreaterThan(0);
      expect(result.topSubcategory?.subcategory?.name).toBe('Multi factor authentication');
    });

    test('returns empty suggestions for unrelated content', () => {
      const description = "Hello world this is a test";
      const result = CategorySuggestionService.suggestCategories(
        description,
        mockCategories,
        mockSubcategories
      );

      expect(result.suggestions.length).toBe(0);
    });
  });

  describe('hasEnoughContent', () => {
    test('returns false for short descriptions', () => {
      expect(CategorySuggestionService.hasEnoughContent("Help")).toBe(false);
      expect(CategorySuggestionService.hasEnoughContent("")).toBe(false);
      expect(CategorySuggestionService.hasEnoughContent("Hi there")).toBe(false);
    });

    test('returns true for adequate descriptions', () => {
      expect(CategorySuggestionService.hasEnoughContent("I need help with my password reset")).toBe(true);
      expect(CategorySuggestionService.hasEnoughContent("The printer is not working properly")).toBe(true);
    });
  });

  describe('getExplanation', () => {
    test('provides explanation for matched keywords', () => {
      const description = "I forgot my password";
      const explanation = CategorySuggestionService.getExplanation(description);
      
      expect(explanation).toContain('Detected keywords:');
      expect(explanation).toContain('password');
    });

    test('provides default message for no keywords', () => {
      const description = "Hello world";
      const explanation = CategorySuggestionService.getExplanation(description);
      
      expect(explanation).toContain('No specific keywords detected');
    });
  });
});

// Example usage test
describe('CategorySuggestion Integration', () => {
  test('full workflow example', () => {
    const description = "I cannot print from my laptop and need help setting up the printer";
    
    // Check if description has enough content
    const hasEnoughContent = CategorySuggestionService.hasEnoughContent(description);
    expect(hasEnoughContent).toBe(true);
    
    // Get suggestions
    const result = CategorySuggestionService.suggestCategories(
      description,
      mockCategories,
      mockSubcategories
    );
    
    // Should suggest printer-related category
    expect(result.topSubcategory?.subcategory?.name).toBe('Printer & Scanner');
    expect(result.topSubcategory?.category.name).toBe('Infrastructure & Hardware');
    
    // Get explanation
    const explanation = CategorySuggestionService.getExplanation(description);
    expect(explanation).toContain('Detected keywords:');
  });
}); 