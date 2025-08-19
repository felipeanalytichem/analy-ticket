import { useState, useEffect, useMemo, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { motion } from "framer-motion";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  ArrowLeft,
  Save,
  MessageSquare,
  Users,
  UserCheck,
  Loader2,
  Send,
  Plus,
  CheckSquare,
  Clock,
  User,
  AlertCircle,
  CheckCircle,
  History,
  Star,
  Tag,
  BookOpen,
  Info,
  Calendar,
  Mail,
  Phone,
  Building,
  MapPin,
  Briefcase,
  Shield,
  FileText,
  Edit,
  Share2,
  Printer,
  Eye,
  MessageCircle,
  Activity,
  Target,
  Settings,
  Trash2,
  X
} from "lucide-react";

// Import existing components that we'll integrate
import { ModernTicketChat } from "@/components/chat/ModernTicketChat";
import { InternalComments } from "@/components/tickets/InternalComments";
import { ActivityLog } from "@/components/tickets/ActivityLog";
import { TicketFeedback } from "@/components/tickets/TicketFeedback";
import { TaskManagement } from "@/components/tickets/TaskManagement";
import { SLAMonitor } from "@/components/tickets/SLAMonitor";
import { TicketTags } from "@/components/tickets/TicketTags";
import { AttachmentViewer } from "@/components/tickets/AttachmentViewer";
import { KnowledgeBase } from "@/components/knowledge/KnowledgeBase";
import { FeedbackPopup } from "@/components/tickets/FeedbackPopup";

// Import hooks and services
import { useTicket } from "@/components/tickets/hooks/useTicket";
import { useAuth } from "@/contexts/AuthContext";
import { useTicketCount } from "@/contexts/TicketCountContext";
import { useUser } from "@/hooks/useUser";
import { useTranslation } from "react-i18next";
import { DatabaseService } from "@/lib/database";
import { supabase } from "@/lib/supabase";
import { Skeleton } from "@/components/ui/skeleton";

// Types
interface Agent {
  id: string;
  full_name: string;
  email: string;
  role: string;
  avatar_url?: string;
}

interface TodoTask {
  id?: string;
  title: string;
  description?: string;
  priority: "low" | "medium" | "high" | "urgent";
  assigned_to?: string;
  ticket_id: string;
  status?: "pending" | "in_progress" | "completed";
  is_collaborative?: boolean;
  due_date?: string;
  estimated_hours?: number;
}

interface CommentFormData {
  content: string;
  is_internal: boolean;
  attachments: File[];
}

interface TransferFormData {
  agent_id: string;
  reason: string;
  add_comment: boolean;
}

export function TicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  const { triggerRefresh } = useTicketCount();
  const userRole = (userProfile?.role ?? 'user') as 'user' | 'agent' | 'admin';
  const { t } = useTranslation();
  const { toast } = useToast();
  const isMobile = useIsMobile();

  // Ticket data
  const {
    data: ticket,
    isLoading: isTicketLoading,
    isError,
    error,
    refetch: refetchTicket
  } = useTicket(id);

  // User profiles
  const { data: requesterProfile } = useUser(ticket?.user_id);
  const { data: assigneeProfile } = useUser(ticket?.assigned_to ?? undefined);

  // UI State
  const [activeTab, setActiveTab] = useState("overview");
  const [refreshKey, setRefreshKey] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  // Status Management
  const [isEditingStatus, setIsEditingStatus] = useState(false);
  const [newStatus, setNewStatus] = useState("");

  // Comment Management
  const [showCommentForm, setShowCommentForm] = useState(false);
  const [commentForm, setCommentForm] = useState<CommentFormData>({
    content: "",
    is_internal: false,
    attachments: []
  });
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);

  // Transfer Management
  const [showTransferDialog, setShowTransferDialog] = useState(false);
  const [transferForm, setTransferForm] = useState<TransferFormData>({
    agent_id: "",
    reason: "",
    add_comment: true
  });
  const [agents, setAgents] = useState<Agent[]>([]);
  const [isLoadingAgents, setIsLoadingAgents] = useState(false);
  const [isTransferring, setIsTransferring] = useState(false);

  // Todo Task Management
  const [showTodoForm, setShowTodoForm] = useState(false);
  const [todoForm, setTodoForm] = useState<TodoTask>({
    title: "",
    description: "",
    priority: "medium",
    ticket_id: id || "",
    is_collaborative: false
  });
  const [collaborativeAssignee, setCollaborativeAssignee] = useState("");
  const [isCreatingTodo, setIsCreatingTodo] = useState(false);

  // Assignment Management
  const [isAssigning, setIsAssigning] = useState(false);

  // Feedback Management
  const [showFeedbackPopup, setShowFeedbackPopup] = useState(false);
  const [showResolutionDialog, setShowResolutionDialog] = useState(false);
  const [resolutionNotes, setResolutionNotes] = useState("");

  // Initialize status when ticket loads
  useEffect(() => {
    if (ticket) {
      setNewStatus(ticket.status);
      
      // Auto-show feedback popup if customer views a resolved ticket and hasn't provided feedback yet
      if (
        userRole === 'user' && 
        userProfile?.id === ticket.user_id && 
        ticket.status === 'resolved'
        // Note: feedback_submitted check removed as it's not in the TicketWithDetails interface
      ) {
        // Small delay to allow page to render first
        const timer = setTimeout(() => {
          setShowFeedbackPopup(true);
        }, 1000);
        
        return () => clearTimeout(timer);
      }
    }
  }, [ticket, userRole, userProfile?.id]);

  // Load agents for transfer and collaboration
  const loadAgents = useCallback(async () => {
    setIsLoadingAgents(true);
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, full_name, email, role, avatar_url')
        .in('role', ['agent', 'admin'])
        .order('full_name');

      if (error) throw error;
      setAgents(data || []);
    } catch (err) {
      console.error('Error loading agents:', err);
      toast({
        title: t('common.error'),
        description: t('tickets.assign.loadAgentsError'),
        variant: "destructive",
      });
    } finally {
      setIsLoadingAgents(false);
    }
  }, [t, toast]);

  useEffect(() => {
    loadAgents();
  }, [loadAgents]);

  // Helper functions
  const formatDate = useMemo(() => (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }, []);

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: t('common.success'),
        description: t('tickets.detail.linkCopied'),
      });
    } catch (err) {
      console.error('Failed to copy text:', err);
    }
  };

  // Permission checks
  const canViewInternalFeatures = userRole === "agent" || userRole === "admin";
  const canEditTicket = () => {
    if (!ticket || ticket.status === 'closed') return false;
    if (!userProfile) return false;
    return userProfile.role === 'admin' || 
           (userProfile.role === 'agent' && ticket.assigned_to === userProfile.id);
  };

  const canAssignToSelf = () => {
    return userRole === "agent" && 
           !ticket?.assigned_to && 
           userProfile?.id &&
           ticket?.status !== 'resolved' &&
           ticket?.status !== 'closed';
  };

  const canTransfer = () => {
    return (userRole === "admin" || userRole === "agent") && 
           ticket?.status !== 'closed' && 
           ticket?.status !== 'resolved';
  };

  const canManageTodos = () => {
    if (!ticket || ticket.status === 'closed' || ticket.status === 'resolved') return false;
    return userRole === 'admin' || 
           (userRole === 'agent' && ticket.assigned_to === userProfile?.id);
  };

  // Action handlers
  const handleStatusUpdate = async () => {
    if (!ticket || newStatus === ticket.status) {
      setIsEditingStatus(false);
      return;
    }

    // Special handling for "resolved" status
    if (newStatus === 'resolved') {
      setShowResolutionDialog(true);
      return;
    }

    setIsLoading(true);
    try {
      await DatabaseService.updateTicket(ticket.id, {
        status: newStatus as any,
        updated_at: new Date().toISOString()
      });

      // Add activity log
      await DatabaseService.addTicketComment(
        ticket.id,
        userProfile?.id || '',
        `Status updated from ${ticket.status} to ${newStatus}`,
        true
      );

      toast({
        title: t('common.success'),
        description: t('tickets.statusUpdated'),
      });

      setIsEditingStatus(false);
      setRefreshKey(prev => prev + 1);
      triggerRefresh();
      refetchTicket();
    } catch (error) {
      console.error('Error updating status:', error);
      toast({
        title: t('common.error'),
        description: t('tickets.statusUpdateError'),
        variant: "destructive",
      });
      setNewStatus(ticket.status); // Reset to original status
    } finally {
      setIsLoading(false);
    }
  };

  const handleAssignToMe = async () => {
    if (!ticket || !userProfile) return;
    
    setIsAssigning(true);
    try {
      await DatabaseService.updateTicket(ticket.id, {
        assigned_to: userProfile.id,
        status: 'in_progress',
        updated_at: new Date().toISOString()
      });

      // Create notification for self-assignment
      await DatabaseService.createTicketNotification(ticket.id, 'assignment_changed', userProfile.id);

      // Add activity log
      await DatabaseService.addTicketComment(
        ticket.id,
        userProfile.id,
        `Ticket assigned to ${userProfile.full_name}`,
        true
      );

      toast({
        title: t('common.success'),
        description: t('tickets.ticketAssignedSuccessfully'),
      });

      setRefreshKey(prev => prev + 1);
      triggerRefresh();
      refetchTicket();
    } catch (error) {
      console.error('Error assigning ticket:', error);
      toast({
        title: t('common.error'),
        description: t('tickets.errorAssigningTicketMessage'),
        variant: "destructive",
      });
    } finally {
      setIsAssigning(false);
    }
  };

  const handleSubmitComment = async () => {
    if (!commentForm.content.trim() || !ticket) return;

    setIsSubmittingComment(true);
    try {
      await DatabaseService.addTicketComment(
        ticket.id,
        userProfile?.id || '',
        commentForm.content,
        commentForm.is_internal
      );

      toast({
        title: t('common.success'),
        description: t('tickets.commentAdded'),
      });

      setCommentForm({
        content: "",
        is_internal: false,
        attachments: []
      });
      setShowCommentForm(false);
      setRefreshKey(prev => prev + 1);
      triggerRefresh();
    } catch (error) {
      console.error('Error adding comment:', error);
      toast({
        title: t('common.error'),
        description: t('tickets.commentError'),
        variant: "destructive",
      });
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const handleTransferTicket = async () => {
    if (!transferForm.agent_id || !transferForm.reason.trim() || !ticket) return;

    setIsTransferring(true);
    try {
      // Update ticket assignment
      await DatabaseService.updateTicket(ticket.id, {
        assigned_to: transferForm.agent_id,
        updated_at: new Date().toISOString()
      });

      // Add transfer comment if requested
      if (transferForm.add_comment) {
        await DatabaseService.addTicketComment(
          ticket.id,
          userProfile?.id || '',
          `Ticket transferred to another agent.\n\nReason: ${transferForm.reason}`,
          true
        );
      }

      // Create notification for the new agent
      await DatabaseService.createNotification({
        user_id: transferForm.agent_id,
        type: 'ticket_assigned',
        title: 'Ticket Transferred to You',
        message: `Ticket ${ticket.ticket_number || ticket.id} has been transferred to you by ${userProfile?.full_name}`,
        ticket_id: ticket.id,
        priority: 'medium'
      });

      const targetAgent = agents.find(agent => agent.id === transferForm.agent_id);
      
      toast({
        title: t('tickets.transfer.transferredTitle'),
        description: t('tickets.transfer.transferredMessage', { agentName: targetAgent?.full_name }),
      });

      setShowTransferDialog(false);
      setTransferForm({
        agent_id: "",
        reason: "",
        add_comment: true
      });
      setRefreshKey(prev => prev + 1);
      triggerRefresh();
      refetchTicket();
    } catch (error) {
      console.error('Error transferring ticket:', error);
      toast({
        title: t('common.error'),
        description: t('tickets.transfer.error'),
        variant: "destructive",
      });
    } finally {
      setIsTransferring(false);
    }
  };

  const handleCreateTodo = async () => {
    if (!todoForm.title.trim() || !ticket) return;

    setIsCreatingTodo(true);
    try {
      // Create a Ticket Task (not a Todo Task) so it appears in the TaskManagement component
      const taskData = {
        ticket_id: ticket.id,
        title: todoForm.title,
        description: todoForm.description || undefined,
        assigned_to: todoForm.is_collaborative ? collaborativeAssignee : userProfile?.id,
        priority: todoForm.priority,
        due_date: todoForm.due_date || undefined,
        created_by: userProfile?.id || ticket.user_id
      };

      await DatabaseService.createTicketTask(taskData);

      // If collaborative, create notification for assigned agent
      if (todoForm.is_collaborative && collaborativeAssignee && collaborativeAssignee !== userProfile?.id) {
        const assignedAgent = agents.find(agent => agent.id === collaborativeAssignee);
        await DatabaseService.createNotification({
          user_id: collaborativeAssignee,
          type: 'assignment_changed',
          title: 'Collaborative Task Assigned',
          message: `A collaborative task "${todoForm.title}" has been assigned to you for ticket ${ticket.ticket_number || ticket.id}`,
          ticket_id: ticket.id,
          priority: todoForm.priority === 'urgent' ? 'high' : todoForm.priority as 'low' | 'medium' | 'high'
        });
      }

      toast({
        title: t('tickets.tasks.createdTitle'),
        description: t('tickets.tasks.createdDesc'),
      });

      setTodoForm({
        title: "",
        description: "",
        priority: "medium",
        ticket_id: ticket.id,
        is_collaborative: false,
        due_date: "",
        estimated_hours: undefined
      });
      setCollaborativeAssignee("");
      setShowTodoForm(false);
      setRefreshKey(prev => prev + 1);
      triggerRefresh();
    } catch (error) {
      console.error('Error creating task:', error);
      toast({
        title: t('common.error'),
        description: t('tickets.tasks.createError'),
        variant: "destructive",
      });
    } finally {
      setIsCreatingTodo(false);
    }
  };

  const handleResolveTicket = async () => {
    if (!ticket || !resolutionNotes.trim()) {
      toast({
        title: t('common.error'),
        description: t('tickets.resolve.resolutionNotesRequired'),
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      // Use the proper resolveTicket method which handles feedback notifications
      await DatabaseService.resolveTicket(
        ticket.id,
        resolutionNotes.trim(),
        userProfile?.id || ticket.assigned_to || ticket.user_id
      );

      toast({
        title: t('tickets.resolve.successTitle'),
        description: t('tickets.resolve.successDescription'),
      });

      // Show feedback popup to customer (if they are the requester)
      if (userRole === 'user' && userProfile?.id === ticket.user_id) {
        setShowFeedbackPopup(true);
      }

      setShowResolutionDialog(false);
      setResolutionNotes("");
      setIsEditingStatus(false);
      setRefreshKey(prev => prev + 1);
      triggerRefresh();
      refetchTicket();
    } catch (error) {
      console.error('Error resolving ticket:', error);
      toast({
        title: t('common.error'),
        description: t('tickets.resolve.errorDefault'),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusVariant = (status: string): "default" | "destructive" | "outline" | "secondary" => {
    switch (status) {
      case 'open': return 'secondary';
      case 'in_progress': return 'default';
      case 'resolved': return 'outline';
      case 'closed': return 'destructive';
      default: return 'secondary';
    }
  };

  const getPriorityVariant = (priority: string): "default" | "destructive" | "outline" | "secondary" => {
    switch (priority) {
      case 'urgent': return 'destructive';
      case 'high': return 'default';
      case 'medium': return 'secondary';
      case 'low': return 'outline';
      default: return 'secondary';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'open': return <AlertCircle className="h-4 w-4" />;
      case 'in_progress': return <Clock className="h-4 w-4" />;
      case 'resolved': return <CheckCircle className="h-4 w-4" />;
      case 'closed': return <CheckCircle className="h-4 w-4" />;
      default: return <AlertCircle className="h-4 w-4" />;
    }
  };

  // Loading state
  if (isTicketLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-4">
        <Skeleton className="h-10 w-1/3" />
        <Skeleton className="h-6 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  // Error state
  if (isError || !ticket) {
    const getErrorContent = () => {
      if (!error) {
        return {
          title: t('errors.ticketNotFound', 'Ticket not found'),
          message: t('errors.ticketNotFoundMessage', 'The requested ticket could not be found.'),
          showBackButton: true
        };
      }

      if (error.name === 'ForbiddenError' || (error as any).status === 403) {
        return {
          title: t('errors.accessDenied', 'Access Denied'),
          message: t('errors.accessDeniedMessage', 'You do not have permission to view this ticket.'),
          showBackButton: true
        };
      }

      return {
        title: t('errors.loadingError', 'Error Loading Ticket'),
        message: t('errors.loadingErrorMessage', 'An error occurred while loading the ticket.'),
        showBackButton: true
      };
    };

    const errorContent = getErrorContent();

    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="max-w-md w-full mx-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center space-y-4">
                <div className="mx-auto w-12 h-12 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center">
                  <AlertCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
                </div>
                
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">
                    {errorContent.title}
                  </h3>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    {errorContent.message}
                  </p>
                </div>

                {errorContent.showBackButton && (
                  <div className="flex gap-2 justify-center">
                    <Button variant="outline" onClick={() => navigate(-1)}>
                      <ArrowLeft className="h-4 w-4 mr-2" />
                      {t('common.goBack', 'Go Back')}
                    </Button>
                    <Button variant="default" onClick={() => navigate('/tickets')}>
                      {t('navigation.myTickets', 'My Tickets')}
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Main render
  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="sticky top-0 z-50 bg-zinc-900/95 backdrop-blur-sm border-b border-zinc-800"
      >
        <div className="container py-4">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
            {/* Left side - Back button and ticket info */}
            <div className="flex items-center gap-4 min-w-0 flex-1">
              <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                {t('tickets.detail.back')}
              </Button>
              
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm text-zinc-500 font-mono">
                    #{ticket.ticket_number || ticket.id.slice(0, 8)}
                  </span>
                  <Badge variant={getStatusVariant(ticket.status)} className="text-xs">
                    {getStatusIcon(ticket.status)}
                    <span className="ml-1">{t(`status.${ticket.status}`)}</span>
                  </Badge>
                  <Badge variant={getPriorityVariant(ticket.priority)} className="text-xs">
                    {t(`priority.${ticket.priority}`)}
                  </Badge>
                </div>
                <h1 className="text-lg font-semibold text-zinc-100 truncate">
                  {ticket.title}
                </h1>
              </div>
            </div>

            {/* Right side - Action buttons */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <Button variant="outline" size="sm" onClick={() => window.print()}>
                <Printer className="h-4 w-4 mr-2" />
                {t('tickets.detail.print')}
              </Button>
              <Button variant="outline" size="sm" onClick={() => copyToClipboard(window.location.href)}>
                <Share2 className="h-4 w-4 mr-2" />
                {t('tickets.detail.share')}
              </Button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Main Content */}
      <div className="container py-6">
        <div className="grid grid-cols-12 gap-6">
          {/* Left Column - Main Content */}
          <div className="col-span-12 xl:col-span-8 space-y-6">
            {/* Ticket Details Card */}
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-xl">{ticket.title}</CardTitle>
                    <div className="flex items-center gap-4 text-sm text-zinc-500">
                      <span>Created {formatDate(ticket.created_at)}</span>
                      <span>•</span>
                      <span>By {requesterProfile?.full_name || 'Unknown User'}</span>
                      {ticket.updated_at !== ticket.created_at && (
                        <>
                          <span>•</span>
                          <span>Updated {formatDate(ticket.updated_at)}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Description */}
                <div>
                  <Label className="text-sm font-medium mb-2 block">Description</Label>
                  <div className="prose prose-zinc dark:prose-invert max-w-none bg-zinc-50 dark:bg-zinc-900 p-4 rounded-lg">
                    {ticket.description}
                  </div>
                </div>

                {/* Attachments */}
                {ticket.attachments && ticket.attachments.length > 0 && (
                  <div>
                    <Label className="text-sm font-medium mb-2 block">Attachments</Label>
                    <AttachmentViewer attachments={ticket.attachments} />
                  </div>
                )}

                {/* Quick Actions Bar - Only for agents/admins */}
                {canViewInternalFeatures && (
                  <div className="border-t pt-6">
                    <Label className="text-sm font-medium mb-4 block">Quick Actions</Label>
                    <div className="flex flex-wrap gap-2">
                      {/* Status Update */}
                      {canEditTicket() && (
                        <div className="flex items-center gap-2">
                          {isEditingStatus ? (
                            <>
                              <Select value={newStatus} onValueChange={setNewStatus}>
                                <SelectTrigger className="w-40">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="open">Open</SelectItem>
                                  <SelectItem value="in_progress">In Progress</SelectItem>
                                  <SelectItem value="resolved">Resolved</SelectItem>
                                  <SelectItem value="closed">Closed</SelectItem>
                                </SelectContent>
                              </Select>
                              <Button 
                                size="sm" 
                                onClick={handleStatusUpdate}
                                disabled={isLoading}
                              >
                                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                              </Button>
                              <Button 
                                size="sm" 
                                variant="outline" 
                                onClick={() => {
                                  setIsEditingStatus(false);
                                  setNewStatus(ticket.status);
                                }}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </>
                          ) : (
                            <Button 
                              size="sm" 
                              variant="outline" 
                              onClick={() => setIsEditingStatus(true)}
                            >
                              <Edit className="h-4 w-4 mr-2" />
                              Update Status
                            </Button>
                          )}
                        </div>
                      )}

                      {/* Assign to Self */}
                      {canAssignToSelf() && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleAssignToMe}
                          disabled={isAssigning}
                        >
                          {isAssigning ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          ) : (
                            <UserCheck className="h-4 w-4 mr-2" />
                          )}
                          Assign to Me
                        </Button>
                      )}

                      {/* Transfer */}
                      {canTransfer() && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setShowTransferDialog(true)}
                        >
                          <Users className="h-4 w-4 mr-2" />
                          Transfer
                        </Button>
                      )}

                      {/* Add Comment */}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setShowCommentForm(true)}
                      >
                        <MessageSquare className="h-4 w-4 mr-2" />
                        Add Comment
                      </Button>

                      {/* Add Task */}
                      {canManageTodos() && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setShowTodoForm(true)}
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Add Task
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Tabbed Content */}
            <Card>
              <CardContent className="p-0">
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <TabsList className="w-full justify-start border-b border-zinc-200 dark:border-zinc-800 rounded-none bg-transparent p-0">
                    <TabsTrigger
                      value="overview"
                      className="data-[state=active]:bg-zinc-100 dark:data-[state=active]:bg-zinc-800 rounded-none border-b-2 border-transparent data-[state=active]:border-blue-500"
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      Overview
                    </TabsTrigger>
                    <TabsTrigger
                      value="chat"
                      className="data-[state=active]:bg-zinc-100 dark:data-[state=active]:bg-zinc-800 rounded-none border-b-2 border-transparent data-[state=active]:border-blue-500"
                    >
                      <MessageCircle className="h-4 w-4 mr-2" />
                      Public Chat
                    </TabsTrigger>
                    {canViewInternalFeatures && (
                      <TabsTrigger
                        value="comments"
                        className="data-[state=active]:bg-zinc-100 dark:data-[state=active]:bg-zinc-800 rounded-none border-b-2 border-transparent data-[state=active]:border-blue-500"
                      >
                        <MessageSquare className="h-4 w-4 mr-2" />
                        Internal Comments
                      </TabsTrigger>
                    )}
                    {canViewInternalFeatures && (
                      <TabsTrigger
                        value="tasks"
                        className="data-[state=active]:bg-zinc-100 dark:data-[state=active]:bg-zinc-800 rounded-none border-b-2 border-transparent data-[state=active]:border-blue-500"
                      >
                        <CheckSquare className="h-4 w-4 mr-2" />
                        Tasks
                      </TabsTrigger>
                    )}
                    <TabsTrigger
                      value="activity"
                      className="data-[state=active]:bg-zinc-100 dark:data-[state=active]:bg-zinc-800 rounded-none border-b-2 border-transparent data-[state=active]:border-blue-500"
                    >
                      <Activity className="h-4 w-4 mr-2" />
                      Activity
                    </TabsTrigger>
                    <TabsTrigger
                      value="feedback"
                      className="data-[state=active]:bg-zinc-100 dark:data-[state=active]:bg-zinc-800 rounded-none border-b-2 border-transparent data-[state=active]:border-blue-500"
                    >
                      <Star className="h-4 w-4 mr-2" />
                      Feedback
                    </TabsTrigger>
                  </TabsList>
                  
                  <div className="p-6">
                    <TabsContent value="overview" className="m-0 space-y-6">
                      {/* Ticket Overview with all details */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <h3 className="font-medium mb-3">Ticket Information</h3>
                          <div className="space-y-3">
                            <div className="flex justify-between">
                              <span className="text-sm text-zinc-500">Status:</span>
                              <Badge variant={getStatusVariant(ticket.status)} className="text-xs">
                                {getStatusIcon(ticket.status)}
                                <span className="ml-1">{t(`status.${ticket.status}`)}</span>
                              </Badge>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-sm text-zinc-500">Priority:</span>
                              <Badge variant={getPriorityVariant(ticket.priority)} className="text-xs">
                                {t(`priority.${ticket.priority}`)}
                              </Badge>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-sm text-zinc-500">Category:</span>
                              <span className="text-sm">
                                {typeof ticket.category === 'string' ? ticket.category : ticket.category?.name || '—'}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-sm text-zinc-500">Department:</span>
                              <span className="text-sm">{ticket.department || '—'}</span>
                            </div>
                            {/* Due date removed as it's not in TicketWithDetails interface */}
                          </div>
                        </div>
                        
                        <div>
                          <h3 className="font-medium mb-3">People</h3>
                          <div className="space-y-3">
                            <div>
                              <span className="text-sm text-zinc-500 block mb-1">Requester:</span>
                              <div className="flex items-center gap-2">
                                <Avatar className="h-6 w-6">
                                  <AvatarImage src={(requesterProfile as any)?.avatar_url} />
                                  <AvatarFallback className="text-xs">
                                    {requesterProfile?.full_name?.split(' ').map(n => n[0]).join('')}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="text-sm">{requesterProfile?.full_name || 'Unknown'}</span>
                              </div>
                            </div>
                            
                            <div>
                              <span className="text-sm text-zinc-500 block mb-1">Assignee:</span>
                              {assigneeProfile ? (
                                <div className="flex items-center gap-2">
                                  <Avatar className="h-6 w-6">
                                    <AvatarImage src={(assigneeProfile as any)?.avatar_url} />
                                    <AvatarFallback className="text-xs">
                                      {assigneeProfile?.full_name?.split(' ').map(n => n[0]).join('')}
                                    </AvatarFallback>
                                  </Avatar>
                                  <span className="text-sm">{assigneeProfile?.full_name}</span>
                                </div>
                              ) : (
                                <span className="text-sm text-zinc-500">Unassigned</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {/* SLA Monitor */}
                      <div>
                        <h3 className="font-medium mb-3">SLA Monitoring</h3>
                        <SLAMonitor
                          key={`sla-${refreshKey}`}
                          ticketId={ticket.id}
                          priority={ticket.priority}
                          status={ticket.status}
                          createdAt={ticket.created_at}
                          userRole={userRole}
                          resolvedAt={ticket.resolved_at}
                          closedAt={ticket.closed_at}
                        />
                      </div>
                    </TabsContent>

                    <TabsContent value="chat" className="m-0">
                      <ModernTicketChat key={`chat-${refreshKey}`} ticketId={ticket.id} />
                    </TabsContent>

                    {canViewInternalFeatures && (
                      <TabsContent value="comments" className="m-0">
                        <InternalComments 
                          key={`comments-${refreshKey}`}
                          ticketId={ticket.id} 
                          userRole={userRole}
                          assignedUserId={ticket.assigned_to ?? null}
                        />
                      </TabsContent>
                    )}

                    {canViewInternalFeatures && (
                      <TabsContent value="tasks" className="m-0">
                        <TaskManagement 
                          key={`tasks-${refreshKey}`}
                          ticketId={ticket.id} 
                          canManageTasks={canManageTodos()}
                        />
                      </TabsContent>
                    )}

                    <TabsContent value="activity" className="m-0">
                      <ActivityLog key={`activity-${refreshKey}`} ticketId={ticket.id} />
                    </TabsContent>

                    <TabsContent value="feedback" className="m-0">
                      <TicketFeedback 
                        key={`feedback-${refreshKey}`}
                        ticketId={ticket.id} 
                        status={ticket.status}
                        agentName={assigneeProfile?.full_name ?? ''}
                      />
                    </TabsContent>
                  </div>
                </Tabs>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Sidebar */}
          <div className="col-span-12 xl:col-span-4 space-y-6">
            {/* Tags */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Tag className="h-4 w-4" />
                  Tags
                </CardTitle>
              </CardHeader>
              <CardContent>
                <TicketTags
                  ticketId={ticket.id}
                  selectedTags={[]} // Tags not available in TicketWithDetails interface
                  onTagsChange={() => setRefreshKey(prev => prev + 1)}
                  mode={canEditTicket() ? 'edit' : 'display'}
                />
              </CardContent>
            </Card>

            {/* Knowledge Base */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <BookOpen className="h-4 w-4" />
                  Related Articles
                </CardTitle>
              </CardHeader>
              <CardContent>
                <KnowledgeBase embedded ticketCategory={ticket.category_id ?? undefined} />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Comment Dialog */}
      <Dialog open={showCommentForm} onOpenChange={setShowCommentForm}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add Comment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="comment-content">Comment</Label>
              <Textarea
                id="comment-content"
                value={commentForm.content}
                onChange={(e) => setCommentForm(prev => ({ ...prev, content: e.target.value }))}
                placeholder="Write your comment here..."
                rows={4}
                className="mt-1"
              />
            </div>
            
            {canViewInternalFeatures && (
              <div className="flex items-center space-x-2">
                <Switch
                  id="internal-comment"
                  checked={commentForm.is_internal}
                  onCheckedChange={(checked) => setCommentForm(prev => ({ ...prev, is_internal: checked }))}
                />
                <Label htmlFor="internal-comment" className="text-sm">
                  Internal comment (only visible to agents and admins)
                </Label>
              </div>
            )}
            
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowCommentForm(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleSubmitComment}
                disabled={isSubmittingComment || !commentForm.content.trim()}
              >
                {isSubmittingComment ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                Add Comment
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Transfer Dialog */}
      <Dialog open={showTransferDialog} onOpenChange={setShowTransferDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Transfer Ticket</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="transfer-agent">Select Agent</Label>
              <Select 
                value={transferForm.agent_id} 
                onValueChange={(value) => setTransferForm(prev => ({ ...prev, agent_id: value }))}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Choose an agent..." />
                </SelectTrigger>
                <SelectContent>
                  {agents
                    .filter(agent => agent.id !== userProfile?.id)
                    .map(agent => (
                      <SelectItem key={agent.id} value={agent.id}>
                        {agent.full_name} ({agent.email})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="transfer-reason">Transfer Reason</Label>
              <Textarea
                id="transfer-reason"
                value={transferForm.reason}
                onChange={(e) => setTransferForm(prev => ({ ...prev, reason: e.target.value }))}
                placeholder="Please provide a reason for the transfer..."
                rows={3}
                className="mt-1"
              />
            </div>
            
            <div className="flex items-center space-x-2">
              <Switch
                id="add-comment"
                checked={transferForm.add_comment}
                onCheckedChange={(checked) => setTransferForm(prev => ({ ...prev, add_comment: checked }))}
              />
              <Label htmlFor="add-comment" className="text-sm">
                Add transfer comment to ticket activity
              </Label>
            </div>
            
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowTransferDialog(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleTransferTicket}
                disabled={isTransferring || !transferForm.agent_id || !transferForm.reason.trim()}
              >
                {isTransferring ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Users className="h-4 w-4 mr-2" />
                )}
                Transfer Ticket
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Task Dialog */}
      <Dialog open={showTodoForm} onOpenChange={setShowTodoForm}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create Task</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="todo-title">Task Title</Label>
              <Input
                id="todo-title"
                value={todoForm.title}
                onChange={(e) => setTodoForm(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Enter task title..."
                className="mt-1"
              />
            </div>
            
            <div>
              <Label htmlFor="todo-description">Description</Label>
              <Textarea
                id="todo-description"
                value={todoForm.description}
                onChange={(e) => setTodoForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Task description (optional)..."
                rows={3}
                className="mt-1"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="todo-priority">Priority</Label>
                <Select 
                  value={todoForm.priority} 
                  onValueChange={(value: any) => setTodoForm(prev => ({ ...prev, priority: value }))}
                >
                  <SelectTrigger className="mt-1">
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
                <Label htmlFor="todo-hours">Estimated Hours</Label>
                <Input
                  id="todo-hours"
                  type="number"
                  value={todoForm.estimated_hours || ''}
                  onChange={(e) => setTodoForm(prev => ({ ...prev, estimated_hours: Number(e.target.value) || undefined }))}
                  placeholder="Hours..."
                  className="mt-1"
                />
              </div>
            </div>
            
            <div>
              <Label htmlFor="todo-due-date">Due Date</Label>
              <Input
                id="todo-due-date"
                type="datetime-local"
                value={todoForm.due_date || ''}
                onChange={(e) => setTodoForm(prev => ({ ...prev, due_date: e.target.value || undefined }))}
                className="mt-1"
              />
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Switch
                  id="collaborative-task"
                  checked={todoForm.is_collaborative}
                  onCheckedChange={(checked) => setTodoForm(prev => ({ ...prev, is_collaborative: checked }))}
                />
                <Label htmlFor="collaborative-task" className="text-sm">
                  Collaborative task (assign to another agent)
                </Label>
              </div>
              
              {todoForm.is_collaborative && (
                <div>
                  <Label htmlFor="collaborative-assignee">Assign To</Label>
                  <Select 
                    value={collaborativeAssignee} 
                    onValueChange={setCollaborativeAssignee}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Choose an agent..." />
                    </SelectTrigger>
                    <SelectContent>
                      {agents.map(agent => (
                        <SelectItem key={agent.id} value={agent.id}>
                          {agent.full_name} ({agent.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowTodoForm(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleCreateTodo}
                disabled={isCreatingTodo || !todoForm.title.trim() || (todoForm.is_collaborative && !collaborativeAssignee)}
              >
                {isCreatingTodo ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <CheckSquare className="h-4 w-4 mr-2" />
                )}
                Create Task
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Resolution Dialog */}
      <Dialog open={showResolutionDialog} onOpenChange={setShowResolutionDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Resolve Ticket</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="resolution-notes">Resolution Notes</Label>
              <Textarea
                id="resolution-notes"
                value={resolutionNotes}
                onChange={(e) => setResolutionNotes(e.target.value)}
                placeholder="Please provide detailed resolution notes explaining how the issue was resolved..."
                rows={4}
                className="mt-1"
              />
              <p className="text-sm text-zinc-500 mt-1">
                These notes will be visible to the customer and will help them understand how their issue was resolved.
              </p>
            </div>
            
            <div className="flex justify-end gap-2">
              <Button 
                variant="outline" 
                onClick={() => {
                  setShowResolutionDialog(false);
                  setResolutionNotes("");
                  setNewStatus(ticket?.status || "");
                }}
              >
                Cancel
              </Button>
              <Button 
                onClick={handleResolveTicket}
                disabled={isLoading || !resolutionNotes.trim()}
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <CheckCircle className="h-4 w-4 mr-2" />
                )}
                Resolve Ticket
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Feedback Popup */}
      {ticket && (
        <FeedbackPopup
          ticketId={ticket.id}
          open={showFeedbackPopup}
          onOpenChange={setShowFeedbackPopup}
          onFeedbackSubmitted={() => {
            setRefreshKey(prev => prev + 1);
            triggerRefresh();
          }}
        />
      )}
    </div>
  );
}

export default TicketDetailPage;
