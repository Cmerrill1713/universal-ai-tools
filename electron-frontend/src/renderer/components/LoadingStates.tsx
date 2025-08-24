import { motion, AnimatePresence } from 'framer-motion';

// Skeleton base component
interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular' | 'rounded';
  width?: string | number;
  height?: string | number;
  animation?: 'pulse' | 'wave' | 'none';
}

export const Skeleton: React.ComponentType<SkeletonProps> = ({
  className = '',
  variant = 'text',
  width,
  height,
  animation = 'pulse',
}) => {
  const variantClasses = {
    text: 'h-4 rounded',
    circular: 'rounded-full',
    rectangular: 'rounded-none',
    rounded: 'rounded-lg',
  };

  const animationClasses = {
    pulse: 'animate-pulse',
    wave: 'animate-shimmer',
    none: '',
  };

  const style: React.CSSProperties = {
    width: width || (variant === 'circular' ? '40px' : '100%'),
    height: height || (variant === 'circular' ? '40px' : variant === 'text' ? '16px' : '100px'),
  };

  return (
    <motion.div
      className={`bg-gradient-to-r from-red-200/20 via-orange-200/30 to-white/20 backdrop-blur-sm ${variantClasses[variant]} ${animationClasses[animation]} ${className}`}
      style={style}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{
        opacity: 1,
        scale: 1,
        background: [
          'linear-gradient(90deg, rgba(220, 38, 38, 0.1), rgba(249, 115, 22, 0.15), rgba(255, 255, 255, 0.1))',
          'linear-gradient(90deg, rgba(249, 115, 22, 0.15), rgba(255, 255, 255, 0.1), rgba(220, 38, 38, 0.1))',
          'linear-gradient(90deg, rgba(255, 255, 255, 0.1), rgba(220, 38, 38, 0.1), rgba(249, 115, 22, 0.15))',
        ],
      }}
      transition={{
        duration: 0.3,
        background: {
          duration: 2,
          repeat: Infinity,
          ease: 'easeInOut',
        },
      }}
    />
  );
};

// Card skeleton
export const CardSkeleton: React.ComponentType<{ className?: string }> = ({ className = '' }) => {
  return (
    <div className={`glass-card p-6 rounded-xl ${className}`}>
      <Skeleton variant='circular' className='mb-4' />
      <Skeleton variant='text' className='mb-2' width='60%' />
      <Skeleton variant='text' className='mb-4' width='100%' />
      <div className='space-y-2'>
        <Skeleton variant='text' width='90%' />
        <Skeleton variant='text' width='80%' />
        <Skeleton variant='text' width='70%' />
      </div>
    </div>
  );
};

// List skeleton
export const ListSkeleton: React.ComponentType<{ count?: number; className?: string }> = ({
  count = 5,
  className = '',
}) => {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className='glass-card p-4 rounded-lg flex items-center gap-4'>
          <Skeleton variant='circular' />
          <div className='flex-1 space-y-2'>
            <Skeleton variant='text' width='40%' />
            <Skeleton variant='text' width='60%' height={12} />
          </div>
        </div>
      ))}
    </div>
  );
};

// Chat message skeleton
export const ChatMessageSkeleton: React.ComponentType<{ isUser?: boolean }> = ({
  isUser = false,
}) => {
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div className={`flex gap-3 max-w-[70%] ${isUser ? 'flex-row-reverse' : ''}`}>
        <Skeleton variant='circular' width={40} height={40} />
        <div className='space-y-2'>
          <Skeleton variant='rounded' width={200} height={60} />
          <Skeleton variant='text' width={100} height={12} />
        </div>
      </div>
    </div>
  );
};

// Spinner component
interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  color?: string;
  className?: string;
}

export const Spinner: React.ComponentType<SpinnerProps> = ({
  size = 'md',
  color = 'currentColor',
  className = '',
}) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16',
  };

  return (
    <motion.div
      animate={{ rotate: 360 }}
      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
      className={`${sizeClasses[size]} ${className}`}
    >
      <svg
        className='w-full h-full'
        viewBox='0 0 24 24'
        fill='none'
        xmlns='http://www.w3.org/2000/svg'
      >
        <circle className='opacity-25' cx='12' cy='12' r='10' stroke={color} strokeWidth='4' />
        <path
          className='opacity-75'
          fill={color}
          d='M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z'
        />
      </svg>
    </motion.div>
  );
};

// Loading overlay
interface LoadingOverlayProps {
  isLoading: boolean;
  message?: string;
  fullScreen?: boolean;
  blur?: boolean;
}

export const LoadingOverlay: React.ComponentType<LoadingOverlayProps> = ({
  isLoading,
  message,
  fullScreen = false,
  blur = true,
}) => {
  return (
    <AnimatePresence>
      {isLoading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className={`${
            fullScreen ? 'fixed' : 'absolute'
          } inset-0 z-50 flex items-center justify-center ${
            blur ? 'backdrop-blur-sm' : ''
          } bg-black/50`}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className='glass-card p-8 rounded-xl flex flex-col items-center gap-4'
          >
            <Spinner size='lg' color='#8b5cf6' />
            {message && <p className='text-white font-medium'>{message}</p>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// Progress bar
interface ProgressBarProps {
  progress: number; // 0-100
  showLabel?: boolean;
  color?: string;
  className?: string;
}

export const ProgressBar: React.ComponentType<ProgressBarProps> = ({
  progress,
  showLabel = false,
  color = '#8b5cf6',
  className = '',
}) => {
  return (
    <div className={`w-full ${className}`}>
      <div className='relative w-full h-2 bg-gray-700 rounded-full overflow-hidden'>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          transition={{ type: 'spring', stiffness: 100, damping: 20 }}
          className='absolute top-0 left-0 h-full rounded-full'
          style={{ backgroundColor: color }}
        />
      </div>
      {showLabel && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className='text-sm text-gray-400 mt-2 text-center'
        >
          {Math.round(progress)}%
        </motion.p>
      )}
    </div>
  );
};

// Dots loader
export const DotsLoader: React.ComponentType<{ className?: string }> = ({ className = '' }) => {
  return (
    <div className={`flex gap-1 ${className}`}>
      {[0, 1, 2].map(index => (
        <motion.div
          key={index}
          className='w-2 h-2 bg-purple-500 rounded-full'
          animate={{
            y: [0, -10, 0],
            opacity: [0.5, 1, 0.5],
          }}
          transition={{
            duration: 0.6,
            repeat: Infinity,
            delay: index * 0.2,
          }}
        />
      ))}
    </div>
  );
};

// Pulse loader
export const PulseLoader: React.ComponentType<{ size?: number; color?: string }> = ({
  size = 40,
  color = '#8b5cf6',
}) => {
  return (
    <div className='relative' style={{ width: size, height: size }}>
      {[0, 1, 2].map(index => (
        <motion.div
          key={index}
          className='absolute inset-0 rounded-full'
          style={{ backgroundColor: color }}
          animate={{
            scale: [1, 2, 2],
            opacity: [0.7, 0, 0],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            delay: index * 0.5,
          }}
        />
      ))}
      <div className='absolute inset-0 rounded-full' style={{ backgroundColor: color }} />
    </div>
  );
};

// Loading button
interface LoadingButtonProps
  extends Omit<
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    | 'onAnimationStart'
    | 'onAnimationEnd'
    | 'onAnimationIteration'
    | 'onDrag'
    | 'onDragEnd'
    | 'onDragStart'
  > {
  isLoading?: boolean;
  loadingText?: string;
  children: React.ReactNode;
}

export const LoadingButton: React.ComponentType<LoadingButtonProps> = ({
  isLoading = false,
  loadingText = 'Loading...',
  children,
  disabled,
  className = '',
  ...props
}) => {
  return (
    <motion.button
      whileHover={!isLoading && !disabled ? { scale: 1.05 } : {}}
      whileTap={!isLoading && !disabled ? { scale: 0.95 } : {}}
      disabled={isLoading || disabled}
      className={`glass-button px-6 py-3 rounded-xl flex items-center justify-center gap-2 ${
        isLoading || disabled ? 'opacity-50 cursor-not-allowed' : ''
      } ${className}`}
      {...props}
    >
      {isLoading ? (
        <>
          <Spinner size='sm' />
          <span>{loadingText}</span>
        </>
      ) : (
        children
      )}
    </motion.button>
  );
};

// Placeholder component for empty states
interface PlaceholderProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export const Placeholder: React.ComponentType<PlaceholderProps> = ({
  icon,
  title,
  description,
  action,
  className = '',
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex flex-col items-center justify-center p-12 text-center ${className}`}
    >
      {icon && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15 }}
          className='mb-4 text-gray-500'
        >
          {icon}
        </motion.div>
      )}
      <h3 className='text-xl font-semibold text-white mb-2'>{title}</h3>
      {description && <p className='text-gray-400 mb-6 max-w-md'>{description}</p>}
      {action && (
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={action.onClick}
          className='glass-button px-6 py-3 rounded-xl'
        >
          {action.label}
        </motion.button>
      )}
    </motion.div>
  );
};
