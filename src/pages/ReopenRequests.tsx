import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { 
  RotateCcw, 
  CheckCircle, 
  XCircle, 
  Clock, 
  User, 
  Calendar, 
  AlertCircle,
  Loader2,
  MessageSquare
} from "lucide-react";
import DatabaseService from '@/lib/database';
import { ReopenService } from "@/lib/reopen-service";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useTranslation } from "react-i18next";
import { useReopenRequests } from '@/hooks/useReopenRequests';
import { useLoadingTimeout } from '@/hooks/useLoadingTimeout';

interface ReopenRequest {
  id: string;
  ticket_id: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  reviewed_at?: string;
  ticket?: {
    id: string;
    title: string;
    status: string;
  };
  requested_by_user?: {
    id: string;
    full_name: string;
    email: string;
  };
  reviewed_by_user?: {
    id: string;
    full_name: string;
    email: string;
  };
}

// Move formatDate outside the component since it's a pure function
const formatDate = (dateString: string, language: string) => {
  return new Date(dateString).toLocaleDateString(language, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

export const ReopenRequests = () => {
  // Use React Query for reopen requests data
  const {
    requests,
    isLoading: loading,
    isError,
    error: queryError,
    refetch,
    handleStuckLoading
  } = useReopenRequests();

  // Setup loading timeout protection
  useLoadingTimeout(loading, 30000); // 30 second timeout

  const [selectedRequest, setSelectedRequest] = useState<ReopenRequest | null>(null);
  const [isReviewDialogOpen, setIsReviewDialogOpen] = useState(false);
  const [reviewAction, setReviewAction] = useState<'approve' | 'reject' | null>(null);
  const [reviewComment, setReviewComment] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const { userProfile } = useAuth();
  const { toast } = useToast();
  const { t, i18n } = useTranslation();

  // Show error toast for React Query errors
  useEffect(() => {
    if (isError && queryError) {
      console.error('❌ Reopen requests loading error:', queryError);
      toast({
        title: t('common.error'),
        description: t('reopen.loadError'),
        variant: "destructive",
      });
    }
  }, [isError, queryError, toast, t]);

  const handleReviewRequest = (request: ReopenRequest, action: 'approve' | 'reject') => {
    setSelectedRequest(request);
    setReviewAction(action);
    setReviewComment("");
    setIsReviewDialogOpen(true);
  };

  const submitReview = async () => {
    if (!selectedRequest || !reviewAction || !userProfile?.id) return;

    try {
      setIsProcessing(true);

      // Convert action to proper status
      const status = reviewAction === 'approve' ? 'approved' : 'rejected';

      // Review the request
      await ReopenService.reviewReopenRequest(
        selectedRequest.id,
        status,
        userProfile.id
      );

      // If approved, reopen the ticket
      if (status === 'approved') {
        await ReopenService.reopenTicket(selectedRequest.ticket_id);
        
        // Add comment to ticket explaining the reopening
        await ReopenService.createComment(
          selectedRequest.ticket_id,
          userProfile.id,
          t('reopen.approvedComment', { 
            reason: selectedRequest.reason,
            comment: reviewComment ? `\n\n${t('reopen.reviewerComment')}: ${reviewComment}` : '' 
          })
        );

        // Notify the requester
        await ReopenService.createNotification(
          selectedRequest.requested_by_user?.id || '',
          t('reopen.approvedToastTitle'),
          t('reopen.approvedToastDesc'),
          'status_changed'
        );
      } else {
        // Notify the requester about rejection
        await ReopenService.createNotification(
          selectedRequest.requested_by_user?.id || '',
          t('reopen.rejectedToastTitle'),
          t('reopen.rejectedToastDesc'),
          'status_changed'
        );
      }

      toast({
        title: status === 'approved' ? t('reopen.approvedToastTitle') : t('reopen.rejectedToastTitle'),
        description: status === 'approved' ? t('reopen.approvedToastDesc') : t('reopen.rejectedToastDesc'),
      });

      setIsReviewDialogOpen(false);
      setSelectedRequest(null);
      setReviewAction(null);
      setReviewComment("");
      refetch();

    } catch (err) {
      console.error('Error reviewing request:', err);
      toast({
        title: t('common.error'),
        description: t('reopen.processError'),
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending": return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "approved": return "bg-green-100 text-green-800 border-green-200";
      case "rejected": return "bg-red-100 text-red-800 border-red-200";
      default: return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending": return <Clock className="h-4 w-4" />;
      case "approved": return <CheckCircle className="h-4 w-4" />;
      case "rejected": return <XCircle className="h-4 w-4" />;
      default: return <AlertCircle className="h-4 w-4" />;
    }
  };

  const formatStatus = (status: string) => {
    return t(`reopen.status.${status}`);
  };

  // Check if user has permission to view this page
  if (userProfile?.role !== 'admin' && userProfile?.role !== 'agent') {
    return (
      <div className="container mx-auto px-4 py-8">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {t('reopen.noPermission')}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <div className="space-y-4">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-semibold">{t('reopen.pageTitle')}</h1>
          </div>
          {Array.from({ length: 3 }).map((_, index) => (
            <Card key={index} className="animate-pulse">
              <CardContent className="p-6">
                <div className="space-y-3">
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                  <div className="flex gap-2">
                    <div className="h-6 bg-gray-200 rounded w-16"></div>
                    <div className="h-6 bg-gray-200 rounded w-20"></div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (isError && queryError) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {queryError instanceof Error ? queryError.message : String(queryError)}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const pendingRequests = requests.filter(req => req.status === 'pending');
  const reviewedRequests = requests.filter(req => req.status !== 'pending');

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      {/* Page Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">{t('reopen.pageTitle')}</h1>
        <Button
          variant="outline"
          size="sm"
          onClick={refetch}
          disabled={loading}
          className="flex items-center gap-2"
        >
          <RotateCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          {loading ? t('common.loading', 'Loading...') : t('common.refresh')}
        </Button>
      </div>

      {/* Pending Requests Section */}
      <div className="space-y-6 mb-8">
        <h2 className="text-lg font-medium flex items-center gap-2">
          <Clock className="h-5 w-5 text-yellow-600" />
          {t('reopen.pendingRequests')}
          {pendingRequests.length > 0 && (
            <Badge variant="secondary" className="ml-2">
              {pendingRequests.length}
            </Badge>
          )}
        </h2>
        
        {pendingRequests.length === 0 ? (
          <Card>
            <CardContent className="p-6">
              <div className="text-center text-muted-foreground">
                {t('reopen.noPendingRequests')}
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {pendingRequests.map((request) => (
              <Card key={request.id} className="overflow-hidden">
                <CardContent className="p-6">
                  <div className="flex flex-col space-y-4">
                    {/* Request Header */}
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <h3 className="font-medium">
                          {request.ticket?.title}
                        </h3>
                        <div className="text-sm text-muted-foreground">
                          {t('reopen.requestedBy')}: {request.requested_by_user?.full_name}
                        </div>
                      </div>
                      <Badge className={getStatusColor(request.status)}>
                        <span className="flex items-center gap-1">
                          {getStatusIcon(request.status)}
                          {formatStatus(request.status)}
                        </span>
                      </Badge>
                    </div>

                    {/* Request Details */}
                    <div className="bg-muted/50 rounded-lg p-4">
                      <Label className="mb-2 block">{t('reopen.reason')}:</Label>
                      <div className="text-sm">{request.reason}</div>
                    </div>

                    {/* Request Metadata */}
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          {formatDate(request.created_at, i18n.language)}
                        </div>
                        <div className="flex items-center gap-1">
                          <MessageSquare className="h-4 w-4" />
                          #{request.ticket_id}
                        </div>
                      </div>
                      
                      {/* Action Buttons */}
                      <div className="flex gap-2">
                                                  <Button
                            size="sm"
                            variant="default"
                            onClick={() => handleReviewRequest(request, 'approve')}
                            className="bg-green-600 hover:bg-green-700 text-white"
                          >
                            {t('reopen.approve')}
                          </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleReviewRequest(request, 'reject')}
                        >
                          {t('reopen.reject')}
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Reviewed Requests Section */}
      <div className="space-y-6">
        <h2 className="text-lg font-medium flex items-center gap-2">
          <CheckCircle className="h-5 w-5 text-green-600" />
          {t('reopen.reviewedRequests')}
          {reviewedRequests.length > 0 && (
            <Badge variant="secondary" className="ml-2">
              {reviewedRequests.length}
            </Badge>
          )}
        </h2>

        {reviewedRequests.length === 0 ? (
          <Card>
            <CardContent className="p-6">
              <div className="text-center text-muted-foreground">
                {t('reopen.noReviewedRequests')}
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {reviewedRequests.map((request) => (
              <Card key={request.id} className="overflow-hidden">
                <CardContent className="p-6">
                  <div className="flex flex-col space-y-4">
                    {/* Request Header */}
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <h3 className="font-medium">
                          {request.ticket?.title}
                        </h3>
                        <div className="text-sm text-muted-foreground">
                          {t('reopen.requestedBy')}: {request.requested_by_user?.full_name}
                        </div>
                      </div>
                      <Badge className={getStatusColor(request.status)}>
                        <span className="flex items-center gap-1">
                          {getStatusIcon(request.status)}
                          {formatStatus(request.status)}
                        </span>
                      </Badge>
                    </div>

                    {/* Request Details */}
                    <div className="bg-muted/50 rounded-lg p-4">
                      <Label className="mb-2 block">{t('reopen.reason')}:</Label>
                      <div className="text-sm">{request.reason}</div>
                    </div>

                    {/* Review Details */}
                    {request.reviewed_by_user && (
                      <div className="text-sm text-muted-foreground">
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-1">
                            <User className="h-4 w-4" />
                            {t('reopen.reviewedBy')}: {request.reviewed_by_user.full_name}
                          </div>
                          <div className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            {formatDate(request.reviewed_at || '', i18n.language)}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Review Dialog */}
      <Dialog open={isReviewDialogOpen} onOpenChange={setIsReviewDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {reviewAction === 'approve' 
                ? t('reopen.approveRequest') 
                : t('reopen.rejectRequest')}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{t('reopen.comment')}</Label>
              <Textarea
                placeholder={t('reopen.commentPlaceholder')}
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                className="min-h-[100px]"
              />
            </div>
          </div>

          <DialogFooter className="flex space-x-2 justify-end">
            <Button
              variant="outline"
              onClick={() => setIsReviewDialogOpen(false)}
              disabled={isProcessing}
            >
              {t('common.cancel')}
            </Button>
            <Button
              onClick={submitReview}
              disabled={isProcessing}
              variant={reviewAction === 'approve' ? 'default' : 'destructive'}
              className={reviewAction === 'approve' ? 'bg-green-600 hover:bg-green-700 text-white' : ''}
            >
              {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {reviewAction === 'approve' ? t('reopen.approve') : t('reopen.reject')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}; 
 
 
 
 