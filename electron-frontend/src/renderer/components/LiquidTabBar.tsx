import React from 'react';
import { useState } from 'react';
import { motion, AnimatePresence, useMotionValue } from 'framer-motion';
// import { useSpring, animated } from '@react-spring/web';

interface Tab {
  id: string;
  label: string;
  content: React.ReactNode;
  color: string;
  icon?: React.ComponentType<{ className?: string }>;
}

interface LiquidTabBarProps {
  tabs: Tab[];
  defaultTab?: string;
  className?: string;
}

export const LiquidTabBar: React.ComponentType<LiquidTabBarProps> = ({
  tabs,
  defaultTab,
  className = '',
}) => {
  const [activeTab, setActiveTab] = useState(defaultTab || tabs[0]?.id);
  const [hoveredTab, setHoveredTab] = useState<string | null>(null);

  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const activeIndex = tabs.findIndex(tab => tab.id === activeTab);
  const activeTabData = tabs.find(tab => tab.id === activeTab);

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    mouseX.set(x);
    mouseY.set(y);
  };

  return (
    <div className={`w-full ${className}`}>
      {/* Tab Bar */}
      <div className='relative'>
        <motion.div
          className='relative flex p-1 glass rounded-2xl overflow-hidden'
          onMouseMove={handleMouseMove}
          onMouseLeave={() => {
            mouseX.set(0);
            mouseY.set(0);
          }}
        >
          {/* Liquid Background Effect */}
          <motion.div
            className='absolute inset-0 pointer-events-none'
            style={{
              background: `radial-gradient(circle at ${mouseX.get()}px ${mouseY.get()}px, rgba(255, 255, 255, 0.1), transparent)`,
            }}
          />

          {/* Morphing Background Shape */}
          <motion.div
            className='absolute top-0 left-0 w-full h-full pointer-events-none'
            animate={{
              background: [
                'linear-gradient(90deg, rgba(255, 0, 128, 0.05) 0%, transparent 100%)',
                'linear-gradient(90deg, transparent 0%, rgba(64, 224, 208, 0.05) 100%)',
                'linear-gradient(90deg, rgba(255, 140, 0, 0.05) 0%, transparent 100%)',
                'linear-gradient(90deg, transparent 0%, rgba(0, 255, 0, 0.05) 100%)',
                'linear-gradient(90deg, rgba(255, 0, 128, 0.05) 0%, transparent 100%)',
              ],
            }}
            transition={{
              duration: 10,
              repeat: Infinity,
              ease: 'linear',
            }}
          />

          {/* Active Tab Background */}
          <motion.div
            className='absolute h-full rounded-xl'
            style={{
              background: activeTabData
                ? `linear-gradient(135deg, ${activeTabData.color}30, ${activeTabData.color}20)`
                : 'rgba(255, 255, 255, 0.1)',
              backdropFilter: 'blur(10px)',
              border: `1px solid ${activeTabData?.color}40`,
            }}
            animate={{
              x: `${(100 / tabs.length) * activeIndex}%`,
              width: `${100 / tabs.length}%`,
            }}
            transition={{
              type: 'spring',
              stiffness: 300,
              damping: 30,
            }}
          />

          {/* Tab Buttons */}
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            const isHovered = hoveredTab === tab.id;

            return (
              <motion.button
                key={tab.id}
                className={`relative flex-1 flex items-center justify-center space-x-2 px-4 py-2 rounded-xl transition-colors z-10`}
                onClick={() => setActiveTab(tab.id)}
                onMouseEnter={() => setHoveredTab(tab.id)}
                onMouseLeave={() => setHoveredTab(null)}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.95 }}
              >
                {/* Hover Glow */}
                <AnimatePresence>
                  {isHovered && !isActive && (
                    <motion.div
                      className='absolute inset-0 rounded-xl pointer-events-none'
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      style={{
                        background: `radial-gradient(circle at center, ${tab.color}20, transparent)`,
                      }}
                    />
                  )}
                </AnimatePresence>

                {/* Icon */}
                {Icon && (
                  <motion.div
                    animate={{
                      rotate: isActive ? 360 : 0,
                      scale: isActive ? 1.1 : 1,
                    }}
                    transition={{ duration: 0.5 }}
                  >
                    <Icon
                      className={`w-4 h-4 transition-colors ${
                        isActive ? 'text-white' : 'text-white/60'
                      }`}
                    />
                  </motion.div>
                )}

                {/* Label */}
                <span
                  className={`text-sm font-medium transition-colors ${
                    isActive ? 'text-white' : 'text-white/60'
                  }`}
                >
                  {tab.label}
                </span>

                {/* Active Indicator Dot */}
                <AnimatePresence>
                  {isActive && (
                    <motion.div
                      className='absolute -bottom-1 left-1/2'
                      initial={{ scale: 0, x: '-50%' }}
                      animate={{ scale: 1, x: '-50%' }}
                      exit={{ scale: 0, x: '-50%' }}
                    >
                      <motion.div
                        className='w-1 h-1 rounded-full'
                        style={{
                          background: tab.color,
                          boxShadow: `0 0 10px ${tab.color}`,
                        }}
                        animate={{
                          scale: [1, 1.5, 1],
                        }}
                        transition={{
                          duration: 2,
                          repeat: Infinity,
                        }}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.button>
            );
          })}

          {/* Liquid Flow Effect */}
          <motion.div
            className='absolute bottom-0 left-0 w-full h-[1px] pointer-events-none'
            style={{
              background:
                'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent)',
            }}
            animate={{
              x: ['-100%', '100%'],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: 'linear',
            }}
          />
        </motion.div>
      </div>

      {/* Tab Content */}
      <motion.div className='mt-6 glass rounded-2xl p-6 overflow-hidden' layout>
        <AnimatePresence mode='wait'>
          {tabs.map(tab => {
            if (tab.id !== activeTab) return null;

            return (
              <motion.div
                key={tab.id}
                initial={{ opacity: 0, y: 20, filter: 'blur(10px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                exit={{ opacity: 0, y: -20, filter: 'blur(10px)' }}
                transition={{
                  type: 'spring',
                  stiffness: 300,
                  damping: 30,
                }}
              >
                {/* Content Glow */}
                <motion.div
                  className='absolute -inset-4 pointer-events-none'
                  style={{
                    background: `radial-gradient(circle at center, ${tab.color}10, transparent)`,
                    filter: 'blur(40px)',
                  }}
                  animate={{
                    opacity: [0.5, 0.8, 0.5],
                  }}
                  transition={{
                    duration: 3,
                    repeat: Infinity,
                  }}
                />

                {/* Tab Content */}
                <div className='relative z-10'>{tab.content}</div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};
