// Volumetric Rendering Shader for Sweet Athena
// Creates atmospheric fog, light scattering, and volumetric effects

// Vertex Shader
export const volumetricVertexShader = `
  varying vec3 vWorldPosition;
  varying vec3 vViewPosition;
  varying vec2 vUv;
  
  void main() {
    vUv = uv;
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPos.xyz;
    vec4 mvPosition = viewMatrix * worldPos;
    vViewPosition = -mvPosition.xyz;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

// Fragment Shader
export const volumetricFragmentShader = `
  uniform vec3 baseColor;
  uniform vec3 lightPosition;
  uniform vec3 lightColor;
  uniform float lightIntensity;
  uniform vec3 cameraPosition;
  uniform float time;
  uniform float density;
  uniform float samples;
  uniform float scatteringCoeff;
  uniform float absorptionCoeff;
  uniform vec3 fogColor;
  uniform float fogDensity;
  uniform float noiseScale;
  uniform float noiseSpeed;
  
  varying vec3 vWorldPosition;
  varying vec3 vViewPosition;
  varying vec2 vUv;
  
  // Hash function for noise
  float hash(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }
  
  // 3D noise function
  float noise3D(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    
    return mix(mix(mix(hash(i + vec3(0, 0, 0)), 
                       hash(i + vec3(1, 0, 0)), f.x),
                   mix(hash(i + vec3(0, 1, 0)), 
                       hash(i + vec3(1, 1, 0)), f.x), f.y),
               mix(mix(hash(i + vec3(0, 0, 1)), 
                       hash(i + vec3(1, 0, 1)), f.x),
                   mix(hash(i + vec3(0, 1, 1)), 
                       hash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
  }
  
  // Fractal Brownian Motion
  float fbm(vec3 p) {
    float value = 0.0;
    float amplitude = 0.5;
    float frequency = 1.0;
    
    for (int i = 0; i < 5; i++) {
      value += amplitude * noise3D(p * frequency);
      amplitude *= 0.5;
      frequency *= 2.0;
    }
    
    return value;
  }
  
  // Phase function for light scattering (Henyey-Greenstein)
  float phaseFunction(float cosTheta, float g) {
    float g2 = g * g;
    float denom = 1.0 + g2 - 2.0 * g * cosTheta;
    return (1.0 - g2) / (4.0 * 3.14159 * pow(denom, 1.5));
  }
  
  // Ray marching for volumetric effects
  vec3 volumetricMarch(vec3 rayOrigin, vec3 rayDir, float maxDist) {
    vec3 accumulatedColor = vec3(0.0);
    float accumulatedDensity = 0.0;
    
    float stepSize = maxDist / samples;
    vec3 currentPos = rayOrigin;
    
    for (float i = 0.0; i < samples; i++) {
      // Sample noise for density variation
      vec3 noiseCoord = currentPos * noiseScale + vec3(time * noiseSpeed);
      float noiseSample = fbm(noiseCoord);
      
      // Calculate local density
      float localDensity = density * (0.5 + noiseSample * 0.5);
      
      // Light calculation
      vec3 lightDir = normalize(lightPosition - currentPos);
      float lightDist = length(lightPosition - currentPos);
      
      // Calculate light contribution with shadows
      vec3 shadowRayOrigin = currentPos;
      float shadowAccumulation = 0.0;
      
      // Shadow ray marching (simplified)
      for (float j = 0.0; j < 10.0; j++) {
        vec3 shadowPos = shadowRayOrigin + lightDir * (lightDist / 10.0) * j;
        float shadowNoise = fbm(shadowPos * noiseScale + vec3(time * noiseSpeed));
        shadowAccumulation += density * (0.5 + shadowNoise * 0.5) * (lightDist / 10.0);
      }
      
      // Calculate light attenuation
      float lightAttenuation = exp(-shadowAccumulation * absorptionCoeff);
      
      // Scattering
      float cosTheta = dot(rayDir, lightDir);
      float phase = phaseFunction(cosTheta, 0.2); // Forward scattering
      
      // Calculate in-scattering
      vec3 inScattering = lightColor * lightIntensity * phase * scatteringCoeff * lightAttenuation;
      
      // Accumulate color with Beer-Lambert law
      vec3 sampleColor = mix(fogColor, baseColor, noiseSample) + inScattering;
      float transmittance = exp(-accumulatedDensity * absorptionCoeff);
      
      accumulatedColor += sampleColor * localDensity * stepSize * transmittance;
      accumulatedDensity += localDensity * stepSize;
      
      currentPos += rayDir * stepSize;
      
      // Early termination if too opaque
      if (accumulatedDensity > 3.0) break;
    }
    
    return accumulatedColor;
  }
  
  // God rays / Light shafts
  vec3 calculateGodRays(vec3 rayOrigin, vec3 rayDir) {
    vec3 lightDir = normalize(lightPosition - rayOrigin);
    float cosAngle = dot(rayDir, lightDir);
    
    // Only calculate god rays when looking towards light
    if (cosAngle < 0.5) return vec3(0.0);
    
    vec3 godRayColor = vec3(0.0);
    float samples = 20.0;
    
    for (float i = 0.0; i < samples; i++) {
      float t = i / samples;
      vec3 samplePos = mix(rayOrigin, rayOrigin + rayDir * 10.0, t);
      
      // Calculate light visibility
      vec3 toLight = lightPosition - samplePos;
      float lightDist = length(toLight);
      vec3 lightSampleDir = toLight / lightDist;
      
      // Simple occlusion check using noise
      float occlusion = 1.0 - fbm(samplePos * 0.5 + time * 0.1) * 0.5;
      
      // Accumulate god ray contribution
      float intensity = occlusion * exp(-lightDist * 0.1) * (1.0 - t);
      godRayColor += lightColor * intensity / samples;
    }
    
    return godRayColor * cosAngle * 2.0;
  }
  
  void main() {
    vec3 rayDir = normalize(vWorldPosition - cameraPosition);
    float maxDist = length(vWorldPosition - cameraPosition);
    
    // Perform volumetric ray marching
    vec3 volumetricColor = volumetricMarch(cameraPosition, rayDir, maxDist);
    
    // Add god rays
    vec3 godRays = calculateGodRays(cameraPosition, rayDir);
    
    // Combine results
    vec3 finalColor = volumetricColor + godRays;
    
    // Apply fog
    float fogFactor = 1.0 - exp(-fogDensity * maxDist);
    finalColor = mix(finalColor, fogColor, fogFactor * 0.5);
    
    // Tone mapping
    finalColor = finalColor / (finalColor + vec3(1.0));
    
    // Gamma correction
    finalColor = pow(finalColor, vec3(1.0/2.2));
    
    gl_FragColor = vec4(finalColor, 1.0);
  }
`;

// Helper function to create volumetric material uniforms
export const getVolumetricUniforms = () => ({
  time: { value: 0 },
  baseColor: { value: [0.9, 0.85, 0.95] },
  lightPosition: { value: [5, 5, 5] },
  lightColor: { value: [1, 0.95, 0.8] },
  lightIntensity: { value: 2.0 },
  cameraPosition: { value: [0, 0, 5] },
  density: { value: 0.1 },
  samples: { value: 50 },
  scatteringCoeff: { value: 0.5 },
  absorptionCoeff: { value: 0.1 },
  fogColor: { value: [0.7, 0.8, 0.9] },
  fogDensity: { value: 0.05 },
  noiseScale: { value: 0.5 },
  noiseSpeed: { value: 0.1 }
});