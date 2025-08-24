import React, { useState } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import { motion, AnimatePresence } from 'framer-motion';
import { XMarkIcon } from '@heroicons/react/24/outline';

export interface ShortcutConfig {
  key: string;
  description: string;
  handler: () => void;
  scope?: string;
  preventDefault?: boolean;
  enableOnFormTags?: boolean;
}

// Define all keyboard shortcuts
const KEYBOARD_SHORTCUTS: Record<string, Omit<ShortcutConfig, 'handler'>> = {
  newChat: {
    key: 'cmd+n, ctrl+n',
    description: 'Start a new chat',
    scope: 'global',
  },
  focusSearch: {
    key: 'cmd+k, ctrl+k',
    description: 'Focus search bar',
    scope: 'global',
    preventDefault: true,
  },
  toggleSidebar: {
    key: 'cmd+b, ctrl+b',
    description: 'Toggle sidebar',
    scope: 'global',
  },
  navigateDashboard: {
    key: 'cmd+1, ctrl+1',
    description: 'Go to Dashboard',
    scope: 'global',
  },
  navigateChat: {
    key: 'cmd+2, ctrl+2',
    description: 'Go to Chat',
    scope: 'global',
  },
  navigateServices: {
    key: 'cmd+3, ctrl+3',
    description: 'Go to Services',
    scope: 'global',
  },
  navigateSettings: {
    key: 'cmd+4, ctrl+4',
    description: 'Go to Settings',
    scope: 'global',
  },
  toggleTheme: {
    key: 'cmd+shift+t, ctrl+shift+t',
    description: 'Toggle theme',
    scope: 'global',
  },
  clearChat: {
    key: 'cmd+shift+k, ctrl+shift+k',
    description: 'Clear chat messages',
    scope: 'chat',
  },
  sendMessage: {
    key: 'cmd+enter, ctrl+enter',
    description: 'Send message',
    scope: 'chat',
    enableOnFormTags: true,
  },
  quickAction: {
    key: 'cmd+/, ctrl+/',
    description: 'Open quick actions',
    scope: 'global',
  },
  escape: {
    key: 'escape',
    description: 'Close modals/cancel actions',
    scope: 'global',
  },
  undo: {
    key: 'cmd+z, ctrl+z',
    description: 'Undo last action',
    scope: 'global',
    enableOnFormTags: false,
  },
  redo: {
    key: 'cmd+shift+z, ctrl+shift+z',
    description: 'Redo last action',
    scope: 'global',
    enableOnFormTags: false,
  },
  refresh: {
    key: 'cmd+r, ctrl+r, f5',
    description: 'Refresh current view',
    scope: 'global',
    preventDefault: true,
  },
  help: {
    key: 'cmd+?, ctrl+?, f1',
    description: 'Show help/shortcuts',
    scope: 'global',
  },
};

// Export shortcuts for external use
export const shortcuts = KEYBOARD_SHORTCUTS;

export const useKeyboardShortcuts = () => {
  // Help modal state
  const [showHelp, setShowHelp] = useState(false);

  // Help shortcut
  useHotkeys(KEYBOARD_SHORTCUTS.help?.key || '?', () => {
    setShowHelp(prev => !prev);
  });

  // Escape to close help
  useHotkeys('escape', () => {
    if (showHelp) {
      setShowHelp(false);
    }
  });

  return {
    showHelp,
    setShowHelp,
    shortcuts: KEYBOARD_SHORTCUTS,
  };
};

// Keyboard shortcuts help modal component
// All imports are now at the top of the file

export const KeyboardShortcutsHelp: React.ComponentType = () => {
  const { showHelp, setShowHelp } = useKeyboardShortcuts();

  const formatKey = (key: string): string[] => {
    return key.split(', ').map(k => {
      return k
        .replace('cmd', '⌘')
        .replace('ctrl', 'Ctrl')
        .replace('shift', '⇧')
        .replace('enter', '↵')
        .replace('escape', 'Esc')
        .replace('+', ' + ');
    });
  };

  const groupedShortcuts = Object.entries(KEYBOARD_SHORTCUTS).reduce(
    (acc, [id, shortcut]) => {
      const category = shortcut.scope || 'global';
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push({ id, ...shortcut });
      return acc;
    },
    {} as Record<
      string,
      Array<(typeof KEYBOARD_SHORTCUTS)[keyof typeof KEYBOARD_SHORTCUTS] & { id: string }>
    >
  );

  return (
    <AnimatePresence>
      {showHelp && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowHelp(false)}
            className='fixed inset-0 bg-black/50 backdrop-blur-sm z-50'
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className='fixed inset-0 flex items-center justify-center z-50 p-8'
          >
            <div className='glass-card max-w-3xl w-full max-h-[80vh] overflow-hidden'>
              {/* Header */}
              <div className='flex items-center justify-between p-6 border-b border-white/10'>
                <h2 className='text-xl font-bold text-white'>Keyboard Shortcuts</h2>
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setShowHelp(false)}
                  className='p-2 rounded-lg hover:bg-white/10 transition-colors'
                >
                  <XMarkIcon className='w-5 h-5 text-white' />
                </motion.button>
              </div>

              {/* Content */}
              <div className='p-6 overflow-y-auto max-h-[calc(80vh-100px)]'>
                {Object.entries(groupedShortcuts).map(([category, shortcuts]) => (
                  <div key={category} className='mb-6'>
                    <h3 className='text-sm font-semibold text-gray-400 uppercase mb-3'>
                      {category === 'global' ? 'General' : category}
                    </h3>
                    <div className='space-y-2'>
                      {shortcuts.map(shortcut => (
                        <motion.div
                          key={shortcut.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          className='flex items-center justify-between p-3 rounded-lg hover:bg-white/5 transition-colors'
                        >
                          <span className='text-white'>{shortcut.description}</span>
                          <div className='flex gap-2'>
                            {formatKey(shortcut.key).map((key, index) => (
                              <React.Fragment key={index}>
                                {index > 0 && <span className='text-gray-500'>or</span>}
                                <kbd className='px-2 py-1 text-xs font-mono bg-white/10 rounded border border-white/20'>
                                  {key}
                                </kbd>
                              </React.Fragment>
                            ))}
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
