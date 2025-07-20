// Iridescent/Prismatic Shader for Sweet Athena
// Creates beautiful rainbow/oil-slick effects with thin-film interference

// Vertex Shader
export const iridescentVertexShader = `
  varying vec3 vNormal;
  varying vec3 vViewPosition;
  varying vec2 vUv;
  varying vec3 vWorldPosition;
  
  uniform float time;
  uniform float morphAmount;
  
  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    
    // Add subtle vertex displacement for organic movement
    vec3 displaced = position;
    float wave = sin(position.x * 10.0 + time) * cos(position.y * 10.0 + time * 0.8);
    displaced += normal * wave * 0.02 * morphAmount;
    
    vec4 mvPosition = modelViewMatrix * vec4(displaced, 1.0);
    vViewPosition = -mvPosition.xyz;
    vWorldPosition = (modelMatrix * vec4(displaced, 1.0)).xyz;
    
    gl_Position = projectionMatrix * mvPosition;
  }
`;

// Fragment Shader
export const iridescentFragmentShader = `
  uniform float time;
  uniform float thickness;
  uniform float ior; // Index of refraction
  uniform vec3 baseColor;
  uniform float intensity;
  uniform float roughness;
  uniform vec3 cameraPosition;
  
  varying vec3 vNormal;
  varying vec3 vViewPosition;
  varying vec2 vUv;
  varying vec3 vWorldPosition;
  
  // Thin-film interference calculation
  vec3 thinFilmInterference(float thickness, float ior, float cosTheta) {
    float wavelengthR = 650.0; // Red wavelength in nm
    float wavelengthG = 550.0; // Green wavelength in nm
    float wavelengthB = 450.0; // Blue wavelength in nm
    
    // Calculate optical path difference
    float opticalPath = 2.0 * ior * thickness * cosTheta;
    
    // Calculate interference for each wavelength
    float interferenceR = cos((opticalPath / wavelengthR) * 2.0 * 3.14159);
    float interferenceG = cos((opticalPath / wavelengthG) * 2.0 * 3.14159);
    float interferenceB = cos((opticalPath / wavelengthB) * 2.0 * 3.14159);
    
    // Map interference to color intensity
    vec3 color = vec3(
      (interferenceR + 1.0) * 0.5,
      (interferenceG + 1.0) * 0.5,
      (interferenceB + 1.0) * 0.5
    );
    
    return color;
  }
  
  // Schlick's approximation for Fresnel effect
  float fresnel(float cosTheta, float ior) {
    float r0 = pow((1.0 - ior) / (1.0 + ior), 2.0);
    return r0 + (1.0 - r0) * pow(1.0 - cosTheta, 5.0);
  }
  
  void main() {
    vec3 normal = normalize(vNormal);
    vec3 viewDir = normalize(cameraPosition - vWorldPosition);
    
    // Calculate view angle
    float cosTheta = abs(dot(normal, viewDir));
    
    // Animated thickness for dynamic effect
    float animatedThickness = thickness + sin(time * 0.5 + vUv.x * 10.0) * 50.0;
    
    // Calculate iridescent color
    vec3 iridescence = thinFilmInterference(animatedThickness, ior, cosTheta);
    
    // Add prismatic dispersion effect
    vec3 prism = vec3(
      sin(cosTheta * 20.0 + time),
      sin(cosTheta * 25.0 + time * 1.2),
      sin(cosTheta * 30.0 + time * 0.8)
    ) * 0.3 + 0.7;
    
    iridescence *= prism;
    
    // Calculate Fresnel effect
    float fresnelFactor = fresnel(cosTheta, ior);
    
    // Combine with base color
    vec3 finalColor = mix(baseColor, iridescence, fresnelFactor * intensity);
    
    // Add subtle glow at edges
    float edgeGlow = pow(1.0 - cosTheta, 2.0);
    finalColor += iridescence * edgeGlow * 0.5;
    
    // Apply roughness
    finalColor = mix(finalColor, baseColor, roughness);
    
    gl_FragColor = vec4(finalColor, 1.0);
  }
`;

// Helper function to create iridescent material uniforms
export const getIridescentUniforms = () => ({
  time: { value: 0 },
  thickness: { value: 300 }, // nm
  ior: { value: 1.3 }, // Index of refraction
  baseColor: { value: [0.9, 0.85, 0.95] },
  intensity: { value: 0.8 },
  roughness: { value: 0.1 },
  morphAmount: { value: 0.5 },
  cameraPosition: { value: [0, 0, 5] }
});