import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import DatabaseService, { TicketWithDetails } from '@/lib/database';
import { supabase } from "@/lib/supabase";
import { useTicketCount } from "@/contexts/TicketCountContext";
import { Category, Subcategory, DynamicFormField } from "@/lib/database";
import { useCategoryManagement } from "@/hooks/useCategoryManagement";
import { X, Paperclip, AlertCircle, Loader2, UserPlus, Globe } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/components/ui/sonner";
import { useTranslation } from "react-i18next";
import { AttachmentPreview } from "../AttachmentPreview";
import { validateFile } from "@/lib/fileUtils";
import { CategorySuggestions } from "../CategorySuggestions";
import { useCategorySuggestion } from "@/hooks/useCategorySuggestion";

interface TicketDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ticket?: TicketWithDetails | null;
  onTicketCreated?: () => void;
}

interface Agent {
  id: string;
  full_name: string;
  email: string;
  avatar_url?: string | null;
  role: string;
}

export const TicketDialog = ({ open, onOpenChange, ticket, onTicketCreated }: TicketDialogProps) => {
  // Removed excessive logging to improve performance
  
  const { toast: sonnerToast } = useToast();
  const { triggerRefresh } = useTicketCount();
  const { userProfile } = useAuth();
  const { t } = useTranslation();

  // Permission checking functions
  const canEditTicketCore = () => {
    if (!ticket || !userProfile) return true; // Allow editing when creating new tickets
    
    // Only allow editing core fields (title, description, priority) if:
    // 1. Ticket is still in 'open' status
    // 2. User is the ticket owner OR admin
    return ticket.status === 'open' && 
           (ticket.user_id === userProfile.id || userProfile.role === 'admin');
  };

  const canEditField = (fieldName: string) => {
    if (!ticket || !userProfile) return true; // Allow editing when creating new tickets
    
    const userInputFields = [
      'title', 'description', 'priority', 'category_id', 'subcategory_id'
    ];
    
    // Users can only edit their own tickets' user input fields when status is 'open'
    if (userProfile.role === 'user') {
      return ticket.status === 'open' && 
             ticket.user_id === userProfile.id && 
             userInputFields.includes(fieldName);
    }

    // Agents cannot edit user input fields after ticket is no longer 'open'
    if (userProfile.role === 'agent') {
      if (userInputFields.includes(fieldName) && ticket.status !== 'open') {
        return false;
      }
      return ticket.assigned_to === userProfile.id;
    }

    // Admins cannot edit user input fields after ticket is no longer 'open'
    if (userProfile.role === 'admin') {
      if (userInputFields.includes(fieldName) && ticket.status !== 'open') {
        return false;
      }
      return true;
    }

    return false;
  };

  const getFieldDisabledMessage = (fieldName: string) => {
    if (!ticket || !userProfile) return null;
    
    if (!canEditField(fieldName)) {
      if (ticket.status !== 'open') {
        return "This field cannot be edited after the ticket is no longer open";
      }
      if (userProfile.role === 'agent' && ticket.assigned_to !== userProfile.id) {
        return "Only the assigned agent can edit this field";
      }
      if (userProfile.role === 'user' && ticket.user_id !== userProfile.id) {
        return "You can only edit your own tickets";
      }
    }
    return null;
  };
  const [formData, setFormData] = useState({
    title: ticket?.title || "",
    description: ticket?.description || "",
    priority: ticket?.priority || "",
    category_id: ticket?.category_id || "",
    subcategory_id: ticket?.subcategory_id || "",
    country: ticket?.country || "",
  });
  const [attachments, setAttachments] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [loadingSubcategories, setLoadingSubcategories] = useState(false);
  const [pendingSubcategoryId, setPendingSubcategoryId] = useState<string | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<string>("");
  const [loadingAgents, setLoadingAgents] = useState(false);

  // Dynamic form fields state
  const [dynamicFormFields, setDynamicFormFields] = useState<DynamicFormField[]>([]);
  const [dynamicFormValues, setDynamicFormValues] = useState<Record<string, any>>({});

  // Use category management hook for real-time sync
  const { getEnabledCategories, loading: categoriesLoading } = useCategoryManagement();

  // Category suggestions hook
  const {
    suggestions,
    topCategory,
    topSubcategory,
    explanation,
    isAnalyzing,
    hasEnoughContent,
    applySuggestion,
    dismissSuggestions,
    isDismissed
  } = useCategorySuggestion({
    title: formData.title,
    description: formData.description,
    enabled: !ticket, // Only show suggestions when creating new tickets
    debounceMs: 600
  });

  // Initialize categories on component mount
  useEffect(() => {
    getEnabledCategories();
  }, []);

  // Load subcategories when category changes
  useEffect(() => {
    console.log('🔍 Subcategory loading effect triggered');
    console.log('🔍 formData.category_id:', formData.category_id);
    console.log('🔍 pendingSubcategoryId:', pendingSubcategoryId);
    
    const loadSubcategories = async () => {
      if (!formData.category_id) {
        setSubcategories([]);
        setPendingSubcategoryId(null);
        return;
      }

      setLoadingSubcategories(true);
      try {
        const data = await DatabaseService.getSubcategories(formData.category_id);
        console.log('🔍 Loaded subcategories:', data.map(s => `${s.id}: ${s.name}`));
        setSubcategories(data);
        
        // Apply pending subcategory if it exists and is valid for this category
        if (pendingSubcategoryId) {
          console.log('🔍 Checking pending subcategory:', pendingSubcategoryId);
          console.log('🔍 Available subcategories:', data.map(s => ({ id: s.id, name: s.name })));
          
          const validSubcategory = data.find(sub => sub.id === pendingSubcategoryId);
          console.log('🔍 Found valid subcategory?', !!validSubcategory);
          console.log('🔍 Valid subcategory:', validSubcategory?.name);
          
          if (validSubcategory) {
            console.log('🎯 Applying pending subcategory to form:', validSubcategory.name);
            setFormData(prev => {
              const newData = {
                ...prev,
                subcategory_id: pendingSubcategoryId
              };
              console.log('🎯 Final form data with subcategory:', newData);
              return newData;
            });
          } else {
            console.log('❌ Pending subcategory not found in loaded subcategories');
          }
          setPendingSubcategoryId(null); // Clear pending regardless
        }
      } catch (error) {
        console.error('Error loading subcategories:', error);
        toast.error("Erro ao carregar subcategorias", {
          description: "Não foi possível carregar as subcategorias."
        });
        setSubcategories([]);
        setPendingSubcategoryId(null);
      } finally {
        setLoadingSubcategories(false);
      }
    };

    loadSubcategories();
  }, [formData.category_id, pendingSubcategoryId]);

  // Debug subcategory value changes
  useEffect(() => {
    console.log('🔍 Subcategory value changed:', formData.subcategory_id);
    if (formData.subcategory_id && subcategories.length > 0) {
      const selectedSub = subcategories.find(s => s.id === formData.subcategory_id);
      console.log('🔍 Selected subcategory:', selectedSub?.name || 'NOT FOUND');
    }
  }, [formData.subcategory_id, subcategories]);

  // Load dynamic form fields when subcategory changes
  useEffect(() => {
    const loadDynamicFormFields = async () => {
      if (!formData.subcategory_id) {
        setDynamicFormFields([]);
        setDynamicFormValues({});
        return;
      }

      try {
        const selectedSubcategory = subcategories.find(s => s.id === formData.subcategory_id);
        if (selectedSubcategory?.dynamic_form_fields) {
          const enabledFields = selectedSubcategory.dynamic_form_fields.filter(field => field.enabled);
          setDynamicFormFields(enabledFields);
          
          // Initialize form values for new fields
          const initialValues: Record<string, any> = {};
          enabledFields.forEach(field => {
            if (field.type === 'checkbox') {
              initialValues[field.id] = false;
            } else {
              initialValues[field.id] = '';
            }
          });
          setDynamicFormValues(initialValues);
        } else {
          setDynamicFormFields([]);
          setDynamicFormValues({});
        }
      } catch (error) {
        console.error('Error loading dynamic form fields:', error);
      }
    };

    loadDynamicFormFields();
  }, [formData.subcategory_id, subcategories]);

  // Load agents when dialog opens
  useEffect(() => {
    if (open && userProfile?.role === 'admin') {
      loadAgents();
    }
  }, [open]);

  const loadAgents = async () => {
    setLoadingAgents(true);
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, full_name, email, role, avatar_url')
        .in('role', ['agent', 'admin'])
        .order('full_name');

      if (error) throw error;
      setAgents(data || []);
      
      // Set current assigned agent if exists
      if (ticket?.assigned_to) {
        setSelectedAgent(ticket.assigned_to);
      }
    } catch (err) {
      console.error('Error loading agents:', err);
      toast.error(t('tickets.assign.loadAgentsError'));
    } finally {
      setLoadingAgents(false);
    }
  };

  const handleAssignAgent = async () => {
    if (!ticket || !selectedAgent) return;

    try {
      await DatabaseService.updateTicket(ticket.id, {
        assigned_to: selectedAgent,
        updated_at: new Date().toISOString()
      });

      // Create notification for the assigned agent
      await DatabaseService.createTicketNotification(ticket.id, 'assignment_changed', selectedAgent);

      toast.success(t('tickets.assign.successTitle'), {
        description: t('tickets.assign.successDescription')
      });

      if (onTicketCreated) onTicketCreated();
    } catch (err) {
      console.error('Error assigning ticket:', err);
      toast.error(t('tickets.assign.error'), {
        description: t('tickets.assign.errorDefault')
      });
    }
  };



  // Handle applying a category suggestion
  const handleApplySuggestion = (suggestion: any) => {
    console.log('🎯 Raw suggestion object:', suggestion);
    console.log('🎯 Suggestion has subcategory?', !!suggestion.subcategory);
    console.log('🎯 Subcategory object:', suggestion.subcategory);
    
    const { categoryId, subcategoryId } = applySuggestion(suggestion);
    
    console.log('🎯 Extracted IDs:', { categoryId, subcategoryId });
    
    // Set pending subcategory first if it exists
    if (subcategoryId) {
      setPendingSubcategoryId(subcategoryId);
    }
    
    // Apply category (this will trigger subcategory loading which will then apply the pending subcategory)
    setFormData(prev => {
      const newData = {
        ...prev,
        category_id: categoryId,
        subcategory_id: "" // Clear temporarily
      };
      console.log('🎯 Form data after setting category:', newData);
      return newData;
    });

    // Show toast notification
    toast.success("Category applied", {
      description: `Applied ${suggestion.category.name}${suggestion.subcategory ? ` → ${suggestion.subcategory.name}` : ''}`
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Basic validation
    if (!formData.title || !formData.description || !formData.priority || !formData.category_id) {
      const missingBasicFields = [];
      if (!formData.title) missingBasicFields.push("Title");
      if (!formData.description) missingBasicFields.push("Description");
      if (!formData.priority) missingBasicFields.push("Priority");
      if (!formData.category_id) missingBasicFields.push("Category");
      
      // Scroll to top to show the basic fields
      const dialogContent = document.querySelector('[role="dialog"] .overflow-y-auto');
      if (dialogContent) {
        dialogContent.scrollTo({ top: 0, behavior: 'smooth' });
      }
      
      toast.error("Campos obrigatórios faltando", {
        description: `Por favor, preencha os campos obrigatórios no topo do formulário: ${missingBasicFields.join(", ")}`
      });
      return;
    }

    // Validate dynamic form fields
    const missingDynamicFields = [];
    for (const field of dynamicFormFields) {
      if (field.required) {
        const value = dynamicFormValues[field.id];
        if (!value || (typeof value === 'string' && value.trim() === '')) {
          missingDynamicFields.push(field.label);
        }
      }
    }
    
    if (missingDynamicFields.length > 0) {
      toast.error("Required fields missing", {
        description: `Please fill in the required fields: ${missingDynamicFields.join(", ")}`
      });
      return;
    }



    setIsSubmitting(true);

    try {
      const user = await supabase.auth.getUser();
      
      if (!user) {
        toast.error("Erro ao obter usuário", {
          description: "Você precisa estar logado para criar um ticket."
        });
        return;
      }

      // Handle file uploads first
      const uploadedUrls = [];
      if (attachments.length > 0) {
        for (const file of attachments) {
          const { data, error } = await supabase.storage
            .from('ticket-attachments')
            .upload(`${Date.now()}-${file.name}`, file);

          if (error) {
            console.error('Error uploading file:', error);
            continue;
          }

          if (data) {
            uploadedUrls.push(data.path);
          }
        }
      }

      // Prepare ticket data
      const ticketData = {
        title: formData.title,
        description: formData.description,
        priority: formData.priority,
        category_id: formData.category_id,
        subcategory_id: formData.subcategory_id,
        country: formData.country,
        user_id: user.data.user?.id,
        // Include dynamic form field values
        dynamic_form_data: dynamicFormValues,
      };

      let createdTicket;
      
      if (ticket) {
        // Update existing ticket
        createdTicket = await DatabaseService.updateTicket(ticket.id, {
          ...ticketData,
          updated_at: new Date().toISOString()
        } as any);
        
        toast.success("Ticket atualizado!", {
          description: "O ticket foi atualizado com sucesso."
        });
      } else {
        // Create new ticket
        createdTicket = await DatabaseService.createTicket(ticketData as any, userProfile?.full_name);
        
        toast.success("Ticket criado!", {
          description: "O ticket foi criado com sucesso."
        });

        // Handle file attachments separately after ticket is created
        if (createdTicket && uploadedUrls.length > 0) {
          try {
            for (const filePath of uploadedUrls) {
              await DatabaseService.createAttachment({
                ticket_id: createdTicket.id,
                file_name: filePath.split('/').pop() || 'unknown_file',
                file_path: filePath,
                uploaded_by: user.data.user?.id
              });
            }
            console.log(`✅ Added ${uploadedUrls.length} attachments to ticket ${createdTicket.id}`);
          } catch (attachError) {
            console.error('Error adding attachments:', attachError);
            toast.error("Aviso", {
              description: "O ticket foi criado, mas houve um problema ao adicionar os anexos."
            });
          }
        }

        if (onTicketCreated) {
          onTicketCreated();
        }
      }

      // Reset form and close dialog
      setFormData({
        title: "",
        description: "",
        priority: "",
        category_id: "",
        subcategory_id: "",
        country: "",
      });
      setAttachments([]);
      setDynamicFormFields([]);
      setDynamicFormValues({});
      onOpenChange(false);

      // Trigger sidebar count refresh
      triggerRefresh();
    } catch (error) {
      console.error('Error submitting ticket:', error);
      toast.error("Erro ao salvar ticket", {
        description: "Ocorreu um erro ao salvar o ticket. Por favor, tente novamente."
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    
    // Validate each file
    const validFiles: File[] = [];
    const errors: string[] = [];
    
    files.forEach(file => {
      const validation = validateFile(file);
      if (validation.valid) {
        validFiles.push(file);
      } else {
        errors.push(`${file.name}: ${validation.error}`);
      }
    });
    
    // Show errors if any
    if (errors.length > 0) {
      toast.error("File validation errors", {
        description: errors.join('\n')
      });
    }
    
    // Add valid files
    if (validFiles.length > 0) {
      setAttachments(prev => [...prev, ...validFiles]);
    }
    
    // Reset input
    e.target.value = '';
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  // Render dynamic form fields
  const renderDynamicFormField = (field: DynamicFormField) => {
    const value = dynamicFormValues[field.id] || '';
    
    const updateValue = (newValue: any) => {
      setDynamicFormValues(prev => ({
        ...prev,
        [field.id]: newValue
      }));
    };

    switch (field.type) {
      case 'text':
        return (
          <div key={field.id}>
            <Label htmlFor={field.id}>
              {field.label} {field.required && '*'}
            </Label>
            <Input
              id={field.id}
              value={value}
              onChange={(e) => updateValue(e.target.value)}
              placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
              className="mt-1"
              required={field.required}
            />
            {field.help_text && (
              <p className="text-xs text-gray-500 mt-1">{field.help_text}</p>
            )}
          </div>
        );
      
      case 'textarea':
        return (
          <div key={field.id} className="md:col-span-2">
            <Label htmlFor={field.id}>
              {field.label} {field.required && '*'}
            </Label>
            <Textarea
              id={field.id}
              value={value}
              onChange={(e) => updateValue(e.target.value)}
              placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
              className="mt-1 min-h-[100px]"
              required={field.required}
            />
            {field.help_text && (
              <p className="text-xs text-gray-500 mt-1">{field.help_text}</p>
            )}
          </div>
        );
      
      case 'select':
        return (
          <div key={field.id}>
            <Label htmlFor={field.id}>
              {field.label} {field.required && '*'}
            </Label>
            <Select value={value} onValueChange={updateValue} required={field.required}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder={`Select ${field.label.toLowerCase()}`} />
              </SelectTrigger>
              <SelectContent>
                {field.options?.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {field.help_text && (
              <p className="text-xs text-gray-500 mt-1">{field.help_text}</p>
            )}
          </div>
        );
      
      case 'checkbox':
        return (
          <div key={field.id} className="md:col-span-2 flex items-center space-x-2">
            <input
              type="checkbox"
              id={field.id}
              checked={value || false}
              onChange={(e) => updateValue(e.target.checked)}
              className="rounded border-gray-300"
              required={field.required}
            />
            <Label htmlFor={field.id} className="text-sm">
              {field.label} {field.required && '*'}
            </Label>
            {field.help_text && (
              <p className="text-xs text-gray-500 ml-2">{field.help_text}</p>
            )}
          </div>
        );
      
      case 'date':
        return (
          <div key={field.id}>
            <Label htmlFor={field.id}>
              {field.label} {field.required && '*'}
            </Label>
            <Input
              id={field.id}
              type="date"
              value={value}
              onChange={(e) => updateValue(e.target.value)}
              className="mt-1"
              required={field.required}
            />
            {field.help_text && (
              <p className="text-xs text-gray-500 mt-1">{field.help_text}</p>
            )}
          </div>
        );
      
      case 'number':
        return (
          <div key={field.id}>
            <Label htmlFor={field.id}>
              {field.label} {field.required && '*'}
            </Label>
            <Input
              id={field.id}
              type="number"
              value={value}
              onChange={(e) => updateValue(e.target.value)}
              placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
              className="mt-1"
              required={field.required}
            />
            {field.help_text && (
              <p className="text-xs text-gray-500 mt-1">{field.help_text}</p>
            )}
          </div>
        );
      
      default:
        return null;
    }
  };

  const getCategoryIcon = (iconName: string) => {
    const iconMap: { [key: string]: string } = {
      'monitor': '💻',
      'building': '🏢',
      'users': '👥',
      'dollar-sign': '💰',
      'settings': '⚙️',
      'help-circle': '❓',
    };
    return iconMap[iconName] || '📋';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">
            {ticket ? "Edit Ticket" : "Create New Ticket"}
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Briefly describe the issue..."
                className="mt-1"
                disabled={!canEditField('title')}
                title={getFieldDisabledMessage('title') || undefined}
              />
              {getFieldDisabledMessage('title') && (
                <p className="text-xs text-gray-500 mt-1">{getFieldDisabledMessage('title')}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="country" className="flex items-center gap-2">
                <Globe className="h-4 w-4" />
                {t('tickets.fields.country')}
              </Label>
              <Select
                value={formData.country}
                onValueChange={(value) => setFormData({ ...formData, country: value })}
                disabled={!canEditField('country')}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('tickets.placeholders.selectCountry')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BR">Brazil</SelectItem>
                  <SelectItem value="US">United States</SelectItem>
                  <SelectItem value="DE">Germany</SelectItem>
                  <SelectItem value="FR">France</SelectItem>
                  <SelectItem value="GB">United Kingdom</SelectItem>
                  <SelectItem value="ES">Spain</SelectItem>
                  <SelectItem value="IT">Italy</SelectItem>
                  <SelectItem value="PT">Portugal</SelectItem>
                  <SelectItem value="NL">Netherlands</SelectItem>
                  <SelectItem value="BE">Belgium</SelectItem>
                  <SelectItem value="CH">Switzerland</SelectItem>
                  <SelectItem value="AT">Austria</SelectItem>
                  <SelectItem value="SE">Sweden</SelectItem>
                  <SelectItem value="DK">Denmark</SelectItem>
                  <SelectItem value="NO">Norway</SelectItem>
                  <SelectItem value="FI">Finland</SelectItem>
                  <SelectItem value="PL">Poland</SelectItem>
                  <SelectItem value="CZ">Czech Republic</SelectItem>
                  <SelectItem value="HU">Hungary</SelectItem>
                  <SelectItem value="RO">Romania</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="category">Category *</Label>
              <Select
                value={formData.category_id}
                onValueChange={(value) => {
                  console.log('🔥 CATEGORY CHANGED - clearing subcategory! New category:', value);
                setFormData(prev => ({ ...prev, category_id: value, subcategory_id: "" }));
                }}
                disabled={categoriesLoading || !canEditField('category_id')}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder={
                    categoriesLoading 
                      ? "Loading categories..." 
                      : getEnabledCategories().length === 0
                        ? "No categories available"
                        : "Select category"
                  } />
                </SelectTrigger>
                <SelectContent>
                  {categoriesLoading ? (
                    <SelectItem value="loading" disabled>
                      Loading categories...
                    </SelectItem>
                  ) : getEnabledCategories().length === 0 ? (
                    <SelectItem value="no-categories" disabled>
                      No categories available
                    </SelectItem>
                  ) : (
                    getEnabledCategories().map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      <div className="flex items-center gap-2">
                        <span>{getCategoryIcon(category.icon)}</span>
                        <span>{category.name}</span>
                      </div>
                    </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {getFieldDisabledMessage('category_id') && (
                <p className="text-xs text-gray-500 mt-1">{getFieldDisabledMessage('category_id')}</p>
              )}
            </div>

            <div>
              <Label htmlFor="subcategory">Subcategory</Label>
              <Select
                key={`subcategory-${formData.category_id}-${formData.subcategory_id}-${subcategories.length}`}
                value={formData.subcategory_id || ""}
                onValueChange={(value) => {
                  console.log('🎯 Manual subcategory selection:', value);
                  setFormData(prev => ({ ...prev, subcategory_id: value }));
                }}
                disabled={!formData.category_id || loadingSubcategories || !canEditField('subcategory_id')}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder={
                    !formData.category_id 
                      ? "Select category first" 
                      : loadingSubcategories 
                        ? "Loading subcategories..." 
                        : subcategories.length === 0 
                          ? "No subcategories available"
                          : "Select subcategory (optional)"
                  } />
                </SelectTrigger>
                <SelectContent>
                  {subcategories.map((subcategory) => (
                    <SelectItem key={subcategory.id} value={subcategory.id}>
                      <div className="flex flex-col">
                        <span>{subcategory.name}</span>
                        {subcategory.response_time_hours && (
                          <span className="text-xs text-gray-500">
                            Response: {subcategory.response_time_hours}h | Resolution: {subcategory.resolution_time_hours}h
                          </span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {getFieldDisabledMessage('subcategory_id') && (
                <p className="text-xs text-gray-500 mt-1">{getFieldDisabledMessage('subcategory_id')}</p>
              )}
            </div>
            
            <div>
              <Label htmlFor="priority">Priority *</Label>
              <Select
                value={formData.priority}
                onValueChange={(value) => setFormData(prev => ({ ...prev, priority: value }))}
                disabled={!canEditField('priority')}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">🟢 Low</SelectItem>
                  <SelectItem value="medium">🟡 Medium</SelectItem>
                  <SelectItem value="high">🟠 High</SelectItem>
                  <SelectItem value="urgent">🔴 Critical</SelectItem>
                </SelectContent>
              </Select>
              {getFieldDisabledMessage('priority') && (
                <p className="text-xs text-gray-500 mt-1">{getFieldDisabledMessage('priority')}</p>
              )}
            </div>
            
            <div className="md:col-span-2">
                              <Label htmlFor="description">Description *</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Describe the issue in detail, including steps to reproduce, error messages, etc."
                className="mt-1 min-h-[120px]"
                disabled={!canEditField('description')}
                title={getFieldDisabledMessage('description') || undefined}
              />
              {getFieldDisabledMessage('description') && (
                <p className="text-xs text-gray-500 mt-1">{getFieldDisabledMessage('description')}</p>
              )}
              
              {/* Category Suggestions */}
              {!ticket && (
                <div className="mt-3">
                  <CategorySuggestions
                    suggestions={suggestions}
                    topCategory={topCategory}
                    topSubcategory={topSubcategory}
                    explanation={explanation}
                    isAnalyzing={isAnalyzing}
                    hasEnoughContent={hasEnoughContent}
                    isDismissed={isDismissed}
                    onApplySuggestion={handleApplySuggestion}
                    onDismiss={dismissSuggestions}
                  />
                </div>
              )}
            </div>

            {/* Dynamic Form Fields for Selected Subcategory */}
            {dynamicFormFields.length > 0 && (
              <>
                <div className="md:col-span-2">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 border-b pb-2">
                    📝 Additional Information
                  </h3>
                </div>
                {dynamicFormFields.map(field => renderDynamicFormField(field))}
              </>
            )}


            
            <div className="md:col-span-2">
              <Label>Attachments</Label>
              <div className="mt-1 space-y-4">
                <Input
                  type="file"
                  multiple
                  onChange={handleFileChange}
                  className="hidden"
                  id="file-upload"
                  accept="image/*,.pdf,.doc,.docx,.txt,.xls,.xlsx,.mp4,.mp3,.wav"
                />
                <Label 
                  htmlFor="file-upload" 
                  className="flex items-center gap-2 px-4 py-3 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  <Paperclip className="h-5 w-5" />
                  <div className="text-center">
                    <div className="font-medium">Click to attach files or drag and drop</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Supports images, PDFs, documents, videos, and audio files (max 10MB each)
                    </div>
                  </div>
                </Label>
                
                <AttachmentPreview
                  files={attachments}
                  onRemove={removeAttachment}
                />
              </div>
            </div>
          </div>

          {/* Add Agent Assignment Section for Admins */}
          {userProfile?.role === 'admin' && (
            <div className="space-y-4 border-t pt-4">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">
                  {t('tickets.assign.title')}
                </Label>
              </div>
              
              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label htmlFor="agent">
                    {t('tickets.assign.selectAgent')}
                  </Label>
                  <Select
                    value={selectedAgent}
                    onValueChange={setSelectedAgent}
                    disabled={loadingAgents}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('tickets.assign.selectAgentPlaceholder')} />
                    </SelectTrigger>
                    <SelectContent>
                      {agents.map((agent) => (
                        <SelectItem key={agent.id} value={agent.id}>
                          {agent.full_name || agent.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  type="button"
                  onClick={handleAssignAgent}
                  disabled={!selectedAgent || loadingAgents}
                  className="w-full md:w-auto"
                >
                  {loadingAgents ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t('tickets.assign.loading')}
                    </>
                  ) : (
                    <>
                      <UserPlus className="mr-2 h-4 w-4" />
                      {t('tickets.assign.assignButton')}
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          <div className="flex justify-end space-x-4 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={isSubmitting || (ticket && !canEditTicketCore())}
              title={ticket && !canEditTicketCore() ? "Cannot edit ticket after it's no longer open" : undefined}
            >
              {isSubmitting ? "Saving..." : ticket ? "Update Ticket" : "Create Ticket"}
            </Button>
          </div>
          
          {/* Show edit restriction warning */}
          {ticket && !canEditTicketCore() && (
            <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
              <div className="flex items-center gap-2 text-yellow-800 dark:text-yellow-200">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm font-medium">Edit Restrictions</span>
              </div>
              <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                {ticket.status !== 'open' 
                  ? "This ticket can no longer be edited because it's not in 'open' status. Only comments and messages can be added."
                  : userProfile?.role === 'user' && ticket.user_id !== userProfile.id
                    ? "You can only edit your own tickets."
                    : userProfile?.role === 'agent' && ticket.assigned_to !== userProfile.id
                      ? "Only the assigned agent can edit this ticket."
                      : "You don't have permission to edit this ticket."
                }
              </p>
            </div>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
};
