# FileExplorer Component

A comprehensive React file explorer component with tree view navigation, file preview, drag-and-drop support, context menus, and multi-select capabilities.

## Features

- **Tree View Navigation**: Hierarchical file and folder display with expand/collapse functionality
- **File Preview**: Built-in preview for images, videos, audio, PDFs, code files, and text files
- **Drag and Drop**: Move files and folders by dragging them to new locations
- **Context Menus**: Right-click menus for rename, delete, and other file operations
- **Multi-Select**: Select multiple files using Ctrl/Cmd+Click
- **Search**: Real-time search functionality to find files and folders
- **Thumbnail Generation**: Automatic thumbnail generation for images and videos
- **File Upload**: Upload files via button or drag-and-drop
- **Responsive Design**: Works well on desktop and tablet devices
- **Dark Mode Support**: Built-in dark mode styling

## Installation

```bash
npm install @heroicons/react react-syntax-highlighter
# or
yarn add @heroicons/react react-syntax-highlighter
```

## Usage

```tsx
import { FileExplorer } from './components/FileExplorer';

const MyComponent = () => {
  const files = [
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
          modifiedDate: new Date(),
          mimeType: 'application/pdf',
        },
      ],
    },
  ];

  return (
    <FileExplorer
      files={files}
      onFileSelect={(file) => console.log('Selected:', file)}
      onFileOpen={(file) => console.log('Open:', file)}
      onFilesMove={(files, target) => console.log('Move:', files, target)}
      onFilesDelete={(files) => console.log('Delete:', files)}
      onFileRename={(file, newName) => console.log('Rename:', file, newName)}
      onCreateFolder={(parent, name) => console.log('Create:', parent, name)}
      onUpload={(files, target) => console.log('Upload:', files, target)}
    />
  );
};
```

## Props

### FileExplorer

| Prop | Type | Description |
|------|------|-------------|
| `files` | `FileNode[]` | Array of file/folder nodes to display |
| `onFileSelect` | `(file: FileNode) => void` | Called when a file is selected |
| `onFileOpen` | `(file: FileNode) => void` | Called when a file is double-clicked |
| `onFilesMove` | `(files: FileNode[], target: FileNode) => void` | Called when files are moved |
| `onFilesDelete` | `(files: FileNode[]) => void` | Called when files are deleted |
| `onFileRename` | `(file: FileNode, newName: string) => void` | Called when a file is renamed |
| `onCreateFolder` | `(parent: FileNode \| null, name: string) => void` | Called when creating a new folder |
| `onUpload` | `(files: File[], target: FileNode \| null) => void` | Called when files are uploaded |
| `className` | `string` | Additional CSS classes |

### FileNode Interface

```typescript
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
```

## File Preview Support

The FilePreview component supports the following file types:

- **Images**: jpg, jpeg, png, gif, bmp, svg, webp
- **Videos**: mp4, webm, ogg
- **Audio**: mp3, wav, ogg, flac
- **Documents**: pdf (via iframe)
- **Code**: js, jsx, ts, tsx, py, java, cpp, c, cs, html, css, json, xml, yaml, md, sql, sh
- **Text**: txt, log, ini, cfg

## Thumbnail Generation

The ThumbnailGenerator utility provides methods to generate thumbnails:

```typescript
// Generate image thumbnail
const thumbnail = await ThumbnailGenerator.generateImageThumbnail(file, 64, 64);

// Generate video thumbnail (at 1 second)
const thumbnail = await ThumbnailGenerator.generateVideoThumbnail(file, 1, 64, 64);

// Get icon for non-media files
const { icon, color } = ThumbnailGenerator.generateIconThumbnail('document.pdf');
```

## Keyboard Shortcuts

- **Click**: Select single file
- **Ctrl/Cmd + Click**: Multi-select files
- **Double Click**: Open file or toggle folder
- **Enter**: Confirm rename
- **Escape**: Cancel rename

## Customization

The component uses Tailwind CSS classes and supports dark mode out of the box. You can customize the appearance by:

1. Overriding CSS classes via the `className` prop
2. Modifying the icon mappings in the component
3. Customizing the context menu options

## Example with Full Features

See `FileExplorerExample.tsx` for a complete implementation example with all features demonstrated.