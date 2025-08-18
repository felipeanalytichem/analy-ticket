import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SLAMonitor } from '@/components/tickets/SLAMonitor';
import { TicketTags } from '@/components/tickets/TicketTags';
import { KnowledgeBase } from '@/components/knowledge/KnowledgeBase';
import { useUser } from '@/hooks/useUser';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

interface TicketPropertiesProps {
  ticket: any;
  userRole: 'user' | 'agent' | 'admin';
  className?: string;
}

export function TicketProperties({ ticket, userRole, className }: TicketPropertiesProps) {
  const { t } = useTranslation();
  const { data: assigneeProfile } = useUser(ticket?.assigned_to ?? undefined);

  const handleTagsChange = (tags: string[]) => {
    /* TODO: persist tag updates */
  };

  return (
    <div className={cn('space-y-6', className)}>
      {/* SLA */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">{t('tickets.slaMonitoring')}</CardTitle>
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

      {/* Tags */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">{t('tickets.tags')}</CardTitle>
        </CardHeader>
        <CardContent>
          <TicketTags
            ticketId={ticket.id}
            selectedTags={(ticket as any).tags ?? []}
            onTagsChange={handleTagsChange}
            mode={userRole !== 'user' ? 'edit' : 'display'}
          />
        </CardContent>
      </Card>

      {/* Related Articles */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <span>{t('tickets.knowledgeBase')}</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <KnowledgeBase embedded ticketCategory={ticket.category_id ?? undefined} />
        </CardContent>
      </Card>
    </div>
  );
} 