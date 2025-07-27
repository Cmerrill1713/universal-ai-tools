import React, { useEffect, useState } from 'react';
import {
  XMarkIcon,
  ArrowDownTrayIcon,
  ArrowsPointingOutIcon,
  ArrowsPointingInIcon,
} from '@heroicons/react/24/outline';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { tomorrow } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface FilePreviewProps {
  file: {
    id: string;
    name: string;
    type: string;
    path: string;
    content?: string;
    url?: string;
    mimeType?: string;
  };
  onClose: () => void;
  onDownload?: () => void;
}

const FilePreview: React.FC<FilePreviewProps> = ({ file, onClose, onDownload }) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [previewContent, setPreviewContent] = useState<React.ReactNode>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadPreview = async () => {
      try {
        const extension = file.name.split('.').pop()?.toLowerCase();
        
        // Image files
        const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp'];
        if (imageExtensions.includes(extension || '')) {
          setPreviewContent(
            <img
              src={file.url || file.path}
              alt={file.name}
              className="max-w-full max-h-full object-contain"
            />
          );
          return;
        }

        // Video files
        const videoExtensions = ['mp4', 'webm', 'ogg'];
        if (videoExtensions.includes(extension || '')) {
          setPreviewContent(
            <video
              src={file.url || file.path}
              controls
              className="max-w-full max-h-full"
            >
              Your browser does not support the video tag.
            </video>
          );
          return;
        }

        // Audio files
        const audioExtensions = ['mp3', 'wav', 'ogg', 'flac'];
        if (audioExtensions.includes(extension || '')) {
          setPreviewContent(
            <div className="flex items-center justify-center h-full">
              <audio src={file.url || file.path} controls>
                Your browser does not support the audio tag.
              </audio>
            </div>
          );
          return;
        }

        // PDF files
        if (extension === 'pdf') {
          setPreviewContent(
            <iframe
              src={file.url || file.path}
              className="w-full h-full"
              title={file.name}
            />
          );
          return;
        }

        // Code files
        const codeExtensions = {
          js: 'javascript',
          jsx: 'jsx',
          ts: 'typescript',
          tsx: 'tsx',
          py: 'python',
          java: 'java',
          cpp: 'cpp',
          c: 'c',
          cs: 'csharp',
          html: 'html',
          css: 'css',
          scss: 'scss',
          json: 'json',
          xml: 'xml',
          yaml: 'yaml',
          yml: 'yaml',
          md: 'markdown',
          sql: 'sql',
          sh: 'bash',
          bash: 'bash',
        };

        if (extension && codeExtensions[extension as keyof typeof codeExtensions]) {
          if (file.content) {
            setPreviewContent(
              <div className="w-full h-full overflow-auto">
                <SyntaxHighlighter
                  language={codeExtensions[extension as keyof typeof codeExtensions]}
                  style={tomorrow}
                  customStyle={{
                    margin: 0,
                    borderRadius: 0,
                    fontSize: '14px',
                  }}
                >
                  {file.content}
                </SyntaxHighlighter>
              </div>
            );
          } else {
            setError('File content not available');
          }
          return;
        }

        // Text files
        const textExtensions = ['txt', 'log', 'ini', 'cfg'];
        if (textExtensions.includes(extension || '') || file.mimeType?.startsWith('text/')) {
          if (file.content) {
            setPreviewContent(
              <div className="w-full h-full overflow-auto p-4">
                <pre className="whitespace-pre-wrap font-mono text-sm">
                  {file.content}
                </pre>
              </div>
            );
          } else {
            setError('File content not available');
          }
          return;
        }

        // Default: unsupported file type
        setError('Preview not available for this file type');
      } catch (err) {
        setError('Error loading preview');
        console.error('Preview error:', err);
      }
    };

    loadPreview();
  }, [file]);

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75 ${
        isFullscreen ? '' : 'p-4'
      }`}
      onClick={onClose}
    >
      <div
        className={`relative bg-white dark:bg-gray-800 rounded-lg shadow-xl ${
          isFullscreen ? 'w-full h-full' : 'max-w-6xl max-h-[90vh] w-full'
        } flex flex-col`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold truncate">{file.name}</h3>
          <div className="flex items-center gap-2">
            {onDownload && (
              <button
                onClick={onDownload}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                title="Download"
              >
                <ArrowDownTrayIcon className="w-5 h-5" />
              </button>
            )}
            <button
              onClick={toggleFullscreen}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            >
              {isFullscreen ? (
                <ArrowsPointingInIcon className="w-5 h-5" />
              ) : (
                <ArrowsPointingOutIcon className="w-5 h-5" />
              )}
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              title="Close"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex items-center justify-center p-4">
          {error ? (
            <div className="text-center text-gray-500 dark:text-gray-400">
              <p className="text-lg mb-2">{error}</p>
              <p className="text-sm">File: {file.name}</p>
            </div>
          ) : (
            previewContent
          )}
        </div>
      </div>
    </div>
  );
};

export default FilePreview;