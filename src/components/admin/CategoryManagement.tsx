import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { DatabaseService, Category, Subcategory, DynamicFormField } from "@/lib/database";
import { supabase } from "@/lib/supabase";
import { useCategoryManagement } from "@/hooks/useCategoryManagement";
import { useCategories } from '@/hooks/useCategories';
import { useSubcategories } from '@/hooks/useSubcategories';
import { 
  Plus, 
  Edit, 
  Save, 
  X, 
  GripVertical,
  Settings,
  Eye,
  EyeOff,
  Trash2,
  FormInput,
  Search,
  Filter,
  MoreVertical,
  Clock,
  Users,
  BarChart3,
  Palette,
  Grid3X3,
  List,
  ChevronDown,
  ChevronRight,
  TrendingUp
} from "lucide-react";

// Enhanced types for the new features
interface CategoryWithSubcategories extends Category {
  subcategories: Subcategory[];
  is_enabled?: boolean;
  dynamic_form_schema?: any;
}

export const CategoryManagement = () => {
  const { toast } = useToast();
  const [categories, setCategories] = useState<CategoryWithSubcategories[]>([]);

  const { data: categoriesData, isLoading: catLoading, refetch: refetchCategories } = useCategories();
  const { data: subcategoriesData, isLoading: subLoading, refetch: refetchSubcategories } = useSubcategories();

  const loading = catLoading || subLoading;
  
  // UI States
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'enabled' | 'disabled'>('all');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  
  // Modal states
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [isSubcategoryDialogOpen, setIsSubcategoryDialogOpen] = useState(false);
  const [isFormBuilderOpen, setIsFormBuilderOpen] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [subcategoryViewModal, setSubcategoryViewModal] = useState<{
    isOpen: boolean;
    category: CategoryWithSubcategories | null;
  }>({ isOpen: false, category: null });
  
  // Editing states
  const [editingCategory, setEditingCategory] = useState<CategoryWithSubcategories | null>(null);
  const [editingSubcategory, setEditingSubcategory] = useState<Subcategory | null>(null);
  const [selectedSubcategoryForForm, setSelectedSubcategoryForForm] = useState<string>("");
  const [deleteItem, setDeleteItem] = useState<{ type: 'category' | 'subcategory', id: string } | null>(null);

  const [newCategory, setNewCategory] = useState({
    name: "",
    description: "",
    color: "#3B82F6",
    icon: "folder",
    sort_order: 0,
    is_enabled: true
  });

  const [newSubcategory, setNewSubcategory] = useState({
    category_id: "",
    name: "",
    description: "",
    response_time_hours: 24,
    resolution_time_hours: 72,
    sort_order: 0,
    specialized_agents: [] as string[],
    is_enabled: true
  });

  const [dynamicFormFields, setDynamicFormFields] = useState<DynamicFormField[]>([]);

  // Debug monitor for dynamicFormFields changes
  useEffect(() => {
    console.log('🔍 dynamicFormFields state changed:', dynamicFormFields.length, 'fields');
    if (dynamicFormFields.length > 0) {
      const labels = dynamicFormFields.map(f => f.label);
      const uniqueLabels = [...new Set(labels)];
      if (labels.length !== uniqueLabels.length) {
        console.warn('🚨 DUPLICATE LABELS DETECTED IN STATE:', labels.length, 'total,', uniqueLabels.length, 'unique');
        console.warn('🚨 Duplicate labels:', labels.filter((label, index) => labels.indexOf(label) !== index));
      }
    }
  }, [dynamicFormFields]);

  const iconOptions = [
    { value: "monitor", label: "💻 Monitor", emoji: "💻" },
    { value: "building", label: "🏢 Building", emoji: "🏢" },
    { value: "users", label: "👥 Users", emoji: "👥" },
    { value: "dollar-sign", label: "💰 Dollar", emoji: "💰" },
    { value: "settings", label: "⚙️ Settings", emoji: "⚙️" },
    { value: "help-circle", label: "❓ Help", emoji: "❓" },
    { value: "folder", label: "📁 Folder", emoji: "📁" },
    { value: "shield", label: "🛡️ Shield", emoji: "🛡️" },
    { value: "globe", label: "🌐 Globe", emoji: "🌐" },
    { value: "zap", label: "⚡ Zap", emoji: "⚡" }
  ];

  const colorOptions = [
    "#3B82F6", "#10B981", "#F59E0B", "#EF4444", 
    "#8B5CF6", "#6B7280", "#06B6D4", "#84CC16",
    "#F97316", "#EC4899"
  ];

  // Assemble categories when queries return
  useEffect(() => {
    if (!categoriesData || !subcategoriesData) return;

    const combined: CategoryWithSubcategories[] = categoriesData.map((cat) => ({
      ...cat,
      is_enabled: cat.is_enabled ?? true,
      subcategories: subcategoriesData.filter((sub) => sub.category_id === cat.id),
      dynamic_form_schema: null,
    }));

    setCategories(combined.sort((a, b) => a.sort_order - b.sort_order));
  }, [categoriesData, subcategoriesData]);

  // Realtime: simply refetch queries instead of custom loadData
  useEffect(() => {
    const channel = supabase
      .channel('categories-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'categories' }, () => {
        refetchCategories();
        refetchSubcategories();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'subcategories' }, () => {
        refetchCategories();
        refetchSubcategories();
      })
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [refetchCategories, refetchSubcategories]);

  const handleCreateCategory = async () => {
    try {
      await DatabaseService.createCategory(newCategory);
      setNewCategory({
        name: "",
        description: "",
        color: "#3B82F6",
        icon: "folder",
        sort_order: 0,
        is_enabled: true
      });
      setIsCategoryDialogOpen(false);
      await refetchCategories();
      
      toast({
        title: "Success",
        description: "Category created successfully",
      });
    } catch (error) {
      console.error('Error creating category:', error);
      toast({
        title: "Error",
        description: "Failed to create category",
        variant: "destructive",
      });
    }
  };

  const handleCreateSubcategory = async () => {
    try {
      await DatabaseService.createSubcategory(newSubcategory);
      setNewSubcategory({
        category_id: "",
        name: "",
        description: "",
        response_time_hours: 24,
        resolution_time_hours: 72,
        sort_order: 0,
        specialized_agents: [] as string[],
        is_enabled: true
      });
      setIsSubcategoryDialogOpen(false);
      await refetchCategories();
      
      toast({
        title: "Success",
        description: "Subcategory created successfully",
      });
    } catch (error) {
      console.error('Error creating subcategory:', error);
      toast({
        title: "Error",
        description: "Failed to create subcategory",
        variant: "destructive",
      });
    }
  };

  const handleUpdateCategory = async () => {
    if (!editingCategory) return;
    
    try {
      await DatabaseService.updateCategory(editingCategory.id, editingCategory);
      setEditingCategory(null);
      await refetchCategories();
      
      toast({
        title: "Success",
        description: "Category updated successfully",
      });
    } catch (error) {
      console.error('Error updating category:', error);
      toast({
        title: "Error",
        description: "Failed to update category",
        variant: "destructive",
      });
    }
  };

  const handleUpdateSubcategory = async () => {
    if (!editingSubcategory) return;
    
    try {
      await DatabaseService.updateSubcategory(editingSubcategory.id, editingSubcategory);
      setEditingSubcategory(null);
      await refetchCategories();
      
      toast({
        title: "Success",
        description: "Subcategory updated successfully",
      });
    } catch (error) {
      console.error('Error updating subcategory:', error);
      toast({
        title: "Error",
        description: "Failed to update subcategory",
        variant: "destructive",
      });
    }
  };

  const handleDeleteItem = async () => {
    if (!deleteItem) return;
    
    try {
      if (deleteItem.type === 'category') {
        await DatabaseService.deleteCategory(deleteItem.id);
        toast({
          title: "Success",
          description: "Category deleted successfully",
        });
    } else {
        await DatabaseService.deleteSubcategory(deleteItem.id);
        toast({
          title: "Success",
          description: "Subcategory deleted successfully",
        });
      }
      
      setDeleteItem(null);
      setShowDeleteDialog(false);
      await refetchCategories();
    } catch (error) {
      console.error('Error deleting item:', error);
      toast({
        title: "Error",
        description: "Failed to delete item",
        variant: "destructive",
      });
    }
  };

  const toggleCategoryEnabled = async (categoryId: string, enabled: boolean) => {
    try {
      // Update database first
      await DatabaseService.toggleCategoryStatus(categoryId, enabled);
      
      // Then update local state
      setCategories(prev => prev.map(cat => 
        cat.id === categoryId ? { ...cat, is_enabled: enabled } : cat
      ));
      
        toast({
          title: "Success",
        description: `Category ${enabled ? 'enabled' : 'disabled'} successfully`,
      });
    } catch (error) {
      console.error('Error toggling category:', error);
      toast({
        title: "Error",
        description: "Failed to update category status",
        variant: "destructive",
      });
    }
  };

  const toggleSubcategoryEnabled = async (subcategoryId: string, enabled: boolean) => {
    console.log('🔧 toggleSubcategoryEnabled called:', { subcategoryId, enabled });
    
    // Optimistic UI update - update the UI immediately
    const updateStates = () => {
      setCategories(prev => prev.map(cat => ({
        ...cat,
        subcategories: cat.subcategories.map(sub =>
          sub.id === subcategoryId ? { ...sub, is_enabled: enabled } : sub
        )
      })));
      
      // Also update the modal state if it's open and showing this category
      if (subcategoryViewModal.isOpen && subcategoryViewModal.category) {
        setSubcategoryViewModal(prev => ({
          ...prev,
          category: prev.category ? {
            ...prev.category,
            subcategories: prev.category.subcategories.map(sub =>
              sub.id === subcategoryId ? { ...sub, is_enabled: enabled } : sub
            )
          } : null
        }));
      }
    };
    
    // Update UI immediately for better UX
    updateStates();
    console.log('🔧 Optimistic UI update applied');
    
    try {
      console.log('🔧 Calling DatabaseService.toggleSubcategoryStatus...');
      // Update database
      await DatabaseService.toggleSubcategoryStatus(subcategoryId, enabled);
      console.log('🔧 Database update successful');
      
      toast({
        title: "Success",
        description: `Subcategory ${enabled ? 'enabled' : 'disabled'} successfully`,
      });
    } catch (error) {
      console.error('🔧 Error toggling subcategory:', error);
      
      // Revert the optimistic update on error
      const revertStates = () => {
        setCategories(prev => prev.map(cat => ({
          ...cat,
          subcategories: cat.subcategories.map(sub =>
            sub.id === subcategoryId ? { ...sub, is_enabled: !enabled } : sub
          )
        })));
        
        if (subcategoryViewModal.isOpen && subcategoryViewModal.category) {
          setSubcategoryViewModal(prev => ({
            ...prev,
            category: prev.category ? {
              ...prev.category,
              subcategories: prev.category.subcategories.map(sub =>
                sub.id === subcategoryId ? { ...sub, is_enabled: !enabled } : sub
              )
            } : null
          }));
        }
      };
      
      revertStates();
      console.log('🔧 Optimistic update reverted due to error');
      
      toast({
        title: "Error",
        description: "Failed to update subcategory status",
        variant: "destructive",
      });
    }
  };

  const handleDragStart = (e: React.DragEvent, type: 'category' | 'subcategory', id: string) => {
    e.dataTransfer.setData('text/plain', JSON.stringify({ type, id }));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, targetType: 'category' | 'subcategory', targetId: string) => {
    e.preventDefault();
    const dragData = JSON.parse(e.dataTransfer.getData('text/plain'));
    
    // Implement reordering logic here
    console.log('Reordering:', dragData, 'to position of', targetType, targetId);
    
    toast({
      title: "Feature Coming Soon",
      description: "Drag & drop reordering will be implemented in the next update",
    });
  };

  // Enhanced deduplication utility
  const deduplicateFields = (fields: DynamicFormField[]): DynamicFormField[] => {
    if (!fields || fields.length === 0) return [];
    
    console.log('🧹 Deduplicating fields - input:', fields.length, 'fields');
    
    // Step 1: Remove by ID duplicates (keep first occurrence)
    const uniqueById = fields.filter((field, index, array) => 
      array.findIndex(f => f.id === field.id) === index
    );
    console.log('🧹 After ID dedup:', uniqueById.length, 'fields');
    
    // Step 2: Remove by label duplicates (keep first occurrence)  
    const uniqueByLabel = uniqueById.filter((field, index, array) => 
      array.findIndex(f => f.label === field.label) === index
    );
    console.log('🧹 After label dedup:', uniqueByLabel.length, 'fields');
    
    // Step 3: Remove empty or invalid fields
    const cleanFields = uniqueByLabel.filter(field => 
      field && field.id && field.label && field.label.trim() !== ''
    );
    console.log('🧹 After cleaning:', cleanFields.length, 'fields');
    
    if (cleanFields.length !== fields.length) {
      console.warn('🧹 Deduplication removed', fields.length - cleanFields.length, 'duplicates/invalid fields');
    }
    
    return cleanFields;
  };

  const openFormBuilder = async (subcategoryId: string) => {
    console.log('🔧 ===== OPENING FORM BUILDER =====');
    console.log('🔧 Subcategory ID:', subcategoryId);
    
    // Clear any existing state first to prevent accumulation
    setDynamicFormFields([]);
    setSelectedSubcategoryForForm(subcategoryId);
    
    try {
      // Get fresh data directly from database (skip local state to avoid conflicts)
      console.log('🔧 Fetching fresh data from database...');
      const freshFormFields = await DatabaseService.getSubcategoryFormFields(subcategoryId);
      
      console.log('🔧 Raw database response:', freshFormFields?.length || 0, 'fields');
      console.log('🔧 Raw fields:', freshFormFields);
      
      // Apply aggressive deduplication
      const cleanFields = deduplicateFields(freshFormFields || []);
      
      console.log('🔧 Final clean fields to display:', cleanFields.length, 'fields');
      console.log('🔧 Final field labels:', cleanFields.map(f => f.label));
      
      // Set the cleaned fields
      setDynamicFormFields(cleanFields);
      
    } catch (error) {
      console.error('🔧 Error loading form fields:', error);
      setDynamicFormFields([]);
    }
    
    setIsFormBuilderOpen(true);
    console.log('🔧 ===== FORM BUILDER OPENED =====');
  };

  const addFormField = useCallback(() => {
    const newField: DynamicFormField = {
      id: `field_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'text',
      label: '',
      required: false,
      enabled: true
    };
    console.log('🔧 Adding new field:', newField.id);
    setDynamicFormFields(prev => {
      const updated = [...prev, newField];
      console.log('🔧 After adding field:', updated.length, 'total fields');
      return updated;
    });
  }, []);

  const updateFormField = useCallback((fieldId: string, updates: Partial<DynamicFormField>) => {
    console.log('🔧 Updating field:', fieldId, updates);
    setDynamicFormFields(prev => {
      const updated = prev.map(field => 
        field.id === fieldId ? { ...field, ...updates } : field
      );
      console.log('🔧 After updating field:', updated.length, 'total fields');
      return updated;
    });
  }, []);

  const removeFormField = useCallback((fieldId: string) => {
    console.log('🔧 Removing field:', fieldId);
    setDynamicFormFields(prev => {
      const updated = prev.filter(field => field.id !== fieldId);
      console.log('🔧 After removing field:', updated.length, 'total fields');
      return updated;
    });
  }, []);

  const saveFormSchema = async () => {
    try {
      console.log('🔧 Saving form fields for subcategory:', selectedSubcategoryForForm);
      console.log('🔧 Form fields to save (raw):', dynamicFormFields);
      
      // Clean and deduplicate fields before saving
      const cleanedFields = dynamicFormFields
        .filter(field => field.label && field.label.trim() !== '') // Remove empty fields
        .filter((field, index, array) => 
          array.findIndex(f => f.id === field.id) === index // Remove ID duplicates
        )
        .filter((field, index, array) => 
          array.findIndex(f => f.label === field.label) === index // Remove label duplicates
        );
      
      console.log('🔧 Cleaned form fields to save:', cleanedFields);
      console.log('🔧 Original length:', dynamicFormFields.length, 'Cleaned length:', cleanedFields.length);
      
      if (cleanedFields.length !== dynamicFormFields.length) {
        console.warn('🔧 Removed duplicate or empty fields during save');
        setDynamicFormFields(cleanedFields); // Update state with cleaned data
      }
      
      // Save to database
      await DatabaseService.saveSubcategoryFormFields(selectedSubcategoryForForm, cleanedFields);
      
      // Update local state
      setCategories(prev => prev.map(cat => ({
        ...cat,
        subcategories: cat.subcategories.map(sub => 
          sub.id === selectedSubcategoryForForm 
            ? { ...sub, dynamic_form_fields: cleanedFields }
            : sub
        )
      })));
      
      // Also refresh the subcategories to ensure consistency
      await refetchSubcategories();
      
      setIsFormBuilderOpen(false);
      toast({
        title: "Success",
        description: "Subcategory form fields saved successfully",
      });
    } catch (error) {
      console.error('Error saving form fields:', error);
      toast({
        title: "Error",
        description: "Failed to save form fields",
        variant: "destructive",
      });
    }
  };

  const getIconEmoji = (iconName: string) => {
    const icon = iconOptions.find(opt => opt.value === iconName);
    return icon?.emoji || "📁";
  };

  // Filter and search functions
  const filteredCategories = categories.filter(category => {
    const matchesSearch = category.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         category.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         category.subcategories.some(sub => 
                           sub.name.toLowerCase().includes(searchTerm.toLowerCase())
                         );
    
    const matchesFilter = filterStatus === 'all' || 
                         (filterStatus === 'enabled' && category.is_enabled) ||
                         (filterStatus === 'disabled' && !category.is_enabled);
    
    return matchesSearch && matchesFilter;
  });

  // Pagination logic
  const totalPages = Math.ceil(filteredCategories.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedCategories = filteredCategories.slice(startIndex, startIndex + itemsPerPage);

  // Reset to first page when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterStatus]);

  const toggleCategoryExpansion = (categoryId: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(categoryId)) {
      newExpanded.delete(categoryId);
    } else {
      newExpanded.add(categoryId);
    }
    setExpandedCategories(newExpanded);
  };

  const getCategoryStats = (category: CategoryWithSubcategories) => {
    return {
      subcategoriesCount: category.subcategories.length,
      avgResponseTime: category.subcategories.length > 0 
        ? Math.round(category.subcategories.reduce((sum, sub) => sum + sub.response_time_hours, 0) / category.subcategories.length)
        : 0,
      avgResolutionTime: category.subcategories.length > 0
        ? Math.round(category.subcategories.reduce((sum, sub) => sum + sub.resolution_time_hours, 0) / category.subcategories.length)
        : 0
    };
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">Category Management</h2>
        <div className="text-center py-8">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Enhanced Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Category Management</h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Manage ticket categories and subcategories with advanced features
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
            className="border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            {viewMode === 'grid' ? <List className="h-4 w-4" /> : <Grid3X3 className="h-4 w-4" />}
          </Button>
          <Button 
            onClick={() => setIsCategoryDialogOpen(true)} 
            className="bg-blue-600 hover:bg-blue-700"
          >
                <Plus className="h-4 w-4 mr-2" />
            Add Category
              </Button>
        </div>
      </div>

      {/* Search and Filter Bar */}
      <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search categories and subcategories..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
              />
            </div>
            <Select value={filterStatus} onValueChange={(value: any) => setFilterStatus(value)}>
              <SelectTrigger className="w-full sm:w-48 bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600">
                <SelectItem value="all" className="text-gray-900 dark:text-white">All Categories</SelectItem>
                <SelectItem value="enabled" className="text-gray-900 dark:text-white">Enabled Only</SelectItem>
                <SelectItem value="disabled" className="text-gray-900 dark:text-white">Disabled Only</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Statistics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 dark:text-gray-400 text-sm">Total Categories</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{categories.length}</p>
              </div>
              <div className="h-10 w-10 bg-blue-600 rounded-lg flex items-center justify-center">
                <Grid3X3 className="h-5 w-5 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 dark:text-gray-400 text-sm">Enabled</p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {categories.filter(c => c.is_enabled).length}
                </p>
              </div>
              <div className="h-10 w-10 bg-green-600 rounded-lg flex items-center justify-center">
                <Eye className="h-5 w-5 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 dark:text-gray-400 text-sm">Disabled</p>
                <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                  {categories.filter(c => !c.is_enabled).length}
                </p>
              </div>
              <div className="h-10 w-10 bg-red-600 rounded-lg flex items-center justify-center">
                <EyeOff className="h-5 w-5 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 dark:text-gray-400 text-sm">Subcategories</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {categories.reduce((sum, cat) => sum + cat.subcategories.length, 0)}
                </p>
              </div>
              <div className="h-10 w-10 bg-purple-600 rounded-lg flex items-center justify-center">
                <List className="h-5 w-5 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      {viewMode === 'grid' ? (
        /* Grid View */
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredCategories.map((category) => {
            const stats = getCategoryStats(category);
            return (
                             <Card key={category.id} className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 transition-colors">
                 <CardHeader className="pb-3">
                   <div className="flex items-center justify-between">
                     <div className="flex items-center space-x-3">
                       <div 
                         className="w-10 h-10 rounded-lg flex items-center justify-center text-white text-lg shadow-lg"
                         style={{ backgroundColor: category.color }}
                       >
                         {getIconEmoji(category.icon)}
                       </div>
                       <div>
                         <CardTitle className="text-gray-900 dark:text-white text-lg">{category.name}</CardTitle>
                         <div className="flex items-center space-x-2 mt-1">
                           <Badge 
                             variant={category.is_enabled ? "default" : "secondary"}
                             className={category.is_enabled ? "bg-green-600" : "bg-gray-500 dark:bg-gray-600"}
                           >
                             {category.is_enabled ? "Enabled" : "Disabled"}
                           </Badge>
                           <Badge variant="outline" className="text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-600">
                             {stats.subcategoriesCount} subs
                           </Badge>
                         </div>
                       </div>
                     </div>
                    <Switch
                      checked={category.is_enabled}
                      onCheckedChange={(checked) => toggleCategoryEnabled(category.id, checked)}
                    />
                  </div>
                </CardHeader>
                                 <CardContent className="space-y-4">
                   {category.description && (
                     <p className="text-gray-600 dark:text-gray-400 text-sm">{category.description}</p>
                   )}
                   
                   {/* Stats */}
                   <div className="grid grid-cols-2 gap-4 text-sm">
                     <div className="flex items-center space-x-2">
                       <Clock className="h-4 w-4 text-blue-500" />
                       <span className="text-gray-600 dark:text-gray-400">Avg Response:</span>
                       <span className="text-gray-900 dark:text-white">{stats.avgResponseTime}h</span>
                     </div>
                     <div className="flex items-center space-x-2">
                       <BarChart3 className="h-4 w-4 text-green-500" />
                       <span className="text-gray-600 dark:text-gray-400">Avg Resolution:</span>
                       <span className="text-gray-900 dark:text-white">{stats.avgResolutionTime}h</span>
                     </div>
                   </div>

                                    {/* Subcategories Preview */}
                  {category.subcategories.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600 dark:text-gray-400 text-sm font-medium">Subcategories</span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSubcategoryViewModal({ isOpen: true, category })}
                          className="text-blue-600 dark:text-blue-400 border-blue-600 dark:border-blue-400 hover:bg-blue-600 dark:hover:bg-blue-400 hover:text-white text-xs px-2 py-1"
                        >
                          View All ({category.subcategories.length})
                        </Button>
                      </div>
                      
                      <div className="flex flex-wrap gap-1">
                        {category.subcategories.slice(0, 4).map((sub) => (
                          <Badge key={sub.id} variant="outline" className="text-xs text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-600">
                            {sub.name}
                          </Badge>
                        ))}
                        {category.subcategories.length > 4 && (
                          <Badge variant="outline" className="text-xs text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-600">
                            +{category.subcategories.length - 4} more
                          </Badge>
                        )}
                      </div>
                   </div>
                  )}

                                     {/* Action Buttons */}
                   <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
                     <div className="flex items-center space-x-1">

                       <Button
                         variant="ghost"
                         size="sm"
                         onClick={() => setEditingCategory(category)}
                         className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                       >
                         <Edit className="h-4 w-4" />
                       </Button>
                       <Button
                         variant="ghost"
                         size="sm"
                         onClick={() => {
                           setDeleteItem({ type: 'category', id: category.id });
                           setShowDeleteDialog(true);
                         }}
                         className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
                       >
                         <Trash2 className="h-4 w-4" />
                       </Button>
                     </div>
                     <Button
                       variant="outline"
                       size="sm"
                       onClick={() => {
                         setNewSubcategory(prev => ({ ...prev, category_id: category.id }));
                         setIsSubcategoryDialogOpen(true);
                       }}
                       className="text-blue-600 dark:text-blue-400 border-blue-600 dark:border-blue-400 hover:bg-blue-600 dark:hover:bg-blue-400 hover:text-white"
                     >
                       <Plus className="h-3 w-3 mr-1" />
                       Add Sub
                     </Button>
                   </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
            ) : (
         /* Enhanced List View with Pagination */
         <div className="space-y-4">
           {/* List Header */}
           <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
             <CardContent className="p-4">
               <div className="flex items-center justify-between">
                 <div className="grid grid-cols-12 gap-4 text-sm font-medium text-gray-600 dark:text-gray-400 flex-1">
                   <div className="col-span-4">Category</div>
                   <div className="col-span-2">Status</div>
                   <div className="col-span-2">Subcategories</div>
                   <div className="col-span-2">Avg Times</div>
                   <div className="col-span-2">Actions</div>
                 </div>
                 {filteredCategories.length > 0 && (
                   <div className="text-sm text-gray-600 dark:text-gray-400 ml-4">
                     {filteredCategories.length} categories
                   </div>
                 )}
               </div>
             </CardContent>
           </Card>

           {/* List Container */}
           <div className="space-y-2">
             {paginatedCategories.map((category) => {
               const stats = getCategoryStats(category);
               const isExpanded = expandedCategories.has(category.id);
               
               return (
                 <Card 
                   key={category.id} 
                   className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:shadow-md transition-all duration-200"
                 >
                   <CardContent className="p-0">
                     {/* Main Category Row */}
                     <div className="p-4 grid grid-cols-12 gap-4 items-center">
                       {/* Category Info */}
                       <div className="col-span-4 flex items-center space-x-3">
                         <div 
                           className="w-10 h-10 rounded-lg flex items-center justify-center text-white text-lg shadow-sm flex-shrink-0"
                           style={{ backgroundColor: category.color }}
                         >
                           {getIconEmoji(category.icon)}
                         </div>
                         <div className="min-w-0 flex-1">
                           <h3 className="text-gray-900 dark:text-white font-semibold truncate">
                             {category.name}
                           </h3>
                           {category.description && (
                             <p className="text-gray-600 dark:text-gray-400 text-sm truncate">
                               {category.description}
                             </p>
                           )}
                         </div>
                       </div>

                       {/* Status */}
                       <div className="col-span-2 flex items-center space-x-2">
                         <Switch
                           checked={category.is_enabled}
                           onCheckedChange={(checked) => toggleCategoryEnabled(category.id, checked)}
                           className="scale-90"
                         />
                         <Badge 
                           variant={category.is_enabled ? "default" : "secondary"}
                           className={`text-xs ${category.is_enabled ? "bg-green-600" : "bg-gray-500 dark:bg-gray-600"}`}
                         >
                           {category.is_enabled ? "Enabled" : "Disabled"}
                         </Badge>
                       </div>

                       {/* Subcategories Count */}
                       <div className="col-span-2 flex items-center space-x-2">
                         <Badge variant="outline" className="text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-600">
                           {stats.subcategoriesCount} subs
                         </Badge>
                         {category.subcategories.length > 0 && (
                           <Button
                             variant="outline"
                             size="sm"
                             onClick={() => setSubcategoryViewModal({ isOpen: true, category })}
                             className="text-blue-600 dark:text-blue-400 border-blue-600 dark:border-blue-400 hover:bg-blue-600 dark:hover:bg-blue-400 hover:text-white text-xs px-2 py-1"
                           >
                             View All
                           </Button>
                         )}
                       </div>

                       {/* Average Times */}
                       <div className="col-span-2 space-y-1 text-sm">
                         <div className="flex items-center space-x-1">
                           <Clock className="h-3 w-3 text-blue-500" />
                           <span className="text-gray-600 dark:text-gray-400">{stats.avgResponseTime}h</span>
                         </div>
                         <div className="flex items-center space-x-1">
                           <BarChart3 className="h-3 w-3 text-green-500" />
                           <span className="text-gray-600 dark:text-gray-400">{stats.avgResolutionTime}h</span>
                         </div>
                       </div>

                       {/* Actions */}
                       <div className="col-span-2 flex items-center justify-end space-x-1">
                         <Button
                           variant="ghost"
                           size="sm"
                           onClick={() => console.log('Form builder moved to subcategory level')}
                           className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white p-2"
                           title="Form Builder"
                         >
                           <FormInput className="h-4 w-4" />
                         </Button>
                         <Button
                           variant="ghost"
                           size="sm"
                           onClick={() => setEditingCategory(category)}
                           className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 p-2"
                           title="Edit Category"
                         >
                           <Edit className="h-4 w-4" />
                         </Button>
                         <Button
                           variant="ghost"
                           size="sm"
                           onClick={() => {
                             setDeleteItem({ type: 'category', id: category.id });
                             setShowDeleteDialog(true);
                           }}
                           className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 p-2"
                           title="Delete Category"
                         >
                           <Trash2 className="h-4 w-4" />
                         </Button>
                         <Button
                           variant="outline"
                           size="sm"
                           onClick={() => {
                             setNewSubcategory(prev => ({ ...prev, category_id: category.id }));
                             setIsSubcategoryDialogOpen(true);
                           }}
                           className="text-blue-600 dark:text-blue-400 border-blue-600 dark:border-blue-400 hover:bg-blue-600 dark:hover:bg-blue-400 hover:text-white ml-2"
                           title="Add Subcategory"
                         >
                           <Plus className="h-3 w-3" />
                         </Button>
                       </div>
                     </div>


                   </CardContent>
                 </Card>
               );
             })}
           </div>

           {/* Pagination Controls */}
           {filteredCategories.length > itemsPerPage && (
             <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
               <CardContent className="p-4">
                 <div className="flex items-center justify-between">
                   <div className="text-sm text-gray-600 dark:text-gray-400">
                     Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, filteredCategories.length)} of {filteredCategories.length} categories
                   </div>
                   <div className="flex items-center space-x-2">
                     <Button
                       variant="outline"
                       size="sm"
                       onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                       disabled={currentPage === 1}
                       className="text-gray-600 dark:text-gray-400"
                     >
                       <ChevronDown className="h-4 w-4 rotate-90" />
                       Previous
                     </Button>
                     
                     <div className="flex items-center space-x-1">
                       {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                         <Button
                           key={page}
                           variant={currentPage === page ? "default" : "outline"}
                           size="sm"
                           onClick={() => setCurrentPage(page)}
                           className={`w-8 h-8 p-0 ${
                             currentPage === page 
                               ? "bg-blue-600 text-white" 
                               : "text-gray-600 dark:text-gray-400"
                           }`}
                         >
                           {page}
                         </Button>
                       ))}
                     </div>
                     
                     <Button
                       variant="outline"
                       size="sm"
                       onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                       disabled={currentPage === totalPages}
                       className="text-gray-600 dark:text-gray-400"
                     >
                       Next
                       <ChevronDown className="h-4 w-4 -rotate-90" />
                     </Button>
                   </div>
                 </div>
               </CardContent>
             </Card>
           )}

           {/* Empty State */}
           {filteredCategories.length === 0 && (
             <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
               <CardContent className="p-12 text-center">
                 <div className="text-gray-400 dark:text-gray-600 mb-4">
                   <Grid3X3 className="h-12 w-12 mx-auto" />
                 </div>
                 <h3 className="text-gray-900 dark:text-white text-lg font-semibold mb-2">
                   No categories found
                 </h3>
                 <p className="text-gray-600 dark:text-gray-400 mb-4">
                   {searchTerm || filterStatus !== 'all' 
                     ? "Try adjusting your search or filter criteria."
                     : "Get started by creating your first category."
                   }
                 </p>
                 {!searchTerm && filterStatus === 'all' && (
                   <Button 
                     onClick={() => setIsCategoryDialogOpen(true)}
                     className="bg-blue-600 hover:bg-blue-700"
                   >
                     <Plus className="h-4 w-4 mr-2" />
                     Create Category
                   </Button>
                 )}
               </CardContent>
             </Card>
           )}
         </div>
       )}

      {/* Create Category Dialog */}
      <Dialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen}>
        <DialogContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
              <DialogHeader>
            <DialogTitle className="text-gray-900 dark:text-white">Create New Category</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
              <Label className="text-gray-700 dark:text-gray-300">Name</Label>
                  <Input
                    value={newCategory.name}
                    onChange={(e) => setNewCategory(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Category name"
                className="bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
              <Label className="text-gray-700 dark:text-gray-300">Description</Label>
                  <Textarea
                    value={newCategory.description}
                    onChange={(e) => setNewCategory(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Category description"
                className="bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                <Label className="text-gray-300">Icon</Label>
                    <Select
                      value={newCategory.icon}
                      onValueChange={(value) => setNewCategory(prev => ({ ...prev, icon: value }))}
                    >
                  <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                        <SelectValue />
                      </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700">
                        {iconOptions.map((icon) => (
                      <SelectItem key={icon.value} value={icon.value} className="text-white">
                            {icon.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                <Label className="text-gray-300">Color</Label>
                    <div className="flex gap-2 flex-wrap">
                      {colorOptions.map((color) => (
                        <button
                          key={color}
                          type="button"
                          className={`w-8 h-8 rounded border-2 ${
                        newCategory.color === color ? 'border-white' : 'border-gray-600'
                          }`}
                          style={{ backgroundColor: color }}
                          onClick={() => setNewCategory(prev => ({ ...prev, color }))}
                        />
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setIsCategoryDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreateCategory}>Create</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

      {/* Create Subcategory Dialog */}
          <Dialog open={isSubcategoryDialogOpen} onOpenChange={setIsSubcategoryDialogOpen}>
        <DialogContent className="bg-gray-800 border-gray-700">
              <DialogHeader>
            <DialogTitle className="text-white">Create New Subcategory</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
              <Label className="text-gray-300">Category</Label>
                  <Select
                    value={newSubcategory.category_id}
                    onValueChange={(value) => setNewSubcategory(prev => ({ ...prev, category_id: value }))}
                  >
                <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700">
                      {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id} className="text-white">
                          {getIconEmoji(category.icon)} {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
              <Label className="text-gray-300">Name</Label>
                  <Input
                    value={newSubcategory.name}
                    onChange={(e) => setNewSubcategory(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Subcategory name"
                className="bg-gray-700 border-gray-600 text-white"
                  />
                </div>
                <div>
              <Label className="text-gray-300">Description</Label>
                  <Textarea
                    value={newSubcategory.description}
                    onChange={(e) => setNewSubcategory(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Subcategory description"
                className="bg-gray-700 border-gray-600 text-white"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                <Label className="text-gray-300">Response Time (hours)</Label>
                    <Input
                      type="number"
                      value={newSubcategory.response_time_hours}
                      onChange={(e) => setNewSubcategory(prev => ({ 
                        ...prev, 
                        response_time_hours: parseInt(e.target.value) || 24 
                      }))}
                  className="bg-gray-700 border-gray-600 text-white"
                    />
                  </div>
                  <div>
                <Label className="text-gray-300">Resolution Time (hours)</Label>
                    <Input
                      type="number"
                      value={newSubcategory.resolution_time_hours}
                      onChange={(e) => setNewSubcategory(prev => ({ 
                        ...prev, 
                        resolution_time_hours: parseInt(e.target.value) || 72 
                      }))}
                  className="bg-gray-700 border-gray-600 text-white"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setIsSubcategoryDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreateSubcategory}>Create</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

      {/* Edit Category Dialog */}
      {editingCategory && (
        <Dialog open={!!editingCategory} onOpenChange={() => setEditingCategory(null)}>
          <DialogContent className="bg-gray-800 border-gray-700">
            <DialogHeader>
              <DialogTitle className="text-white">Edit Category</DialogTitle>
            </DialogHeader>
                    <div className="space-y-4">
                      <div>
                <Label className="text-gray-300">Name</Label>
                        <Input
                          value={editingCategory.name}
                          onChange={(e) => setEditingCategory(prev => prev ? { ...prev, name: e.target.value } : null)}
                  className="bg-gray-700 border-gray-600 text-white"
                        />
                      </div>
                      <div>
                <Label className="text-gray-300">Description</Label>
                        <Textarea
                          value={editingCategory.description || ""}
                          onChange={(e) => setEditingCategory(prev => prev ? { ...prev, description: e.target.value } : null)}
                  className="bg-gray-700 border-gray-600 text-white"
                        />
                      </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-300">Icon</Label>
                  <Select
                    value={editingCategory.icon}
                    onValueChange={(value) => setEditingCategory(prev => prev ? { ...prev, icon: value } : null)}
                  >
                    <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-800 border-gray-700">
                      {iconOptions.map((icon) => (
                        <SelectItem key={icon.value} value={icon.value} className="text-white">
                          {icon.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                        </div>
                        <div>
                  <Label className="text-gray-300">Color</Label>
                  <div className="flex gap-2 flex-wrap">
                    {colorOptions.map((color) => (
                      <button
                        key={color}
                        type="button"
                        className={`w-8 h-8 rounded border-2 ${
                          editingCategory.color === color ? 'border-white' : 'border-gray-600'
                        }`}
                        style={{ backgroundColor: color }}
                        onClick={() => setEditingCategory(prev => prev ? { ...prev, color } : null)}
                      />
                    ))}
                        </div>
                      </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setEditingCategory(null)}>
                  Cancel
                        </Button>
                <Button onClick={handleUpdateCategory}>Save</Button>
                      </div>
                    </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Edit Subcategory Dialog */}
      {editingSubcategory && (
        <Dialog open={!!editingSubcategory} onOpenChange={() => setEditingSubcategory(null)}>
          <DialogContent className="bg-gray-800 border-gray-700">
            <DialogHeader>
              <DialogTitle className="text-white">Edit Subcategory</DialogTitle>
            </DialogHeader>
                    <div className="space-y-4">
                      <div>
                <Label className="text-gray-300">Name</Label>
                        <Input
                          value={editingSubcategory.name}
                          onChange={(e) => setEditingSubcategory(prev => prev ? { ...prev, name: e.target.value } : null)}
                  className="bg-gray-700 border-gray-600 text-white"
                        />
                      </div>
                      <div>
                <Label className="text-gray-300">Description</Label>
                        <Textarea
                          value={editingSubcategory.description || ""}
                          onChange={(e) => setEditingSubcategory(prev => prev ? { ...prev, description: e.target.value } : null)}
                  className="bg-gray-700 border-gray-600 text-white"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                  <Label className="text-gray-300">Response Time (hours)</Label>
                          <Input
                            type="number"
                            value={editingSubcategory.response_time_hours}
                            onChange={(e) => setEditingSubcategory(prev => prev ? { 
                              ...prev, 
                              response_time_hours: parseInt(e.target.value) || 24 
                            } : null)}
                    className="bg-gray-700 border-gray-600 text-white"
                          />
                        </div>
                        <div>
                  <Label className="text-gray-300">Resolution Time (hours)</Label>
                          <Input
                            type="number"
                            value={editingSubcategory.resolution_time_hours}
                            onChange={(e) => setEditingSubcategory(prev => prev ? { 
                              ...prev, 
                              resolution_time_hours: parseInt(e.target.value) || 72 
                            } : null)}
                    className="bg-gray-700 border-gray-600 text-white"
                          />
                        </div>
                      </div>
                      <div className="flex justify-end gap-2">
                                    <Button 
              variant="outline" 
              onClick={async () => {
                if (editingSubcategory) {
                  await openFormBuilder(editingSubcategory.id);
                  setEditingSubcategory(null);
                }
              }}
              className="text-purple-600 border-purple-600 hover:bg-purple-600 hover:text-white"
            >
              <FormInput className="h-4 w-4 mr-2" />
              Manage Fields
            </Button>
            <Button variant="outline" onClick={() => setEditingSubcategory(null)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateSubcategory}>Save</Button>
                      </div>
                    </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Subcategory Form Builder Dialog */}
      <Dialog open={isFormBuilderOpen} onOpenChange={(open) => {
        if (!open) {
          console.log('🔧 Form builder closing - clearing state');
          setDynamicFormFields([]);
          setSelectedSubcategoryForForm("");
        }
        setIsFormBuilderOpen(open);
      }}>
        <DialogContent className="bg-gray-800 border-gray-700 max-w-4xl">
          <DialogHeader>
            <DialogTitle className="text-white">Subcategory Form Builder</DialogTitle>
            <p className="text-gray-400 text-sm">Add custom form fields for this subcategory</p>
          </DialogHeader>
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {(() => {
              // Triple-layer deduplication for rendering
              const step1 = dynamicFormFields.filter((field, index, array) => 
                array.findIndex(f => f.id === field.id) === index
              );
              const step2 = step1.filter((field, index, array) => 
                array.findIndex(f => f.label === field.label) === index
              );
              const final = step2.filter(field => 
                field && field.id && field.label && field.label.trim() !== ''
              );
              
              if (final.length !== dynamicFormFields.length) {
                console.warn('🔧 Render deduplication:', dynamicFormFields.length, '→', final.length, 'fields');
              }
              
              return final;
            })().map((field, index) => (
              <div key={`${field.id}-${field.label}-${index}`} className="p-4 bg-gray-700 rounded border">
                <div className="grid grid-cols-4 gap-4 items-center">
                  <div>
                    <Label className="text-gray-300">Type</Label>
                    <Select
                      value={field.type}
                      onValueChange={(value: any) => updateFormField(field.id, { type: value })}
                    >
                      <SelectTrigger className="bg-gray-600 border-gray-500 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-800 border-gray-700">
                        <SelectItem value="text" className="text-white">Text</SelectItem>
                        <SelectItem value="textarea" className="text-white">Textarea</SelectItem>
                        <SelectItem value="select" className="text-white">Select</SelectItem>
                        <SelectItem value="checkbox" className="text-white">Checkbox</SelectItem>
                        <SelectItem value="date" className="text-white">Date</SelectItem>
                        <SelectItem value="number" className="text-white">Number</SelectItem>
                      </SelectContent>
                    </Select>
                        </div>
                        <div>
                    <Label className="text-gray-300">Label</Label>
                    <Input
                      value={field.label}
                      onChange={(e) => updateFormField(field.id, { label: e.target.value })}
                      placeholder="Field label"
                      className="bg-gray-600 border-gray-500 text-white"
                    />
                        </div>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Switch
                        checked={field.required}
                        onCheckedChange={(checked) => updateFormField(field.id, { required: checked })}
                      />
                      <Label className="text-gray-300">Required</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch
                        checked={field.enabled}
                        onCheckedChange={(checked) => updateFormField(field.id, { enabled: checked })}
                      />
                      <Label className="text-gray-300">Enabled</Label>
                    </div>
                  </div>
                        <Button
                    variant="outline"
                          size="sm"
                    onClick={() => removeFormField(field.id)}
                    className="text-red-400 border-red-400 hover:bg-red-400 hover:text-white"
                        >
                    <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                
                {field.type === 'select' && (
                  <div className="mt-4">
                    <Label className="text-gray-300">Options (comma-separated)</Label>
                    <Input
                      value={field.options?.join(', ') || ''}
                      onChange={(e) => updateFormField(field.id, { 
                        options: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                      })}
                      placeholder="Option 1, Option 2, Option 3"
                      className="bg-gray-600 border-gray-500 text-white"
                    />
                    </div>
                  )}
              </div>
            ))}
            
            <Button
              variant="outline"
              onClick={addFormField}
              className="w-full text-blue-400 border-blue-400 hover:bg-blue-400 hover:text-white"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Field
            </Button>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsFormBuilderOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveFormSchema}>Save Schema</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="bg-gray-800 border-gray-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Are you sure?</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-300">
              This action cannot be undone. This will permanently delete the {deleteItem?.type}.
              {deleteItem?.type === 'category' && (
                <div className="mt-2 text-sm text-orange-400">
                  <strong>Warning:</strong> Deleting a category will also delete all its subcategories and may affect existing tickets.
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-gray-700 text-white border-gray-600 hover:bg-gray-600">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteItem}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Delete {deleteItem?.type}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Subcategory View Modal */}
      <Dialog 
        open={subcategoryViewModal.isOpen} 
        onOpenChange={(open) => setSubcategoryViewModal({ isOpen: open, category: null })}
      >
        <DialogContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 max-w-4xl max-h-[80vh]">
          <DialogHeader className="border-b border-gray-200 dark:border-gray-700 pb-4">
            <div className="flex items-center gap-3">
              {subcategoryViewModal.category && (
                <div 
                  className="w-10 h-10 rounded-lg flex items-center justify-center text-white text-lg shadow-lg"
                  style={{ backgroundColor: subcategoryViewModal.category.color }}
                >
                  {getIconEmoji(subcategoryViewModal.category.icon)}
                </div>
              )}
              <div>
                <DialogTitle className="text-gray-900 dark:text-white text-xl">
                  {subcategoryViewModal.category?.name} - Subcategories
                </DialogTitle>
                <DialogDescription className="text-gray-600 dark:text-gray-400 text-sm mt-1">
                  View and manage all subcategories for this category. {subcategoryViewModal.category?.subcategories.length} subcategories total.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          
          <div className="overflow-y-auto max-h-[60vh] py-4">
            {subcategoryViewModal.category?.subcategories.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-gray-400 dark:text-gray-500 mb-2">
                  <List className="h-12 w-12 mx-auto" />
                </div>
                <p className="text-gray-600 dark:text-gray-400">No subcategories found</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setNewSubcategory(prev => ({ 
                      ...prev, 
                      category_id: subcategoryViewModal.category?.id || '' 
                    }));
                    setIsSubcategoryDialogOpen(true);
                  }}
                  className="mt-3 text-blue-600 dark:text-blue-400 border-blue-600 dark:border-blue-400 hover:bg-blue-600 dark:hover:bg-blue-400 hover:text-white"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add First Subcategory
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {subcategoryViewModal.category?.subcategories.map((sub) => (
                  <div 
                    key={sub.id} 
                    className="bg-gradient-to-br from-gray-50 to-white dark:from-gray-700 dark:to-gray-600 border border-gray-200 dark:border-gray-600 rounded-lg p-4 hover:shadow-lg hover:border-blue-300 dark:hover:border-blue-500 transition-all duration-200"
                  >
                    {/* Header with title and status */}
                    <div className="mb-3">
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="text-gray-900 dark:text-white font-semibold text-sm break-words flex-1 mr-2">
                          {sub.name}
                        </h4>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <Switch
                            checked={sub.is_enabled ?? true}
                            onCheckedChange={(checked) => toggleSubcategoryEnabled(sub.id, checked)}
                            className="scale-75"
                          />
                        </div>
                      </div>
                      <Badge 
                        variant={sub.is_enabled ?? true ? "default" : "secondary"}
                        className={`text-xs ${(sub.is_enabled ?? true) ? "bg-green-600" : "bg-gray-500 dark:bg-gray-600"}`}
                      >
                        {(sub.is_enabled ?? true) ? "Enabled" : "Disabled"}
                      </Badge>
                    </div>
                    
                    {sub.description && (
                      <p className="text-gray-600 dark:text-gray-400 text-xs mb-3 line-clamp-3">
                        {sub.description}
                      </p>
                    )}
                    
                    {/* Timing Information */}
                    <div className="flex items-center gap-3 text-xs mb-4">
                      <div className="flex items-center gap-1.5 px-2 py-1 bg-blue-50 dark:bg-blue-900/30 rounded-full">
                        <Clock className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                        <span className="text-blue-700 dark:text-blue-300 font-medium">
                          {sub.response_time_hours}h
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 px-2 py-1 bg-green-50 dark:bg-green-900/30 rounded-full">
                        <TrendingUp className="h-3 w-3 text-green-600 dark:text-green-400" />
                        <span className="text-green-700 dark:text-green-300 font-medium">
                          {sub.resolution_time_hours}h
                        </span>
                      </div>
                    </div>
                    
                    {/* Action Buttons */}
                    <div className="flex items-center justify-between pt-3 border-t border-gray-200 dark:border-gray-600">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openFormBuilder(sub.id)}
                        className="text-purple-600 dark:text-purple-400 border-purple-600 dark:border-purple-400 hover:bg-purple-600 dark:hover:bg-purple-400 hover:text-white text-xs px-3 py-1.5 h-auto"
                        title="Manage Form Fields"
                      >
                        <FormInput className="h-3 w-3 mr-1.5" />
                        Manage Fields
                      </Button>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingSubcategory(sub)}
                          className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/30 p-1.5 h-7 w-7 rounded-full"
                          title="Edit Subcategory"
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setDeleteItem({ type: 'subcategory', id: sub.id });
                            setShowDeleteDialog(true);
                          }}
                          className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/30 p-1.5 h-7 w-7 rounded-full"
                          title="Delete Subcategory"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          <div className="border-t border-gray-200 dark:border-gray-700 pt-4 flex items-center justify-between">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Manage subcategories for {subcategoryViewModal.category?.name}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setNewSubcategory(prev => ({ 
                    ...prev, 
                    category_id: subcategoryViewModal.category?.id || '' 
                  }));
                  setIsSubcategoryDialogOpen(true);
                }}
                className="text-blue-600 dark:text-blue-400 border-blue-600 dark:border-blue-400 hover:bg-blue-600 dark:hover:bg-blue-400 hover:text-white"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Subcategory
              </Button>
              <Button
                variant="outline"
                onClick={() => setSubcategoryViewModal({ isOpen: false, category: null })}
                className="text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}; 