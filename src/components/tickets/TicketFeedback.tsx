
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { 
  Star, 
  ThumbsUp, 
  ThumbsDown, 
  MessageSquare,
  Send,
  CheckCircle,
  Eye
} from "lucide-react";
import { DatabaseService, TicketFeedback as DbTicketFeedback } from "@/lib/database";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface TicketFeedbackProps {
  ticketId: string;
  status: string;
  agentName?: string;
  onFeedbackSubmit?: (feedback: any) => void;
}

interface FeedbackData {
  rating: number;
  satisfaction: "satisfied" | "neutral" | "unsatisfied" | null;
  comment: string;
  categories: string[];
}

export const TicketFeedback = ({ 
  ticketId, 
  status, 
  agentName,
  onFeedbackSubmit 
}: TicketFeedbackProps) => {
  const [feedback, setFeedback] = useState<FeedbackData>({
    rating: 0,
    satisfaction: null,
    comment: "",
    categories: []
  });
  const [existingFeedback, setExistingFeedback] = useState<DbTicketFeedback | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [viewMode, setViewMode] = useState<"form" | "view">("form");
  
  const { userProfile } = useAuth();
  const { toast } = useToast();

  const isTicketClosed = status === "closed" || status === "resolved";

  // Load existing feedback
  useEffect(() => {
    const loadFeedback = async () => {
      if (!isTicketClosed) return;
      
      try {
        const feedback = await DatabaseService.getTicketFeedback(ticketId);
        if (feedback) {
          setExistingFeedback(feedback);
          setIsSubmitted(true);
          setViewMode("view");
        }
      } catch (error) {
        console.error('Error loading feedback:', error);
      }
    };

    loadFeedback();
  }, [ticketId, isTicketClosed]);

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
    if (!userProfile || !canSubmit) return;

    setIsLoading(true);
    try {
      const feedbackData = await DatabaseService.submitTicketFeedback({
        ticketId,
        userId: userProfile.id,
        rating: feedback.rating,
        satisfaction: feedback.satisfaction!,
        comment: feedback.comment.trim() || undefined,
        categories: feedback.categories.length > 0 ? feedback.categories : undefined,
        agentName: agentName
      });

      setExistingFeedback(feedbackData);
      setIsSubmitted(true);
      setViewMode("view");

      toast({
        title: "Feedback Enviado",
        description: "Obrigado por avaliar nosso atendimento!",
      });

      if (onFeedbackSubmit) {
        onFeedbackSubmit(feedbackData);
      }
    } catch (error) {
      console.error('Error submitting feedback:', error);
      toast({
        title: "Erro",
        description: "Não foi possível enviar o feedback. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const canSubmit = feedback.rating > 0 && feedback.satisfaction !== null;

  if (!isTicketClosed) {
    return (
      <Card className="border-dashed">
        <CardContent className="text-center py-8">
          <MessageSquare className="h-12 w-12 mx-auto mb-2 text-gray-300" />
          <p className="text-gray-500">
            A avaliação estará disponível quando o chamado for resolvido
          </p>
        </CardContent>
      </Card>
    );
  }

  if (isSubmitted && existingFeedback && viewMode === "view") {
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
        case "satisfied": return "text-green-700 bg-green-50 border-green-200";
        case "neutral": return "text-yellow-700 bg-yellow-50 border-yellow-200";
        case "unsatisfied": return "text-red-700 bg-red-50 border-red-200";
        default: return "text-gray-700 bg-gray-50 border-gray-200";
      }
    };

    return (
      <Card className={`border-2 ${getSatisfactionColor(existingFeedback.satisfaction)}`}>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              Feedback Recebido
            </CardTitle>
            <Badge variant="outline" className="text-xs">
              {new Date(existingFeedback.created_at).toLocaleDateString('pt-BR')}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Rating Display */}
          <div>
            <label className="block text-sm font-medium mb-2">Avaliação:</label>
            <div className="flex items-center gap-2">
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className={`h-6 w-6 ${
                      star <= existingFeedback.rating
                        ? "text-yellow-400 fill-current"
                        : "text-gray-300"
                    }`}
                  />
                ))}
              </div>
              <span className="text-sm font-medium text-gray-700">
                ({existingFeedback.rating}/5)
              </span>
            </div>
          </div>

          {/* Satisfaction Display */}
          <div>
            <label className="block text-sm font-medium mb-2">Satisfação:</label>
            <div className="flex items-center gap-2">
              {getSatisfactionIcon(existingFeedback.satisfaction)}
              <span className="font-medium">
                {getSatisfactionLabel(existingFeedback.satisfaction)}
              </span>
            </div>
          </div>

          {/* Categories Display */}
          {existingFeedback.categories && existingFeedback.categories.length > 0 && (
            <div>
              <label className="block text-sm font-medium mb-2">Aspectos positivos:</label>
              <div className="flex gap-2 flex-wrap">
                {existingFeedback.categories.map((category) => (
                  <Badge key={category} variant="secondary">
                    {category}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Comment Display */}
          {existingFeedback.comment && (
            <div>
              <label className="block text-sm font-medium mb-2">Comentário:</label>
              <div className="bg-gray-50 dark:bg-gray-800/50 p-3 rounded-md border">
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  {existingFeedback.comment}
                </p>
              </div>
            </div>
          )}

          {/* Agent Name */}
          {existingFeedback.agent_name && (
            <div className="text-xs text-gray-500 pt-2 border-t">
              Atendido por: <span className="font-medium">{existingFeedback.agent_name}</span>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Star className="h-5 w-5" />
          Avalie o Atendimento
        </CardTitle>
        {agentName && (
          <p className="text-sm text-gray-600">
            Atendido por: <span className="font-medium">{agentName}</span>
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Rating */}
        <div>
          <label className="block text-sm font-medium mb-3">
            Como você avalia o atendimento? *
          </label>
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
          <div className="text-xs text-gray-500 mt-1">
            {feedback.rating > 0 && (
              <span>
                {feedback.rating === 1 && "Muito ruim"}
                {feedback.rating === 2 && "Ruim"}
                {feedback.rating === 3 && "Regular"}
                {feedback.rating === 4 && "Bom"}
                {feedback.rating === 5 && "Excelente"}
              </span>
            )}
          </div>
        </div>

        {/* Satisfaction */}
        <div>
          <label className="block text-sm font-medium mb-3">
            Você está satisfeito com a resolução? *
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
          <label className="block text-sm font-medium mb-3">
            O que foi positivo no atendimento? (opcional)
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
          <label className="block text-sm font-medium mb-2">
            Comentários adicionais (opcional)
          </label>
          <Textarea
            value={feedback.comment}
            onChange={(e) => setFeedback(prev => ({ ...prev, comment: e.target.value }))}
            placeholder="Conte-nos mais sobre sua experiência..."
            className="min-h-20"
          />
        </div>

        {/* Submit */}
        <div className="flex justify-end pt-4 border-t">
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit || isLoading}
            className="flex items-center gap-2"
          >
            {isLoading ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Enviando...
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                Enviar Avaliação
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
