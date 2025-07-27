import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  FolderIcon,
  FolderOpenIcon,
  DocumentIcon,
  PhotoIcon,
  FilmIcon,
  MusicalNoteIcon,
  CodeBracketIcon,
  ArchiveBoxIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
  EllipsisVerticalIcon,
  ChevronRightIcon,
  ChevronDownIcon,
} from '@heroicons/react/24/outline';
import {
  FolderIcon as FolderSolidIcon,
  DocumentIcon as DocumentSolidIcon,
} from '@heroicons/react/24/solid';

interface FileNode {
  id: string;
  name: string;
  type: 'file' | 'folder';
  path: string;
  size?: number;
  modifiedDate?: Date;
  children?: FileNode[];
  mimeType?: string;
  thumbnail?: string;
}

interface FileExplorerProps {
  files: FileNode[];
  onFileSelect?: (file: FileNode) => void;
  onFileOpen?: (file: FileNode) => void;
  onFilesMove?: (files: FileNode[], targetFolder: FileNode) => void;
  onFilesDelete?: (files: FileNode[]) => void;
  onFileRename?: (file: FileNode, newName: string) => void;
  onCreateFolder?: (parentFolder: FileNode | null, name: string) => void;
  onUpload?: (files: File[], targetFolder: FileNode | null) => void;
  className?: string;
}

const FileExplorer: React.FC<FileExplorerProps> = ({
  files,
  onFileSelect,
  onFileOpen,
  onFilesMove,
  onFilesDelete,
  onFileRename,
  onCreateFolder,
  onUpload,
  className = '',
}) => {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    file: FileNode;
  } | null>(null);
  const [renameFile, setRenameFile] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [draggedFiles, setDraggedFiles] = useState<FileNode[] | null>(null);
  const [dragOverFolder, setDragOverFolder] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const explorerRef = useRef<HTMLDivElement>(null);

  // File type icons
  const getFileIcon = (file: FileNode) => {
    if (file.type === 'folder') {
      return expandedFolders.has(file.id) ? (
        <FolderOpenIcon className="w-5 h-5 text-blue-500" />
      ) : (
        <FolderIcon className="w-5 h-5 text-blue-500" />
      );
    }

    const extension = file.name.split('.').pop()?.toLowerCase();
    const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp'];
    const videoExtensions = ['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm'];
    const audioExtensions = ['mp3', 'wav', 'flac', 'aac', 'ogg', 'wma'];
    const codeExtensions = ['js', 'ts', 'jsx', 'tsx', 'py', 'java', 'cpp', 'c', 'cs', 'html', 'css', 'json', 'xml'];
    const archiveExtensions = ['zip', 'rar', '7z', 'tar', 'gz', 'bz2'];

    if (imageExtensions.includes(extension || '')) {
      return <PhotoIcon className="w-5 h-5 text-green-500" />;
    } else if (videoExtensions.includes(extension || '')) {
      return <FilmIcon className="w-5 h-5 text-purple-500" />;
    } else if (audioExtensions.includes(extension || '')) {
      return <MusicalNoteIcon className="w-5 h-5 text-pink-500" />;
    } else if (codeExtensions.includes(extension || '')) {
      return <CodeBracketIcon className="w-5 h-5 text-orange-500" />;
    } else if (archiveExtensions.includes(extension || '')) {
      return <ArchiveBoxIcon className="w-5 h-5 text-yellow-500" />;
    }

    return <DocumentIcon className="w-5 h-5 text-gray-500" />;
  };

  // Toggle folder expansion
  const toggleFolder = (folderId: string) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(folderId)) {
      newExpanded.delete(folderId);
    } else {
      newExpanded.add(folderId);
    }
    setExpandedFolders(newExpanded);
  };

  // Handle file selection
  const handleFileClick = (file: FileNode, event: React.MouseEvent) => {
    if (event.ctrlKey || event.metaKey) {
      // Multi-select with Ctrl/Cmd
      const newSelected = new Set(selectedFiles);
      if (newSelected.has(file.id)) {
        newSelected.delete(file.id);
      } else {
        newSelected.add(file.id);
      }
      setSelectedFiles(newSelected);
    } else if (event.shiftKey && selectedFiles.size > 0) {
      // Range selection with Shift
      // Implementation would require tracking file order
      setSelectedFiles(new Set([file.id]));
    } else {
      // Single selection
      setSelectedFiles(new Set([file.id]));
    }

    if (onFileSelect) {
      onFileSelect(file);
    }
  };

  // Handle double click
  const handleFileDoubleClick = (file: FileNode) => {
    if (file.type === 'folder') {
      toggleFolder(file.id);
    } else if (onFileOpen) {
      onFileOpen(file);
    }
  };

  // Context menu
  const handleContextMenu = (event: React.MouseEvent, file: FileNode) => {
    event.preventDefault();
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      file,
    });
  };

  // Close context menu
  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  // Rename handling
  const handleRename = (file: FileNode) => {
    setRenameFile(file.id);
    setRenameValue(file.name);
    setContextMenu(null);
  };

  const confirmRename = (file: FileNode) => {
    if (renameValue && renameValue !== file.name && onFileRename) {
      onFileRename(file, renameValue);
    }
    setRenameFile(null);
    setRenameValue('');
  };

  // Drag and drop
  const handleDragStart = (event: React.DragEvent, file: FileNode) => {
    const filesToDrag = selectedFiles.has(file.id)
      ? files.filter(f => selectedFiles.has(f.id))
      : [file];
    setDraggedFiles(filesToDrag);
    event.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  };

  const handleDragEnter = (event: React.DragEvent, folder: FileNode) => {
    if (folder.type === 'folder') {
      setDragOverFolder(folder.id);
    }
  };

  const handleDragLeave = () => {
    setDragOverFolder(null);
  };

  const handleDrop = (event: React.DragEvent, targetFolder: FileNode) => {
    event.preventDefault();
    event.stopPropagation();
    
    if (draggedFiles && targetFolder.type === 'folder' && onFilesMove) {
      onFilesMove(draggedFiles, targetFolder);
    }
    
    setDraggedFiles(null);
    setDragOverFolder(null);
  };

  // File upload
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFiles = Array.from(event.target.files || []);
    if (uploadedFiles.length > 0 && onUpload) {
      onUpload(uploadedFiles, null);
    }
  };

  // Search filter
  const filteredFiles = useMemo(() => {
    if (!searchQuery) return files;

    const filterRecursive = (nodes: FileNode[]): FileNode[] => {
      return nodes.reduce((acc: FileNode[], node) => {
        const matchesSearch = node.name.toLowerCase().includes(searchQuery.toLowerCase());
        
        if (node.type === 'folder' && node.children) {
          const filteredChildren = filterRecursive(node.children);
          if (filteredChildren.length > 0 || matchesSearch) {
            acc.push({
              ...node,
              children: filteredChildren,
            });
          }
        } else if (matchesSearch) {
          acc.push(node);
        }
        
        return acc;
      }, []);
    };

    return filterRecursive(files);
  }, [files, searchQuery]);

  // Render file tree
  const renderFileTree = (nodes: FileNode[], level = 0) => {
    return nodes.map((node) => (
      <div key={node.id}>
        <div
          className={`flex items-center px-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer rounded-md ${
            selectedFiles.has(node.id) ? 'bg-blue-100 dark:bg-blue-900' : ''
          } ${dragOverFolder === node.id ? 'bg-blue-200 dark:bg-blue-800' : ''}`}
          style={{ paddingLeft: `${level * 20 + 8}px` }}
          onClick={(e) => handleFileClick(node, e)}
          onDoubleClick={() => handleFileDoubleClick(node)}
          onContextMenu={(e) => handleContextMenu(e, node)}
          draggable
          onDragStart={(e) => handleDragStart(e, node)}
          onDragOver={handleDragOver}
          onDragEnter={(e) => handleDragEnter(e, node)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, node)}
        >
          {node.type === 'folder' && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleFolder(node.id);
              }}
              className="mr-1"
            >
              {expandedFolders.has(node.id) ? (
                <ChevronDownIcon className="w-4 h-4" />
              ) : (
                <ChevronRightIcon className="w-4 h-4" />
              )}
            </button>
          )}
          
          <div className="mr-2">
            {node.thumbnail && node.type === 'file' ? (
              <img
                src={node.thumbnail}
                alt={node.name}
                className="w-5 h-5 object-cover rounded"
              />
            ) : (
              getFileIcon(node)
            )}
          </div>
          
          {renameFile === node.id ? (
            <input
              type="text"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={() => confirmRename(node)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') confirmRename(node);
                if (e.key === 'Escape') setRenameFile(null);
              }}
              className="flex-1 px-1 py-0 text-sm border border-blue-500 rounded"
              autoFocus
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span className="flex-1 text-sm truncate">{node.name}</span>
          )}
          
          {node.size && (
            <span className="text-xs text-gray-500 ml-2">
              {formatFileSize(node.size)}
            </span>
          )}
        </div>
        
        {node.type === 'folder' &&
          node.children &&
          expandedFolders.has(node.id) &&
          renderFileTree(node.children, level + 1)}
      </div>
    ));
  };

  // Format file size
  const formatFileSize = (bytes: number): string => {
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${Math.round(bytes / Math.pow(1024, i) * 100) / 100  } ${  sizes[i]}`;
  };

  return (
    <div
      ref={explorerRef}
      className={`flex flex-col h-full bg-white dark:bg-gray-800 rounded-lg shadow-lg ${className}`}
    >
      {/* Search Bar */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search files..."
            className="w-full pl-10 pr-10 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 transform -translate-y-1/2"
            >
              <XMarkIcon className="w-5 h-5 text-gray-400 hover:text-gray-600" />
            </button>
          )}
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 p-2 border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => onCreateFolder && onCreateFolder(null, 'New Folder')}
          className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          New Folder
        </button>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="px-3 py-1 text-sm bg-green-500 text-white rounded hover:bg-green-600"
        >
          Upload
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileUpload}
          className="hidden"
        />
      </div>

      {/* File Tree */}
      <div className="flex-1 overflow-auto p-2">
        {filteredFiles.length > 0 ? (
          renderFileTree(filteredFiles)
        ) : (
          <div className="text-center text-gray-500 py-8">
            No files found
          </div>
        )}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="fixed bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-2 z-50"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            onClick={() => handleRename(contextMenu.file)}
            className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            Rename
          </button>
          <button
            onClick={() => {
              onFilesDelete && onFilesDelete([contextMenu.file]);
              setContextMenu(null);
            }}
            className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 text-red-600"
          >
            Delete
          </button>
          {contextMenu.file.type === 'file' && (
            <button
              onClick={() => {
                onFileOpen && onFileOpen(contextMenu.file);
                setContextMenu(null);
              }}
              className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              Open
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default FileExplorer;