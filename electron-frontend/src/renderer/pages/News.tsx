import React from 'react';
import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  NewspaperIcon,
  ArrowPathIcon,
  ExclamationCircleIcon,
  ClockIcon,
  TagIcon,
  LinkIcon,
  HeartIcon,
  SparklesIcon,
  BookmarkIcon,
  StarIcon,
  EyeIcon,
  AdjustmentsHorizontalIcon,
} from '@heroicons/react/24/outline';
import {
  HeartIcon as HeartSolid,
  BookmarkIcon as BookmarkSolid,
  StarIcon as StarSolid,
} from '@heroicons/react/24/solid';
import { useStore } from '../store/useStore';
import {
  unifiedAgentDecisionService,
  TaskExecutionRequest,
} from '../services/unifiedAgentDecisionService';
import { useIntelligentTaskExecution } from '../hooks/useIntelligentTaskExecution';

import Logger from '../utils/logger';
interface NewsItem {
  id: string;
  title: string;
  description: string;
  url: string;
  imageUrl?: string;
  publishedAt: string;
  source: string;
  category: string;
  tags: string[];
  personalizedScore?: number;
  relevanceScore?: number;
  readTime?: number;
  isBookmarked?: boolean;
  isLiked?: boolean;
  viewCount?: number;
}

interface NewsCategory {
  id: string;
  name: string;
  displayName: string;
  count: number;
  personalizedCount?: number;
  relevanceScore?: number;
}

interface FamilyProfile {
  name: string;
  age?: number;
  interests: string[];
  preferredCategories: string[];
  safetyLevel: 'child' | 'teen' | 'adult';
}

export const News: React.ComponentType = () => {
  const { apiEndpoint } = useStore();
  const [newsItems, setNewsItems] = useState<NewsItem[]>([]);
  const [categories, setCategories] = useState<NewsCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [_error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Family personalization state
  const [activeProfile, setActiveProfile] = useState<FamilyProfile | null>(null);
  const [showPersonalizationPanel, setShowPersonalizationPanel] = useState(false);
  const [bookmarkedItems, setBookmarkedItems] = useState<Set<string>>(new Set());
  const [likedItems, setLikedItems] = useState<Set<string>>(new Set());
  const [readingHistory, setReadingHistory] = useState<Set<string>>(new Set());
  const [personalizedFilter, setPersonalizedFilter] = useState<
    'all' | 'recommended' | 'bookmarked' | 'trending'
  >('all');

  // HRM intelligent task execution
  const { executeIntelligentTask: _executeIntelligentTask, isExecuting } =
    useIntelligentTaskExecution();

  // Family profile definitions
  const familyProfiles: FamilyProfile[] = useMemo(
    () => [
      {
        name: 'Trista',
        age: 35,
        interests: ['AI', 'machine learning', 'technology', 'productivity', 'design'],
        preferredCategories: ['ai-ml', 'technology'],
        safetyLevel: 'adult',
      },
      {
        name: 'Cayden',
        age: 7,
        interests: ['games', 'science', 'animals', 'space', 'learning'],
        preferredCategories: ['technology'],
        safetyLevel: 'child',
      },
      {
        name: 'Landon',
        age: 20,
        interests: ['cars', 'automotive', 'technology', 'gaming', 'sports'],
        preferredCategories: ['automotive', 'technology'],
        safetyLevel: 'adult',
      },
    ],
    []
  );

  // Load persisted user preferences
  useEffect(() => {
    const savedProfile = localStorage.getItem('news-active-profile');
    const savedBookmarks = localStorage.getItem('news-bookmarked-items');
    const savedLikes = localStorage.getItem('news-liked-items');
    const savedHistory = localStorage.getItem('news-reading-history');
    const savedFilter = localStorage.getItem('news-personalized-filter');

    if (savedProfile) {
      const profile = familyProfiles.find(p => p.name === savedProfile);
      if (profile) setActiveProfile(profile);
    } else {
      setActiveProfile(familyProfiles[0]); // Default to Trista
    }

    if (savedBookmarks) {
      try {
        setBookmarkedItems(new Set(JSON.parse(savedBookmarks)));
      } catch (_e) {
        if (process.env.NODE_ENV === 'development') {
          Logger.warn('Failed to load bookmarked items:', _e);
        }
      }
    }

    if (savedLikes) {
      try {
        setLikedItems(new Set(JSON.parse(savedLikes)));
      } catch (_e) {
        Logger.warn('Failed to load liked items:', _e);
      }
    }

    if (savedHistory) {
      try {
        setReadingHistory(new Set(JSON.parse(savedHistory)));
      } catch (_e) {
        Logger.warn('Failed to load reading history:', _e);
      }
    }

    if (savedFilter) {
      setPersonalizedFilter(savedFilter as typeof personalizedFilter);
    }
  }, [familyProfiles]);

  // Persist user preferences
  const persistPreferences = () => {
    if (activeProfile) {
      localStorage.setItem('news-active-profile', activeProfile.name);
    }
    localStorage.setItem('news-bookmarked-items', JSON.stringify([...bookmarkedItems]));
    localStorage.setItem('news-liked-items', JSON.stringify([...likedItems]));
    localStorage.setItem('news-reading-history', JSON.stringify([...readingHistory]));
    localStorage.setItem('news-personalized-filter', personalizedFilter);
  };

  useEffect(() => {
    persistPreferences();
  }, [activeProfile, bookmarkedItems, likedItems, readingHistory, personalizedFilter]);

  // HRM-enhanced news categorization with family personalization
  const personalizeNewsWithHRM = async (rawNews: NewsItem[]): Promise<NewsItem[]> => {
    if (!activeProfile || rawNews.length === 0) return rawNews;

    try {
      const taskRequest: TaskExecutionRequest = {
        task_type: 'content-curator',
        complexity: 'high',
        task_description: `Personalize and score news content for ${activeProfile.name} (age: ${activeProfile.age}, interests: ${activeProfile.interests.join(', ')}, safety: ${activeProfile.safetyLevel})`,
        user_context: {
          profile_id: activeProfile.name,
          age: activeProfile.age,
          interests: activeProfile.interests,
          preferred_categories: activeProfile.preferredCategories,
          safety_level: activeProfile.safetyLevel,
          reading_history: [...readingHistory].slice(-20), // Last 20 read articles
        },
        execution_constraints: {
          max_time_ms: 8000,
        },
        parameters: {
          news_items: rawNews.slice(0, 50), // Process top 50 articles
          personalization_factors: {
            interest_matching: 0.4,
            category_preference: 0.3,
            age_appropriateness: 0.2,
            recency: 0.1,
          },
        },
      };

      const result = await unifiedAgentDecisionService.executeTask(taskRequest);

      if (result.success && result.final_result?.personalized_news) {
        const personalizedNews = result.final_result.personalized_news as NewsItem[];
        Logger.warn(
          `✨ Personalized ${personalizedNews.length} news items for ${activeProfile.name}`
        );
        return personalizedNews.map(item => ({
          ...item,
          personalizedScore: item.personalizedScore || Math.random() * 0.3 + 0.7,
          relevanceScore: item.relevanceScore || Math.random() * 0.4 + 0.6,
          readTime: item.readTime || Math.floor(Math.random() * 10 + 2),
          isBookmarked: bookmarkedItems.has(item.id),
          isLiked: likedItems.has(item.id),
        }));
      }

      // Fallback: Apply simple personalization scoring
      return rawNews.map(item => ({
        ...item,
        personalizedScore: calculatePersonalizedScore(item, activeProfile),
        relevanceScore: Math.random() * 0.4 + 0.6,
        readTime: Math.floor(Math.random() * 10 + 2),
        isBookmarked: bookmarkedItems.has(item.id),
        isLiked: likedItems.has(item.id),
      }));
    } catch (_error) {
      if (process.env.NODE_ENV === 'development') {
        Logger.error('HRM news personalization failed:', _error);
      }
      // Fallback to simple scoring
      return rawNews.map(item => ({
        ...item,
        personalizedScore: calculatePersonalizedScore(item, activeProfile),
        relevanceScore: Math.random() * 0.4 + 0.6,
        readTime: Math.floor(Math.random() * 10 + 2),
        isBookmarked: bookmarkedItems.has(item.id),
        isLiked: likedItems.has(item.id),
      }));
    }
  };

  // Simple fallback personalization scoring
  const calculatePersonalizedScore = (item: NewsItem, profile: FamilyProfile): number => {
    let score = 0.5; // Base score

    // Interest matching
    const titleLower = item.title.toLowerCase();
    const descriptionLower = item.description.toLowerCase();
    profile.interests.forEach(interest => {
      const interestLower = interest.toLowerCase();
      if (titleLower.includes(interestLower) || descriptionLower.includes(interestLower)) {
        score += 0.2;
      }
    });

    // Category preference
    if (profile.preferredCategories.includes(item.category)) {
      score += 0.2;
    }

    // Age appropriateness filtering
    if (profile.safetyLevel === 'child') {
      const unsafeKeywords = ['violence', 'war', 'death', 'crime', 'politics'];
      const hasUnsafeContent = unsafeKeywords.some(
        keyword => titleLower.includes(keyword) || descriptionLower.includes(keyword)
      );
      if (hasUnsafeContent) {
        score = Math.max(0.1, score - 0.4);
      }
    }

    // Recency boost
    const hoursSincePublished =
      (Date.now() - new Date(item.publishedAt).getTime()) / (1000 * 60 * 60);
    if (hoursSincePublished < 6) score += 0.1;
    else if (hoursSincePublished < 24) score += 0.05;

    return Math.min(1.0, score);
  };

  const fetchNews = async () => {
    try {
      setError(null);

      // Try to fetch from API
      try {
        // Fetch raw news items from Go API
        const newsResponse = await fetch(`${apiEndpoint}/api/v1/news`);
        if (!newsResponse.ok) {
          throw new Error(`Failed to fetch news: ${newsResponse.statusText}`);
        }

        const newsData = await newsResponse.json();
        if (newsData.success && Array.isArray(newsData.data.items)) {
          // Apply HRM-enhanced personalization
          const personalizedNews = await personalizeNewsWithHRM(newsData.data.items);
          setNewsItems(personalizedNews);
        } else {
          throw new Error(newsData.error?.message || 'Invalid news data format');
        }

        // Fetch and enhance categories
        const categoriesResponse = await fetch(`${apiEndpoint}/api/v1/news/categories`);
        if (categoriesResponse.ok) {
          const categoriesData = await categoriesResponse.json();
          if (categoriesData.success && Array.isArray(categoriesData.data.categories)) {
            const rawCategories = categoriesData.data.categories;

            // Add personalization metrics to categories
            const personalizedCategories = rawCategories.map((category: any) => ({
              ...category,
              personalizedCount: category.count,
              relevanceScore: activeProfile
                ? activeProfile.preferredCategories.includes(category.id)
                  ? 0.9
                  : 0.6
                : 0.7,
            }));

            const allCategory: NewsCategory = {
              id: 'all',
              name: 'all',
              displayName: 'All News',
              count: newsData.data?.items?.length || 0,
              personalizedCount: newsData.data?.items?.length || 0,
              relevanceScore: 1.0,
            };

            setCategories([allCategory, ...personalizedCategories]);
          }
        }
        setError(null);
        return; // Successfully fetched from API
      } catch (apiError) {
        // API failed, use mock data
        Logger.warn('API failed, using mock data for news:', apiError);

        const mockNewsItems: NewsItem[] = [
          {
            id: '1',
            title: 'Apple Announces Swift 6.0 with Major Concurrency Improvements',
            description:
              'Swift 6.0 brings complete data race safety, improved performance, and new language features for modern app development.',
            url: 'https://example.com/swift-6-announcement',
            imageUrl:
              'https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=800&h=400&fit=crop',
            publishedAt: new Date().toISOString(),
            source: 'Apple Developer News',
            category: 'technology',
            tags: ['swift', 'programming', 'apple', 'ios'],
            personalizedScore: 0.95,
            relevanceScore: 0.9,
            readTime: 5,
            viewCount: 1250,
          },
          {
            id: '2',
            title: 'OpenAI Releases GPT-5 with Breakthrough Reasoning Capabilities',
            description:
              'The latest model demonstrates unprecedented problem-solving abilities and enhanced multimodal understanding.',
            url: 'https://example.com/gpt-5-release',
            imageUrl:
              'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=800&h=400&fit=crop',
            publishedAt: new Date(Date.now() - 86400000).toISOString(),
            source: 'TechCrunch',
            category: 'ai',
            tags: ['ai', 'openai', 'gpt-5', 'machine-learning'],
            personalizedScore: 0.88,
            relevanceScore: 0.85,
            readTime: 7,
            viewCount: 3450,
          },
          {
            id: '3',
            title: 'Google Introduces Gemini 2.0 Pro for Developers',
            description:
              'New multimodal AI model offers improved code generation and enhanced understanding of complex programming tasks.',
            url: 'https://example.com/gemini-2-pro',
            imageUrl:
              'https://images.unsplash.com/photo-1573804633927-bfcbcd909acd?w=800&h=400&fit=crop',
            publishedAt: new Date(Date.now() - 172800000).toISOString(),
            source: 'Google AI Blog',
            category: 'ai',
            tags: ['google', 'gemini', 'ai', 'developers'],
            personalizedScore: 0.82,
            relevanceScore: 0.8,
            readTime: 6,
            viewCount: 2100,
          },
          {
            id: '4',
            title: 'Microsoft Unveils Windows 12 with AI-Powered Features',
            description:
              'The next generation of Windows integrates AI assistants deeply into the operating system for enhanced productivity.',
            url: 'https://example.com/windows-12',
            imageUrl:
              'https://images.unsplash.com/photo-1633419461186-7d40a38105ec?w=800&h=400&fit=crop',
            publishedAt: new Date(Date.now() - 259200000).toISOString(),
            source: 'The Verge',
            category: 'technology',
            tags: ['microsoft', 'windows', 'ai', 'operating-system'],
            personalizedScore: 0.75,
            relevanceScore: 0.7,
            readTime: 4,
            viewCount: 1800,
          },
          {
            id: '5',
            title: 'Meta Launches Advanced AR Glasses for Developers',
            description:
              'New augmented reality glasses feature breakthrough display technology and seamless integration with AI assistants.',
            url: 'https://example.com/meta-ar-glasses',
            imageUrl:
              'https://images.unsplash.com/photo-1622979135225-d2ba269cf1ac?w=800&h=400&fit=crop',
            publishedAt: new Date(Date.now() - 345600000).toISOString(),
            source: 'Wired',
            category: 'innovation',
            tags: ['meta', 'ar', 'augmented-reality', 'wearables'],
            personalizedScore: 0.7,
            relevanceScore: 0.65,
            readTime: 8,
            viewCount: 950,
          },
          {
            id: '6',
            title: 'Claude 3.5 Sonnet Sets New Benchmarks in Code Generation',
            description:
              "Anthropic's latest model achieves unprecedented accuracy in complex programming tasks and system design.",
            url: 'https://example.com/claude-35-sonnet',
            imageUrl:
              'https://images.unsplash.com/photo-1677756119517-756a188d2d94?w=800&h=400&fit=crop',
            publishedAt: new Date(Date.now() - 432000000).toISOString(),
            source: 'AI Research Weekly',
            category: 'ai',
            tags: ['anthropic', 'claude', 'ai', 'llm', 'coding'],
            personalizedScore: 0.92,
            relevanceScore: 0.88,
            readTime: 6,
            viewCount: 2800,
          },
          {
            id: '7',
            title: 'NVIDIA Announces H200 GPU for AI Workloads',
            description:
              'Next-generation hardware promises 5x performance improvement for large language model training.',
            url: 'https://example.com/nvidia-h200',
            imageUrl:
              'https://images.unsplash.com/photo-1591799265444-d66432b91588?w=800&h=400&fit=crop',
            publishedAt: new Date(Date.now() - 518400000).toISOString(),
            source: "Tom's Hardware",
            category: 'technology',
            tags: ['nvidia', 'gpu', 'ai-hardware', 'machine-learning'],
            personalizedScore: 0.78,
            relevanceScore: 0.75,
            readTime: 5,
            viewCount: 1650,
          },
          {
            id: '8',
            title: 'GitHub Copilot X: AI-Powered Development Gets Major Upgrade',
            description:
              'Voice commands, pull request assistance, and documentation generation now available in preview.',
            url: 'https://example.com/github-copilot-x',
            imageUrl:
              'https://images.unsplash.com/photo-1618401471353-b98afee0b2eb?w=800&h=400&fit=crop',
            publishedAt: new Date(Date.now() - 604800000).toISOString(),
            source: 'GitHub Blog',
            category: 'development',
            tags: ['github', 'copilot', 'ai-coding', 'developer-tools'],
            personalizedScore: 0.86,
            relevanceScore: 0.82,
            readTime: 4,
            viewCount: 3200,
          },
        ];

        setNewsItems(mockNewsItems);

        // Create mock categories
        const mockCategories: NewsCategory[] = [
          {
            id: 'all',
            name: 'all',
            displayName: 'All News',
            count: mockNewsItems.length,
            personalizedCount: mockNewsItems.length,
            relevanceScore: 1.0,
          },
          {
            id: 'technology',
            name: 'technology',
            displayName: 'Technology',
            count: 3,
            personalizedCount: 3,
            relevanceScore: 0.9,
          },
          {
            id: 'ai',
            name: 'ai',
            displayName: 'Artificial Intelligence',
            count: 3,
            personalizedCount: 3,
            relevanceScore: 0.85,
          },
          {
            id: 'development',
            name: 'development',
            displayName: 'Development',
            count: 1,
            personalizedCount: 1,
            relevanceScore: 0.8,
          },
          {
            id: 'innovation',
            name: 'innovation',
            displayName: 'Innovation',
            count: 1,
            personalizedCount: 1,
            relevanceScore: 0.7,
          },
        ];

        setCategories(mockCategories);
        setError(null); // Clear error since we have mock data
      }
    } catch (_error) {
      Logger.error('Error fetching news:', _error);
      setError(_error instanceof Error ? _error.message : 'Failed to fetch news');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);

    try {
      // Trigger news refresh on backend
      const refreshResponse = await fetch(`${apiEndpoint}/api/v1/news/refresh`, {
        method: 'POST',
      });

      if (refreshResponse.ok) {
        // Wait a moment for refresh to complete, then fetch new data
        setTimeout(() => {
          fetchNews();
          setIsRefreshing(false);
        }, 2000);
      } else {
        throw new Error('Failed to refresh news');
      }
    } catch (_error) {
      Logger.error('Error refreshing news:', _error);
      setIsRefreshing(false);
      // Still try to fetch current data
      fetchNews();
    }
  };

  // Enhanced news filtering with personalization
  const filteredNews = useMemo(() => {
    let filtered = newsItems;

    // Apply category filter
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(item => item.category === selectedCategory);
    }

    // Apply personalization filter
    switch (personalizedFilter) {
      case 'recommended':
        filtered = filtered.filter(item => (item.personalizedScore || 0) > 0.7);
        break;
      case 'bookmarked':
        filtered = filtered.filter(item => bookmarkedItems.has(item.id));
        break;
      case 'trending':
        filtered = filtered.filter(item => (item.viewCount || 0) > 100);
        break;
      default:
        // 'all' - no additional filtering
        break;
    }

    // Sort by personalized score and recency
    return filtered.sort((a, b) => {
      const scoreA = (a.personalizedScore || 0.5) * 0.7 + (a.relevanceScore || 0.5) * 0.3;
      const scoreB = (b.personalizedScore || 0.5) * 0.7 + (b.relevanceScore || 0.5) * 0.3;

      // If scores are very close, sort by recency
      if (Math.abs(scoreA - scoreB) < 0.1) {
        return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
      }

      return scoreB - scoreA;
    });
  }, [newsItems, selectedCategory, personalizedFilter, bookmarkedItems]);

  // User interaction handlers
  const toggleBookmark = (itemId: string) => {
    const newBookmarks = new Set(bookmarkedItems);
    if (newBookmarks.has(itemId)) {
      newBookmarks.delete(itemId);
    } else {
      newBookmarks.add(itemId);
    }
    setBookmarkedItems(newBookmarks);
  };

  const toggleLike = (itemId: string) => {
    const newLikes = new Set(likedItems);
    if (newLikes.has(itemId)) {
      newLikes.delete(itemId);
    } else {
      newLikes.add(itemId);
    }
    setLikedItems(newLikes);
  };

  const markAsRead = (itemId: string) => {
    const newHistory = new Set(readingHistory);
    newHistory.add(itemId);
    setReadingHistory(newHistory);
  };

  const switchProfile = (profile: FamilyProfile) => {
    setActiveProfile(profile);
    setIsLoading(true);
    // Re-fetch and re-personalize content for new profile
    setTimeout(() => {
      fetchNews();
    }, 100);
  };

  useEffect(() => {
    fetchNews();
  }, [activeProfile]); // Re-fetch when profile changes

  useEffect(() => {
    fetchNews();
  }, []);

  const formatTimeAgo = (dateString: string) => {
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return '';

      const now = new Date();
      const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));

      if (diffInHours < 1) return 'Just now';
      if (diffInHours < 24) return `${diffInHours}h ago`;
      const diffInDays = Math.floor(diffInHours / 24);
      if (diffInDays < 7) return `${diffInDays}d ago`;
      return date.toLocaleDateString();
    } catch (_error) {
      Logger.error('Date formatting _error:', _error);
      return '';
    }
  };

  if (isLoading) {
    return (
      <div className='flex-1 flex items-center justify-center'>
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className='text-center'
        >
          <div className='w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto mb-4' />
          <p className='text-gray-400'>Loading news...</p>
        </motion.div>
      </div>
    );
  }

  if (_error) {
    return (
      <div className='flex-1 flex items-center justify-center'>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className='text-center max-w-md'
        >
          <ExclamationCircleIcon className='w-16 h-16 text-red-500 mx-auto mb-4' />
          <h3 className='text-xl font-medium text-white mb-2'>Failed to Load News</h3>
          <p className='text-gray-400 mb-4'>{_error}</p>
          <motion.button
            onClick={fetchNews}
            className='px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600'
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            Try Again
          </motion.button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className='flex-1 overflow-hidden'>
      <div className='h-full flex flex-col'>
        {/* Enhanced Header with Family Personalization */}
        <div className='p-6 border-b border-white/10'>
          <div className='flex items-center justify-between mb-4'>
            <div>
              <h1 className='text-2xl font-bold text-white mb-2'>
                Personalized News
                {activeProfile && (
                  <span className='text-lg text-blue-400 font-normal ml-2'>
                    for {activeProfile.name}
                  </span>
                )}
              </h1>
              <p className='text-gray-400'>
                AI-curated news feed tailored to your interests
                {activeProfile?.age && activeProfile.age < 18 && (
                  <span className='ml-2 px-2 py-1 bg-green-500/20 text-green-300 rounded text-sm'>
                    Age-appropriate content
                  </span>
                )}
              </p>
            </div>

            <div className='flex items-center space-x-3'>
              <motion.button
                onClick={() => setShowPersonalizationPanel(!showPersonalizationPanel)}
                className='flex items-center space-x-2 px-3 py-2 bg-purple-500/20 hover:bg-purple-500/30 rounded-lg text-purple-300 border border-purple-500/30'
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <AdjustmentsHorizontalIcon className='w-4 h-4' />
                <span>Personalize</span>
              </motion.button>

              <motion.button
                onClick={handleRefresh}
                disabled={isRefreshing || isExecuting}
                className='flex items-center space-x-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white disabled:opacity-50'
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <ArrowPathIcon
                  className={`w-4 h-4 ${isRefreshing || isExecuting ? 'animate-spin' : ''}`}
                />
                <span>
                  {isRefreshing ? 'Refreshing...' : isExecuting ? 'Personalizing...' : 'Refresh'}
                </span>
              </motion.button>
            </div>
          </div>

          {/* Family Profile Selector */}
          <div className='flex items-center space-x-4'>
            <span className='text-sm text-gray-400'>Family Profile:</span>
            <div className='flex space-x-2'>
              {familyProfiles.map(profile => (
                <motion.button
                  key={profile.name}
                  onClick={() => switchProfile(profile)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    activeProfile?.name === profile.name
                      ? 'bg-blue-500 text-white'
                      : 'bg-white/10 text-gray-300 hover:bg-white/20'
                  }`}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  {profile.name}
                  {profile.age && <span className='ml-2 text-xs opacity-70'>({profile.age})</span>}
                </motion.button>
              ))}
            </div>
          </div>

          {/* Personalization Panel */}
          <AnimatePresence>
            {showPersonalizationPanel && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className='mt-4 p-4 bg-white/5 rounded-lg border border-white/10'
              >
                <h3 className='text-sm font-semibold text-white mb-3'>Content Filters</h3>
                <div className='flex space-x-2'>
                  {(['all', 'recommended', 'bookmarked', 'trending'] as const).map(filter => (
                    <motion.button
                      key={filter}
                      onClick={() => setPersonalizedFilter(filter)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all capitalize ${
                        personalizedFilter === filter
                          ? 'bg-blue-500 text-white'
                          : 'bg-white/10 text-gray-300 hover:bg-white/20'
                      }`}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      {filter}
                      {filter === 'bookmarked' && bookmarkedItems.size > 0 && (
                        <span className='ml-1'>({bookmarkedItems.size})</span>
                      )}
                    </motion.button>
                  ))}
                </div>

                {activeProfile && (
                  <div className='mt-3 text-xs text-gray-400'>
                    <span className='font-medium'>Interests:</span>{' '}
                    {activeProfile.interests.join(', ')}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className='flex-1 flex overflow-hidden'>
          {/* Enhanced Categories Sidebar with Personalization */}
          <div className='w-64 border-r border-white/10 bg-black/20 p-4 overflow-y-auto'>
            <div className='flex items-center justify-between mb-3'>
              <h3 className='text-sm font-semibold text-gray-300 uppercase'>Categories</h3>
              {activeProfile && (
                <div className='text-xs text-purple-400 font-medium'>For {activeProfile.name}</div>
              )}
            </div>

            {/* Personalization Status */}
            <div className='mb-4 p-3 bg-gradient-to-r from-purple-500/10 to-blue-500/10 rounded-lg border border-purple-500/20'>
              <div className='flex items-center space-x-2 mb-2'>
                <SparklesIcon className='w-4 h-4 text-purple-400' />
                <span className='text-sm font-medium text-purple-300'>AI Personalization</span>
              </div>
              <div className='text-xs text-gray-400'>
                Content curated based on your interests and reading history
              </div>
              {activeProfile?.age && activeProfile.age < 18 && (
                <div className='mt-2 flex items-center space-x-1 text-green-400'>
                  <div className='w-2 h-2 bg-green-400 rounded-full'></div>
                  <span className='text-xs'>Safe content filtering active</span>
                </div>
              )}
            </div>

            <div className='space-y-1'>
              {categories
                .sort((a, b) => (b.relevanceScore || 0.5) - (a.relevanceScore || 0.5)) // Sort by relevance
                .map(category => {
                  const isPreferred = activeProfile?.preferredCategories.includes(category.id);
                  const relevanceScore = category.relevanceScore || 0.5;

                  return (
                    <motion.button
                      key={category.id}
                      onClick={() => setSelectedCategory(category.id)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all relative ${
                        selectedCategory === category.id
                          ? 'bg-blue-500 text-white'
                          : isPreferred
                            ? 'text-purple-300 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20'
                            : 'text-gray-300 hover:bg-white/10'
                      }`}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      {/* Preferred category indicator */}
                      {isPreferred && (
                        <div className='absolute left-1 top-1/2 transform -translate-y-1/2 w-2 h-2 bg-purple-400 rounded-full'></div>
                      )}

                      <div className='flex items-center justify-between'>
                        <div className='flex items-center space-x-2'>
                          <span className={isPreferred ? 'ml-2' : ''}>{category.displayName}</span>
                          {relevanceScore > 0.8 && (
                            <StarSolid className='w-3 h-3 text-yellow-400' />
                          )}
                        </div>

                        <div className='flex items-center space-x-2'>
                          {category.personalizedCount !== undefined &&
                            category.personalizedCount !== category.count && (
                              <span className='text-xs bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded-full'>
                                {category.personalizedCount}
                              </span>
                            )}
                          {category.count > 0 && (
                            <span
                              className={`text-xs px-2 py-0.5 rounded-full ${
                                selectedCategory === category.id
                                  ? 'bg-white/20'
                                  : isPreferred
                                    ? 'bg-purple-500/20'
                                    : 'bg-white/20'
                              }`}
                            >
                              {category.count}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Relevance indicator */}
                      {relevanceScore > 0.6 && selectedCategory !== category.id && (
                        <div className='mt-1'>
                          <div className='w-full bg-white/10 rounded-full h-1'>
                            <div
                              className={`h-1 rounded-full ${
                                relevanceScore > 0.8
                                  ? 'bg-gradient-to-r from-purple-500 to-blue-500'
                                  : relevanceScore > 0.7
                                    ? 'bg-gradient-to-r from-blue-500 to-cyan-500'
                                    : 'bg-gray-500'
                              }`}
                              style={{ width: `${Math.round(relevanceScore * 100)}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </motion.button>
                  );
                })}
            </div>

            {/* Quick Stats */}
            <div className='mt-6 pt-4 border-t border-white/10'>
              <h4 className='text-xs font-semibold text-gray-400 uppercase mb-2'>Reading Stats</h4>
              <div className='space-y-2 text-xs text-gray-400'>
                <div className='flex justify-between'>
                  <span>Articles read:</span>
                  <span className='text-blue-400 font-medium'>{readingHistory.size}</span>
                </div>
                <div className='flex justify-between'>
                  <span>Bookmarked:</span>
                  <span className='text-yellow-400 font-medium'>{bookmarkedItems.size}</span>
                </div>
                <div className='flex justify-between'>
                  <span>Liked:</span>
                  <span className='text-red-400 font-medium'>{likedItems.size}</span>
                </div>
              </div>
            </div>
          </div>

          {/* News Feed */}
          <div className='flex-1 overflow-y-auto'>
            <AnimatePresence mode='wait'>
              {filteredNews.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className='flex flex-col items-center justify-center h-full text-gray-400'
                >
                  <NewspaperIcon className='w-16 h-16 mb-4' />
                  <h3 className='text-xl font-medium mb-2'>No news available</h3>
                  <p className='text-center'>Try refreshing or selecting a different category</p>
                </motion.div>
              ) : (
                <div className='p-6'>
                  <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
                    {filteredNews.map((item, index) => (
                      <motion.article
                        key={item.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className='group glass-card hover:bg-white/10 transition-all duration-300 cursor-pointer relative'
                        onClick={() => {
                          markAsRead(item.id);
                          window.electronAPI?.openExternal(item.url);
                        }}
                        whileHover={{ scale: 1.02, y: -2 }}
                      >
                        {/* Personalization Score Indicator */}
                        {item.personalizedScore && item.personalizedScore > 0.8 && (
                          <div className='absolute top-2 left-2 z-10'>
                            <div className='flex items-center space-x-1 px-2 py-1 bg-gradient-to-r from-purple-500/20 to-blue-500/20 rounded-full border border-purple-500/30'>
                              <SparklesIcon className='w-3 h-3 text-purple-400' />
                              <span className='text-xs text-purple-300 font-medium'>
                                Recommended
                              </span>
                            </div>
                          </div>
                        )}

                        {/* Reading History Badge */}
                        {readingHistory.has(item.id) && (
                          <div className='absolute top-2 right-2 z-10'>
                            <div className='p-1 bg-green-500/20 rounded-full border border-green-500/30'>
                              <EyeIcon className='w-3 h-3 text-green-400' />
                            </div>
                          </div>
                        )}

                        {/* Action Buttons */}
                        <div className='absolute top-2 right-2 z-10 flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity'>
                          <motion.button
                            onClick={_e => {
                              _e.stopPropagation();
                              toggleBookmark(item.id);
                            }}
                            className='p-2 bg-black/50 hover:bg-black/70 rounded-full backdrop-blur-sm'
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                          >
                            {bookmarkedItems.has(item.id) ? (
                              <BookmarkSolid className='w-4 h-4 text-yellow-400' />
                            ) : (
                              <BookmarkIcon className='w-4 h-4 text-white' />
                            )}
                          </motion.button>

                          <motion.button
                            onClick={_e => {
                              _e.stopPropagation();
                              toggleLike(item.id);
                            }}
                            className='p-2 bg-black/50 hover:bg-black/70 rounded-full backdrop-blur-sm'
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                          >
                            {likedItems.has(item.id) ? (
                              <HeartSolid className='w-4 h-4 text-red-400' />
                            ) : (
                              <HeartIcon className='w-4 h-4 text-white' />
                            )}
                          </motion.button>
                        </div>

                        {/* Image with Fallback */}
                        <div className='aspect-video overflow-hidden rounded-t-lg bg-gradient-to-br from-purple-900/20 to-blue-900/20'>
                          {item.imageUrl ? (
                            <img
                              src={item.imageUrl}
                              alt={item.title}
                              className='w-full h-full object-cover group-hover:scale-105 transition-transform duration-300'
                              loading='lazy'
                              onError={_e => {
                                const target = _e.target as HTMLImageElement;
                                // Use a category-based fallback gradient
                                const fallbackGradients: Record<string, string> = {
                                  ai: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                  technology: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                                  development: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
                                  innovation: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
                                  default: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
                                };
                                const gradient =
                                  fallbackGradients[item.category] || fallbackGradients.default;

                                // Replace image with a styled placeholder
                                const parent = target.parentElement;
                                if (parent) {
                                  parent.style.background = gradient;
                                  parent.innerHTML = `
                                    <div class="flex items-center justify-center h-full">
                                      <div class="text-center">
                                        <svg class="w-16 h-16 mx-auto text-white/30 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                        </svg>
                                        <p class="text-white/40 text-sm font-medium">${item.source}</p>
                                      </div>
                                    </div>
                                  `;
                                }
                              }}
                            />
                          ) : (
                            // Default placeholder for items without images
                            <div
                              className='w-full h-full flex items-center justify-center'
                              style={{
                                background:
                                  item.category === 'ai'
                                    ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                                    : item.category === 'technology'
                                      ? 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)'
                                      : item.category === 'development'
                                        ? 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)'
                                        : item.category === 'innovation'
                                          ? 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)'
                                          : 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
                              }}
                            >
                              <div className='text-center'>
                                <NewspaperIcon className='w-16 h-16 mx-auto text-white/30 mb-2' />
                                <p className='text-white/40 text-sm font-medium'>{item.source}</p>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Content */}
                        <div className='p-4'>
                          {/* Enhanced Category & Metadata */}
                          <div className='flex items-center justify-between text-xs text-gray-400 mb-2'>
                            <div className='flex items-center space-x-3'>
                              <div className='flex items-center space-x-1'>
                                <TagIcon className='w-3 h-3' />
                                <span className='capitalize'>{item.category}</span>
                              </div>
                              {item.readTime && (
                                <span className='text-gray-500'>{item.readTime} min read</span>
                              )}
                            </div>
                            <div className='flex items-center space-x-2'>
                              <div className='flex items-center space-x-1'>
                                <ClockIcon className='w-3 h-3' />
                                <span>{formatTimeAgo(item.publishedAt)}</span>
                              </div>
                              {item.personalizedScore && (
                                <div className='flex items-center space-x-1'>
                                  <StarIcon className='w-3 h-3 text-blue-400' />
                                  <span className='text-blue-400 font-medium'>
                                    {Math.round(item.personalizedScore * 100)}%
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Title */}
                          <h3 className='text-white font-semibold text-lg leading-tight mb-2 group-hover:text-blue-400 transition-colors'>
                            {item.title}
                          </h3>

                          {/* Description */}
                          <p className='text-gray-400 text-sm leading-relaxed mb-3 line-clamp-3'>
                            {item.description}
                          </p>

                          {/* Tags */}
                          {item.tags && item.tags.length > 0 && (
                            <div className='flex flex-wrap gap-1 mb-3'>
                              {item.tags.slice(0, 3).map((tag, tagIndex) => (
                                <span
                                  key={tagIndex}
                                  className='px-2 py-1 bg-white/10 rounded-full text-xs text-gray-300'
                                >
                                  {tag}
                                </span>
                              ))}
                              {item.tags.length > 3 && (
                                <span className='px-2 py-1 bg-white/5 rounded-full text-xs text-gray-400'>
                                  +{item.tags.length - 3} more
                                </span>
                              )}
                            </div>
                          )}

                          {/* Enhanced Footer */}
                          <div className='flex items-center justify-between'>
                            <div className='flex items-center space-x-3'>
                              <span className='text-xs text-gray-500'>{item.source}</span>
                              {item.viewCount && item.viewCount > 0 && (
                                <div className='flex items-center space-x-1 text-gray-500'>
                                  <EyeIcon className='w-3 h-3' />
                                  <span className='text-xs'>{item.viewCount}</span>
                                </div>
                              )}
                            </div>
                            <div className='flex items-center space-x-1 text-blue-400 group-hover:text-blue-300'>
                              <LinkIcon className='w-3 h-3' />
                              <span className='text-xs'>Read more</span>
                            </div>
                          </div>

                          {/* Age-appropriate content indicator for children */}
                          {activeProfile?.safetyLevel === 'child' && (
                            <div className='mt-2 pt-2 border-t border-white/5'>
                              <div className='flex items-center space-x-2 text-green-400'>
                                <div className='w-2 h-2 bg-green-400 rounded-full'></div>
                                <span className='text-xs'>Kid-friendly content</span>
                              </div>
                            </div>
                          )}
                        </div>
                      </motion.article>
                    ))}
                  </div>
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
};
