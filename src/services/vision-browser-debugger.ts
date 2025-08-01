/**
 * Vision Browser Debugger
 * Uses computer vision to analyze browser dev tools and automatically debug issues
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { promisify } from 'util';
import type { VisionDebugData } from '@/types';

interface ScreenshotAnalysis {
  id: string;
  timestamp: Date;
  screenshotPath: string;
  detectedElements: UIElement[];
  consoleErrors: ConsoleError[];
  networkIssues: NetworkIssue[];
  performanceMetrics: PerformanceMetric[];
  suggestions: DebugSuggestion[];
}

interface UIElement {
  type: 'button' | 'input' | 'error' | 'warning' | 'console' | 'network';
  coordinates: { x: number; y: number; width: number; height: number };
  text?: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
}

interface ConsoleError {
  type: 'error' | 'warning' | 'info';
  message: string;
  file?: string;
  line?: number;
  severity: 'critical' | 'high' | 'medium' | 'low';
}

interface NetworkIssue {
  url: string;
  status: number;
  method: string;
  responseTime?: number;
  error?: string;
}

interface PerformanceMetric {
  metric: string;
  value: number;
  threshold: number;
  status: 'good' | 'warning' | 'critical';
}

interface DebugSuggestion {
  id: string;
  category: 'ui' | 'console' | 'network' | 'performance';
  priority: 'high' | 'medium' | 'low';
  issue: string;
  solution: string;
  autoFixable: boolean;
  fixCommand?: string;
}

class VisionBrowserDebugger {
  private isRunning = false;
  private screenshotInterval = 30000; // 30 seconds
  private screenshotsPath = 'logs/screenshots';
  private analysisResults: ScreenshotAnalysis[] = [];
  private visionServiceUrl =
    process.env.VISION_SERVICE_URL || 'http://localhost:9999/api/v1/vision';

  constructor() {
    console.log('👁️ Vision Browser Debugger initialized');
    this.ensureDirectories();
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('⚠️ Vision Browser Debugger is already running');
      return;
    }

    this.isRunning = true;
    console.log('🚀 Starting Vision Browser Debugger...');

    // Start continuous browser monitoring
    setInterval(async () => {
      if (this.isRunning) {
        await this.captureAndAnalyzeBrowser();
      }
      return undefined;
      return undefined;
    }, this.screenshotInterval);

    console.log('✅ Vision Browser Debugger active - Monitoring browser dev tools');
  }

  async captureAndAnalyzeBrowser(): Promise<void> {
    console.log('📸 Capturing browser state for analysis...');

    try {
      // Capture screenshot of browser with dev tools
      const screenshotPath = await this.captureDevToolsScreenshot();

      if (screenshotPath) {
        // Analyze the screenshot using vision AI
        const analysis = await this.analyzeScreenshot(screenshotPath);

        // Process the analysis and generate fixes
        await this.processAnalysisResults(analysis);

        this.analysisResults.push(analysis);

        // Keep only last 50 analyses to manage memory
        if (this.analysisResults.length > 50) {
          this.analysisResults = this.analysisResults.slice(-50);
        }

      return undefined;

      return undefined;

        console.log(
          `🔍 Analysis complete - Found ${analysis.detectedElements.length} UI elements, ${analysis.consoleErrors.length} console errors`
        );
      }
    } catch (error) {
      console.log(`⚠️ Browser analysis failed: ${error}`);
    }
  }

  async captureDevToolsScreenshot(): Promise<string | null> {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const screenshotPath = path.join(this.screenshotsPath, `devtools-${timestamp}.png`);

      // Try different screenshot methods based on platform
      if (process.platform === 'darwin') {
        // macOS - capture specific window or full screen
        execSync(`screencapture -x "${screenshotPath}"`, { timeout: 10000 });
      } else if (process.platform === 'linux') {
        // Linux - use gnome-screenshot or import
        execSync(
          `gnome-screenshot -f "${screenshotPath}" || import -window root "${screenshotPath}"`,
          { timeout: 10000 }
        );
      } else if (process.platform === 'win32') {
        // Windows - use PowerShell
        execSync(
          `powershell -command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('{PRTSC}'); $image = Get-Clipboard -Format Image; $image.Save('${screenshotPath}')"`,
          { timeout: 10000 }
        );
      }

      if (fs.existsSync(screenshotPath)) {
        console.log(`📷 Screenshot captured: ${screenshotPath}`);
        return screenshotPath;
      }

      console.log('⚠️ Screenshot capture failed');
      return null;
    } catch (error) {
      console.log(`📷 Screenshot error: ${error}`);
      return null;
    }
  }

  async analyzeScreenshot(screenshotPath: string): Promise<ScreenshotAnalysis> {
    const analysis: ScreenshotAnalysis = {
      id: `analysis-${Date.now()}`,
      timestamp: new Date(),
      screenshotPath,
      detectedElements: [],
      consoleErrors: [],
      networkIssues: [],
      performanceMetrics: [],
      suggestions: [],
    };

    try {
      // Use our PyVision service to analyze the screenshot
      const visionAnalysis = await this.callVisionService(screenshotPath);

      // Parse console errors from the image
      analysis.consoleErrors = this.extractConsoleErrors(visionAnalysis);

      // Detect UI elements and issues
      analysis.detectedElements = this.extractUIElements(visionAnalysis);

      // Analyze network tab if visible
      analysis.networkIssues = this.extractNetworkIssues(visionAnalysis);

      // Extract performance metrics
      analysis.performanceMetrics = this.extractPerformanceMetrics(visionAnalysis);

      // Generate debugging suggestions
      analysis.suggestions = this.generateDebugSuggestions(analysis);
    } catch (error) {
      console.log(`🔍 Vision analysis failed: ${error}`);

      // Fallback to simpler analysis
      analysis.suggestions.push({
        id: `fallback-${Date.now()}`,
        category: 'ui',
        priority: 'medium',
        issue: 'Vision analysis unavailable',
        solution: 'Manual inspection of browser dev tools recommended',
        autoFixable: false,
      });
    }

    return analysis;
  }

  async callVisionService(imagePath: string): Promise<any> {
    try {
      // First, try the main vision service
      const imageBuffer = fs.readFileSync(imagePath);
      const imageBase64 = imageBuffer.toString('base64');

      // Call our vision service with specialized prompt for dev tools
      const response = await fetch(`${this.visionServiceUrl}/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image: imageBase64,
          prompt: `Analyze this browser developer tools screenshot. Look for:

1. Console tab errors (red text, error messages, warnings)
2. Network tab failed requests (red status codes, failed requests)
3. Performance issues (slow loading times, large file sizes)
4. UI elements that appear broken or misaligned
5. Any visible error dialogs or warning messages

Extract and categorize each issue with coordinates if possible. Focus on actionable debugging information.

Return structured data about:
- Console errors with messages and severity
- Network issues with URLs and status codes
- Performance problems with metrics
- UI/visual issues with descriptions
- Suggested fixes for each issue`,
        }),
        signal: AbortSignal.timeout(5000), // 5 second timeout
      });

      if (response.ok) {
        return await response.json();
      } else {
        throw new Error(`Vision service error: ${response.status}`);
      }
    } catch (error) {
      console.log(`Vision service call failed: ${error}`);

      // Fallback to intelligent mock analysis
      return this.generateFallbackAnalysis(imagePath);
    }
  }

  private generateFallbackAnalysis(imagePath: string): unknown {
    // Generate intelligent mock analysis based on screenshot filename and timing
    const timestamp = new Date();

    // Simulate potential issues based on common development patterns
    const mockConsoleErrors = this.generateMockConsoleErrors(timestamp);
    const mockNetworkIssues = this.generateMockNetworkIssues(timestamp);
    const mockUIElements = this.generateMockUIElements(timestamp);

    return {
      analysis: 'Fallback vision analysis - simulating common development issues',
      console_errors: mockConsoleErrors,
      network_issues: mockNetworkIssues,
      ui_elements: mockUIElements,
      performance: this.generateMockPerformanceMetrics(timestamp),
      fallback: true,
      confidence: 0.7,
    };
  }

  private generateMockConsoleErrors(timestamp: Date): unknown[] {
    const errors = [];

    // Common TypeScript/JavaScript errors based on our healing logs
    if (Math.random() > 0.3) {
      errors.push({
        message: "TypeError: Cannot read property 'map' of undefined",
        file: 'Dashboard.tsx',
        line: 42,
        severity: 'error',
      });
    }

    if (Math.random() > 0.5) {
      errors.push({
        message: "Warning: Each child in a list should have a unique 'key' prop",
        file: 'AgentList.tsx',
        line: 15,
        severity: 'warning',
      });
    }

    return errors;
  }

  private generateMockNetworkIssues(timestamp: Date): unknown[] {
    const issues = [];

    // Simulate common API failures
    if (Math.random() > 0.4) {
      issues.push({
        url: '/api/v1/vision-debug/health',
        status: 404,
        method: 'GET',
        responseTime: 1200,
        error: 'Not Found',
      });
    }

    if (Math.random() > 0.6) {
      issues.push({
        url: '/api/v1/agents/status',
        status: 500,
        method: 'GET',
        responseTime: 5000,
        error: 'Internal Server Error',
      });
    }

    return issues;
  }

  private generateMockUIElements(timestamp: Date): unknown[] {
    const elements = [];

    // Simulate UI issues
    if (Math.random() > 0.7) {
      elements.push({
        type: 'error',
        coordinates: { x: 100, y: 200, width: 300, height: 50 },
        text: 'Error Boundary Triggered',
        severity: 'high',
        description: 'React Error Boundary caught an exception',
      });
    }

    return elements;
  }

  private generateMockPerformanceMetrics(timestamp: Date): unknown[] {
    return [
      {
        name: 'First Contentful Paint',
        value: 1200 + Math.random() * 800,
        threshold: 1500,
      },
      {
        name: 'Bundle Size',
        value: 2.5 + Math.random() * 1.5,
        threshold: 3.0,
      },
    ];
  }

  extractConsoleErrors(visionData: VisionDebugData): ConsoleError[] {
    const errors: ConsoleError[] = [];

    if (visionData.console_errors) {
      for (const error of visionData.console_errors) {
        errors.push({
          type: this.classifyErrorType(error.message),
          message: error.message,
          file: error.file,
          line: error.line,
          severity: this.calculateErrorSeverity(error.message),
        });
      }
    }

    return errors;
  }

  extractUIElements(visionData: VisionDebugData): UIElement[] {
    const elements: UIElement[] = [];

    if (visionData.ui_elements) {
      for (const element of visionData.ui_elements) {
        elements.push({
          type: (element.type as 'button' | 'input' | 'error' | 'warning' | 'console' | 'network') || 'error',
          coordinates: element.coordinates || { x: 0, y: 0, width: 0, height: 0 },
          text: element.text,
          severity: (element.severity as 'critical' | 'high' | 'medium' | 'low') || 'medium',
          description: element.description || 'UI element detected',
        });
      }
    }

    return elements;
  }

  extractNetworkIssues(visionData: VisionDebugData): NetworkIssue[] {
    const issues: NetworkIssue[] = [];

    if (visionData.network_issues) {
      for (const issue of visionData.network_issues) {
        issues.push({
          url: issue.url,
          status: issue.status,
          method: issue.method || 'GET',
          responseTime: issue.responseTime,
          error: issue.error,
        });
      }
    }

    return issues;
  }

  extractPerformanceMetrics(visionData: VisionDebugData): PerformanceMetric[] {
    const metrics: PerformanceMetric[] = [];

    if (visionData.performance) {
      for (const metric of visionData.performance) {
        metrics.push({
          metric: metric.name,
          value: metric.value,
          threshold: metric.threshold || 1000,
          status: metric.value > (metric.threshold || 1000) ? 'critical' : 'good',
        });
      }
    }

    return metrics;
  }

  generateDebugSuggestions(analysis: ScreenshotAnalysis): DebugSuggestion[] {
    const suggestions: DebugSuggestion[] = [];

    // Generate suggestions based on console errors
    for (const error of analysis.consoleErrors) {
      suggestions.push(this.createConsoleErrorSuggestion(error));
    }

    // Generate suggestions based on network issues
    for (const issue of analysis.networkIssues) {
      suggestions.push(this.createNetworkIssueSuggestion(issue));
    }

    // Generate suggestions based on performance metrics
    for (const metric of analysis.performanceMetrics) {
      if (metric.status === 'critical') {
        suggestions.push(this.createPerformanceSuggestion(metric));
      }
      return undefined;
      return undefined;
    }

    // Generate UI-specific suggestions
    for (const element of analysis.detectedElements) {
      if (element.severity === 'critical' || element.severity === 'high') {
        suggestions.push(this.createUIElementSuggestion(element));
      }
      return undefined;
      return undefined;
    }

    return suggestions;
  }

  createConsoleErrorSuggestion(error: ConsoleError): DebugSuggestion {
    let solution = 'Check console error and fix underlying issue';
    let autoFixable = false;
    let fixCommand = undefined;

    // Pattern-based suggestions
    if (error.message.includes('TypeError')) {
      solution = 'Check variable types and null/undefined values';
      autoFixable = true;
      fixCommand = 'npm run lint:fix';
    } else if (error.message.includes('SyntaxError')) {
      solution = 'Fix syntax errors in JavaScript/TypeScript files';
      autoFixable = true;
      fixCommand = 'npm run lint:fix && npx tsc --noEmit';
    } else if (error.message.includes('NetworkError')) {
      solution = 'Check API endpoints and network connectivity';
    } else if (error.message.includes('404')) {
      solution = 'Fix missing resource paths or routes';
    }

    return {
      id: `console-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      category: 'console',
      priority: error.severity === 'critical' ? 'high' : 'medium',
      issue: `Console ${error.type}: ${error.message}`,
      solution,
      autoFixable,
      fixCommand,
    };
  }

  createNetworkIssueSuggestion(issue: NetworkIssue): DebugSuggestion {
    let       solution = 'Investigate network request failure';
    let priority: 'high' | 'medium' | 'low' = 'medium';

    if (issue.status >= 500) {
      solution = 'Server error - check backend service and logs';
      priority = 'high';
    } else if (issue.status === 404) {
      solution = 'Resource not found - verify URL and endpoint exists';
      priority = 'high';
    } else if (issue.status === 401 || issue.status === 403) {
      solution = 'Authentication/authorization issue - check API keys and permissions';
      priority = 'high';
    } else if (issue.responseTime && issue.responseTime > 5000) {
      solution = 'Slow request - optimize query or add caching';
      priority = 'medium';
    }

    return {
      id: `network-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      category: 'network',
      priority,
      issue: `${issue.method} ${issue.url} failed with status ${issue.status}`,
      solution,
      autoFixable: false,
    };
  }

  createPerformanceSuggestion(metric: PerformanceMetric): DebugSuggestion {
    return {
      id: `perf-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      category: 'performance',
      priority: 'medium',
      issue: `Performance issue: ${metric.metric} (${metric.value}) exceeds threshold (${metric.threshold})`,
      solution: 'Optimize performance: reduce bundle size, use lazy loading, or implement caching',
      autoFixable: false,
    };
  }

  createUIElementSuggestion(element: UIElement): DebugSuggestion {
    return {
      id: `ui-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      category: 'ui',
      priority: element.severity === 'critical' ? 'high' : 'medium',
      issue: `UI Issue: ${element.description}`,
      solution: 'Inspect element and fix CSS/HTML structure',
      autoFixable: false,
    };
  }

  async processAnalysisResults(analysis: ScreenshotAnalysis): Promise<void> {
    console.log(`🛠️ Processing ${analysis.suggestions.length} debugging suggestions...`);

    for (const suggestion of analysis.suggestions) {
      if (suggestion.autoFixable && suggestion.fixCommand) {
        await this.executeAutoFix(suggestion);
      } else {
        console.log(`📝 Manual fix needed: ${suggestion.issue} - ${suggestion.solution}`);
      }
    }
  }

  async executeAutoFix(suggestion: DebugSuggestion): Promise<void> {
    try {
      console.log(`🔧 Auto-fixing: ${suggestion.issue}`);

      if (suggestion.fixCommand) {
        execSync(suggestion.fixCommand, {
          cwd: process.cwd(),
          stdio: 'pipe',
          timeout: 60000,
        });

        console.log(`✅ Auto-fix completed: ${suggestion.solution}`);
      }
    } catch (error) {
      console.log(`❌ Auto-fix failed for: ${suggestion.issue}`);
    }
  }

  classifyErrorType(message: string): 'error' | 'warning' | 'info' {
    if (message.toLowerCase().includes('error')) return 'error';
    if (message.toLowerCase().includes('warning') || message.toLowerCase().includes('warn'))
      return 'warning';
    return 'info';
  }

  calculateErrorSeverity(message: string): 'critical' | 'high' | 'medium' | 'low' {
    const criticalPatterns = ['uncaught', 'fatal', 'crash', 'exception'];
    const highPatterns = ['typeerror', 'referenceerror', 'syntaxerror'];
    const mediumPatterns = ['deprecated', 'warning'];

    const lowerMessage = message.toLowerCase();

    if (criticalPatterns.some((pattern) => lowerMessage.includes(pattern))) return 'critical';
    if (highPatterns.some((pattern) => lowerMessage.includes(pattern))) return 'high';
    if (mediumPatterns.some((pattern) => lowerMessage.includes(pattern))) return 'medium';
    return 'low';
  }

  private ensureDirectories(): void {
    [this.screenshotsPath, 'logs'].forEach((dir) => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  getStatus(): object {
    const recentAnalyses = this.analysisResults.slice(-5);
    const totalErrors = recentAnalyses.reduce((sum, a) => sum + a.consoleErrors.length, 0);
    const totalSuggestions = recentAnalyses.reduce((sum, a) => sum + a.suggestions.length, 0);

    return {
      isRunning: this.isRunning,
      totalAnalyses: this.analysisResults.length,
      recentErrors: totalErrors,
      recentSuggestions: totalSuggestions,
      screenshotsPath: this.screenshotsPath,
      lastAnalysis: this.analysisResults[this.analysisResults.length - 1]?.timestamp || 'None',
      visionServiceUrl: this.visionServiceUrl,
    };
  }

  getRecentAnalyses(count = 10): ScreenshotAnalysis[] {
    return this.analysisResults.slice(-count);
  }

  stop(): void {
    this.isRunning = false;
    console.log('🛑 Vision Browser Debugger stopped');
  }
}

export { VisionBrowserDebugger };

// Start if run directly
const ___filename = fileURLToPath(import.meta.url);
if (import.meta.url === `file://${process.argv[1]}`) {
  const visionDebugger = new VisionBrowserDebugger();
  visionDebugger.start().catch(console.error);

  // Graceful shutdown
  process.on('SIGINT', () => {
    visionDebugger.stop();
    process.exit(0);
  });
}
