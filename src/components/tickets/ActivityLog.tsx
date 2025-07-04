import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { 
  History, 
  Settings, 
  ArrowRight, 
  FileText, 
  AlertCircle,
  Clock,
  UserPlus,
  MessageSquare,
  CheckCircle,
  RotateCcw,
  Star
} from "lucide-react";
import { DatabaseService, TicketActivityLog } from "@/lib/database";



interface ActivityLogProps {
  ticketId: string;
}

export const ActivityLog = ({ ticketId }: ActivityLogProps) => {
  const [activities, setActivities] = useState<TicketActivityLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadActivityLogs();
  }, [ticketId]);

  const loadActivityLogs = async () => {
    try {
      setLoading(true);
      const logs = await DatabaseService.getTicketActivityLogs(ticketId);
      setActivities(logs);
    } catch (error) {
      console.error('Error loading activity logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case "created":
        return <FileText className="h-4 w-4 text-blue-600" />;
      case "assigned":
      case "unassigned":
        return <UserPlus className="h-4 w-4 text-purple-600" />;
      case "status_changed":
        return <Settings className="h-4 w-4 text-orange-600" />;
      case "priority_changed":
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      case "comment_added":
        return <MessageSquare className="h-4 w-4 text-green-600" />;
      case "resolution_added":
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case "reopened":
        return <RotateCcw className="h-4 w-4 text-blue-600" />;
      case "closed":
        return <CheckCircle className="h-4 w-4 text-gray-600" />;
      case "feedback_received":
        return <Star className="h-4 w-4 text-yellow-600" />;
      default:
        return <Clock className="h-4 w-4 text-gray-600" />;
    }
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case "created":
        return "bg-blue-100 dark:bg-blue-900/30";
      case "assigned":
      case "unassigned":
        return "bg-purple-100 dark:bg-purple-900/30";
      case "status_changed":
        return "bg-orange-100 dark:bg-orange-900/30";
      case "priority_changed":
        return "bg-red-100 dark:bg-red-900/30";
      case "comment_added":
        return "bg-green-100 dark:bg-green-900/30";
      case "resolution_added":
        return "bg-emerald-100 dark:bg-emerald-900/30";
      case "reopened":
        return "bg-blue-100 dark:bg-blue-900/30";
      case "closed":
        return "bg-gray-100 dark:bg-gray-800";
      case "feedback_received":
        return "bg-yellow-100 dark:bg-yellow-900/30";
      default:
        return "bg-gray-100 dark:bg-gray-800";
    }
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

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  return (
    <div className="space-y-3">
      {loading ? (
        <div className="text-center py-6 text-gray-500 dark:text-gray-400">
          <div className="animate-pulse flex items-center justify-center gap-2 mb-2">
            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
          </div>
          <p className="text-sm">Carregando atividades...</p>
        </div>
      ) : activities.length === 0 ? (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          <div className="p-3 rounded-full bg-gray-100 dark:bg-gray-800 w-12 h-12 mx-auto mb-3 flex items-center justify-center">
            <History className="h-6 w-6 text-gray-400 dark:text-gray-600" />
          </div>
          <p className="text-sm font-medium mb-1">Nenhuma atividade</p>
          <p className="text-xs">Este ticket ainda não possui histórico</p>
        </div>
      ) : (
        <div className="space-y-3">
          {activities.slice(0, 5).map((activity, index) => (
            <div key={activity.id} className="group">
              <div className="flex gap-3 p-3 rounded-lg hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors">
                <div className="relative flex-shrink-0">
                  <div className={`p-2 rounded-lg ${getActivityColor(activity.action_type)} shadow-sm`}>
                    {getActivityIcon(activity.action_type)}
                  </div>
                  {index < Math.min(activities.length - 1, 4) && (
                    <div className="absolute top-10 left-1/2 transform -translate-x-1/2 w-px h-4 bg-gray-200 dark:bg-gray-700" />
                  )}
                </div>
                
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 leading-relaxed">
                      {activity.description}
                    </p>
                    <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
                      {formatDate(activity.created_at)}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Avatar className="h-4 w-4">
                      <AvatarFallback className="text-xs bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800 text-gray-600 dark:text-gray-400">
                        {getInitials(activity.user?.name || 'S')}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-xs text-gray-600 dark:text-gray-400">
                      {activity.user?.name || 'Sistema'}
                    </span>
                  </div>

                  {activity.old_value && activity.new_value && (
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="outline" className="text-xs h-5 px-2 bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800">
                        {activity.old_value}
                      </Badge>
                      <ArrowRight className="h-3 w-3 text-gray-400" />
                      <Badge variant="outline" className="text-xs h-5 px-2 bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800">
                        {activity.new_value}
                      </Badge>
                    </div>
                  )}

                  {activity.metadata && (
                    <div className="text-xs text-gray-600 dark:text-gray-400 bg-gray-50/50 dark:bg-gray-800/50 p-2 rounded border border-gray-200/50 dark:border-gray-700/50 mt-2">
                      {activity.metadata.reason && (
                        <p><span className="font-medium">Motivo:</span> {activity.metadata.reason}</p>
                      )}
                      {activity.metadata.comment_id && (
                        <p><span className="font-medium">Tipo:</span> {activity.metadata.is_internal ? 'Nota interna' : 'Comentário público'}</p>
                      )}
                      {activity.metadata.rating && (
                        <p><span className="font-medium">Avaliação:</span> {activity.metadata.rating} estrelas ({activity.metadata.satisfaction})</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
          
          {activities.length > 5 && (
            <div className="text-center pt-2">
              <button className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium">
                Ver mais {activities.length - 5} atividades
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
