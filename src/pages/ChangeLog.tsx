import { ArrowLeft, Calendar, Tag, Users, Zap, Bug, Plus, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useNavigate } from 'react-router-dom';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ChangeLogEntry {
  version: string;
  date: string;
  type: 'major' | 'minor' | 'patch';
  changes: {
    type: 'feature' | 'improvement' | 'bugfix' | 'breaking';
    title: string;
    description: string;
  }[];
}

const changeLogData: ChangeLogEntry[] = [
  {
    version: '2.1.0',
    date: '2025-01-20',
    type: 'minor',
    changes: [
      {
        type: 'feature',
        title: 'Change Log System',
        description: 'Added comprehensive change log page to track system updates and improvements.'
      },
      {
        type: 'improvement',
        title: 'Settings Navigation',
        description: 'Enhanced settings page with improved navigation and quick access to change log.'
      }
    ]
  },
  {
    version: '2.0.0',
    date: '2025-01-15',
    type: 'major',
    changes: [
      {
        type: 'feature',
        title: 'Enhanced Chat System',
        description: 'Complete overhaul of the real-time chat system with message reactions, improved UI, and better performance.'
      },
      {
        type: 'feature',
        title: 'Advanced Analytics Dashboard',
        description: 'New comprehensive analytics dashboard with real-time metrics, performance insights, and customizable widgets.'
      },
      {
        type: 'feature',
        title: 'Multi-language Support',
        description: 'Full internationalization support with English, Portuguese, and Spanish language options.'
      },
      {
        type: 'improvement',
        title: 'Mobile Responsiveness',
        description: 'Complete mobile-first redesign ensuring optimal experience across all device sizes.'
      },
      {
        type: 'breaking',
        title: 'Database Schema Update',
        description: 'Major database restructuring for improved performance and scalability. Requires migration.'
      }
    ]
  },
  {
    version: '1.9.2',
    date: '2025-01-10',
    type: 'patch',
    changes: [
      {
        type: 'bugfix',
        title: 'Category Management Fix',
        description: 'Fixed issue with category enable/disable toggle not persisting correctly.'
      },
      {
        type: 'bugfix',
        title: 'Notification Performance',
        description: 'Resolved performance issues with real-time notifications for large user bases.'
      },
      {
        type: 'improvement',
        title: 'Search Optimization',
        description: 'Improved search performance and accuracy across tickets and knowledge base.'
      }
    ]
  },
  {
    version: '1.9.1',
    date: '2025-01-05',
    type: 'patch',
    changes: [
      {
        type: 'bugfix',
        title: 'Authentication Fix',
        description: 'Fixed session persistence issues affecting user login experience.'
      },
      {
        type: 'bugfix',
        title: 'File Upload Security',
        description: 'Enhanced file upload validation and security measures.'
      }
    ]
  },
  {
    version: '1.9.0',
    date: '2025-01-01',
    type: 'minor',
    changes: [
      {
        type: 'feature',
        title: 'Todo Task Management',
        description: 'Added comprehensive todo and task management system with priority settings and due dates.'
      },
      {
        type: 'feature',
        title: 'SLA Configuration',
        description: 'Implemented service level agreement monitoring and configuration tools.'
      },
      {
        type: 'feature',
        title: 'Feedback System',
        description: 'New customer satisfaction feedback system with rating and analytics.'
      },
      {
        type: 'improvement',
        title: 'Theme System',
        description: 'Enhanced dark/light theme switching with system preference detection.'
      }
    ]
  },
  {
    version: '1.8.0',
    date: '2024-12-20',
    type: 'minor',
    changes: [
      {
        type: 'feature',
        title: 'Knowledge Base System',
        description: 'Complete knowledge base implementation with article management, categories, and search.'
      },
      {
        type: 'feature',
        title: 'Advanced Ticket Filters',
        description: 'Multi-criteria filtering system for tickets with save and share functionality.'
      },
      {
        type: 'improvement',
        title: 'Notification System',
        description: 'Enhanced notification system with email integration and user preferences.'
      }
    ]
  },
  {
    version: '1.7.0',
    date: '2024-12-10',
    type: 'minor',
    changes: [
      {
        type: 'feature',
        title: 'Agent Dashboard',
        description: 'Dedicated agent dashboard with performance metrics and assigned ticket management.'
      },
      {
        type: 'feature',
        title: 'Ticket Reopening System',
        description: 'Formal ticket reopening workflow with approval process.'
      },
      {
        type: 'improvement',
        title: 'User Management',
        description: 'Enhanced user management with role-based permissions and bulk operations.'
      }
    ]
  }
];

const getTypeIcon = (type: ChangeLogEntry['changes'][0]['type']) => {
  switch (type) {
    case 'feature':
      return <Plus className="h-4 w-4" />;
    case 'improvement':
      return <Zap className="h-4 w-4" />;
    case 'bugfix':
      return <Bug className="h-4 w-4" />;
    case 'breaking':
      return <Settings className="h-4 w-4" />;
    default:
      return <Tag className="h-4 w-4" />;
  }
};

const getTypeBadgeVariant = (type: ChangeLogEntry['changes'][0]['type']) => {
  switch (type) {
    case 'feature':
      return 'default';
    case 'improvement':
      return 'secondary';
    case 'bugfix':
      return 'destructive';
    case 'breaking':
      return 'outline';
    default:
      return 'default';
  }
};

const getVersionBadgeVariant = (type: ChangeLogEntry['type']) => {
  switch (type) {
    case 'major':
      return 'destructive';
    case 'minor':
      return 'default';
    case 'patch':
      return 'secondary';
    default:
      return 'default';
  }
};

export default function ChangeLog() {
  const navigate = useNavigate();

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={() => navigate(-1)}
            className="mb-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Change Log
            </h1>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              Track all updates, improvements, and fixes to the Analy-Ticket system
            </p>
          </div>
        </div>

        <ScrollArea className="h-[calc(100vh-200px)]">
          <div className="space-y-6">
            {changeLogData.map((entry, index) => (
              <Card key={entry.version} className="overflow-hidden">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CardTitle className="text-xl">
                        Version {entry.version}
                      </CardTitle>
                      <Badge variant={getVersionBadgeVariant(entry.type)}>
                        {entry.type.toUpperCase()}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                      <Calendar className="h-4 w-4" />
                      {formatDate(entry.date)}
                    </div>
                  </div>
                  <CardDescription>
                    {entry.changes.length} {entry.changes.length === 1 ? 'change' : 'changes'} in this release
                  </CardDescription>
                </CardHeader>
                
                <CardContent className="space-y-4">
                  {entry.changes.map((change, changeIndex) => (
                    <div key={changeIndex} className="space-y-2">
                      <div className="flex items-start gap-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <Badge 
                            variant={getTypeBadgeVariant(change.type)}
                            className="flex items-center gap-1"
                          >
                            {getTypeIcon(change.type)}
                            {change.type.charAt(0).toUpperCase() + change.type.slice(1)}
                          </Badge>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-gray-900 dark:text-white">
                            {change.title}
                          </h4>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                            {change.description}
                          </p>
                        </div>
                      </div>
                      {changeIndex < entry.changes.length - 1 && (
                        <Separator className="my-3" />
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>

        <div className="mt-8 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            For technical support or questions about any changes, please contact the development team.
          </p>
        </div>
      </div>
    </div>
  );
} 