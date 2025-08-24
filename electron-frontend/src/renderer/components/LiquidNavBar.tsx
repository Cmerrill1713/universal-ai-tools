import React from 'react';
import { useState, useEffect } from 'react';
import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion';
// import { useSpring, animated } from '@react-spring/web';
import {
  HomeIcon,
  ChatBubbleLeftIcon,
  ServerIcon,
  Cog6ToothIcon,
  SparklesIcon,
  CubeTransparentIcon,
  BeakerIcon,
  RocketLaunchIcon,
  PhotoIcon,
  NewspaperIcon,
  BookOpenIcon,
  ChartBarIcon,
} from '@heroicons/react/24/outline';
import { useLocation, useNavigate } from 'react-router-dom';

interface NavItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  path: string;
  color: string;
}

const navItems: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: HomeIcon, path: '/', color: '#dc2626' },
  { id: 'chat', label: 'Chat', icon: ChatBubbleLeftIcon, path: '/chat', color: '#ea580c' },
  {
    id: 'image-generation',
    label: 'Images',
    icon: PhotoIcon,
    path: '/image-generation',
    color: '#f97316',
  },
  { id: 'news', label: 'News', icon: NewspaperIcon, path: '/news', color: '#fb923c' },
  { id: 'libraries', label: 'Libraries', icon: BookOpenIcon, path: '/libraries', color: '#fed7aa' },
  {
    id: 'service-monitoring',
    label: 'Monitor',
    icon: ChartBarIcon,
    path: '/service-monitoring',
    color: '#fdba74',
  },
  { id: 'services', label: 'Services', icon: ServerIcon, path: '/services', color: '#f59e0b' },
  { id: 'settings', label: 'Settings', icon: Cog6ToothIcon, path: '/settings', color: '#ffffff' },
];

export const LiquidNavBar: React.ComponentType = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const { scrollY } = useScroll();

  const navOpacity = useTransform(scrollY, [0, 100], [0.9, 1]);
  const navBlur = useTransform(scrollY, [0, 100], [20, 30]);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const currentPath = location.pathname;

  return (
    <motion.nav
      className={`fixed top-0 left-0 right-0 z-50 glass-nav window-controls-overlay ${scrolled ? 'scrolled' : ''}`}
      style={{
        opacity: navOpacity,
        backdropFilter: `blur(${navBlur}px)`,
      }}
      role='navigation'
      aria-label='Main navigation'
    >
      <div className='relative px-8 py-4'>
        {/* Enhanced Liquid Background with Red-Orange Theme */}
        <div className='absolute inset-0 overflow-hidden pointer-events-none'>
          <motion.div
            className='absolute -top-20 -left-20 w-40 h-40 rounded-full'
            style={{
              background:
                'radial-gradient(circle, rgba(220, 38, 38, 0.15), rgba(249, 115, 22, 0.08), transparent)',
              filter: 'blur(40px)',
            }}
            animate={{
              x: [0, 120, -20, 0],
              y: [0, -60, 30, 0],
              rotate: [0, 90, 180, 360],
            }}
            transition={{
              duration: 25,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
          <motion.div
            className='absolute -top-20 -right-20 w-40 h-40 rounded-full'
            style={{
              background:
                'radial-gradient(circle, rgba(249, 115, 22, 0.12), rgba(255, 255, 255, 0.06), transparent)',
              filter: 'blur(40px)',
            }}
            animate={{
              x: [0, -120, 20, 0],
              y: [0, 60, -30, 0],
              rotate: [360, 270, 90, 0],
            }}
            transition={{
              duration: 18,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
          <motion.div
            className='absolute -bottom-10 left-1/2 w-60 h-60 rounded-full'
            style={{
              background:
                'radial-gradient(circle, rgba(255, 255, 255, 0.08), rgba(249, 115, 22, 0.04), transparent)',
              filter: 'blur(60px)',
            }}
            animate={{
              x: [0, 80, -80, 0],
              scale: [1, 1.2, 0.8, 1],
            }}
            transition={{
              duration: 30,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
        </div>

        <div className='relative flex items-center justify-between'>
          {/* Logo - not draggable */}
          <motion.div
            className='flex items-center space-x-2 cursor-pointer'
            style={{ WebkitAppRegion: 'no-drag', appRegion: 'no-drag' } as React.CSSProperties}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate('/')}
            role='button'
            tabIndex={0}
            aria-label='Universal AI - Go to home page'
            onKeyDown={_e => {
              if (_e.key === 'Enter' || _e.key === ' ') {
                _e.preventDefault();
                navigate('/');
              }
            }}
          >
            <CubeTransparentIcon className='w-8 h-8 text-white' />
            <span className='text-xl font-bold bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent'>
              Universal AI
            </span>
          </motion.div>

          {/* Nav Items - not draggable */}
          <div
            className='flex items-center space-x-2'
            style={{ WebkitAppRegion: 'no-drag', appRegion: 'no-drag' } as React.CSSProperties}
          >
            {navItems.map(item => {
              const Icon = item.icon;
              const isActive = currentPath === item.path;
              const isHovered = hoveredItem === item.id;

              return (
                <motion.button
                  key={item.id}
                  className='relative px-4 py-2 rounded-xl transition-all group overflow-hidden'
                  onMouseEnter={() => setHoveredItem(item.id)}
                  onMouseLeave={() => setHoveredItem(null)}
                  onClick={() => navigate(item.path)}
                  whileHover={{
                    y: -3,
                    scale: 1.05,
                    transition: { type: 'spring', stiffness: 400, damping: 25 },
                  }}
                  whileTap={{
                    scale: 0.92,
                    y: 0,
                    transition: { duration: 0.1 },
                  }}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{
                    opacity: 1,
                    y: 0,
                    transition: { delay: 0.1 * navItems.indexOf(item) },
                  }}
                  aria-label={`Navigate to ${item.label}`}
                  aria-current={isActive ? 'page' : undefined}
                  role='button'
                  tabIndex={0}
                >
                  {/* Active/Hover Background */}
                  <AnimatePresence>
                    {(isActive || isHovered) && (
                      <motion.div
                        className='absolute inset-0 rounded-xl'
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        transition={{ duration: 0.2 }}
                        style={{
                          background: isActive
                            ? `linear-gradient(135deg, ${item.color}20, ${item.color}10)`
                            : `linear-gradient(135deg, ${item.color}10, transparent)`,
                          border: `1px solid ${item.color}30`,
                        }}
                      />
                    )}
                  </AnimatePresence>

                  {/* Liquid Hover Effect */}
                  {isHovered && (
                    <motion.div
                      className='absolute inset-0 rounded-xl pointer-events-none'
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                    >
                      <motion.div
                        className='absolute inset-0 rounded-xl'
                        style={{
                          background: `radial-gradient(circle at 50% 50%, ${item.color}20, transparent)`,
                        }}
                        animate={{
                          scale: [1, 1.5, 1],
                        }}
                        transition={{
                          duration: 1,
                          repeat: Infinity,
                        }}
                      />
                    </motion.div>
                  )}

                  <div className='relative flex items-center space-x-2 z-10'>
                    <div
                      style={{
                        filter: isHovered ? `drop-shadow(0 0 8px ${item.color})` : 'none',
                      }}
                    >
                      <Icon
                        className={`w-5 h-5 transition-colors ${
                          isActive ? 'text-white' : 'text-white/70'
                        }`}
                      />
                    </div>
                    <span
                      className={`text-sm font-medium transition-colors ${
                        isActive ? 'text-white' : 'text-white/70'
                      }`}
                    >
                      {item.label}
                    </span>
                  </div>

                  {/* Active Indicator */}
                  {isActive && (
                    <motion.div
                      className='absolute -bottom-1 left-1/2 w-1 h-1 rounded-full'
                      style={{
                        background: item.color,
                        boxShadow: `0 0 10px ${item.color}`,
                      }}
                      layoutId='activeIndicator'
                      initial={{ x: '-50%' }}
                      animate={{
                        x: '-50%',
                        scale: [1, 1.5, 1],
                      }}
                      transition={{
                        scale: {
                          duration: 2,
                          repeat: Infinity,
                        },
                      }}
                    />
                  )}
                </motion.button>
              );
            })}
          </div>

          {/* Right Actions */}
          <div className='flex items-center space-x-3'>
            <motion.button
              className='p-2 rounded-lg glass-button'
              whileHover={{ scale: 1.1, rotate: 180 }}
              whileTap={{ scale: 0.9 }}
              aria-label='Toggle AI suggestions'
              role='button'
              tabIndex={0}
            >
              <SparklesIcon className='w-5 h-5 text-white/70' />
            </motion.button>

            <motion.button
              className='p-2 rounded-lg glass-button'
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              aria-label='Experimental features'
              role='button'
              tabIndex={0}
            >
              <BeakerIcon className='w-5 h-5 text-white/70' />
            </motion.button>

            <motion.button
              className='px-4 py-2 rounded-xl glass-button bg-gradient-to-r from-purple-500/20 to-pink-500/20'
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              aria-label='Launch quick action'
              role='button'
              tabIndex={0}
            >
              <RocketLaunchIcon className='w-5 h-5 text-white' />
            </motion.button>
          </div>
        </div>

        {/* Progress Bar */}
        <motion.div
          className='absolute bottom-0 left-0 h-[1px] bg-gradient-to-r from-transparent via-white/50 to-transparent'
          initial={{ scaleX: 0 }}
          animate={{ scaleX: scrolled ? 1 : 0 }}
          transition={{ duration: 0.3 }}
          style={{ transformOrigin: 'left' }}
        />
      </div>
    </motion.nav>
  );
};
