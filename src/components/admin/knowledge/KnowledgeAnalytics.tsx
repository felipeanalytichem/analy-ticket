import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  TrendingUp, 
  Eye, 
  ThumbsUp, 
  Clock, 
  BookOpen,
  Users,
  Calendar,
  BarChart3,
  PieChart,
  Activity
} from "lucide-react";

interface KnowledgeAnalyticsProps {
  articles: any[];
  categories: any[];
}

export const KnowledgeAnalytics = ({ articles, categories }: KnowledgeAnalyticsProps) => {
  // Calculate analytics data
  const totalViews = articles.reduce((sum, article) => sum + (article.view_count || 0), 0);
  const totalHelpfulVotes = articles.reduce((sum, article) => sum + (article.helpful_count || 0), 0);
  const totalNotHelpfulVotes = articles.reduce((sum, article) => sum + (article.not_helpful_count || 0), 0);
  const totalFeedback = totalHelpfulVotes + totalNotHelpfulVotes;
  const helpfulnessRatio = totalFeedback > 0 ? (totalHelpfulVotes / totalFeedback * 100) : 0;

  // Most viewed articles
  const mostViewedArticles = [...articles]
    .sort((a, b) => (b.view_count || 0) - (a.view_count || 0))
    .slice(0, 5);

  // Most helpful articles
  const mostHelpfulArticles = [...articles]
    .filter(article => (article.helpful_count || 0) + (article.not_helpful_count || 0) > 0)
    .sort((a, b) => {
      const aRatio = (a.helpful_count || 0) / Math.max(1, (a.helpful_count || 0) + (a.not_helpful_count || 0));
      const bRatio = (b.helpful_count || 0) / Math.max(1, (b.helpful_count || 0) + (b.not_helpful_count || 0));
      return bRatio - aRatio;
    })
    .slice(0, 5);

  // Recent articles
  const recentArticles = [...articles]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5);

  // Category statistics
  const categoryStats = categories.map(category => {
    const categoryArticles = articles.filter(article => 
      article.knowledge_category_id === category.id
    );
    const totalViews = categoryArticles.reduce((sum, article) => sum + (article.view_count || 0), 0);
    const publishedCount = categoryArticles.filter(article => article.status === 'published').length;
    
    return {
      ...category,
      articleCount: categoryArticles.length,
      publishedCount,
      totalViews
    };
  }).sort((a, b) => b.articleCount - a.articleCount);

  // Status distribution
  const statusCounts = articles.reduce((acc, article) => {
    const status = article.status || 'draft';
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const getHelpfulnessRatio = (article: any) => {
    const helpful = article.helpful_count || 0;
    const notHelpful = article.not_helpful_count || 0;
    const total = helpful + notHelpful;
    return total > 0 ? (helpful / total * 100) : 0;
  };

  return (
    <div className="space-y-6">
      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Total Views</p>
                <p className="text-2xl font-bold">{totalViews.toLocaleString()}</p>
                <p className="text-xs text-gray-500">Across all articles</p>
              </div>
              <Eye className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Helpfulness</p>
                <p className="text-2xl font-bold">{helpfulnessRatio.toFixed(1)}%</p>
                <p className="text-xs text-gray-500">{totalFeedback} total votes</p>
              </div>
              <ThumbsUp className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Avg. Reading Time</p>
                <p className="text-2xl font-bold">
                  {(articles.reduce((sum, a) => sum + (a.reading_time_minutes || 0), 0) / Math.max(1, articles.length)).toFixed(1)} min
                </p>
                <p className="text-xs text-gray-500">Per article</p>
              </div>
              <Clock className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Active Categories</p>
                <p className="text-2xl font-bold">{categories.filter(c => c.is_active).length}</p>
                <p className="text-xs text-gray-500">Out of {categories.length} total</p>
              </div>
              <BarChart3 className="h-8 w-8 text-indigo-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Article Status Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="h-5 w-5" />
              Article Status Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(statusCounts).map(([status, count]) => {
                const percentage = (count / articles.length * 100).toFixed(1);
                const getStatusColor = (status: string) => {
                  switch (status) {
                    case 'published': return 'bg-green-500';
                    case 'draft': return 'bg-yellow-500';
                    case 'review': return 'bg-blue-500';
                    case 'archived': return 'bg-gray-500';
                    default: return 'bg-gray-500';
                  }
                };

                return (
                  <div key={status} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${getStatusColor(status)}`} />
                      <span className="capitalize">{status}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600">{count}</span>
                      <Badge variant="outline">{percentage}%</Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Category Performance */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Category Performance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {categoryStats.slice(0, 5).map(category => (
                <div key={category.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-4 h-4 rounded"
                      style={{ backgroundColor: category.color || '#3B82F6' }}
                    />
                    <span className="text-sm font-medium">{category.name}</span>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-600">
                    <span>{category.articleCount} articles</span>
                    <span>{category.totalViews} views</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Most Viewed Articles */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Most Viewed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {mostViewedArticles.map((article, index) => (
                <div key={article.id} className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium">
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {article.title}
                    </p>
                    <p className="text-xs text-gray-500">{article.view_count || 0} views</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Most Helpful Articles */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ThumbsUp className="h-5 w-5" />
              Most Helpful
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {mostHelpfulArticles.map((article, index) => (
                <div key={article.id} className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-6 h-6 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-sm font-medium">
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {article.title}
                    </p>
                    <p className="text-xs text-gray-500">
                      {getHelpfulnessRatio(article).toFixed(1)}% helpful
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent Articles */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Recently Created
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentArticles.map((article, index) => (
                <div key={article.id} className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-6 h-6 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center text-sm font-medium">
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {article.title}
                    </p>
                    <p className="text-xs text-gray-500">{formatDate(article.created_at)}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Category Stats */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Detailed Category Statistics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">Category</th>
                  <th className="text-right p-2">Total Articles</th>
                  <th className="text-right p-2">Published</th>
                  <th className="text-right p-2">Draft</th>
                  <th className="text-right p-2">Total Views</th>
                  <th className="text-right p-2">Avg. Views</th>
                </tr>
              </thead>
              <tbody>
                {categoryStats.map(category => {
                  const draftCount = articles.filter(a => 
                    a.knowledge_category_id === category.id && a.status === 'draft'
                  ).length;
                  const avgViews = category.articleCount > 0 
                    ? (category.totalViews / category.articleCount).toFixed(1) 
                    : '0';

                  return (
                    <tr key={category.id} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800">
                      <td className="p-2">
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded"
                            style={{ backgroundColor: category.color || '#3B82F6' }}
                          />
                          {category.name}
                        </div>
                      </td>
                      <td className="text-right p-2">{category.articleCount}</td>
                      <td className="text-right p-2 text-green-600">{category.publishedCount}</td>
                      <td className="text-right p-2 text-yellow-600">{draftCount}</td>
                      <td className="text-right p-2">{category.totalViews}</td>
                      <td className="text-right p-2">{avgViews}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}; 