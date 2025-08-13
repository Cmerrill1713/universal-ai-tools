#!/usr/bin/env tsx
/**
 * Face Detector Agent - Single File Agent (IndyDevDan style)
 * 
 * This agent does ONE thing really well: Detects faces in images
 * Can open Mac Photos app, process images, and return structured face data
 * 
 * Usage:
 *   npx tsx single-file-agents/face-detector.ts --image path/to/image.jpg
 *   npx tsx single-file-agents/face-detector.ts --open-photos
 *   npx tsx single-file-agents/face-detector.ts --batch folder/
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { readFile, readdir } from 'fs/promises';
import { join, extname } from 'path';
import sharp from 'sharp';
import * as tf from '@tensorflow/tfjs-node';
import * as faceapi from '@vladmandic/face-api';

const execAsync = promisify(exec);

// Configuration - Everything in one place
const CONFIG = {
  modelUrl: 'https://raw.githubusercontent.com/vladmandic/face-api/master/model',
  minConfidence: 0.5,
  supportedFormats: ['.jpg', '.jpeg', '.png', '.webp', '.tiff'],
  ollama: {
    url: 'http://localhost:11434',
    model: 'llava:13b'
  }
};

// Face detection result structure
interface FaceDetection {
  id: string;
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  landmarks?: any;
  confidence: number;
  age?: number;
  gender?: string;
  expression?: string;
  metadata?: {
    timestamp?: string;
    location?: string;
  };
}

interface ProcessedImage {
  path: string;
  faces: FaceDetection[];
  imageMetadata: {
    width: number;
    height: number;
    format: string;
  };
  analysisTime: number;
}

/**
 * Open Mac Photos app
 */
async function openMacPhotos(): Promise<void> {
  console.log('📸 Opening Mac Photos app...');
  await execAsync('open -a Photos');
  
  // Give it time to open
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Use AppleScript to get recent photos
  const script = `
    tell application "Photos"
      set recentPhotos to {}
      set photoList to every media item
      repeat with i from 1 to (count of photoList)
        if i > 10 then exit repeat
        set photo to item i of photoList
        set photoPath to filename of photo
        set end of recentPhotos to photoPath
      end repeat
      return recentPhotos
    end tell
  `;
  
  try {
    const { stdout } = await execAsync(`osascript -e '${script}'`);
    console.log('📷 Recent photos from Photos app:', stdout.split(',').slice(0, 5));
  } catch (error) {
    console.log('⚠️ Could not retrieve photos list (Photos app may need permission)');
  }
}

/**
 * Initialize face detection models
 */
async function initializeModels(): Promise<void> {
  console.log('🤖 Loading face detection models...');
  
  // Load models from local or remote
  await faceapi.nets.ssdMobilenetv1.loadFromUri(CONFIG.modelUrl);
  await faceapi.nets.faceLandmark68Net.loadFromUri(CONFIG.modelUrl);
  await faceapi.nets.faceRecognitionNet.loadFromUri(CONFIG.modelUrl);
  await faceapi.nets.ageGenderNet.loadFromUri(CONFIG.modelUrl);
  await faceapi.nets.faceExpressionNet.loadFromUri(CONFIG.modelUrl);
  
  console.log('✅ Models loaded successfully');
}

/**
 * Detect faces in a single image
 */
async function detectFacesInImage(imagePath: string): Promise<ProcessedImage> {
  const startTime = Date.now();
  
  console.log(`🔍 Processing: ${imagePath}`);
  
  // Read and decode image
  const imageBuffer = await readFile(imagePath);
  const image = sharp(imageBuffer);
  const metadata = await image.metadata();
  
  // Convert to tensor for face-api
  const imgTensor = tf.node.decodeImage(imageBuffer);
  
  // Detect faces with all attributes
  const detections = await faceapi
    .detectAllFaces(imgTensor as any)
    .withFaceLandmarks()
    .withFaceDescriptors()
    .withAgeAndGender()
    .withFaceExpressions();
  
  // Convert detections to our format
  const faces: FaceDetection[] = detections.map((detection, index) => ({
    id: `face_${Date.now()}_${index}`,
    boundingBox: {
      x: detection.detection.box.x,
      y: detection.detection.box.y,
      width: detection.detection.box.width,
      height: detection.detection.box.height
    },
    landmarks: detection.landmarks,
    confidence: detection.detection.score,
    age: Math.round(detection.age),
    gender: detection.gender,
    expression: Object.entries(detection.expressions)
      .reduce((a, b) => a[1] > b[1] ? a : b)[0],
    metadata: {
      timestamp: new Date().toISOString()
    }
  }));
  
  // Cleanup
  imgTensor.dispose();
  
  const analysisTime = Date.now() - startTime;
  
  console.log(`✅ Found ${faces.length} face(s) in ${analysisTime}ms`);
  
  return {
    path: imagePath,
    faces,
    imageMetadata: {
      width: metadata.width || 0,
      height: metadata.height || 0,
      format: metadata.format || 'unknown'
    },
    analysisTime
  };
}

/**
 * Use Ollama vision model for additional analysis
 */
async function analyzeWithOllama(imagePath: string): Promise<string> {
  try {
    const imageBuffer = await readFile(imagePath);
    const base64Image = imageBuffer.toString('base64');
    
    const response = await fetch(`${CONFIG.ollama.url}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: CONFIG.ollama.model,
        prompt: 'Describe the people in this image, including their approximate ages, expressions, and any notable features.',
        images: [base64Image],
        stream: false
      })
    });
    
    if (response.ok) {
      const data = await response.json();
      return data.response;
    }
  } catch (error) {
    console.log('⚠️ Ollama analysis unavailable');
  }
  
  return '';
}

/**
 * Process a batch of images from a directory
 */
async function processBatch(directoryPath: string): Promise<ProcessedImage[]> {
  console.log(`📁 Processing directory: ${directoryPath}`);
  
  const files = await readdir(directoryPath);
  const imageFiles = files.filter(file => 
    CONFIG.supportedFormats.includes(extname(file).toLowerCase())
  );
  
  console.log(`Found ${imageFiles.length} images to process`);
  
  const results: ProcessedImage[] = [];
  
  for (const file of imageFiles) {
    const imagePath = join(directoryPath, file);
    try {
      const result = await detectFacesInImage(imagePath);
      
      // Optionally enhance with Ollama
      const ollamaAnalysis = await analyzeWithOllama(imagePath);
      if (ollamaAnalysis) {
        console.log(`🤖 AI Analysis: ${ollamaAnalysis.substring(0, 100)}...`);
      }
      
      results.push(result);
    } catch (error) {
      console.error(`❌ Error processing ${file}:`, error);
    }
  }
  
  return results;
}

/**
 * Generate a summary report of all detected faces
 */
function generateReport(results: ProcessedImage[]): void {
  console.log('\n📊 FACE DETECTION REPORT');
  console.log('='.repeat(50));
  
  let totalFaces = 0;
  const ageGroups: Record<string, number> = {};
  const genderCount: Record<string, number> = { male: 0, female: 0 };
  const expressions: Record<string, number> = {};
  
  for (const result of results) {
    totalFaces += result.faces.length;
    
    for (const face of result.faces) {
      // Age grouping
      if (face.age) {
        const ageGroup = `${Math.floor(face.age / 10) * 10}-${Math.floor(face.age / 10) * 10 + 9}`;
        ageGroups[ageGroup] = (ageGroups[ageGroup] || 0) + 1;
      }
      
      // Gender
      if (face.gender) {
        genderCount[face.gender] = (genderCount[face.gender] || 0) + 1;
      }
      
      // Expressions
      if (face.expression) {
        expressions[face.expression] = (expressions[face.expression] || 0) + 1;
      }
    }
  }
  
  console.log(`\n📷 Images Processed: ${results.length}`);
  console.log(`👥 Total Faces Detected: ${totalFaces}`);
  console.log(`⏱️ Average Processing Time: ${
    Math.round(results.reduce((sum, r) => sum + r.analysisTime, 0) / results.length)
  }ms`);
  
  console.log('\n👶 Age Distribution:');
  Object.entries(ageGroups).sort().forEach(([group, count]) => {
    console.log(`  ${group}: ${'█'.repeat(count)} (${count})`);
  });
  
  console.log('\n👤 Gender Distribution:');
  Object.entries(genderCount).forEach(([gender, count]) => {
    console.log(`  ${gender}: ${count} (${Math.round(count / totalFaces * 100)}%)`);
  });
  
  console.log('\n😊 Expression Distribution:');
  Object.entries(expressions)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .forEach(([expression, count]) => {
      console.log(`  ${expression}: ${count}`);
    });
}

/**
 * Main entry point
 */
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args[0] === '--help') {
    console.log(`
Face Detector Agent - Single File Agent
Usage:
  --image <path>     Detect faces in a single image
  --batch <dir>      Process all images in a directory
  --open-photos      Open Mac Photos app and get recent photos
  --help            Show this help message
    `);
    return;
  }
  
  // Initialize models once
  await initializeModels();
  
  if (args[0] === '--open-photos') {
    await openMacPhotos();
    // In a real implementation, we'd get the actual photo paths and process them
    console.log('\n💡 To process photos, export them and use --batch with the export directory');
  } else if (args[0] === '--image' && args[1]) {
    const result = await detectFacesInImage(args[1]);
    console.log('\nResults:', JSON.stringify(result, null, 2));
  } else if (args[0] === '--batch' && args[1]) {
    const results = await processBatch(args[1]);
    generateReport(results);
    
    // Save results to file
    const outputPath = join(process.cwd(), 'face-detection-results.json');
    await Bun.write(outputPath, JSON.stringify(results, null, 2));
    console.log(`\n💾 Results saved to: ${outputPath}`);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

// Export for use by other agents
export { 
  detectFacesInImage, 
  processBatch, 
  openMacPhotos,
  analyzeWithOllama,
  type FaceDetection,
  type ProcessedImage 
};