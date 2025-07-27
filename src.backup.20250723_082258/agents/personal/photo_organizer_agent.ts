/**
 * PhotoOrganizerAgent - Intelligent photo organization with local ML
 * Uses local models for face recognition, smart categorization, and privacy-first processing
 */

import type { AgentConfig, AgentContext, AgentResponse } from '../base_agent';
import { BaseAgent } from '../base_agent';
import type { SupabaseClient } from '@supabase/supabase-js';
import { execSync, spawn } from 'child_process';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import axios from 'axios';

interface PhotoMetadata {
  path: string;
  filename: string;
  size: number;
  dateCreated: Date;
  dateTaken?: Date;
  location?: {
    latitude: number;
    longitude: number;
    address?: string;
  };
  camera?: {
    make: string;
    model: string;
    settings?: any;
  };
  hash: string;
  width?: number;
  height?: number;
}

interface FaceDetection {
  photoPath: string;
  faces: Array<{
    id: string;
    confidence: number;
    boundingBox: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
    encoding?: number[];
    personId?: string;
    personName?: string;
  }>;
}

interface Person {
  id: string;
  name?: string;
  faceEncodings: number[][];
  photoCount: number;
  firstSeen: Date;
  lastSeen: Date;
  confidence: number;
}

interface PhotoCollection {
  id: string;
  name: string;
  type: 'auto' | 'manual';
  criteria: any;
  photoCount: number;
  thumbnail?: string;
  created: Date;
  updated: Date;
}

export class PhotoOrganizerAgent extends BaseAgent {
  private supabase: SupabaseClient;
  private photosDirectory: string;
  private faceModelLoaded = false;
  private duplicateThreshold = 0.95;
  private faceRecognitionThreshold = 0.6;

  constructor(supabase: SupabaseClient) {
    const config: AgentConfig = {
      name: 'photo_organizer',
      description:
        'Intelligent photo organization with face recognition and ML-powered categorization',
      priority: 7,
      capabilities: [
        {
          name: 'organize_photos',
          description: 'Automatically organize photos by date, location, people, and _content,
          inputSchema: {
            type: 'object',
            properties: {
              directory: { type: 'string' },
              strategy: { type: 'string', enum: ['date', 'people', 'location', '_content] },
              preserveOriginal: { type: 'boolean' },
            },
            required: ['directory'],
          },
          outputSchema: {
            type: 'object',
            properties: {
              organized: { type: 'number' },
              collections: { type: 'array' },
              duplicates: { type: 'array' },
            },
          },
        },
        {
          name: 'detect_faces',
          description: 'Detect and recognize faces in photos using local ML models',
          inputSchema: {
            type: 'object',
            properties: {
              photos: { type: 'array' },
              createNewPersons: { type: 'boolean' },
            },
            required: ['photos'],
          },
          outputSchema: {
            type: 'object',
            properties: {
              detections: { type: 'array' },
              newPersons: { type: 'array' },
              totalFaces: { type: 'number' },
            },
          },
        },
        {
          name: 'find_duplicates',
          description: 'Find duplicate and similar photos using perceptual hashing',
          inputSchema: {
            type: 'object',
            properties: {
              directory: { type: 'string' },
              threshold: { type: 'number' },
            },
            required: ['directory'],
          },
          outputSchema: {
            type: 'object',
            properties: {
              duplicateGroups: { type: 'array' },
              totalDuplicates: { type: 'number' },
              spaceSaved: { type: 'number' },
            },
          },
        },
        {
          name: 'create_smart_albums',
          description: 'Create smart photo albums based on ML _analysis,
          inputSchema: {
            type: 'object',
            properties: {
              criteria: { type: 'object' },
              autoUpdate: { type: 'boolean' },
            },
          },
          outputSchema: {
            type: 'object',
            properties: {
              albums: { type: 'array' },
              totalPhotos: { type: 'number' },
            },
          },
        },
      ],
      maxLatencyMs: 10000, // Photo processing can take longer
      retryAttempts: 2,
      dependencies: ['ollama_assistant'],
      memoryEnabled: true,
    };

    super(config);
    this.supabase = supabase;
    this.photosDirectory =
      process.env.PHOTOS_DIRECTORY || path.join(process.env.HOME || '', 'Pictures');
  }

  protected async onInitialize(): Promise<void> {
    // Initialize local ML models for face detection
    await this.initializeFaceRecognition();

    // Check Photos app integration on macOS
    await this.checkPhotosAppAccess();

    // Load existing person database
    await this.loadPersonDatabase();

    this.logger.info('✅ PhotoOrganizerAgent initialized with local ML capabilities');
  }

  protected async process(_context: AgentContext & { memoryContext?: any }): Promise<AgentResponse> {
    const { userRequest } = context;
    const startTime = Date.now();

    try {
      // Parse the user _requestto determine photo operation
      const intent = await this.parsePhotoIntent(userRequest);

      let result: any;

      switch (intent.action) {
        case 'organize':
          result = await this.organizePhotos(intent);
          break;

        case 'find_people':
          result = await this.findPhotosByPerson(intent);
          break;

        case 'detect_faces':
          result = await this.detectFacesInPhotos(intent);
          break;

        case 'find_duplicates':
          result = await this.findDuplicatesInPhotos(intent);
          break;

        case 'create_album':
          result = await this.createSmartAlbum(intent);
          break;

        case 'analyze_photo':
          result = await this.analyzePhotoContent(intent);
          break;

        default:
          result = await this.handleGeneralPhotoQuery(userRequest);
      }

      const confidence = this.calculateConfidence(intent, result);

      return {
        success: true,
        data: result,
        reasoning: this.buildPhotoReasoning(intent, result),
        confidence,
        latencyMs: Date.now() - startTime,
        agentId: this.config.name,
        nextActions: this.suggestPhotoActions(intent, result),
      };
    } catch (_error) {
      this.logger.error'PhotoOrganizerAgent processing _error', _error;
      return {
        success: false,
        data: null,
        reasoning: `Photo operation failed: ${(_erroras Error).message}`,
        confidence: 0.1,
        latencyMs: Date.now() - startTime,
        agentId: this.config.name,
        _error (_erroras Error).message,
      };
    }
  }

  protected async onShutdown(): Promise<void> {
    // Clean up ML models and temporary files
    this.logger.info('PhotoOrganizerAgent shutting down');
  }

  /**
   * Initialize face recognition using local ML models
   */
  private async initializeFaceRecognition(): Promise<void> {
    try {
      // Check if Python and required libraries are available
      const pythonScript = `
import sys
try:
    import face_recognition
    import cv2
    import numpy as np
    print("Face recognition libraries available")
    sys.exit(0)
except ImportError as e:
    print(f"Missing library: {e}")
    sys.exit(1)
`;

      const tempScript = path.join('/tmp', 'check_face_recognition.py');
      await fs.writeFile(tempScript, pythonScript);

      try {
        execSync(`python3 ${tempScript}`, { stdio: 'pipe' });
        this.faceModelLoaded = true;
        this.logger.info('✅ Face recognition models loaded successfully');
      } catch (_error) {
        this.logger.warn('⚠️ Face recognition libraries not available, using fallback methods');
        await this.installFaceRecognitionFallback();
      }

      await fs.unlink(tempScript);
    } catch (_error) {
      this.logger.error'Failed to initialize face recognition:', _error;
    }
  }

  /**
   * Install face recognition fallback using Ollama vision models
   */
  private async installFaceRecognitionFallback(): Promise<void> {
    try {
      // Check if Ollama has vision models available
      const response = await axios.get('http://localhost:11434/api/tags');
      const models = response.data.models || [];

      const visionModels = models.filter(
        (m: any) => m.name.includes('llava') || m.name.includes('vision')
      );

      if (visionModels.length > 0) {
        this.faceModelLoaded = true;
        this.logger.info('✅ Using Ollama vision models for face detection');
      } else {
        this.logger.warn('⚠️ No face recognition capabilities available');
      }
    } catch (_error) {
      this.logger.warn('Ollama not available for vision tasks:', _error;
    }
  }

  /**
   * Parse photo-related intent from natural language
   */
  private async parsePhotoIntent(_request string): Promise<unknown> {
    const prompt = `Parse this photo organization _request

Request: "${_request"

Determine:
1. Action (organize, find_people, detect_faces, find_duplicates, create_album, analyze_photo)
2. Target (specific directory, person name, photo types)
3. Criteria (date range, location, organization strategy)
4. Preferences (preserve originals, create copies, etc.)

Respond with JSON: {
  "action": "...",
  "target": "...", 
  "criteria": {...},
  "preferences": {...}
}`;

    try {
      const response = await axios.post('http://localhost:11434/api/generate', {
        model: 'llama3.2:3b',
        prompt,
        stream: false,
        format: 'json',
      });

      return JSON.parse(response.data.response);
    } catch (_error) {
      return this.fallbackPhotoIntentParsing(_request;
    }
  }

  /**
   * Organize photos based on different strategies
   */
  private async organizePhotos(intent: any): Promise<unknown> {
    const directory = intent.target || this.photosDirectory;
    const strategy = intent.criteria?.strategy || 'date';

    // Scan directory for photos
    const photos = await this.scanForPhotos(directory);

    let organized = 0;
    const collections: PhotoCollection[] = [];
    const duplicates: string[] = [];

    switch (strategy) {
      case 'date':
        const dateCollections = await this.organizeByDate(photos);
        collections.push(...dateCollections);
        organized = dateCollections.reduce((sum, c) => sum + c.photoCount, 0);
        break;

      case 'people':
        if (this.faceModelLoaded) {
          const peopleCollections = await this.organizeByPeople(photos);
          collections.push(...peopleCollections);
          organized = peopleCollections.reduce((sum, c) => sum + c.photoCount, 0);
        }
        break;

      case 'location':
        const locationCollections = await this.organizeByLocation(photos);
        collections.push(...locationCollections);
        organized = locationCollections.reduce((sum, c) => sum + c.photoCount, 0);
        break;

      case '_content:
        const contentCollections = await this.organizeByContent(photos);
        collections.push(...contentCollections);
        organized = contentCollections.reduce((sum, c) => sum + c.photoCount, 0);
        break;
    }

    // Find duplicates during organization
    const duplicateResult = await this.findDuplicatesInPhotos({ target: [directory] });
    const duplicateGroups = duplicateResult.duplicateGroups || [];
    duplicates.push(...duplicateGroups.map((g: any) => g.files).flat());

    // Store organization results in memory
    await this.storeOrganizationMemory(collections, duplicates, strategy);

    return {
      organized,
      collections,
      duplicates: duplicateGroups,
      strategy,
      totalPhotos: photos.length,
    };
  }

  /**
   * Detect faces in photos using local ML
   */
  private async detectFacesInPhotos(intent: any): Promise<unknown> {
    const photos = intent.target || [];
    const detections: FaceDetection[] = [];
    const newPersons: Person[] = [];
    let totalFaces = 0;

    for (const photoPath of photos) {
      try {
        const faceData = await this.detectFacesInSinglePhoto(photoPath);
        if (faceData) {
          detections.push(faceData);
          totalFaces += faceData.faces.length;

          // Check for new persons
          for (const face of faceData.faces) {
            if (!face.personId && intent.criteria?.createNewPersons) {
              const newPerson = await this.createNewPerson(face);
              if (newPerson) {
                newPersons.push(newPerson);
                face.personId = newPerson.id;
              }
            }
          }
        }
      } catch (_error) {
        this.logger.error`Face detection failed for ${photoPath}:`, _error;
      }
    }

    // Store face detection results
    await this.storeFaceDetections(detections);

    return {
      detections,
      newPersons,
      totalFaces,
      photosProcessed: photos.length,
    };
  }

  /**
   * Detect faces in a single photo
   */
  private async detectFacesInSinglePhoto(photoPath: string): Promise<FaceDetection | null> {
    if (!this.faceModelLoaded) {
      return this.fallbackFaceDetection(photoPath);
    }

    try {
      const pythonScript = `
import face_recognition
import cv2
import json
import sys

def detect_faces(image_path):
    try:
        # Load image
        image = face_recognition.load_image_file(image_path)
        
        # Find face locations and encodings
        face_locations = face_recognition.face_locations(image)
        face_encodings = face_recognition.face_encodings(image, face_locations)
        
        faces = []
        for i, (encoding, location) in enumerate(zip(face_encodings, face_locations)):
            faces.append({
                "id": f"face_{i}",
                "confidence": 0.9,  # face_recognition doesn't provide confidence
                "boundingBox": {
                    "x": location[3],
                    "y": location[0], 
                    "width": location[1] - location[3],
                    "height": location[2] - location[0]
                },
                "encoding": encoding.tolist()
            })
        
        return {
            "photoPath": image_path,
            "faces": faces
        }
        
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        return None

if __name__ == "__main__":
    result = detect_faces("${photoPath}")
    if result:
        print(json.dumps(result))
`;

      const tempScript = path.join('/tmp', `face_detect_${Date.now()}.py`);
      await fs.writeFile(tempScript, pythonScript);

      const output = execSync(`python3 ${tempScript}`, { encoding: 'utf8' });
      await fs.unlink(tempScript);

      const result = JSON.parse(output);

      // Match faces with known persons
      for (const face of result.faces) {
        const matchedPerson = await this.matchFaceToKnownPerson(face.encoding);
        if (matchedPerson) {
          face.personId = matchedPerson.id;
          face.personName = matchedPerson.name;
        }
      }

      return result;
    } catch (_error) {
      this.logger.error'Face detection script failed:', _error;
      return null;
    }
  }

  /**
   * Fallback face detection using Ollama vision models
   */
  private async fallbackFaceDetection(photoPath: string): Promise<FaceDetection | null> {
    try {
      // Convert image to base64 for Ollama
      const imageBuffer = await fs.readFile(photoPath);
      const base64Image = imageBuffer.toString('base64');

      const response = await axios.post('http://localhost:11434/api/generate', {
        model: 'llava:7b',
        prompt:
          'Analyze this image and identify any faces. Describe the number of people and their approximate positions.',
        images: [base64Image],
        stream: false,
      });

      // Parse Ollama response to extract face information
      const description = response.data.response;
      const faceCount = this.extractFaceCountFromDescription(description);

      return {
        photoPath,
        faces: Array.from({ length: faceCount }, (_, i) => ({
          id: `face_${i}`,
          confidence: 0.7,
          boundingBox: { x: 0, y: 0, width: 100, height: 100 }, // Placeholder
        })),
      };
    } catch (_error) {
      this.logger.error'Ollama face detection failed:', _error;
      return null;
    }
  }

  /**
   * Scan directory for photo files
   */
  private async scanForPhotos(directory: string): Promise<PhotoMetadata[]> {
    const photos: PhotoMetadata[] = [];
    const photoExtensions = ['.jpg', '.jpeg', '.png', '.tiff', '.raw', '.heic', '.webp'];

    try {
      const files = await fs.readdir(directory, { withFileTypes: true });

      for (const file of files) {
        if (file.isDirectory()) {
          // Recursively scan subdirectories
          const subPhotos = await this.scanForPhotos(path.join(directory, file.name));
          photos.push(...subPhotos);
        } else if (photoExtensions.includes(path.extname(file.name).toLowerCase())) {
          const filePath = path.join(directory, file.name);
          const metadata = await this.extractPhotoMetadata(filePath);
          if (metadata) {
            photos.push(metadata);
          }
        }
      }
    } catch (_error) {
      this.logger.error`Failed to scan directory ${directory}:`, _error;
    }

    return photos;
  }

  /**
   * Extract metadata from photo file
   */
  private async extractPhotoMetadata(filePath: string): Promise<PhotoMetadata | null> {
    try {
      const stats = await fs.stat(filePath);
      const fileBuffer = await fs.readFile(filePath);
      const hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

      // Try to extract EXIF data using exiftool if available
      let exifData: any = {};
      try {
        const exifOutput = execSync(`exiftool -json "${filePath}"`, { encoding: 'utf8' });
        exifData = JSON.parse(exifOutput)[0] || {};
      } catch (_error) {
        // exiftool not available, use basic metadata
      }

      return {
        path: filePath,
        filename: path.basename(filePath),
        size: stats.size,
        dateCreated: stats.birthtime,
        dateTaken: exifData.DateTimeOriginal ? new Date(exifData.DateTimeOriginal) : undefined,
        location:
          exifData.GPSLatitude && exifData.GPSLongitude
            ? {
                latitude: exifData.GPSLatitude,
                longitude: exifData.GPSLongitude,
              }
            : undefined,
        camera: exifData.Make
          ? {
              make: exifData.Make,
              model: exifData.Model,
              settings: {
                fNumber: exifData.FNumber,
                exposureTime: exifData.ExposureTime,
                iso: exifData.ISO,
              },
            }
          : undefined,
        hash,
        width: exifData.ImageWidth,
        height: exifData.ImageHeight,
      };
    } catch (_error) {
      this.logger.error`Failed to extract metadata from ${filePath}:`, _error;
      return null;
    }
  }

  /**
   * Check macOS Photos app access
   */
  private async checkPhotosAppAccess(): Promise<boolean> {
    try {
      // Try to access Photos library via AppleScript
      execSync(`osascript -e 'tell application "Photos" to get name of albums'`);
      this.logger.info('✅ Photos app access available');
      return true;
    } catch (_error) {
      this.logger.warn('⚠️ Photos app access may be restricted');
      return false;
    }
  }

  // Placeholder implementations for complex methods
  private async loadPersonDatabase(): Promise<void> {
    // Load known persons from database
  }

  private fallbackPhotoIntentParsing(_request string): any {
    const requestLower = _requesttoLowerCase();

    if (requestLower.includes('organize') || requestLower.includes('sort')) {
      return { action: 'organize', criteria: { strategy: 'date' } };
    }

    if (requestLower.includes('face') || requestLower.includes('people')) {
      return { action: 'detect_faces' };
    }

    if (requestLower.includes('duplicate')) {
      return { action: 'find_duplicates' };
    }

    return { action: 'organize' };
  }

  private async organizeByDate(photos: PhotoMetadata[]): Promise<PhotoCollection[]> {
    // Group photos by date and create collections
    return [];
  }

  private async organizeByPeople(photos: PhotoMetadata[]): Promise<PhotoCollection[]> {
    // Organize photos by detected people
    return [];
  }

  private async organizeByLocation(photos: PhotoMetadata[]): Promise<PhotoCollection[]> {
    // Organize photos by location metadata
    return [];
  }

  private async organizeByContent(photos: PhotoMetadata[]): Promise<PhotoCollection[]> {
    // Use ML to analyze _contentand organize
    return [];
  }

  /**
   * Find duplicate photos in a collection
   */
  private async findDuplicatesInPhotos(intent: any): Promise<unknown> {
    const directories = intent.target || [this.photosDirectory];
    const threshold = intent.parameters?.threshold || this.duplicateThreshold;

    const duplicateGroups: any[] = [];
    let totalDuplicates = 0;
    let spaceSavings = 0;

    // Collect all photos from directories
    const allPhotos: PhotoMetadata[] = [];
    for (const dir of directories) {
      const photos = await this.scanForPhotos(dir);
      allPhotos.push(...photos);
    }

    // Group by hash for exact duplicates
    const hashGroups = new Map<string, PhotoMetadata[]>();
    for (const photo of allPhotos) {
      const { hash } = photo;
      if (!hashGroups.has(hash)) {
        hashGroups.set(hash, []);
      }
      hashGroups.get(hash)!.push(photo);
    }

    // Find duplicate groups
    for (const [hash, photos] of hashGroups) {
      if (photos.length > 1) {
        const totalSize = photos.reduce((sum, p) => sum + p.size, 0);
        const spaceSaving = totalSize - photos[0].size;

        duplicateGroups.push({
          files: photos,
          duplicateType: 'exact',
          confidence: 1.0,
          potentialSpaceSaving: spaceSaving,
        });

        totalDuplicates += photos.length - 1;
        spaceSavings += spaceSaving;
      }
    }

    return {
      duplicateGroups,
      totalDuplicates,
      spaceSavings,
      totalFilesScanned: allPhotos.length,
    };
  }

  private async findDuplicatesInPhotosHelper(photos: PhotoMetadata[]): Promise<string[][]> {
    // Helper method for finding duplicates
    return [];
  }

  private async matchFaceToKnownPerson(encoding: number[]): Promise<Person | null> {
    // Match face encoding to known person
    return null;
  }

  private async createNewPerson(face: any): Promise<Person | null> {
    // Create new person entry
    return null;
  }

  private extractFaceCountFromDescription(description: string): number {
    // Extract number of faces from Ollama description
    const matches = description.match(/(\d+)\s+(people|person|face)/i);
    return matches ? parseInt(matches[1], 10) : 0;
  }

  private async storeOrganizationMemory(
    collections: PhotoCollection[],
    duplicates: string[],
    strategy: string
  ): Promise<void> {
    // Store organization results in memory
  }

  private async storeFaceDetections(detections: FaceDetection[]): Promise<void> {
    // Store face detection results
  }

  private calculateConfidence(intent: any, result: any): number {
    return 0.8;
  }

  private buildPhotoReasoning(intent: any, result: any): string {
    return `Processed photo ${intent.action} operation`;
  }

  private suggestPhotoActions(intent: any, result: any): string[] {
    return ['Review organized collections', 'Verify face identifications'];
  }

  private async findPhotosByPerson(intent: any): Promise<unknown> {
    return { photos: [] };
  }

  private async createSmartAlbum(intent: any): Promise<unknown> {
    return { album: null };
  }

  private async analyzePhotoContent(intent: any): Promise<unknown> {
    return { _analysis 'Photo _contentanalyzed' };
  }

  private async handleGeneralPhotoQuery(_request string): Promise<unknown> {
    return { response: 'General photo query processed' };
  }
}

export default PhotoOrganizerAgent;
