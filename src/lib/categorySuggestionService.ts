import { Category, Subcategory } from './database';

export interface CategorySuggestion {
  category: Category;
  subcategory?: Subcategory;
  confidence: number; // 0-1 scale
  reason: string; // Why this was suggested
}

export interface SuggestionResult {
  suggestions: CategorySuggestion[];
  topCategory?: CategorySuggestion;
  topSubcategory?: CategorySuggestion;
}

/**
 * Category Suggestion Service
 * Analyzes ticket descriptions and suggests relevant categories and subcategories
 */
export class CategorySuggestionService {
  private static keywords: Record<string, {
    categories: string[];
    subcategories: string[];
    weight: number;
  }> = {
    // Users & Passwords keywords - Expanded
    'password': { categories: ['Users & Passwords'], subcategories: ['Forgot my password'], weight: 0.9 },
    'forgot password': { categories: ['Users & Passwords'], subcategories: ['Forgot my password'], weight: 0.95 },
    'reset password': { categories: ['Users & Passwords'], subcategories: ['Forgot my password'], weight: 0.95 },
    'password reset': { categories: ['Users & Passwords'], subcategories: ['Forgot my password'], weight: 0.95 },
    'change password': { categories: ['Users & Passwords'], subcategories: ['Forgot my password'], weight: 0.85 },
    'lost password': { categories: ['Users & Passwords'], subcategories: ['Forgot my password'], weight: 0.9 },
    'can\'t login': { categories: ['Users & Passwords'], subcategories: ['Forgot my password'], weight: 0.8 },
    'cannot login': { categories: ['Users & Passwords'], subcategories: ['Forgot my password'], weight: 0.8 },
    'login issue': { categories: ['Users & Passwords'], subcategories: ['Forgot my password'], weight: 0.8 },
    'login problem': { categories: ['Users & Passwords'], subcategories: ['Forgot my password'], weight: 0.8 },
    'access denied': { categories: ['Users & Passwords'], subcategories: ['Forgot my password'], weight: 0.75 },
    'authentication': { categories: ['Users & Passwords'], subcategories: ['Multi factor authentication'], weight: 0.8 },
    'mfa': { categories: ['Users & Passwords'], subcategories: ['Multi factor authentication'], weight: 0.9 },
    'multi factor': { categories: ['Users & Passwords'], subcategories: ['Multi factor authentication'], weight: 0.9 },
    'multi-factor': { categories: ['Users & Passwords'], subcategories: ['Multi factor authentication'], weight: 0.9 },
    'two factor': { categories: ['Users & Passwords'], subcategories: ['Multi factor authentication'], weight: 0.9 },
    'two-factor': { categories: ['Users & Passwords'], subcategories: ['Multi factor authentication'], weight: 0.9 },
    '2fa': { categories: ['Users & Passwords'], subcategories: ['Multi factor authentication'], weight: 0.9 },
    'authenticator': { categories: ['Users & Passwords'], subcategories: ['Multi factor authentication'], weight: 0.85 },
    'verification code': { categories: ['Users & Passwords'], subcategories: ['Multi factor authentication'], weight: 0.8 },
    'security code': { categories: ['Users & Passwords'], subcategories: ['Multi factor authentication'], weight: 0.8 },
    'new employee': { categories: ['Users & Passwords'], subcategories: ['[Germany] New Employee Onboarding', '[Rest of Europe] Onboard new employees'], weight: 0.9 },
    'onboarding': { categories: ['Users & Passwords'], subcategories: ['[Germany] New Employee Onboarding', '[Rest of Europe] Onboard new employees'], weight: 0.85 },
    'new hire': { categories: ['Users & Passwords'], subcategories: ['[Germany] New Employee Onboarding', '[Rest of Europe] Onboard new employees'], weight: 0.9 },
    'new starter': { categories: ['Users & Passwords'], subcategories: ['[Germany] New Employee Onboarding', '[Rest of Europe] Onboard new employees'], weight: 0.9 },
    'create account': { categories: ['Users & Passwords'], subcategories: ['[Germany] New Employee Onboarding', '[Rest of Europe] Onboard new employees'], weight: 0.8 },
    'setup account': { categories: ['Users & Passwords'], subcategories: ['[Germany] New Employee Onboarding', '[Rest of Europe] Onboard new employees'], weight: 0.8 },
    'employee leaving': { categories: ['Users & Passwords'], subcategories: ['Employee offboarding'], weight: 0.9 },
    'offboarding': { categories: ['Users & Passwords'], subcategories: ['Employee offboarding'], weight: 0.9 },
    'terminate account': { categories: ['Users & Passwords'], subcategories: ['Employee offboarding'], weight: 0.85 },
    'disable account': { categories: ['Users & Passwords'], subcategories: ['Employee offboarding'], weight: 0.85 },
    'delete account': { categories: ['Users & Passwords'], subcategories: ['Employee offboarding'], weight: 0.8 },
    'account access': { categories: ['Users & Passwords'], subcategories: ['Forgot my password'], weight: 0.7 },
    'locked account': { categories: ['Users & Passwords'], subcategories: ['Forgot my password'], weight: 0.85 },
    'locked out': { categories: ['Users & Passwords'], subcategories: ['Forgot my password'], weight: 0.85 },

    // ERP keywords - Expanded
    'erp': { categories: ['ERP'], subcategories: [], weight: 0.9 },
    'dynamics': { categories: ['ERP'], subcategories: ['ERP Germany (Dynamics NAV)'], weight: 0.85 },
    'dynamics nav': { categories: ['ERP'], subcategories: ['ERP Germany (Dynamics NAV)'], weight: 0.9 },
    'nav': { categories: ['ERP'], subcategories: ['ERP Germany (Dynamics NAV)'], weight: 0.7 },
    'sap': { categories: ['ERP'], subcategories: ['SAP system'], weight: 0.9 },
    'business system': { categories: ['ERP'], subcategories: [], weight: 0.7 },
    'accounting software': { categories: ['ERP'], subcategories: [], weight: 0.75 },
    'finance system': { categories: ['ERP'], subcategories: [], weight: 0.75 },
    'belgium erp': { categories: ['ERP'], subcategories: ['ERP Belgium'], weight: 0.9 },
    'netherlands erp': { categories: ['ERP'], subcategories: ['ERP Netherlands'], weight: 0.9 },
    'uk erp': { categories: ['ERP'], subcategories: ['ERP UK'], weight: 0.9 },
    'german erp': { categories: ['ERP'], subcategories: ['ERP Germany (Dynamics NAV)'], weight: 0.9 },
    'germany erp': { categories: ['ERP'], subcategories: ['ERP Germany (Dynamics NAV)'], weight: 0.9 },

    // Infrastructure & Hardware keywords - Expanded
    'wifi': { categories: ['Infrastructure & Hardware'], subcategories: ['Get a guest wifi account'], weight: 0.8 },
    'wi-fi': { categories: ['Infrastructure & Hardware'], subcategories: ['Get a guest wifi account'], weight: 0.8 },
    'wireless': { categories: ['Infrastructure & Hardware'], subcategories: ['Get a guest wifi account'], weight: 0.75 },
    'guest wifi': { categories: ['Infrastructure & Hardware'], subcategories: ['Get a guest wifi account'], weight: 0.95 },
    'wifi access': { categories: ['Infrastructure & Hardware'], subcategories: ['Get a guest wifi account'], weight: 0.9 },
    'internet connection': { categories: ['Infrastructure & Hardware'], subcategories: ['Get a guest wifi account'], weight: 0.7 },
    'internet access': { categories: ['Infrastructure & Hardware'], subcategories: ['Get a guest wifi account'], weight: 0.7 },
    'network connection': { categories: ['Infrastructure & Hardware'], subcategories: ['Get a guest wifi account'], weight: 0.75 },
    'network': { categories: ['Infrastructure & Hardware'], subcategories: ['Get a guest wifi account'], weight: 0.6 },
    'connectivity': { categories: ['Infrastructure & Hardware'], subcategories: ['Get a guest wifi account'], weight: 0.7 },
    'mobile device': { categories: ['Infrastructure & Hardware'], subcategories: ['New mobile device'], weight: 0.9 },
    'phone': { categories: ['Infrastructure & Hardware'], subcategories: ['New mobile device'], weight: 0.7 },
    'smartphone': { categories: ['Infrastructure & Hardware'], subcategories: ['New mobile device'], weight: 0.85 },
    'cell phone': { categories: ['Infrastructure & Hardware'], subcategories: ['New mobile device'], weight: 0.8 },
    'mobile phone': { categories: ['Infrastructure & Hardware'], subcategories: ['New mobile device'], weight: 0.85 },
    'tablet': { categories: ['Infrastructure & Hardware'], subcategories: ['New mobile device'], weight: 0.8 },
    'ipad': { categories: ['Infrastructure & Hardware'], subcategories: ['New mobile device'], weight: 0.8 },
    'iphone': { categories: ['Infrastructure & Hardware'], subcategories: ['New mobile device'], weight: 0.8 },
    'android': { categories: ['Infrastructure & Hardware'], subcategories: ['New mobile device'], weight: 0.8 },
    'samsung': { categories: ['Infrastructure & Hardware'], subcategories: ['New mobile device'], weight: 0.7 },
    'printer': { categories: ['Infrastructure & Hardware'], subcategories: ['Printer & Scanner'], weight: 0.9 },
    'scanner': { categories: ['Infrastructure & Hardware'], subcategories: ['Printer & Scanner'], weight: 0.9 },
    'printing': { categories: ['Infrastructure & Hardware'], subcategories: ['Printer & Scanner'], weight: 0.85 },
    'print': { categories: ['Infrastructure & Hardware'], subcategories: ['Printer & Scanner'], weight: 0.8 },
    'cannot print': { categories: ['Infrastructure & Hardware'], subcategories: ['Printer & Scanner'], weight: 0.9 },
    'print job': { categories: ['Infrastructure & Hardware'], subcategories: ['Printer & Scanner'], weight: 0.8 },
    'print queue': { categories: ['Infrastructure & Hardware'], subcategories: ['Printer & Scanner'], weight: 0.8 },
    'printer error': { categories: ['Infrastructure & Hardware'], subcategories: ['Printer & Scanner'], weight: 0.9 },
    'scanning': { categories: ['Infrastructure & Hardware'], subcategories: ['Printer & Scanner'], weight: 0.85 },
    'hardware': { categories: ['Infrastructure & Hardware'], subcategories: ['Request new hardware'], weight: 0.7 },
    'laptop': { categories: ['Infrastructure & Hardware'], subcategories: ['Request new hardware'], weight: 0.75 },
    'desktop': { categories: ['Infrastructure & Hardware'], subcategories: ['Request new hardware'], weight: 0.75 },
    'computer': { categories: ['Infrastructure & Hardware'], subcategories: ['Request new hardware'], weight: 0.7 },
    'pc': { categories: ['Infrastructure & Hardware'], subcategories: ['Request new hardware'], weight: 0.7 },
    'workstation': { categories: ['Infrastructure & Hardware'], subcategories: ['Request new hardware'], weight: 0.75 },
    'monitor': { categories: ['Infrastructure & Hardware'], subcategories: ['Request new hardware'], weight: 0.75 },
    'screen': { categories: ['Infrastructure & Hardware'], subcategories: ['Request new hardware'], weight: 0.7 },
    'display': { categories: ['Infrastructure & Hardware'], subcategories: ['Request new hardware'], weight: 0.7 },
    'keyboard': { categories: ['Infrastructure & Hardware'], subcategories: ['Request new hardware'], weight: 0.75 },
    'mouse': { categories: ['Infrastructure & Hardware'], subcategories: ['Request new hardware'], weight: 0.75 },
    'headset': { categories: ['Infrastructure & Hardware'], subcategories: ['Request new hardware'], weight: 0.7 },
    'webcam': { categories: ['Infrastructure & Hardware'], subcategories: ['Request new hardware'], weight: 0.7 },
    'new equipment': { categories: ['Infrastructure & Hardware'], subcategories: ['Request new hardware'], weight: 0.8 },
    'equipment request': { categories: ['Infrastructure & Hardware'], subcategories: ['Request new hardware'], weight: 0.85 },

    // Website & Intranet keywords - Expanded
    'website': { categories: ['Website & Intranet'], subcategories: ['Website issue'], weight: 0.85 },
    'web site': { categories: ['Website & Intranet'], subcategories: ['Website issue'], weight: 0.85 },
    'website down': { categories: ['Website & Intranet'], subcategories: ['Website issue'], weight: 0.9 },
    'website not working': { categories: ['Website & Intranet'], subcategories: ['Website issue'], weight: 0.9 },
    'site down': { categories: ['Website & Intranet'], subcategories: ['Website issue'], weight: 0.9 },
    'web page': { categories: ['Website & Intranet'], subcategories: ['Website issue'], weight: 0.8 },
    'webpage': { categories: ['Website & Intranet'], subcategories: ['Website issue'], weight: 0.8 },
    'web error': { categories: ['Website & Intranet'], subcategories: ['Website issue'], weight: 0.85 },
    'intranet': { categories: ['Website & Intranet'], subcategories: ['Intranet'], weight: 0.9 },
    'internal website': { categories: ['Website & Intranet'], subcategories: ['Intranet'], weight: 0.85 },
    'internal site': { categories: ['Website & Intranet'], subcategories: ['Intranet'], weight: 0.85 },
    'company website': { categories: ['Website & Intranet'], subcategories: ['Intranet'], weight: 0.8 },
    'ecommerce': { categories: ['Website & Intranet'], subcategories: ['Web shop / eCommerce'], weight: 0.9 },
    'e-commerce': { categories: ['Website & Intranet'], subcategories: ['Web shop / eCommerce'], weight: 0.9 },
    'webshop': { categories: ['Website & Intranet'], subcategories: ['Web shop / eCommerce'], weight: 0.9 },
    'web shop': { categories: ['Website & Intranet'], subcategories: ['Web shop / eCommerce'], weight: 0.9 },
    'online store': { categories: ['Website & Intranet'], subcategories: ['Web shop / eCommerce'], weight: 0.85 },
    'online shop': { categories: ['Website & Intranet'], subcategories: ['Web shop / eCommerce'], weight: 0.85 },
    'shopping cart': { categories: ['Website & Intranet'], subcategories: ['Web shop / eCommerce'], weight: 0.8 },
    'cart': { categories: ['Website & Intranet'], subcategories: ['Web shop / eCommerce'], weight: 0.7 },
    'checkout': { categories: ['Website & Intranet'], subcategories: ['Web shop / eCommerce'], weight: 0.8 },
    'payment': { categories: ['Website & Intranet'], subcategories: ['Web shop / eCommerce'], weight: 0.7 },

    // Office 365 & SharePoint keywords - Expanded
    'outlook': { categories: ['Office 365 & SharePoint'], subcategories: ['Outlook'], weight: 0.9 },
    'email': { categories: ['Office 365 & SharePoint'], subcategories: ['Outlook'], weight: 0.8 },
    'e-mail': { categories: ['Office 365 & SharePoint'], subcategories: ['Outlook'], weight: 0.8 },
    'mail': { categories: ['Office 365 & SharePoint'], subcategories: ['Outlook'], weight: 0.75 },
    'calendar': { categories: ['Office 365 & SharePoint'], subcategories: ['Outlook'], weight: 0.75 },
    'meeting': { categories: ['Office 365 & SharePoint'], subcategories: ['Outlook'], weight: 0.7 },
    'appointment': { categories: ['Office 365 & SharePoint'], subcategories: ['Outlook'], weight: 0.7 },
    'cannot send email': { categories: ['Office 365 & SharePoint'], subcategories: ['Outlook'], weight: 0.85 },
    'email not working': { categories: ['Office 365 & SharePoint'], subcategories: ['Outlook'], weight: 0.85 },
    'email issue': { categories: ['Office 365 & SharePoint'], subcategories: ['Outlook'], weight: 0.85 },
    'email problem': { categories: ['Office 365 & SharePoint'], subcategories: ['Outlook'], weight: 0.85 },
    'inbox': { categories: ['Office 365 & SharePoint'], subcategories: ['Outlook'], weight: 0.8 },
    'send mail': { categories: ['Office 365 & SharePoint'], subcategories: ['Outlook'], weight: 0.8 },
    'receive mail': { categories: ['Office 365 & SharePoint'], subcategories: ['Outlook'], weight: 0.8 },
    'sharepoint': { categories: ['Office 365 & SharePoint'], subcategories: ['SharePoint issues & permissions'], weight: 0.9 },
    'share point': { categories: ['Office 365 & SharePoint'], subcategories: ['SharePoint issues & permissions'], weight: 0.9 },
    'sharepoint permission': { categories: ['Office 365 & SharePoint'], subcategories: ['SharePoint issues & permissions'], weight: 0.95 },
    'sharepoint access': { categories: ['Office 365 & SharePoint'], subcategories: ['SharePoint issues & permissions'], weight: 0.9 },
    'sharepoint error': { categories: ['Office 365 & SharePoint'], subcategories: ['SharePoint issues & permissions'], weight: 0.9 },
    'document library': { categories: ['Office 365 & SharePoint'], subcategories: ['SharePoint issues & permissions'], weight: 0.85 },
    'teams': { categories: ['Office 365 & SharePoint'], subcategories: ['Teams & OneDrive issues'], weight: 0.8 },
    'microsoft teams': { categories: ['Office 365 & SharePoint'], subcategories: ['Teams & OneDrive issues'], weight: 0.9 },
    'teams meeting': { categories: ['Office 365 & SharePoint'], subcategories: ['Teams & OneDrive issues'], weight: 0.85 },
    'teams call': { categories: ['Office 365 & SharePoint'], subcategories: ['Teams & OneDrive issues'], weight: 0.85 },
    'teams chat': { categories: ['Office 365 & SharePoint'], subcategories: ['Teams & OneDrive issues'], weight: 0.8 },
    'onedrive': { categories: ['Office 365 & SharePoint'], subcategories: ['Teams & OneDrive issues'], weight: 0.9 },
    'one drive': { categories: ['Office 365 & SharePoint'], subcategories: ['Teams & OneDrive issues'], weight: 0.9 },
    'file sync': { categories: ['Office 365 & SharePoint'], subcategories: ['Teams & OneDrive issues'], weight: 0.8 },
    'sync issue': { categories: ['Office 365 & SharePoint'], subcategories: ['Teams & OneDrive issues'], weight: 0.85 },
    'file sharing': { categories: ['Office 365 & SharePoint'], subcategories: ['Teams & OneDrive issues'], weight: 0.8 },
    'cloud storage': { categories: ['Office 365 & SharePoint'], subcategories: ['Teams & OneDrive issues'], weight: 0.75 },
    'word': { categories: ['Office 365 & SharePoint'], subcategories: ['Word / Excel / PowerPoint issues'], weight: 0.8 },
    'excel': { categories: ['Office 365 & SharePoint'], subcategories: ['Word / Excel / PowerPoint issues'], weight: 0.8 },
    'powerpoint': { categories: ['Office 365 & SharePoint'], subcategories: ['Word / Excel / PowerPoint issues'], weight: 0.8 },
    'power point': { categories: ['Office 365 & SharePoint'], subcategories: ['Word / Excel / PowerPoint issues'], weight: 0.8 },
    'ppt': { categories: ['Office 365 & SharePoint'], subcategories: ['Word / Excel / PowerPoint issues'], weight: 0.75 },
    'spreadsheet': { categories: ['Office 365 & SharePoint'], subcategories: ['Word / Excel / PowerPoint issues'], weight: 0.8 },
    'presentation': { categories: ['Office 365 & SharePoint'], subcategories: ['Word / Excel / PowerPoint issues'], weight: 0.8 },
    'document': { categories: ['Office 365 & SharePoint'], subcategories: ['Word / Excel / PowerPoint issues'], weight: 0.7 },
    'office 365': { categories: ['Office 365 & SharePoint'], subcategories: [], weight: 0.8 },
    'microsoft office': { categories: ['Office 365 & SharePoint'], subcategories: ['Word / Excel / PowerPoint issues'], weight: 0.75 },
    'office app': { categories: ['Office 365 & SharePoint'], subcategories: ['Word / Excel / PowerPoint issues'], weight: 0.75 },

    // General IT keywords - Expanded
    'it help': { categories: ['Other'], subcategories: ['Get IT help'], weight: 0.8 },
    'technical support': { categories: ['Other'], subcategories: ['Get IT help'], weight: 0.75 },
    'tech support': { categories: ['Other'], subcategories: ['Get IT help'], weight: 0.75 },
    'help': { categories: ['Other'], subcategories: ['Get IT help'], weight: 0.5 },
    'support': { categories: ['Other'], subcategories: ['Get IT help'], weight: 0.5 },
    'not working': { categories: ['Other'], subcategories: ['Get IT help'], weight: 0.4 },
    'broken': { categories: ['Other'], subcategories: ['Get IT help'], weight: 0.5 },
    'issue': { categories: ['Other'], subcategories: ['Get IT help'], weight: 0.3 },
    'problem': { categories: ['Other'], subcategories: ['Get IT help'], weight: 0.3 },
    'error': { categories: ['Other'], subcategories: ['Get IT help'], weight: 0.4 },
    'bug': { categories: ['Other'], subcategories: ['Get IT help'], weight: 0.5 },
    'crash': { categories: ['Other'], subcategories: ['Get IT help'], weight: 0.6 },
    'freeze': { categories: ['Other'], subcategories: ['Get IT help'], weight: 0.6 },
    'slow': { categories: ['Other'], subcategories: ['Get IT help'], weight: 0.5 },
    'performance': { categories: ['Other'], subcategories: ['Get IT help'], weight: 0.5 },
    'malfunction': { categories: ['Other'], subcategories: ['Get IT help'], weight: 0.6 },
    'failure': { categories: ['Other'], subcategories: ['Get IT help'], weight: 0.6 },
  };

  /**
   * Analyzes text and returns category/subcategory suggestions
   */
  static suggestCategories(
    description: string,
    availableCategories: Category[],
    availableSubcategories: Subcategory[]
  ): SuggestionResult {
    const text = description.toLowerCase();
    const suggestions: CategorySuggestion[] = [];
    const categoryScores: Record<string, number> = {};
    const subcategoryScores: Record<string, { score: number; category: string }> = {};

    // Score categories and subcategories based on keywords
    for (const [keyword, config] of Object.entries(this.keywords)) {
      if (text.includes(keyword)) {
        // Score categories
        for (const categoryName of config.categories) {
          categoryScores[categoryName] = (categoryScores[categoryName] || 0) + config.weight;
        }

        // Score subcategories
        for (const subcategoryName of config.subcategories) {
          const category = config.categories[0]; // Associate with first category
          subcategoryScores[subcategoryName] = {
            score: (subcategoryScores[subcategoryName]?.score || 0) + config.weight,
            category
          };
        }
      }
    }

    // Convert scores to suggestions
    for (const [categoryName, score] of Object.entries(categoryScores)) {
      const category = availableCategories.find(c => c.name === categoryName);
      if (category && score > 0.3) { // Minimum confidence threshold
        suggestions.push({
          category,
          confidence: Math.min(score, 1),
          reason: `Detected keywords related to ${categoryName}`
        });
      }
    }

    // Add subcategory suggestions
    for (const [subcategoryName, data] of Object.entries(subcategoryScores)) {
      // Try exact match first, then case-insensitive match
      let subcategory = availableSubcategories.find(s => s.name === subcategoryName);
      if (!subcategory) {
        subcategory = availableSubcategories.find(s => 
          s.name.toLowerCase() === subcategoryName.toLowerCase()
        );
      }
      
      const category = availableCategories.find(c => c.name === data.category);
      

      
      if (subcategory && category && data.score > 0.4) { // Slightly higher threshold for subcategories
        suggestions.push({
          category,
          subcategory,
          confidence: Math.min(data.score, 1),
          reason: `Detected keywords for ${subcategoryName}`
        });
      }
    }

    // Sort by confidence
    suggestions.sort((a, b) => b.confidence - a.confidence);

    // Find top suggestions
    const topCategory = suggestions.find(s => !s.subcategory);
    const topSubcategory = suggestions.find(s => s.subcategory);

    return {
      suggestions: suggestions.slice(0, 5), // Return top 5 suggestions
      topCategory,
      topSubcategory
    };
  }

  /**
   * Analyzes both title and description together for better suggestions
   */
  static suggestCategoriesFromTitleAndDescription(
    title: string,
    description: string,
    availableCategories: Category[],
    availableSubcategories: Subcategory[]
  ): SuggestionResult {
    // Combine title and description, giving title higher weight
    const combinedText = `${title} ${title} ${description}`.toLowerCase();
    
    const suggestions: CategorySuggestion[] = [];
    const categoryScores: Record<string, number> = {};
    const subcategoryScores: Record<string, { score: number; category: string }> = {};
    const matchedKeywords: string[] = [];

    // Score categories and subcategories based on keywords
    for (const [keyword, config] of Object.entries(this.keywords)) {
      if (combinedText.includes(keyword)) {
        matchedKeywords.push(keyword);
        
        // Boost score if found in title
        const titleMultiplier = title.toLowerCase().includes(keyword) ? 1.3 : 1;
        const adjustedWeight = config.weight * titleMultiplier;
        
        // Score categories
        for (const categoryName of config.categories) {
          categoryScores[categoryName] = (categoryScores[categoryName] || 0) + adjustedWeight;
        }

        // Score subcategories
        for (const subcategoryName of config.subcategories) {
          const category = config.categories[0]; // Associate with first category
          subcategoryScores[subcategoryName] = {
            score: (subcategoryScores[subcategoryName]?.score || 0) + adjustedWeight,
            category
          };
        }
      }
    }

    // Convert scores to suggestions
    for (const [categoryName, score] of Object.entries(categoryScores)) {
      const category = availableCategories.find(c => c.name === categoryName);
      if (category && score > 0.3) { // Minimum confidence threshold
        suggestions.push({
          category,
          confidence: Math.min(score, 1),
          reason: `Found relevant keywords: ${matchedKeywords.slice(0, 3).join(', ')}`
        });
      }
    }

    // Add subcategory suggestions
    for (const [subcategoryName, data] of Object.entries(subcategoryScores)) {
      // Try exact match first, then case-insensitive match
      let subcategory = availableSubcategories.find(s => s.name === subcategoryName);
      if (!subcategory) {
        subcategory = availableSubcategories.find(s => 
          s.name.toLowerCase() === subcategoryName.toLowerCase()
        );
      }
      
      const category = availableCategories.find(c => c.name === data.category);
      

      
      if (subcategory && category && data.score > 0.4) { // Slightly higher threshold for subcategories
        suggestions.push({
          category,
          subcategory,
          confidence: Math.min(data.score, 1),
          reason: `Matched "${subcategoryName}" keywords: ${matchedKeywords.slice(0, 2).join(', ')}`
        });
      }
    }

    // Sort by confidence
    suggestions.sort((a, b) => b.confidence - a.confidence);

    // Find top suggestions
    const topCategory = suggestions.find(s => !s.subcategory);
    const topSubcategory = suggestions.find(s => s.subcategory);

    return {
      suggestions: suggestions.slice(0, 5), // Return top 5 suggestions
      topCategory,
      topSubcategory
    };
  }

  /**
   * Gets a brief explanation of why categories were suggested
   */
  static getExplanation(description: string): string {
    const text = description.toLowerCase();
    const matchedKeywords: string[] = [];

    for (const keyword of Object.keys(this.keywords)) {
      if (text.includes(keyword)) {
        matchedKeywords.push(keyword);
      }
    }

    if (matchedKeywords.length === 0) {
      return "No specific keywords detected. Consider using the 'Other' category.";
    }

    return `Detected keywords: ${matchedKeywords.slice(0, 3).join(', ')}${matchedKeywords.length > 3 ? '...' : ''}`;
  }

  /**
   * Checks if the description has enough content for meaningful suggestions
   */
  static hasEnoughContent(description: string): boolean {
    return description.trim().length >= 10 && description.trim().split(' ').length >= 3;
  }
} 