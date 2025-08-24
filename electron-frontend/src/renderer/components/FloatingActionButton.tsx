import React from 'react';
import { useState } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
import Logger from '../utils/logger';
// import { useSpring, animated } from '@react-spring/web';
import {
  PlusIcon,
  ChatBubbleLeftRightIcon,
  PhotoIcon,
  DocumentPlusIcon,
  MicrophoneIcon,
  VideoCameraIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';

interface ActionItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  onClick: () => void;
}

const defaultActions: ActionItem[] = [
  {
    id: 'chat',
    label: 'New Chat',
    icon: ChatBubbleLeftRightIcon,
    color: '#ff0080',
    onClick: () => {
      if (process.env.NODE_ENV === 'development') {
        Logger.warn('New chat');
      }
    },
  },
  {
    id: 'image',
    label: 'Generate Image',
    icon: PhotoIcon,
    color: '#40e0d0',
    onClick: () => Logger.warn('Generate image'),
  },
  {
    id: 'document',
    label: 'Upload Document',
    icon: DocumentPlusIcon,
    color: '#ff8c00',
    onClick: () => Logger.warn('Upload document'),
  },
  {
    id: 'voice',
    label: 'Voice Input',
    icon: MicrophoneIcon,
    color: '#00ff00',
    onClick: () => Logger.warn('Voice input'),
  },
  {
    id: 'video',
    label: 'Video Call',
    icon: VideoCameraIcon,
    color: '#9333ea',
    onClick: () => Logger.warn('Video call'),
  },
];

interface FloatingActionButtonProps {
  actions?: ActionItem[];
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
}

export const FloatingActionButton: React.ComponentType<FloatingActionButtonProps> = ({
  actions = defaultActions,
  position = 'bottom-right',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const rotateX = useTransform(mouseY, [-0.5, 0.5], [5, -5]);
  const rotateY = useTransform(mouseX, [-0.5, 0.5], [-5, 5]);

  const positionClasses = {
    'bottom-right': 'bottom-6 right-6',
    'bottom-left': 'bottom-6 left-6',
    'top-right': 'top-24 right-6',
    'top-left': 'top-24 left-6',
  };

  const actionPositions = {
    'bottom-right': (index: number) => ({
      x: -Math.cos((index * Math.PI) / (actions.length - 1) / 2) * 60,
      y: -Math.sin((index * Math.PI) / (actions.length - 1) / 2) * 60,
    }),
    'bottom-left': (index: number) => ({
      x: Math.cos((index * Math.PI) / (actions.length - 1) / 2) * 60,
      y: -Math.sin((index * Math.PI) / (actions.length - 1) / 2) * 60,
    }),
    'top-right': (index: number) => ({
      x: -Math.cos((index * Math.PI) / (actions.length - 1) / 2) * 60,
      y: Math.sin((index * Math.PI) / (actions.length - 1) / 2) * 60,
    }),
    'top-left': (index: number) => ({
      x: Math.cos((index * Math.PI) / (actions.length - 1) / 2) * 60,
      y: Math.sin((index * Math.PI) / (actions.length - 1) / 2) * 60,
    }),
  };

  const handleMouseMove = (event: React.MouseEvent<HTMLElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;
    mouseX.set(x);
    mouseY.set(y);
  };

  const handleMouseLeave = () => {
    mouseX.set(0);
    mouseY.set(0);
  };

  return (
    <div className={`fixed ${positionClasses[position]} z-40`}>
      {/* Action Items */}
      <AnimatePresence>
        {isOpen && (
          <>
            {actions.map((action, index) => {
              const Icon = action.icon;
              const pos = actionPositions[position](index);

              return (
                <motion.button
                  key={action.id}
                  className='absolute glass-card-spectrum elevation-4 p-4 font-system group'
                  style={{
                    borderRadius: '20px',
                  }}
                  initial={{ scale: 0, opacity: 0, rotate: -180 }}
                  animate={{
                    scale: 1,
                    opacity: 1,
                    rotate: 0,
                    x: pos.x,
                    y: pos.y,
                  }}
                  exit={{ scale: 0, opacity: 0, rotate: 180 }}
                  transition={{
                    delay: index * 0.08,
                    type: 'spring',
                    stiffness: 400,
                    damping: 25,
                  }}
                  whileHover={{
                    scale: 1.15,
                    rotateY: 15,
                    rotateX: 10,
                    y: pos.y - 8,
                  }}
                  whileTap={{ scale: 0.95 }}
                  onClick={action.onClick}
                  aria-label={action.label}
                >
                  {/* Morphing Background */}
                  <motion.div
                    className='absolute inset-0 rounded-2xl opacity-60'
                    style={{
                      background: `linear-gradient(135deg, ${action.color}30, ${action.color}15, transparent)`,
                    }}
                    animate={{
                      rotate: [0, 360],
                      scale: [0.8, 1.1, 0.8],
                    }}
                    transition={{
                      duration: 4,
                      repeat: Infinity,
                      ease: 'linear',
                    }}
                  />

                  {/* Spectral Glow Ring */}
                  <motion.div
                    className='absolute inset-0 rounded-2xl pointer-events-none'
                    style={{
                      background: `conic-gradient(from ${index * 90}deg, ${action.color}60, transparent, ${action.color}60)`,
                      filter: 'blur(8px)',
                    }}
                    animate={{
                      rotate: [0, 360],
                      opacity: [0.3, 0.8, 0.3],
                    }}
                    transition={{
                      duration: 3,
                      repeat: Infinity,
                      ease: 'linear',
                      delay: index * 0.5,
                    }}
                  />

                  {/* Icon with 3D Effect */}
                  <motion.div
                    className='relative z-10'
                    animate={{
                      rotateY: [0, 10, -10, 0],
                      rotateZ: [0, 2, -2, 0],
                    }}
                    transition={{
                      duration: 6,
                      repeat: Infinity,
                      delay: index * 1.5,
                    }}
                  >
                    <Icon className='w-6 h-6 text-white filter drop-shadow-lg' />
                  </motion.div>

                  {/* Premium Tooltip */}
                  <motion.div
                    className='absolute bottom-full mb-4 left-1/2 transform -translate-x-1/2 pointer-events-none'
                    initial={{ opacity: 0, y: 10, scale: 0.8 }}
                    whileHover={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                  >
                    <div className='glass-card-floating px-4 py-2 whitespace-nowrap elevation-6'>
                      <span className='text-xs font-medium text-white font-system'>
                        {action.label}
                      </span>
                      {/* Tooltip Arrow */}
                      <div className='absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-white/20' />
                    </div>
                  </motion.div>

                  {/* Particle Burst Effect */}
                  <motion.div
                    className='absolute inset-0 pointer-events-none'
                    initial={{ opacity: 0 }}
                    whileHover={{ opacity: 1 }}
                  >
                    {[...Array(3)].map((_, i) => (
                      <motion.div
                        key={i}
                        className='absolute w-1 h-1 rounded-full'
                        style={{
                          background: action.color,
                          left: '50%',
                          top: '50%',
                        }}
                        animate={{
                          x: [0, Math.cos((i * Math.PI * 2) / 3) * 30],
                          y: [0, Math.sin((i * Math.PI * 2) / 3) * 30],
                          scale: [0, 1, 0],
                          opacity: [0, 1, 0],
                        }}
                        transition={{
                          duration: 1,
                          repeat: Infinity,
                          delay: i * 0.2,
                        }}
                      />
                    ))}
                  </motion.div>
                </motion.button>
              );
            })}
          </>
        )}
      </AnimatePresence>

      {/* Main FAB Button - Premium Redesign */}
      <motion.button
        className='relative w-16 h-16 glass-card-spectrum elevation-6 rounded-3xl overflow-hidden font-system group'
        style={{
          rotateX,
          rotateY,
          transformStyle: 'preserve-3d',
        }}
        onClick={() => setIsOpen(!isOpen)}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onMouseEnter={() => setIsHovered(true)}
        aria-label={isOpen ? 'Close actions menu' : 'Open actions menu'}
        aria-expanded={isOpen}
        onMouseOut={() => setIsHovered(false)}
        animate={{
          rotate: isOpen ? 45 : 0,
        }}
        whileHover={{
          scale: 1.15,
          rotateY: 10,
          rotateX: 5,
        }}
        whileTap={{ scale: 0.92 }}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      >
        {/* Spectral Flowing Background */}
        <motion.div
          className='absolute inset-0 rounded-3xl'
          animate={{
            background: [
              'radial-gradient(circle at 30% 30%, rgba(255, 0, 0, 0.4), transparent 70%)',
              'radial-gradient(circle at 70% 30%, rgba(255, 69, 0, 0.4), transparent 70%)',
              'radial-gradient(circle at 70% 70%, rgba(255, 165, 0, 0.4), transparent 70%)',
              'radial-gradient(circle at 30% 70%, rgba(255, 255, 255, 0.3), transparent 70%)',
              'radial-gradient(circle at 50% 50%, rgba(0, 191, 255, 0.4), transparent 70%)',
              'radial-gradient(circle at 30% 30%, rgba(255, 0, 0, 0.4), transparent 70%)',
            ],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: 'linear',
          }}
        />

        {/* Morphing Spectral Ring */}
        <motion.div
          className='absolute inset-1 rounded-3xl pointer-events-none'
          style={{
            background:
              'conic-gradient(from 0deg, #FF000080, #FF450080, #FFA50080, #FFFFFF60, #00BFFF80, #FF000080)',
            filter: 'blur(12px)',
          }}
          animate={{
            rotate: [0, 360],
            scale: [0.8, 1.2, 0.8],
            opacity: [0.4, 0.8, 0.4],
          }}
          transition={{
            duration: 6,
            repeat: Infinity,
            ease: 'linear',
          }}
        />

        {/* Premium Glass Inner Surface */}
        <motion.div
          className='absolute inset-2 rounded-2xl'
          style={{
            background:
              'linear-gradient(135deg, rgba(255, 255, 255, 0.15), rgba(255, 255, 255, 0.05))',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
          }}
          animate={{
            opacity: [0.8, 1, 0.8],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />

        {/* Enhanced Icon with 3D Effects */}
        <div className='relative z-10 flex items-center justify-center w-full h-full'>
          <AnimatePresence mode='wait'>
            {isOpen ? (
              <motion.div
                key='close'
                initial={{ rotate: -180, opacity: 0, scale: 0.3 }}
                animate={{ rotate: 0, opacity: 1, scale: 1 }}
                exit={{ rotate: 180, opacity: 0, scale: 0.3 }}
                transition={{
                  type: 'spring',
                  stiffness: 400,
                  damping: 25,
                  duration: 0.4,
                }}
                style={{
                  filter: 'drop-shadow(0 4px 8px rgba(0, 0, 0, 0.3))',
                }}
              >
                <motion.div
                  animate={{
                    rotateY: [0, 15, -15, 0],
                    rotateZ: [0, 3, -3, 0],
                  }}
                  transition={{
                    duration: 4,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  }}
                >
                  <PlusIcon className='w-7 h-7 text-white' />
                </motion.div>
              </motion.div>
            ) : (
              <motion.div
                key='sparkles'
                initial={{ scale: 0, opacity: 0, rotate: -90 }}
                animate={{ scale: 1, opacity: 1, rotate: 0 }}
                exit={{ scale: 0, opacity: 0, rotate: 90 }}
                transition={{
                  type: 'spring',
                  stiffness: 400,
                  damping: 25,
                  duration: 0.4,
                }}
                style={{
                  filter: 'drop-shadow(0 4px 8px rgba(0, 0, 0, 0.3))',
                }}
              >
                <motion.div
                  animate={{
                    rotateY: [0, 10, -10, 0],
                    rotateZ: [0, 2, -2, 0],
                    scale: [1, 1.1, 1],
                  }}
                  transition={{
                    duration: 5,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  }}
                >
                  <SparklesIcon className='w-7 h-7 text-white' />
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Spectral Pulse Effect */}
        <AnimatePresence>
          {!isOpen && (
            <>
              <motion.div
                className='absolute inset-0 rounded-3xl pointer-events-none'
                style={{
                  border: '2px solid rgba(255, 0, 0, 0.4)',
                }}
                initial={{ scale: 1, opacity: 0 }}
                animate={{
                  scale: [1, 1.6, 2.2],
                  opacity: [0.6, 0.3, 0],
                }}
                transition={{
                  duration: 2.5,
                  repeat: Infinity,
                  repeatDelay: 0.8,
                  ease: 'easeOut',
                }}
              />
              <motion.div
                className='absolute inset-0 rounded-3xl pointer-events-none'
                style={{
                  border: '1px solid rgba(255, 165, 0, 0.3)',
                }}
                initial={{ scale: 1, opacity: 0 }}
                animate={{
                  scale: [1, 1.4, 1.8],
                  opacity: [0.4, 0.2, 0],
                }}
                transition={{
                  duration: 2.5,
                  repeat: Infinity,
                  repeatDelay: 1.2,
                  ease: 'easeOut',
                  delay: 0.4,
                }}
              />
            </>
          )}
        </AnimatePresence>

        {/* Enhanced Spectral Hover Glow */}
        <AnimatePresence>
          {isHovered && (
            <motion.div
              className='absolute -inset-3 rounded-3xl pointer-events-none'
              style={{
                background:
                  'radial-gradient(circle, rgba(255, 0, 0, 0.2), rgba(255, 165, 0, 0.15), rgba(255, 255, 255, 0.1), transparent)',
                filter: 'blur(24px)',
              }}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{
                opacity: [0.8, 1, 0.8],
                scale: [0.8, 1.2, 0.8],
              }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            />
          )}
        </AnimatePresence>
      </motion.button>

      {/* Background Blur when Open */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className='fixed inset-0 -z-10'
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsOpen(false)}
            style={{
              background: 'rgba(0, 0, 0, 0.2)',
              backdropFilter: 'blur(5px)',
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
};
