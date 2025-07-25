import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Star, 
  ThumbsUp, 
  ThumbsDown, 
  MessageSquare,
  CheckCircle,
  Calendar,
  User,
  X
} from "lucide-react";
import { DatabaseService, TicketFeedback, TicketWithDetails } from "@/lib/database";
import { useToast } from "@/hooks/use-toast";

interface FeedbackViewDialogProps {
  ticket: TicketWithDetails | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const FeedbackViewDialog = ({ 
  ticket, 
  open, 
  onOpenChange 
}: FeedbackViewDialogProps) => {
  const [feedback, setFeedback] = useState<TicketFeedback | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const loadFeedback = async () => {
      if (!ticket || !open) return;
      
      setLoading(true);
      try {
        const feedbackData = await DatabaseService.getTicketFeedback(ticket.id);
        setFeedback(feedbackData);
      } catch (error) {
        console.error('Error loading feedback:', error);
        toast({
          title: "Erro",
          description: "Não foi possível carregar o feedback.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    loadFeedback();
  }, [ticket, open, toast]);

  if (!ticket) return null;

  const getSatisfactionIcon = (satisfaction: string) => {
    switch (satisfaction) {
      case "satisfied": return <ThumbsUp className="h-5 w-5 text-green-600" />;
      case "neutral": return <MessageSquare className="h-5 w-5 text-yellow-600" />;
      case "unsatisfied": return <ThumbsDown className="h-5 w-5 text-red-600" />;
      default: return null;
    }
  };

  const getSatisfactionLabel = (satisfaction: string) => {
    switch (satisfaction) {
      case "satisfied": return "Satisfeito";
      case "neutral": return "Neutro";
      case "unsatisfied": return "Insatisfeito";
      default: return satisfaction;
    }
  };

  const getSatisfactionColor = (satisfaction: string) => {
    switch (satisfaction) {
      case "satisfied": return "text-green-700 bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800";
      case "neutral": return "text-yellow-700 bg-yellow-50 border-yellow-200 dark:bg-yellow-950/30 dark:border-yellow-800";
      case "unsatisfied": return "text-red-700 bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800";
      default: return "text-gray-700 bg-gray-50 border-gray-200 dark:bg-gray-950/30 dark:border-gray-800";
    }
  };

  const getRatingLabel = (rating: number) => {
    switch (rating) {
      case 1: return "Muito ruim";
      case 2: return "Ruim";
      case 3: return "Regular";
      case 4: return "Bom";
      case 5: return "Excelente";
      default: return "";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader className="pb-4 border-b border-gray-200 dark:border-gray-700">
          <DialogTitle className="flex items-center gap-3 text-xl font-bold">
            <div className="h-10 w-10 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-full flex items-center justify-center">
              <Star className="h-6 w-6 text-white fill-current" />
            </div>
            <span className="bg-gradient-to-r from-blue-700 to-cyan-700 dark:from-blue-400 dark:to-cyan-400 bg-clip-text text-transparent">
              Feedback do Atendimento
            </span>
          </DialogTitle>
          <DialogDescription>
            Visualize a avaliação e comentários deixados pelo usuário sobre o atendimento recebido.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 pt-2">
          {/* Ticket Info */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                Informações do Ticket
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Número:</span>
                <Badge variant="outline">{ticket.ticket_number}</Badge>
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
              {ticket.closed_at && (
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-gray-500" />
                  <span className="text-sm">Fechado em: {new Date(ticket.closed_at).toLocaleDateString('pt-BR')}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Feedback Content */}
          {loading ? (
            <Card>
              <CardContent className="flex items-center justify-center py-12">
                <div className="text-center">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-current border-t-transparent mx-auto mb-2"></div>
                  <p className="text-sm text-gray-500">Carregando feedback...</p>
                </div>
              </CardContent>
            </Card>
          ) : feedback ? (
            <Card className={`border-2 ${getSatisfactionColor(feedback.satisfaction)}`}>
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Star className="h-5 w-5 text-yellow-500 fill-current" />
                    Avaliação do Usuário
                  </CardTitle>
                  <Badge variant="outline" className="text-xs">
                    {new Date(feedback.created_at).toLocaleDateString('pt-BR')} às {new Date(feedback.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Rating Display */}
                <div>
                  <label className="block text-sm font-semibold mb-3 text-gray-900 dark:text-gray-100">
                    ⭐ Avaliação Geral:
                  </label>
                  <div className="flex items-center gap-3">
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className={`h-7 w-7 ${
                            star <= feedback.rating
                              ? "text-yellow-400 fill-current"
                              : "text-gray-300"
                          }`}
                        />
                      ))}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-lg font-bold text-gray-900 dark:text-gray-100">
                        {feedback.rating}/5
                      </span>
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {getRatingLabel(feedback.rating)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Satisfaction Display */}
                <div>
                  <label className="block text-sm font-semibold mb-3 text-gray-900 dark:text-gray-100">
                    😊 Nível de Satisfação:
                  </label>
                  <div className={`flex items-center gap-3 p-3 rounded-lg ${getSatisfactionColor(feedback.satisfaction)}`}>
                    {getSatisfactionIcon(feedback.satisfaction)}
                    <span className="font-semibold text-base">
                      {getSatisfactionLabel(feedback.satisfaction)}
                    </span>
                  </div>
                </div>

                {/* Categories Display */}
                {feedback.categories && feedback.categories.length > 0 && (
                  <div>
                    <label className="block text-sm font-semibold mb-3 text-gray-900 dark:text-gray-100">
                      ✨ Aspectos Positivos Destacados:
                    </label>
                    <div className="flex gap-2 flex-wrap">
                      {feedback.categories.map((category) => (
                        <Badge key={category} variant="default" className="bg-blue-100 text-blue-800 border-blue-300 hover:bg-blue-200">
                          {category}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Comment Display */}
                {feedback.comment && (
                  <div>
                    <label className="block text-sm font-semibold mb-3 text-gray-900 dark:text-gray-100">
                      💬 Comentário Adicional:
                    </label>
                    <div className="bg-gradient-to-r from-gray-50 to-blue-50 dark:from-gray-800/50 dark:to-blue-900/20 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                      <p className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed italic">
                        "{feedback.comment}"
                      </p>
                    </div>
                  </div>
                )}

                {/* Agent Recognition */}
                {feedback.agent_name && (
                  <div className="bg-green-50 dark:bg-green-950/30 p-3 rounded-lg border border-green-200 dark:border-green-800">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-green-600" />
                      <span className="text-sm text-green-800 dark:text-green-200">
                        Feedback para o agente: <span className="font-semibold">{feedback.agent_name}</span>
                      </span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card className="border-dashed border-gray-300">
              <CardContent className="text-center py-12">
                <MessageSquare className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  Nenhum feedback encontrado
                </h3>
                <p className="text-gray-500 dark:text-gray-400">
                  Este ticket ainda não recebeu avaliação do usuário.
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Close Button */}
        <div className="flex justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            <X className="h-4 w-4 mr-2" />
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}; 