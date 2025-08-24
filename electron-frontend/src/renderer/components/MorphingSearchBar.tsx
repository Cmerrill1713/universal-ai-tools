import React from 'react';
import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
import { useSpring, animated } from '@react-spring/web';
import {
  MagnifyingGlassIcon,
  XMarkIcon,
  MicrophoneIcon,
  PhotoIcon,
  DocumentIcon,
  CommandLineIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';

interface SearchSuggestion {
  id: string;
  text: string;
  icon: React.ComponentType<{ className?: string }>;
  category: string;
  color: string;
}

const suggestions: SearchSuggestion[] = [
  {
    id: '1',
    text: 'Generate image with DALL-E',
    icon: PhotoIcon,
    category: 'AI',
    color: '#dc2626',
  },
  { id: '2', text: 'Analyze document', icon: DocumentIcon, category: 'Tools', color: '#ea580c' },
  {
    id: '3',
    text: 'Run terminal command',
    icon: CommandLineIcon,
    category: 'System',
    color: '#f97316',
  },
  {
    id: '4',
    text: 'Start voice conversation',
    icon: MicrophoneIcon,
    category: 'Chat',
    color: '#fb923c',
  },
];

export const MorphingSearchBar: React.ComponentType = () => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const glowX = useTransform(mouseX, [-100, 100], [-50, 50]);
  const glowY = useTransform(mouseY, [-50, 50], [-25, 25]);

  const [springProps, api] = useSpring(() => ({
    width: 300,
    opacity: 0.8,
    config: { tension: 200, friction: 20 },
  }));

  useEffect(() => {
    api.start({
      width: isExpanded ? 500 : 300,
      opacity: isFocused ? 1 : 0.8,
    });
  }, [isExpanded, isFocused, api]);

  const handleMouseMove = (_e: React.MouseEvent) => {
    const rect = _e.currentTarget.getBoundingClientRect();
    const x = ((_e.clientX - rect.left) / rect.width - 0.5) * 200;
    const y = ((_e.clientY - rect.top) / rect.height - 0.5) * 100;
    mouseX.set(x);
    mouseY.set(y);
  };

  const handleFocus = () => {
    setIsFocused(true);
    setIsExpanded(true);
    setShowSuggestions(true);
  };

  const handleBlur = () => {
    setTimeout(() => {
      setIsFocused(false);
      if (!searchValue) {
        setIsExpanded(false);
      }
      setShowSuggestions(false);
    }, 200);
  };

  const filteredSuggestions = suggestions.filter(s =>
    searchValue ? s.text.toLowerCase().includes(searchValue.toLowerCase()) : true
  );

  return (
    <div className='relative'>
      <animated.div style={springProps} className='relative' onMouseMove={handleMouseMove}>
        <motion.div
          className='relative glass rounded-2xl overflow-hidden'
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        >
          {/* Morphing Background */}
          <motion.div
            className='absolute inset-0 pointer-events-none'
            style={{
              background:
                'linear-gradient(135deg, rgba(255, 0, 128, 0.05), rgba(64, 224, 208, 0.05))',
            }}
            animate={{
              background: [
                'linear-gradient(135deg, rgba(255, 0, 128, 0.05), rgba(64, 224, 208, 0.05))',
                'linear-gradient(135deg, rgba(64, 224, 208, 0.05), rgba(255, 140, 0, 0.05))',
                'linear-gradient(135deg, rgba(255, 140, 0, 0.05), rgba(0, 255, 0, 0.05))',
                'linear-gradient(135deg, rgba(0, 255, 0, 0.05), rgba(255, 0, 128, 0.05))',
              ],
            }}
            transition={{
              duration: 10,
              repeat: Infinity,
              ease: 'linear',
            }}
          />

          {/* Glow Effect */}
          <motion.div
            className='absolute inset-0 pointer-events-none'
            style={{
              x: glowX,
              y: glowY,
            }}
          >
            <div
              className='absolute w-32 h-32 rounded-full'
              style={{
                background: 'radial-gradient(circle, rgba(255, 255, 255, 0.1), transparent)',
                filter: 'blur(20px)',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
              }}
            />
          </motion.div>

          <div className='relative flex items-center px-4 py-3'>
            {/* Search Icon */}
            <motion.div
              animate={{
                rotate: isExpanded ? 360 : 0,
                scale: isFocused ? 1.2 : 1,
              }}
              transition={{ duration: 0.5 }}
              className='mr-3'
            >
              <MagnifyingGlassIcon className='w-5 h-5 text-white/70' />
            </motion.div>

            {/* Input Field */}
            <input
              ref={inputRef}
              type='text'
              value={searchValue}
              onChange={_e => setSearchValue(_e.target.value)}
              onFocus={handleFocus}
              onBlur={handleBlur}
              placeholder='Search or ask anything...'
              className='flex-1 bg-transparent border-none outline-none text-white placeholder-white/40 text-sm'
            />

            {/* Action Buttons */}
            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  className='flex items-center space-x-2 ml-2'
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                >
                  <motion.button
                    className='p-1.5 rounded-lg hover:bg-white/10 transition-colors'
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    aria-label='Start voice input'
                  >
                    <MicrophoneIcon className='w-4 h-4 text-white/60' aria-hidden='true' />
                  </motion.button>

                  <motion.button
                    className='p-1.5 rounded-lg hover:bg-white/10 transition-colors'
                    whileHover={{ scale: 1.1, rotate: 180 }}
                    whileTap={{ scale: 0.9 }}
                    aria-label='AI suggestions'
                  >
                    <SparklesIcon className='w-4 h-4 text-white/60' aria-hidden='true' />
                  </motion.button>

                  {searchValue && (
                    <motion.button
                      className='p-1.5 rounded-lg hover:bg-white/10 transition-colors'
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => setSearchValue('')}
                      aria-label='Clear search'
                    >
                      <XMarkIcon className='w-4 h-4 text-white/60' aria-hidden='true' />
                    </motion.button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Liquid Border Animation */}
          <motion.div
            className='absolute bottom-0 left-0 right-0 h-[2px]'
            style={{
              background:
                'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.5), transparent)',
            }}
            animate={{
              x: [-500, 500],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: 'linear',
            }}
          />
        </motion.div>

        {/* Suggestions Dropdown */}
        <AnimatePresence>
          {showSuggestions && filteredSuggestions.length > 0 && (
            <motion.div
              className='absolute top-full mt-2 w-full glass rounded-xl overflow-hidden'
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.2 }}
            >
              {filteredSuggestions.map((suggestion, index) => {
                const Icon = suggestion.icon;
                return (
                  <motion.button
                    key={suggestion.id}
                    className='w-full px-4 py-3 flex items-center space-x-3 hover:bg-white/10 transition-colors text-left'
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    whileHover={{ x: 5 }}
                    aria-label={`Search suggestion: ${suggestion.text}`}
                  >
                    <div
                      className='p-2 rounded-lg'
                      style={{
                        background: `linear-gradient(135deg, ${suggestion.color}20, ${suggestion.color}10)`,
                      }}
                    >
                      <Icon className='w-4 h-4 text-white/70' />
                    </div>
                    <div className='flex-1'>
                      <div className='text-sm text-white/90'>{suggestion.text}</div>
                      <div className='text-xs text-white/40'>{suggestion.category}</div>
                    </div>
                    <motion.div
                      className='w-1 h-1 rounded-full'
                      style={{
                        background: suggestion.color,
                        boxShadow: `0 0 10px ${suggestion.color}`,
                      }}
                      animate={{
                        scale: [1, 1.5, 1],
                        opacity: [0.5, 1, 0.5],
                      }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                      }}
                    />
                  </motion.button>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </animated.div>
    </div>
  );
};
