import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  ArrowLeft, 
  Eye, 
  ThumbsUp, 
  ThumbsDown, 
  Clock, 
  User,
  Tag as TagIcon,
  Star,
  Share2,
  Bookmark,
  Printer,
  Calendar,
  ChevronRight,
  ChevronDown,
  BookOpen,
  MessageSquare,
  CheckCircle,
  Copy,
  Check,
  HelpCircle,
  Phone,
  Mail,
  MessageCircleIcon,
  Lightbulb,
  FileText,
  Shield,
  Settings,
  Hash,
  ArrowUp,
  Search,
  ExternalLink,
  Home
} from "lucide-react";
import DatabaseService from '@/lib/database';
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAuth } from '@/contexts/AuthContext';

interface StepData {
  title: string;
  content: string;
  icon: string;
  expanded: boolean;
}

export const KnowledgeArticleView = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  const contentRef = useRef<HTMLDivElement>(null);
  const [article, setArticle] = useState<any>(null);
  const [relatedArticles, setRelatedArticles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [readingProgress, setReadingProgress] = useState(0);
  const [tableOfContents, setTableOfContents] = useState<Array<{id: string, text: string, level: number}>>([]);
  const [userFeedback, setUserFeedback] = useState<1 | -1 | null>(null);
  const [feedbackComment, setFeedbackComment] = useState('');
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [activeSection, setActiveSection] = useState<string>('');
  const [steps, setSteps] = useState<StepData[]>([]);

  useEffect(() => {
    const loadArticle = async () => {
      if (!id) {
        setError('Article ID not provided');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const articleData = await DatabaseService.getKnowledgeArticleById(id);
        setArticle(articleData);
        
        // Increment view count (skip error if RPC doesn't exist)
        try {
          await DatabaseService.incrementArticleViewCount(id);
        } catch (error) {
          console.warn('Could not increment view count:', error);
        }

        // Load related articles
        if (articleData.knowledge_category?.id) {
          const related = await DatabaseService.getEnhancedKnowledgeArticles({
            status: 'published',
            categoryId: articleData.knowledge_category.id,
            limit: 5
          });
          setRelatedArticles(related.filter(a => a.id !== id));
        }
      } catch (err: any) {
        console.error('Error loading article:', err);
        setError('Article not found or failed to load');
      } finally {
        setLoading(false);
      }
    };

    loadArticle();
  }, [id]);

  // Generate table of contents and steps from content
  useEffect(() => {
    if (article?.content) {
      const headings = [];
      const stepsList = [];
      const content = article.content;
      
      // Find markdown-style headings
      const headingRegex = /^(#{1,6})\s+(.+)$/gm;
      let match;
      
      while ((match = headingRegex.exec(content)) !== null) {
        const level = match[1].length;
        const text = match[2].trim();
        const id = text.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        headings.push({ id, text, level });
        
        // Extract steps if they look like step titles
        if (text.toLowerCase().includes('step') || /^\d+\./.test(text)) {
          const stepContent = extractStepContent(content, match.index);
          const icon = getStepIcon(text);
          stepsList.push({
            title: text,
            content: stepContent,
            icon,
            expanded: stepsList.length === 0 // First step expanded by default
          });
        }
      }
      
      setTableOfContents(headings);
      setSteps(stepsList);
    }
  }, [article]);

  const extractStepContent = (content: string, headingIndex: number) => {
    // Extract content between this heading and the next heading
    const afterHeading = content.slice(headingIndex);
    const nextHeadingMatch = afterHeading.slice(1).match(/^#{1,6}\s+/m);
    const endIndex = nextHeadingMatch ? nextHeadingMatch.index + 1 : afterHeading.length;
    return afterHeading.slice(0, endIndex).split('\n').slice(1).join('\n').trim();
  };

  const getStepIcon = (title: string) => {
    const lower = title.toLowerCase();
    if (lower.includes('form') || lower.includes('fill')) return '📝';
    if (lower.includes('security') || lower.includes('password')) return '🔒';
    if (lower.includes('submit') || lower.includes('send')) return '📤';
    if (lower.includes('verify') || lower.includes('check')) return '✅';
    if (lower.includes('create') || lower.includes('new')) return '➕';
    if (lower.includes('contact') || lower.includes('help')) return '💬';
    return '📋';
  };

  // Enhanced reading progress tracker with section highlighting
  useEffect(() => {
    const handleScroll = () => {
      if (contentRef.current) {
        const element = contentRef.current;
        const totalHeight = element.scrollHeight - window.innerHeight;
        const progress = (window.scrollY / totalHeight) * 100;
        setReadingProgress(Math.min(Math.max(progress, 0), 100));
        
        // Show back to top button
        setShowBackToTop(window.scrollY > 400);
        
        // Update active section
        const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
        let currentSection = '';
        
        headings.forEach((heading) => {
          const rect = heading.getBoundingClientRect();
          if (rect.top <= 100) {
            currentSection = heading.id;
          }
        });
        
        setActiveSection(currentSection);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleFeedback = async (rating: 1 | -1) => {
    if (!article?.id) return;
    
    if (rating === -1) {
      setShowFeedbackForm(true);
      return;
    }
    
    try {
      await DatabaseService.submitArticleFeedback({
        article_id: article.id,
        rating,
        feedback_text: feedbackComment,
        is_anonymous: true
      });
      
      setUserFeedback(rating);
      
      setArticle((prev: any) => ({
        ...prev,
        helpful_count: rating === 1 ? (prev.helpful_count || 0) + 1 : prev.helpful_count,
        not_helpful_count: rating === -1 ? (prev.not_helpful_count || 0) + 1 : prev.not_helpful_count
      }));

      toast.success("Thank you for your feedback! 🎉", {
        description: "Your feedback helps us improve our documentation"
      });
    } catch (error) {
      console.error('Error submitting feedback:', error);
      toast.error("Failed to submit feedback");
    }
  };

  const handleNegativeFeedback = async () => {
    if (!article?.id) return;
    
    try {
      await DatabaseService.submitArticleFeedback({
        article_id: article.id,
        rating: -1,
        feedback_text: feedbackComment,
        is_anonymous: true
      });
      
      setUserFeedback(-1);
      setShowFeedbackForm(false);
      setFeedbackComment('');
      
      setArticle((prev: any) => ({
        ...prev,
        not_helpful_count: (prev.not_helpful_count || 0) + 1
      }));

      toast.success("Thank you for your feedback! We'll use it to improve this article.", {
        description: "Your suggestions help us create better documentation"
      });
    } catch (error) {
      console.error('Error submitting feedback:', error);
      toast.error("Failed to submit feedback");
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: article.title,
          text: article.excerpt,
          url: window.location.href,
        });
      } catch (error) {
        console.log('Error sharing:', error);
      }
    } else {
      await navigator.clipboard.writeText(window.location.href);
      toast.success("Link copied to clipboard! 📋");
    }
  };

  const handleCopyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedText(label);
      toast.success(`${label} copied to clipboard!`);
      setTimeout(() => setCopiedText(null), 2000);
    } catch (error) {
      toast.error("Failed to copy to clipboard");
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const toggleStep = (index: number) => {
    setSteps(prev => prev.map((step, i) => 
      i === index ? { ...step, expanded: !step.expanded } : step
    ));
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
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
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white dark:from-gray-900 dark:to-gray-800">
        <div className="fixed top-0 left-0 right-0 z-50">
          <Progress value={0} className="h-1 rounded-none bg-blue-100 dark:bg-blue-900" />
        </div>
        
        <div className="max-w-7xl mx-auto p-6 pt-8">
          <Skeleton className="h-10 w-32 mb-6" />
          
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            <div className="lg:col-span-1">
              <Card>
                <CardHeader>
                  <Skeleton className="h-6 w-32" />
                </CardHeader>
                <CardContent className="space-y-3">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-5/6" />
                </CardContent>
              </Card>
            </div>
            
            <div className="lg:col-span-3 space-y-6">
            <Card>
              <CardHeader className="space-y-4">
                <Skeleton className="h-8 w-3/4" />
                <div className="flex gap-2">
                  <Skeleton className="h-6 w-20" />
                  <Skeleton className="h-6 w-24" />
                </div>
                <div className="flex gap-4">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-28" />
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </CardContent>
            </Card>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !article) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white dark:from-gray-900 dark:to-gray-800">
        <div className="max-w-4xl mx-auto p-6">
          <Button 
            variant="ghost" 
            onClick={() => navigate('/knowledge')}
            className="mb-6 hover:bg-white dark:hover:bg-gray-800 hover:shadow-md transition-all"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Knowledge Base
          </Button>
          
          <Card className="border-0 shadow-xl">
            <CardContent className="text-center py-16">
              <div className="w-24 h-24 mx-auto mb-6 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
                <BookOpen className="h-12 w-12 text-gray-400" />
              </div>
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
                Article Not Found
              </h2>
              <p className="text-lg text-gray-600 dark:text-gray-400 mb-8 max-w-md mx-auto">
                {error || 'The article you\'re looking for doesn\'t exist or has been removed.'}
              </p>
              <div className="flex gap-4 justify-center">
                <Button onClick={() => navigate('/knowledge')} size="lg">
                  <Home className="h-4 w-4 mr-2" />
                  Back to Knowledge Base
                </Button>
                <Button variant="outline" size="lg" onClick={() => window.history.back()}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Go Back
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white dark:from-gray-900 dark:to-gray-800">
      {/* Enhanced Reading Progress with Gradient */}
      <div className="fixed top-0 left-0 right-0 z-50">
        <div className="relative">
          <Progress 
            value={readingProgress} 
            className="h-1 rounded-none bg-blue-100 dark:bg-blue-900"
          />
          <div 
            className="absolute top-0 left-0 h-1 bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-300"
            style={{ width: `${readingProgress}%` }}
          />
        </div>
      </div>

      {/* Back to Top Button */}
      {showBackToTop && (
        <Button
          onClick={scrollToTop}
          className="fixed bottom-6 right-6 z-40 rounded-full p-3 shadow-lg hover:shadow-xl transition-all duration-300 bg-blue-600 hover:bg-blue-700"
          size="sm"
        >
          <ArrowUp className="h-4 w-4" />
        </Button>
      )}

      {/* Mobile Help Button */}
      <div className="fixed bottom-6 left-6 z-40 lg:hidden">
        <Button
          onClick={() => navigate('/tickets')}
          className="rounded-full p-3 shadow-lg hover:shadow-xl transition-all duration-300 bg-green-600 hover:bg-green-700"
          size="sm"
        >
          <HelpCircle className="h-4 w-4" />
        </Button>
      </div>

      <div className="max-w-7xl mx-auto p-4 lg:p-6 pt-8">
        {/* Enhanced Navigation with Better Breadcrumbs */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-8 gap-4">
          <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
              onClick={() => navigate('/knowledge')}
              className="hover:bg-white dark:hover:bg-gray-800 hover:shadow-md transition-all"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Back to Knowledge Base</span>
              <span className="sm:hidden">Back</span>
          </Button>
            
            {/* Enhanced Breadcrumbs */}
            <div className="hidden sm:flex items-center gap-2 ml-4 text-sm">
              <div className="px-3 py-1 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 rounded-full">
                Knowledge Base
              </div>
              <ChevronRight className="h-4 w-4 text-gray-400" />
              {article.knowledge_category && (
                <>
                  <div className="px-3 py-1 bg-purple-50 dark:bg-purple-950 text-purple-700 dark:text-purple-300 rounded-full">
                    {article.knowledge_category.name}
                  </div>
                  <ChevronRight className="h-4 w-4 text-gray-400" />
                </>
              )}
              <span className="text-gray-600 dark:text-gray-400 font-medium">Article</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleShare} className="hover:shadow-md transition-all">
              <Share2 className="h-4 w-4 mr-2" />
              Share
            </Button>
            <Button variant="outline" size="sm" onClick={handlePrint} className="hover:shadow-md transition-all">
              <Printer className="h-4 w-4 mr-2" />
              Print
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* Enhanced Sticky Table of Contents */}
          {tableOfContents.length > 0 && (
            <div className="lg:col-span-1 order-2 lg:order-1">
              <div className="sticky top-8 space-y-6">
                <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <Hash className="h-4 w-4 text-blue-600" />
                      Table of Contents
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <nav className="space-y-1">
                      {tableOfContents.map((heading) => (
                        <a
                          key={heading.id}
                          href={`#${heading.id}`}
                          className={cn(
                            "block text-sm transition-all duration-200 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800",
                            activeSection === heading.id 
                              ? "bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-medium border-l-3 border-blue-500" 
                              : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white",
                            heading.level === 1 ? 'font-medium' : 
                            heading.level === 2 ? 'ml-3' : 'ml-6'
                          )}
                        >
                          {heading.text}
                        </a>
                      ))}
                    </nav>
                  </CardContent>
                </Card>

                {/* Agent Contact Panel */}
                <Card className="border-0 shadow-lg bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2 text-green-700 dark:text-green-300">
                      <MessageCircleIcon className="h-4 w-4" />
                      Need Help?
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0 space-y-3">
                    <p className="text-xs text-green-600 dark:text-green-400">
                      Can't find what you're looking for? Our support team is here to help!
                    </p>
                    
                    <div className="space-y-2">
                      <Button 
                        size="sm" 
                        className="w-full justify-start text-xs bg-green-600 hover:bg-green-700"
                        onClick={() => navigate('/tickets')}
                      >
                        <FileText className="h-3 w-3 mr-2" />
                        Create Ticket
                      </Button>
                      
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="w-full justify-start text-xs border-green-200 hover:bg-green-50 dark:border-green-800 dark:hover:bg-green-950"
                        onClick={() => handleCopyToClipboard('support@company.com', 'Email')}
                      >
                        <Mail className="h-3 w-3 mr-2" />
                        Email Support
                      </Button>
                      
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="w-full justify-start text-xs border-green-200 hover:bg-green-50 dark:border-green-800 dark:hover:bg-green-950"
                        onClick={() => navigate('/tickets?urgent=true')}
                      >
                        <Phone className="h-3 w-3 mr-2" />
                        Urgent Reset
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {/* Enhanced Main Content */}
          <div className={cn(
            "order-1 lg:order-2",
            tableOfContents.length > 0 ? 'lg:col-span-4' : 'lg:col-span-5'
          )}>
            <article ref={contentRef} className="space-y-8">
              {/* Enhanced Article Header */}
              <Card className="border-0 shadow-xl bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900">
                <CardHeader className="space-y-6 p-8">
                  {/* Enhanced Badges */}
                  <div className="flex flex-wrap gap-3">
                    {article.featured && (
                      <Badge className="bg-gradient-to-r from-yellow-400 to-orange-400 text-white border-0 px-3 py-1">
                        <Star className="h-3 w-3 mr-1" />
                        Featured
                      </Badge>
                    )}
                    {article.knowledge_category && (
                      <Badge 
                        variant="outline"
                        className="px-3 py-1 font-medium"
                        style={{ 
                          backgroundColor: article.knowledge_category.color + '20',
                          borderColor: article.knowledge_category.color,
                          color: article.knowledge_category.color
                        }}
                      >
                        <TagIcon className="h-3 w-3 mr-1" />
                        {article.knowledge_category.name}
                      </Badge>
                    )}
                    {article.status && (
                      <Badge variant={article.status === 'published' ? 'default' : 'secondary'} className="px-3 py-1">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        {article.status.charAt(0).toUpperCase() + article.status.slice(1)}
                      </Badge>
                    )}
                  </div>

                  {/* Enhanced Title with Better Typography */}
                  <div>
                    <h1 className="text-4xl lg:text-5xl font-bold text-gray-900 dark:text-white leading-tight mb-6 tracking-tight">
                      {article.title}
                    </h1>
                    
                    {article.excerpt && (
                      <p className="text-xl lg:text-2xl text-gray-600 dark:text-gray-300 leading-relaxed font-light">
                        {article.excerpt}
                      </p>
                    )}
                  </div>

                  {/* Enhanced Metadata with Icons */}
                  <div className="flex flex-wrap items-center gap-6 text-sm text-gray-500 border-t pt-6 bg-gray-50 dark:bg-gray-800 -mx-8 px-8 -mb-8 pb-8 rounded-b-lg">
                    {article.author && (
                      <div className="flex items-center gap-2 bg-white dark:bg-gray-700 px-3 py-2 rounded-full">
                        <User className="h-4 w-4" />
                        <span>By <strong className="text-gray-900 dark:text-white">{article.author.full_name}</strong></span>
                      </div>
                    )}
                    
                    <div className="flex items-center gap-2 bg-white dark:bg-gray-700 px-3 py-2 rounded-full">
                      <Calendar className="h-4 w-4" />
                      <span>Updated {formatDate(article.updated_at || article.created_at)}</span>
                    </div>
                    
                    <div className="flex items-center gap-2 bg-white dark:bg-gray-700 px-3 py-2 rounded-full">
                      <Eye className="h-4 w-4" />
                      <span>{(article.view_count || 0) + 1} views</span>
                    </div>

                    <div className="flex items-center gap-2 bg-white dark:bg-gray-700 px-3 py-2 rounded-full">
                      <Clock className="h-4 w-4" />
                      <span>
                        {article.reading_time_minutes || getReadingTime(article.content)} min read
                      </span>
                    </div>
                  </div>
                </CardHeader>
              </Card>

              {/* Collapsible Step-by-Step Guide */}
              {steps.length > 0 && (
                <Card className="border-0 shadow-xl">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-xl">
                      <Lightbulb className="h-5 w-5 text-yellow-500" />
                      Step-by-Step Guide
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {steps.map((step, index) => (
                      <Collapsible 
                        key={index} 
                        open={step.expanded} 
                        onOpenChange={() => toggleStep(index)}
                      >
                        <CollapsibleTrigger className="w-full">
                          <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950 dark:to-purple-950 rounded-lg hover:shadow-md transition-all">
                            <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-sm">
                              {index + 1}
                            </div>
                            <div className="flex-1 text-left">
                              <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                                <span className="text-lg">{step.icon}</span>
                                {step.title}
                              </h3>
                            </div>
                            <ChevronDown className={cn(
                              "h-5 w-5 text-gray-500 transition-transform duration-200",
                              step.expanded && "rotate-180"
                            )} />
                          </div>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="mt-4 p-6 bg-white dark:bg-gray-800 rounded-lg border-l-4 border-blue-500">
                            <div 
                              className="prose prose-lg dark:prose-invert max-w-none"
                              dangerouslySetInnerHTML={{ __html: step.content.replace(/\n/g, '<br />') }}
                            />
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Enhanced Article Content with Better Typography */}
              <Card className="border-0 shadow-xl">
                <CardContent className="p-8 lg:p-12">
                  <div className="prose prose-lg lg:prose-xl prose-gray dark:prose-invert max-w-none prose-headings:scroll-mt-8">
                    <div 
                      dangerouslySetInnerHTML={{ 
                        __html: article.content
                          .replace(/\n/g, '<br />')
                          .replace(/^(#{1,6})\s+(.+)$/gm, (match, hashes, text) => {
                            const level = hashes.length;
                            const id = text.toLowerCase().replace(/[^a-z0-9]+/g, '-');
                            return `
                              <div class="section-divider my-8 first:mt-0">
                                <h${level} id="${id}" class="scroll-mt-8 flex items-center gap-3 group">
                                  ${getHeaderIcon(text)}
                                  ${text}
                                  <button onclick="navigator.clipboard.writeText('${window.location.origin}${window.location.pathname}#${id}')" class="opacity-0 group-hover:opacity-100 transition-opacity ml-2 text-gray-400 hover:text-gray-600">
                                    <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
                                    </svg>
                                  </button>
                                </h${level}>
                              </div>
                            `;
                          })
                          // Add copy buttons to code blocks
                          .replace(/```([^`]+)```/g, (match, code) => `
                            <div class="relative group">
                              <pre class="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg overflow-x-auto"><code>${code}</code></pre>
                              <button onclick="navigator.clipboard.writeText('${code.trim()}')" class="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-gray-800 text-white p-2 rounded text-xs hover:bg-gray-700">
                                Copy
                              </button>
                            </div>
                          `)
                      }} 
                    />
                  </div>

                  {/* Enhanced Tags Section */}
                  {article.tags && article.tags.length > 0 && (
                    <div className="mt-12 pt-8 border-t border-gray-200 dark:border-gray-700">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                        <TagIcon className="h-5 w-5 text-blue-600" />
                        Related Topics
                      </h3>
                      <div className="flex flex-wrap gap-3">
                        {article.tags.map((tag: string, index: number) => (
                          <Badge 
                            key={index} 
                            variant="secondary" 
                            className="px-3 py-1 hover:bg-gray-200 dark:hover:bg-gray-700 cursor-pointer transition-colors"
                            onClick={() => navigate(`/knowledge?tag=${encodeURIComponent(tag)}`)}
                          >
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Enhanced Feedback Section */}
              <Card className="border-0 shadow-xl bg-gradient-to-br from-gray-50 to-white dark:from-gray-800 dark:to-gray-900">
                <CardContent className="p-8">
                  <div className="text-center">
                    <div className="w-16 h-16 mx-auto mb-4 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                      <ThumbsUp className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                    </div>
                    <h3 className="text-2xl font-bold mb-2 text-gray-900 dark:text-white">Was this article helpful?</h3>
                    <p className="text-gray-600 dark:text-gray-400 mb-8 max-w-md mx-auto">
                      Your feedback helps us improve our documentation and create better resources for everyone
                    </p>
                    
                    {!userFeedback && !showFeedbackForm && (
                    <div className="flex items-center justify-center gap-4">
                      <Button
                        size="lg"
                        onClick={() => handleFeedback(1)}
                          className="flex items-center gap-3 bg-green-600 hover:bg-green-700 px-8 py-3"
                      >
                        <ThumbsUp className="h-5 w-5" />
                          Yes, helpful ({article.helpful_count || 0})
                      </Button>
                      
                      <Button
                          variant="outline"
                        size="lg"
                        onClick={() => handleFeedback(-1)}
                          className="flex items-center gap-3 px-8 py-3 hover:bg-red-50 dark:hover:bg-red-950 hover:border-red-300 dark:hover:border-red-700"
                      >
                        <ThumbsDown className="h-5 w-5" />
                        Not helpful ({article.not_helpful_count || 0})
                      </Button>
                    </div>
                    )}

                    {showFeedbackForm && (
                      <div className="max-w-md mx-auto space-y-4">
                        <Textarea
                          placeholder="Help us improve! What information were you looking for that you couldn't find?"
                          value={feedbackComment}
                          onChange={(e) => setFeedbackComment(e.target.value)}
                          className="min-h-[100px]"
                        />
                        <div className="flex gap-3">
                          <Button onClick={handleNegativeFeedback} disabled={!feedbackComment.trim()}>
                            Submit Feedback
                          </Button>
                          <Button variant="outline" onClick={() => setShowFeedbackForm(false)}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}

                    {userFeedback && (
                      <div className="bg-green-50 dark:bg-green-950 p-6 rounded-lg border border-green-200 dark:border-green-800">
                        <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400 mx-auto mb-2" />
                        <p className="text-green-700 dark:text-green-300 font-medium">
                          Thank you for your feedback! 🎉
                        </p>
                        <p className="text-green-600 dark:text-green-400 text-sm mt-1">
                          {userFeedback === 1 
                            ? "We're glad this article was helpful!" 
                            : "We'll use your feedback to improve this article."
                          }
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Enhanced Related Articles */}
              {relatedArticles.length > 0 && (
                <Card className="border-0 shadow-xl">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-xl">
                      <BookOpen className="h-5 w-5 text-purple-600" />
                      Related Articles
                    </CardTitle>
                    <p className="text-gray-600 dark:text-gray-400">
                      Explore more articles in the {article.knowledge_category?.name} category
                    </p>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {relatedArticles.map((relatedArticle) => (
                        <div
                          key={relatedArticle.id}
                          className="group p-6 rounded-xl border-0 bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 hover:shadow-xl cursor-pointer transition-all duration-300 hover:scale-105"
                          onClick={() => navigate(`/knowledge/${relatedArticle.id}`)}
                        >
                          <div className="flex items-start justify-between mb-3">
                            <h4 className="font-semibold text-lg leading-tight line-clamp-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                            {relatedArticle.title}
                          </h4>
                            <ExternalLink className="h-4 w-4 text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 flex-shrink-0 ml-2 opacity-0 group-hover:opacity-100 transition-all" />
                          </div>
                          
                          {relatedArticle.excerpt && (
                            <p className="text-gray-600 dark:text-gray-400 line-clamp-3 mb-4 text-sm leading-relaxed">
                              {relatedArticle.excerpt}
                            </p>
                          )}
                          
                          <div className="flex items-center justify-between text-xs text-gray-500">
                            <div className="flex items-center gap-4">
                            <div className="flex items-center gap-1">
                              <Eye className="h-3 w-3" />
                              {relatedArticle.view_count || 0}
                            </div>
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {relatedArticle.reading_time_minutes || getReadingTime(relatedArticle.content)} min
                            </div>
                            </div>
                            {relatedArticle.featured && (
                              <Badge variant="secondary" className="text-xs">
                                <Star className="h-2 w-2 mr-1" />
                                Featured
                              </Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </article>
          </div>
        </div>
      </div>
    </div>
  );

  function getHeaderIcon(text: string) {
    const lower = text.toLowerCase();
    if (lower.includes('step')) return '<span class="text-blue-600">📋</span>';
    if (lower.includes('security')) return '<span class="text-red-600">🔒</span>';
    if (lower.includes('important') || lower.includes('note')) return '<span class="text-yellow-600">⚠️</span>';
    if (lower.includes('tip')) return '<span class="text-green-600">💡</span>';
    return '<span class="text-gray-600">📄</span>';
  }
}; 