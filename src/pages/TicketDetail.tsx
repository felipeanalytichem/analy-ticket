import { useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  ArrowLeft, 
  Edit, 
  Printer, 
  Share2,
  Clock,
  User,
  AlertCircle,
  MessageSquare,
  History,
  Star,
  Tag,
  BookOpen,
  Target,
  Copy,
  ChevronRight,
  Hexagon,
  Circle,
  Shield,
  Info,
  Calendar,
  Users,
  Bell,
  FileText,
  Layers,
  Activity,
  Share,
  CheckCircle,
  AlertTriangle,
  XCircle,
  UserPlus,
  MessageCircle,
  CheckSquare,
  Mail,
  Plus
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { motion, AnimatePresence } from "framer-motion";
import { useIsMobile } from "@/hooks/use-mobile";

import { InternalComments } from "@/components/tickets/InternalComments";
import { ActivityLog } from "@/components/tickets/ActivityLog";
import { TicketFeedback } from "@/components/tickets/TicketFeedback";
import { TicketTags } from "@/components/tickets/TicketTags";
import { TicketProperties } from '@/components/tickets/TicketProperties';
import { ModernTicketChat } from '@/components/chat/ModernTicketChat';
import { TaskManagement } from '@/components/tickets/TaskManagement';
import { useTicket } from '@/components/tickets/hooks/useTicket';
import { useAuth } from '@/contexts/AuthContext';
import { Skeleton } from '@/components/ui/skeleton';
import { useUser } from '@/hooks/useUser';
import { useTranslation } from 'react-i18next';
import { SLAMonitor } from '@/components/tickets/SLAMonitor';
import { KnowledgeBase } from '@/components/knowledge/KnowledgeBase';

export const TicketDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  const userRole = (userProfile?.role ?? 'user') as 'user' | 'agent' | 'admin';
  const { t } = useTranslation();

  const {
    data: ticket,
    isLoading,
    isError,
    error
  } = useTicket(id);

  // Fetch requester and assignee profiles
  const { data: requesterProfile } = useUser(ticket?.user_id);
  const { data: assigneeProfile } = useUser(ticket?.assigned_to ?? undefined);

  // Memoized helpers to prevent re-creation on every render
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
      return true;
    } catch (err) {
      console.error('Failed to copy text:', err);
      return false;
    }
  };

  // Add this helper function to format the ticket number
  const formatTicketNumber = (ticketNumber: string) => {
    // Check if it's a UUID format (contains multiple hyphens and is long)
    const isUUID = ticketNumber.includes('-') && ticketNumber.length > 20;
    if (isUUID) {
      return 'ACS-TK-' + ticketNumber.substring(0, 6).toUpperCase();
    }
    return ticketNumber;
  };

  // Add this helper function to format category ID
  const formatCategoryId = (categoryId: string | null) => {
    if (!categoryId) return 'N/A';
    // Check if it's a UUID format
    const isUUID = categoryId.includes('-') && categoryId.length > 20;
    if (isUUID) {
      return 'CAT-' + categoryId.substring(0, 4).toUpperCase();
    }
    return categoryId;
  };

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-4">
        <Skeleton className="h-10 w-1/3" />
        <Skeleton className="h-6 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (isError || !ticket) {
    // Enhanced error handling for different error types
    const getErrorContent = () => {
      if (!error) {
        return {
          title: t('errors.ticketNotFound', 'Ticket not found'),
          message: t('errors.ticketNotFoundMessage', 'The requested ticket could not be found.'),
          showBackButton: true
        };
      }

      // Handle specific error types with appropriate user messages
      if (error.name === 'ForbiddenError' || (error as any).status === 403) {
        return {
          title: t('errors.accessDenied', 'Access Denied'),
          message: t('errors.accessDeniedMessage', 'You do not have permission to view this ticket. You can only access tickets that you have created.'),
          showBackButton: true
        };
      }

      if (error.name === 'NotFoundError' || (error as any).status === 404) {
        return {
          title: t('errors.ticketNotFound', 'Ticket Not Found'),
          message: t('errors.ticketNotFoundMessage', 'The requested ticket could not be found. It may have been deleted or you may not have permission to view it.'),
          showBackButton: true
        };
      }

      if (error.name === 'BadRequestError' || (error as any).status === 400) {
        return {
          title: t('errors.invalidRequest', 'Invalid Request'),
          message: t('errors.invalidRequestMessage', 'The ticket ID provided is invalid.'),
          showBackButton: true
        };
      }

      // Generic error for other cases
      return {
        title: t('errors.loadingError', 'Error Loading Ticket'),
        message: t('errors.loadingErrorMessage', 'An error occurred while loading the ticket. Please try again later.'),
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

  const handleTagsChange = (tags: string[]) => {
    console.log("Tags atualizadas:", tags);
  };

  function getStatusVariant(status: string): "default" | "destructive" | "outline" | "secondary" {
    switch (status) {
      case 'open':
        return 'secondary';
      case 'in_progress':
        return 'default';
      case 'resolved':
        return 'outline';
      case 'closed':
        return 'destructive';
      default:
        return 'secondary';
    }
  }

  function getPriorityVariant(priority: string): "default" | "destructive" | "outline" | "secondary" {
    switch (priority) {
      case 'urgent':
        return 'destructive';
      case 'high':
        return 'default';
      case 'medium':
        return 'secondary';
      case 'low':
        return 'outline';
      default:
        return 'secondary';
    }
  }

  const canViewInternalFeatures = userRole === "agent" || userRole === "admin";

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Sticky Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="sticky top-0 z-50 bg-zinc-900/80 backdrop-blur-lg border-b border-zinc-800"
      >
        <div className="container py-3 md:py-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 md:gap-4 w-full sm:w-auto">
              <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">{t('tickets.detail.back')}</span>
                <span className="sm:hidden">{t('tickets.detail.back')}</span>
              </Button>
              <div className="flex items-center gap-1 md:gap-2 flex-wrap">
                <span className="text-xs md:text-sm text-zinc-500 truncate max-w-[100px] md:max-w-none">{ticket.id}</span>
                <Badge variant={getStatusVariant(ticket.status)} className="text-xs">
                  {ticket.status}
                </Badge>
                <Badge variant={getPriorityVariant(ticket.priority)} className="text-xs">
                  {ticket.priority}
                </Badge>
              </div>
            </div>
            <div className="flex items-center gap-1 md:gap-2 w-full sm:w-auto">
              <Button variant="outline" size="sm" onClick={() => window.print()} className="flex-1 sm:flex-none">
                <Printer className="h-4 w-4 mr-1 md:mr-2" />
                <span className="hidden md:inline">{t('tickets.detail.print')}</span>
                <span className="md:hidden">{t('tickets.detail.print')}</span>
              </Button>
              <Button variant="outline" size="sm" onClick={() => copyToClipboard(window.location.href)} className="flex-1 sm:flex-none">
                <Share2 className="h-4 w-4 mr-1 md:mr-2" />
                <span className="hidden md:inline">{t('tickets.detail.share')}</span>
                <span className="md:hidden">{t('tickets.detail.share')}</span>
              </Button>
              {canViewInternalFeatures && (
                <Button variant="default" size="sm" className="flex-1 sm:flex-none">
                  <Edit className="h-4 w-4 mr-1 md:mr-2" />
                  <span className="hidden md:inline">{t('tickets.detail.edit')}</span>
                  <span className="md:hidden">{t('tickets.detail.edit')}</span>
                </Button>
              )}
            </div>
          </div>
        </div>
      </motion.div>

      <div className="container py-6">
        {/* Title and Metadata */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-2xl font-semibold text-zinc-100 mb-4">
            {ticket.title}
          </h1>
          <div className="flex items-center gap-6 text-sm text-zinc-400">
                    <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-zinc-500" />
              <span>{t('tickets.detail.createdBy', { name: requesterProfile?.full_name ?? '—' })}</span>
                    </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-zinc-500" />
              <span>{formatDate(ticket.created_at)}</span>
                  </div>
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-zinc-500" />
              <span>{t('tickets.detail.assignedTo', { name: assigneeProfile?.full_name ?? '—' })}</span>
                    </div>
            {ticket.resolved_at && (
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-emerald-500" />
                <span>{t('tickets.detail.resolved', { date: formatDate(ticket.resolved_at) })}</span>
                    </div>
            )}
                  </div>
        </motion.div>

        {/* Main Grid Layout */}
        <div className="grid grid-cols-12 gap-6">
          {/* Left Content Area */}
          <div className="col-span-12 lg:col-span-8 space-y-6">
            {/* Description Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle>{t('tickets.detail.description')}</CardTitle>
              </CardHeader>
              <CardContent>
                  <div className="prose prose-zinc dark:prose-invert max-w-none">
                      {ticket.description}
                </div>
              </CardContent>
            </Card>
            </motion.div>

            {/* Tabs Section */}
            <Card>
              <CardContent className="p-0">
                <Tabs defaultValue="chat">
                  <TabsList className="w-full justify-start border-b border-zinc-800 rounded-none bg-transparent p-0">
                    <TabsTrigger
                      value="chat"
                      className="data-[state=active]:bg-zinc-800/50 rounded-none border-b-2 border-transparent data-[state=active]:border-blue-500"
                    >
                      <MessageCircle className="h-4 w-4 mr-2" />
                      {t('tickets.detail.chat')}
                </TabsTrigger>
                    <TabsTrigger
                      value="comments"
                      className="data-[state=active]:bg-zinc-800/50 rounded-none border-b-2 border-transparent data-[state=active]:border-blue-500"
                    >
                      <MessageSquare className="h-4 w-4 mr-2" />
                      {t('tickets.detail.comments')}
                  </TabsTrigger>
                    <TabsTrigger
                      value="tasks"
                      className="data-[state=active]:bg-zinc-800/50 rounded-none border-b-2 border-transparent data-[state=active]:border-blue-500"
                    >
                      <CheckSquare className="h-4 w-4 mr-2" />
                      {t('tickets.detail.tasks')}
                  </TabsTrigger>
                    <TabsTrigger
                      value="activity"
                      className="data-[state=active]:bg-zinc-800/50 rounded-none border-b-2 border-transparent data-[state=active]:border-blue-500"
                    >
                      <Activity className="h-4 w-4 mr-2" />
                      {t('tickets.detail.activity')}
                </TabsTrigger>
                    <TabsTrigger
                      value="feedback"
                      className="data-[state=active]:bg-zinc-800/50 rounded-none border-b-2 border-transparent data-[state=active]:border-blue-500"
                    >
                      <Star className="h-4 w-4 mr-2" />
                      {t('tickets.detail.feedback')}
                </TabsTrigger>
              </TabsList>
              
                  <div className="p-4">
                    <TabsContent value="chat" className="m-0">
                <ModernTicketChat ticketId={ticket.id} />
              </TabsContent>
                    <TabsContent value="comments" className="m-0">
                  <InternalComments 
                    ticketId={ticket.id} 
                    userRole={userRole}
                    assignedUserId={ticket.assigned_to ?? null}
                  />
                </TabsContent>
                    <TabsContent value="tasks" className="m-0">
                  <TaskManagement 
                    ticketId={ticket.id} 
                    canManageTasks={userRole === 'agent' || userRole === 'admin'}
                  />
                </TabsContent>
                    <TabsContent value="activity" className="m-0">
                <ActivityLog ticketId={ticket.id} />
              </TabsContent>
                    <TabsContent value="feedback" className="m-0">
                <TicketFeedback 
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

          {/* Right Sidebar */}
          <div className="col-span-12 lg:col-span-4 space-y-6">
            {/* Quick Actions */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Card>
                <CardContent className="p-4">
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" className="flex-1">
                      <UserPlus className="h-4 w-4 mr-2" />
                      {t('tickets.detail.assignToMe')}
                    </Button>
                    <Button variant="outline" size="sm" className="flex-1">
                      <AlertTriangle className="h-4 w-4 mr-2" />
                      {t('tickets.detail.escalate')}
                    </Button>
                    <Button variant="outline" size="sm" className="flex-1 text-red-500 hover:text-red-600">
                      <XCircle className="h-4 w-4 mr-2" />
                      {t('tickets.detail.close')}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Properties Section */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
            >
              <Card>
                <CardHeader className="border-b border-zinc-200 dark:border-zinc-800">
                  <CardTitle className="flex items-center gap-2 text-zinc-900 dark:text-white">
                    <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    {t('tickets.detail.properties')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
                    {/* Category */}
                    <div className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-lg bg-purple-100 dark:bg-purple-900/20 flex items-center justify-center">
                          <Hexagon className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-zinc-900 dark:text-white">{t('tickets.detail.category')}</p>
                          <p className="text-sm text-zinc-500 dark:text-zinc-400">
                            {ticket.category ?? '—'}
                          </p>
                        </div>
                      </div>
                      {canViewInternalFeatures && (
                        <Button variant="ghost" size="sm" className="text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white">
                          <Edit className="h-4 w-4" />
                        </Button>
                      )}
                    </div>

                    {/* Department */}
                    <div className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-lg bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center">
                          <BookOpen className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-zinc-900 dark:text-white">{t('tickets.detail.department')}</p>
                          <p className="text-sm text-zinc-500 dark:text-zinc-400">
                            {ticket.department ?? '—'}
                          </p>
                        </div>
                      </div>
                      {canViewInternalFeatures && (
                        <Button variant="ghost" size="sm" className="text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white">
                          <Edit className="h-4 w-4" />
                        </Button>
                      )}
                    </div>

                    {/* Due Date */}
                    <div className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-lg bg-amber-100 dark:bg-amber-900/20 flex items-center justify-center">
                          <Calendar className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-zinc-900 dark:text-white">{t('tickets.detail.dueDate')}</p>
                          <p className="text-sm text-zinc-500 dark:text-zinc-400">
                            {ticket.due_date ? formatDate(ticket.due_date) : '—'}
                          </p>
                        </div>
                      </div>
                      {canViewInternalFeatures && (
                        <Button variant="ghost" size="sm" className="text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white">
                          <Edit className="h-4 w-4" />
                        </Button>
                      )}
                    </div>

                    {/* Custom Fields */}
                    {ticket.custom_fields && Object.entries(ticket.custom_fields).map(([key, value]) => (
                      <div key={key} className="p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                            <Tag className="h-4 w-4 text-zinc-600 dark:text-zinc-400" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-zinc-900 dark:text-white">
                              {key.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                            </p>
                            <p className="text-sm text-zinc-500 dark:text-zinc-400">
                              {value?.toString() ?? '—'}
                            </p>
                          </div>
                        </div>
                        {canViewInternalFeatures && (
                          <Button variant="ghost" size="sm" className="text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white">
                            <Edit className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* SLA Monitoring */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">{t('tickets.detail.slaMonitoring')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <SLAMonitor
                    ticketId={ticket.id}
                    priority={ticket.priority}
                    status={ticket.status}
                    createdAt={ticket.created_at}
                    userRole={userRole}
                    resolvedAt={ticket.resolved_at}
                    closedAt={ticket.closed_at}
                  />
                </CardContent>
              </Card>
            </motion.div>

            {/* Tags */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.6 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">{t('tickets.detail.tags')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <TicketTags
                    ticketId={ticket.id}
                    selectedTags={ticket.tags ?? []}
                    onTagsChange={handleTagsChange}
                    mode={userRole !== 'user' ? 'edit' : 'display'}
                  />
                </CardContent>
              </Card>
            </motion.div>

            {/* Related Articles */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.7 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <span>{t('tickets.detail.knowledgeBase')}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <KnowledgeBase embedded ticketCategory={ticket.category_id ?? undefined} />
                </CardContent>
              </Card>
            </motion.div>

            {/* People Section */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.8 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-blue-500" />
                    {t('tickets.detail.people')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y divide-zinc-800">
                    {/* Requester */}
                    <div className="p-4">
                      <div className="flex items-center justify-between mb-4">
                        <p className="text-sm font-medium text-zinc-400">{t('tickets.detail.requester')}</p>
                        {canViewInternalFeatures && (
                          <Button variant="ghost" size="sm" className="text-zinc-500 hover:text-zinc-400">
                            <Mail className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarImage src={requesterProfile?.avatar_url} />
                          <AvatarFallback>
                            {requesterProfile?.full_name?.split(' ').map(n => n[0]).join('')}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium text-zinc-200">
                            {requesterProfile?.full_name}
                          </p>
                          <p className="text-sm text-zinc-500">
                            {requesterProfile?.email}
                          </p>
                          {requesterProfile?.department && (
                            <p className="text-xs text-zinc-600 mt-1">
                              {requesterProfile.department}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Assignee */}
                    <div className="p-4">
                      <div className="flex items-center justify-between mb-4">
                        <p className="text-sm font-medium text-zinc-400">{t('tickets.detail.assignee')}</p>
                        <div className="flex items-center gap-2">
                          {canViewInternalFeatures && (
                            <>
                              <Button variant="ghost" size="sm" className="text-zinc-500 hover:text-zinc-400">
                                <Mail className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="sm" className="text-zinc-500 hover:text-zinc-400">
                                <UserPlus className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                      {assigneeProfile ? (
                        <div className="flex items-center gap-3">
                          <Avatar>
                            <AvatarImage src={assigneeProfile?.avatar_url} />
                            <AvatarFallback>
                              {assigneeProfile?.full_name?.split(' ').map(n => n[0]).join('')}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-sm font-medium text-zinc-200">
                              {assigneeProfile?.full_name}
                            </p>
                            <p className="text-sm text-zinc-500">
                              {assigneeProfile?.email}
                            </p>
                            {assigneeProfile?.role && (
                              <Badge variant="outline" className="mt-2">
                                {assigneeProfile.role}
                              </Badge>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-sm text-zinc-500">
                          <User className="h-4 w-4" />
                          <span>Unassigned</span>
                          {canViewInternalFeatures && (
                            <Button variant="outline" size="sm" className="ml-auto">
                              Assign
                            </Button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Followers */}
                    {canViewInternalFeatures && (
                      <div className="p-4">
                        <div className="flex items-center justify-between mb-4">
                          <p className="text-sm font-medium text-zinc-400">Followers</p>
                          <Button variant="ghost" size="sm" className="text-zinc-500 hover:text-zinc-400">
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="flex -space-x-2">
                          {ticket.followers?.map((follower) => (
                            <Avatar key={follower.id} className="border-2 border-zinc-900">
                              <AvatarImage src={follower.avatar_url} />
                              <AvatarFallback>
                                {follower.full_name?.split(' ').map(n => n[0]).join('')}
                              </AvatarFallback>
                            </Avatar>
                          ))}
                          {!ticket.followers?.length && (
                            <p className="text-sm text-zinc-500">No followers yet</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TicketDetail;
