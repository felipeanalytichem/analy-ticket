import { useState, useEffect, useCallback, useRef } from 'react';
import DatabaseService, { Category, Subcategory } from '@/lib/database';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';

// Enhanced types for the new features
export interface CategoryWithSubcategories extends Category {
  subcategories: Subcategory[];
  is_enabled?: boolean;
  dynamic_form_schema?: {
    fields: DynamicFormField[];
  };
}

export interface DynamicFormField {
  id: string;
  type: 'text' | 'textarea' | 'select' | 'checkbox' | 'date' | 'number';
  label: string;
  required: boolean;
  options?: string[];
}

export interface CategoryFormData {
  name: string;
  description: string;
  color: string;
  icon: string;
  sort_order: number;
  is_enabled?: boolean;
}

export interface SubcategoryFormData {
  category_id: string;
  name: string;
  description: string;
  response_time_hours: number;
  resolution_time_hours: number;
  sort_order: number;
  specialized_agents: string[];
}

export const useCategoryManagement = () => {
  const { toast } = useToast();
  const [categories, setCategories] = useState<CategoryWithSubcategories[]>([]);
  const [loading, setLoading] = useState(true);
  const [tablesExist, setTablesExist] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);

  // Cache for improved performance
  const [cachedData, setCachedData] = useState<{
    categories: Category[];
    subcategories: Subcategory[];
    timestamp: number;
  } | null>(null);

  // Ref to track subscription to prevent multiple subscriptions
  const subscriptionRef = useRef<any>(null);
  const isSubscribedRef = useRef(false);
  const hookIdRef = useRef(`category-hook-${Date.now()}-${Math.random().toString(36).substring(7)}`);

  const CACHE_DURATION = 30000; // 30 seconds

  const loadData = useCallback(async (forceReload = false) => {
    try {
      setLoading(true);
      
      // Check cache first - access cachedData in the function rather than dependency
      const currentCache = cachedData;
      const now = Date.now();
      if (!forceReload && currentCache && (now - currentCache.timestamp) < CACHE_DURATION) {
        const categoriesWithSubs = processData(currentCache.categories, currentCache.subcategories);
        setCategories(categoriesWithSubs);
        setTablesExist(true);
        setLoading(false);
        return;
      }

      const [categoriesData, subcategoriesData] = await Promise.all([
        DatabaseService.getCategories(),
        DatabaseService.getSubcategories()
      ]);
      
      // Update cache
      setCachedData({
        categories: categoriesData,
        subcategories: subcategoriesData,
        timestamp: now
      });

      const categoriesWithSubs = processData(categoriesData, subcategoriesData);
      setCategories(categoriesWithSubs);
      setTablesExist(true);
      setLastSyncTime(new Date());
    } catch (error) {
      console.error('Error loading data:', error);
      handleLoadError(error);
    } finally {
      setLoading(false);
    }
  }, []); // Remove toast dependency to prevent infinite re-creation

  const processData = (categoriesData: Category[], subcategoriesData: Subcategory[]): CategoryWithSubcategories[] => {
    return categoriesData.map(category => ({
      ...category,
      is_enabled: category.is_enabled ?? true, // Use database value, default to enabled if not set
      subcategories: subcategoriesData.filter(sub => sub.category_id === category.id),
      dynamic_form_schema: { fields: [] } // This would come from DB in real implementation
    })).sort((a, b) => a.sort_order - b.sort_order);
  };

  const handleLoadError = (error: any) => {
    if (error && typeof error === 'object' && 'message' in error) {
      const errorMessage = (error as any).message;
      if (errorMessage.includes('relation "categories" does not exist') || 
          errorMessage.includes('relation "subcategories" does not exist')) {
        setTablesExist(false);
      } else {
        toast({
          title: "Error",
          description: "Failed to load categories and subcategories",
          variant: "destructive",
        });
      }
    } else {
      setTablesExist(false);
    }
  };

  // CRUD Operations
  const createCategory = async (categoryData: CategoryFormData): Promise<boolean> => {
    try {
      await DatabaseService.createCategory(categoryData);
      await loadData(true); // Force reload after creation
      
      toast({
        title: "Success",
        description: "Category created successfully",
      });
      return true;
    } catch (error) {
      console.error('Error creating category:', error);
      toast({
        title: "Error",
        description: "Failed to create category",
        variant: "destructive",
      });
      return false;
    }
  };

  const updateCategory = async (categoryId: string, updates: Partial<CategoryWithSubcategories>): Promise<boolean> => {
    try {
      await DatabaseService.updateCategory(categoryId, updates);
      await loadData(true); // Force reload after update
      
      toast({
        title: "Success",
        description: "Category updated successfully",
      });
      return true;
    } catch (error) {
      console.error('Error updating category:', error);
      toast({
        title: "Error",
        description: "Failed to update category",
        variant: "destructive",
      });
      return false;
    }
  };

  const deleteCategory = async (categoryId: string): Promise<boolean> => {
    try {
      await DatabaseService.deleteCategory(categoryId);
      await loadData(true); // Force reload after deletion
      
      toast({
        title: "Success",
        description: "Category deleted successfully",
      });
      return true;
    } catch (error) {
      console.error('Error deleting category:', error);
      toast({
        title: "Error",
        description: "Failed to delete category",
        variant: "destructive",
      });
      return false;
    }
  };

  const createSubcategory = async (subcategoryData: SubcategoryFormData): Promise<boolean> => {
    try {
      await DatabaseService.createSubcategory(subcategoryData);
      await loadData(true); // Force reload after creation
      
      toast({
        title: "Success",
        description: "Subcategory created successfully",
      });
      return true;
    } catch (error) {
      console.error('Error creating subcategory:', error);
      toast({
        title: "Error",
        description: "Failed to create subcategory",
        variant: "destructive",
      });
      return false;
    }
  };

  const updateSubcategory = async (subcategoryId: string, updates: Partial<Subcategory>): Promise<boolean> => {
    try {
      await DatabaseService.updateSubcategory(subcategoryId, updates);
      await loadData(true); // Force reload after update
      
      toast({
        title: "Success",
        description: "Subcategory updated successfully",
      });
      return true;
    } catch (error) {
      console.error('Error updating subcategory:', error);
      toast({
        title: "Error",
        description: "Failed to update subcategory",
        variant: "destructive",
      });
      return false;
    }
  };

  const deleteSubcategory = async (subcategoryId: string): Promise<boolean> => {
    try {
      await DatabaseService.deleteSubcategory(subcategoryId);
      await loadData(true); // Force reload after deletion
      
      toast({
        title: "Success",
        description: "Subcategory deleted successfully",
      });
      return true;
    } catch (error) {
      console.error('Error deleting subcategory:', error);
      toast({
        title: "Error",
        description: "Failed to delete subcategory",
        variant: "destructive",
      });
      return false;
    }
  };

  // Advanced operations
  const toggleCategoryEnabled = async (categoryId: string, enabled: boolean): Promise<boolean> => {
    try {
      // Update database first
      await DatabaseService.toggleCategoryStatus(categoryId, enabled);
      
      // Then update local state
      setCategories(prev => prev.map(cat => 
        cat.id === categoryId ? { ...cat, is_enabled: enabled } : cat
      ));
      
      // Invalidate cache to force reload
      invalidateCache();
      
      toast({
        title: "Success",
        description: `Category ${enabled ? 'enabled' : 'disabled'} successfully`,
      });
      return true;
    } catch (error) {
      console.error('Error toggling category:', error);
      toast({
        title: "Error",
        description: "Failed to update category status",
        variant: "destructive",
      });
      return false;
    }
  };

  const updateCategoryOrder = async (categoryId: string, newOrder: number): Promise<boolean> => {
    try {
      // In a real implementation, this would update the database
      setCategories(prev => prev.map(cat => 
        cat.id === categoryId ? { ...cat, sort_order: newOrder } : cat
      ).sort((a, b) => a.sort_order - b.sort_order));
      
      toast({
        title: "Success",
        description: "Category order updated successfully",
      });
      return true;
    } catch (error) {
      console.error('Error updating category order:', error);
      toast({
        title: "Error",
        description: "Failed to update category order",
        variant: "destructive",
      });
      return false;
    }
  };

  const updateSubcategoryOrder = async (subcategoryId: string, newOrder: number): Promise<boolean> => {
    try {
      // In a real implementation, this would update the database
      setCategories(prev => prev.map(cat => ({
        ...cat,
        subcategories: cat.subcategories.map(sub =>
          sub.id === subcategoryId ? { ...sub, sort_order: newOrder } : sub
        ).sort((a, b) => a.sort_order - b.sort_order)
      })));
      
      toast({
        title: "Success",
        description: "Subcategory order updated successfully",
      });
      return true;
    } catch (error) {
      console.error('Error updating subcategory order:', error);
      toast({
        title: "Error",
        description: "Failed to update subcategory order",
        variant: "destructive",
      });
      return false;
    }
  };

  const saveDynamicFormSchema = async (categoryId: string, fields: DynamicFormField[]): Promise<boolean> => {
    try {
      // In a real implementation, this would save to the database
      setCategories(prev => prev.map(cat => 
        cat.id === categoryId 
          ? { ...cat, dynamic_form_schema: { fields } }
          : cat
      ));
      
      toast({
        title: "Success",
        description: "Dynamic form schema saved successfully",
      });
      return true;
    } catch (error) {
      console.error('Error saving form schema:', error);
      toast({
        title: "Error",
        description: "Failed to save form schema",
        variant: "destructive",
      });
      return false;
    }
  };

  // Initial data load effect
  useEffect(() => {
    loadData();
  }, []); // Only run once on mount

  // Real-time subscription effect with proper cleanup handling
  useEffect(() => {
    // Prevent multiple subscriptions
    if (isSubscribedRef.current) {
      return;
    }

    // Set up real-time subscriptions with unique channel name per hook instance
    const channelName = `categories-changes-${hookIdRef.current}`;
    const categoriesSubscription = supabase
      .channel(channelName)
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'categories' },
        (payload) => {
          console.log('Categories change received:', payload);
          loadData(true); // Force reload when changes occur
        }
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'subcategories' },
        (payload) => {
          console.log('Subcategories change received:', payload);
          loadData(true); // Force reload when changes occur
        }
      )
      .subscribe();

    subscriptionRef.current = categoriesSubscription;
    isSubscribedRef.current = true;

    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
        subscriptionRef.current = null;
        isSubscribedRef.current = false;
      }
    };
  }, []); // Only run once on mount to avoid multiple subscriptions

  // Utility functions
  const getCategoryById = useCallback((categoryId: string): CategoryWithSubcategories | undefined => {
    return categories.find(cat => cat.id === categoryId);
  }, [categories]);

  const getSubcategoryById = useCallback((subcategoryId: string): Subcategory | undefined => {
    for (const category of categories) {
      const subcategory = category.subcategories.find(sub => sub.id === subcategoryId);
      if (subcategory) return subcategory;
    }
    return undefined;
  }, [categories]);

  const getEnabledCategories = useCallback((): CategoryWithSubcategories[] => {
    return categories.filter(cat => cat.is_enabled);
  }, [categories]);

  const getCategoriesForTicketForm = useCallback((): Array<{ id: string; name: string; subcategories: Array<{ id: string; name: string }> }> => {
    return getEnabledCategories().map(cat => ({
      id: cat.id,
      name: cat.name,
      subcategories: cat.subcategories.map(sub => ({
        id: sub.id,
        name: sub.name
      }))
    }));
  }, [getEnabledCategories]);

  const invalidateCache = () => {
    setCachedData(null);
  };

  return {
    // State
    categories,
    loading,
    tablesExist,
    lastSyncTime,

    // CRUD Operations
    createCategory,
    updateCategory,
    deleteCategory,
    createSubcategory,
    updateSubcategory,
    deleteSubcategory,

    // Advanced Operations
    toggleCategoryEnabled,
    updateCategoryOrder,
    updateSubcategoryOrder,
    saveDynamicFormSchema,

    // Utility Functions
    getCategoryById,
    getSubcategoryById,
    getEnabledCategories,
    getCategoriesForTicketForm,
    loadData,
    invalidateCache
  };
}; 