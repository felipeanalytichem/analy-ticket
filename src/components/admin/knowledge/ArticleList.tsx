import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Edit, 
  Trash2, 
  Eye, 
  Archive, 
  Upload,
  Clock,
  TrendingUp,
  User,
  MoreVertical,
  ExternalLink
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ArticleListProps {
  articles: any[];
  isLoading: boolean;
  onEdit: (article: any) => void;
  onDelete: (articleId: string) => void;
  onPublish: (articleId: string) => void;
  onArchive: (articleId: string) => void;
  userRole: string;
}

export const ArticleList = ({ 
  articles, 
  isLoading, 
  onEdit, 
  onDelete, 
  onPublish, 
  onArchive, 
  userRole 
}: ArticleListProps) => {
  
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'published': return 'bg-green-100 text-green-800';
      case 'draft': return 'bg-yellow-100 text-yellow-800';
      case 'review': return 'bg-blue-100 text-blue-800';
      case 'archived': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center space-x-4 p-4 border rounded-lg">
                <div className="h-12 w-12 bg-gray-200 rounded animate-pulse"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-3/4 animate-pulse"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2 animate-pulse"></div>
                </div>
                <div className="h-8 w-20 bg-gray-200 rounded animate-pulse"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (articles.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-12">
            <div className="mx-auto w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <Edit className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No articles found</h3>
            <p className="text-gray-600 max-w-sm mx-auto">
              Start creating your knowledge base by adding your first article.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {articles.map((article) => (
        <Card key={article.id} className="hover:shadow-md transition-shadow">
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
                    {article.title}
                  </h3>
                  <Badge className={getStatusColor(article.status || 'draft')}>
                    {article.status || 'draft'}
                  </Badge>
                  {article.featured && (
                    <Badge variant="outline" className="text-orange-600 border-orange-600">
                      Featured
                    </Badge>
                  )}
                </div>

                {article.excerpt && (
                  <p className="text-gray-600 dark:text-gray-300 mb-3 line-clamp-2">
                    {article.excerpt}
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 mb-3">
                  <div className="flex items-center gap-1">
                    <User className="h-4 w-4" />
                    <span>{article.author?.name || 'Unknown'}</span>
                  </div>
                  
                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    <span>{formatDate(article.created_at)}</span>
                  </div>

                  {article.view_count !== undefined && (
                    <div className="flex items-center gap-1">
                      <Eye className="h-4 w-4" />
                      <span>{article.view_count} views</span>
                    </div>
                  )}

                  {article.reading_time_minutes && (
                    <div className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      <span>{article.reading_time_minutes} min read</span>
                    </div>
                  )}

                  {(article.helpful_count || article.not_helpful_count) && (
                    <div className="flex items-center gap-1">
                      <TrendingUp className="h-4 w-4" />
                      <span>
                        {((article.helpful_count || 0) / Math.max(1, (article.helpful_count || 0) + (article.not_helpful_count || 0)) * 100).toFixed(0)}% helpful
                      </span>
                    </div>
                  )}
                </div>

                {article.knowledge_category && (
                  <div className="flex items-center gap-2 mb-3">
                    <Badge variant="outline">
                      {article.knowledge_category.name}
                    </Badge>
                  </div>
                )}

                {article.tags && article.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {article.tags.slice(0, 3).map((tag: string) => (
                      <Badge key={tag} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                    {article.tags.length > 3 && (
                      <Badge variant="secondary" className="text-xs">
                        +{article.tags.length - 3} more
                      </Badge>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 ml-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onEdit(article)}
                  className="flex items-center gap-1"
                >
                  <Edit className="h-4 w-4" />
                  Edit
                </Button>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {article.status === 'published' && (
                      <DropdownMenuItem onClick={() => window.open(`/knowledge/${article.id}`, '_blank')}>
                        <ExternalLink className="h-4 w-4 mr-2" />
                        View Live
                      </DropdownMenuItem>
                    )}
                    
                    {article.status !== 'published' && userRole === 'admin' && (
                      <DropdownMenuItem onClick={() => onPublish(article.id)}>
                        <Upload className="h-4 w-4 mr-2" />
                        Publish
                      </DropdownMenuItem>
                    )}
                    
                    {article.status === 'published' && (
                      <DropdownMenuItem onClick={() => onArchive(article.id)}>
                        <Archive className="h-4 w-4 mr-2" />
                        Archive
                      </DropdownMenuItem>
                    )}
                    
                    <DropdownMenuSeparator />
                    
                    <DropdownMenuItem 
                      onClick={() => onDelete(article.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}; 