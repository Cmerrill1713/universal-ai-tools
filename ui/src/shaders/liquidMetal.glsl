// Liquid Metal Shader for Sweet Athena
// Creates mercury-like morphing effects with reflective surfaces

// Vertex Shader
export const liquidMetalVertexShader = `
  varying vec3 vNormal;
  varying vec3 vViewPosition;
  varying vec3 vWorldPosition;
  varying vec2 vUv;
  varying float vDistortion;
  
  uniform float time;
  uniform float morphStrength;
  uniform float flowSpeed;
  
  // Noise function for organic movement
  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
  vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
  
  float snoise(vec3 v) {
    const vec2 C = vec2(1.0/6.0, 1.0/3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
    
    vec3 i = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);
    
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);
    
    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;
    
    i = mod289(i);
    vec4 p = permute(permute(permute(
      i.z + vec4(0.0, i1.z, i2.z, 1.0))
      + i.y + vec4(0.0, i1.y, i2.y, 1.0))
      + i.x + vec4(0.0, i1.x, i2.x, 1.0));
      
    float n_ = 0.142857142857;
    vec3 ns = n_ * D.wyz - D.xzx;
    
    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
    
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);
    
    vec4 x = x_ *ns.x + ns.yyyy;
    vec4 y = y_ *ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);
    
    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);
    
    vec4 s0 = floor(b0)*2.0 + 1.0;
    vec4 s1 = floor(b1)*2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));
    
    vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
    
    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);
    
    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
    p0 *= norm.x;
    p1 *= norm.y;
    p2 *= norm.z;
    p3 *= norm.w;
    
    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
  }
  
  void main() {
    vUv = uv;
    
    // Create flowing liquid effect
    vec3 flowCoords = position + vec3(0.0, time * flowSpeed, 0.0);
    float noise1 = snoise(flowCoords * 3.0);
    float noise2 = snoise(flowCoords * 7.0 + time * 0.5);
    float noise3 = snoise(flowCoords * 15.0 - time * 0.3);
    
    // Combine noise octaves for complex distortion
    float distortion = noise1 * 0.5 + noise2 * 0.25 + noise3 * 0.125;
    vDistortion = distortion;
    
    // Apply morphing displacement
    vec3 displaced = position + normal * distortion * morphStrength;
    
    // Add surface tension effect
    float surfaceTension = smoothstep(-0.5, 0.5, distortion);
    displaced = mix(position, displaced, surfaceTension);
    
    vNormal = normalize(normalMatrix * normal);
    vec4 mvPosition = modelViewMatrix * vec4(displaced, 1.0);
    vViewPosition = -mvPosition.xyz;
    vWorldPosition = (modelMatrix * vec4(displaced, 1.0)).xyz;
    
    gl_Position = projectionMatrix * mvPosition;
  }
`;

// Fragment Shader
export const liquidMetalFragmentShader = `
  uniform vec3 baseColor;
  uniform float metalness;
  uniform float roughness;
  uniform vec3 cameraPosition;
  uniform samplerCube envMap;
  uniform float envMapIntensity;
  uniform float time;
  uniform vec3 lightPosition;
  
  varying vec3 vNormal;
  varying vec3 vViewPosition;
  varying vec3 vWorldPosition;
  varying vec2 vUv;
  varying float vDistortion;
  
  // Fresnel-Schlick approximation
  vec3 fresnelSchlick(float cosTheta, vec3 F0) {
    return F0 + (1.0 - F0) * pow(clamp(1.0 - cosTheta, 0.0, 1.0), 5.0);
  }
  
  // GGX/Trowbridge-Reitz normal distribution
  float distributionGGX(vec3 N, vec3 H, float roughness) {
    float a = roughness * roughness;
    float a2 = a * a;
    float NdotH = max(dot(N, H), 0.0);
    float NdotH2 = NdotH * NdotH;
    
    float num = a2;
    float denom = (NdotH2 * (a2 - 1.0) + 1.0);
    denom = 3.14159 * denom * denom;
    
    return num / denom;
  }
  
  // Geometry function for Smith model
  float geometrySchlickGGX(float NdotV, float roughness) {
    float r = (roughness + 1.0);
    float k = (r * r) / 8.0;
    
    float num = NdotV;
    float denom = NdotV * (1.0 - k) + k;
    
    return num / denom;
  }
  
  float geometrySmith(vec3 N, vec3 V, vec3 L, float roughness) {
    float NdotV = max(dot(N, V), 0.0);
    float NdotL = max(dot(N, L), 0.0);
    float ggx2 = geometrySchlickGGX(NdotV, roughness);
    float ggx1 = geometrySchlickGGX(NdotL, roughness);
    
    return ggx1 * ggx2;
  }
  
  void main() {
    vec3 N = normalize(vNormal);
    vec3 V = normalize(cameraPosition - vWorldPosition);
    vec3 L = normalize(lightPosition - vWorldPosition);
    vec3 H = normalize(V + L);
    
    // Add ripple distortion to normal
    vec2 ripple = vec2(
      sin(vUv.x * 40.0 + time * 2.0 + vDistortion * 10.0),
      cos(vUv.y * 40.0 + time * 1.5 - vDistortion * 10.0)
    ) * 0.02;
    N = normalize(N + vec3(ripple, 0.0));
    
    // Base reflectivity for metals
    vec3 F0 = vec3(0.95); // Mercury-like reflectivity
    F0 = mix(vec3(0.04), baseColor, metalness);
    
    // Cook-Torrance BRDF
    float NDF = distributionGGX(N, H, roughness);
    float G = geometrySmith(N, V, L, roughness);
    vec3 F = fresnelSchlick(max(dot(H, V), 0.0), F0);
    
    vec3 kS = F;
    vec3 kD = vec3(1.0) - kS;
    kD *= 1.0 - metalness;
    
    vec3 numerator = NDF * G * F;
    float denominator = 4.0 * max(dot(N, V), 0.0) * max(dot(N, L), 0.0) + 0.0001;
    vec3 specular = numerator / denominator;
    
    // Ambient lighting
    vec3 ambient = vec3(0.03) * baseColor;
    
    // Direct lighting
    float NdotL = max(dot(N, L), 0.0);
    vec3 Lo = (kD * baseColor / 3.14159 + specular) * vec3(1.0) * NdotL;
    
    // Environment reflection
    vec3 R = reflect(-V, N);
    vec3 envColor = vec3(0.8, 0.85, 0.9); // Fake environment color
    
    // Add flowing color variation
    vec3 flowColor = vec3(
      sin(vDistortion * 3.0 + time),
      sin(vDistortion * 4.0 + time * 1.2),
      sin(vDistortion * 5.0 + time * 0.8)
    ) * 0.1 + 0.9;
    
    vec3 color = ambient + Lo;
    color = mix(color, envColor, fresnelSchlick(max(dot(N, V), 0.0), F0).r * envMapIntensity);
    color *= flowColor;
    
    // Add subsurface glow for liquid effect
    float subsurface = pow(1.0 - max(dot(N, V), 0.0), 3.0) * 0.5;
    color += baseColor * subsurface * 0.3;
    
    gl_FragColor = vec4(color, 1.0);
  }
`;

// Helper function to create liquid metal material uniforms
export const getLiquidMetalUniforms = () => ({
  time: { value: 0 },
  baseColor: { value: [0.9, 0.9, 0.95] },
  metalness: { value: 0.95 },
  roughness: { value: 0.1 },
  morphStrength: { value: 0.1 },
  flowSpeed: { value: 0.2 },
  cameraPosition: { value: [0, 0, 5] },
  lightPosition: { value: [5, 5, 5] },
  envMapIntensity: { value: 0.5 }
});