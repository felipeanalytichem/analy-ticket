import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { CheckSquare, FileText, User } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import DatabaseService from '@/lib/database';
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";

interface TicketWithDetails {
  id: string;
  ticket_number?: string;
  title: string;
  user?: {
    name: string;
  };
  assignee?: {
    id: string;
    name: string;
  };
}

interface TodoTaskModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ticket: TicketWithDetails | null;
  userRole?: "user" | "agent" | "admin";
  onTaskCreated?: () => void;
}

export const TodoTaskModal = ({ 
  open, 
  onOpenChange, 
  ticket, 
  userRole = "user",
  onTaskCreated
}: TodoTaskModalProps) => {
  const [taskData, setTaskData] = useState({
    title: "",
    description: "",
    priority: "medium" as "low" | "medium" | "high" | "urgent"
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { userProfile } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();
  
  // Check if the user can add a task (only assigned agent or admin)
  // Tasks are automatically assigned to the current user who must be the assigned agent
  const canAddTask = () => {
    if (userRole === "admin") return true;
    if (userRole === "agent" && ticket?.assignee?.id === userProfile?.id) return true;
    return false;
  };

  const handleSubmit = async () => {
    if (!taskData.title.trim() || !ticket || !userProfile) return;

    try {
      setIsSubmitting(true);
      
      await DatabaseService.createTodoTask({
        title: taskData.title,
        description: taskData.description || undefined,
        priority: taskData.priority,
        assigned_to: userProfile.id,
        ticket_id: ticket.id
      });

      // Reset form
      setTaskData({
        title: "",
        description: "",
        priority: "medium"
      });
      
      toast({
        title: t('todo.createdTitle'),
        description: t('todo.createdDesc'),
      });
      
      onTaskCreated?.();
      onOpenChange(false);
    } catch (error) {
      console.error('Error creating task:', error);
      toast({
        title: t('common.error'),
        description: t('todo.createError'),
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatPriority = (priority: string) => t(`priority.${priority}`, priority);

  if (!canAddTask()) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="dark:bg-gray-900 dark:border-gray-700">
          <DialogHeader>
            <DialogTitle className="dark:text-gray-100 flex items-center gap-2">
              <CheckSquare className="h-5 w-5" />
              {t('todo.addTask')}
            </DialogTitle>
            <DialogDescription className="sr-only">{t('todo.addTaskNoPermission')}</DialogDescription>
          </DialogHeader>
          
          <div className="text-center py-8">
            <p className="text-gray-500 dark:text-gray-400">
              {t('todo.addTaskNoPermission')}
            </p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="dark:bg-gray-900 dark:border-gray-700 max-w-md">
        <DialogHeader>
          <DialogTitle className="dark:text-gray-100 flex items-center gap-2">
            <CheckSquare className="h-5 w-5" />
            {t('todo.addTaskToTicket')}
          </DialogTitle>
          <DialogDescription className="sr-only">{t('todo.addTaskFormDescription')}</DialogDescription>
        </DialogHeader>

        {/* Ticket Info */}
        {ticket && (
          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800 mb-4">
            <div className="flex items-center gap-2 text-sm">
              <FileText className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <span className="font-medium text-blue-900 dark:text-blue-100">
                {ticket.ticket_number}: {ticket.title}
              </span>
            </div>
            {ticket.user?.name && (
              <div className="flex items-center gap-1 mt-2 text-xs text-blue-700 dark:text-blue-300">
                <User className="h-3 w-3" />
                <span>{t('tickets.requester')}: {ticket.user.name}</span>
              </div>
            )}
          </div>
        )}

        <div className="space-y-4">
          {/* Task Title */}
          <div>
            <label className="text-sm font-medium dark:text-gray-200 mb-2 block">
              {t('todo.taskTitleLabel')} *
            </label>
            <Input
              value={taskData.title}
              onChange={(e) => setTaskData({ ...taskData, title: e.target.value })}
              placeholder={t('todo.taskTitlePlaceholder')}
              className="dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100 dark:placeholder-gray-400"
            />
          </div>

          {/* Task Description */}
          <div>
            <label className="text-sm font-medium dark:text-gray-200 mb-2 block">
              {t('todo.descriptionLabel')}
            </label>
            <Textarea
              value={taskData.description}
              onChange={(e) => setTaskData({ ...taskData, description: e.target.value })}
              placeholder={t('todo.descriptionPlaceholder')}
              className="dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100 dark:placeholder-gray-400 min-h-20"
            />
          </div>

          {/* Priority */}
          <div>
            <label className="text-sm font-medium dark:text-gray-200 mb-2 block">
              {t('todo.priorityLabel')}
            </label>
            <Select 
              value={taskData.priority} 
              onValueChange={(value: any) => setTaskData({ ...taskData, priority: value })}
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

          {/* Preview */}
          <div className="bg-gray-50 dark:bg-gray-800/60 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
            <h4 className="text-sm font-medium dark:text-gray-200 mb-2">{t('todo.taskPreview')}:</h4>
            <div className="text-sm space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-medium dark:text-gray-300">
                  {taskData.title || t('todo.taskTitlePlaceholder')}
                </span>
                <Badge className="text-xs">
                  {formatPriority(taskData.priority)}
                </Badge>
              </div>
              <div className="text-gray-600 dark:text-gray-400">
                {t('todo.assignedTo')}: {userProfile?.full_name}
              </div>
              {taskData.description && (
                <div className="text-gray-600 dark:text-gray-400 text-xs mt-1">
                  {taskData.description}
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-2 pt-2">
            <Button 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              className="dark:border-gray-600 dark:text-gray-300"
            >
              {t('common.cancel')}
            </Button>
            <Button 
              onClick={handleSubmit} 
              disabled={!taskData.title.trim() || isSubmitting}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <CheckSquare className="h-4 w-4 mr-2" />
              {isSubmitting ? t('todo.saving') : t('todo.createButton')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}; 