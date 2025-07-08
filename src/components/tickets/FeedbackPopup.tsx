import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Star, 
  ThumbsUp, 
  ThumbsDown, 
  MessageSquare,
  Send,
  CheckCircle,
  Calendar,
  User,
  X,
  AlertCircle
} from "lucide-react";
import { DatabaseService, TicketWithDetails } from "@/lib/database";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from 'react-i18next';

interface FeedbackPopupProps {
  ticketId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onFeedbackSubmitted?: () => void;
}

interface FeedbackData {
  rating: number;
  satisfaction: "satisfied" | "neutral" | "unsatisfied" | null;
  comment: string;
  categories: string[];
}

export const FeedbackPopup = ({ 
  ticketId, 
  open, 
  onOpenChange,
  onFeedbackSubmitted 
}: FeedbackPopupProps) => {
  console.log('🎭 FeedbackPopup render:', { ticketId, open });
  const [ticket, setTicket] = useState<TicketWithDetails | null>(null);
  const [feedback, setFeedback] = useState<FeedbackData>({
    rating: 0,
    satisfaction: null,
    comment: "",
    categories: []
  });
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [hoveredRating, setHoveredRating] = useState(0);
  
  const { userProfile } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();

  const satisfactionOptions = [
    { value: "satisfied", label: "Satisfeito", icon: ThumbsUp, color: "text-green-600" },
    { value: "neutral", label: "Neutro", icon: MessageSquare, color: "text-yellow-600" },
    { value: "unsatisfied", label: "Insatisfeito", icon: ThumbsDown, color: "text-red-600" }
  ];

  const feedbackCategories = [
    "Rapidez no atendimento",
    "Qualidade da solução", 
    "Comunicação clara",
    "Conhecimento técnico",
    "Cortesia do agente",
    "Facilidade do processo"
  ];

  useEffect(() => {
    const loadTicket = async () => {
      console.log('🎭 FeedbackPopup loadTicket:', { ticketId, open });
      if (!ticketId || !open) return;
      
      setLoading(true);
      try {
        console.log('🎭 Loading ticket data for:', ticketId);
        const ticketData = await DatabaseService.getTicketById(ticketId);
        console.log('🎭 Ticket data loaded:', ticketData);
        setTicket(ticketData);
      } catch (error) {
        console.error('🎭 Error loading ticket:', error);
        toast({
          title: "Erro",
          description: "Não foi possível carregar os detalhes do ticket.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    loadTicket();
  }, [ticketId, open, toast]);

  const handleRatingClick = (rating: number) => {
    setFeedback(prev => ({ ...prev, rating }));
  };

  const handleSatisfactionClick = (satisfaction: "satisfied" | "neutral" | "unsatisfied") => {
    setFeedback(prev => ({ ...prev, satisfaction }));
  };

  const handleCategoryToggle = (category: string) => {
    setFeedback(prev => ({
      ...prev,
      categories: prev.categories.includes(category)
        ? prev.categories.filter(c => c !== category)
        : [...prev.categories, category]
    }));
  };

  const handleSubmit = async () => {
    if (!userProfile || !ticket || feedback.rating === 0 || !feedback.satisfaction) return;

    setSubmitting(true);
    try {
      await DatabaseService.submitTicketFeedback({
        ticketId: ticket.id,
        userId: userProfile.id,
        rating: feedback.rating,
        satisfaction: feedback.satisfaction,
        comment: feedback.comment.trim() || undefined,
        categories: feedback.categories.length > 0 ? feedback.categories : undefined,
        agentName: ticket.assignee?.name
      });

      toast({
        title: "Feedback Enviado",
        description: "Obrigado por avaliar nosso atendimento!",
      });

      onOpenChange(false);
      if (onFeedbackSubmitted) {
        onFeedbackSubmitted();
      }
    } catch (error) {
      console.error('Error submitting feedback:', error);
      toast({
        title: "Erro",
        description: "Não foi possível enviar o feedback. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = feedback.rating > 0 && feedback.satisfaction !== null;

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "urgent": return "bg-red-100 text-red-800 border-red-200";
      case "high": return "bg-orange-100 text-orange-800 border-orange-200";
      case "medium": return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "low": return "bg-green-100 text-green-800 border-green-200";
      default: return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const formatPriority = (priority: string) => {
    const labels = {
      urgent: "🔴 Urgente",
      high: "🟠 Alta", 
      medium: "🟡 Média",
      low: "🟢 Baixa"
    };
    return labels[priority] || priority;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pb-4 border-b border-gray-200 dark:border-gray-700">
          <DialogTitle className="flex items-center gap-3 text-xl font-bold">
            <div className="h-10 w-10 bg-gradient-to-br from-yellow-500 to-orange-600 rounded-full flex items-center justify-center">
              <Star className="h-6 w-6 text-white fill-current" />
            </div>
            <span className="bg-gradient-to-r from-yellow-700 to-orange-700 dark:from-yellow-400 dark:to-orange-400 bg-clip-text text-transparent">
              Avalie seu Atendimento
            </span>
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-current border-t-transparent mx-auto mb-2"></div>
              <p className="text-sm text-gray-500">Carregando detalhes do ticket...</p>
            </div>
          </div>
        ) : ticket ? (
          <div className="space-y-6 pt-2">
            {/* Ticket Summary */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  Resumo do Atendimento
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Número:</span>
                  <Badge variant="outline">{ticket.ticket_number}</Badge>
                  <Badge className={getPriorityColor(ticket.priority)}>
                    {formatPriority(ticket.priority)}
                  </Badge>
                </div>
                
                <div>
                  <span className="text-sm font-medium">Título:</span>
                  <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">{ticket.title}</p>
                </div>

                {ticket.assignee && (
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-gray-500" />
                    <span className="text-sm">Atendido por: <span className="font-medium">{ticket.assignee.name}</span></span>
                  </div>
                )}

                {ticket.resolution && (
                  <div className="bg-green-50 dark:bg-green-950/30 p-3 rounded-lg border border-green-200 dark:border-green-800">
                    <h4 className="text-sm font-semibold text-green-800 dark:text-green-200 mb-1">
                      ✅ Resolução:
                    </h4>
                    <p className="text-sm text-green-700 dark:text-green-300">{ticket.resolution}</p>
                  </div>
                )}

                {ticket.closed_at && (
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-gray-500" />
                    <span className="text-sm">Fechado em: {formatDate(ticket.closed_at)}</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Feedback Form */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Star className="h-5 w-5 text-yellow-500" />
                  Sua Avaliação
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Rating */}
                <div>
                  <label className="block text-sm font-semibold mb-3 text-gray-900 dark:text-gray-100">
                    ⭐ Como você avalia o atendimento? *
                  </label>
                  <div className="flex items-center gap-3">
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          onClick={() => handleRatingClick(star)}
                          onMouseEnter={() => setHoveredRating(star)}
                          onMouseLeave={() => setHoveredRating(0)}
                          className="transition-colors"
                        >
                          <Star
                            className={`h-8 w-8 ${
                              star <= (hoveredRating || feedback.rating)
                                ? "text-yellow-400 fill-current"
                                : "text-gray-300"
                            }`}
                          />
                        </button>
                      ))}
                    </div>
                    {feedback.rating > 0 && (
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {feedback.rating}/5
                        </span>
                        <span className="text-xs text-gray-500">
                          {feedback.rating === 1 && "Muito ruim"}
                          {feedback.rating === 2 && "Ruim"}
                          {feedback.rating === 3 && "Regular"}
                          {feedback.rating === 4 && "Bom"}
                          {feedback.rating === 5 && "Excelente"}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Satisfaction */}
                <div>
                  <label className="block text-sm font-semibold mb-3 text-gray-900 dark:text-gray-100">
                    😊 Você está satisfeito com a resolução? *
                  </label>
                  <div className="flex gap-3">
                    {satisfactionOptions.map((option) => {
                      const Icon = option.icon;
                      const isSelected = feedback.satisfaction === option.value;
                      
                      return (
                        <Button
                          key={option.value}
                          variant={isSelected ? "default" : "outline"}
                          size="sm"
                          onClick={() => handleSatisfactionClick(option.value as any)}
                          className={`flex items-center gap-2 ${isSelected ? "" : option.color}`}
                        >
                          <Icon className="h-4 w-4" />
                          {option.label}
                        </Button>
                      );
                    })}
                  </div>
                </div>

                {/* Categories */}
                <div>
                  <label className="block text-sm font-semibold mb-3 text-gray-900 dark:text-gray-100">
                    ✨ O que foi positivo no atendimento? (opcional)
                  </label>
                  <div className="flex gap-2 flex-wrap">
                    {feedbackCategories.map((category) => (
                      <Badge
                        key={category}
                        variant={feedback.categories.includes(category) ? "default" : "outline"}
                        className="cursor-pointer hover:bg-blue-100"
                        onClick={() => handleCategoryToggle(category)}
                      >
                        {category}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Comment */}
                <div>
                  <label className="block text-sm font-semibold mb-2 text-gray-900 dark:text-gray-100">
                    💬 Comentários adicionais (opcional)
                  </label>
                  <Textarea
                    value={feedback.comment}
                    onChange={(e) => setFeedback(prev => ({ ...prev, comment: e.target.value }))}
                    placeholder={t('feedback.experiencePlaceholder')}
                    className="min-h-20 border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                    disabled={submitting}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Sua opinião nos ajuda a melhorar nosso atendimento!
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <AlertCircle className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                Ticket não encontrado
              </h3>
              <p className="text-gray-500 dark:text-gray-400">
                Não foi possível carregar os detalhes do ticket.
              </p>
            </div>
          </div>
        )}

        <DialogFooter className="gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            <X className="h-4 w-4 mr-2" />
            Cancelar
          </Button>
          
          {ticket && (
            <Button
              onClick={handleSubmit}
              disabled={!canSubmit || submitting}
              className="bg-gradient-to-r from-yellow-500 to-orange-600 hover:from-yellow-600 hover:to-orange-700 text-white border-0"
            >
              {submitting ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent mr-2" />
                  Enviando...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Enviar Avaliação
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}; 