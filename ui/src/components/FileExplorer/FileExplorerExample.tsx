import React, { useState, useEffect } from 'react';
import FileExplorer from './FileExplorer';
import FilePreview from './FilePreview';
import { ThumbnailGenerator } from './utils/thumbnailGenerator';

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
  content?: string;
  url?: string;
}

const FileExplorerExample: React.FC = () => {
  const [files, setFiles] = useState<FileNode[]>([]);
  const [selectedFile, setSelectedFile] = useState<FileNode | null>(null);
  const [previewFile, setPreviewFile] = useState<FileNode | null>(null);

  // Sample file structure
  useEffect(() => {
    const sampleFiles: FileNode[] = [
      {
        id: '1',
        name: 'Documents',
        type: 'folder',
        path: '/Documents',
        children: [
          {
            id: '2',
            name: 'report.pdf',
            type: 'file',
            path: '/Documents/report.pdf',
            size: 1024000,
            modifiedDate: new Date('2024-01-15'),
            mimeType: 'application/pdf',
          },
          {
            id: '3',
            name: 'presentation.pptx',
            type: 'file',
            path: '/Documents/presentation.pptx',
            size: 2048000,
            modifiedDate: new Date('2024-01-20'),
            mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          },
        ],
      },
      {
        id: '4',
        name: 'Images',
        type: 'folder',
        path: '/Images',
        children: [
          {
            id: '5',
            name: 'vacation.jpg',
            type: 'file',
            path: '/Images/vacation.jpg',
            size: 3072000,
            modifiedDate: new Date('2024-01-10'),
            mimeType: 'image/jpeg',
            thumbnail: '/api/placeholder/64/64', // In real app, this would be generated
          },
          {
            id: '6',
            name: 'screenshot.png',
            type: 'file',
            path: '/Images/screenshot.png',
            size: 512000,
            modifiedDate: new Date('2024-01-25'),
            mimeType: 'image/png',
            thumbnail: '/api/placeholder/64/64',
          },
        ],
      },
      {
        id: '7',
        name: 'Code',
        type: 'folder',
        path: '/Code',
        children: [
          {
            id: '8',
            name: 'app.tsx',
            type: 'file',
            path: '/Code/app.tsx',
            size: 4096,
            modifiedDate: new Date('2024-01-28'),
            mimeType: 'text/typescript',
            content: `import React from 'react';

const App: React.FC = () => {
  return (
    <div className="app">
      <h1>Hello World</h1>
    </div>
  );
};

export default App;`,
          },
          {
            id: '9',
            name: 'styles.css',
            type: 'file',
            path: '/Code/styles.css',
            size: 2048,
            modifiedDate: new Date('2024-01-27'),
            mimeType: 'text/css',
            content: `.app {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 2rem;
}

h1 {
  color: #333;
  font-size: 2rem;
}`,
          },
        ],
      },
    ];

    setFiles(sampleFiles);
  }, []);

  const handleFileSelect = (file: FileNode) => {
    setSelectedFile(file);
    console.log('File selected:', file);
  };

  const handleFileOpen = (file: FileNode) => {
    if (file.type === 'file') {
      setPreviewFile(file);
    }
  };

  const handleFilesMove = (filesToMove: FileNode[], targetFolder: FileNode) => {
    console.log('Moving files:', filesToMove, 'to folder:', targetFolder);
    // Implement move logic here
  };

  const handleFilesDelete = (filesToDelete: FileNode[]) => {
    console.log('Deleting files:', filesToDelete);
    // Implement delete logic here
  };

  const handleFileRename = (file: FileNode, newName: string) => {
    console.log('Renaming file:', file, 'to:', newName);
    // Implement rename logic here
    const updateFileName = (nodes: FileNode[]): FileNode[] => {
      return nodes.map(node => {
        if (node.id === file.id) {
          return { ...node, name: newName };
        }
        if (node.children) {
          return { ...node, children: updateFileName(node.children) };
        }
        return node;
      });
    };
    setFiles(updateFileName(files));
  };

  const handleCreateFolder = (parentFolder: FileNode | null, name: string) => {
    console.log('Creating folder:', name, 'in:', parentFolder);
    // Implement folder creation logic here
    const newFolder: FileNode = {
      id: Date.now().toString(),
      name,
      type: 'folder',
      path: parentFolder ? `${parentFolder.path}/${name}` : `/${name}`,
      children: [],
    };

    if (parentFolder) {
      const updateFolders = (nodes: FileNode[]): FileNode[] => {
        return nodes.map(node => {
          if (node.id === parentFolder.id && node.children) {
            return { ...node, children: [...node.children, newFolder] };
          }
          if (node.children) {
            return { ...node, children: updateFolders(node.children) };
          }
          return node;
        });
      };
      setFiles(updateFolders(files));
    } else {
      setFiles([...files, newFolder]);
    }
  };

  const handleUpload = async (uploadedFiles: File[], targetFolder: FileNode | null) => {
    console.log('Uploading files:', uploadedFiles, 'to:', targetFolder);
    
    // Process uploaded files and generate thumbnails
    for (const file of uploadedFiles) {
      const fileNode: FileNode = {
        id: Date.now().toString() + file.name,
        name: file.name,
        type: 'file',
        path: targetFolder ? `${targetFolder.path}/${file.name}` : `/${file.name}`,
        size: file.size,
        modifiedDate: new Date(file.lastModified),
        mimeType: file.type,
      };

      // Generate thumbnail for images
      if (file.type.startsWith('image/')) {
        try {
          const thumbnail = await ThumbnailGenerator.generateImageThumbnail(file);
          fileNode.thumbnail = thumbnail;
        } catch (error) {
          console.error('Failed to generate thumbnail:', error);
        }
      }

      // Generate thumbnail for videos
      if (file.type.startsWith('video/')) {
        try {
          const thumbnail = await ThumbnailGenerator.generateVideoThumbnail(file);
          fileNode.thumbnail = thumbnail;
        } catch (error) {
          console.error('Failed to generate video thumbnail:', error);
        }
      }

      // Add file to the tree
      if (targetFolder) {
        const updateFolders = (nodes: FileNode[]): FileNode[] => {
          return nodes.map(node => {
            if (node.id === targetFolder.id && node.children) {
              return { ...node, children: [...node.children, fileNode] };
            }
            if (node.children) {
              return { ...node, children: updateFolders(node.children) };
            }
            return node;
          });
        };
        setFiles(updateFolders(files));
      } else {
        setFiles([...files, fileNode]);
      }
    }
  };

  const handleDownload = () => {
    if (previewFile) {
      console.log('Downloading file:', previewFile);
      // Implement download logic here
    }
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="px-6 py-4">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            File Explorer Example
          </h1>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-80 border-r border-gray-200 dark:border-gray-700">
          <FileExplorer
            files={files}
            onFileSelect={handleFileSelect}
            onFileOpen={handleFileOpen}
            onFilesMove={handleFilesMove}
            onFilesDelete={handleFilesDelete}
            onFileRename={handleFileRename}
            onCreateFolder={handleCreateFolder}
            onUpload={handleUpload}
            className="h-full"
          />
        </div>

        <div className="flex-1 p-6">
          {selectedFile ? (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">File Details</h2>
              <dl className="space-y-2">
                <div>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    Name
                  </dt>
                  <dd className="text-sm text-gray-900 dark:text-white">
                    {selectedFile.name}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    Type
                  </dt>
                  <dd className="text-sm text-gray-900 dark:text-white">
                    {selectedFile.type}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    Path
                  </dt>
                  <dd className="text-sm text-gray-900 dark:text-white">
                    {selectedFile.path}
                  </dd>
                </div>
                {selectedFile.size && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      Size
                    </dt>
                    <dd className="text-sm text-gray-900 dark:text-white">
                      {(selectedFile.size / 1024).toFixed(2)} KB
                    </dd>
                  </div>
                )}
                {selectedFile.modifiedDate && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      Modified
                    </dt>
                    <dd className="text-sm text-gray-900 dark:text-white">
                      {selectedFile.modifiedDate.toLocaleDateString()}
                    </dd>
                  </div>
                )}
              </dl>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
              Select a file to view details
            </div>
          )}
        </div>
      </div>

      {previewFile && (
        <FilePreview
          file={previewFile}
          onClose={() => setPreviewFile(null)}
          onDownload={handleDownload}
        />
      )}
    </div>
  );
};

export default FileExplorerExample;