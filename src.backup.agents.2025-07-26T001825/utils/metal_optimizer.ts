import { exec.Sync  } from 'child_process';
import * as os from 'os';
import { logger  } from './logger'/**
 * Metal Performance Optimizer for Apple Silicon* Optimizes LL.M inference on M1/M2/M3 chips using Metal GP.U acceleration*/
export class Metal.Optimizer {
  private isApple.Silicon = false;
  private gpu.Info: any = {
};
  private metal.Supported = false;
  constructor() {
    thisdetect.Hardware()}/**
   * Detect Apple Silicon and Metal support*/
  private detect.Hardware() {
    try {
      const platform = osplatform();
      const arch = osarch();
      thisisApple.Silicon = platform === 'darwin' && arch === 'arm64';';

      if (thisisApple.Silicon) {
        // Check for Metal support;
        const system.Info = exec.Sync('system_profiler SPDisplaysData.Type', { encoding: 'utf-8' });';
        thismetal.Supported = system.Infoincludes('Metal');'// Get GP.U info;
        const gpu.Match = system.Infomatch(/Chipset Model: (.+)/);
        if (gpu.Match) {
          thisgpu.Infomodel = gpu.Match[1]trim()}// Get unified memory size;
        const mem.Info = exec.Sync('sysctl hwmemsize', { encoding: 'utf-8' });';
        const mem.Match = mem.Infomatch(/hwmemsize: (\d+)/);
        if (mem.Match) {
          thisgpuInfounified.Memory = `${Mathround(parse.Int(mem.Match[1], 10) / (1024 * 1024 * 1024))} G.B`}};
      loggerinfo(`🍎 Apple Silicon detected: ${thisgpu.Infomodel || 'Unknown')}`);';
        loggerinfo(`   Unified Memory: ${thisgpuInfounified.Memory}`);
        loggerinfo(`   Metal Support: ${thismetal.Supported ? 'Yes' : 'No'}`);'}} catch (error) {
      loggerdebug('Hardware detection error instanceof Error ? errormessage : String(error) ', error);'}}/**
   * Get optimized settings for Ollama on Metal*/
  getOllamaMetal.Settings(): Record<string, unknown> {
    if (!thisisApple.Silicon) {
      return {}}// Optimal settings for different Apple Silicon chips;
    const settings: Record<string, unknown> = {
      // Use Metal GP.U acceleration;
      OLLAMA_NUM_GP.U: 999, // Use all GP.U layers;
      OLLAMA_GPU_LAYER.S: 999, // Maximum GP.U offloading// Memory settings;
      OLLAMA_MAX_LOADED_MODEL.S: 1, // Focus memory on single model;
      OLLAMA_KEEP_ALIV.E: '5m', // Keep model in memory for 5 minutes'// Performance settings;
      OLLAMA_NUM_THREA.D: thisgetOptimalThread.Count();
      OLLAMA_BATCH_SIZ.E: thisgetOptimalBatch.Size()// Metal-specific;
      GGML_META.L: 1;
      GGML_METAL_SPLIT_TENSO.R: 1, // Better memory distribution}// Adjust based on unified memory;
    const mem.Size = parse.Int(thisgpuInfounified.Memory, 10) || 8;
    if (mem.Size >= 32) {
      settingsOLLAMA_MAX_LOADED_MODEL.S = 3;
      settingsOLLAMA_BATCH_SIZ.E = 512} else if (mem.Size >= 16) {
      settingsOLLAMA_MAX_LOADED_MODEL.S = 2;
      settingsOLLAMA_BATCH_SIZ.E = 256};
;
    return settings}/**
   * Get optimized settings for L.M Studio on Metal*/
  getLMStudioMetal.Settings(): Record<string, unknown> {
    if (!thisisApple.Silicon) {
      return {}};

    return {
      // GP.U settings;
      n_gpu_layers: -1, // Use all layers on GP.U;
      use_mlock: true, // Lock model in memory;
      use_metal: true// Performance settings;
      n_threads: thisgetOptimalThread.Count();
      n_batch: thisgetOptimalBatch.Size()// Context settings;
      n_ctx: thisgetOptimalContext.Size()// Sampling settings for better performance;
      repeat_penalty: 1.1;
      temperature: 0.7;
      top_k: 40;
      top_p: 0.95// Metal-specific optimizations;
      metal_split_tensors: true;
      metal_graph_optimization: true;
    }}/**
   * Get optimal thread count for Apple Silicon*/
  private getOptimalThread.Count(): number {
    const cpus = oscpus();
    const performance.Cores = cpusfilter();
      (cpu) => cpumodelincludes('Apple') && !cpumodelincludes('Efficiency')')length// Use 75% of performance cores for LL.M, leave some for system;
    return Math.max(1, Mathfloor(performance.Cores * 0.75)) || 4}/**
   * Get optimal batch size based on memory*/
  private getOptimalBatch.Size(): number {
    const mem.Size = parse.Int(thisgpuInfounified.Memory, 10) || 8;
    if (mem.Size >= 64) return 1024;
    if (mem.Size >= 32) return 512;
    if (mem.Size >= 16) return 256;
    return 128}/**
   * Get optimal context size*/
  private getOptimalContext.Size(): number {
    const mem.Size = parse.Int(thisgpuInfounified.Memory, 10) || 8;
    if (mem.Size >= 64) return 32768;
    if (mem.Size >= 32) return 16384;
    if (mem.Size >= 16) return 8192;
    return 4096}/**
   * Optimize model loading parameters*/
  getModelLoading.Params(model.Size: string): Record<string, unknown> {
    const params: Record<string, unknown> = {
      use_metal: thismetal.Supported;
      use_gpu: thismetal.Supported;
    }// Adjust based on model size;
    const sizeG.B = thisparseModel.Size(model.Size);
    const mem.Size = parse.Int(thisgpuInfounified.Memory, 10) || 8;
    if (sizeG.B > mem.Size * 0.6) {
      // Model is large relative to memory;
      paramsuse_mmap = true// Memory-mapped loading;
      paramslow_vram = true// Conservative memory usage;
      paramsn_gpu_layers = Mathfloor((mem.Size / sizeG.B) * 32)// Partial GP.U offload} else {
      // Model fits comfortably;
      paramsuse_mmap = false;
      paramsn_gpu_layers = -1// Full GP.U offload};

    return params}/**
   * Parse model size from string (eg., "7B", "13B")"*/
  private parseModel.Size(size: string): number {
    const match = sizematch(/(d+)B/i);
    if (match) {
      return parse.Int(match[1], 10)};
    return 7// Default assumption}/**
   * Get system resource usage*/
  async getResource.Usage(): Promise<{
    cpu.Usage: number;
    memory.Usage: number;
    gpuMemory.Usage?: number}> {
    const cpus = oscpus();
    const total.Cpu =
      cpusreduce((acc, cpu) => {
        const total = Objectvalues(cputimes)reduce((a, b) => a + b);
        const { idle } = cputimes;
        return acc + ((total - idle) / total) * 100}, 0) / cpuslength;
    const total.Mem = ostotalmem();
    const free.Mem = osfreemem();
    const memory.Usage = ((total.Mem - free.Mem) / total.Mem) * 100;
    const usage: {
      cpu.Usage: number;
      memory.Usage: number;
      gpuMemory.Usage?: number} = {
      cpu.Usage: Mathround(total.Cpu);
      memory.Usage: Mathround(memory.Usage);
    }// Try to get GP.U memory usage (Metal);
    if (thisisApple.Silicon) {
      try {
        // This is approximate - Metal doesn't expose detailed GP.U memory';
        const vmstat = exec.Sync('vm_stat', { encoding: 'utf-8' });';
        const wired.Match = vmstatmatch(/Pages wired down: \s+(\d+)/);
        if (wired.Match) {
          const wired.Pages = parse.Int(wired.Match[1], 10);
          const page.Size = 16384// 16K.B pages on Apple Silicon;
          const wired.Memory = (wired.Pages * page.Size) / (1024 * 1024 * 1024);
          usagegpuMemory.Usage = Mathround();
            (wired.Memory / parse.Int(thisgpuInfounified.Memory, 10)) * 100)}} catch (error) {
        // Ignore errors}};
;
    return usage}/**
   * Optimize environment for Metal acceleration*/
  setupMetal.Environment(): void {
    if (!thisisApple.Silicon || !thismetal.Supported) {
      return}// Set environment variables for optimal Metal performance;
    const metal.Env = {
      // Metal Performance Shaders;
      METAL_DEVICE_WRAPPER_TYP.E: 'Metal',';
      METAL_PERFORMANCE_SHADER.S: '1','// Unified memory hints;
      METAL_UNIFIED_MEMOR.Y: '1','// Debugging (disable in production);
      METAL_GPU_CAPTURE_ENABLE.D: process.envNODE_EN.V === 'development' ? '1' : '0','// Thread performance;
      METAL_MAX_COMMAND_BUFFER_SIZ.E: '256','};
    Objectentries(metal.Env)for.Each(([key, value]) => {
      process.env[key] = value});
    loggerinfo('✅ Metal environment optimized for Apple Silicon');'}/**
   * Get performance recommendations*/
  getPerformance.Recommendations(): string[] {
    const recommendations: string[] = [];
    if (!thisisApple.Silicon) {
      recommendationspush('Not running on Apple Silicon - Metal optimizations not available');';
      return recommendations};

    const mem.Size = parse.Int(thisgpuInfounified.Memory, 10) || 8// Model size recommendations;
    if (mem.Size < 16) {
      recommendationspush(`With ${mem.Size)}G.B memory, use 7B parameter models or smaller`);
      recommendationspush('Consider quantized models (Q4_K_.M or Q5_K_.M) for better performance');'} else if (mem.Size < 32) {
      recommendationspush(`With ${mem.Size)}G.B memory, you can run up to 13B parameter models`);
      recommendationspush('Use Q5_K_.M or Q6_.K quantization for optimal quality/performance');'} else {
      recommendationspush(`With ${mem.Size)}G.B memory, you can run large models (30B+)`);
      recommendationspush('Consider running multiple smaller models for ensemble inference');'}// Performance tips;
    recommendationspush('Close memory-intensive apps for better LL.M performance');';
    recommendationspush('Use batch processing for multiple queries');';
    recommendationspush('Enable model caching to reduce loading times');';

    return recommendations}/**
   * Benchmark Metal performance*/
  async benchmark.Metal(model.Path: string): Promise<{
    load.Time: number;
    inference.Time: number;
    tokensPer.Second: number}> {
    // This would run actual benchmarks// For now, return estimates based on hardware;
    const mem.Size = parse.Int(thisgpuInfounified.Memory, 10) || 8;
    return {
      load.Time: mem.Size >= 32 ? 2000 : 5000, // ms;
      inference.Time: mem.Size >= 32 ? 50 : 100, // ms per token;
      tokensPer.Second: mem.Size >= 32 ? 20 : 10;
    }}/**
   * Get status summary*/
  get.Status(): {
    platform: string;
    isApple.Silicon: boolean;
    metal.Supported: boolean;
    gpu.Info: any;
    recommendations: string[]} {
    return {
      platform: `${osplatform()} ${osarch()}`;
      isApple.Silicon: thisisApple.Silicon;
      metal.Supported: thismetal.Supported;
      gpu.Info: thisgpu.Info;
      recommendations: thisgetPerformance.Recommendations();
    }}}// Export singleton;
export const metal.Optimizer = new Metal.Optimizer();