import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Clock, 
  User, 
  AlertCircle, 
  MessageSquare, 
  History, 
  CheckCircle,
  CheckSquare,
  UserCheck,
  Paperclip,
  Download,
  FileText,
  Image,
  File,
  Star,
  RotateCcw,
  Users,
  Building,
  Phone,
  Calendar,
  Mail,
  MapPin,
  Briefcase,
  Shield,
  Target,
  Loader2
} from "lucide-react";
import { InternalComments } from "../InternalComments";
import { ActivityLog } from "../ActivityLog";
import { SLAMonitor } from "../SLAMonitor";
import { TicketFeedback } from "../TicketFeedback";
import { TaskManagement } from "../TaskManagement";
import { ReopenRequestDialog } from "./ReopenRequestDialog";
import { TodoTaskModal } from "../../todo/TodoTaskModal";
import { TicketWithDetails, DatabaseService } from "@/lib/database";
import { ReopenService } from "@/lib/reopen-service";
import { Button } from "@/components/ui/button";
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useTicketCount } from "@/contexts/TicketCountContext";
import { toast } from "@/components/ui/sonner";
import { supabase } from "@/lib/supabase";
import { TicketTransferDialog } from "./TicketTransferDialog";
import { useTranslation } from "react-i18next";
import { ModernTicketChat } from "../../chat/ModernTicketChat";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { QuickAssignDialog } from "./QuickAssignDialog";

interface TicketDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ticket: TicketWithDetails | null;
  userRole?: "user" | "agent" | "admin";
  onTicketUpdate?: () => void;
}

export const TicketDetailsDialog = ({ 
  open, 
  onOpenChange, 
  ticket, 
  userRole = "user",
  onTicketUpdate 
}: TicketDetailsDialogProps) => {
  const [currentTicket, setCurrentTicket] = useState<TicketWithDetails | null>(ticket);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isReopenDialogOpen, setIsReopenDialogOpen] = useState(false);
  const [canRequestReopen, setCanRequestReopen] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isTransferDialogOpen, setIsTransferDialogOpen] = useState(false);
  const [isQuickAssignDialogOpen, setIsQuickAssignDialogOpen] = useState(false);
  const { userProfile } = useAuth();
  const { triggerRefresh } = useTicketCount();
  const { t } = useTranslation();
  const isMobile = useIsMobile();

  const checkReopenPermissions = useCallback(async () => {
    if (!ticket || !userProfile) {
      setCanRequestReopen(false);
      return;
    }

    try {
      const canReopen = await ReopenService.canRequestReopen(ticket.id, userProfile.id);
      setCanRequestReopen(canReopen);
    } catch (error) {
      console.error('Error checking reopen permissions:', error);
      setCanRequestReopen(false);
    }
  }, [ticket, userProfile]);

  useEffect(() => {
    setCurrentTicket(ticket);
    checkReopenPermissions();
  }, [ticket, checkReopenPermissions]);

  const refreshTicketData = async () => {
    if (!ticket) return;
    
    try {
      const updatedTicket = await DatabaseService.getTicketById(ticket.id);
      setCurrentTicket(updatedTicket);
      setRefreshKey(prev => prev + 1);
      await checkReopenPermissions();
      
      if (onTicketUpdate) {
        onTicketUpdate();
      }
    } catch (error) {
      console.error('Error refreshing ticket data:', error);
    }
  };

  if (!currentTicket) return null;

  const canAssignToSelf = () => {
    return userRole === "agent" && 
           !currentTicket.assigned_to && 
           userProfile?.id &&
           currentTicket.status !== 'resolved' &&
           currentTicket.status !== 'closed';
  };

  const canAddTasks = () => {
    // Não permitir adicionar tasks se o ticket estiver resolved ou closed
    if (currentTicket.status === 'resolved' || currentTicket.status === 'closed') {
      return false;
    }
    
    if (userRole === "admin") return true;
    if (userRole === "agent" && currentTicket.assigned_to === userProfile?.id) return true;
    return false;
  };

  const canTransfer = () => {
    return (userRole === "admin" || userRole === "agent") && currentTicket.status !== 'closed' && currentTicket.status !== 'resolved';
  };

  const canViewInternalFeatures = userRole === "agent" || userRole === "admin";

  const getStatusColor = (status: string) => {
    const colors = {
      open: "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700",
      in_progress: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800",
      resolved: "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800",
      closed: "bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700"
    };
    return colors[status as keyof typeof colors] || "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700";
  };

  const getStatusIcon = (status: string) => {
    const icons = {
      open: <AlertCircle className="h-4 w-4" />,
      in_progress: <Clock className="h-4 w-4" />,
      resolved: <CheckCircle className="h-4 w-4" />,
      closed: <CheckCircle className="h-4 w-4" />
    };
    return icons[status as keyof typeof icons] || <AlertCircle className="h-4 w-4" />;
  };

  const formatPriority = (priority: string) => {
    return t(`priority.${priority}`, priority);
  };

  const formatStatus = (status: string) => {
    const statusKeyMap: Record<string, string> = {
      'open': 'open',
      'in_progress': 'in_progress',
      'resolved': 'resolved',
      'closed': 'closed'
    };
    return t(`status.${statusKeyMap[status] || status}`, status);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "urgent": return "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800";
      case "high": return "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800";
      case "medium": return "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800";
      case "low": return "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800";
      default: return "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700";
    }
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return <Image className="h-4 w-4" />;
    if (mimeType.includes('pdf')) return <FileText className="h-4 w-4" />;
    return <File className="h-4 w-4" />;
  };

  const handleAssignToMe = async () => {
    if (!currentTicket || !userProfile) return;
    
    setIsAssigning(true);
    try {
      await DatabaseService.updateTicket(currentTicket.id, {
        assigned_to: userProfile.id,
        status: 'in_progress',
        updated_at: new Date().toISOString()
      });

      // Create notification
      await DatabaseService.createTicketNotification(currentTicket.id, 'ticket_assigned');

      toast.success("Ticket atribuído", {
        description: "O ticket foi atribuído a você com sucesso."
      });

      refreshTicketData();
      triggerRefresh();
    } catch (error) {
      console.error('Error assigning ticket:', error);
      toast.error("Erro ao atribuir ticket", {
        description: "Ocorreu um erro ao atribuir o ticket. Por favor, tente novamente."
      });
    } finally {
      setIsAssigning(false);
    }
  };

  const handleDownload = async (attachment: { file_path: string; file_name: string }) => {
    try {
      const { data, error } = await supabase.storage
        .from('ticket-attachments')
        .download(attachment.file_path);

      if (error) {
        throw error;
      }

      // Create a URL for the downloaded file
      const url = window.URL.createObjectURL(data);
      
      // Create a temporary link element
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', attachment.file_name);
      document.body.appendChild(link);
      
      // Trigger the download
      link.click();
      
      // Clean up
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading file:', error);
      toast.error("Erro ao baixar arquivo", {
        description: "Ocorreu um erro ao baixar o arquivo. Por favor, tente novamente."
      });
    }
  };

  const handleAssignTicket = () => {
    setIsQuickAssignDialogOpen(true);
  };

  const handleAssignmentComplete = () => {
    setIsQuickAssignDialogOpen(false);
    refreshTicketData();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(
        "max-w-4xl max-h-[90vh] overflow-y-auto",
        isMobile && "w-full h-full max-h-screen rounded-none"
      )}>
        <DialogHeader className="pb-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              {currentTicket.ticket_number && (
                <span className="font-mono text-sm bg-blue-100 dark:bg-blue-900 px-2 py-1 rounded">
                  #{currentTicket.ticket_number}
                </span>
              )}
              <span className="truncate">{currentTicket.title}</span>
            </DialogTitle>
            
            <div className="flex items-center gap-2">
              {/* Add the Assign button for admins */}
              {userRole === "admin" && (
                <Button
                  onClick={handleAssignTicket}
                  variant="outline"
                  size="sm"
                  className="gap-2"
                >
                  <UserCheck className="h-4 w-4" />
                  {t('tickets.assign.assignToAgent')}
                </Button>
              )}
              
              {/* Add the Assign to Me button for agents */}
              {canAssignToSelf() && (
                <Button
                  onClick={handleAssignToMe}
                  disabled={isAssigning}
                  variant="outline"
                  size="sm"
                  className="gap-2"
                >
                  <UserCheck className="h-4 w-4" />
                  {isAssigning ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {t('tickets.assign.assigning')}
                    </>
                  ) : (
                    t('tickets.assign.assignToMe')
                  )}
                </Button>
              )}

              {/* Existing buttons */}
              {canTransfer() && (
                <Button
                  onClick={() => setIsTransferDialogOpen(true)}
                  variant="outline"
                  size="sm"
                  className="gap-2"
                >
                  <Users className="h-4 w-4" />
                  {t('tickets.transfer.button')}
                </Button>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          <Card className="dark:bg-gray-800 dark:border-gray-700">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge className={getStatusColor(currentTicket.status)}>
                      {getStatusIcon(currentTicket.status)}
                      <span className="ml-1">{formatStatus(currentTicket.status)}</span>
                    </Badge>
                    <Badge className={getPriorityColor(currentTicket.priority)}>
                      {formatPriority(currentTicket.priority)}
                    </Badge>
                    {currentTicket.category && (
                      <Badge variant="outline" className="dark:border-gray-600 dark:text-gray-300">
                        {currentTicket.category.name}
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="text-right text-sm text-gray-600 dark:text-gray-400">
                    <div className="flex items-center gap-1 mb-1">
                      <Clock className="h-4 w-4" />
                      {t('tickets.created_on')} {formatDate(currentTicket.created_at || '')}
                    </div>
                    <div className="flex items-center gap-1">
                      <History className="h-4 w-4" />
                      {t('tickets.updated_on')} {formatDate(currentTicket.updated_at || '')}
                    </div>
                  </div>
                  
                  <div className="flex flex-col gap-2">
                    {canRequestReopen && (
                      <Button
                        onClick={() => setIsReopenDialogOpen(true)}
                        size="sm"
                        className="bg-orange-600 hover:bg-orange-700 text-white"
                      >
                        <RotateCcw className="h-4 w-4 mr-2" />
                        {t('tickets.request_reopen')}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-semibold mb-2 dark:text-gray-100">{t('tickets.description')}</h4>
                <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                  {currentTicket.description}
                </p>
              </div>

              {/* Employee Onboarding Information */}
              {(currentTicket.first_name || currentTicket.last_name || currentTicket.username || 
                currentTicket.job_title || currentTicket.manager || currentTicket.company_name ||
                currentTicket.department || currentTicket.start_date) && (
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 p-5 rounded-lg border border-blue-300 dark:border-blue-700 shadow-sm">
                  <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-4 flex items-center gap-2">
                    <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    👤 {t('tickets.employee_onboarding_info')}
                  </h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Personal Information */}
                    {(currentTicket.first_name || currentTicket.last_name) && (
                      <div className="space-y-3">
                        <h5 className="font-medium text-blue-800 dark:text-blue-200 border-b border-blue-200 dark:border-blue-700 pb-1">
                          {t('tickets.personal_information')}
                        </h5>
                        {currentTicket.first_name && (
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                            <span className="text-sm font-medium text-blue-700 dark:text-blue-300">{t('tickets.first_name')}:</span>
                            <span className="text-sm text-blue-800 dark:text-blue-200">{currentTicket.first_name}</span>
                          </div>
                        )}
                        {currentTicket.last_name && (
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                            <span className="text-sm font-medium text-blue-700 dark:text-blue-300">{t('tickets.last_name')}:</span>
                            <span className="text-sm text-blue-800 dark:text-blue-200">{currentTicket.last_name}</span>
                          </div>
                        )}
                        {currentTicket.display_name && (
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                            <span className="text-sm font-medium text-blue-700 dark:text-blue-300">{t('tickets.display_name')}:</span>
                            <span className="text-sm text-blue-800 dark:text-blue-200">{currentTicket.display_name}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Account Information */}
                    {(currentTicket.username || currentTicket.license_type || currentTicket.mfa_setup) && (
                      <div className="space-y-3">
                        <h5 className="font-medium text-blue-800 dark:text-blue-200 border-b border-blue-200 dark:border-blue-700 pb-1">
                          {t('tickets.account_information')}
                        </h5>
                        {currentTicket.username && (
                          <div className="flex items-center gap-2">
                            <Mail className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                            <span className="text-sm font-medium text-blue-700 dark:text-blue-300">{t('tickets.username')}:</span>
                            <span className="text-sm text-blue-800 dark:text-blue-200 font-mono bg-blue-100 dark:bg-blue-900/50 px-2 py-1 rounded">
                              {currentTicket.username}
                            </span>
                          </div>
                        )}
                        {currentTicket.license_type && (
                          <div className="flex items-center gap-2">
                            <Shield className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                            <span className="text-sm font-medium text-blue-700 dark:text-blue-300">{t('tickets.license_type')}:</span>
                            <span className="text-sm text-blue-800 dark:text-blue-200">{currentTicket.license_type}</span>
                          </div>
                        )}
                        {currentTicket.mfa_setup && (
                          <div className="flex items-center gap-2">
                            <Shield className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                            <span className="text-sm font-medium text-blue-700 dark:text-blue-300">{t('tickets.mfa_setup')}:</span>
                            <span className="text-sm text-blue-800 dark:text-blue-200">{currentTicket.mfa_setup}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Job Information */}
                    {(currentTicket.job_title || currentTicket.manager || currentTicket.start_date) && (
                      <div className="space-y-3">
                        <h5 className="font-medium text-blue-800 dark:text-blue-200 border-b border-blue-200 dark:border-blue-700 pb-1">
                          {t('tickets.job_information')}
                        </h5>
                        {currentTicket.job_title && (
                          <div className="flex items-center gap-2">
                            <Briefcase className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                            <span className="text-sm font-medium text-blue-700 dark:text-blue-300">{t('tickets.job_title')}:</span>
                            <span className="text-sm text-blue-800 dark:text-blue-200">{currentTicket.job_title}</span>
                          </div>
                        )}
                        {currentTicket.manager && (
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                            <span className="text-sm font-medium text-blue-700 dark:text-blue-300">{t('tickets.manager')}:</span>
                            <span className="text-sm text-blue-800 dark:text-blue-200">{currentTicket.manager}</span>
                          </div>
                        )}
                        {currentTicket.start_date && (
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                            <span className="text-sm font-medium text-blue-700 dark:text-blue-300">{t('tickets.start_date')}:</span>
                            <span className="text-sm text-blue-800 dark:text-blue-200">
                              {new Date(currentTicket.start_date).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                              })}
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Company Information */}
                    {(currentTicket.company_name || currentTicket.department || currentTicket.office_location) && (
                      <div className="space-y-3">
                        <h5 className="font-medium text-blue-800 dark:text-blue-200 border-b border-blue-200 dark:border-blue-700 pb-1">
                          {t('tickets.company_information')}
                        </h5>
                        {currentTicket.company_name && (
                          <div className="flex items-center gap-2">
                            <Building className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                            <span className="text-sm font-medium text-blue-700 dark:text-blue-300">{t('tickets.company')}:</span>
                            <span className="text-sm text-blue-800 dark:text-blue-200">{currentTicket.company_name}</span>
                          </div>
                        )}
                        {currentTicket.department && (
                          <div className="flex items-center gap-2">
                            <Building className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                            <span className="text-sm font-medium text-blue-700 dark:text-blue-300">{t('tickets.department')}:</span>
                            <span className="text-sm text-blue-800 dark:text-blue-200">{currentTicket.department}</span>
                          </div>
                        )}
                        {currentTicket.office_location && (
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                            <span className="text-sm font-medium text-blue-700 dark:text-blue-300">{t('tickets.office_location')}:</span>
                            <span className="text-sm text-blue-800 dark:text-blue-200">{currentTicket.office_location}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Contact Information */}
                    {(currentTicket.business_phone || currentTicket.mobile_phone) && (
                      <div className="space-y-3">
                        <h5 className="font-medium text-blue-800 dark:text-blue-200 border-b border-blue-200 dark:border-blue-700 pb-1">
                          {t('tickets.contact_information')}
                        </h5>
                        {currentTicket.business_phone && (
                          <div className="flex items-center gap-2">
                            <Phone className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                            <span className="text-sm font-medium text-blue-700 dark:text-blue-300">{t('tickets.business_phone')}:</span>
                            <span className="text-sm text-blue-800 dark:text-blue-200 font-mono bg-blue-100 dark:bg-blue-900/50 px-2 py-1 rounded">
                              {currentTicket.business_phone}
                            </span>
                          </div>
                        )}
                        {currentTicket.mobile_phone && (
                          <div className="flex items-center gap-2">
                            <Phone className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                            <span className="text-sm font-medium text-blue-700 dark:text-blue-300">{t('tickets.mobile_phone')}:</span>
                            <span className="text-sm text-blue-800 dark:text-blue-200 font-mono bg-blue-100 dark:bg-blue-900/50 px-2 py-1 rounded">
                              {currentTicket.mobile_phone}
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Additional Information */}
                    {(currentTicket.signature_group || currentTicket.usage_location || currentTicket.country_distribution_list) && (
                      <div className="space-y-3 md:col-span-2">
                        <h5 className="font-medium text-blue-800 dark:text-blue-200 border-b border-blue-200 dark:border-blue-700 pb-1">
                          {t('tickets.additional_information')}
                        </h5>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          {currentTicket.signature_group && (
                            <div className="flex items-center gap-2">
                              <Mail className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                              <span className="text-sm font-medium text-blue-700 dark:text-blue-300">{t('tickets.signature_group')}:</span>
                              <span className="text-sm text-blue-800 dark:text-blue-200">{currentTicket.signature_group}</span>
                            </div>
                          )}
                          {currentTicket.usage_location && (
                            <div className="flex items-center gap-2">
                              <MapPin className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                              <span className="text-sm font-medium text-blue-700 dark:text-blue-300">{t('tickets.usage_location')}:</span>
                              <span className="text-sm text-blue-800 dark:text-blue-200">{currentTicket.usage_location}</span>
                            </div>
                          )}
                          {currentTicket.country_distribution_list && (
                            <div className="flex items-center gap-2">
                              <Mail className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                              <span className="text-sm font-medium text-blue-700 dark:text-blue-300">{t('tickets.distribution_list')}:</span>
                              <span className="text-sm text-blue-800 dark:text-blue-200">{currentTicket.country_distribution_list}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Attached Form */}
                    {currentTicket.attached_form && (
                      <div className="space-y-3 md:col-span-2">
                        <h5 className="font-medium text-blue-800 dark:text-blue-200 border-b border-blue-200 dark:border-blue-700 pb-1">
                          {t('tickets.attached_form')}
                        </h5>
                        <div className="bg-blue-100 dark:bg-blue-900/50 p-3 rounded-md">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                            <span className="text-sm text-blue-800 dark:text-blue-200">{currentTicket.attached_form}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-semibold mb-2 dark:text-gray-100">{t('tickets.created_by')}</h4>
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-gray-500" />
                    <span className="text-gray-700 dark:text-gray-300">
                      {currentTicket.user?.name || 'Unknown'}
                    </span>
                  </div>
                </div>

                {currentTicket.assignee && (
                  <div>
                    <h4 className="font-semibold mb-2 dark:text-gray-100">{t('tickets.assigned_to')}</h4>
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-gray-500" />
                      <span className="text-gray-700 dark:text-gray-300">
                        {currentTicket.assignee.name}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Attachments */}
              {currentTicket.attachments && currentTicket.attachments.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-2 flex items-center gap-2 dark:text-gray-100">
                    <Paperclip className="h-4 w-4" />
                    {t('tickets.attachments')} ({currentTicket.attachments.length})
                  </h4>
                  <div className="space-y-2">
                    {currentTicket.attachments.map((attachment) => (
                      <div key={attachment.id} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800/50 rounded border border-gray-200 dark:border-gray-700">
                        <div className="flex items-center gap-2">
                          {getFileIcon(attachment.mime_type || '')}
                          <span className="text-sm font-medium dark:text-gray-200">{attachment.file_name}</span>
                          {attachment.file_size && (
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              ({Math.round(attachment.file_size / 1024)} KB)
                            </span>
                          )}
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDownload(attachment)}
                          className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Resolution */}
              {(currentTicket.status === 'resolved' || currentTicket.status === 'closed') && currentTicket.resolution && (
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 p-5 rounded-lg border border-green-300 dark:border-green-700 shadow-sm">
                  <h4 className="font-semibold text-green-900 dark:text-green-100 mb-3 flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                    ✅ {t('tickets.resolution')}
                  </h4>
                  <p className="text-sm text-green-800 dark:text-green-200 font-medium bg-white/60 dark:bg-black/30 p-4 rounded-md border border-green-200 dark:border-green-600 leading-relaxed">
                    {currentTicket.resolution}
                  </p>
                  {currentTicket.resolved_at && (
                    <div className="flex items-center gap-2 mt-4 pt-3 border-t border-green-200 dark:border-green-700">
                      <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></div>
                      <p className="text-xs text-green-700 dark:text-green-300 font-medium">
                        {t('tickets.resolved_on')}: {formatDate(currentTicket.resolved_at)}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Feedback Section - Mostrar feedback se disponível */}
              {currentTicket.feedback && (
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 p-5 rounded-lg border border-blue-300 dark:border-blue-700 shadow-sm">
                  <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-3 flex items-center gap-2">
                    <Star className="h-5 w-5 text-yellow-500 fill-current" />
                    ⭐ {t('tickets.customer_feedback')}
                  </h4>
                  <TicketFeedback 
                    ticketId={currentTicket.id}
                    status={currentTicket.status}
                    agentName={currentTicket.assignee?.name}
                  />
                </div>
              )}
            </CardContent>
          </Card>

          <SLAMonitor 
            ticketId={currentTicket.id}
            priority={currentTicket.priority}
            createdAt={currentTicket.created_at || ''}
            status={currentTicket.status}
            userRole={userRole}
            resolvedAt={currentTicket.resolved_at || undefined}
            closedAt={currentTicket.closed_at || undefined}
            refreshKey={refreshKey}
          />

          <Tabs defaultValue="activity" className="dark:bg-gray-800 dark:border-gray-700 rounded-lg">
            <TabsList className={`grid w-full ${canViewInternalFeatures ? 'grid-cols-4' : 'grid-cols-3'} dark:bg-gray-800`}>
              <TabsTrigger value="activity" className="flex items-center gap-1 dark:data-[state=active]:bg-gray-700 dark:data-[state=active]:text-gray-100">
                <History className="h-4 w-4" />
                {t('tickets.activity_log')}
              </TabsTrigger>
              {canViewInternalFeatures && (
                <TabsTrigger value="comments" className="flex items-center gap-1 dark:data-[state=active]:bg-gray-700 dark:data-[state=active]:text-gray-100">
                  <MessageSquare className="h-4 w-4" />
                  {t('tickets.comments')}
                </TabsTrigger>
              )}
              {canViewInternalFeatures && (
                <TabsTrigger value="tasks" className="flex items-center gap-1 dark:data-[state=active]:bg-gray-700 dark:data-[state=active]:text-gray-100">
                  <Target className="h-4 w-4" />
                  {t('tickets.tasks')}
                </TabsTrigger>
              )}
              <TabsTrigger value="chat" className="flex items-center gap-1 dark:data-[state=active]:bg-gray-700 dark:data-[state=active]:text-gray-100">
                <MessageSquare className="h-4 w-4" />
                {t('chat.tab')}
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="activity" className="mt-4">
              <ActivityLog key={`activity-${refreshKey}`} ticketId={currentTicket.id} />
            </TabsContent>
            
            {canViewInternalFeatures && (
              <TabsContent value="comments" className="mt-4">
                <InternalComments 
                  key={`comments-${refreshKey}`} 
                  ticketId={currentTicket.id} 
                  userRole={userRole} 
                  onCommentAdded={triggerRefresh}
                />
              </TabsContent>
            )}

            {canViewInternalFeatures && (
              <TabsContent value="tasks" className="mt-4">
                <TaskManagement 
                  key={`tasks-${refreshKey}`} 
                  ticketId={currentTicket.id} 
                  canManageTasks={userRole === 'agent' || userRole === 'admin'}
                />
              </TabsContent>
            )}

            <TabsContent value="chat" className="mt-4">
              <ModernTicketChat 
                ticketId={currentTicket.id} 
                onMessageSent={triggerRefresh}
              />
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
      
      {/* Reopen Request Dialog */}
      <ReopenRequestDialog
        open={isReopenDialogOpen}
        onOpenChange={setIsReopenDialogOpen}
        ticket={currentTicket}
        onRequestSubmitted={refreshTicketData}
      />
      
      {/* Todo Task Modal */}
      <TodoTaskModal
        open={isTaskModalOpen}
        onOpenChange={setIsTaskModalOpen}
        ticket={currentTicket}
        userRole={userRole}
        onTaskCreated={() => {
          refreshTicketData();
          triggerRefresh();
          if (onTicketUpdate) {
            onTicketUpdate();
          }
        }}
      />

      {/* Transfer Dialog */}
      <TicketTransferDialog
        open={isTransferDialogOpen}
        onOpenChange={setIsTransferDialogOpen}
        ticket={currentTicket}
        onTransferred={async () => {
          await refreshTicketData();
          triggerRefresh();
        }}
      />
    </Dialog>
  );
}; 
