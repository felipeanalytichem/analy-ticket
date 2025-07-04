import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  Plus, 
  CheckCircle, 
  Clock, 
  AlertTriangle, 
  Pause,
  Edit, 
  Trash2, 
  MessageSquare, 
  User, 
  Calendar,
  ChevronDown,
  ChevronRight,
  PlayCircle,
  XCircle,
  MoreHorizontal,
  Target,
  Users,
  TrendingUp,
  AlertCircle
} from "lucide-react";
import { DatabaseService, TicketTask, TicketTaskComment } from '@/lib/database';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

interface TaskManagementProps {
  ticketId: string;
  canManageTasks: boolean;
}

export function TaskManagement({ ticketId, canManageTasks }: TaskManagementProps) {
  const { userProfile } = useAuth();
  const [tasks, setTasks] = useState<TicketTask[]>([]);
  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingTask, setEditingTask] = useState<TicketTask | null>(null);
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [taskComments, setTaskComments] = useState<Record<string, TicketTaskComment[]>>({});
  const [newComment, setNewComment] = useState<Record<string, string>>({});
  const [statistics, setStatistics] = useState({
    total: 0,
    open: 0,
    in_progress: 0,
    done: 0,
    blocked: 0,
    overdue: 0
  });

  // Form state for create/edit
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    assigned_to: '',
    priority: 'medium' as 'low' | 'medium' | 'high' | 'urgent',
    due_date: ''
  });

  useEffect(() => {
    loadTasks();
    loadAgents();
  }, [ticketId]);

  const loadTasks = async () => {
    try {
      const tasksData = await DatabaseService.getTicketTasks(ticketId);
      setTasks(tasksData);
      
      const stats = await DatabaseService.getTaskStatistics(ticketId);
      setStatistics(stats);
    } catch (error) {
      console.error('Error loading tasks:', error);
      toast.error('Failed to load tasks');
    } finally {
      setLoading(false);
    }
  };

  const loadAgents = async () => {
    try {
      const users = await DatabaseService.getUsers();
      const agentUsers = users.filter(user => 
        user.role === 'agent' || user.role === 'admin'
      );
      setAgents(agentUsers);
    } catch (error) {
      console.error('Error loading agents:', error);
    }
  };

  const loadTaskComments = async (taskId: string) => {
    try {
      const comments = await DatabaseService.getTaskComments(taskId);
      setTaskComments(prev => ({
        ...prev,
        [taskId]: comments
      }));
    } catch (error) {
      console.error('Error loading task comments:', error);
    }
  };

  const handleCreateTask = async () => {
    if (!userProfile || !formData.title.trim()) {
      toast.error('Title is required');
      return;
    }

    try {
      const newTask = await DatabaseService.createTicketTask({
        ticket_id: ticketId,
        title: formData.title,
        description: formData.description,
        assigned_to: formData.assigned_to || undefined,
        priority: formData.priority,
        due_date: formData.due_date || undefined,
        created_by: userProfile.id
      });

      setTasks(prev => [...prev, newTask]);
      setShowCreateDialog(false);
      resetForm();
      toast.success('Task created successfully');
      
      // Reload statistics
      const stats = await DatabaseService.getTaskStatistics(ticketId);
      setStatistics(stats);
    } catch (error) {
      console.error('Error creating task:', error);
      toast.error('Failed to create task');
    }
  };

  const handleUpdateTask = async (taskId: string, updates: Partial<TicketTask>) => {
    try {
      const updatedTask = await DatabaseService.updateTicketTask(taskId, updates);
      setTasks(prev => prev.map(task => 
        task.id === taskId ? updatedTask : task
      ));
      
      // Reload statistics
      const stats = await DatabaseService.getTaskStatistics(ticketId);
      setStatistics(stats);
      
      toast.success('Task updated successfully');
    } catch (error) {
      console.error('Error updating task:', error);
      toast.error('Failed to update task');
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      await DatabaseService.deleteTicketTask(taskId);
      setTasks(prev => prev.filter(task => task.id !== taskId));
      toast.success('Task deleted successfully');
      
      // Reload statistics
      const stats = await DatabaseService.getTaskStatistics(ticketId);
      setStatistics(stats);
    } catch (error) {
      console.error('Error deleting task:', error);
      toast.error('Failed to delete task');
    }
  };

  const handleAddComment = async (taskId: string) => {
    const comment = newComment[taskId]?.trim();
    if (!comment || !userProfile) return;

    try {
      const newTaskComment = await DatabaseService.addTaskComment(taskId, userProfile.id, comment);
      setTaskComments(prev => ({
        ...prev,
        [taskId]: [...(prev[taskId] || []), newTaskComment]
      }));
      
      setNewComment(prev => ({ ...prev, [taskId]: '' }));
      toast.success('Comment added');
    } catch (error) {
      console.error('Error adding comment:', error);
      toast.error('Failed to add comment');
    }
  };

  const toggleTaskExpansion = (taskId: string) => {
    setExpandedTasks(prev => {
      const newSet = new Set(prev);
      if (newSet.has(taskId)) {
        newSet.delete(taskId);
      } else {
        newSet.add(taskId);
        // Load comments when expanding
        if (!taskComments[taskId]) {
          loadTaskComments(taskId);
        }
      }
      return newSet;
    });
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      assigned_to: '',
      priority: 'medium',
      due_date: ''
    });
    setEditingTask(null);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'open': return <Clock className="h-4 w-4" />;
      case 'in_progress': return <PlayCircle className="h-4 w-4" />;
      case 'done': return <CheckCircle className="h-4 w-4" />;
      case 'blocked': return <Pause className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      case 'in_progress': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
      case 'done': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'blocked': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      case 'high': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300';
      case 'medium': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      case 'low': return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
    }
  };

  const isOverdue = (dueDate: string) => {
    return new Date(dueDate) < new Date();
  };

  const calculateProgress = () => {
    if (statistics.total === 0) return 0;
    return Math.round((statistics.done / statistics.total) * 100);
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Tasks
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-blue-600" />
            Tasks ({statistics.total})
          </CardTitle>
          {canManageTasks && (
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
              <DialogTrigger asChild>
                <Button size="sm" className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Add Task
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Create New Task</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Title</label>
                    <Input
                      value={formData.title}
                      onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                      placeholder="Enter task title..."
                    />
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium mb-2 block">Description</label>
                    <Textarea
                      value={formData.description}
                      onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Optional description..."
                      rows={3}
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium mb-2 block">Priority</label>
                      <Select value={formData.priority} onValueChange={(value: any) => setFormData(prev => ({ ...prev, priority: value }))}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="urgent">Urgent</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div>
                      <label className="text-sm font-medium mb-2 block">Assign To</label>
                      <Select value={formData.assigned_to} onValueChange={(value) => setFormData(prev => ({ ...prev, assigned_to: value }))}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select agent..." />
                        </SelectTrigger>
                        <SelectContent>
                          {agents.map(agent => (
                            <SelectItem key={agent.id} value={agent.id}>
                              {agent.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium mb-2 block">Due Date</label>
                    <Input
                      type="datetime-local"
                      value={formData.due_date}
                      onChange={(e) => setFormData(prev => ({ ...prev, due_date: e.target.value }))}
                    />
                  </div>
                  
                  <div className="flex gap-2 pt-4">
                    <Button onClick={handleCreateTask} className="flex-1">
                      Create Task
                    </Button>
                    <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
        
        {/* Task Statistics */}
        {statistics.total > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="flex items-center justify-between text-sm mb-2">
                  <span>Progress</span>
                  <span className="font-medium">{calculateProgress()}%</span>
                </div>
                <Progress value={calculateProgress()} className="h-2" />
              </div>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{statistics.open}</div>
                <div className="text-xs text-gray-500">Open</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-600">{statistics.in_progress}</div>
                <div className="text-xs text-gray-500">In Progress</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{statistics.done}</div>
                <div className="text-xs text-gray-500">Done</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{statistics.blocked}</div>
                <div className="text-xs text-gray-500">Blocked</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">{statistics.overdue}</div>
                <div className="text-xs text-gray-500">Overdue</div>
              </div>
            </div>
          </div>
        )}
      </CardHeader>
      
      <CardContent>
        {tasks.length === 0 ? (
          <div className="text-center py-8">
            <Target className="h-12 w-12 mx-auto text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              No tasks yet
            </h3>
            <p className="text-gray-500 mb-4">
              Create tasks to track progress and collaborate with team members
            </p>
            {canManageTasks && (
              <Button onClick={() => setShowCreateDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create First Task
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {tasks.map((task) => (
              <div
                key={task.id}
                className={cn(
                  "border rounded-lg p-4 transition-all duration-200",
                  expandedTasks.has(task.id) ? "border-blue-200 dark:border-blue-800" : "border-gray-200 dark:border-gray-700",
                  task.due_date && isOverdue(task.due_date) && task.status !== 'done' && "border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950"
                )}
              >
                <Collapsible 
                  open={expandedTasks.has(task.id)} 
                  onOpenChange={() => toggleTaskExpansion(task.id)}
                >
                  <div className="flex items-center justify-between">
                    <CollapsibleTrigger className="flex items-center gap-3 flex-1 text-left">
                      <div className="flex items-center gap-2">
                        {expandedTasks.has(task.id) ? 
                          <ChevronDown className="h-4 w-4 text-gray-500" /> : 
                          <ChevronRight className="h-4 w-4 text-gray-500" />
                        }
                        {getStatusIcon(task.status)}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium text-gray-900 dark:text-white truncate">
                            {task.title}
                          </h4>
                          {task.due_date && isOverdue(task.due_date) && task.status !== 'done' && (
                            <AlertTriangle className="h-4 w-4 text-red-500" />
                          )}
                        </div>
                        
                        <div className="flex items-center gap-2 text-sm">
                          <Badge className={cn("text-xs", getStatusColor(task.status))}>
                            {task.status.replace('_', ' ')}
                          </Badge>
                          <Badge className={cn("text-xs", getPriorityColor(task.priority))}>
                            {task.priority}
                          </Badge>
                          
                          {task.assignee && (
                            <div className="flex items-center gap-1 text-gray-500">
                              <User className="h-3 w-3" />
                              <span>{task.assignee.name}</span>
                            </div>
                          )}
                          
                          {task.due_date && (
                            <div className="flex items-center gap-1 text-gray-500">
                              <Calendar className="h-3 w-3" />
                              <span>{format(new Date(task.due_date), 'MMM d, yyyy')}</span>
                            </div>
                          )}
                          
                          {task.comments_count && task.comments_count > 0 && (
                            <div className="flex items-center gap-1 text-gray-500">
                              <MessageSquare className="h-3 w-3" />
                              <span>{task.comments_count}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </CollapsibleTrigger>
                    
                    {canManageTasks && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleUpdateTask(task.id, { 
                            status: task.status === 'done' ? 'open' : 'done' 
                          })}>
                            {task.status === 'done' ? (
                              <>
                                <XCircle className="h-4 w-4 mr-2" />
                                Mark as Open
                              </>
                            ) : (
                              <>
                                <CheckCircle className="h-4 w-4 mr-2" />
                                Mark as Done
                              </>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleUpdateTask(task.id, { 
                            status: task.status === 'in_progress' ? 'open' : 'in_progress' 
                          })}>
                            <PlayCircle className="h-4 w-4 mr-2" />
                            {task.status === 'in_progress' ? 'Stop Progress' : 'Start Progress'}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDeleteTask(task.id)} className="text-red-600">
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                  
                  <CollapsibleContent>
                    <div className="mt-4 space-y-4">
                      {task.description && (
                        <div>
                          <h5 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Description</h5>
                          <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
                            {task.description}
                          </p>
                        </div>
                      )}
                      
                      {/* Task Details */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-gray-500">Created by:</span>
                          <div className="font-medium">{task.creator?.name}</div>
                        </div>
                        <div>
                          <span className="text-gray-500">Created:</span>
                          <div className="font-medium">{format(new Date(task.created_at), 'MMM d, yyyy')}</div>
                        </div>
                        {task.completed_at && (
                          <div>
                            <span className="text-gray-500">Completed:</span>
                            <div className="font-medium">{format(new Date(task.completed_at), 'MMM d, yyyy')}</div>
                          </div>
                        )}
                      </div>
                      
                      {/* Comments Section */}
                      <div>
                        <h5 className="text-sm font-medium text-gray-900 dark:text-white mb-3">Comments</h5>
                        
                        {taskComments[task.id] && taskComments[task.id].length > 0 && (
                          <div className="space-y-3 mb-4">
                            {taskComments[task.id].map(comment => (
                              <div key={comment.id} className="flex gap-3">
                                <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center text-sm font-medium">
                                  {comment.user?.name?.charAt(0).toUpperCase()}
                                </div>
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="text-sm font-medium">{comment.user?.name}</span>
                                    <span className="text-xs text-gray-500">
                                      {format(new Date(comment.created_at), 'MMM d, yyyy HH:mm')}
                                    </span>
                                  </div>
                                  <p className="text-sm text-gray-600 dark:text-gray-400">
                                    {comment.comment}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        
                        {/* Add Comment */}
                        <div className="flex gap-2">
                          <Input
                            placeholder="Add a comment..."
                            value={newComment[task.id] || ''}
                            onChange={(e) => setNewComment(prev => ({ 
                              ...prev, 
                              [task.id]: e.target.value 
                            }))}
                            onKeyPress={(e) => {
                              if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleAddComment(task.id);
                              }
                            }}
                          />
                          <Button 
                            size="sm" 
                            onClick={() => handleAddComment(task.id)}
                            disabled={!newComment[task.id]?.trim()}
                          >
                            <MessageSquare className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
} 