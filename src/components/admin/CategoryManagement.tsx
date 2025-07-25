import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { DatabaseService, Category, Subcategory, DynamicFormField } from "@/lib/database";
import { useCategories } from '@/hooks/useCategories';
import { useSubcategories } from '@/hooks/useSubcategories';
import {
  Plus,
  Trash2,
  FormInput,
  Grid3X3,
  List,
  AlertTriangle,
  Wifi,
  WifiOff
} from "lucide-react";
import SubcategoriesSection from './SubcategoriesSection';

// Enhanced types for the new features
interface CategoryWithSubcategories extends Category {
  subcategories: Subcategory[];
  is_enabled?: boolean;
  dynamic_form_schema?: any;
}

export const CategoryManagement = () => {
  const { toast } = useToast();
  const [categories, setCategories] = useState<CategoryWithSubcategories[]>([]);

  const { data: categoriesData, isLoading: catLoading } = useCategories();
  const { data: subcategoriesData, isLoading: subLoading } = useSubcategories();

  const loading = catLoading || subLoading;

  // UI States
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Modal states
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [isFormBuilderOpen, setIsFormBuilderOpen] = useState(false);
  const [isFormBuilderLoading, setIsFormBuilderLoading] = useState(false);
  const [formBuilderErrors, setFormBuilderErrors] = useState<string[]>([]);
  const [formBuilderWarnings, setFormBuilderWarnings] = useState<string[]>([]);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [fieldToDelete, setFieldToDelete] = useState<string | null>(null);

  // Network and error states
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string[]>>({});

  // Editing states
  const [selectedSubcategoryForForm, setSelectedSubcategoryForForm] = useState<string>("");
  const [dynamicFormFields, setDynamicFormFields] = useState<DynamicFormField[]>([]);
  const [isSavingFormSchema, setIsSavingFormSchema] = useState(false);

  const iconOptions = [
    { value: "monitor", label: "💻 Monitor", emoji: "💻" },
    { value: "building", label: "🏢 Building", emoji: "🏢" },
    { value: "users", label: "👥 Users", emoji: "👥" },
    { value: "dollar-sign", label: "💰 Dollar", emoji: "💰" },
    { value: "settings", label: "⚙️ Settings", emoji: "⚙️" },
    { value: "help-circle", label: "❓ Help", emoji: "❓" },
    { value: "folder", label: "📁 Folder", emoji: "📁" },
    { value: "shield", label: "�️ Shieeld", emoji: "�️," },
    { value: "globe", label: "🌐 Globe", emoji: "🌐" },
    { value: "zap", label: "⚡ Zap", emoji: "⚡" }
  ];

  // Network monitoring
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast({
        title: "Connection Restored",
        description: "You're back online. Changes will be saved automatically.",
        duration: 3000,
      });
    };

    const handleOffline = () => {
      setIsOnline(false);
      toast({
        title: "Connection Lost",
        description: "You're offline. Changes will be saved when connection is restored.",
        variant: "destructive",
        duration: 5000,
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [toast]);

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

  // Client-side validation functions
  const validateFormField = useCallback((field: DynamicFormField): string[] => {
    const errors: string[] = [];

    // Validate label
    if (!field.label || field.label.trim() === '') {
      errors.push('Field label is required');
    } else if (field.label.trim().length < 2) {
      errors.push('Field label must be at least 2 characters long');
    } else if (field.label.trim().length > 100) {
      errors.push('Field label must be less than 100 characters');
    }

    // Validate type
    if (!field.type || !['text', 'textarea', 'select', 'checkbox', 'date', 'number'].includes(field.type)) {
      errors.push('Invalid field type');
    }

    // Validate select field options
    if (field.type === 'select') {
      if (!field.options || !Array.isArray(field.options) || field.options.length === 0) {
        errors.push('Select fields must have at least one option');
      } else {
        const invalidOptions = field.options.filter(opt => !opt || typeof opt !== 'string' || opt.trim() === '');
        if (invalidOptions.length > 0) {
          errors.push('All select options must be non-empty strings');
        }

        // Check for duplicate options
        const uniqueOptions = new Set(field.options.map(opt => opt.toLowerCase().trim()));
        if (uniqueOptions.size !== field.options.length) {
          errors.push('Select options must be unique');
        }
      }
    }

    // Validate placeholder length
    if (field.placeholder && field.placeholder.length > 200) {
      errors.push('Placeholder text must be less than 200 characters');
    }

    // Validate help text length
    if (field.help_text && field.help_text.length > 500) {
      errors.push('Help text must be less than 500 characters');
    }

    return errors;
  }, []);

  const validateAllFormFields = useCallback((fields: DynamicFormField[]): { isValid: boolean; errors: Record<string, string[]>; warnings: string[] } => {
    const fieldErrors: Record<string, string[]> = {};
    const warnings: string[] = [];
    let isValid = true;

    // Validate individual fields
    fields.forEach(field => {
      const errors = validateFormField(field);
      if (errors.length > 0) {
        fieldErrors[field.id] = errors;
        isValid = false;
      }
    });

    // Check for duplicate labels
    const labelCounts = new Map<string, number>();
    const nonEmptyLabels = fields
      .map(f => f.label?.toLowerCase().trim())
      .filter(label => label && label.length > 0);

    nonEmptyLabels.forEach(label => {
      labelCounts.set(label, (labelCounts.get(label) || 0) + 1);
    });

    const duplicateLabels = Array.from(labelCounts.entries())
      .filter(([_, count]) => count > 1)
      .map(([label, _]) => label);

    if (duplicateLabels.length > 0) {
      warnings.push(`Duplicate field labels detected: ${duplicateLabels.join(', ')}`);
    }

    // Check for too many fields
    if (fields.length > 20) {
      warnings.push('Consider reducing the number of fields for better user experience');
    }

    // Check for fields with no enabled status
    const disabledFields = fields.filter(f => !f.enabled);
    if (disabledFields.length === fields.length && fields.length > 0) {
      warnings.push('All fields are disabled - users won\'t see any custom fields');
    }

    return { isValid, errors: fieldErrors, warnings };
  }, [validateFormField]);

  // Generate unique field ID using crypto.randomUUID or robust fallback
  const generateFieldId = useCallback(() => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return `field_${crypto.randomUUID()}`;
    }
    const timestamp = Date.now().toString(36);
    const random1 = Math.random().toString(36).substring(2, 11);
    const random2 = Math.random().toString(36).substring(2, 11);
    return `field_${timestamp}_${random1}_${random2}`;
  }, []);

  // Enhanced error handling wrapper
  const handleAsyncOperation = useCallback(async <T,>(
    operation: () => Promise<T>,
    successMessage: string,
    errorMessage: string,
    onSuccess?: (result: T) => void
  ): Promise<T | null> => {
    try {
      // Check network connectivity
      if (!isOnline) {
        toast({
          title: "No Internet Connection",
          description: "Please check your internet connection and try again.",
          variant: "destructive",
        });
        return null;
      }

      const result = await operation();

      toast({
        title: "Success",
        description: successMessage,
      });

      if (onSuccess) {
        onSuccess(result);
      }

      return result;
    } catch (error) {
      console.error('Operation failed:', error);

      let errorDescription = errorMessage;

      // Handle specific error types
      if (error instanceof Error) {
        if (error.message.includes('not found')) {
          errorDescription = "The requested item was not found. It may have been deleted.";
        } else if (error.message.includes('network') || error.message.includes('fetch')) {
          errorDescription = "Network error occurred. Please check your connection and try again.";
        } else if (error.message.includes('validation')) {
          errorDescription = `Validation error: ${error.message}`;
        } else if (error.message.includes('duplicate')) {
          errorDescription = `Duplicate data detected: ${error.message}`;
        } else if (error.message.includes('permission') || error.message.includes('unauthorized')) {
          errorDescription = "You don't have permission to perform this action.";
        } else if (error.message.trim() !== '') {
          errorDescription = error.message;
        }
      }

      toast({
        title: "Error",
        description: errorDescription,
        variant: "destructive",
      });

      return null;
    }
  }, [isOnline, toast]);

  const addFormField = useCallback(() => {
    // Check if we're at the maximum field limit
    if (dynamicFormFields.length >= 20) {
      toast({
        title: "Maximum Fields Reached",
        description: "You can have a maximum of 20 custom fields per subcategory.",
        variant: "destructive",
      });
      return;
    }

    const newField: DynamicFormField = {
      id: generateFieldId(),
      type: 'text',
      label: '',
      required: false,
      enabled: true
    };

    setDynamicFormFields(prev => [...prev, newField]);
    setHasUnsavedChanges(true);

    // Clear any existing validation errors for this field
    setValidationErrors(prev => {
      const updated = { ...prev };
      delete updated[newField.id];
      return updated;
    });
  }, [generateFieldId, dynamicFormFields.length, toast]);

  const updateFormField = useCallback((fieldId: string, updates: Partial<DynamicFormField>) => {
    setDynamicFormFields(prev =>
      prev.map(field =>
        field.id === fieldId ? { ...field, ...updates } : field
      )
    );
    setHasUnsavedChanges(true);

    // Validate the updated field
    const updatedField = dynamicFormFields.find(f => f.id === fieldId);
    if (updatedField) {
      const mergedField = { ...updatedField, ...updates };
      const fieldErrors = validateFormField(mergedField);

      setValidationErrors(prev => ({
        ...prev,
        [fieldId]: fieldErrors
      }));
    }
  }, [dynamicFormFields, validateFormField]);

  const confirmRemoveFormField = useCallback((fieldId: string) => {
    const field = dynamicFormFields.find(f => f.id === fieldId);
    if (!field) return;

    // If field has no label (empty field), remove immediately
    if (!field.label || field.label.trim() === '') {
      removeFormField(fieldId);
      return;
    }

    // Show confirmation dialog for fields with content
    setFieldToDelete(fieldId);
    setShowDeleteConfirmation(true);
  }, [dynamicFormFields]);

  const removeFormField = useCallback((fieldId: string) => {
    setDynamicFormFields(prev => prev.filter(field => field.id !== fieldId));
    setHasUnsavedChanges(true);

    // Clear validation errors for this field
    setValidationErrors(prev => {
      const updated = { ...prev };
      delete updated[fieldId];
      return updated;
    });

    toast({
      title: "Success",
      description: "Field removed successfully",
    });

    // Close confirmation dialog
    setShowDeleteConfirmation(false);
    setFieldToDelete(null);
  }, [toast]);

  const openFormBuilder = async (subcategoryId: string) => {
    setSelectedSubcategoryForForm(subcategoryId);
    setIsFormBuilderLoading(true);
    setFormBuilderErrors([]);
    setFormBuilderWarnings([]);
    setValidationErrors({});
    setHasUnsavedChanges(false);

    const result = await handleAsyncOperation(
      () => DatabaseService.getSubcategoryFormFields(subcategoryId),
      "Form fields loaded successfully",
      "Failed to load form fields",
      (formFields) => {
        setDynamicFormFields(formFields || []);

        // Validate loaded fields and show warnings if needed
        if (formFields && formFields.length > 0) {
          const validation = validateAllFormFields(formFields);
          if (validation.warnings.length > 0) {
            setFormBuilderWarnings(validation.warnings);
          }
          if (!validation.isValid) {
            setValidationErrors(validation.errors);
          }
        }
      }
    );

    if (!result) {
      setFormBuilderErrors(['Failed to load form fields. Please try again.']);
      setDynamicFormFields([]);
    }

    setIsFormBuilderLoading(false);
    setIsFormBuilderOpen(true);
  };

  const saveFormSchema = async () => {
    if (isSavingFormSchema) return;

    // Validate all fields before saving
    const validation = validateAllFormFields(dynamicFormFields);

    if (!validation.isValid) {
      setValidationErrors(validation.errors);
      setFormBuilderErrors(['Please fix the validation errors before saving.']);
      toast({
        title: "Validation Error",
        description: "Please fix the field errors before saving.",
        variant: "destructive",
      });
      return;
    }

    // Show warnings but allow saving
    if (validation.warnings.length > 0) {
      setFormBuilderWarnings(validation.warnings);
    }

    setIsSavingFormSchema(true);
    setFormBuilderErrors([]);

    // Filter out fields with empty labels
    const cleanedFields = dynamicFormFields.filter(field => field.label && field.label.trim() !== '');

    const result = await handleAsyncOperation(
      () => DatabaseService.saveSubcategoryFormFields(selectedSubcategoryForForm, cleanedFields),
      "Form fields saved successfully",
      "Failed to save form fields",
      () => {
        setIsFormBuilderOpen(false);
        setHasUnsavedChanges(false);
        setValidationErrors({});
        setFormBuilderWarnings([]);
        setDynamicFormFields([]);
        setSelectedSubcategoryForForm("");
      }
    );

    if (!result) {
      setFormBuilderErrors(['Failed to save form fields. Please try again.']);
    }

    setIsSavingFormSchema(false);
  };

  const getIconEmoji = (iconName: string) => {
    const icon = iconOptions.find(opt => opt.value === iconName);
    return icon?.emoji || "📁";
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
          <div className="flex items-center gap-3">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Category Management</h2>
            {/* Network Status Indicator */}
            <div className="flex items-center gap-2">
              {isOnline ? (
                <Wifi className="h-5 w-5 text-green-500" title="Online" />
              ) : (
                <WifiOff className="h-5 w-5 text-red-500" title="Offline" />
              )}
              {hasUnsavedChanges && (
                <div className="flex items-center gap-1 text-amber-500">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="text-sm">Unsaved changes</span>
                </div>
              )}
            </div>
          </div>
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
            disabled={!isOnline}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Category
          </Button>
        </div>
      </div>

      {/* Categories Display */}
      <div className={`${viewMode === 'grid'
        ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6'
        : 'space-y-4'
        }`}>
        {categories.map((category) => (
          <Card
            key={category.id}
            className={`group relative overflow-hidden transition-all duration-200 hover:shadow-lg hover:scale-[1.02] ${viewMode === 'grid'
                ? 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
              }`}
          >
            {/* Category Header */}
            <CardHeader className={`${viewMode === 'grid' ? 'pb-4' : 'pb-3'}`}>
              <div className={`flex items-center ${viewMode === 'grid' ? 'flex-col text-center space-y-3' : 'space-x-4'}`}>
                {/* Category Icon */}
                <div className="relative">
                  <div
                    className={`${viewMode === 'grid' ? 'w-16 h-16' : 'w-12 h-12'} rounded-xl flex items-center justify-center text-white shadow-lg transition-transform group-hover:scale-110`}
                    style={{ backgroundColor: category.color }}
                  >
                    <span className={`${viewMode === 'grid' ? 'text-2xl' : 'text-xl'}`}>
                      {getIconEmoji(category.icon)}
                    </span>
                  </div>
                  {/* Status Indicator */}
                  <div className={`absolute -top-1 -right-1 w-4 h-4 rounded-full border-2 border-white dark:border-gray-800 ${category.is_enabled ? 'bg-green-500' : 'bg-gray-400'
                    }`} />
                </div>

                {/* Category Info */}
                <div className={`${viewMode === 'grid' ? 'text-center' : 'flex-1'}`}>
                  <CardTitle className={`text-gray-900 dark:text-white ${viewMode === 'grid' ? 'text-xl mb-2' : 'text-lg mb-1'}`}>
                    {category.name}
                  </CardTitle>

                  <div className="flex items-center gap-2 justify-center">
                    <Badge
                      variant={category.is_enabled ? "default" : "secondary"}
                      className={`${category.is_enabled
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                          : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                        } text-xs px-2 py-1`}
                    >
                      {category.is_enabled ? "Active" : "Inactive"}
                    </Badge>

                    {category.subcategories.length > 0 && (
                      <Badge variant="outline" className="text-xs px-2 py-1">
                        {category.subcategories.length} subcategories
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Quick Actions (List View Only) */}
                {viewMode === 'list' && (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Description */}
              {category.description && (
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                  <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
                    {category.description}
                  </p>
                </div>
              )}

              {/* Subcategories Section */}
              {category.subcategories.length > 0 ? (
                <SubcategoriesSection 
                  category={category}
                  subcategories={category.subcategories}
                  onManageFields={openFormBuilder}
                  isOnline={isOnline}
                />
              ) : (
                <div className="text-center py-6 border-2 border-dashed border-gray-200 dark:border-gray-600 rounded-lg">
                  <div className="text-gray-400 dark:text-gray-500 mb-2">
                    <Plus className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                    No subcategories yet
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    disabled={!isOnline}
                  >
                    Add Subcategory
                  </Button>
                </div>
              )}

              {/* Category Stats (Grid View Only) */}
              {viewMode === 'grid' && (
                <div className="pt-3 border-t border-gray-200 dark:border-gray-600">
                  <div className="grid grid-cols-2 gap-4 text-center">
                    <div>
                      <div className="text-lg font-semibold text-gray-900 dark:text-white">
                        {category.subcategories.length}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        Subcategories
                      </div>
                    </div>
                    <div>
                      <div className="text-lg font-semibold text-gray-900 dark:text-white">
                        {category.subcategories.reduce((acc, sub) => acc + (sub.dynamic_form_fields?.length || 0), 0)}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        Custom Fields
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>

            {/* Hover Overlay for Grid View */}
            {viewMode === 'grid' && (
              <div className="absolute inset-0 bg-gradient-to-t from-black/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
            )}
          </Card>
        ))}
      </div>

      {/* Empty State */}
      {categories.length === 0 && (
        <div className="text-center py-12">
          <div className="mx-auto w-24 h-24 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
            <Grid3X3 className="h-12 w-12 text-gray-400 dark:text-gray-500" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            No categories yet
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-md mx-auto">
            Get started by creating your first category to organize support tickets effectively.
          </p>
          <Button
            onClick={() => setIsCategoryDialogOpen(true)}
            className="bg-blue-600 hover:bg-blue-700"
            disabled={!isOnline}
          >
            <Plus className="h-4 w-4 mr-2" />
            Create First Category
          </Button>
        </div>
      )}

      {/* Form Builder Dialog */}
      <Dialog open={isFormBuilderOpen} onOpenChange={(open) => {
        if (!open) {
          if (hasUnsavedChanges) {
            const confirmClose = window.confirm(
              "You have unsaved changes. Are you sure you want to close without saving?"
            );
            if (!confirmClose) return;
          }
          setDynamicFormFields([]);
          setFormBuilderErrors([]);
          setFormBuilderWarnings([]);
          setValidationErrors({});
          setSelectedSubcategoryForForm("");
          setHasUnsavedChanges(false);
        }
        setIsFormBuilderOpen(open);
      }}>
        <DialogContent className="bg-gray-800 border-gray-700 max-w-4xl">
          <DialogHeader>
            <DialogTitle className="text-white">Form Builder</DialogTitle>
            <DialogDescription className="text-gray-300">
              Configure custom form fields for this subcategory
            </DialogDescription>
          </DialogHeader>

          {/* Loading State */}
          {isFormBuilderLoading && (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400"></div>
              <span className="ml-3 text-gray-300">Loading form fields...</span>
            </div>
          )}

          {/* Error Display */}
          {formBuilderErrors.length > 0 && (
            <div className="bg-red-900/20 border border-red-500 rounded-md p-4 mb-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-4 w-4 text-red-400" />
                <h4 className="text-red-400 font-medium">Errors:</h4>
              </div>
              <ul className="text-red-300 text-sm space-y-1">
                {formBuilderErrors.map((error, index) => (
                  <li key={index}>• {error}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Warning Display */}
          {formBuilderWarnings.length > 0 && (
            <div className="bg-amber-900/20 border border-amber-500 rounded-md p-4 mb-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-4 w-4 text-amber-400" />
                <h4 className="text-amber-400 font-medium">Warnings:</h4>
              </div>
              <ul className="text-amber-300 text-sm space-y-1">
                {formBuilderWarnings.map((warning, index) => (
                  <li key={index}>• {warning}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Form Fields */}
          {!isFormBuilderLoading && (
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {dynamicFormFields.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <FormInput className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No form fields configured yet.</p>
                  <p className="text-sm">Click "Add Field" to get started.</p>
                </div>
              ) : (
                dynamicFormFields.map((field, index) => (
                  <div key={`field-${field.id}-${index}`} className="p-4 bg-gray-700 rounded border">
                    {/* Field Validation Errors */}
                    {validationErrors[field.id] && validationErrors[field.id].length > 0 && (
                      <div className="mb-3 p-2 bg-red-900/20 border border-red-500 rounded text-sm">
                        <div className="flex items-center gap-1 mb-1">
                          <AlertTriangle className="h-3 w-3 text-red-400" />
                          <span className="text-red-400 font-medium">Field Errors:</span>
                        </div>
                        <ul className="text-red-300 text-xs space-y-1">
                          {validationErrors[field.id].map((error, errorIndex) => (
                            <li key={errorIndex}>• {error}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Field Type */}
                      <div>
                        <Label className="text-gray-300">Type</Label>
                        <Select
                          value={field.type}
                          onValueChange={(value) => updateFormField(field.id, { type: value as any })}
                        >
                          <SelectTrigger className="bg-gray-600 border-gray-500 text-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="text">Text</SelectItem>
                            <SelectItem value="textarea">Textarea</SelectItem>
                            <SelectItem value="select">Select</SelectItem>
                            <SelectItem value="checkbox">Checkbox</SelectItem>
                            <SelectItem value="date">Date</SelectItem>
                            <SelectItem value="number">Number</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Field Label */}
                      <div>
                        <Label className="text-gray-300">Label</Label>
                        <Input
                          value={field.label}
                          onChange={(e) => updateFormField(field.id, { label: e.target.value })}
                          className="bg-gray-600 border-gray-500 text-white"
                          placeholder="Enter field label"
                        />
                      </div>

                      {/* Field Options */}
                      <div className="flex items-center space-x-4">
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

                      <div className="flex justify-end">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => confirmRemoveFormField(field.id)}
                          className="text-red-400 hover:text-red-300"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Select Options */}
                    {field.type === 'select' && (
                      <div className="mt-3">
                        <Label className="text-gray-300">Options (comma-separated)</Label>
                        <Input
                          value={field.options?.join(', ') || ''}
                          onChange={(e) => updateFormField(field.id, { 
                            options: e.target.value.split(',').map(opt => opt.trim()).filter(opt => opt.length > 0)
                          })}
                          className="bg-gray-600 border-gray-500 text-white"
                          placeholder="Option 1, Option 2, Option 3"
                        />
                      </div>
                    )}

                    {/* Placeholder */}
                    {['text', 'textarea', 'number'].includes(field.type) && (
                      <div className="mt-3">
                        <Label className="text-gray-300">Placeholder</Label>
                        <Input
                          value={field.placeholder || ''}
                          onChange={(e) => updateFormField(field.id, { placeholder: e.target.value })}
                          className="bg-gray-600 border-gray-500 text-white"
                          placeholder="Enter placeholder text"
                        />
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* Form Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-gray-600">
            <Button
              variant="outline"
              onClick={addFormField}
              disabled={dynamicFormFields.length >= 20 || !isOnline}
              className="text-gray-300 border-gray-500 hover:bg-gray-700"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Field
            </Button>

            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                onClick={() => setIsFormBuilderOpen(false)}
                className="text-gray-300 hover:bg-gray-700"
              >
                Cancel
              </Button>
              <Button
                onClick={saveFormSchema}
                disabled={isSavingFormSchema || !isOnline}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isSavingFormSchema ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Saving...
                  </>
                ) : (
                  'Save Schema'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirmation} onOpenChange={setShowDeleteConfirmation}>
        <AlertDialogContent className="bg-gray-800 border-gray-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-400" />
              Confirm Field Deletion
            </AlertDialogTitle>
            <AlertDialogDescription className="text-gray-300">
              Are you sure you want to delete this form field? This action cannot be undone.
              {fieldToDelete && (
                <div className="mt-2 p-2 bg-gray-700 rounded text-sm">
                  <strong>Field to delete:</strong> {dynamicFormFields.find(f => f.id === fieldToDelete)?.label || 'Unnamed field'}
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setShowDeleteConfirmation(false);
                setFieldToDelete(null);
              }}
              className="bg-gray-600 text-white hover:bg-gray-500"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (fieldToDelete) {
                  removeFormField(fieldToDelete);
                }
              }}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Delete Field
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};