import React from 'react';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  UserCircleIcon,
  HeartIcon,
  SparklesIcon,
  AcademicCapIcon,
  PuzzlePieceIcon,
  MusicalNoteIcon,
  BookOpenIcon,
  TruckIcon,
} from '@heroicons/react/24/outline';
import { apiService } from '../services/api';

interface FamilyProfile {
  id: string;
  name: string;
  age?: number;
  avatar: string;
  interests: string[];
  preferredContent: string[];
  color: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface ContentCard {
  id: string;
  title: string;
  description: string;
  category: string;
  type: 'news' | 'video' | 'article' | 'game' | 'learning';
  profileMatch: string[];
  thumbnail?: string;
  timestamp: string;
  source: string;
}

interface InterestCategory {
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  content: ContentCard[];
}

// Family Profiles
const familyProfiles: FamilyProfile[] = [
  {
    id: 'trista',
    name: 'Trista',
    avatar: '👩‍💼',
    interests: ['AI News', 'Technology', 'Health & Wellness', 'Fashion', 'Home Design'],
    preferredContent: ['news', 'article', 'video'],
    color: '#ff6b9d',
    icon: HeartIcon,
  },
  {
    id: 'cayden',
    name: 'Cayden',
    age: 7,
    avatar: '🎮',
    interests: ['Games', 'Cartoons', 'Science for Kids', 'Animals', 'Art & Crafts'],
    preferredContent: ['game', 'video', 'learning'],
    color: '#4ecdc4',
    icon: PuzzlePieceIcon,
  },
  {
    id: 'landon',
    name: 'Landon',
    age: 20,
    avatar: '🚗',
    interests: ['Cars', 'Technology', 'Gaming', 'Music', 'Sports'],
    preferredContent: ['news', 'video', 'article'],
    color: '#45b7d1',
    icon: TruckIcon,
  },
];

// Load real content from APIs based on profile interests

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: { type: 'spring', stiffness: 100 },
  },
};

const Dashboard: React.ComponentType = () => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [selectedProfile, setSelectedProfile] = useState<FamilyProfile>(familyProfiles[0]); // Default to Trista
  const [personalizedContent, setPersonalizedContent] = useState<ContentCard[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Load personalized content based on selected profile
  useEffect(() => {
    const loadPersonalizedContent = async () => {
      setIsLoading(true);

      try {
        // Load real content from API based on profile interests
        const allContent: ContentCard[] = [];

        // For each interest, fetch relevant news/content
        for (const interest of selectedProfile.interests) {
          try {
            // Fetch news articles related to the interest
            const newsArticles = await apiService.getNews('hackernews', 5);

            // Transform news articles to ContentCard format
            const transformedContent: ContentCard[] = newsArticles.map(
              (article: any, index: number) => ({
                id: `${selectedProfile.id}-${interest}-${index}`,
                title: article.title || article.text || 'Untitled',
                description:
                  article.text ||
                  article.description ||
                  article.title ||
                  'No description available',
                category: interest,
                type: 'news' as const,
                profileMatch: [selectedProfile.id],
                timestamp: article.time ? new Date(article.time * 1000).toLocaleString() : 'Recent',
                source: article.by || article.source || 'Hacker News',
              })
            );

            allContent.push(...transformedContent.slice(0, 2)); // Limit to 2 per interest
          } catch (error) {
            console.warn(`Failed to load content for ${interest}:`, error);
            // Continue with other interests even if one fails
          }
        }

        setPersonalizedContent(allContent);
      } catch (error) {
        console.error('Failed to load personalized content:', error);
        // Fallback: set empty content on error
        setPersonalizedContent([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadPersonalizedContent();
  }, [selectedProfile]);

  // Profile switching animation handler
  const handleProfileSwitch = (profile: FamilyProfile) => {
    if (profile.id !== selectedProfile.id) {
      setSelectedProfile(profile);
    }
  };

  // Get content by category for selected profile
  const _getContentByCategory = () => {
    const categories: InterestCategory[] = selectedProfile.interests
      .map(interest => ({
        name: interest,
        icon: selectedProfile.icon,
        color: selectedProfile.color,
        content: personalizedContent.filter(item => item.category === interest),
      }))
      .filter(cat => cat.content.length > 0);

    return categories;
  };

  return (
    <div className='p-4 md:p-6 h-full overflow-y-auto'>
      <motion.div
        variants={containerVariants}
        initial='hidden'
        animate='visible'
        className='max-w-7xl mx-auto w-full'
      >
        {/* Family Header */}
        <motion.div variants={itemVariants} className='mb-8'>
          <div className='flex items-center justify-between mb-6'>
            <div>
              <h1 className='text-4xl font-bold gradient-text-primary mb-2 font-system'>
                Good{' '}
                {currentTime.getHours() < 12
                  ? 'Morning'
                  : currentTime.getHours() < 18
                    ? 'Afternoon'
                    : 'Evening'}
                ! ✨
              </h1>
              <p className='text-white/70 text-lg font-system'>
                Here&apos;s what&apos;s interesting for {selectedProfile.name} today
              </p>
            </div>
            <motion.div
              className='glass-card-warm elevation-4 p-4 rounded-2xl'
              whileHover={{ scale: 1.05 }}
            >
              <div className='flex items-center space-x-3'>
                <span className='text-2xl'>{selectedProfile.avatar}</span>
                <div>
                  <p className='font-semibold text-white text-lg font-system'>
                    {selectedProfile.name}
                  </p>
                  {selectedProfile.age && (
                    <p className='text-white/60 text-sm font-system'>
                      {selectedProfile.age} years old
                    </p>
                  )}
                </div>
              </div>
            </motion.div>
          </div>

          {/* Profile Selector */}
          <motion.div variants={itemVariants} className='flex gap-4 mb-8'>
            {familyProfiles.map((profile, index) => (
              <motion.button
                key={profile.id}
                onClick={() => handleProfileSwitch(profile)}
                className={`glass-card-spectrum elevation-3 p-4 rounded-2xl transition-all duration-300 font-system ${
                  selectedProfile.id === profile.id
                    ? 'ring-2 ring-white/30 elevation-6'
                    : 'hover:elevation-5'
                }`}
                whileHover={{ scale: 1.05, y: -4 }}
                whileTap={{ scale: 0.95 }}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                style={{
                  background:
                    selectedProfile.id === profile.id
                      ? `linear-gradient(135deg, ${profile.color}30, ${profile.color}10)`
                      : undefined,
                }}
              >
                <div className='flex items-center space-x-3'>
                  <motion.div
                    className='w-12 h-12 rounded-xl glass-subtle elevation-2 flex items-center justify-center'
                    whileHover={{ rotateY: 180 }}
                    transition={{ duration: 0.6 }}
                  >
                    <span className='text-xl'>{profile.avatar}</span>
                  </motion.div>
                  <div className='text-left'>
                    <p className='font-semibold text-white font-system'>{profile.name}</p>
                    <p className='text-white/60 text-sm font-system'>
                      {profile.interests.length} interests
                    </p>
                  </div>
                </div>
              </motion.button>
            ))}
          </motion.div>
        </motion.div>

        {/* Profile Interests Overview */}
        <motion.div
          variants={itemVariants}
          className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 md:gap-6 mb-8 w-full'
        >
          {selectedProfile.interests.map((interest, index) => {
            const contentCount = personalizedContent.filter(
              item => item.category === interest
            ).length;
            const IconComponent = selectedProfile.icon;

            return (
              <motion.div
                key={interest}
                whileHover={{ scale: 1.05, y: -8 }}
                className='glass-card-spectrum elevation-3 p-6 font-system relative overflow-hidden'
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  delay: index * 0.1,
                  type: 'spring',
                  stiffness: 400,
                  damping: 25,
                }}
              >
                <motion.div
                  className='absolute inset-0 opacity-10'
                  style={{
                    background: `radial-gradient(circle at 30% 30%, ${selectedProfile.color}60, transparent)`,
                  }}
                />

                <div className='relative z-10'>
                  <div className='flex items-center justify-between mb-4'>
                    <motion.div
                      className='w-12 h-12 rounded-2xl elevation-2 p-3 flex items-center justify-center glass-subtle'
                      style={{
                        background: `linear-gradient(135deg, ${selectedProfile.color}25, ${selectedProfile.color}15)`,
                      }}
                      whileHover={{ rotateY: 180 }}
                      transition={{ duration: 0.6 }}
                    >
                      <IconComponent className='w-6 h-6 text-white filter drop-shadow-lg' />
                    </motion.div>

                    <motion.div
                      initial={{ scale: 0, rotate: -90 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ delay: index * 0.1 + 0.5, type: 'spring', stiffness: 300 }}
                      className='glass-button-sm glass-button-spectrum px-3 py-1 text-xs font-medium'
                    >
                      {contentCount} new
                    </motion.div>
                  </div>

                  <h3 className='text-sm font-medium opacity-90 mb-2 tracking-wide font-system'>
                    {interest}
                  </h3>

                  <motion.div
                    initial={{ scale: 1.2, opacity: 0, y: 10 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 + 0.3 }}
                  >
                    <p className='text-xs text-white/60 font-system'>
                      {selectedProfile.name === 'Cayden' && interest === 'Science for Kids'
                        ? 'Fun experiments awaiting!'
                        : selectedProfile.name === 'Trista' && interest === 'AI News'
                          ? 'Latest tech updates'
                          : selectedProfile.name === 'Landon' && interest === 'Cars'
                            ? 'New automotive content'
                            : 'Fresh content available'}
                    </p>
                  </motion.div>
                </div>
              </motion.div>
            );
          })}
        </motion.div>

        {/* Personalized Content Feed */}
        <div className='grid grid-cols-1 xl:grid-cols-2 gap-4 md:gap-6 w-full'>
          {/* Main Content Area */}
          <motion.div variants={itemVariants} className='glass-card-elevated font-system p-8'>
            <div className='flex items-center justify-between mb-8'>
              <h2 className='text-2xl font-semibold gradient-text-warm'>
                For {selectedProfile.name} {selectedProfile.age ? `(${selectedProfile.age})` : ''}
              </h2>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                className='w-8 h-8 elevation-2 rounded-xl p-1.5 glass-cool flex items-center justify-center'
                style={{ background: `${selectedProfile.color}30` }}
              >
                <selectedProfile.icon className='w-5 h-5 text-white filter drop-shadow-lg' />
              </motion.div>
            </div>

            {/* Loading State */}
            {isLoading ? (
              <div className='flex items-center justify-center py-12'>
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  className='w-8 h-8 border-2 border-white/20 border-t-white rounded-full'
                />
                <span className='ml-3 text-white/70 font-system'>
                  Loading personalized content...
                </span>
              </div>
            ) : (
              <div className='space-y-4'>
                {personalizedContent.map((content, index) => (
                  <motion.div
                    key={content.id}
                    initial={{ x: -30, opacity: 0, scale: 0.9 }}
                    animate={{ x: 0, opacity: 1, scale: 1 }}
                    transition={{
                      delay: index * 0.1,
                      type: 'spring',
                      stiffness: 200,
                      damping: 20,
                    }}
                    whileHover={{ scale: 1.02, x: 5 }}
                    className='glass-subtle p-6 rounded-2xl elevation-2 transition-all duration-200 cursor-pointer'
                  >
                    <div className='flex items-start space-x-4'>
                      <motion.div
                        className='w-12 h-12 rounded-2xl mt-1 flex-shrink-0 elevation-3 flex items-center justify-center glass-spectrum'
                        style={{ background: `${selectedProfile.color}30` }}
                        whileHover={{ scale: 1.1, rotateY: 180 }}
                        transition={{ duration: 0.6 }}
                      >
                        <selectedProfile.icon className='w-6 h-6 text-white filter drop-shadow-lg' />
                      </motion.div>

                      <div className='flex-1 min-w-0'>
                        <motion.h3
                          className='text-lg font-semibold text-white mb-2 font-system'
                          initial={{ y: 5 }}
                          animate={{ y: 0 }}
                          transition={{ delay: index * 0.1 + 0.2 }}
                        >
                          {content.title}
                        </motion.h3>

                        <motion.p
                          className='text-sm text-white/70 mb-3 leading-relaxed font-system'
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 0.7 }}
                          transition={{ delay: index * 0.1 + 0.3 }}
                        >
                          {content.description}
                        </motion.p>

                        <div className='flex items-center justify-between'>
                          <motion.span
                            className='glass-button-xs px-3 py-1 text-xs font-medium glass-button-spectrum'
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: index * 0.1 + 0.4 }}
                          >
                            {content.category}
                          </motion.span>

                          <motion.div
                            className='flex items-center text-xs text-white/50 font-system'
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 0.5 }}
                            transition={{ delay: index * 0.1 + 0.5 }}
                          >
                            <span>{content.timestamp}</span>
                            <span className='mx-2'>•</span>
                            <span>{content.source}</span>
                          </motion.div>
                        </div>
                      </div>

                      <motion.div
                        className='flex-shrink-0'
                        initial={{ rotate: -90, opacity: 0 }}
                        animate={{ rotate: 0, opacity: 0.6 }}
                        transition={{ delay: index * 0.1 + 0.6 }}
                      >
                        <div
                          className='w-1 h-16 rounded-full opacity-40'
                          style={{
                            background: `linear-gradient(to bottom, ${selectedProfile.color}, transparent)`,
                          }}
                        />
                      </motion.div>
                    </div>
                  </motion.div>
                ))}

                {personalizedContent.length === 0 && (
                  <motion.div
                    className='text-center py-12 text-white/60 font-system'
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <selectedProfile.icon className='w-16 h-16 mx-auto mb-4 opacity-40' />
                    <p>No content available for {selectedProfile.name} right now.</p>
                    <p className='text-sm mt-2'>
                      Check back later for personalized recommendations!
                    </p>
                  </motion.div>
                )}
              </div>
            )}
          </motion.div>

          {/* Profile Summary */}
          <motion.div variants={itemVariants} className='glass-card-floating font-system p-8'>
            <h2 className='text-2xl font-semibold gradient-text-cool mb-8'>
              {selectedProfile.name}&apos;s Interests
            </h2>

            <div className='space-y-4 mb-8'>
              {selectedProfile.interests.map((interest, index) => {
                const contentCount = personalizedContent.filter(
                  item => item.category === interest
                ).length;

                return (
                  <motion.div
                    key={interest}
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: index * 0.1 }}
                    whileHover={{ scale: 1.02, x: 8 }}
                    className='glass-subtle p-4 rounded-2xl elevation-1 transition-all duration-200'
                  >
                    <div className='flex items-center justify-between'>
                      <div className='flex items-center space-x-3'>
                        <motion.div
                          className='w-8 h-8 rounded-lg glass-spectrum elevation-2 flex items-center justify-center'
                          style={{ background: `${selectedProfile.color}25` }}
                          whileHover={{ rotateY: 180 }}
                          transition={{ duration: 0.6 }}
                        >
                          <selectedProfile.icon className='w-4 h-4 text-white' />
                        </motion.div>
                        <span className='font-medium text-white font-system'>{interest}</span>
                      </div>

                      <motion.span
                        className='glass-button-xs px-2 py-1 text-xs font-medium'
                        style={{ background: `${selectedProfile.color}20` }}
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: index * 0.1 + 0.2 }}
                      >
                        {contentCount}
                      </motion.span>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* Current Time */}
            <motion.div
              className='flex items-center justify-center glass-button-xs px-4 py-3 font-system rounded-2xl elevation-1'
              animate={{ opacity: [0.7, 1, 0.7] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <motion.div
                className='w-3 h-3 rounded-full mr-3'
                style={{ background: selectedProfile.color }}
                animate={{ scale: [0.8, 1.2, 0.8], opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
              <span className='text-sm text-white/80'>
                {currentTime instanceof Date && !isNaN(currentTime.getTime())
                  ? currentTime.toLocaleTimeString()
                  : ''}
              </span>
            </motion.div>
          </motion.div>
        </div>

        {/* Personalized Quick Actions */}
        <motion.div variants={itemVariants} className='mt-12'>
          <h2 className='text-3xl font-semibold gradient-text-primary mb-8 font-system'>
            Quick Actions for {selectedProfile.name}
          </h2>
          <div className='grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6'>
            {[
              {
                name: selectedProfile.name === 'Cayden' ? 'Educational Games' : 'Start Chat',
                icon: selectedProfile.name === 'Cayden' ? PuzzlePieceIcon : selectedProfile.icon,
                gradient: 'warm',
                color: selectedProfile.color,
                route: selectedProfile.name === 'Cayden' ? '/games' : '/chat',
              },
              {
                name:
                  selectedProfile.name === 'Trista'
                    ? 'AI News'
                    : selectedProfile.name === 'Landon'
                      ? 'Car Reviews'
                      : 'Fun Videos',
                icon:
                  selectedProfile.name === 'Trista'
                    ? SparklesIcon
                    : selectedProfile.name === 'Landon'
                      ? TruckIcon
                      : MusicalNoteIcon,
                gradient: 'cool',
                color:
                  selectedProfile.name === 'Trista'
                    ? '#ff6b9d'
                    : selectedProfile.name === 'Landon'
                      ? '#45b7d1'
                      : '#4ecdc4',
                route: '/news',
              },
              {
                name: selectedProfile.name === 'Cayden' ? 'Learning Center' : 'Discover More',
                icon: selectedProfile.name === 'Cayden' ? AcademicCapIcon : BookOpenIcon,
                gradient: 'spectrum',
                color: selectedProfile.name === 'Cayden' ? '#ffd700' : '#8800ff',
                route: '/libraries',
              },
              {
                name: selectedProfile.age && selectedProfile.age < 18 ? 'Ask Parent' : 'Settings',
                icon: selectedProfile.age && selectedProfile.age < 18 ? HeartIcon : UserCircleIcon,
                gradient: 'primary',
                color: selectedProfile.age && selectedProfile.age < 18 ? '#ff69b4' : '#ff8800',
                route: '/settings',
              },
            ].map((action, index) => (
              <motion.button
                key={action.name}
                onClick={() => (window.location.hash = action.route)}
                whileHover={{
                  scale: 1.08,
                  y: -10,
                  rotateX: 8,
                  rotateY: 8,
                }}
                whileTap={{ scale: 0.92, y: -6 }}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  delay: index * 0.15,
                  type: 'spring',
                  stiffness: 250,
                  damping: 20,
                }}
                className={`glass-card-${action.gradient} p-6 font-system group cursor-pointer relative overflow-hidden`}
                style={{
                  transformStyle: 'preserve-3d',
                  background: `linear-gradient(135deg, ${action.color}15, ${action.color}05)`,
                }}
              >
                <motion.div
                  className='absolute inset-0 opacity-0 group-hover:opacity-30 transition-opacity duration-500'
                  style={{
                    background: `radial-gradient(circle at center, ${action.color}60, transparent)`,
                  }}
                />

                <motion.div
                  className='relative z-10'
                  whileHover={{ scale: 1.15 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                >
                  <motion.div
                    className='w-14 h-14 mx-auto mb-4 elevation-4 rounded-2xl flex items-center justify-center glass-subtle'
                    style={{
                      background: `linear-gradient(135deg, ${action.color}35, ${action.color}15)`,
                    }}
                    animate={{
                      rotateY: [0, 360],
                      rotateX: [0, 15, 0],
                    }}
                    transition={{
                      duration: 12,
                      repeat: Infinity,
                      ease: 'linear',
                      delay: index * 3,
                    }}
                  >
                    <action.icon className='w-7 h-7 text-white filter drop-shadow-xl' />
                  </motion.div>

                  <motion.span
                    className='text-sm font-semibold block text-white/90 font-system'
                    initial={{ y: 10, opacity: 0 }}
                    animate={{ y: 0, opacity: 0.9 }}
                    transition={{ delay: index * 0.15 + 0.3 }}
                  >
                    {action.name}
                  </motion.span>
                </motion.div>

                <motion.div
                  className='absolute bottom-0 left-0 right-0 h-1.5 opacity-50'
                  style={{
                    background: `linear-gradient(90deg, ${action.color}, ${action.color}80, ${action.color})`,
                  }}
                  initial={{ scaleX: 0 }}
                  whileHover={{ scaleX: 1 }}
                  transition={{ duration: 0.4, ease: 'easeOut' }}
                />

                {/* Ambient glow effect */}
                <motion.div
                  className='absolute -inset-1 rounded-2xl opacity-0 group-hover:opacity-20 blur-xl transition-opacity duration-700'
                  style={{ background: action.color }}
                />
              </motion.button>
            ))}
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default Dashboard;
