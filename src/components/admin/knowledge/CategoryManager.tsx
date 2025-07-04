import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { 
  Plus, 
  Edit, 
  Trash2, 
  Tag,
  Palette,
  Save,
  X,
  FolderOpen,
  ArrowUp,
  ArrowDown
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import DatabaseService from '@/lib/database';

interface CategoryManagerProps {
  categories: any[];
  onCategoriesChange: () => void;
  userRole: string;
}

export const CategoryManager = ({ categories, onCategoriesChange, userRole }: CategoryManagerProps) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
    icon: 'FolderOpen',
    color: '#3B82F6',
    sort_order: 0,
    is_active: true
  });
  const [isLoading, setIsLoading] = useState(false);

  const iconOptions = [
    { name: 'FolderOpen', label: 'Folder' },
    { name: 'BookOpen', label: 'Book' },
    { name: 'User', label: 'User' },
    { name: 'Wrench', label: 'Wrench' },
    { name: 'FileText', label: 'Document' },
    { name: 'HelpCircle', label: 'Help' },
    { name: 'Settings', label: 'Settings' },
    { name: 'Shield', label: 'Security' },
    { name: 'Globe', label: 'Global' },
    { name: 'Lightbulb', label: 'Ideas' }
  ];

  const colorOptions = [
    '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
    '#06B6D4', '#84CC16', '#F97316', '#EC4899', '#6B7280'
  ];

  useEffect(() => {
    if (editingCategory) {
      setFormData({
        name: editingCategory.name || '',
        slug: editingCategory.slug || '',
        description: editingCategory.description || '',
        icon: editingCategory.icon || 'FolderOpen',
        color: editingCategory.color || '#3B82F6',
        sort_order: editingCategory.sort_order || 0,
        is_active: editingCategory.is_active !== false
      });
    } else {
      setFormData({
        name: '',
        slug: '',
        description: '',
        icon: 'FolderOpen',
        color: '#3B82F6',
        sort_order: categories.length,
        is_active: true
      });
    }
  }, [editingCategory, categories.length]);

  const generateSlug = (name: string) => {
    const baseSlug = name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
    
    // Check if slug already exists in current categories
    const existingSlugs = categories.map(cat => cat.slug).filter(Boolean);
    
    let finalSlug = baseSlug;
    let counter = 1;
    
    // If editing, allow the current category's slug
    const currentSlug = editingCategory?.slug;
    
    while (existingSlugs.includes(finalSlug) && finalSlug !== currentSlug) {
      finalSlug = `${baseSlug}-${counter}`;
      counter++;
    }
    
    return finalSlug;
  };

  const handleNameChange = (name: string) => {
    setFormData(prev => ({
      ...prev,
      name,
      slug: editingCategory ? prev.slug : generateSlug(name)
    }));
  };

  const validateAndFixSlug = async (slug: string, excludeId?: string): Promise<string> => {
    try {
      // Get all categories from database to check for conflicts
      const allCategories = await DatabaseService.getKnowledgeCategoriesForAdmin({ activeOnly: false });
      const existingSlugs = allCategories
        .filter(cat => cat.id !== excludeId) // Exclude current category when editing
        .map(cat => cat.slug)
        .filter(Boolean);
      
      let finalSlug = slug;
      let counter = 1;
      
      while (existingSlugs.includes(finalSlug)) {
        finalSlug = `${slug}-${counter}`;
        counter++;
      }
      
      return finalSlug;
    } catch (error) {
      console.error('Error validating slug:', error);
      return slug; // Fallback to original slug
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      alert('Category name is required');
      return;
    }

    setIsLoading(true);
    try {
      // Ensure slug is valid and unique before saving
      const validatedSlug = await validateAndFixSlug(
        formData.slug || generateSlug(formData.name),
        editingCategory?.id
      );
      
      const dataToSave = {
        ...formData,
        slug: validatedSlug
      };

      if (editingCategory) {
        await DatabaseService.updateKnowledgeCategoryForAdmin(editingCategory.id, dataToSave);
      } else {
        await DatabaseService.createKnowledgeCategoryForAdmin(dataToSave);
      }
      
      setIsDialogOpen(false);
      setEditingCategory(null);
      onCategoriesChange();
    } catch (error: any) {
      console.error('Error saving category:', error);
      
      // Handle specific error types
      if (error?.code === '23505' && error?.message?.includes('knowledge_categories_slug_key')) {
        alert('A category with this name already exists. Please choose a different name or modify the slug.');
      } else if (error?.code === '42501') {
        alert('Permission denied. Please ensure you have admin privileges.');
      } else {
        alert('Error saving category. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (categoryId: string) => {
    if (confirm('Are you sure you want to delete this category? This action cannot be undone.')) {
      try {
        await DatabaseService.deleteKnowledgeCategoryForAdmin(categoryId);
        onCategoriesChange();
      } catch (error) {
        console.error('Error deleting category:', error);
        alert('Error deleting category. Please try again.');
      }
    }
  };

  const handleEdit = (category: any) => {
    setEditingCategory(category);
    setIsDialogOpen(true);
  };

  const handleCreate = () => {
    setEditingCategory(null);
    setIsDialogOpen(true);
  };

  const updateSortOrder = async (categoryId: string, newSortOrder: number) => {
    try {
      await DatabaseService.updateKnowledgeCategoryForAdmin(categoryId, { sort_order: newSortOrder });
      onCategoriesChange();
    } catch (error) {
      console.error('Error updating sort order:', error);
    }
  };

  const moveUp = (category: any) => {
    const currentIndex = categories.findIndex(c => c.id === category.id);
    if (currentIndex > 0) {
      const prevCategory = categories[currentIndex - 1];
      updateSortOrder(category.id, prevCategory.sort_order);
      updateSortOrder(prevCategory.id, category.sort_order);
    }
  };

  const moveDown = (category: any) => {
    const currentIndex = categories.findIndex(c => c.id === category.id);
    if (currentIndex < categories.length - 1) {
      const nextCategory = categories[currentIndex + 1];
      updateSortOrder(category.id, nextCategory.sort_order);
      updateSortOrder(nextCategory.id, category.sort_order);
    }
  };

  const sortedCategories = [...categories].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Tag className="h-5 w-5" />
              Knowledge Categories
            </CardTitle>
            {userRole === 'admin' && (
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={handleCreate} className="flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    Add Category
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>
                      {editingCategory ? 'Edit Category' : 'Create New Category'}
                    </DialogTitle>
                  </DialogHeader>
                  
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Name *</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => handleNameChange(e.target.value)}
                        placeholder="Category name..."
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="slug">Slug</Label>
                      <Input
                        id="slug"
                        value={formData.slug}
                        onChange={(e) => setFormData(prev => ({ ...prev, slug: e.target.value }))}
                        placeholder="category-slug"
                      />
                      <p className="text-xs text-gray-500">
                        URL-friendly identifier. Will be auto-generated if left empty.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="description">Description</Label>
                      <Textarea
                        id="description"
                        value={formData.description}
                        onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                        placeholder="Category description..."
                        rows={3}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Icon</Label>
                      <div className="grid grid-cols-5 gap-2">
                        {iconOptions.map(icon => (
                          <Button
                            key={icon.name}
                            type="button"
                            variant={formData.icon === icon.name ? "default" : "outline"}
                            size="sm"
                            onClick={() => setFormData(prev => ({ ...prev, icon: icon.name }))}
                            className="h-10 w-10 p-0"
                            title={icon.label}
                          >
                            <FolderOpen className="h-4 w-4" />
                          </Button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Color</Label>
                      <div className="flex gap-2 flex-wrap">
                        {colorOptions.map(color => (
                          <button
                            key={color}
                            type="button"
                            className={`w-8 h-8 rounded-full border-2 ${
                              formData.color === color ? 'border-gray-400' : 'border-gray-200'
                            }`}
                            style={{ backgroundColor: color }}
                            onClick={() => setFormData(prev => ({ ...prev, color }))}
                            title={color}
                          />
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <Label htmlFor="is_active">Active</Label>
                      <Switch
                        id="is_active"
                        checked={formData.is_active}
                        onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
                      />
                    </div>

                    <div className="flex justify-end gap-2 pt-4">
                      <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button type="submit" disabled={isLoading}>
                        {isLoading ? 'Saving...' : 'Save'}
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {sortedCategories.length === 0 ? (
            <div className="text-center py-8">
              <Tag className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No categories yet</h3>
              <p className="text-gray-600">Create your first knowledge base category to get started.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {sortedCategories.map((category, index) => (
                <div
                  key={category.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center text-white"
                      style={{ backgroundColor: category.color || '#3B82F6' }}
                    >
                      <FolderOpen className="h-5 w-5" />
                    </div>
                    
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-gray-900 dark:text-white">
                          {category.name}
                        </h3>
                        {!category.is_active && (
                          <Badge variant="secondary">Inactive</Badge>
                        )}
                      </div>
                      {category.description && (
                        <p className="text-sm text-gray-600 dark:text-gray-300">
                          {category.description}
                        </p>
                      )}
                      <p className="text-xs text-gray-500">
                        Slug: {category.slug}
                      </p>
                    </div>
                  </div>

                  {userRole === 'admin' && (
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => moveUp(category)}
                        disabled={index === 0}
                        title="Move up"
                      >
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => moveDown(category)}
                        disabled={index === sortedCategories.length - 1}
                        title="Move down"
                      >
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(category)}
                        title="Edit"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(category.id)}
                        className="text-red-600 hover:text-red-700"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}; 