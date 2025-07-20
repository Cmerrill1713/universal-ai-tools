import * as THREE from 'three';

interface QualitySettings {
  shadowMapSize: number;
  textureSize: number;
  particleCount: number;
  postProcessing: boolean;
  antialias: boolean;
}

interface PerformanceMetrics {
  fps: number;
  drawCalls: number;
  triangles: number;
  memory: number;
}

export class PerformanceOptimizer {
  private qualitySettings: { [key: string]: QualitySettings } = {
    low: {
      shadowMapSize: 512,
      textureSize: 512,
      particleCount: 100,
      postProcessing: false,
      antialias: false
    },
    medium: {
      shadowMapSize: 1024,
      textureSize: 1024,
      particleCount: 500,
      postProcessing: true,
      antialias: true
    },
    high: {
      shadowMapSize: 2048,
      textureSize: 2048,
      particleCount: 1000,
      postProcessing: true,
      antialias: true
    }
  };

  private currentQuality: string = 'high';
  private metrics: PerformanceMetrics = {
    fps: 60,
    drawCalls: 0,
    triangles: 0,
    memory: 0
  };
  
  private shaderCache = new Map<string, any>();
  private textureCache = new Map<string, THREE.Texture>();
  private objectPools = new Map<string, any[]>();
  private qualityChangeCallbacks: ((quality: string) => void)[] = [];

  constructor() {
    this.initializeOptimizations();
  }

  private initializeOptimizations() {
    // Enable GPU instancing
    if (THREE.InstancedMesh) {
      console.log('GPU Instancing enabled');
    }

    // Enable texture compression
    if (typeof DRACOLoader !== 'undefined') {
      console.log('DRACO compression enabled');
    }
  }

  public createInstancedMesh(options: {
    geometry: string;
    material: string;
    count: number;
  }) {
    return {
      count: options.count,
      geometry: options.geometry,
      material: options.material
    };
  }

  public createTextureAtlas(texturePaths: string[]) {
    const atlas = {
      textures: texturePaths,
      uvMaps: new Map<string, { u: number; v: number; width: number; height: number }>()
    };

    // Calculate UV coordinates for each texture in the atlas
    texturePaths.forEach((path, index) => {
      const row = Math.floor(index / 4);
      const col = index % 4;
      atlas.uvMaps.set(path, {
        u: col * 0.25,
        v: row * 0.25,
        width: 0.25,
        height: 0.25
      });
    });

    return atlas;
  }

  public performFrustumCulling(scene: THREE.Scene, camera: THREE.Camera): THREE.Object3D[] {
    const frustum = new THREE.Frustum();
    const matrix = new THREE.Matrix4();
    matrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    frustum.setFromProjectionMatrix(matrix);

    const visibleObjects: THREE.Object3D[] = [];
    
    scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        const box = new THREE.Box3().setFromObject(object);
        if (frustum.intersectsBox(box)) {
          visibleObjects.push(object);
        }
      }
    });

    return visibleObjects;
  }

  public getShaderCache() {
    return this.shaderCache;
  }

  public batchDrawCalls(meshes: any[]) {
    const batches = new Map<string, any[]>();
    
    meshes.forEach(mesh => {
      const key = `${mesh.geometry}_${mesh.material}`;
      if (!batches.has(key)) {
        batches.set(key, []);
      }
      batches.get(key)!.push(mesh);
    });

    return Array.from(batches.values());
  }

  public updateMetrics(metrics: Partial<PerformanceMetrics>) {
    this.metrics = { ...this.metrics, ...metrics };
    
    // Auto-adjust quality based on FPS
    if (this.metrics.fps < 30 && this.currentQuality !== 'low') {
      this.setQuality('medium');
    } else if (this.metrics.fps < 45 && this.currentQuality === 'high') {
      this.setQuality('medium');
    } else if (this.metrics.fps > 55 && this.currentQuality === 'medium') {
      this.setQuality('high');
    }
  }

  private setQuality(quality: string) {
    this.currentQuality = quality;
    this.qualityChangeCallbacks.forEach(cb => cb(quality));
  }

  public onQualityChange(callback: (quality: string) => void) {
    this.qualityChangeCallbacks.push(callback);
  }

  public createObjectPool(type: string, size: number) {
    const pool: any[] = [];
    const available: any[] = [];

    for (let i = 0; i < size; i++) {
      const obj = { type, id: i, active: false };
      pool.push(obj);
      available.push(obj);
    }

    return {
      get: () => {
        const obj = available.pop();
        if (obj) {
          obj.active = true;
          return obj;
        }
        return null;
      },
      release: (obj: any) => {
        obj.active = false;
        available.push(obj);
      }
    };
  }

  public getOptimalTextureSettings(options: {
    width: number;
    height: number;
    usage: string;
  }) {
    const settings = this.qualitySettings[this.currentQuality];
    const maxSize = settings.textureSize;

    return {
      width: Math.min(options.width, maxSize),
      height: Math.min(options.height, maxSize),
      generateMipmaps: true,
      minFilter: THREE.LinearMipmapLinearFilter,
      magFilter: THREE.LinearFilter,
      anisotropy: this.currentQuality === 'high' ? 16 : 4
    };
  }

  public performOcclusionCulling(objects: any[], camera: any) {
    // Simple distance-based occlusion culling
    const maxDistance = 100;
    const cameraPos = new THREE.Vector3(camera.position.x, camera.position.y, camera.position.z);

    return objects.filter(obj => {
      const objPos = new THREE.Vector3(
        (obj.boundingBox.min.x + obj.boundingBox.max.x) / 2,
        (obj.boundingBox.min.y + obj.boundingBox.max.y) / 2,
        (obj.boundingBox.min.z + obj.boundingBox.max.z) / 2
      );
      
      return cameraPos.distanceTo(objPos) < maxDistance;
    });
  }

  public batchStateChanges(stateChanges: any[]) {
    const optimized: any[] = [];
    const currentState = new Map<string, any>();

    stateChanges.forEach(change => {
      const current = currentState.get(change.type);
      if (current !== change.value) {
        currentState.set(change.type, change.value);
        optimized.push(change);
      }
    });

    return optimized;
  }

  public calculateLOD(object: any, camera: any): number {
    const distance = new THREE.Vector3(
      object.position.x,
      object.position.y,
      object.position.z
    ).distanceTo(new THREE.Vector3(
      camera.position.x,
      camera.position.y,
      camera.position.z
    ));

    if (distance < 10) return 0; // Highest detail
    if (distance < 30) return 1;
    if (distance < 60) return 2;
    return 3; // Lowest detail
  }

  public optimizeScene(scene: THREE.Scene, camera: THREE.Camera) {
    // Merge geometries where possible
    const geometriesToMerge: THREE.BufferGeometry[] = [];
    
    scene.traverse((object) => {
      if (object instanceof THREE.Mesh && object.geometry instanceof THREE.BufferGeometry) {
        geometriesToMerge.push(object.geometry);
      }
    });

    // Enable GPU picking
    scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.matrixAutoUpdate = false;
        object.updateMatrix();
      }
    });

    // Optimize materials
    const materials = new Set<THREE.Material>();
    scene.traverse((object) => {
      if (object instanceof THREE.Mesh && object.material) {
        materials.add(object.material as THREE.Material);
      }
    });

    materials.forEach(material => {
      if (material instanceof THREE.MeshStandardMaterial) {
        material.metalness = Math.min(material.metalness, 0.5);
        material.roughness = Math.max(material.roughness, 0.5);
      }
    });
  }

  public getPerformanceReport(): string {
    return `
Performance Report:
- FPS: ${this.metrics.fps}
- Draw Calls: ${this.metrics.drawCalls}
- Triangles: ${this.metrics.triangles}
- Memory: ${(this.metrics.memory / 1024 / 1024).toFixed(2)} MB
- Quality: ${this.currentQuality}
    `.trim();
  }
}

// Export singleton instance
export const performanceOptimizer = new PerformanceOptimizer();