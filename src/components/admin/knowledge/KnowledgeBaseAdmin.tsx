import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  BookOpen, 
  Plus, 
  Search, 
  Edit, 
  Trash2,
  Eye,
  Archive,
  Clock,
  TrendingUp,
  Users,
  Star,
  Settings,
  FileText,
  Tag,
  Upload
} from "lucide-react";
import DatabaseService from '@/lib/database';
import { ArticleEditor } from "./ArticleEditor";
import { CategoryManager } from "./CategoryManager";
import { ArticleList } from "./ArticleList";
import { KnowledgeAnalytics } from "./KnowledgeAnalytics";

interface KnowledgeBaseAdminProps {
  userRole: string;
  userId: string;
}

export const KnowledgeBaseAdmin = ({ userRole, userId }: KnowledgeBaseAdminProps) => {
  const [activeTab, setActiveTab] = useState("articles");
  const [articles, setArticles] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [editingArticle, setEditingArticle] = useState<any>(null);
  const [isCreatingArticle, setIsCreatingArticle] = useState(false);
  const [stats, setStats] = useState({
    totalArticles: 0,
    publishedArticles: 0,
    draftArticles: 0,
    totalViews: 0,
    totalFeedback: 0
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      
      // Load articles
      const articlesData = await DatabaseService.getEnhancedKnowledgeArticles({
        limit: 100
      });
      setArticles(articlesData);

      // Load categories
      const categoriesData = await DatabaseService.getKnowledgeCategoriesForAdmin({
        activeOnly: false
      });
      setCategories(categoriesData);

      // Calculate stats
      const totalArticles = articlesData.length;
      const publishedArticles = articlesData.filter(a => a.status === 'published').length;
      const draftArticles = articlesData.filter(a => a.status === 'draft').length;
      const totalViews = articlesData.reduce((sum, a) => sum + (a.view_count || 0), 0);
      const totalFeedback = articlesData.reduce((sum, a) => sum + (a.helpful_count || 0) + (a.not_helpful_count || 0), 0);

      setStats({
        totalArticles,
        publishedArticles,
        draftArticles,
        totalViews,
        totalFeedback
      });

    } catch (error) {
      console.error('Error loading knowledge base data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateArticle = () => {
    setEditingArticle(null);
    setIsCreatingArticle(true);
  };

  const handleEditArticle = (article: any) => {
    setEditingArticle(article);
    setIsCreatingArticle(false);
  };

  const handleSaveArticle = async (articleData: any) => {
    try {
      if (editingArticle) {
        await DatabaseService.updateKnowledgeArticle(editingArticle.id, articleData);
      } else {
        await DatabaseService.createKnowledgeArticle({
          ...articleData,
          author_id: userId,
          status: articleData.status || 'draft'
        });
      }
      
      setEditingArticle(null);
      setIsCreatingArticle(false);
      await loadData();
    } catch (error) {
      console.error('Error saving article:', error);
      throw error; // Re-throw to be caught by the ArticleEditor
    }
  };

  const handleDeleteArticle = async (articleId: string) => {
    if (confirm('Are you sure you want to delete this article?')) {
      try {
        await DatabaseService.deleteKnowledgeArticle(articleId);
        await loadData();
      } catch (error) {
        console.error('Error deleting article:', error);
      }
    }
  };

  const handlePublishArticle = async (articleId: string) => {
    try {
      await DatabaseService.publishArticle(articleId, userId);
      await loadData();
    } catch (error) {
      console.error('Error publishing article:', error);
    }
  };

  const handleArchiveArticle = async (articleId: string) => {
    try {
      await DatabaseService.archiveArticle(articleId);
      await loadData();
    } catch (error) {
      console.error('Error archiving article:', error);
    }
  };

  const filteredArticles = articles.filter(article => {
    const matchesSearch = article.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         article.content.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = selectedStatus === 'all' || article.status === selectedStatus;
    return matchesSearch && matchesStatus;
  });

  if (isCreatingArticle || editingArticle) {
    return (
      <ArticleEditor
        article={editingArticle}
        categories={categories}
        onSave={handleSaveArticle}
        onCancel={() => {
          setEditingArticle(null);
          setIsCreatingArticle(false);
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Knowledge Base Admin</h1>
          <p className="text-gray-600 dark:text-gray-300">Manage articles, categories, and settings</p>
        </div>
        <Button onClick={handleCreateArticle} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          New Article
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Total Articles</p>
                <p className="text-2xl font-bold">{stats.totalArticles}</p>
              </div>
              <FileText className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Published</p>
                <p className="text-2xl font-bold text-green-600">{stats.publishedArticles}</p>
              </div>
              <Eye className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Drafts</p>
                <p className="text-2xl font-bold text-yellow-600">{stats.draftArticles}</p>
              </div>
              <Edit className="h-8 w-8 text-yellow-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Total Views</p>
                <p className="text-2xl font-bold text-purple-600">{stats.totalViews}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Feedback</p>
                <p className="text-2xl font-bold text-indigo-600">{stats.totalFeedback}</p>
              </div>
              <Users className="h-8 w-8 text-indigo-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="articles" className="flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            Articles
          </TabsTrigger>
          <TabsTrigger value="categories" className="flex items-center gap-2">
            <Tag className="h-4 w-4" />
            Categories
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Analytics
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="articles" className="space-y-6">
          {/* Filters */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search articles..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <div className="flex gap-2">
                  {['all', 'draft', 'review', 'published', 'archived'].map(status => (
                    <Button
                      key={status}
                      variant={selectedStatus === status ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedStatus(status)}
                    >
                      {status === 'all' ? 'All' : status.charAt(0).toUpperCase() + status.slice(1)}
                    </Button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Articles List */}
          <ArticleList
            articles={filteredArticles}
            isLoading={isLoading}
            onEdit={handleEditArticle}
            onDelete={handleDeleteArticle}
            onPublish={handlePublishArticle}
            onArchive={handleArchiveArticle}
            userRole={userRole}
          />
        </TabsContent>

        <TabsContent value="categories" className="space-y-6">
          <CategoryManager
            categories={categories}
            onCategoriesChange={loadData}
            userRole={userRole}
          />
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          <KnowledgeAnalytics
            articles={articles}
            categories={categories}
          />
        </TabsContent>

        <TabsContent value="settings" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Knowledge Base Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">General Settings</h3>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2">
                      <input type="checkbox" defaultChecked />
                      <span className="text-sm">Allow user feedback</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="checkbox" defaultChecked />
                      <span className="text-sm">Show reading time</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="checkbox" defaultChecked />
                      <span className="text-sm">Enable article rating</span>
                    </label>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Content Settings</h3>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2">
                      <input type="checkbox" defaultChecked />
                      <span className="text-sm">Require review before publishing</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="checkbox" />
                      <span className="text-sm">Auto-save drafts</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="checkbox" defaultChecked />
                      <span className="text-sm">Version history</span>
                    </label>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}; 