import React from 'react';
import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  CogIcon,
  BellIcon,
  MoonIcon,
  SunIcon,
  ComputerDesktopIcon,
  ShieldCheckIcon,
  ServerStackIcon,
  PaintBrushIcon,
} from '@heroicons/react/24/outline';

interface SettingsSection {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

const settingsSections: SettingsSection[] = [
  {
    id: 'general',
    title: 'General',
    description: 'Basic app preferences and behavior',
    icon: CogIcon,
  },
  {
    id: 'appearance',
    title: 'Appearance',
    description: 'Theme, colors, and visual settings',
    icon: PaintBrushIcon,
  },
  {
    id: 'notifications',
    title: 'Notifications',
    description: 'Manage alerts and system notifications',
    icon: BellIcon,
  },
  {
    id: 'services',
    title: 'Services',
    description: 'Configure AI services and endpoints',
    icon: ServerStackIcon,
  },
  {
    id: 'privacy',
    title: 'Privacy & Security',
    description: 'Data handling and security settings',
    icon: ShieldCheckIcon,
  },
];

const Settings: React.ComponentType = () => {
  const [activeSection, setActiveSection] = useState('general');
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('system');
  const [notifications, setNotifications] = useState(true);
  const [autoStartup, setAutoStartup] = useState(false);
  const [apiEndpoint, setApiEndpoint] = useState('http://localhost:9999');

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { x: -20, opacity: 0 },
    visible: {
      x: 0,
      opacity: 1,
      transition: { type: 'spring', stiffness: 100 },
    },
  };

  const renderGeneralSettings = () => (
    <motion.div variants={itemVariants} className='space-y-6'>
      <div>
        <h3 className='text-lg font-semibold text-gray-900 dark:text-white mb-4'>
          General Preferences
        </h3>

        <div className='space-y-4'>
          <div className='flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg'>
            <div>
              <h4 className='font-medium text-gray-900 dark:text-white'>Launch at startup</h4>
              <p className='text-sm text-gray-600 dark:text-gray-400'>
                Automatically start the app when you log in
              </p>
            </div>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setAutoStartup(!autoStartup)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                autoStartup ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-600'
              }`}
            >
              <motion.span
                animate={{ x: autoStartup ? 20 : 2 }}
                className='inline-block h-4 w-4 rounded-full bg-white shadow transform transition'
              />
            </motion.button>
          </div>

          <div className='p-4 bg-gray-50 dark:bg-gray-700 rounded-lg'>
            <label className='block text-sm font-medium text-gray-900 dark:text-white mb-2'>
              API Endpoint
            </label>
            <input
              type='text'
              value={apiEndpoint}
              onChange={_e => setApiEndpoint(_e.target.value)}
              className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
            />
          </div>
        </div>
      </div>
    </motion.div>
  );

  const renderAppearanceSettings = () => (
    <motion.div variants={itemVariants} className='space-y-6'>
      <div>
        <h3 className='text-lg font-semibold text-gray-900 dark:text-white mb-4'>
          Appearance Settings
        </h3>

        <div className='p-4 bg-gray-50 dark:bg-gray-700 rounded-lg'>
          <h4 className='font-medium text-gray-900 dark:text-white mb-3'>Theme</h4>
          <div className='grid grid-cols-3 gap-3'>
            {[
              { value: 'light', label: 'Light', icon: SunIcon },
              { value: 'dark', label: 'Dark', icon: MoonIcon },
              { value: 'system', label: 'System', icon: ComputerDesktopIcon },
            ].map(option => (
              <motion.button
                key={option.value}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setTheme(option.value as any)}
                className={`p-3 rounded-lg border-2 transition-all ${
                  theme === option.value
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900'
                    : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                }`}
              >
                <option.icon className='w-6 h-6 mx-auto mb-2 text-gray-700 dark:text-gray-300' />
                <span className='text-sm font-medium text-gray-900 dark:text-white'>
                  {option.label}
                </span>
              </motion.button>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );

  const renderNotificationSettings = () => (
    <motion.div variants={itemVariants} className='space-y-6'>
      <div>
        <h3 className='text-lg font-semibold text-gray-900 dark:text-white mb-4'>
          Notification Settings
        </h3>

        <div className='space-y-4'>
          <div className='flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg'>
            <div>
              <h4 className='font-medium text-gray-900 dark:text-white'>System Notifications</h4>
              <p className='text-sm text-gray-600 dark:text-gray-400'>
                Get notified about service status changes
              </p>
            </div>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setNotifications(!notifications)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                notifications ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-600'
              }`}
            >
              <motion.span
                animate={{ x: notifications ? 20 : 2 }}
                className='inline-block h-4 w-4 rounded-full bg-white shadow transform transition'
              />
            </motion.button>
          </div>
        </div>
      </div>
    </motion.div>
  );

  const renderContent = () => {
    switch (activeSection) {
      case 'general':
        return renderGeneralSettings();
      case 'appearance':
        return renderAppearanceSettings();
      case 'notifications':
        return renderNotificationSettings();
      case 'services':
        return (
          <motion.div variants={itemVariants} className='text-center py-12'>
            <ServerStackIcon className='w-16 h-16 mx-auto text-gray-400 mb-4' />
            <h3 className='text-lg font-medium text-gray-900 dark:text-white mb-2'>
              Service Configuration
            </h3>
            <p className='text-gray-600 dark:text-gray-400'>
              Configure your AI services and endpoints here.
            </p>
          </motion.div>
        );
      case 'privacy':
        return (
          <motion.div variants={itemVariants} className='text-center py-12'>
            <ShieldCheckIcon className='w-16 h-16 mx-auto text-gray-400 mb-4' />
            <h3 className='text-lg font-medium text-gray-900 dark:text-white mb-2'>
              Privacy & Security
            </h3>
            <p className='text-gray-600 dark:text-gray-400'>
              Manage your data privacy and security settings.
            </p>
          </motion.div>
        );
      default:
        return null;
    }
  };

  return (
    <div className='p-6 h-full overflow-y-auto bg-gray-50 dark:bg-gray-900'>
      <div className='max-w-6xl mx-auto'>
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className='mb-8'
        >
          <h1 className='text-3xl font-bold text-gray-900 dark:text-white mb-2'>Settings</h1>
          <p className='text-gray-600 dark:text-gray-400'>
            Customize your Universal AI Tools experience
          </p>
        </motion.div>

        <div className='grid grid-cols-1 lg:grid-cols-4 gap-6'>
          {/* Settings Navigation */}
          <motion.div
            initial={{ x: -50, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            className='lg:col-span-1'
          >
            <div className='bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-gray-700'>
              <h2 className='text-lg font-semibold text-gray-900 dark:text-white mb-4'>
                Categories
              </h2>
              <nav className='space-y-2'>
                {settingsSections.map(section => (
                  <motion.button
                    key={section.id}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setActiveSection(section.id)}
                    className={`w-full text-left p-3 rounded-lg transition-all ${
                      activeSection === section.id
                        ? 'bg-blue-500 text-white'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    <div className='flex items-center space-x-3'>
                      <section.icon className='w-5 h-5' />
                      <div>
                        <div className='font-medium'>{section.title}</div>
                        <div
                          className={`text-xs ${
                            activeSection === section.id
                              ? 'text-blue-100'
                              : 'text-gray-500 dark:text-gray-400'
                          }`}
                        >
                          {section.description}
                        </div>
                      </div>
                    </div>
                  </motion.button>
                ))}
              </nav>
            </div>
          </motion.div>

          {/* Settings Content */}
          <motion.div
            variants={containerVariants}
            initial='hidden'
            animate='visible'
            className='lg:col-span-3'
          >
            <div className='bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-gray-700'>
              {renderContent()}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
