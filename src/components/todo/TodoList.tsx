import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { 
  Plus, 
  Clock, 
  CheckCircle, 
  User, 
  FileText,
  Timer,
  Edit,
  Trash2,
  Search,
  Calendar,
  Tag,
  Filter,
  CheckCircle2,
  Circle,
  Play,
  Pause,
  MoreHorizontal,
  AlertCircle,
  ChevronDown,
  Star,
  Zap,
  Layers,
  Link,
  CalendarDays,
  Target,
  Clock3,
  Users,
  Paperclip,
  X,
  ChevronRight,
  Bell
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useTicketCount } from "@/contexts/TicketCountContext";
import DatabaseService from '@/lib/database';
import { toast } from 'sonner';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useTranslation } from "react-i18next";

interface TodoTask {
  id: string;
  title: string;
  description?: string;
  status: "pending" | "in_progress" | "completed";
  priority: "low" | "medium" | "high" | "urgent";
  assignedTo: string;
  assignedToName: string;
  createdAt: string;
  ticketId?: string;
  ticketNumber?: string;
  ticketTitle?: string;
  ticketUserName?: string;
  timeTracking: {
    totalTime: number;
    isActive: boolean;
  };
  dueDate?: string;
  tags?: string[];
  estimatedHours?: number;
  assignedToEmail?: string;
}

interface TicketOption {
  id: string;
  ticket_number: string;
  title: string;
  status: string;
  priority: string;
  assigned_to?: string;
  assignee?: {
    id: string;
    name: string;
    email: string;
  };
}

export const TodoList = () => {
  const [tasks, setTasks] = useState<TodoTask[]>([]);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TodoTask | null>(null);
  const [activeTab, setActiveTab] = useState("all");
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPriority, setSelectedPriority] = useState<string>("all");
  const [selectedTasks, setSelectedTasks] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");
  const [availableTickets, setAvailableTickets] = useState<TicketOption[]>([]);
  const [availableUsers, setAvailableUsers] = useState<any[]>([]);
  const [taskTemplates, setTaskTemplates] = useState<any[]>([]);
  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    priority: "medium" as "low" | "medium" | "high" | "urgent",
    dueDate: "",
    ticketId: undefined as string | undefined,
    assignedTo: "",
    tags: [] as string[],
    estimatedHours: "",
    reminder: false,
    template: ""
  });
  const [tagInput, setTagInput] = useState("");
  const [createLoading, setCreateLoading] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  
  // Enhanced dialog state
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [currentTag, setCurrentTag] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [emailReminder, setEmailReminder] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  
  // Edit form state
  const [editCurrentTag, setEditCurrentTag] = useState("");
  const [editSelectedTags, setEditSelectedTags] = useState<string[]>([]);
  const [editFormErrors, setEditFormErrors] = useState<Record<string, string>>({});

  const { userProfile } = useAuth();
  const { triggerRefresh } = useTicketCount();
  const { t } = useTranslation();

  useEffect(() => {
    loadTasks();
    loadAvailableTickets();
    loadAvailableUsers();
    loadTaskTemplates();
  }, [userProfile]);

  const loadTasks = async () => {
    if (!userProfile) return;
    
    try {
      setLoading(true);
      const tasksData = await DatabaseService.getTodoTasks(userProfile.id);
      
      // Transform database data to match interface
      const transformedTasks: TodoTask[] = tasksData.map(task => ({
        id: task.id,
        title: task.title,
        description: task.description || "",
        status: task.status,
        priority: task.priority,
        assignedTo: task.assigned_to,
        assignedToName: task.assigned_user?.full_name || t('common.unknownUser'),
        assignedToEmail: task.assigned_user?.email || "",
        createdAt: task.created_at,
        ticketId: task.ticket_id,
        ticketNumber: task.ticket?.ticket_number,
        ticketTitle: task.ticket?.title,
        ticketUserName: task.ticket?.users?.full_name,
        timeTracking: {
          totalTime: task.time_tracking_total || 0,
          isActive: task.time_tracking_active || false
        },
        dueDate: task.due_date,
        tags: task.tags || [],
        estimatedHours: task.estimated_hours || 0
      }));
      
      setTasks(transformedTasks);
    } catch (error) {
      console.error('Error loading tasks:', error);
      // Show a more helpful message based on the error
      if (error instanceof Error && error.message.includes('database migration')) {
        toast.info(t('todo.databaseMigrationMessage'));
      } else {
        toast.error(t('todo.loadError'));
      }
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableTickets = async () => {
    try {
      // Load open tickets with assignee information
      const tickets = await DatabaseService.getTickets({ statusFilter: "open", limit: 50 });
      const ticketOptions: TicketOption[] = tickets.map(ticket => ({
        id: ticket.id,
        ticket_number: ticket.ticket_number || `#${ticket.id.slice(-6)}`,
        title: ticket.title,
        status: ticket.status,
        priority: ticket.priority,
        assigned_to: ticket.assigned_to,
        assignee: ticket.assignee
      }));
      setAvailableTickets(ticketOptions);
    } catch (error) {
      console.error('Error loading tickets:', error);
    }
  };

  const loadAvailableUsers = async () => {
    try {
      const users = await DatabaseService.getUsers();
      // Filter to only show agents and admins for task assignment
      const agentsAndAdmins = users.filter(user => 
        user.role === 'agent' || user.role === 'admin'
      );
      setAvailableUsers(agentsAndAdmins);
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };

  const loadTaskTemplates = async () => {
    // Common task templates to speed up creation
    const templates = [
      {
        id: "ticket_review",
        name: t('todo.templates.ticketReview.name'),
        title: t('todo.templates.ticketReview.title'),
        description: t('todo.templates.ticketReview.description'),
        estimatedHours: 0.5,
        priority: "medium"
      },
      {
        id: "user_follow_up",
        name: t('todo.templates.followUp.name'),
        title: t('todo.templates.followUp.title'),
        description: t('todo.templates.followUp.description'),
        estimatedHours: 0.25,
        priority: "high"
      },
      {
        id: "documentation",
        name: t('todo.templates.documentation.name'),
        title: t('todo.templates.documentation.title'),
        description: t('todo.templates.documentation.description'),
        estimatedHours: 1,
        priority: "low"
      },
      {
        id: "testing",
        name: t('todo.templates.testing.name'),
        title: t('todo.templates.testing.title'),
        description: t('todo.templates.testing.description'),
        estimatedHours: 0.75,
        priority: "high"
      }
    ];
    setTaskTemplates(templates);
    setTemplates(templates.map(t => ({
      id: t.id,
      title: t.name,
      description: t.description,
      icon: t.name.split(' ')[0]
    })));
  };

  const validateForm = () => {
    const errors: Record<string, string> = {};
    
    if (!newTask.title.trim()) {
      errors.title = t('todo.validation.titleRequired');
    } else if (newTask.title.length < 3) {
      errors.title = t('todo.validation.titleMinLength');
    }
    
    if (newTask.estimatedHours && (isNaN(Number(newTask.estimatedHours)) || Number(newTask.estimatedHours) <= 0)) {
      errors.estimatedHours = t('todo.validation.estimatedHoursInvalid');
    }
    
    if (newTask.dueDate) {
      const dueDate = new Date(newTask.dueDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      if (dueDate < today) {
        errors.dueDate = t('todo.validation.dueDatePast');
      }
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const applyTemplate = (templateId: string) => {
    const template = taskTemplates.find(t => t.id === templateId);
    if (template) {
      setSelectedTemplate(templateId);
      setNewTask(prev => ({
        ...prev,
        title: template.title,
        description: template.description,
        estimatedHours: template.estimatedHours.toString(),
        priority: template.priority,
        template: templateId
      }));
      setFormErrors({});
    }
  };

  const addTag = () => {
    if (currentTag.trim() && !selectedTags.includes(currentTag.trim())) {
      setSelectedTags(prev => [...prev, currentTag.trim()]);
      setNewTask(prev => ({
        ...prev,
        tags: [...prev.tags, currentTag.trim()]
      }));
      setCurrentTag("");
    }
  };

  const removeTag = (tagToRemove: string) => {
    setSelectedTags(prev => prev.filter(tag => tag !== tagToRemove));
    setNewTask(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }));
  };

  // Edit form helper functions
  const addEditTag = () => {
    if (editCurrentTag.trim() && !editSelectedTags.includes(editCurrentTag.trim())) {
      setEditSelectedTags(prev => [...prev, editCurrentTag.trim()]);
      setEditCurrentTag("");
    }
  };

  const removeEditTag = (tagToRemove: string) => {
    setEditSelectedTags(prev => prev.filter(tag => tag !== tagToRemove));
  };

  const resetForm = () => {
    setNewTask({
      title: "",
      description: "",
      priority: "medium",
      dueDate: "",
      ticketId: undefined,
      assignedTo: userProfile?.id || "",
      tags: [],
      estimatedHours: "",
      reminder: false,
      template: ""
    });
    setCurrentTag("");
    setSelectedTags([]);
    setSelectedTemplate("");
    setEmailReminder(false);
    setFormErrors({});
  };

  const handleCreateTask = async () => {
    if (!validateForm() || !userProfile) return;

    try {
      setIsCreating(true);
      
      const taskData = {
        title: newTask.title,
        description: newTask.description || undefined,
        priority: newTask.priority,
        assigned_to: newTask.assignedTo || userProfile.id,
        ticket_id: newTask.ticketId || undefined,
        due_date: newTask.dueDate || undefined,
        estimated_hours: newTask.estimatedHours ? Number(newTask.estimatedHours) : undefined,
        tags: newTask.tags.length > 0 ? newTask.tags : undefined
      };

      await DatabaseService.createTodoTask(taskData);

      resetForm();
      setIsCreateDialogOpen(false);
      await loadTasks();
      triggerRefresh();
      
      toast.success(t('todo.toast.created'));
    } catch (error) {
      console.error('Error creating task:', error);
      toast.error(t('todo.toast.error.create'));
    } finally {
      setIsCreating(false);
    }
  };

  const handleEditTask = (task: TodoTask) => {
    setEditingTask(task);
    setEditSelectedTags(task.tags || []);
    setEditCurrentTag("");
    setEditFormErrors({});
    setIsEditDialogOpen(true);
  };

  const handleUpdateTask = async (updates: { 
    title?: string; 
    description?: string; 
    status?: string; 
    priority?: string;
    due_date?: string;
    estimated_hours?: number;
    tags?: string[];
    assigned_to?: string;
    ticket_id?: string;
  }) => {
    if (!editingTask) return;

    try {
      await DatabaseService.updateTodoTask(editingTask.id, updates);
      setIsEditDialogOpen(false);
      setEditingTask(null);
      await loadTasks();
      triggerRefresh();
      
      toast.success(t('todo.toast.updated'));
    } catch (error) {
      console.error('Error updating task:', error);
      toast.error(t('todo.toast.error.update'));
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      await DatabaseService.deleteTodoTask(taskId);
      await loadTasks();
      triggerRefresh();
      
      toast.success(t('todo.toast.deleted'));
    } catch (error) {
      console.error('Error deleting task:', error);
      toast.error(t('todo.toast.error.delete'));
    }
  };

  const handleToggleTaskStatus = async (taskId: string, currentStatus: string) => {
    const newStatus = currentStatus === "completed" ? "pending" : "completed";
    try {
      await DatabaseService.updateTodoTask(taskId, { status: newStatus });
      await loadTasks();
      triggerRefresh();
    } catch (error) {
      console.error('Error updating task status:', error);
    }
  };

  const handleBulkAction = async (action: string) => {
    if (selectedTasks.length === 0) return;

    try {
      for (const taskId of selectedTasks) {
        if (action === "complete") {
          await DatabaseService.updateTodoTask(taskId, { status: "completed" });
        } else if (action === "delete") {
          await DatabaseService.deleteTodoTask(taskId);
        }
      }
      
      setSelectedTasks([]);
      await loadTasks();
      triggerRefresh();
      
      toast.success(t('todo.toast.bulkSuccess', { count: selectedTasks.length }));
    } catch (error) {
      console.error('Error with bulk action:', error);
      toast.error(t('todo.toast.error.bulk'));
    }
  };

  // Helper functions (declared before use)
  const isOverdue = (dueDate?: string) => {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date();
  };

  const getDaysUntilDue = (dueDate?: string) => {
    if (!dueDate) return null;
    const due = new Date(dueDate);
    const now = new Date();
    const diffTime = due.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const filteredTasks = tasks.filter(task => {
    const matchesTab = activeTab === "all" || task.status === activeTab;
    const matchesSearch = searchTerm === "" || 
      task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (task.description && task.description.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesPriority = selectedPriority === "all" || task.priority === selectedPriority;
    
    return matchesTab && matchesSearch && matchesPriority;
  });

  const getTaskStats = () => {
    const total = tasks.length;
    const pending = tasks.filter(t => t.status === "pending").length;
    const inProgress = tasks.filter(t => t.status === "in_progress").length;
    const completed = tasks.filter(t => t.status === "completed").length;
    const overdue = tasks.filter(t => t.status !== "completed" && isOverdue(t.dueDate)).length;
    
    return { total, pending, inProgress, completed, overdue };
  };

  const stats = getTaskStats();
  const completionRate = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "urgent": return "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800";
      case "high": return "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800";
      case "medium": return "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800";
      case "low": return "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800";
      default: return "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending": return "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700";
      case "in_progress": return "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800";
      case "completed": return "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800";
      default: return "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending": return <Circle className="h-4 w-4" />;
      case "in_progress": return <Timer className="h-4 w-4" />;
      case "completed": return <CheckCircle2 className="h-4 w-4" />;
      default: return <Circle className="h-4 w-4" />;
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case "urgent": return <Zap className="h-3 w-3 text-red-500" />;
      case "high": return <AlertCircle className="h-3 w-3 text-orange-500" />;
      case "medium": return <Layers className="h-3 w-3 text-yellow-500" />;
      case "low": return <Circle className="h-3 w-3 text-green-500" />;
      default: return null;
    }
  };

  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  const formatDate = (dateString: string) => {
    const { i18n } = useTranslation();
    return new Date(dateString).toLocaleDateString(i18n.language, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const formatPriority = (priority: string) => t(`priority.${priority}`, priority);

  const formatStatus = (status: string) => {
    switch (status) {
      case "pending":
        return t('status.pending');
      case "in_progress":
        return t('status.inProgress');
      case "completed":
        return t('todo.completedLabel');
      default:
        return status;
    }
  };

  // Get available users for assignment based on the selected ticket
  const getAvailableUsersForTicket = () => {
    if (!newTask.ticketId || newTask.ticketId === 'none') {
      // If no ticket is selected, show all agents/admins
      return availableUsers;
    }

    const selectedTicket = availableTickets.find(ticket => ticket.id === newTask.ticketId);
    
    if (selectedTicket?.assignee) {
      // If ticket has an assigned agent, only allow assignment to that agent
      return availableUsers.filter(user => user.id === selectedTicket.assignee?.id);
    } else {
      // If ticket is unassigned, show all agents/admins
      return availableUsers;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-col gap-6">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white">{t('todo.manageTitle')}</h2>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              {t('todo.manageDesc')}
            </p>
          </div>
          
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-blue-600 hover:bg-blue-700 shadow-lg">
                <Plus className="h-4 w-4 mr-2" />
                {t('todo.newTask')}
              </Button>
            </DialogTrigger>
            <DialogContent className="dark:bg-gray-900 dark:border-gray-700 max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="dark:text-gray-100 flex items-center gap-2">
                  <Plus className="h-5 w-5" />
                  {t('todo.createNewTask')}
                </DialogTitle>
                <DialogDescription className="text-sm text-gray-500 dark:text-gray-400">
                  {t('todo.createNewTaskDesc')}
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-6">
                {/* Quick Templates */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-purple-500" />
                    <Label className="text-sm font-medium dark:text-gray-200">{t('todo.quickTemplates')}</Label>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {templates.map((template) => (
                      <Button
                        key={template.id}
                        variant="outline"
                        size="sm"
                        onClick={() => applyTemplate(template.id)}
                        className={`text-left h-auto p-3 flex flex-col items-start gap-1 dark:border-gray-600 dark:hover:bg-gray-700 ${
                          selectedTemplate === template.id ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : ''
                        }`}
                      >
                        <div className="flex items-center gap-2 text-sm font-medium">
                          {template.icon}
                          {template.title}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {template.description}
                        </div>
                      </Button>
                    ))}
                  </div>
                </div>

                <Separator className="dark:border-gray-700" />

                {/* Task Information */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-blue-500" />
                    <Label className="text-sm font-medium dark:text-gray-200">{t('todo.taskInfoSection')}</Label>
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="title" className="text-sm font-medium dark:text-gray-200">
                        {t('todo.taskTitleLabel')} *
                      </Label>
                      <Input
                        id="title"
                        value={newTask.title}
                        onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                        placeholder={t('todo.taskTitlePlaceholder')}
                        className={`mt-1 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100 ${
                          formErrors.title ? 'border-red-500 dark:border-red-500' : ''
                        }`}
                        autoFocus
                      />
                      {formErrors.title && (
                        <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" />
                          {formErrors.title}
                        </p>
                      )}
                    </div>
                    
                    <div>
                      <Label htmlFor="description" className="text-sm font-medium dark:text-gray-200">
                        {t('todo.descriptionLabel')}
                      </Label>
                      <Textarea
                        id="description"
                        value={newTask.description}
                        onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                        placeholder={t('todo.descriptionPlaceholder')}
                        className="mt-1 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100 min-h-20"
                        rows={3}
                      />
                    </div>
                  </div>
                </div>

                <Separator className="dark:border-gray-700" />

                {/* Priority and Time Management */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-orange-500" />
                    <Label className="text-sm font-medium dark:text-gray-200">{t('todo.priorityTimeSection')}</Label>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="priority" className="text-sm font-medium dark:text-gray-200">
                        {t('todo.priorityLabel')}
                      </Label>
                      <Select 
                        value={newTask.priority} 
                        onValueChange={(value: any) => setNewTask({ ...newTask, priority: value })}
                      >
                        <SelectTrigger className="mt-1 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="dark:bg-gray-800 dark:border-gray-600">
                          <SelectItem value="low">🟢 {t('priority.low')}</SelectItem>
                          <SelectItem value="medium">🟡 {t('priority.medium')}</SelectItem>
                          <SelectItem value="high">🟠 {t('priority.high')}</SelectItem>
                          <SelectItem value="urgent">🔴 {t('priority.urgent')}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div>
                      <Label htmlFor="dueDate" className="text-sm font-medium dark:text-gray-200">
                        {t('todo.dueDateLabel')}
                      </Label>
                      <Input
                        id="dueDate"
                        type="date"
                        value={newTask.dueDate}
                        onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })}
                        min={new Date().toISOString().split('T')[0]}
                        className={`mt-1 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100 ${
                          formErrors.dueDate ? 'border-red-500 dark:border-red-500' : ''
                        }`}
                      />
                      {formErrors.dueDate && (
                        <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" />
                          {formErrors.dueDate}
                        </p>
                      )}
                    </div>
                    
                    <div>
                      <Label htmlFor="estimatedHours" className="text-sm font-medium dark:text-gray-200">
                        {t('todo.estimatedHoursLabel')}
                      </Label>
                      <Input
                        id="estimatedHours"
                        type="number"
                        step="0.5"
                        min="0"
                        max="100"
                        value={newTask.estimatedHours || ''}
                        onChange={(e) => setNewTask({ ...newTask, estimatedHours: e.target.value })}
                        placeholder={t('todo.estimatedHoursPlaceholder')}
                        className={`mt-1 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100 ${
                          formErrors.estimatedHours ? 'border-red-500 dark:border-red-500' : ''
                        }`}
                      />
                      {formErrors.estimatedHours && (
                        <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" />
                          {formErrors.estimatedHours}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <Separator className="dark:border-gray-700" />

                {/* Linking */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Link className="h-4 w-4 text-green-500" />
                    <Label className="text-sm font-medium dark:text-gray-200">{t('todo.linkingSection')}</Label>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="ticketId" className="text-sm font-medium dark:text-gray-200">
                        {t('todo.relatedTicketLabel')}
                      </Label>
                      <Select 
                        value={newTask.ticketId || 'none'} 
                        onValueChange={(value) => {
                          const ticketId = value === 'none' ? undefined : value;
                          
                          // Find the selected ticket and auto-assign to its agent if available
                          const selectedTicket = availableTickets.find(ticket => ticket.id === ticketId);
                          
                          setNewTask(prev => ({ 
                            ...prev, 
                            ticketId,
                            // Auto-assign to the ticket's assigned agent if available
                            assignedTo: selectedTicket?.assignee?.id || prev.assignedTo
                          }));
                        }}
                      >
                        <SelectTrigger className="mt-1 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100">
                          <SelectValue placeholder={t('todo.selectTicketPlaceholder')} />
                        </SelectTrigger>
                        <SelectContent className="dark:bg-gray-800 dark:border-gray-600">
                          <SelectItem value="none">{t('todo.noTicket')}</SelectItem>
                          {availableTickets.map((ticket) => (
                            <SelectItem key={ticket.id} value={ticket.id}>
                              <div className="flex flex-col">
                                <span>#{ticket.ticket_number} - {ticket.title}</span>
                                {ticket.assignee ? (
                                  <span className="text-xs text-gray-500 dark:text-gray-400">
                                    Assigned to: {ticket.assignee.name}
                                  </span>
                                ) : (
                                  <span className="text-xs text-orange-500 dark:text-orange-400">
                                    Unassigned
                                  </span>
                                )}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {t('todo.relatedTicketDesc')} 
                        {newTask.ticketId && availableTickets.find(t => t.id === newTask.ticketId)?.assignee && 
                          " Task will be assigned to the ticket's agent."
                        }
                      </p>
                    </div>
                    
                    <div>
                      <Label htmlFor="assignedTo" className="text-sm font-medium dark:text-gray-200">
                        {t('todo.assignToLabel')}
                      </Label>
                      <Select 
                        value={newTask.assignedTo} 
                        onValueChange={(value) => setNewTask({ ...newTask, assignedTo: value })}
                      >
                        <SelectTrigger className="mt-1 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="dark:bg-gray-800 dark:border-gray-600">
                          {getAvailableUsersForTicket().map((user) => (
                            <SelectItem key={user.id} value={user.id}>
                              <div className="flex items-center gap-2">
                                <User className="h-3 w-3" />
                                {user.full_name} ({user.email})
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {newTask.ticketId && availableTickets.find(t => t.id === newTask.ticketId)?.assignee 
                          ? "Restricted to the ticket's assigned agent only."
                          : t('todo.assignToDesc')
                        }
                      </p>
                    </div>
                  </div>
                </div>

                <Separator className="dark:border-gray-700" />

                {/* Tags */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Tag className="h-4 w-4 text-purple-500" />
                    <Label className="text-sm font-medium dark:text-gray-200">{t('todo.tagsSection')}</Label>
                  </div>
                  
                  <div>
                    <div className="flex gap-2 mb-2">
                      <Input
                        value={currentTag}
                        onChange={(e) => setCurrentTag(e.target.value)}
                        placeholder={t('todo.tagPlaceholder')}
                        className="flex-1 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            addTag();
                          }
                        }}
                      />
                      <Button
                        type="button"
                        size="sm"
                        onClick={addTag}
                        disabled={!currentTag.trim()}
                        className="bg-purple-600 hover:bg-purple-700"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    
                    {selectedTags.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {selectedTags.map((tag) => (
                          <span
                            key={tag}
                            className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 text-xs rounded-md"
                          >
                            {tag}
                            <button
                              type="button"
                              onClick={() => removeTag(tag)}
                              className="hover:bg-purple-200 dark:hover:bg-purple-800/50 rounded-sm p-0.5"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                    
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {t('todo.tagsHelp')}
                    </p>
                  </div>
                </div>

                <Separator className="dark:border-gray-700" />

                {/* Notifications */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Bell className="h-4 w-4 text-blue-500" />
                    <Label className="text-sm font-medium dark:text-gray-200">{t('todo.notificationsSection')}</Label>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm dark:text-gray-200">{t('todo.emailReminderLabel')}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {t('todo.emailReminderDesc')}
                      </p>
                    </div>
                    <Switch
                      checked={emailReminder}
                      onCheckedChange={setEmailReminder}
                    />
                  </div>
                </div>

                {/* Form Actions */}
                <div className="flex justify-end gap-2 pt-4 border-t dark:border-gray-700">
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setIsCreateDialogOpen(false);
                      resetForm();
                    }}
                    className="dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                  >
                    {t('common.cancel')}
                  </Button>
                  <Button 
                    onClick={handleCreateTask} 
                    disabled={!newTask.title.trim() || isCreating}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {isCreating ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        {t('todo.creating')}
                      </>
                    ) : (
                      <>
                        <Plus className="h-4 w-4 mr-2" />
                        {t('todo.createTask')}
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card className="dark:bg-gray-800 dark:border-gray-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{t('todo.totalLabel')}</p>
                  <p className="text-2xl font-bold dark:text-white">{stats.total}</p>
                </div>
                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <Layers className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="dark:bg-gray-800 dark:border-gray-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{t('status.pending')}</p>
                  <p className="text-2xl font-bold dark:text-white">{stats.pending}</p>
                </div>
                <div className="p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
                  <Clock className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="dark:bg-gray-800 dark:border-gray-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{t('status.inProgress')}</p>
                  <p className="text-2xl font-bold dark:text-white">{stats.inProgress}</p>
                </div>
                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <Timer className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="dark:bg-gray-800 dark:border-gray-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{t('todo.completedLabel')}</p>
                  <p className="text-2xl font-bold dark:text-white">{stats.completed}</p>
                </div>
                <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                  <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="dark:bg-gray-800 dark:border-gray-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{t('todo.completionRateLabel')}</p>
                  <p className="text-2xl font-bold dark:text-white">{completionRate}%</p>
                </div>
                <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                  <Star className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                </div>
              </div>
              <Progress value={completionRate} className="mt-2 h-2" />
            </CardContent>
          </Card>
        </div>

        {/* Filters Section */}
        <Card className="dark:bg-gray-800 dark:border-gray-700">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              <div className="flex flex-col sm:flex-row gap-4 flex-1">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    placeholder={t('todo.searchPlaceholder')}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 dark:bg-gray-700 dark:border-gray-600"
                  />
                </div>
                
                <Select value={selectedPriority} onValueChange={setSelectedPriority}>
                  <SelectTrigger className="w-40 dark:bg-gray-700 dark:border-gray-600">
                    <SelectValue placeholder={t('todo.priorityFilter')} />
                  </SelectTrigger>
                  <SelectContent className="dark:bg-gray-800 dark:border-gray-600">
                    <SelectItem value="all">{t('todo.allPriorities')}</SelectItem>
                    <SelectItem value="urgent">🔴 {t('priority.urgent')}</SelectItem>
                    <SelectItem value="high">🟠 {t('priority.high')}</SelectItem>
                    <SelectItem value="medium">🟡 {t('priority.medium')}</SelectItem>
                    <SelectItem value="low">🟢 {t('priority.low')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {selectedTasks.length > 0 && (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleBulkAction("complete")}
                    className="text-green-600 border-green-600 hover:bg-green-50"
                  >
                    <CheckCircle2 className="h-4 w-4 mr-1" />
                    {t('todo.markCompleted')}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleBulkAction("delete")}
                    className="text-red-600 border-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    {t('common.delete')}
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4 dark:bg-gray-800">
          <TabsTrigger value="all" className="dark:data-[state=active]:bg-gray-700">
            {t('todo.allTab')} ({tasks.length})
          </TabsTrigger>
          <TabsTrigger value="pending" className="dark:data-[state=active]:bg-gray-700">
            {t('status.pending')} ({stats.pending})
          </TabsTrigger>
          <TabsTrigger value="in_progress" className="dark:data-[state=active]:bg-gray-700">
            {t('status.inProgress')} ({stats.inProgress})
          </TabsTrigger>
          <TabsTrigger value="completed" className="dark:data-[state=active]:bg-gray-700">
            {t('todo.completedLabel')} ({stats.completed})
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="space-y-4">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => (
                <Card key={i} className="dark:bg-gray-800 dark:border-gray-700">
                  <CardContent className="p-6">
                    <div className="animate-pulse space-y-4">
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
                      <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
                      <div className="flex gap-2">
                        <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-16"></div>
                        <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-20"></div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : filteredTasks.length === 0 ? (
            <Card className="dark:bg-gray-800 dark:border-gray-700">
              <CardContent className="py-12">
                <div className="text-center text-gray-500 dark:text-gray-400">
                  <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                    <FileText className="h-12 w-12 text-gray-400 dark:text-gray-600" />
                  </div>
                  {tasks.length === 0 ? (
                    <div className="space-y-3">
                      <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                        {t('todo.noTasksTitle')}
                      </h3>
                      <p>{t('todo.noTasksDesc')}</p>
                      <p className="text-sm">
                        {t('todo.noTasksHelp')}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                        {t('todo.noResultsTitle')}
                      </h3>
                      <p>
                        {t('todo.noResultsDesc')}
                      </p>
                      <div className="flex justify-center gap-4 mt-6 text-sm">
                        <span className="flex items-center gap-2">
                          <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                          {t('status.pending')} {stats.pending}
                        </span>
                        <span className="flex items-center gap-2">
                          <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                          {t('status.inProgress')} {stats.inProgress}
                        </span>
                        <span className="flex items-center gap-2">
                          <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                          {t('todo.completedLabel')} {stats.completed}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredTasks.map((task) => {
                const daysUntilDue = getDaysUntilDue(task.dueDate);
                const isTaskOverdue = isOverdue(task.dueDate);
                const progressPercentage = task.estimatedHours ? 
                  Math.min((task.timeTracking.totalTime / 60) / task.estimatedHours * 100, 100) : 0;
                
                return (
                  <Card 
                    key={task.id} 
                    className={`group dark:bg-gray-800 dark:border-gray-700 hover:shadow-xl hover:scale-[1.02] transition-all duration-300 cursor-pointer relative overflow-hidden ${
                      isTaskOverdue && task.status !== "completed" 
                        ? "border-l-4 border-l-red-500 shadow-red-100 dark:shadow-red-900/20" 
                        : task.status === "completed"
                        ? "border-l-4 border-l-green-500 bg-green-50/50 dark:bg-green-900/10"
                        : task.status === "in_progress"
                        ? "border-l-4 border-l-blue-500 bg-blue-50/50 dark:bg-blue-900/10"
                        : "border-l-4 border-l-gray-300 dark:border-l-gray-600"
                    }`}
                  >
                    {/* Priority indicator stripe */}
                    <div className={`absolute top-0 right-0 w-2 h-full ${
                      task.priority === "urgent" ? "bg-red-500" :
                      task.priority === "high" ? "bg-orange-500" :
                      task.priority === "medium" ? "bg-yellow-500" : "bg-green-500"
                    } opacity-60`} />

                    <CardContent className="p-5">
                      {/* Header Section */}
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-start gap-3 flex-1">
                          <Checkbox
                            checked={selectedTasks.includes(task.id)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedTasks([...selectedTasks, task.id]);
                              } else {
                                setSelectedTasks(selectedTasks.filter(id => id !== task.id));
                              }
                            }}
                            className="mt-1 data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500"
                          />
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start gap-3 mb-3">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleToggleTaskStatus(task.id, task.status)}
                                className="h-7 w-7 p-0 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
                              >
                                {task.status === "completed" ? (
                                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                                ) : task.status === "in_progress" ? (
                                  <Play className="h-4 w-4 text-blue-500" />
                                ) : (
                                  <Circle className="h-5 w-5 text-gray-400" />
                                )}
                              </Button>
                              
                              <div className="flex-1">
                                <h4 className={`font-semibold text-base leading-tight mb-1 ${
                                  task.status === "completed" 
                                    ? "line-through text-gray-500 dark:text-gray-400" 
                                    : "text-gray-900 dark:text-gray-100"
                              }`}>
                                {task.title}
                              </h4>
                            
                            {task.description && (
                                  <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 leading-relaxed">
                                {task.description}
                              </p>
                            )}
                              </div>
                            </div>
                          </div>
                        </div>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="dark:bg-gray-800 dark:border-gray-700">
                            <DropdownMenuItem onClick={() => handleEditTask(task)}>
                              <Edit className="h-4 w-4 mr-2" />
                              {t('todo.actions.edit')}
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => handleDeleteTask(task.id)}
                              className="text-red-600 dark:text-red-400"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              {t('todo.actions.delete')}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      {/* Progress Bar (if estimated hours) */}
                      {task.estimatedHours && task.estimatedHours > 0 && (
                        <div className="mb-4">
                          <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400 mb-1">
                            <span className="flex items-center gap-1">
                              <Target className="h-3 w-3" />
                              {t('todo.progress')}
                            </span>
                            <span>{Math.round(progressPercentage)}%</span>
                          </div>
                          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                            <div 
                              className={`h-2 rounded-full transition-all duration-300 ${
                                progressPercentage >= 100 ? "bg-green-500" :
                                progressPercentage >= 75 ? "bg-blue-500" :
                                progressPercentage >= 50 ? "bg-yellow-500" : "bg-gray-400"
                              }`}
                              style={{ width: `${Math.min(progressPercentage, 100)}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {/* Tags Section */}
                      {task.tags && task.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-3">
                          {task.tags.slice(0, 3).map((tag, index) => (
                            <Badge 
                              key={index} 
                              variant="outline" 
                              className="text-xs px-2 py-1 bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-600"
                            >
                              <Tag className="h-2 w-2 mr-1" />
                              {tag}
                            </Badge>
                          ))}
                          {task.tags.length > 3 && (
                            <Badge variant="outline" className="text-xs px-2 py-1 bg-gray-50 dark:bg-gray-700">
                              +{task.tags.length - 3}
                            </Badge>
                          )}
                        </div>
                      )}

                      {/* Status and Priority Badges */}
                      <div className="flex flex-wrap gap-2 mb-4">
                        <Badge className={`${getPriorityColor(task.priority)} text-xs border-0 font-medium`}>
                          <span className="flex items-center gap-1">
                            {getPriorityIcon(task.priority)}
                            {formatPriority(task.priority)}
                          </span>
                        </Badge>
                        
                        <Badge className={`${getStatusColor(task.status)} text-xs border-0 font-medium`}>
                          <span className="flex items-center gap-1">
                            {getStatusIcon(task.status)}
                            {formatStatus(task.status)}
                          </span>
                        </Badge>

                        {task.dueDate && (
                          <Badge className={`text-xs border-0 font-medium ${
                            isTaskOverdue && task.status !== "completed" 
                              ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
                              : daysUntilDue !== null && daysUntilDue <= 3 && task.status !== "completed"
                              ? "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300"
                              : "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
                          }`}>
                            <Calendar className="h-3 w-3 mr-1" />
                            {isTaskOverdue && task.status !== "completed" ? (
                              t('todo.overdue', { count: Math.abs(daysUntilDue || 0) })
                            ) : daysUntilDue === 0 ? (
                              t('todo.dueToday')
                            ) : daysUntilDue === 1 ? (
                              t('todo.dueTomorrow')
                            ) : daysUntilDue && daysUntilDue > 0 ? (
                              t('todo.dueInDays', { count: daysUntilDue })
                            ) : (
                              formatDate(task.dueDate)
                            )}
                          </Badge>
                        )}

                        {task.estimatedHours && (
                          <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300 text-xs border-0 font-medium">
                            <Clock3 className="h-3 w-3 mr-1" />
                            {t('todo.estimatedHoursBadge', { count: task.estimatedHours })}
                          </Badge>
                        )}
                      </div>

                      {/* Linked Ticket Section */}
                      {task.ticketId && (
                        <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-200 dark:border-blue-800 mb-4 hover:bg-blue-100/50 dark:hover:bg-blue-900/30 transition-colors">
                          <div className="flex items-center gap-2 text-xs">
                            <FileText className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                            <span className="font-semibold text-blue-900 dark:text-blue-100">
                              {t('todo.linkedTicket')} {task.ticketNumber}
                            </span>
                          </div>
                          <p className="text-xs text-blue-700 dark:text-blue-300 mt-1 line-clamp-1 font-medium">
                            {task.ticketTitle}
                          </p>
                        </div>
                      )}

                      {/* Footer Section */}
                      <div className="flex items-center justify-between pt-3 border-t border-gray-200 dark:border-gray-700">
                        <div className="flex items-center gap-4">
                          <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                            <Timer className="h-3 w-3" />
                            <span className="font-medium">{formatTime(task.timeTracking.totalTime)}</span>
                          </span>
                          <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                            <CalendarDays className="h-3 w-3" />
                            {formatDate(task.createdAt)}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
                          <User className="h-3 w-3" />
                          <span className="font-medium">{task.assignedToName}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Edit Task Dialog - Enhanced */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="dark:bg-gray-900 dark:border-gray-700 max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="dark:text-gray-100 flex items-center gap-2">
              <Edit className="h-5 w-5" />
              {t('todo.edit.title')}
            </DialogTitle>
            <DialogDescription className="text-sm text-gray-500 dark:text-gray-400">
              {t('todo.edit.description')}
            </DialogDescription>
          </DialogHeader>
          
          {editingTask && (
            <div className="space-y-6">
              {/* Basic Information */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-blue-500" />
                  <Label className="text-sm font-medium dark:text-gray-200">{t('todo.edit.basicInfo')}</Label>
                </div>
                
                <div>
                  <Label htmlFor="edit-title" className="text-sm font-medium dark:text-gray-200">
                    {t('todo.taskTitleLabel')} *
                  </Label>
                  <Input
                    id="edit-title"
                    value={editingTask.title}
                    onChange={(e) => setEditingTask({ ...editingTask, title: e.target.value })}
                    placeholder={t('todo.taskTitlePlaceholder')}
                    className="dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
                  />
                </div>
                
                <div>
                  <Label htmlFor="edit-description" className="text-sm font-medium dark:text-gray-200">
                    {t('todo.descriptionLabel')}
                  </Label>
                  <Textarea
                    id="edit-description"
                    value={editingTask.description || ""}
                    onChange={(e) => setEditingTask({ ...editingTask, description: e.target.value })}
                    placeholder={t('todo.descriptionPlaceholder')}
                    className="dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100 min-h-20"
                  />
                </div>
              </div>

              <Separator className="dark:border-gray-700" />

              {/* Status and Priority */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-green-500" />
                  <Label className="text-sm font-medium dark:text-gray-200">{t('todo.edit.statusAndPriority')}</Label>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium dark:text-gray-200">{t('todo.edit.status.label')}</Label>
                    <Select 
                      value={editingTask.status} 
                      onValueChange={(value: any) => setEditingTask({ ...editingTask, status: value })}
                    >
                      <SelectTrigger className="dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="dark:bg-gray-800 dark:border-gray-600">
                        <SelectItem value="pending">{t('todo.edit.status.pending')}</SelectItem>
                        <SelectItem value="in_progress">{t('todo.edit.status.inProgress')}</SelectItem>
                        <SelectItem value="completed">{t('todo.edit.status.completed')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label className="text-sm font-medium dark:text-gray-200">{t('todo.priorityLabel')}</Label>
                    <Select 
                      value={editingTask.priority} 
                      onValueChange={(value: any) => setEditingTask({ ...editingTask, priority: value })}
                    >
                      <SelectTrigger className="dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="dark:bg-gray-800 dark:border-gray-600">
                        <SelectItem value="low">🟢 {t('priority.low')}</SelectItem>
                        <SelectItem value="medium">🟡 {t('priority.medium')}</SelectItem>
                        <SelectItem value="high">🟠 {t('priority.high')}</SelectItem>
                        <SelectItem value="urgent">🔴 {t('priority.urgent')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              
              <Separator className="dark:border-gray-700" />

              {/* Time and Assignment */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Clock3 className="h-4 w-4 text-purple-500" />
                  <Label className="text-sm font-medium dark:text-gray-200">{t('todo.edit.timeAndAssignment')}</Label>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium dark:text-gray-200">{t('todo.edit.dueDate')}</Label>
                    <Input
                      type="date"
                      value={editingTask.dueDate || ""}
                      onChange={(e) => setEditingTask({ ...editingTask, dueDate: e.target.value })}
                      className="dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
                    />
                  </div>
                  
                  <div>
                    <Label className="text-sm font-medium dark:text-gray-200">{t('todo.edit.estimatedHours')}</Label>
                    <Input
                      type="number"
                      step="0.5"
                      value={editingTask.estimatedHours || ""}
                      onChange={(e) => setEditingTask({ ...editingTask, estimatedHours: e.target.value ? Number(e.target.value) : undefined })}
                      placeholder={t('todo.edit.estimatedHoursPlaceholder')}
                      className="dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
                    />
                  </div>
                </div>
                
                <div>
                  <Label className="text-sm font-medium dark:text-gray-200">{t('todo.edit.assignedTo')}</Label>
                  <Select 
                    value={editingTask.assignedTo} 
                    onValueChange={(value) => setEditingTask({ ...editingTask, assignedTo: value })}
                  >
                    <SelectTrigger className="dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100">
                      <SelectValue placeholder={t('todo.edit.assignedToPlaceholder')} />
                    </SelectTrigger>
                    <SelectContent className="dark:bg-gray-800 dark:border-gray-600">
                      {availableUsers.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          <div className="flex items-center gap-2">
                            <User className="h-3 w-3" />
                            {user.full_name} ({user.email})
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Separator className="dark:border-gray-700" />

              {/* Ticket and Tags */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Paperclip className="h-4 w-4 text-orange-500" />
                  <Label className="text-sm font-medium dark:text-gray-200">{t('todo.edit.ticketAndTags')}</Label>
                </div>
                
                <div>
                  <Label className="text-sm font-medium dark:text-gray-200">{t('todo.edit.relatedTicket')}</Label>
                  <Select 
                    value={editingTask.ticketId || "none"} 
                    onValueChange={(value) => setEditingTask({ ...editingTask, ticketId: value === "none" ? undefined : value })}
                  >
                    <SelectTrigger className="dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100">
                      <SelectValue placeholder={t('todo.edit.relatedTicketPlaceholder')} />
                    </SelectTrigger>
                    <SelectContent className="dark:bg-gray-800 dark:border-gray-600">
                      <SelectItem value="none">{t('todo.edit.noTicket')}</SelectItem>
                      {availableTickets.map((ticket) => (
                        <SelectItem key={ticket.id} value={ticket.id}>
                          <div className="flex items-center gap-2">
                            <FileText className="h-3 w-3" />
                            {ticket.ticket_number}: {ticket.title}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label className="text-sm font-medium dark:text-gray-200">{t('todo.edit.tags')}</Label>
                  <div className="flex gap-2 mt-1">
                    <Input
                      value={editCurrentTag}
                      onChange={(e) => setEditCurrentTag(e.target.value)}
                      placeholder={t('todo.edit.addTag')}
                      className="dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
                      onKeyPress={(e) => e.key === 'Enter' && addEditTag()}
                    />
                    <Button 
                      type="button"
                      variant="outline" 
                      size="sm" 
                      onClick={addEditTag}
                      className="dark:border-gray-600"
                    >
                      <Tag className="h-3 w-3" />
                    </Button>
                  </div>
                  
                  {editSelectedTags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {editSelectedTags.map((tag, index) => (
                        <Badge 
                          key={index} 
                          variant="secondary" 
                          className="text-xs dark:bg-gray-700 dark:text-gray-200"
                        >
                          {tag}
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-3 w-3 p-0 ml-1 hover:bg-transparent"
                            onClick={() => removeEditTag(tag)}
                          >
                            <X className="h-2 w-2" />
                          </Button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-2 pt-4 border-t dark:border-gray-700">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setIsEditDialogOpen(false);
                    setEditingTask(null);
                    setEditSelectedTags([]);
                    setEditCurrentTag("");
                    setEditFormErrors({});
                  }}
                  className="dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  {t('todo.edit.cancel')}
                </Button>
                <Button 
                  onClick={() => handleUpdateTask({
                    title: editingTask.title,
                    description: editingTask.description,
                    status: editingTask.status,
                    priority: editingTask.priority,
                    due_date: editingTask.dueDate || undefined,
                    estimated_hours: editingTask.estimatedHours || undefined,
                    tags: editSelectedTags.length > 0 ? editSelectedTags : undefined,
                    assigned_to: editingTask.assignedTo,
                    ticket_id: (editingTask.ticketId && editingTask.ticketId !== "none") ? editingTask.ticketId : undefined
                  })}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  {t('todo.edit.save')}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}; 