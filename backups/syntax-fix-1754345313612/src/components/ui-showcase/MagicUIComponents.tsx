import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// Magic UI inspired components using Framer Motion and Tailwind CSS

// Animated Button Component
export const MagicButton: React.FC<{
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'gradient';
}> = ({ children, onClick, variant = 'primary' }) => {
  const variants = {
    primary: 'bg-blue-600 hover:bg-blue-700 text-white',
    secondary: 'bg-gray-200 hover:bg-gray-300 text-gray-800',
    gradient: 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white',
  };

  return (
    <motion.button
      className={`px-6 py-3 rounded-lg font-medium transition-all duration-200 shadow-md hover:shadow-lg ${variants[variant]}`}
      onClick={onClick}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {children}
    </motion.button>
  );
};

// Floating Card Component
export const FloatingCard: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className = '' }) => {
  return (
    <motion.div
      className={`bg-white rounded-xl shadow-xl p-6 backdrop-blur-lg bg-opacity-90 ${className}`}
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      whileHover={{ y: -5, shadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}
    >
      {children}
    </motion.div>
  );
};

// Particle Background Component
export const ParticleBackground: React.FC = () => {
  const particles = Array.from({ length: 50 }, (_, i) => i);

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden">
      {particles.map((particle) => (
        <motion.div
          key={particle}
          className="absolute w-2 h-2 bg-blue-400 rounded-full opacity-20"
          initial={{
            x: Math.random() * window.innerWidth,
            y: Math.random() * window.innerHeight,
          }}
          animate={{
            x: Math.random() * window.innerWidth,
            y: Math.random() * window.innerHeight,
          }}
          transition={{
            duration: Math.random() * 10 + 20,
            repeat: Infinity,
            repeatType: 'reverse',
          }}
        />
      ))}
    </div>
  );
};

// Stagger Animation Container
export const StaggerContainer: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className = '' }) => {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.3,
      },
    },
  };

  return (
    <motion.div
      className={className}
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {children}
    </motion.div>
  );
};

// Stagger Item
export const StaggerItem: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className = '' }) => {
  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        type: 'spring',
        stiffness: 100,
      },
    },
  };

  return (
    <motion.div className={className} variants={itemVariants}>
      {children}
    </motion.div>
  );
};

// Magic UI Showcase Component
export const MagicUIShowcase: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <ParticleBackground />
      
      <div className="relative z-10 max-w-6xl mx-auto">
        <StaggerContainer className="space-y-8">
          <StaggerItem>
            <h1 className="text-5xl font-bold text-center mb-8 bg-gradient-to-r from-blue-400 to-purple-600 bg-clip-text text-transparent">
              Magic UI Components
            </h1>
          </StaggerItem>

          <StaggerItem>
            <FloatingCard className="text-center">
              <h2 className="text-2xl font-semibold mb-4 text-gray-800">Animated Buttons</h2>
              <div className="flex gap-4 justify-center flex-wrap">
                <MagicButton variant="primary">Primary Button</MagicButton>
                <MagicButton variant="secondary">Secondary Button</MagicButton>
                <MagicButton variant="gradient">Gradient Button</MagicButton>
              </div>
            </FloatingCard>
          </StaggerItem>

          <StaggerItem>
            <FloatingCard>
              <h2 className="text-2xl font-semibold mb-4 text-gray-800">Features</h2>
              <div className="grid md:grid-cols-2 gap-4 text-gray-600">
                <div>
                  <h3 className="font-semibold mb-2">Smooth Animations</h3>
                  <p>All components feature smooth, performant animations using Framer Motion.</p>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Modern Design</h3>
                  <p>Clean, modern aesthetic with glassmorphism and gradient effects.</p>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Responsive</h3>
                  <p>Components adapt beautifully to different screen sizes.</p>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Accessible</h3>
                  <p>Built with accessibility and keyboard navigation in mind.</p>
                </div>
              </div>
            </FloatingCard>
          </StaggerItem>
        </StaggerContainer>
      </div>
    </div>
  );
};