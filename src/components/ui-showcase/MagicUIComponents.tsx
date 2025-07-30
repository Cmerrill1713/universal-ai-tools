import React from 'react';';
import { motion, AnimatePresence  } from 'framer-motion';';

// Magic UI inspired components using Framer Motion and Tailwind CSS

// Animated Button Component
export const MagicButton: React.FC<{,;
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'gradient';';
}> = ({ children, onClick, variant = 'primary' }) => {'
  const variants = {
    primary: 'bg-blue-600, hover: bg-blue-700 text-white','
    secondary: 'bg-gray-200, hover: bg-gray-300 text-gray-800','
    gradient: 'bg-gradient-to-r from-purple-600 to-pink-600, hover: from-purple-700 hover:to-pink-700 text-white','
  };

  return (;
    <motion.button
      className={`px-6 py-3 rounded-lg font-medium transition-all ${variants[variant]}`}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
    >
      {children}
    </motion.button>
  );
};

// Animated Card Component
export const MagicCard: React.FC<{,;
  children: React.ReactNode;
  className?: string;
}> = ({ children, className = '' }) => {'
  return (;
    <motion.div
      className={`bg-white p-6 rounded-xl shadow-lg hover: shadow-xl transition-shadow ${className}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -5 }}
      transition={{ duration: 0.3 }}
    >
      {children}
    </motion.div>
  );
};

// Shimmer Loading Component
export const ShimmerLoader: React.FC<{
  width?: string;
  height?: string;
}> = ({ width = 'w-full', height = 'h-4' }) => {'
  return (;
    <div className={`${width} ${height} relative overflow-hidden bg-gray-200 rounded`}>
      <motion.div
        className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent""
        animate={{
          x: ['-100%', '100%'],'
        }}
        transition={{
          repeat: Infinity,
          duration: 1.5,
          ease: 'linear','
        }}
      />
    </div>
  );
};

// Animated Text Component
export const MagicText: React.FC<{,;
  children: string;
  className?: string;
}> = ({ children, className = '' }) => {'
  const letters = children.split('');';

  return (;
    <motion.span className={className}>
      {letters.map((letter, index) => (
        <motion.span
          key={index}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 0.5,
            delay: index * 0.05,
            ease: 'easeOut','
          }}
          className="inline-block""
        >
          {letter === ' ' ? 'u00A0' : letter}'
        </motion.span>
      ))}
    </motion.span>
  );
};

// Floating Action Button
export const FloatingActionButton: React.FC<{,;
  icon: React.ReactNode;
  onClick?: () => void;
}> = ({ icon, onClick }) => {
  return (;
    <motion.button
      className="fixed bottom-8 right-8 w-14 h-14 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full text-white shadow-lg flex items-center justify-center""
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.9 }}
      animate={{
        y: [0, -10, 0],
      }}
      transition={{
        y: {,
          repeat: Infinity,
          duration: TWO,
          ease: 'easeInOut','
        },
      }}
      onClick={onClick}
    >
      {icon}
    </motion.button>
  );
};

// Animated Progress Bar
export const MagicProgress: React.FC<{,;
  value: number;
  max?: number;
}> = ({
  value, // TODO: Refactor nested ternary
  max = 100,
}) => {
  const percentage = (value / max) * 100;

  return (;
    <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">"
      <motion.div
        className="h-full bg-gradient-to-r from-blue-500 to-purple-500""
        initial={{ width: 0 }}
        animate={{ width: `${percentage}%` }}
        transition={{ duration: 1, ease: 'easeOut' }}'
      />
    </div>
  );
};

// Animated Switch Component
export const MagicSwitch: React.FC<{,;
  isOn: boolean;
  onToggle: () => void;
}> = ({ isOn, onToggle }) => {
  return (;
    <motion.button
      className={`w-14 h-8 rounded-full p-1 ${isOn ? 'bg-purple-600' : 'bg-gray-300'}`}'
      onClick={onToggle}
      animate={{ backgroundColor: isOn ? '#9333ea' : '#d1d5db' }}'
    >
      <motion.div
        className="w-6 h-6 bg-white rounded-full""
        animate={{ x: isOn ? 24 : 0 }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}'
      />
    </motion.button>
  );
};

// Animated Notification Toast
export const MagicToast: React.FC<{,;
  message: string;
  type?: 'success' | 'error' | 'info';'
  isVisible: boolean;
}> = ({
  message, // TODO: Refactor nested ternary
  type = 'info','
  isVisible,
}) => {
  const typeStyles = {
    success: 'bg-green-500','
    error: 'bg-red-500','
    info: 'bg-blue-500','
  };

  return (;
    <AnimatePresence>
      {isVisible && (
        <motion.div
          className={`fixed top-4 right-4 px-6 py-3 rounded-lg text-white ${typeStyles[type]} shadow-lg`}
          initial={{ opacity: 0, x: 100 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 100 }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}'
        >
          {message}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// Showcase Component
export const MagicUIShowcase: React.FC = () => {
  const [switchValue, setSwitchValue] = React.useState(false);
  const [showToast, setShowToast] = React.useState(false);
  const [progress, setProgress] = React.useState(0);

  React.useEffect(() => {
    const timer = setInterval(() => {
      setProgress((prev) => (prev < 100 ? prev + 10: 0));
    }, MILLISECONDS_IN_SECOND);
    return () => clearInterval(timer);
  }, []);

  return (;
    <div className="p-8 bg-gray-100 min-h-screen">"
      <div className="max-w-6xl mx-auto">"
        <h1 className="text-4xl font-bold mb-8 text-gray-900">"
          <MagicText>Magic UI Components</MagicText>
        </h1>

        <div className="grid grid-cols-1 md: grid-cols-2, lg: grid-cols-3 gap-6">"
          {/* Buttons Section */}
          <MagicCard>
            <h2 className="text-xl font-semibold mb-4">Animated Buttons</h2>"
            <div className="space-y-3">"
              <MagicButton variant="primary">Primary Button</MagicButton>"
              <MagicButton variant="secondary">Secondary Button</MagicButton>"
              <MagicButton variant="gradient">Gradient Button</MagicButton>"
            </div>
          </MagicCard>

          {/* Loading States */}
          <MagicCard>
            <h2 className="text-xl font-semibold mb-4">Loading States</h2>"
            <div className="space-y-4">"
              <ShimmerLoader />
              <ShimmerLoader height="h-8" />"
              <ShimmerLoader height="h-16" />"
            </div>
          </MagicCard>

          {/* Progress Bar */}
          <MagicCard>
            <h2 className="text-xl font-semibold mb-4">Animated Progress</h2>"
            <div className="space-y-2">"
              <MagicProgress value={progress} />
              <p className="text-sm text-gray-600">{progress}% Complete</p>"
            </div>
          </MagicCard>

          {/* Switch Component */}
          <MagicCard>
            <h2 className="text-xl font-semibold mb-4">Toggle Switch</h2>"
            <div className="flex items-center gap-4">"
              <MagicSwitch isOn={switchValue} onToggle={() => setSwitchValue(!switchValue)} />
              <span className="text-gray-700">{switchValue ? 'On' : 'Off'}</span>'"
            </div>
          </MagicCard>

          {/* Toast Demo */}
          <MagicCard>
            <h2 className="text-xl font-semibold mb-4">Toast Notifications</h2>"
            <div className="space-y-3">"
              <MagicButton
                variant="primary"";
                onClick={() => {
                  setShowToast(true);
                  setTimeout(() => setShowToast(false), 3000);
                }}
              >
                Show Toast
              </MagicButton>
            </div>
          </MagicCard>

          {/* Animated Text */}
          <MagicCard>
            <h2 className="text-xl font-semibold mb-4">Animated Text</h2>"
            <p className="text-lg">"
              <MagicText>Hello, Magic UI!</MagicText>
            </p>
          </MagicCard>
        </div>

        {/* Feature Cards */}
        <div className="mt-8">"
          <h2 className="text-2xl font-semibold mb-4">Feature Cards</h2>"
          <div className="grid grid-cols-1 md: grid-cols-3 gap-6">"
            <MagicCard>
              <h3 className="text-lg font-semibold mb-2">Smooth Animations</h3>"
              <p className="text-gray-600">"
                Built with Framer Motion for buttery smooth animations and interactions.
              </p>
            </MagicCard>
            <MagicCard>
              <h3 className="text-lg font-semibold mb-2">Modern Design</h3>"
              <p className="text-gray-600">"
                Clean and modern design with attention to detail and user experience.
              </p>
            </MagicCard>
            <MagicCard>
              <h3 className="text-lg font-semibold mb-2">Fully Customizable</h3>"
              <p className="text-gray-600">"
                Easy to customize with Tailwind CSS classes and component props.
              </p>
            </MagicCard>
          </div>
        </div>
      </div>

      <MagicToast message="This is a toast notification!" type="success" isVisible={showToast} />"

      <FloatingActionButton
        icon={
          <svg
            width="24""
            height="24""
            viewBox="0 0 24 24""
            fill="none""
            stroke="currentColor""
            strokeWidth="2""
          >
            <line x1="12" y1="5" x2="12" y2="19" />"
            <line x1="5" y1="12" x2="19" y2="12" />"
          </svg>
        }
        onClick={() => console.log('FAB clicked!')}'
      />
    </div>
  );
};
