import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect, useCallback } from 'react';
import {
  CheckCircleIcon,
  ExclamationCircleIcon,
  InformationCircleIcon,
  XCircleIcon,
  XMarkIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';

export interface NotificationConfig {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info' | 'magic';
  title: string;
  message?: string;
  duration?: number;
  actions?: Array<{
    label: string;
    onClick: () => void;
    variant?: 'primary' | 'secondary';
  }>;
  persistent?: boolean;
}

// Global notification store
class NotificationStore {
  private notifications: NotificationConfig[] = [];
  private listeners: Array<(notifications: NotificationConfig[]) => void> = [];

  add(notification: Omit<NotificationConfig, 'id'>) {
    const id = `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newNotification: NotificationConfig = {
      id,
      duration: 5000,
      ...notification,
    };

    this.notifications.push(newNotification);
    this.notifyListeners();

    if (!newNotification.persistent && newNotification.duration) {
      setTimeout(() => {
        this.remove(id);
      }, newNotification.duration);
    }

    return id;
  }

  remove(id: string) {
    this.notifications = this.notifications.filter(n => n.id !== id);
    this.notifyListeners();
  }

  clear() {
    this.notifications = [];
    this.notifyListeners();
  }

  subscribe(listener: (notifications: NotificationConfig[]) => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notifyListeners() {
    this.listeners.forEach(listener => listener([...this.notifications]));
  }
}

export const notificationStore = new NotificationStore();

// Convenience methods
export const notify = {
  success: (title: string, message?: string, options?: Partial<NotificationConfig>) =>
    notificationStore.add({ type: 'success', title, message, ...options }),

  error: (title: string, message?: string, options?: Partial<NotificationConfig>) =>
    notificationStore.add({ type: 'error', title, message, ...options }),

  warning: (title: string, message?: string, options?: Partial<NotificationConfig>) =>
    notificationStore.add({ type: 'warning', title, message, ...options }),

  info: (title: string, message?: string, options?: Partial<NotificationConfig>) =>
    notificationStore.add({ type: 'info', title, message, ...options }),

  magic: (title: string, message?: string, options?: Partial<NotificationConfig>) =>
    notificationStore.add({ type: 'magic', title, message, ...options }),
};

// Individual notification component
const EnhancedNotification: React.ComponentType<{
  notification: NotificationConfig;
  onDismiss: () => void;
}> = ({ notification, onDismiss }) => {
  const [progress, setProgress] = useState(100);

  const icons = {
    success: CheckCircleIcon,
    error: XCircleIcon,
    warning: ExclamationCircleIcon,
    info: InformationCircleIcon,
    magic: SparklesIcon,
  };

  const colors = {
    success: {
      bg: 'from-green-500/20 to-emerald-500/10',
      border: 'border-green-400/30',
      text: 'text-green-100',
      icon: 'text-green-400',
    },
    error: {
      bg: 'from-red-500/20 to-red-600/10',
      border: 'border-red-400/30',
      text: 'text-red-100',
      icon: 'text-red-400',
    },
    warning: {
      bg: 'from-orange-500/20 to-yellow-500/10',
      border: 'border-orange-400/30',
      text: 'text-orange-100',
      icon: 'text-orange-400',
    },
    info: {
      bg: 'from-blue-500/20 to-cyan-500/10',
      border: 'border-blue-400/30',
      text: 'text-blue-100',
      icon: 'text-blue-400',
    },
    magic: {
      bg: 'from-purple-500/20 to-pink-500/10',
      border: 'border-purple-400/30',
      text: 'text-purple-100',
      icon: 'text-purple-400',
    },
  };

  const Icon = icons[notification.type];
  const theme = colors[notification.type];

  useEffect(() => {
    if (!notification.persistent && notification.duration) {
      const interval = setInterval(() => {
        setProgress(prev => {
          const newProgress = prev - 100 / (notification.duration! / 100);
          return Math.max(0, newProgress);
        });
      }, 100);

      return () => clearInterval(interval);
    }
    return undefined;
  }, [notification.duration, notification.persistent]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 400, scale: 0.9 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 400, scale: 0.9 }}
      transition={{
        type: 'spring',
        stiffness: 400,
        damping: 30,
        opacity: { duration: 0.3 },
      }}
      className={`glass-card max-w-md w-full bg-gradient-to-r ${theme.bg} ${theme.border} border backdrop-blur-xl relative overflow-hidden group`}
    >
      {/* Progress Bar */}
      {!notification.persistent && (
        <motion.div
          className='absolute top-0 left-0 h-1 bg-gradient-to-r from-current to-transparent opacity-60'
          style={{ width: `${progress}%` }}
          transition={{ duration: 0.1 }}
        />
      )}

      <div className='p-4 flex items-start gap-3'>
        {/* Icon */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.1, type: 'spring', stiffness: 600 }}
        >
          <Icon className={`w-6 h-6 ${theme.icon} flex-shrink-0`} />
        </motion.div>

        {/* Content */}
        <div className='flex-1 min-w-0'>
          <motion.h4
            className={`font-semibold ${theme.text} text-sm leading-5`}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            {notification.title}
          </motion.h4>

          {notification.message && (
            <motion.p
              className={`mt-1 text-xs ${theme.text} opacity-80 leading-4`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              {notification.message}
            </motion.p>
          )}

          {/* Actions */}
          {notification.actions && notification.actions.length > 0 && (
            <motion.div
              className='mt-3 flex gap-2'
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              {notification.actions.map((action, index) => (
                <motion.button
                  key={index}
                  onClick={action.onClick}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                    action.variant === 'primary'
                      ? 'bg-white/20 text-white hover:bg-white/30'
                      : 'bg-transparent text-white/80 hover:text-white hover:bg-white/10'
                  }`}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  {action.label}
                </motion.button>
              ))}
            </motion.div>
          )}
        </div>

        {/* Dismiss Button */}
        <motion.button
          onClick={onDismiss}
          className={`${theme.text} opacity-60 hover:opacity-100 p-1 rounded-lg transition-all hover:bg-white/10`}
          whileHover={{ scale: 1.1, rotate: 90 }}
          whileTap={{ scale: 0.9 }}
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5 }}
        >
          <XMarkIcon className='w-4 h-4' />
        </motion.button>
      </div>

      {/* Magical particle effect for magic notifications */}
      {notification.type === 'magic' && (
        <div className='absolute inset-0 overflow-hidden pointer-events-none'>
          {Array.from({ length: 3 }).map((_, i) => (
            <motion.div
              key={i}
              className='absolute w-1 h-1 bg-gradient-to-r from-purple-400 to-pink-400 rounded-full'
              initial={{
                x: Math.random() * 300,
                y: Math.random() * 100,
                opacity: 0,
                scale: 0,
              }}
              animate={{
                y: [null, Math.random() * 100 - 50],
                opacity: [0, 1, 0],
                scale: [0, 1, 0],
              }}
              transition={{
                duration: 2 + Math.random() * 2,
                repeat: Infinity,
                delay: i * 0.5,
                ease: 'easeInOut',
              }}
            />
          ))}
        </div>
      )}

      {/* Ambient glow effect */}
      <div
        className={`absolute -inset-1 bg-gradient-to-r ${theme.bg} rounded-lg opacity-20 group-hover:opacity-40 transition-opacity duration-300 -z-10 blur-xl`}
      />
    </motion.div>
  );
};

// Main notification container
export const EnhancedNotificationContainer: React.ComponentType = () => {
  const [notifications, setNotifications] = useState<NotificationConfig[]>([]);

  useEffect(() => {
    return notificationStore.subscribe(setNotifications);
  }, []);

  const handleDismiss = useCallback((id: string) => {
    notificationStore.remove(id);
  }, []);

  return (
    <div className='fixed top-4 right-4 z-50 space-y-3 pointer-events-none max-h-screen overflow-hidden'>
      <AnimatePresence mode='popLayout'>
        {notifications.map(notification => (
          <motion.div key={notification.id} className='pointer-events-auto' layout>
            <EnhancedNotification
              notification={notification}
              onDismiss={() => handleDismiss(notification.id)}
            />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};

// Usage example component (for demonstration)
export const NotificationDemo: React.ComponentType = () => {
  return (
    <div className='p-6 space-y-4'>
      <h3 className='text-white font-bold text-lg mb-4'>Enhanced Notifications Demo</h3>

      <div className='grid grid-cols-2 gap-3'>
        <motion.button
          onClick={() => notify.success('Success!', 'Your action was completed successfully.')}
          className='glass-button-primary'
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          Success Notification
        </motion.button>

        <motion.button
          onClick={() => notify.error('Error!', 'Something went wrong. Please try again.')}
          className='glass-button-secondary'
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          Error Notification
        </motion.button>

        <motion.button
          onClick={() => notify.warning('Warning!', 'Please review your input before proceeding.')}
          className='glass-button'
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          Warning Notification
        </motion.button>

        <motion.button
          onClick={() => notify.info('Info', "Here's some useful information for you.")}
          className='glass-button'
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          Info Notification
        </motion.button>

        <motion.button
          onClick={() =>
            notify.magic('Magic!', 'Something magical just happened! ✨', {
              actions: [
                {
                  label: 'Explore',
                  onClick: () => console.log('Exploring magic!'),
                  variant: 'primary',
                },
                { label: 'Dismiss', onClick: () => {}, variant: 'secondary' },
              ],
            })
          }
          className='glass-button-spectrum col-span-2'
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          Magic Notification with Actions
        </motion.button>
      </div>
    </div>
  );
};
