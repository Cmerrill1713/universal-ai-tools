import React from 'react';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHotkeys } from 'react-hotkeys-hook';
import { useStore } from '../store/useStore';
import { shortcuts } from '../hooks/useKeyboardShortcuts';
import { KeyboardShortcutsHelp } from '../hooks/useKeyboardShortcuts';

import Logger from '../utils/logger';
/**
 * Provider component that sets up all keyboard shortcuts.
 * Must be used inside Router context.
 */
export const KeyboardShortcutsProvider: React.ComponentType<{ children: React.ReactNode }> = ({
  children,
}) => {
  const navigate = useNavigate();
  const { toggleSidebar, clearMessages, toggleTheme, setActiveView, addNotification } = useStore();

  // Navigation shortcuts
  useHotkeys(shortcuts.navigateDashboard?.key || '', () => {
    navigate('/dashboard');
    setActiveView('dashboard');
  });

  useHotkeys(shortcuts.navigateChat?.key || '', () => {
    navigate('/chat');
    setActiveView('chat');
  });

  useHotkeys(shortcuts.navigateServices?.key || '', () => {
    navigate('/services');
    setActiveView('services');
  });

  useHotkeys(shortcuts.navigateSettings?.key || '', () => {
    navigate('/settings');
    setActiveView('settings');
  });

  // UI control shortcuts
  useHotkeys(shortcuts.toggleSidebar?.key || '', () => {
    toggleSidebar();
  });

  useHotkeys(shortcuts.toggleTheme?.key || '', () => {
    toggleTheme();
    addNotification({
      type: 'info',
      message: 'Theme toggled',
    });
  });

  // Chat shortcuts
  useHotkeys(
    shortcuts.newChat?.key || '',
    () => {
      clearMessages();
      navigate('/chat');
      setActiveView('chat');
      addNotification({
        type: 'info',
        message: 'New chat started',
      });
    },
    { enableOnFormTags: false }
  );

  useHotkeys(shortcuts.clearChat?.key || '', () => {
    clearMessages();
    addNotification({
      type: 'info',
      message: 'Chat cleared',
    });
  });

  // Search shortcut
  useHotkeys(
    shortcuts.focusSearch?.key || '',
    e => {
      e.preventDefault();
      const searchInput = document.querySelector<HTMLInputElement>('[data-search-input]');
      if (searchInput) {
        searchInput.focus();
        searchInput.select();
      }
    },
    { preventDefault: true }
  );

  // Refresh shortcut
  useHotkeys(
    shortcuts.refresh?.key || '',
    e => {
      e.preventDefault();
      window.location.reload();
    },
    { preventDefault: true }
  );

  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      Logger.warn('Keyboard shortcuts initialized');
    }
  }, []);

  return (
    <>
      {children}
      <KeyboardShortcutsHelp />
    </>
  );
};
