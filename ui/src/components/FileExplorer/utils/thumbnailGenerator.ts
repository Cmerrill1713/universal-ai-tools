export class ThumbnailGenerator {
  private static thumbnailCache = new Map<string, string>();

  /**
   * Generate a thumbnail for an image file
   * @param file The file to generate a thumbnail for
   * @param maxWidth Maximum width of the thumbnail
   * @param maxHeight Maximum height of the thumbnail
   * @returns Promise resolving to the thumbnail data URL
   */
  static async generateImageThumbnail(
    file: File | Blob,
    maxWidth: number = 64,
    maxHeight: number = 64
  ): Promise<string> {
    // Check cache first
    const cacheKey = `${('name' in file ? file.name : 'blob')}_${file.size}_${maxWidth}_${maxHeight}`;
    if (this.thumbnailCache.has(cacheKey)) {
      return this.thumbnailCache.get(cacheKey)!;
    }

    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        const img = new Image();
        
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          if (!ctx) {
            reject(new Error('Could not get canvas context'));
            return;
          }

          // Calculate the scaling factor
          const scale = Math.min(maxWidth / img.width, maxHeight / img.height);
          const width = img.width * scale;
          const height = img.height * scale;

          // Set canvas dimensions
          canvas.width = width;
          canvas.height = height;

          // Draw the scaled image
          ctx.drawImage(img, 0, 0, width, height);

          // Convert to data URL
          const thumbnailUrl = canvas.toDataURL('image/jpeg', 0.8);
          
          // Cache the result
          this.thumbnailCache.set(cacheKey, thumbnailUrl);
          
          resolve(thumbnailUrl);
        };

        img.onerror = () => {
          reject(new Error('Failed to load image'));
        };

        img.src = e.target?.result as string;
      };

      reader.onerror = () => {
        reject(new Error('Failed to read file'));
      };

      reader.readAsDataURL(file);
    });
  }

  /**
   * Generate a thumbnail for a video file
   * @param file The video file
   * @param seekTime Time in seconds to capture the frame
   * @param maxWidth Maximum width of the thumbnail
   * @param maxHeight Maximum height of the thumbnail
   * @returns Promise resolving to the thumbnail data URL
   */
  static async generateVideoThumbnail(
    file: File | Blob,
    seekTime: number = 1,
    maxWidth: number = 64,
    maxHeight: number = 64
  ): Promise<string> {
    const cacheKey = `video_${('name' in file ? file.name : 'blob')}_${file.size}_${seekTime}_${maxWidth}_${maxHeight}`;
    if (this.thumbnailCache.has(cacheKey)) {
      return this.thumbnailCache.get(cacheKey)!;
    }

    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }

      video.autoplay = true;
      video.muted = true;
      video.playsInline = true;

      video.onloadeddata = () => {
        video.currentTime = seekTime;
      };

      video.onseeked = () => {
        // Calculate the scaling factor
        const scale = Math.min(maxWidth / video.videoWidth, maxHeight / video.videoHeight);
        const width = video.videoWidth * scale;
        const height = video.videoHeight * scale;

        canvas.width = width;
        canvas.height = height;

        ctx.drawImage(video, 0, 0, width, height);

        const thumbnailUrl = canvas.toDataURL('image/jpeg', 0.8);
        this.thumbnailCache.set(cacheKey, thumbnailUrl);
        
        // Clean up
        video.remove();
        
        resolve(thumbnailUrl);
      };

      video.onerror = () => {
        reject(new Error('Failed to load video'));
      };

      // Create object URL for the video
      const videoUrl = URL.createObjectURL(file);
      video.src = videoUrl;

      // Clean up object URL when done
      video.onended = () => {
        URL.revokeObjectURL(videoUrl);
      };
    });
  }

  /**
   * Generate an icon-based thumbnail for non-media files
   * @param fileName The name of the file
   * @param fileType The MIME type of the file
   * @returns A colored icon identifier
   */
  static generateIconThumbnail(fileName: string, fileType?: string): {
    icon: string;
    color: string;
  } {
    const extension = fileName.split('.').pop()?.toLowerCase();

    const iconMap: Record<string, { icon: string; color: string }> = {
      // Documents
      pdf: { icon: 'document', color: '#DC2626' },
      doc: { icon: 'document', color: '#2563EB' },
      docx: { icon: 'document', color: '#2563EB' },
      xls: { icon: 'table', color: '#10B981' },
      xlsx: { icon: 'table', color: '#10B981' },
      ppt: { icon: 'presentation', color: '#F59E0B' },
      pptx: { icon: 'presentation', color: '#F59E0B' },
      
      // Code
      js: { icon: 'code', color: '#F7DF1E' },
      ts: { icon: 'code', color: '#3178C6' },
      jsx: { icon: 'code', color: '#61DAFB' },
      tsx: { icon: 'code', color: '#61DAFB' },
      py: { icon: 'code', color: '#3776AB' },
      java: { icon: 'code', color: '#007396' },
      cpp: { icon: 'code', color: '#00599C' },
      
      // Archives
      zip: { icon: 'archive', color: '#6366F1' },
      rar: { icon: 'archive', color: '#6366F1' },
      '7z': { icon: 'archive', color: '#6366F1' },
      tar: { icon: 'archive', color: '#6366F1' },
      gz: { icon: 'archive', color: '#6366F1' },
      
      // Default
      default: { icon: 'document', color: '#6B7280' },
    };

    return iconMap[extension || ''] || iconMap.default;
  }

  /**
   * Clear the thumbnail cache
   */
  static clearCache(): void {
    this.thumbnailCache.clear();
  }

  /**
   * Get cache size
   */
  static getCacheSize(): number {
    return this.thumbnailCache.size;
  }
}