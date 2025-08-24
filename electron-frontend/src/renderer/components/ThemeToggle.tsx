import { motion } from 'framer-motion';
import { SunIcon, MoonIcon, ComputerDesktopIcon } from '@heroicons/react/24/outline';
import { useTheme } from '../theme/ThemeProvider';

interface ThemeToggleProps {
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const ThemeToggle: React.ComponentType<ThemeToggleProps> = ({
  showLabel = false,
  size = 'md',
  className = '',
}) => {
  const { theme, resolvedTheme, setTheme } = useTheme();

  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  };

  const buttonSizeClasses = {
    sm: 'p-1.5',
    md: 'p-2',
    lg: 'p-2.5',
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {showLabel && <span className='text-sm text-muted-foreground'>Theme:</span>}

      <div className='flex items-center gap-1 p-1 glass-card-theme rounded-lg'>
        {/* Light mode button */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setTheme('light')}
          className={`${buttonSizeClasses[size]} rounded-md transition-colors ${
            theme === 'light'
              ? 'bg-primary/20 text-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
          title='Light mode'
        >
          <SunIcon className={sizeClasses[size]} />
        </motion.button>

        {/* Dark mode button */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setTheme('dark')}
          className={`${buttonSizeClasses[size]} rounded-md transition-colors ${
            theme === 'dark'
              ? 'bg-primary/20 text-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
          title='Dark mode'
        >
          <MoonIcon className={sizeClasses[size]} />
        </motion.button>

        {/* System mode button */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setTheme('system')}
          className={`${buttonSizeClasses[size]} rounded-md transition-colors ${
            theme === 'system'
              ? 'bg-primary/20 text-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
          title='System theme'
        >
          <ComputerDesktopIcon className={sizeClasses[size]} />
        </motion.button>
      </div>

      {/* Current theme indicator */}
      {showLabel && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className='flex items-center gap-1 text-xs text-muted-foreground'
        >
          <span>({resolvedTheme})</span>
        </motion.div>
      )}
    </div>
  );
};

// Compact floating theme toggle for use in corners
export const FloatingThemeToggle: React.ComponentType = () => {
  const { resolvedTheme, toggleTheme } = useTheme();

  return (
    <motion.button
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ delay: 0.5, type: 'spring' }}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.9 }}
      onClick={toggleTheme}
      className='fixed bottom-4 right-4 z-50 p-3 glass-card-theme rounded-full shadow-lg'
      title='Toggle theme'
    >
      <motion.div
        animate={{ rotate: resolvedTheme === 'dark' ? 180 : 0 }}
        transition={{ type: 'spring', stiffness: 200, damping: 10 }}
      >
        {resolvedTheme === 'dark' ? (
          <MoonIcon className='w-6 h-6 text-primary' />
        ) : (
          <SunIcon className='w-6 h-6 text-primary' />
        )}
      </motion.div>
    </motion.button>
  );
};
