import { NavLink } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  HomeIcon,
  ChatBubbleLeftRightIcon,
  CogIcon,
  ServerStackIcon,
  ChartBarIcon,
  UserGroupIcon,
  DocumentTextIcon,
  BoltIcon,
} from '@heroicons/react/24/outline';

interface NavItem {
  name: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
}

const navigation: NavItem[] = [
  { name: 'Dashboard', path: '/dashboard', icon: HomeIcon },
  { name: 'AI Chat', path: '/chat', icon: ChatBubbleLeftRightIcon, badge: 3 },
  { name: 'Services', path: '/services', icon: ServerStackIcon },
  { name: 'Analytics', path: '/analytics', icon: ChartBarIcon },
  { name: 'Agents', path: '/agents', icon: UserGroupIcon },
  { name: 'Documents', path: '/documents', icon: DocumentTextIcon },
  { name: 'Settings', path: '/settings', icon: CogIcon },
];

const sidebarVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.3,
    },
  },
};

const itemVariants = {
  hidden: { x: -20, opacity: 0 },
  visible: {
    x: 0,
    opacity: 1,
    transition: { type: 'tween', duration: 0.3 },
  },
};

const Sidebar: React.ComponentType = () => {
  return (
    <div className='h-full flex flex-col'>
      {/* Logo */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className='flex items-center px-6 py-8'
      >
        <div className='flex items-center'>
          <motion.div
            whileHover={{ rotate: 360 }}
            transition={{ duration: 0.6 }}
            className='w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg mr-3 flex items-center justify-center'
          >
            <BoltIcon className='w-5 h-5 text-white' />
          </motion.div>
          <div>
            <h2 className='text-lg font-bold text-gray-900 dark:text-white'>Universal AI</h2>
            <p className='text-xs text-gray-500 dark:text-gray-400'>Tools Suite</p>
          </div>
        </div>
      </motion.div>

      {/* Navigation */}
      <motion.nav
        variants={sidebarVariants}
        initial='hidden'
        animate='visible'
        className='flex-1 px-4 space-y-1'
      >
        {navigation.map(item => (
          <motion.div
            key={item.name}
            variants={itemVariants}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <NavLink
              to={item.path}
              className={({ isActive }) =>
                `group flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 ${
                  isActive
                    ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon
                    className={`mr-3 flex-shrink-0 h-5 w-5 transition-colors duration-200 ${
                      isActive
                        ? 'text-white'
                        : 'text-gray-500 group-hover:text-gray-700 dark:group-hover:text-gray-300'
                    }`}
                  />
                  <span className='flex-1'>{item.name}</span>
                  {item.badge && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className={`ml-2 inline-flex items-center justify-center px-2 py-1 text-xs font-medium rounded-full ${
                        isActive
                          ? 'bg-white bg-opacity-20 text-white'
                          : 'bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-300'
                      }`}
                    >
                      {item.badge}
                    </motion.span>
                  )}
                </>
              )}
            </NavLink>
          </motion.div>
        ))}
      </motion.nav>

      {/* Status */}
      <motion.div
        initial={{ y: 50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.8 }}
        className='px-6 py-4 border-t border-gray-200 dark:border-gray-700'
      >
        <div className='flex items-center justify-between'>
          <div className='flex items-center'>
            <motion.div
              animate={{
                scale: [1, 1.2, 1],
                opacity: [0.5, 1, 0.5],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
              className='w-2 h-2 bg-green-400 rounded-full mr-2'
            />
            <span className='text-xs text-gray-500 dark:text-gray-400'>All systems online</span>
          </div>
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            className='text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
          >
            <CogIcon className='w-4 h-4' />
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
};

export default Sidebar;
