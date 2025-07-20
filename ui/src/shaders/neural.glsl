// Neural Network Visualization Shader for Sweet Athena
// Creates dynamic neural pathways and synaptic connections

// Vertex Shader
export const neuralVertexShader = `
  attribute float connectionStrength;
  attribute vec3 targetPosition;
  attribute float pulseOffset;
  
  varying vec3 vColor;
  varying float vStrength;
  varying vec2 vUv;
  varying float vPulse;
  
  uniform float time;
  uniform float globalActivity;
  uniform vec3 activeColor;
  uniform vec3 inactiveColor;
  
  void main() {
    vUv = uv;
    vStrength = connectionStrength;
    
    // Calculate pulse along the connection
    float pulseSpeed = 2.0;
    float pulse = mod(time * pulseSpeed + pulseOffset * 10.0, 1.0);
    vPulse = pulse;
    
    // Interpolate color based on connection strength
    vColor = mix(inactiveColor, activeColor, connectionStrength * globalActivity);
    
    // Add slight movement to vertices based on activity
    vec3 offset = vec3(
      sin(time * 2.0 + pulseOffset * 3.14) * 0.02,
      cos(time * 1.5 + pulseOffset * 2.0) * 0.02,
      sin(time * 3.0 + pulseOffset * 1.5) * 0.02
    ) * connectionStrength;
    
    vec3 animatedPosition = position + offset;
    
    gl_Position = projectionMatrix * modelViewMatrix * vec4(animatedPosition, 1.0);
    gl_PointSize = 3.0 + connectionStrength * 7.0;
  }
`;

// Fragment Shader for Neurons
export const neuralFragmentShader = `
  uniform float time;
  uniform float threshold;
  uniform vec3 synapseColor;
  uniform float glowIntensity;
  
  varying vec3 vColor;
  varying float vStrength;
  varying vec2 vUv;
  varying float vPulse;
  
  void main() {
    // Create circular neuron shape
    vec2 center = vec2(0.5);
    float dist = distance(gl_PointCoord, center);
    
    if (dist > 0.5) {
      discard;
    }
    
    // Neuron body with glow
    float alpha = 1.0 - smoothstep(0.3, 0.5, dist);
    float glow = exp(-dist * 5.0) * glowIntensity;
    
    // Add pulsing effect
    float pulseBrightness = sin(time * 3.0 + vPulse * 6.28) * 0.2 + 0.8;
    
    vec3 color = vColor * pulseBrightness + synapseColor * glow;
    
    // Add firing effect when above threshold
    if (vStrength > threshold) {
      float fire = sin(time * 10.0) * 0.5 + 0.5;
      color += vec3(1.0, 0.8, 0.0) * fire * 0.5;
    }
    
    gl_FragColor = vec4(color, alpha);
  }
`;

// Shader for Synaptic Connections (Lines)
export const synapseVertexShader = `
  attribute vec3 startPos;
  attribute vec3 endPos;
  attribute float connectionStrength;
  attribute float pulsePhase;
  
  varying float vStrength;
  varying float vProgress;
  varying vec3 vColor;
  
  uniform float time;
  uniform vec3 activeColor;
  uniform vec3 inactiveColor;
  uniform float curvature;
  
  vec3 bezierCurve(vec3 start, vec3 end, float t) {
    // Create curved connection using quadratic bezier
    vec3 mid = (start + end) * 0.5;
    mid.y += curvature * distance(start, end) * 0.3;
    
    // Quadratic bezier formula
    vec3 a = mix(start, mid, t);
    vec3 b = mix(mid, end, t);
    return mix(a, b, t);
  }
  
  void main() {
    vProgress = position.x; // Assuming x coordinate represents progress along line
    vStrength = connectionStrength;
    
    // Calculate curved path
    vec3 curvedPos = bezierCurve(startPos, endPos, vProgress);
    
    // Add wave motion along connection
    float wave = sin(vProgress * 10.0 - time * 3.0 + pulsePhase * 6.28) * 0.01;
    curvedPos.y += wave * connectionStrength;
    
    // Color based on signal strength
    vColor = mix(inactiveColor, activeColor, connectionStrength);
    
    gl_Position = projectionMatrix * modelViewMatrix * vec4(curvedPos, 1.0);
  }
`;

export const synapseFragmentShader = `
  uniform float time;
  uniform float signalSpeed;
  uniform vec3 pulseColor;
  uniform float fadeDistance;
  
  varying float vStrength;
  varying float vProgress;
  varying vec3 vColor;
  
  void main() {
    // Create signal pulse traveling along synapse
    float pulse = mod(time * signalSpeed + vProgress * 3.0, 1.0);
    float pulseMask = 1.0 - smoothstep(0.0, 0.1, abs(vProgress - pulse));
    
    // Base synapse color
    vec3 color = vColor;
    
    // Add traveling pulse
    color += pulseColor * pulseMask * vStrength * 2.0;
    
    // Fade at connection endpoints
    float fade = smoothstep(0.0, fadeDistance, vProgress) * 
                 smoothstep(1.0, 1.0 - fadeDistance, vProgress);
    
    // Electric glow effect
    float glow = exp(-abs(vProgress - 0.5) * 3.0) * 0.5;
    color += vColor * glow;
    
    gl_FragColor = vec4(color, fade * vStrength);
  }
`;

// Helper function for thought visualization shader
export const thoughtVisualizationShader = `
  uniform float time;
  uniform sampler2D thoughtData; // Texture containing thought patterns
  uniform vec3 thoughtColor;
  uniform float complexity;
  uniform float intensity;
  
  varying vec2 vUv;
  
  // Convert thought data to visual representation
  vec3 visualizeThought(vec2 uv) {
    // Sample thought data
    vec4 data = texture2D(thoughtData, uv);
    
    // Create interference patterns
    float pattern1 = sin(uv.x * 20.0 * complexity + time) * 
                     cos(uv.y * 20.0 * complexity - time);
    float pattern2 = sin(distance(uv, vec2(0.5)) * 30.0 - time * 2.0);
    
    // Combine patterns based on thought data
    float combined = mix(pattern1, pattern2, data.r);
    
    // Create color based on thought intensity
    vec3 color = thoughtColor * (0.5 + combined * 0.5) * intensity;
    
    // Add neural firing bursts
    float burst = step(0.98, data.g) * sin(time * 10.0);
    color += vec3(1.0, 0.9, 0.0) * burst;
    
    return color;
  }
  
  void main() {
    vec3 thought = visualizeThought(vUv);
    
    // Add holographic effect
    float scanline = sin(vUv.y * 200.0 + time * 5.0) * 0.02;
    thought *= 1.0 + scanline;
    
    gl_FragColor = vec4(thought, 1.0);
  }
`;

// Helper function to create neural network uniforms
export const getNeuralNetworkUniforms = () => ({
  time: { value: 0 },
  globalActivity: { value: 0.7 },
  activeColor: { value: [0.2, 0.8, 1.0] },
  inactiveColor: { value: [0.1, 0.1, 0.3] },
  synapseColor: { value: [0.5, 0.9, 1.0] },
  pulseColor: { value: [1.0, 1.0, 0.5] },
  threshold: { value: 0.7 },
  glowIntensity: { value: 1.5 },
  signalSpeed: { value: 0.5 },
  fadeDistance: { value: 0.1 },
  curvature: { value: 0.5 },
  thoughtColor: { value: [0.8, 0.6, 1.0] },
  complexity: { value: 1.0 },
  intensity: { value: 1.0 }
});