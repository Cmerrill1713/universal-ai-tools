import React from 'react';
import { motion, useMotionValue, useTransform, AnimatePresence } from 'framer-motion';
import { useState } from 'react';

// Enhanced Button with Ripple Effect
interface EnhancedButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  className?: string;
}

export const EnhancedButton: React.ComponentType<EnhancedButtonProps> = ({
  children,
  onClick,
  variant = 'primary',
  size = 'md',
  disabled = false,
  className = '',
}) => {
  const [ripples, setRipples] = useState<Array<{ x: number; y: number; id: number }>>([]);

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled) return;

    const button = event.currentTarget;
    const rect = button.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const newRipple = {
      x,
      y,
      id: Date.now(),
    };

    setRipples(prev => [...prev, newRipple]);

    setTimeout(() => {
      setRipples(prev => prev.filter(ripple => ripple.id !== newRipple.id));
    }, 800);

    onClick?.();
  };

  const variants = {
    primary: 'glass-button-primary',
    secondary: 'glass-button-secondary',
    ghost: 'glass-subtle',
  };

  const sizes = {
    sm: 'glass-button-sm',
    md: '',
    lg: 'glass-button-lg',
  };

  return (
    <motion.button
      className={`glass-button ${variants[variant]} ${sizes[size]} ${className} relative overflow-hidden`}
      onClick={handleClick}
      disabled={disabled}
      whileHover={{
        scale: 1.02,
        y: -2,
        transition: { type: 'spring', stiffness: 400, damping: 25 },
      }}
      whileTap={{
        scale: 0.98,
        y: 0,
        transition: { duration: 0.1 },
      }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {children}

      {/* Ripple Effects */}
      <AnimatePresence>
        {ripples.map(ripple => (
          <motion.div
            key={ripple.id}
            className='absolute rounded-full pointer-events-none'
            style={{
              left: ripple.x - 25,
              top: ripple.y - 25,
              width: 50,
              height: 50,
              background:
                'radial-gradient(circle, rgba(255, 255, 255, 0.6), rgba(255, 255, 255, 0.2), transparent)',
            }}
            initial={{ scale: 0, opacity: 1 }}
            animate={{ scale: 4, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          />
        ))}
      </AnimatePresence>
    </motion.button>
  );
};

// Enhanced Card with Magnetic Effect
interface EnhancedCardProps {
  children: React.ReactNode;
  className?: string;
  magneticStrength?: number;
}

export const EnhancedCard: React.ComponentType<EnhancedCardProps> = ({
  children,
  className = '',
  magneticStrength = 0.2,
}) => {
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const rotateX = useTransform(y, [-100, 100], [30, -30]);
  const rotateY = useTransform(x, [-100, 100], [-30, 30]);

  const handleMouseMove = (event: React.MouseEvent) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    x.set((event.clientX - centerX) * magneticStrength);
    y.set((event.clientY - centerY) * magneticStrength);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.div
      className={`glass-card-warm cursor-pointer perspective-1000 ${className}`}
      style={{
        rotateX,
        rotateY,
        transformStyle: 'preserve-3d',
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      whileHover={{
        scale: 1.05,
        transition: { type: 'spring', stiffness: 300, damping: 20 },
      }}
      initial={{ opacity: 0, y: 50, rotateX: 10 }}
      animate={{ opacity: 1, y: 0, rotateX: 0 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  );
};

// Enhanced Input with Floating Label
interface EnhancedInputProps {
  label: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export const EnhancedInput: React.ComponentType<EnhancedInputProps> = ({
  label,
  type = 'text',
  value,
  onChange,
  placeholder,
  className = '',
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const hasValue = value.length > 0;

  return (
    <div className={`relative ${className}`}>
      <motion.input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        placeholder={isFocused ? placeholder : ''}
        className='glass-subtle w-full px-4 py-3 rounded-xl border-2 border-transparent bg-white/10 backdrop-blur-md text-white placeholder-white/50 focus:border-orange-400/50 focus:bg-white/20 transition-all duration-300 outline-none'
        whileFocus={{
          scale: 1.02,
          transition: { type: 'spring', stiffness: 400, damping: 25 },
        }}
      />

      <motion.label
        className='absolute left-4 pointer-events-none text-white/70 origin-left'
        animate={{
          y: isFocused || hasValue ? -32 : 12,
          scale: isFocused || hasValue ? 0.85 : 1,
          color: isFocused ? '#fb923c' : 'rgba(255, 255, 255, 0.7)',
        }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      >
        {label}
      </motion.label>

      {/* Focus Ring */}
      <AnimatePresence>
        {isFocused && (
          <motion.div
            className='absolute inset-0 rounded-xl border-2 border-orange-400/30 pointer-events-none'
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            transition={{ duration: 0.2 }}
          >
            <motion.div
              className='absolute inset-0 rounded-xl bg-gradient-to-r from-red-500/20 via-orange-400/20 to-white/10'
              animate={{
                backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'],
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: 'linear',
              }}
              style={{ backgroundSize: '200% 200%' }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// Enhanced Toggle Switch
interface EnhancedToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const EnhancedToggle: React.ComponentType<EnhancedToggleProps> = ({
  checked,
  onChange,
  label,
  size = 'md',
  className = '',
}) => {
  const sizes = {
    sm: { width: 40, height: 20, knobSize: 16 },
    md: { width: 50, height: 25, knobSize: 20 },
    lg: { width: 60, height: 30, knobSize: 24 },
  };

  const { width, height, knobSize } = sizes[size];

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {label && <span className='text-white/80 font-medium select-none'>{label}</span>}

      <motion.button
        className='glass-subtle rounded-full p-1 relative overflow-hidden'
        style={{ width, height }}
        onClick={() => onChange(!checked)}
        whileTap={{ scale: 0.95 }}
        animate={{
          background: checked
            ? 'linear-gradient(135deg, #dc2626, #f97316, #fb923c)'
            : 'rgba(255, 255, 255, 0.1)',
        }}
        transition={{ duration: 0.3 }}
      >
        <motion.div
          className='glass-card rounded-full shadow-lg flex items-center justify-center'
          style={{ width: knobSize, height: knobSize }}
          animate={{
            x: checked ? width - knobSize - 8 : 0,
            background: checked ? 'rgba(255, 255, 255, 0.95)' : 'rgba(255, 255, 255, 0.7)',
          }}
          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        >
          <motion.div
            className='w-2 h-2 rounded-full'
            animate={{
              background: checked
                ? 'linear-gradient(135deg, #dc2626, #f97316)'
                : 'rgba(255, 255, 255, 0.5)',
              scale: checked ? 1.2 : 1,
            }}
            transition={{ duration: 0.2 }}
          />
        </motion.div>

        {/* Glow Effect */}
        <AnimatePresence>
          {checked && (
            <motion.div
              className='absolute inset-0 rounded-full pointer-events-none'
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 0.6, scale: 1 }}
              exit={{ opacity: 0, scale: 1.2 }}
              transition={{ duration: 0.3 }}
              style={{
                background: 'radial-gradient(circle, rgba(249, 115, 22, 0.4), transparent)',
                filter: 'blur(8px)',
              }}
            />
          )}
        </AnimatePresence>
      </motion.button>
    </div>
  );
};

// Enhanced Progress Bar
interface EnhancedProgressProps {
  value: number;
  max?: number;
  size?: 'sm' | 'md' | 'lg';
  showValue?: boolean;
  className?: string;
}

export const EnhancedProgress: React.ComponentType<EnhancedProgressProps> = ({
  value,
  max = 100,
  size = 'md',
  showValue = true,
  className = '',
}) => {
  const percentage = Math.min((value / max) * 100, 100);

  const heights = {
    sm: 'h-2',
    md: 'h-3',
    lg: 'h-4',
  };

  return (
    <div className={`w-full ${className}`}>
      {showValue && (
        <div className='flex justify-between items-center mb-2'>
          <span className='text-white/80 text-sm font-medium'>Progress</span>
          <motion.span
            className='text-white text-sm font-bold'
            key={percentage}
            initial={{ scale: 1.2, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.2 }}
          >
            {Math.round(percentage)}%
          </motion.span>
        </div>
      )}

      <div className={`glass-subtle rounded-full overflow-hidden ${heights[size]}`}>
        <motion.div
          className='h-full rounded-full relative overflow-hidden'
          style={{
            background: 'linear-gradient(90deg, #dc2626, #ea580c, #f97316, #fb923c, #fdba74)',
          }}
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 1, ease: 'easeOut' }}
        >
          {/* Shimmer Effect */}
          <motion.div
            className='absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent'
            animate={{
              x: ['-100%', '100%'],
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
            style={{ width: '50%' }}
          />
        </motion.div>
      </div>
    </div>
  );
};
