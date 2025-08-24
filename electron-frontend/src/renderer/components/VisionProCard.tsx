import React from 'react';
import { useRef } from 'react';
import { motion, useSpring, useTransform, useMotionValue } from 'framer-motion';
import { useSpring as useReactSpring, animated } from '@react-spring/web';
import Tilt from 'react-parallax-tilt';

interface VisionProCardProps {
  children: React.ReactNode;
  className?: string;
  glowColor?: string;
  depth?: 1 | 2 | 3 | 4 | 5;
  interactive?: boolean;
}

export const VisionProCard: React.ComponentType<VisionProCardProps> = ({
  children,
  className = '',
  glowColor = '#ff0080',
  depth = 3,
  interactive = true,
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const rotateX = useTransform(mouseY, [-0.5, 0.5], [5, -5]);
  const rotateY = useTransform(mouseX, [-0.5, 0.5], [-5, 5]);

  const handleMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current || !interactive) return;

    const rect = cardRef.current.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;

    mouseX.set(x);
    mouseY.set(y);
  };

  const handleMouseLeave = () => {
    mouseX.set(0);
    mouseY.set(0);
  };

  const [springProps, _api] = useReactSpring(() => ({
    from: { scale: 1, opacity: 0.8 },
    to: { scale: 1, opacity: 1 },
    config: { tension: 280, friction: 60 },
  }));

  return (
    <Tilt
      tiltMaxAngleX={interactive ? 10 : 0}
      tiltMaxAngleY={interactive ? 10 : 0}
      perspective={1000}
      scale={interactive ? 1.02 : 1}
      transitionSpeed={2000}
      gyroscope={true}
    >
      <motion.div
        ref={cardRef}
        className={`glass-card depth-${depth} ${className}`}
        style={{
          rotateX: interactive ? rotateX : 0,
          rotateY: interactive ? rotateY : 0,
          transformStyle: 'preserve-3d',
        }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        whileHover={interactive ? { scale: 1.02 } : {}}
        whileTap={interactive ? { scale: 0.98 } : {}}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          type: 'spring',
          stiffness: 260,
          damping: 20,
        }}
      >
        <animated.div style={springProps} className='relative z-10'>
          {children}
        </animated.div>

        {/* Specular Highlight */}
        <motion.div
          className='absolute inset-0 pointer-events-none'
          style={{
            background: `linear-gradient(135deg, transparent 40%, rgba(255,255,255,0.1) 50%, transparent 60%)`,
            transform: 'translateZ(1px)',
          }}
          animate={{
            x: [-100, 100],
            opacity: [0, 0.5, 0],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            repeatDelay: 5,
          }}
        />

        {/* Glow Effect */}
        {interactive && (
          <motion.div
            className='absolute -inset-1 rounded-2xl opacity-0 pointer-events-none'
            style={{
              background: `radial-gradient(circle at center, ${glowColor}40, transparent)`,
              filter: 'blur(20px)',
              transform: 'translateZ(-1px)',
            }}
            whileHover={{ opacity: 0.6 }}
            transition={{ duration: 0.3 }}
          />
        )}
      </motion.div>
    </Tilt>
  );
};

interface FloatingOrbProps {
  color?: string;
  size?: number;
  delay?: number;
}

export const FloatingOrb: React.ComponentType<FloatingOrbProps> = ({
  color = '#40e0d0',
  size = 100,
  delay = 0,
}) => {
  // Generate random position within safe bounds
  const randomX = Math.random() * 60 + 20; // 20% to 80% from left
  const randomY = Math.random() * 60 + 20; // 20% to 80% from top

  return (
    <motion.div
      className='absolute pointer-events-none opacity-30'
      style={{
        width: size,
        height: size,
        background: `radial-gradient(circle, ${color}20, transparent)`,
        borderRadius: '50%',
        filter: 'blur(30px)',
        left: `${randomX}%`,
        top: `${randomY}%`,
        transform: 'translate(-50%, -50%)',
      }}
      animate={{
        y: [-10, 10, -10],
        x: [-5, 5, -5],
        scale: [0.8, 1, 0.8],
        opacity: [0.2, 0.4, 0.2],
      }}
      transition={{
        duration: 12 + delay * 2,
        delay,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    />
  );
};

interface LiquidButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
}

export const LiquidButton: React.ComponentType<LiquidButtonProps> = ({
  children,
  onClick,
  variant = 'primary',
  size = 'md',
}) => {
  const [isHovered, setIsHovered] = React.useState(false);

  const springConfig = { stiffness: 300, damping: 20 };
  const scale = useSpring(isHovered ? 1.05 : 1, springConfig);

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-5 py-2.5 text-base',
    lg: 'px-7 py-3.5 text-lg',
  };

  const variantClasses = {
    primary:
      'glass-button bg-gradient-to-r from-blue-500/20 to-purple-600/20 hover:from-blue-500/30 hover:to-purple-600/30',
    secondary: 'glass-button bg-white/10 hover:bg-white/20',
    ghost: 'glass-subtle hover:glass',
  };

  return (
    <motion.button
      className={`
        relative overflow-hidden rounded-xl font-medium
        transition-all duration-300 
        ${sizeClasses[size]}
        ${variantClasses[variant]}
      `}
      style={{ scale }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      onClick={onClick}
      whileTap={{ scale: 0.95 }}
    >
      <span className='relative z-10'>{children}</span>

      {/* Liquid Effect */}
      <motion.div
        className='absolute inset-0 pointer-events-none'
        initial={{ opacity: 0 }}
        animate={{ opacity: isHovered ? 1 : 0 }}
        transition={{ duration: 0.3 }}
      >
        <motion.div
          className='absolute inset-0'
          style={{
            background:
              'radial-gradient(circle at var(--mouse-x) var(--mouse-y), rgba(255,255,255,0.3), transparent 40%)',
          }}
          animate={{
            scale: isHovered ? [0, 1.5] : 0,
          }}
          transition={{ duration: 0.5 }}
        />
      </motion.div>
    </motion.button>
  );
};

interface MorphingShapeProps {
  colors: string[];
  size?: number;
}

export const MorphingShape: React.ComponentType<MorphingShapeProps> = ({ colors, size = 200 }) => {
  const gradientString = `linear-gradient(135deg, ${colors.map(color => `${color}20`).join(', ')})`;

  return (
    <motion.div
      className='absolute morph pointer-events-none'
      style={{
        width: size,
        height: size,
        background: gradientString,
        opacity: 0.2,
        filter: 'blur(50px)',
        left: '50%',
        top: '50%',
        transform: 'translate(-50%, -50%)',
      }}
      animate={{
        x: [-20, 20, -20],
        y: [-15, 15, -15],
        rotate: [0, 120, 240, 360],
        scale: [0.8, 1.2, 0.8],
      }}
      transition={{
        duration: 25,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    />
  );
};

interface ParticleFieldProps {
  count?: number;
  colors?: string[];
}

export const ParticleField: React.ComponentType<ParticleFieldProps> = ({
  count = 50,
  colors = ['#ff0080', '#40e0d0', '#ff8c00', '#00ff00'],
}) => {
  const particles = Array.from({ length: count }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() * 4 + 2,
    duration: Math.random() * 20 + 10,
    delay: Math.random() * 5,
    color: colors[Math.floor(Math.random() * colors.length)],
  }));

  return (
    <div className='absolute inset-0 overflow-hidden pointer-events-none'>
      {particles.map(particle => (
        <motion.div
          key={particle.id}
          className='absolute rounded-full'
          style={{
            left: `${particle.x}%`,
            top: `${particle.y}%`,
            width: particle.size,
            height: particle.size,
            background: `radial-gradient(circle, ${particle.color}, transparent)`,
            boxShadow: `0 0 ${particle.size * 2}px ${particle.color}`,
          }}
          animate={{
            y: [0, -100],
            x: [0, Math.random() * 20 - 10],
            opacity: [0, 0.6, 0.6, 0],
          }}
          transition={{
            duration: particle.duration,
            delay: particle.delay,
            repeat: Infinity,
            ease: 'linear',
          }}
        />
      ))}
    </div>
  );
};
