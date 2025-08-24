import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BookOpenIcon,
  MagnifyingGlassIcon,
  StarIcon,
  CodeBracketIcon,
  ArrowTopRightOnSquareIcon,
  TagIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';
import { StarIcon as StarSolidIcon } from '@heroicons/react/24/solid';
import { useStore } from '../store/useStore';

import Logger from '../utils/logger';
interface Library {
  id: string;
  name: string;
  description: string;
  category: string;
  stars: number;
  language: string;
  lastUpdated: string;
  homepage?: string;
  repository?: string;
  documentation?: string;
  installation: {
    spm?: string;
    cocoapods?: string;
    carthage?: string;
  };
  features: string[];
  tags: string[];
  rating: number;
  downloads?: number;
}

interface LibraryCategory {
  id: string;
  name: string;
  displayName: string;
  count: number;
  icon: React.ComponentType<any>;
}

const categoryIcons: Record<string, React.ComponentType<any>> = {
  'ui-ux': CodeBracketIcon,
  networking: CodeBracketIcon,
  animation: CodeBracketIcon,
  data: CodeBracketIcon,
  utility: CodeBracketIcon,
  testing: CodeBracketIcon,
  security: CodeBracketIcon,
  storage: CodeBracketIcon,
};

export const Libraries: React.ComponentType = () => {
  const { apiEndpoint } = useStore();
  const [libraries, setLibraries] = useState<Library[]>([]);
  const [categories, setCategories] = useState<LibraryCategory[]>([]);
  const [filteredLibraries, setFilteredLibraries] = useState<Library[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [_error, setError] = useState<string | null>(null);

  const fetchLibraries = useCallback(async () => {
    try {
      setError(null);

      // Try to fetch from API
      try {
        const response = await fetch(`${apiEndpoint}/api/libraries/swift`);
        if (!response.ok) {
          throw new Error(`Failed to fetch libraries: ${response.statusText}`);
        }

        const data = await response.json();
        if (data.success && Array.isArray(data.data)) {
          setLibraries(data.data);
          setFilteredLibraries(data.data);

          // Create categories from data
          const categoryMap = new Map<string, number>();
          data.data.forEach((lib: Library) => {
            categoryMap.set(lib.category, (categoryMap.get(lib.category) || 0) + 1);
          });

          const categoryList: LibraryCategory[] = [
            {
              id: 'all',
              name: 'all',
              displayName: 'All Libraries',
              count: data.data.length,
              icon: BookOpenIcon,
            },
            ...Array.from(categoryMap.entries()).map(([cat, count]) => ({
              id: cat,
              name: cat,
              displayName: cat
                .split('-')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' & '),
              count,
              icon: categoryIcons[cat] || CodeBracketIcon,
            })),
          ];

          setCategories(categoryList);
          return; // Successfully fetched from API
        } else {
          throw new Error(data.error?.message || 'Invalid library data format');
        }
      } catch (apiError) {
        // API failed, use mock data
        Logger.warn('API failed, using mock data for libraries:', apiError);

        const mockLibraries: Library[] = [
          {
            id: '1',
            name: 'SwiftUI Components',
            description: 'Beautiful and customizable SwiftUI components for modern iOS apps',
            category: 'ui-ux',
            stars: 5420,
            language: 'Swift',
            lastUpdated: '2024-01-15',
            homepage: 'https://github.com/example/swiftui-components',
            repository: 'https://github.com/example/swiftui-components',
            documentation: 'https://docs.example.com/swiftui-components',
            installation: {
              spm: 'https://github.com/example/swiftui-components',
              cocoapods: 'pod "SwiftUIComponents"',
            },
            features: [
              'Dark mode support',
              'Accessibility ready',
              'iOS 17+',
              'Customizable themes',
            ],
            tags: ['swiftui', 'components', 'ui', 'ios17'],
            rating: 4.8,
            downloads: 15000,
          },
          {
            id: '2',
            name: 'NetworkKit',
            description: 'Modern networking library built with async/await and Swift concurrency',
            category: 'networking',
            stars: 3200,
            language: 'Swift',
            lastUpdated: '2024-01-10',
            homepage: 'https://github.com/example/networkkit',
            repository: 'https://github.com/example/networkkit',
            installation: {
              spm: 'https://github.com/example/networkkit',
            },
            features: ['Async/await', 'Combine support', 'Request builders', 'Mock support'],
            tags: ['networking', 'async', 'api', 'rest'],
            rating: 4.6,
            downloads: 8500,
          },
          {
            id: '3',
            name: 'AnimateIt',
            description:
              'Powerful animation library for creating smooth and engaging UI animations',
            category: 'animation',
            stars: 4100,
            language: 'Swift',
            lastUpdated: '2024-01-08',
            repository: 'https://github.com/example/animateit',
            installation: {
              spm: 'https://github.com/example/animateit',
              carthage: 'github "example/AnimateIt"',
            },
            features: [
              'Spring animations',
              'Gesture-driven',
              'Metal acceleration',
              'Timeline control',
            ],
            tags: ['animation', 'ui', 'motion', 'swiftui'],
            rating: 4.7,
            downloads: 11000,
          },
          {
            id: '4',
            name: 'DataStore',
            description: 'Type-safe local database solution with SwiftData integration',
            category: 'data',
            stars: 2800,
            language: 'Swift',
            lastUpdated: '2024-01-05',
            repository: 'https://github.com/example/datastore',
            installation: {
              spm: 'https://github.com/example/datastore',
            },
            features: ['SwiftData support', 'CloudKit sync', 'Migration tools', 'Query builder'],
            tags: ['database', 'storage', 'swiftdata', 'cloudkit'],
            rating: 4.5,
            downloads: 6200,
          },
          {
            id: '5',
            name: 'SecureVault',
            description: 'Comprehensive security library for iOS apps with keychain integration',
            category: 'security',
            stars: 3600,
            language: 'Swift',
            lastUpdated: '2024-01-12',
            repository: 'https://github.com/example/securevault',
            installation: {
              spm: 'https://github.com/example/securevault',
              cocoapods: 'pod "SecureVault"',
            },
            features: [
              'Keychain wrapper',
              'Biometric auth',
              'Encryption helpers',
              'Certificate pinning',
            ],
            tags: ['security', 'keychain', 'encryption', 'authentication'],
            rating: 4.9,
            downloads: 9800,
          },
        ];

        setLibraries(mockLibraries);
        setFilteredLibraries(mockLibraries);

        // Create categories from mock data
        const categoryMap = new Map<string, number>();
        mockLibraries.forEach(lib => {
          categoryMap.set(lib.category, (categoryMap.get(lib.category) || 0) + 1);
        });

        const categoryList: LibraryCategory[] = [
          {
            id: 'all',
            name: 'all',
            displayName: 'All Libraries',
            count: mockLibraries.length,
            icon: BookOpenIcon,
          },
          ...Array.from(categoryMap.entries()).map(([cat, count]) => ({
            id: cat,
            name: cat,
            displayName: cat
              .split('-')
              .map(word => word.charAt(0).toUpperCase() + word.slice(1))
              .join(' & '),
            count,
            icon: categoryIcons[cat] || CodeBracketIcon,
          })),
        ];

        setCategories(categoryList);
        setError(null); // Clear error since we have mock data
      }
    } catch (_error) {
      if (process.env.NODE_ENV === 'development') {
        Logger.error('Error fetching libraries:', _error);
      }
      setError(_error instanceof Error ? _error.message : 'Failed to fetch libraries');
    } finally {
      setIsLoading(false);
    }
  }, [apiEndpoint]);

  useEffect(() => {
    fetchLibraries();
  }, [fetchLibraries]);

  useEffect(() => {
    let filtered = libraries;

    // Filter by category
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(lib => lib.category === selectedCategory);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        lib =>
          lib.name.toLowerCase().includes(query) ||
          lib.description.toLowerCase().includes(query) ||
          lib.tags.some(tag => tag.toLowerCase().includes(query)) ||
          lib.features.some(feature => feature.toLowerCase().includes(query))
      );
    }

    setFilteredLibraries(filtered);
  }, [libraries, selectedCategory, searchQuery]);

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }).map((_, index) => {
      const filled = index < Math.floor(rating);
      return filled ? (
        <StarSolidIcon key={index} className='w-4 h-4 text-yellow-400' />
      ) : (
        <StarIcon key={index} className='w-4 h-4 text-gray-400' />
      );
    });
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
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
          <p className='text-gray-400'>Loading Swift libraries...</p>
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
          <BookOpenIcon className='w-16 h-16 text-red-500 mx-auto mb-4' />
          <h3 className='text-xl font-medium text-white mb-2'>Failed to Load Libraries</h3>
          <p className='text-gray-400 mb-4'>{_error}</p>
          <motion.button
            onClick={fetchLibraries}
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
        {/* Header */}
        <div className='p-6 border-b border-white/10'>
          <div className='flex items-center justify-between mb-4'>
            <div>
              <h1 className='text-2xl font-bold text-white mb-2'>Swift Libraries</h1>
              <p className='text-gray-400'>Discover and explore curated Swift libraries</p>
            </div>
          </div>

          {/* Search Bar */}
          <div className='relative max-w-md'>
            <MagnifyingGlassIcon className='absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400' />
            <input
              type='text'
              value={searchQuery}
              onChange={_e => setSearchQuery(_e.target.value)}
              placeholder='Search libraries...'
              className='w-full pl-10 pr-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500'
            />
          </div>
        </div>

        <div className='flex-1 flex overflow-hidden'>
          {/* Categories Sidebar */}
          <div className='w-64 border-r border-white/10 bg-black/20 p-4 overflow-y-auto'>
            <h3 className='text-sm font-semibold text-gray-300 uppercase mb-3'>Categories</h3>
            <div className='space-y-1'>
              {categories.map(category => {
                const IconComponent = category.icon;
                return (
                  <motion.button
                    key={category.id}
                    onClick={() => setSelectedCategory(category.id)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all flex items-center space-x-2 ${
                      selectedCategory === category.id
                        ? 'bg-blue-500 text-white'
                        : 'text-gray-300 hover:bg-white/10'
                    }`}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <IconComponent className='w-4 h-4' />
                    <span className='flex-1'>{category.displayName}</span>
                    <span className='text-xs bg-white/20 px-2 py-0.5 rounded-full'>
                      {category.count}
                    </span>
                  </motion.button>
                );
              })}
            </div>
          </div>

          {/* Libraries Grid */}
          <div className='flex-1 overflow-y-auto'>
            <AnimatePresence mode='wait'>
              {filteredLibraries.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className='flex flex-col items-center justify-center h-full text-gray-400'
                >
                  <BookOpenIcon className='w-16 h-16 mb-4' />
                  <h3 className='text-xl font-medium mb-2'>No libraries found</h3>
                  <p className='text-center'>Try adjusting your search or category filter</p>
                </motion.div>
              ) : (
                <div className='p-6'>
                  <div className='grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6'>
                    {filteredLibraries.map((library, index) => (
                      <motion.div
                        key={library.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className='glass-card group hover:bg-white/10 transition-all duration-300'
                        whileHover={{ scale: 1.02, y: -2 }}
                      >
                        {/* Header */}
                        <div className='p-4 border-b border-white/10'>
                          <div className='flex items-start justify-between mb-2'>
                            <h3 className='text-lg font-semibold text-white group-hover:text-blue-400 transition-colors'>
                              {library.name}
                            </h3>
                            <div className='flex items-center space-x-1'>
                              <StarIcon className='w-4 h-4 text-yellow-400' />
                              <span className='text-sm text-gray-300'>
                                {formatNumber(library.stars)}
                              </span>
                            </div>
                          </div>

                          <p className='text-gray-400 text-sm leading-relaxed mb-3'>
                            {library.description}
                          </p>

                          <div className='flex items-center justify-between text-xs text-gray-500'>
                            <span>{library.language}</span>
                            <div className='flex items-center space-x-1'>
                              <ClockIcon className='w-3 h-3' />
                              <span>
                                {library.lastUpdated
                                  ? (() => {
                                      try {
                                        const date = new Date(library.lastUpdated);
                                        return isNaN(date.getTime())
                                          ? ''
                                          : date.toLocaleDateString();
                                      } catch {
                                        return '';
                                      }
                                    })()
                                  : ''}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Features */}
                        <div className='p-4'>
                          <div className='flex items-center space-x-2 mb-3'>
                            <div className='flex'>{renderStars(library.rating)}</div>
                            <span className='text-sm text-gray-400'>
                              ({library.rating.toFixed(1)})
                            </span>
                          </div>

                          {library.features.length > 0 && (
                            <div className='mb-4'>
                              <h4 className='text-xs font-medium text-gray-300 mb-2'>Features</h4>
                              <div className='space-y-1'>
                                {library.features.slice(0, 3).map((feature, featureIndex) => (
                                  <div key={featureIndex} className='flex items-start space-x-2'>
                                    <div className='w-1 h-1 bg-blue-400 rounded-full mt-2 flex-shrink-0' />
                                    <span className='text-xs text-gray-400'>{feature}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Tags */}
                          {library.tags.length > 0 && (
                            <div className='flex flex-wrap gap-1 mb-4'>
                              {library.tags.slice(0, 4).map((tag, tagIndex) => (
                                <span
                                  key={tagIndex}
                                  className='px-2 py-1 bg-white/10 rounded-full text-xs text-gray-300 flex items-center space-x-1'
                                >
                                  <TagIcon className='w-3 h-3' />
                                  <span>{tag}</span>
                                </span>
                              ))}
                            </div>
                          )}

                          {/* Installation */}
                          {library.installation && (
                            <div className='mb-4'>
                              <h4 className='text-xs font-medium text-gray-300 mb-2'>
                                Installation
                              </h4>
                              <div className='space-y-2'>
                                {library.installation.spm && (
                                  <div>
                                    <span className='text-xs text-blue-400'>SPM:</span>
                                    <code className='block text-xs bg-black/30 p-2 rounded mt-1 text-gray-300 font-mono'>
                                      {library.installation.spm}
                                    </code>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Links */}
                          <div className='flex space-x-2'>
                            {library.repository && (
                              <motion.a
                                href={library.repository}
                                target='_blank'
                                rel='noopener noreferrer'
                                className='flex items-center space-x-1 px-3 py-1.5 bg-blue-500/20 hover:bg-blue-500/30 rounded-lg text-xs text-blue-400'
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={_e => {
                                  _e.preventDefault();
                                  window.electronAPI?.openExternal(library.repository!);
                                }}
                              >
                                <CodeBracketIcon className='w-3 h-3' />
                                <span>Repository</span>
                                <ArrowTopRightOnSquareIcon className='w-3 h-3' />
                              </motion.a>
                            )}

                            {library.documentation && (
                              <motion.a
                                href={library.documentation}
                                target='_blank'
                                rel='noopener noreferrer'
                                className='flex items-center space-x-1 px-3 py-1.5 bg-green-500/20 hover:bg-green-500/30 rounded-lg text-xs text-green-400'
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={_e => {
                                  _e.preventDefault();
                                  window.electronAPI?.openExternal(library.documentation!);
                                }}
                              >
                                <BookOpenIcon className='w-3 h-3' />
                                <span>Docs</span>
                                <ArrowTopRightOnSquareIcon className='w-3 h-3' />
                              </motion.a>
                            )}
                          </div>
                        </div>
                      </motion.div>
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
