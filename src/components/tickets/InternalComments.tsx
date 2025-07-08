import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslation } from 'react-i18next';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { MessageSquare, Lock, Send, Eye, EyeOff, Globe } from "lucide-react";
import { DatabaseService, CommentWithUser } from "@/lib/database";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/components/ui/sonner";

interface InternalCommentsProps {
  ticketId: string;
  userRole: "user" | "agent" | "admin";
  assignedUserId?: string | null;
  onCommentAdded?: () => void; // Add callback for comment events
}

// Extended comment interface to include is_internal flag
interface ExtendedComment extends CommentWithUser {
  is_internal?: boolean;
}

export const InternalComments = ({ ticketId, userRole, assignedUserId, onCommentAdded }: InternalCommentsProps) => {
  const { t } = useTranslation();
  const [comments, setComments] = useState<ExtendedComment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [isInternal, setIsInternal] = useState(false); // Default to public for better UX
  const [showOnlyInternal, setShowOnlyInternal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const { userProfile } = useAuth();

  const canSeeInternalComments = userRole === "agent" || userRole === "admin";

  // Business rule:
  // • Users can always comment (public)
  // • Agents can comment only if ticket is assigned to them
  // • Admins can comment always

  const isAssignedAgent = userRole === 'agent' && userProfile?.id === assignedUserId;

  const canAddComments =
    userRole === 'user' ||                        // ticket requester
    userRole === 'admin' ||                       // admins unrestricted
    isAssignedAgent;                              // assigned agent only

  // Load comments
  useEffect(() => {
    loadComments();
  }, [ticketId]);

  const loadComments = async () => {
    try {
      setLoading(true);
      const commentsData = await DatabaseService.getTicketComments(ticketId);
      
      console.log('📝 Comments loaded:', commentsData.length, 'comments');
      console.log('📝 Comments data:', commentsData);
      
      // Comments now come with is_internal field from database
      setComments(commentsData);
    } catch (error) {
      console.error('Error loading comments:', error);
      toast.error("Erro ao carregar comentários", {
        description: "Não foi possível carregar os comentários. Por favor, tente novamente."
      });
    } finally {
      setLoading(false);
    }
  };

  const addComment = async () => {
    if (!newComment.trim() || !userProfile) return;

    // Verificar se o ticket está fechado
    if (ticketId) {
      try {
        const canAdd = await DatabaseService.canAddComment(ticketId, userProfile.id);
        if (!canAdd) {
          toast.error("Não é possível adicionar comentários", {
            description: "O ticket está fechado e não pode receber novos comentários."
          });
          return;
        }
      } catch (error) {
        console.error('Error checking comment permissions:', error);
        toast.error("Erro ao verificar permissões", {
          description: "Não foi possível verificar as permissões para adicionar comentários."
        });
        return;
      }
    }

    try {
      setSubmitting(true);
      
      console.log('📝 Adding comment:', { ticketId, userId: userProfile.id, content: newComment, isInternal });
      
      // Add comment to database with is_internal flag
      const comment = await DatabaseService.addTicketComment(ticketId, userProfile.id, newComment, isInternal);
      
      console.log('📝 Comment added:', comment);
      
      // Add to local state immediately for instant feedback
      setComments(prev => [comment, ...prev]);
      
      setNewComment("");
      setIsInternal(false); // Reset to public after sending
      
      // Reload comments to get fresh data from server
      setTimeout(() => {
        loadComments();
      }, 500);
      
      toast.success("Comentário adicionado", {
        description: "O comentário foi adicionado com sucesso."
      });
      
      // Trigger callback to refresh SLA and other components
      if (onCommentAdded) {
        onCommentAdded();
      }
    } catch (error) {
      console.error('Error adding comment:', error);
      toast.error("Erro ao adicionar comentário", {
        description: "Não foi possível adicionar o comentário. Por favor, tente novamente."
      });
      // Remove the optimistically added comment on error
      loadComments();
    } finally {
      setSubmitting(false);
    }
  };

  const filteredComments = comments.filter(comment => {
    // Se estamos mostrando apenas internos, mostrar apenas comentários internos
    if (showOnlyInternal) {
      return comment.is_internal && canSeeInternalComments;
    }
    
    // Para agentes/admins: mostrar todos os comentários
    // Para usuários: mostrar apenas comentários públicos (não internos)
    if (canSeeInternalComments) {
      return true; // Mostrar todos os comentários
    } else {
      return !comment.is_internal; // Apenas comentários públicos para usuários
    }
  });

  console.log('📝 Filtered comments:', filteredComments.length, 'of', comments.length, 'total comments');
  console.log('📝 Show only internal:', showOnlyInternal, 'Can see internal:', canSeeInternalComments);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  return (
    <div className="space-y-4">
      {/* Add new comment */}
      {canAddComments && (
        <div className="space-y-4 p-4 bg-gray-50/50 dark:bg-gray-800/30 rounded-lg border border-gray-200/50 dark:border-gray-700/50">
          <Textarea
                            placeholder={t('comments.addPlaceholder')}
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            className="min-h-20 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 resize-none"
            disabled={submitting}
          />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {canSeeInternalComments && (
                <div className="flex items-center gap-1 bg-white dark:bg-gray-900 rounded-lg p-1 border border-gray-200 dark:border-gray-700">
                  <Button
                    variant={!isInternal ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setIsInternal(false)}
                    className={`h-8 px-3 text-xs ${!isInternal ? 'bg-blue-600 text-white' : 'text-gray-600 dark:text-gray-400'}`}
                  >
                    <Globe className="h-3 w-3 mr-1" />
                    Público
                  </Button>
                  <Button
                    variant={isInternal ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setIsInternal(true)}
                    className={`h-8 px-3 text-xs ${isInternal ? 'bg-amber-600 text-white' : 'text-gray-600 dark:text-gray-400'}`}
                  >
                    <Lock className="h-3 w-3 mr-1" />
                    Interno
                  </Button>
                </div>
              )}
              {!canSeeInternalComments && (
                <Badge variant="outline" className="flex items-center gap-1 text-xs">
                  <Globe className="h-3 w-3" />
                  Comentário Público
                </Badge>
              )}
            </div>
            <Button 
              onClick={addComment} 
              disabled={!newComment.trim() || submitting}
              size="sm"
              className="h-8 px-4"
            >
              <Send className="h-3 w-3 mr-1" />
              {submitting ? "Enviando..." : "Enviar"}
            </Button>
          </div>
        </div>
      )}

      {/* Filter toggle for internal comments */}
      {canSeeInternalComments && (
        <div className="flex items-center justify-between py-2">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {filteredComments.length} de {comments.length} comentários
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowOnlyInternal(!showOnlyInternal)}
            className="h-8 px-3 text-xs"
          >
            {showOnlyInternal ? <Eye className="h-3 w-3 mr-1" /> : <EyeOff className="h-3 w-3 mr-1" />}
            {showOnlyInternal ? "Todos" : "Apenas Internos"}
          </Button>
        </div>
      )}

      {/* Comments list */}
      <div className="space-y-4">
        {loading ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <div className="animate-pulse flex items-center justify-center gap-2">
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
            </div>
            <p className="mt-2">Carregando comentários...</p>
          </div>
        ) : filteredComments.length === 0 ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            <div className="p-4 rounded-full bg-gray-100 dark:bg-gray-800 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
              <MessageSquare className="h-8 w-8 text-gray-400 dark:text-gray-600" />
            </div>
            <p className="text-lg font-medium mb-1">Nenhum comentário encontrado</p>
            {showOnlyInternal && <p className="text-sm">Nenhuma nota interna disponível</p>}
            {!showOnlyInternal && <p className="text-sm">Seja o primeiro a comentar neste ticket</p>}
          </div>
        ) : (
          filteredComments.map((comment) => (
            <div key={comment.id} className="group">
              <div className="flex gap-3">
                <Avatar className="h-9 w-9 border-2 border-white dark:border-gray-800 shadow-sm">
                  <AvatarFallback className="text-xs font-medium bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-900 dark:to-blue-800 text-blue-700 dark:text-blue-300">
                    {getInitials(comment.user?.name || comment.user?.email || 'U')}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm text-gray-900 dark:text-gray-100">
                      {comment.user?.name || comment.user?.email || 'Usuário'}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {formatDate(comment.created_at)}
                    </span>
                    {comment.is_internal && canSeeInternalComments && (
                      <Badge variant="secondary" className="text-xs h-5 px-2 bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 dark:border-amber-800">
                        <Lock className="h-2.5 w-2.5 mr-1" />
                        Interno
                      </Badge>
                    )}
                    {!comment.is_internal && (
                      <Badge variant="outline" className="text-xs h-5 px-2 bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300 border-blue-200 dark:border-blue-800">
                        <Globe className="h-2.5 w-2.5 mr-1" />
                        Público
                      </Badge>
                    )}
                  </div>
                  <div className={`text-sm p-4 rounded-lg border transition-all duration-200 ${
                    comment.is_internal 
                      ? 'bg-gradient-to-br from-amber-50 to-amber-100/50 dark:from-amber-950/20 dark:to-amber-900/10 border-amber-200 dark:border-amber-800/50 text-amber-900 dark:text-amber-100' 
                      : 'bg-gradient-to-br from-white to-gray-50/50 dark:from-gray-800/50 dark:to-gray-700/30 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300'
                  } group-hover:shadow-sm`}>
                    <div className="whitespace-pre-wrap leading-relaxed">
                      {comment.content}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
