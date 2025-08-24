import React from 'react';

// Types for component props
interface ComponentProps {
  children: React.ReactNode;
  [key: string]: unknown;
}

interface AnimatePresenceProps {
  children: React.ReactNode;
}

// Mock framer-motion components
export const mockFramerMotion = {
  motion: {
    div: ({ children, ...props }: ComponentProps) => (
      <div {...(props as React.HTMLAttributes<HTMLDivElement>)}>{children}</div>
    ),
    main: ({ children, ...props }: ComponentProps) => (
      <main {...(props as React.HTMLAttributes<HTMLElement>)}>{children}</main>
    ),
    button: ({ children, ...props }: ComponentProps) => (
      <button {...(props as React.ButtonHTMLAttributes<HTMLButtonElement>)}>{children}</button>
    ),
    p: ({ children, ...props }: ComponentProps) => (
      <p {...(props as React.HTMLAttributes<HTMLParagraphElement>)}>{children}</p>
    ),
    span: ({ children, ...props }: ComponentProps) => (
      <span {...(props as React.HTMLAttributes<HTMLSpanElement>)}>{children}</span>
    ),
    h1: ({ children, ...props }: ComponentProps) => (
      <h1 {...(props as React.HTMLAttributes<HTMLHeadingElement>)}>{children}</h1>
    ),
    h2: ({ children, ...props }: ComponentProps) => (
      <h2 {...(props as React.HTMLAttributes<HTMLHeadingElement>)}>{children}</h2>
    ),
    h3: ({ children, ...props }: ComponentProps) => (
      <h3 {...(props as React.HTMLAttributes<HTMLHeadingElement>)}>{children}</h3>
    ),
  },
  AnimatePresence: ({ children }: AnimatePresenceProps) => <>{children}</>,
};

// Mock @heroicons/react icons
export const mockHeroIcons = {
  ExclamationTriangleIcon: () => <div data-testid='exclamation-triangle-icon'>!</div>,
  ArrowPathIcon: () => <div data-testid='arrow-path-icon'>REFRESH</div>,
  HomeIcon: () => <div data-testid='home-icon'>HOME</div>,
  ChatBubbleLeftIcon: () => <div data-testid='chat-icon'>CHAT</div>,
  ChatBubbleLeftRightIcon: () => <div data-testid='chat-icon'>CHAT</div>,
  PhotoIcon: () => <div data-testid='photo-icon'>PHOTO</div>,
  ServerIcon: () => <div data-testid='server-icon'>SERVER</div>,
  Cog6ToothIcon: () => <div data-testid='settings-icon'>SETTINGS</div>,
  NewspaperIcon: () => <div data-testid='newspaper-icon'>NEWS</div>,
  BookOpenIcon: () => <div data-testid='book-icon'>BOOK</div>,
  ChartBarIcon: () => <div data-testid='chart-icon'>CHART</div>,
  ShareIcon: () => <div data-testid='share-icon'>SHARE</div>,
  PlusIcon: () => <div data-testid='plus-icon'>+</div>,
  EllipsisHorizontalIcon: () => <div data-testid='ellipsis-icon'>...</div>,
  MagnifyingGlassIcon: () => <div data-testid='search-icon'>SEARCH</div>,
  XMarkIcon: () => <div data-testid='x-icon'>X</div>,
  CheckIcon: () => <div data-testid='check-icon'>✓</div>,
  InformationCircleIcon: () => <div data-testid='info-icon'>i</div>,
  ExclamationCircleIcon: () => <div data-testid='warning-icon'>!</div>,
  DocumentIcon: () => <div data-testid='document-icon'>DOC</div>,
  CommandLineIcon: () => <div data-testid='command-line-icon'>CLI</div>,
  MicrophoneIcon: () => <div data-testid='microphone-icon'>MIC</div>,
  DocumentPlusIcon: () => <div data-testid='document-plus-icon'>DOC+</div>,
  VideoCameraIcon: () => <div data-testid='video-camera-icon'>CAM</div>,
};
