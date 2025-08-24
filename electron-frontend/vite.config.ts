import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [
    react({
      // Optimize JSX runtime
      jsxRuntime: 'automatic',
      // Remove manual babel plugin configuration - @vitejs/plugin-react handles this automatically
    }),
  ],
  root: path.join(__dirname, 'src/renderer'),
  publicDir: path.join(__dirname, 'src/renderer/public'),
  build: {
    outDir: path.join(__dirname, 'dist/renderer'),
    emptyOutDir: true,
    // Optimized build settings
    target: 'es2020',
    minify: 'esbuild',
    sourcemap: false, // Disable in production for smaller bundles
    rollupOptions: {
      output: {
        // Simplified and working chunk splitting strategy
        manualChunks: {
          // Core React libraries
          react: ['react', 'react-dom'],
          
          // Router and navigation
          router: ['react-router-dom'],
          
          // Animation and UI
          animations: ['framer-motion'],
          icons: ['@heroicons/react/24/outline', '@heroicons/react/24/solid'],
          ui: ['@headlessui/react'],
          
          // State management
          store: ['zustand', 'immer'],
          
          // Utilities
          utils: ['axios', 'eventemitter3', 'zod'],
          
          // Charts and visualization  
          charts: ['recharts'],
          
          // Performance libraries
          performance: ['react-window', 'react-intersection-observer']
        },
        // Optimize chunk naming
        chunkFileNames: (chunkInfo) => {
          const facadeModuleId = chunkInfo.facadeModuleId
            ? chunkInfo.facadeModuleId.split('/').pop()?.replace('.tsx', '').replace('.ts', '') || 'chunk'
            : 'chunk';
          return `js/${facadeModuleId}-[hash].js`;
        },
        entryFileNames: 'js/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          const name = assetInfo.name || 'asset';
          const info = name.split('.');
          let extType = info[info.length - 1] || 'asset';
          if (/png|jpe?g|svg|gif|tiff|bmp|ico/i.test(extType)) {
            extType = 'img';
          }
          return `assets/${extType}/[name]-[hash].[ext]`;
        },
      },
      // Tree shaking optimization
      treeshake: {
        moduleSideEffects: false,
        propertyReadSideEffects: false,
        unknownGlobalSideEffects: false,
      },
    },
    chunkSizeWarningLimit: 800, // Warn for chunks > 800kb
  },
  server: {
    port: parseInt(process.env.VITE_DEV_PORT || '3007'),
    hmr: {
      overlay: true,
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src/renderer'),
      '@components': path.resolve(__dirname, 'src/renderer/components'),
      '@hooks': path.resolve(__dirname, 'src/renderer/hooks'),
      '@utils': path.resolve(__dirname, 'src/renderer/utils'),
      '@services': path.resolve(__dirname, 'src/renderer/services'),
      '@pages': path.resolve(__dirname, 'src/renderer/pages'),
      '@store': path.resolve(__dirname, 'src/renderer/store'),
      // Fix Node.js modules for browser compatibility
      'events': 'eventemitter3',
    },
  },
  optimizeDeps: {
    // Pre-bundle these dependencies for faster dev startup
    include: [
      'react',
      'react-dom',
      'react-dom/client',
      'framer-motion',
      'eventemitter3',
      'zustand',
      'immer',
      '@heroicons/react/24/outline',
      '@heroicons/react/24/solid',
      'axios',
      'zod',
    ],
    // Exclude large dependencies from pre-bundling
    exclude: ['@tanstack/react-query-devtools'],
  },
  define: {
    global: 'globalThis',
    // Enable production optimizations
    __DEV__: JSON.stringify(process.env.NODE_ENV === 'development'),
  },
  // Enable CSS optimization
  css: {
    devSourcemap: true,
    preprocessorOptions: {
      scss: {
        additionalData: `@import "@/styles/variables.scss";`,
      },
    },
  },
  // Performance optimizations
  experimental: {
    renderBuiltUrl(filename: string, { hostType }: { hostType: 'js' | 'css' | 'html' }) {
      if (hostType === 'js') {
        return { js: `/${filename}` };
      }
      return { relative: true };
    },
  },
});