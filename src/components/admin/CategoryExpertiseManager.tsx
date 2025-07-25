import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Plus,
  Edit,
  Trash2,
  Users,
  Target,
  AlertCircle,
  CheckCircle,
  Save,
  X,
  Star,
  Award,
  BookOpen
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import type { Database } from '@/integrations/supabase/types';

type UserRole = Database['public']['Enums']['user_role'];

interface Agent {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
}

interface Category {
  id: string;
  name: string;
}

interface Subcategory {
  id: string;
  name: string;
  category_id: string;
}

interface CategoryExpertise {
  id: string;
  agent_id: string;
  agent_name: string;
  category_id: string;
  category_name: string;
  expertise_level: 'expert' | 'intermediate' | 'basic';
  is_primary: boolean;
}

interface SubcategoryExpertise {
  id: string;
  agent_id: string;
  agent_name: string;
  subcategory_id: string;
  subcategory_name: string;
  category_name: string;
  expertise_level: 'expert' | 'intermediate' | 'basic';
  is_primary: boolean;
}

export const CategoryExpertiseManager = () => {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [categoryExpertise, setCategoryExpertise] = useState<CategoryExpertise[]>([]);
  const [subcategoryExpertise, setSubcategoryExpertise] = useState<SubcategoryExpertise[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedExpertise, setSelectedExpertise] = useState<CategoryExpertise | null>(null);
  const [activeTab, setActiveTab] = useState('categories');

  const { toast } = useToast();
  const { userProfile } = useAuth();

  useEffect(() => {
    if (userProfile?.role === 'admin') {
      loadData();
    }
  }, [userProfile]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      await Promise.all([
        loadAgents(),
        loadCategories(),
        loadSubcategories(),
        loadCategoryExpertise(),
        loadSubcategoryExpertise()
      ]);
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: "Error",
        description: "Failed to load expertise data",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadAgents = async () => {
    const { data, error } = await supabase
      .from('users')
      .select('id, full_name, email, role')
      .in('role', ['agent', 'admin'])
      .order('full_name');

    if (error) throw error;
    setAgents(data || []);
  };

  const loadCategories = async () => {
    const { data, error } = await supabase
      .from('categories')
      .select('id, name')
      .order('name');

    if (error) throw error;
    setCategories(data || []);
  };

  const loadSubcategories = async () => {
    const { data, error } = await supabase
      .from('subcategories')
      .select('id, name, category_id')
      .order('name');

    if (error) throw error;
    setSubcategories(data || []);
  };

  const loadCategoryExpertise = async () => {
    const { data, error } = await supabase
      .from('agent_expertise_view')
      .select('*')
      .order('agent_name, category_name');

    if (error) throw error;
    setCategoryExpertise(data || []);
  };

  const loadSubcategoryExpertise = async () => {
    const { data, error } = await supabase
      .from('agent_subcategory_expertise_view')
      .select('*')
      .order('agent_name, subcategory_name');

    if (error) throw error;
    setSubcategoryExpertise(data || []);
  };

  const handleSaveExpertise = async (formData: {
    agent_id: string;
    category_id?: string;
    subcategory_id?: string;
    expertise_level: string;
    is_primary: boolean;
    type: 'category' | 'subcategory';
  }) => {
    try {
      if (formData.type === 'category') {
        await handleSaveCategoryExpertise({
          agent_id: formData.agent_id,
          category_id: formData.category_id!,
          expertise_level: formData.expertise_level,
          is_primary: formData.is_primary
        });
      } else {
        await handleSaveSubcategoryExpertise({
          agent_id: formData.agent_id,
          subcategory_id: formData.subcategory_id!,
          expertise_level: formData.expertise_level,
          is_primary: formData.is_primary
        });
      }
    } catch (error) {
      console.error('Error saving expertise:', error);
    }
  };

  const handleSaveCategoryExpertise = async (formData: {
    agent_id: string;
    category_id: string;
    expertise_level: string;
    is_primary: boolean;
  }) => {
    try {
      if (selectedExpertise) {
        // Update existing expertise
        const { error } = await supabase
          .from('agent_category_expertise')
          .update({
            expertise_level: formData.expertise_level,
            is_primary: formData.is_primary,
            updated_at: new Date().toISOString()
          })
          .eq('id', selectedExpertise.id);

        if (error) throw error;

        toast({
          title: "Expertise updated",
          description: "Agent category expertise has been updated successfully",
        });
      } else {
        // Create new expertise
        const { error } = await supabase
          .from('agent_category_expertise')
          .insert({
            agent_id: formData.agent_id,
            category_id: formData.category_id,
            expertise_level: formData.expertise_level,
            is_primary: formData.is_primary
          });

        if (error) throw error;

        toast({
          title: "Expertise added",
          description: "Agent category expertise has been added successfully",
        });
      }

      await loadCategoryExpertise();
      setIsDialogOpen(false);
      setSelectedExpertise(null);
    } catch (error: any) {
      console.error('Error saving expertise:', error);
      toast({
        title: "Error saving expertise",
        description: error.message || "Failed to save agent expertise",
        variant: "destructive",
      });
    }
  };

  const handleSaveSubcategoryExpertise = async (formData: {
    agent_id: string;
    subcategory_id: string;
    expertise_level: string;
    is_primary: boolean;
  }) => {
    try {
      // Create new subcategory expertise
      const { error } = await supabase
        .from('agent_subcategory_expertise')
        .insert({
          agent_id: formData.agent_id,
          subcategory_id: formData.subcategory_id,
          expertise_level: formData.expertise_level,
          is_primary: formData.is_primary
        });

      if (error) throw error;

      toast({
        title: "Subcategory expertise added",
        description: "Agent subcategory expertise has been added successfully",
      });

      await loadSubcategoryExpertise();
      setIsDialogOpen(false);
      setSelectedExpertise(null);
    } catch (error: any) {
      console.error('Error saving subcategory expertise:', error);
      toast({
        title: "Error saving subcategory expertise",
        description: error.message || "Failed to save agent subcategory expertise",
        variant: "destructive",
      });
    }
  };

  const handleDeleteCategoryExpertise = async (expertiseId: string) => {
    try {
      const { error } = await supabase
        .from('agent_category_expertise')
        .delete()
        .eq('id', expertiseId);

      if (error) throw error;

      await loadCategoryExpertise();
      toast({
        title: "Expertise removed",
        description: "Agent category expertise has been removed successfully",
      });
    } catch (error: any) {
      console.error('Error deleting expertise:', error);
      toast({
        title: "Error removing expertise",
        description: error.message || "Failed to remove agent expertise",
        variant: "destructive",
      });
    }
  };

  const getExpertiseIcon = (level: string) => {
    switch (level) {
      case 'expert': return <Award className="h-4 w-4 text-yellow-500" />;
      case 'intermediate': return <Target className="h-4 w-4 text-blue-500" />;
      case 'basic': return <BookOpen className="h-4 w-4 text-green-500" />;
      default: return <BookOpen className="h-4 w-4 text-gray-500" />;
    }
  };

  const getExpertiseBadgeVariant = (level: string) => {
    switch (level) {
      case 'expert': return 'default';
      case 'intermediate': return 'secondary';
      case 'basic': return 'outline';
      default: return 'outline';
    }
  };

  if (userProfile?.role !== 'admin') {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Access denied. This feature is only available to administrators.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Category Expertise Manager</h1>
          <p className="text-muted-foreground">
            Configure agent expertise levels for categories and subcategories
          </p>
        </div>
        <Button
          onClick={() => {
            setSelectedExpertise(null);
            setIsDialogOpen(true);
          }}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Expertise
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="categories">Category Expertise</TabsTrigger>
          <TabsTrigger value="subcategories">Subcategory Expertise</TabsTrigger>
          <TabsTrigger value="overview">Overview</TabsTrigger>
        </TabsList>

        <TabsContent value="categories" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Agent Category Expertise</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Agent</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Expertise Level</TableHead>
                      <TableHead>Primary</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {categoryExpertise.map((expertise) => (
                      <TableRow key={expertise.id}>
                        <TableCell className="font-medium">
                          {expertise.agent_name}
                        </TableCell>
                        <TableCell>{expertise.category_name}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getExpertiseIcon(expertise.expertise_level)}
                            <Badge variant={getExpertiseBadgeVariant(expertise.expertise_level)}>
                              {expertise.expertise_level}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          {expertise.is_primary && (
                            <Badge variant="default">
                              <Star className="h-3 w-3 mr-1" />
                              Primary
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedExpertise(expertise);
                                setIsDialogOpen(true);
                              }}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteCategoryExpertise(expertise.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="subcategories" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Agent Subcategory Expertise</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Agent</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Subcategory</TableHead>
                      <TableHead>Expertise Level</TableHead>
                      <TableHead>Primary</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {subcategoryExpertise.map((expertise) => (
                      <TableRow key={expertise.id}>
                        <TableCell className="font-medium">
                          {expertise.agent_name}
                        </TableCell>
                        <TableCell>{expertise.category_name}</TableCell>
                        <TableCell>{expertise.subcategory_name}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getExpertiseIcon(expertise.expertise_level)}
                            <Badge variant={getExpertiseBadgeVariant(expertise.expertise_level)}>
                              {expertise.expertise_level}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          {expertise.is_primary && (
                            <Badge variant="default">
                              <Star className="h-3 w-3 mr-1" />
                              Primary
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                // Handle subcategory expertise editing
                                // Similar to category expertise
                              }}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                // Handle subcategory expertise deletion
                                // Similar to category expertise
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Agents</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{agents.length}</div>
                <p className="text-xs text-muted-foreground">
                  Active agents and admins
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Category Mappings</CardTitle>
                <Target className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{categoryExpertise.length}</div>
                <p className="text-xs text-muted-foreground">
                  Agent-category assignments
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Subcategory Mappings</CardTitle>
                <BookOpen className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{subcategoryExpertise.length}</div>
                <p className="text-xs text-muted-foreground">
                  Agent-subcategory assignments
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Add/Edit Expertise Dialog */}
      <ExpertiseDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        expertise={selectedExpertise}
        agents={agents}
        categories={categories}
        subcategories={subcategories}
        onSave={handleSaveExpertise}
      />
    </div>
  );
};

// Expertise Dialog Component
interface ExpertiseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expertise: CategoryExpertise | null;
  agents: Agent[];
  categories: Category[];
  subcategories: Subcategory[];
  onSave: (data: {
    agent_id: string;
    category_id?: string;
    subcategory_id?: string;
    expertise_level: string;
    is_primary: boolean;
    type: 'category' | 'subcategory';
  }) => void;
}

const ExpertiseDialog = ({ open, onOpenChange, expertise, agents, categories, subcategories, onSave }: ExpertiseDialogProps) => {
  const [expertiseType, setExpertiseType] = useState<'category' | 'subcategory'>('category');
  const [formData, setFormData] = useState({
    agent_id: '',
    category_id: '',
    subcategory_id: '',
    expertise_level: 'intermediate',
    is_primary: false
  });

  // Filter subcategories based on selected category
  const filteredSubcategories = formData.category_id 
    ? subcategories.filter(sub => sub.category_id === formData.category_id)
    : subcategories;

  useEffect(() => {
    if (expertise) {
      setFormData({
        agent_id: expertise.agent_id,
        category_id: expertise.category_id,
        subcategory_id: '',
        expertise_level: expertise.expertise_level,
        is_primary: expertise.is_primary
      });
      setExpertiseType('category');
    } else {
      setFormData({
        agent_id: '',
        category_id: '',
        subcategory_id: '',
        expertise_level: 'intermediate',
        is_primary: false
      });
      setExpertiseType('category');
    }
  }, [expertise, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      agent_id: formData.agent_id,
      category_id: expertiseType === 'category' ? formData.category_id : undefined,
      subcategory_id: expertiseType === 'subcategory' ? formData.subcategory_id : undefined,
      expertise_level: formData.expertise_level,
      is_primary: formData.is_primary,
      type: expertiseType
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {expertise ? 'Edit Category Expertise' : 'Add Category Expertise'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="agent">Agent</Label>
            <Select
              value={formData.agent_id}
              onValueChange={(value) => setFormData(prev => ({ ...prev, agent_id: value }))}
              disabled={!!expertise}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select an agent" />
              </SelectTrigger>
              <SelectContent>
                {agents.map((agent) => (
                  <SelectItem key={agent.id} value={agent.id}>
                    {agent.full_name} ({agent.email})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Expertise Type Selection */}
          <div>
            <Label>Expertise Type</Label>
            <Tabs value={expertiseType} onValueChange={(value) => setExpertiseType(value as 'category' | 'subcategory')} className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="category">Category</TabsTrigger>
                <TabsTrigger value="subcategory">Subcategory</TabsTrigger>
              </TabsList>
              
              <TabsContent value="category" className="space-y-4 mt-4">
                <div>
                  <Label htmlFor="category">Category</Label>
                  <Select
                    value={formData.category_id}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, category_id: value }))}
                    disabled={!!expertise}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </TabsContent>
              
              <TabsContent value="subcategory" className="space-y-4 mt-4">
                <div>
                  <Label htmlFor="category_for_sub">Category (for subcategory)</Label>
                  <Select
                    value={formData.category_id}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, category_id: value, subcategory_id: '' }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a category first" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="subcategory">Subcategory</Label>
                  <Select
                    value={formData.subcategory_id}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, subcategory_id: value }))}
                    disabled={!formData.category_id}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={formData.category_id ? "Select a subcategory" : "Select category first"} />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredSubcategories.map((subcategory) => (
                        <SelectItem key={subcategory.id} value={subcategory.id}>
                          {subcategory.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </TabsContent>
            </Tabs>
          </div>

          <div>
            <Label htmlFor="expertise_level">Expertise Level</Label>
            <Select
              value={formData.expertise_level}
              onValueChange={(value) => setFormData(prev => ({ ...prev, expertise_level: value }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="basic">Basic</SelectItem>
                <SelectItem value="intermediate">Intermediate</SelectItem>
                <SelectItem value="expert">Expert</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="is_primary"
              checked={formData.is_primary}
              onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_primary: checked }))}
            />
            <Label htmlFor="is_primary">Primary specialist for this category</Label>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">
              <Save className="h-4 w-4 mr-2" />
              Save Expertise
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};