import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { 
  BookOpen, 
  Search, 
  Star, 
  ThumbsUp, 
  ThumbsDown, 
  Eye,
  Tag,
  Clock,
  ExternalLink,
  Filter,
  TrendingUp,
  User,
  Calendar
} from "lucide-react";
import DatabaseService from '@/lib/database';
import { useNavigate } from "react-router-dom";

interface KnowledgeBaseProps {
  embedded?: boolean;
  ticketCategory?: string;
}

export const KnowledgeBase = ({ embedded = false, ticketCategory }: KnowledgeBaseProps) => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [articles, setArticles] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        
        // Load articles and categories in parallel
        const [articlesData, categoriesData] = await Promise.all([
          DatabaseService.getEnhancedKnowledgeArticles({
            status: 'published'
          }),
          DatabaseService.getKnowledgeCategories({
            activeOnly: true
          })
        ]);

        setArticles(articlesData);
        
        // Create categories list with "all" option
        const categoryOptions = [
          { id: 'all', name: 'All Categories' },
          ...categoriesData
        ];
        setCategories(categoryOptions);
        
      } catch (err: any) {
        console.error('Error loading knowledge base data:', err);
        setError('Failed to load knowledge base articles');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const filteredArticles = articles.filter(article => {
    const matchesSearch = 
      article.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      article.content?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      article.excerpt?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      article.tags?.some((tag: string) => tag.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesCategory = 
      selectedCategory === "all" || 
      article.knowledge_category?.name === selectedCategory ||
      article.knowledge_category?.id === selectedCategory;
    
    const matchesTicketCategory = 
      !ticketCategory || 
      article.knowledge_category?.name?.toLowerCase() === ticketCategory.toLowerCase();
    
    return matchesSearch && matchesCategory && matchesTicketCategory;
  });

  // Sort articles by featured status, then by view count, then by date
  const sortedArticles = filteredArticles.sort((a, b) => {
    if (a.featured && !b.featured) return -1;
    if (!a.featured && b.featured) return 1;
    if ((b.view_count || 0) !== (a.view_count || 0)) {
      return (b.view_count || 0) - (a.view_count || 0);
    }
    return new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime();
  });

  const featuredArticles = articles.filter(article => article.featured);
  const popularArticles = articles.slice().sort((a, b) => (b.view_count || 0) - (a.view_count || 0)).slice(0, 3);

  const handleVote = async (articleId: string, type: "helpful" | "not_helpful") => {
    try {
      await DatabaseService.submitArticleFeedback({
        article_id: articleId,
        rating: type === "helpful" ? 1 : -1,
        is_anonymous: true
      });
      
      // Update local state
      setArticles(prev => prev.map(article => 
        article.id === articleId 
          ? {
              ...article,
              helpful_count: type === "helpful" ? (article.helpful_count || 0) + 1 : article.helpful_count,
              not_helpful_count: type === "not_helpful" ? (article.not_helpful_count || 0) + 1 : article.not_helpful_count
            }
          : article
      ));
    } catch (error) {
      console.error('Error submitting feedback:', error);
    }
  };

  const handleViewArticle = (articleId: string) => {
    navigate(`/knowledge/${articleId}`);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getReadingTime = (content: string) => {
    const wordsPerMinute = 200;
    const words = content?.split(' ').length || 0;
    return Math.ceil(words / wordsPerMinute);
  };

  if (loading) {
    return (
      <div className={embedded ? "" : "space-y-8"}>
        {!embedded && (
          <div>
            <Skeleton className="h-10 w-64 mb-2" />
            <Skeleton className="h-5 w-96" />
          </div>
        )}
        
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Search and filters skeleton */}
          <div className="lg:col-span-1">
            <Skeleton className="h-10 w-full mb-4" />
            <div className="space-y-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          </div>
          
          {/* Articles skeleton */}
          <div className="lg:col-span-3 space-y-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="text-center py-12">
          <BookOpen className="h-16 w-16 mx-auto mb-4 text-gray-300" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Unable to Load Articles
          </h3>
          <p className="text-gray-500 mb-4">{error}</p>
          <Button onClick={() => window.location.reload()}>
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (embedded) {
  return (
      <Card className="shadow-none border-0">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <BookOpen className="h-5 w-5" />
            Related Articles
        </CardTitle>
      </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {filteredArticles.slice(0, 5).map((article) => (
              <div
                key={article.id}
                className="p-3 rounded-lg border hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors"
                onClick={() => handleViewArticle(article.id)}
              >
                <h4 className="font-medium text-sm">{article.title}</h4>
                <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                  <Eye className="h-3 w-3" />
                  {article.view_count || 0}
                  <Clock className="h-3 w-3 ml-2" />
                  {article.reading_time_minutes || getReadingTime(article.content)} min
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Knowledge Base
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Find answers to common questions and learn from our comprehensive guides
        </p>
      </div>

      {/* Featured Articles */}
      {featuredArticles.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Star className="h-5 w-5 text-yellow-500" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Featured Articles
            </h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {featuredArticles.slice(0, 3).map((article) => (
              <Card 
                key={article.id} 
                className="hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => handleViewArticle(article.id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <Badge variant="secondary" className="text-xs">
                      Featured
                    </Badge>
                    <Star className="h-4 w-4 text-yellow-500 fill-current" />
                  </div>
                  <h3 className="font-semibold mb-2 line-clamp-2">{article.title}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mb-3">
                    {article.excerpt}
                  </p>
                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    <div className="flex items-center gap-1">
                      <Eye className="h-3 w-3" />
                      {article.view_count || 0}
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {article.reading_time_minutes || getReadingTime(article.content)} min
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Sidebar */}
        <div className="lg:col-span-1 space-y-6">
            {/* Search */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Search className="h-4 w-4" />
                Search Articles
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                  placeholder="Search articles..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            </CardContent>
          </Card>

            {/* Categories */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Filter className="h-4 w-4" />
                Categories
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-2">
              {categories.map(category => (
                <Button
                    key={category.id}
                    variant={selectedCategory === category.id ? "default" : "ghost"}
                  size="sm"
                    onClick={() => setSelectedCategory(category.id)}
                    className="w-full justify-start"
                >
                    {category.name}
                </Button>
              ))}
            </div>
            </CardContent>
          </Card>

          {/* Popular Articles */}
          {popularArticles.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Popular Articles
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-3">
                  {popularArticles.map((article) => (
                    <div
                      key={article.id}
                      className="p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors"
                      onClick={() => handleViewArticle(article.id)}
                    >
                      <h4 className="font-medium text-sm line-clamp-2 mb-1">
                        {article.title}
                      </h4>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <Eye className="h-3 w-3" />
                        {article.view_count || 0}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Main Content */}
        <div className="lg:col-span-3">
          {/* Results header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {searchTerm || selectedCategory !== "all" 
                  ? `Search Results (${sortedArticles.length})`
                  : `All Articles (${sortedArticles.length})`}
              </h2>
              {searchTerm && (
                <p className="text-sm text-gray-500 mt-1">
                  Showing results for "{searchTerm}"
                </p>
              )}
            </div>
          </div>

          {/* Articles */}
          <div className="space-y-6">
            {sortedArticles.length === 0 ? (
              <Card>
                <CardContent className="text-center py-12">
                  <BookOpen className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    No Articles Found
                  </h3>
                  <p className="text-gray-500 mb-4">
                    {searchTerm || selectedCategory !== "all" 
                      ? "Try adjusting your search terms or filters" 
                      : "No published articles are available yet"}
                  </p>
                  {(searchTerm || selectedCategory !== "all") && (
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        setSearchTerm("");
                        setSelectedCategory("all");
                      }}
                    >
                      Clear Filters
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              sortedArticles.map((article) => (
                <Card 
                  key={article.id} 
                  className="hover:shadow-md transition-all duration-200 cursor-pointer"
                  onClick={() => handleViewArticle(article.id)}
                >
                  <CardContent className="p-6">
                    <div className="space-y-4">
                      {/* Header */}
                      <div className="flex items-start justify-between">
                      <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            {article.featured && (
                              <Badge variant="secondary" className="text-xs">
                                <Star className="h-3 w-3 mr-1" />
                                Featured
                              </Badge>
                            )}
                            {article.knowledge_category && (
                              <Badge 
                                variant="outline" 
                                className="text-xs"
                                style={{ 
                                  backgroundColor: article.knowledge_category.color + '20',
                                  borderColor: article.knowledge_category.color
                                }}
                              >
                                <Tag className="h-3 w-3 mr-1" />
                                {article.knowledge_category.name}
                              </Badge>
                            )}
                          </div>
                          
                          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2 line-clamp-2">
                            {article.title}
                          </h3>
                          
                          {article.excerpt && (
                            <p className="text-gray-600 dark:text-gray-400 line-clamp-3 mb-3">
                              {article.excerpt}
                            </p>
                          )}
                        </div>
                        
                        <ExternalLink className="h-5 w-5 text-gray-400 ml-4 flex-shrink-0" />
                      </div>

                      {/* Metadata */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-6 text-sm text-gray-500">
                          {article.author && (
                            <div className="flex items-center gap-1">
                              <User className="h-4 w-4" />
                              {article.author.full_name}
                            </div>
                          )}
                          
                          <div className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            {formatDate(article.updated_at || article.created_at)}
                          </div>
                          
                          <div className="flex items-center gap-1">
                            <Eye className="h-4 w-4" />
                            {article.view_count || 0} views
                          </div>
                          
                          <div className="flex items-center gap-1">
                            <Clock className="h-4 w-4" />
                            {article.reading_time_minutes || getReadingTime(article.content)} min read
                          </div>
                        </div>

                        {/* Feedback */}
                        <div className="flex items-center gap-3">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleVote(article.id, "helpful");
                            }}
                            className="text-green-600 hover:text-green-700 hover:bg-green-50"
                          >
                            <ThumbsUp className="h-4 w-4 mr-1" />
                            {article.helpful_count || 0}
                          </Button>
                          
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleVote(article.id, "not_helpful");
                            }}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <ThumbsDown className="h-4 w-4 mr-1" />
                            {article.not_helpful_count || 0}
                          </Button>
                        </div>
                      </div>

                      {/* Tags */}
                      {article.tags && article.tags.length > 0 && (
                        <div className="flex gap-2 flex-wrap">
                          {article.tags.map((tag: string, index: number) => (
                            <Badge key={index} variant="secondary" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
