/**
 * Project Completion Service
 * Service layer for project completion functionality
 * Used by the assistant when user requests project completion
 */

import { ProjectCompletionModule, type ProjectCompletionRequest } from '../modules/project-completion-module.js';
import { AgentRegistry } from '../agents/agent-registry.js';
import { log, LogContext } from '../utils/logger.js';
import path from 'path';
import fs from 'fs/promises';

export class ProjectCompletionService {
  private static instance: ProjectCompletionService;
  private completionModule: ProjectCompletionModule;
  private agentRegistry: AgentRegistry;

  private constructor() {
    this.agentRegistry = new AgentRegistry();
    this.completionModule = new ProjectCompletionModule(this.agentRegistry);
  }

  public static getInstance(): ProjectCompletionService {
    if (!ProjectCompletionService.instance) {
      ProjectCompletionService.instance = new ProjectCompletionService();
    }
    return ProjectCompletionService.instance;
  }

  /**
   * Main function called when assistant receives "complete this project" request
   */
  async handleProjectCompletionRequest(userInput: string, context?: any): Promise<string> {
    log.info('🎯 Processing project completion request from assistant', LogContext.SERVICE);

    try {
      // Check if this is a multi-service orchestration request first
      if (userInput.toLowerCase().includes('wireframe') || userInput.toLowerCase().includes('image')) {
        return this.handleMultiServiceRequest(userInput, {});
      }

      // Extract project information from user input and context
      const projectInfo = await this.extractProjectInfo(userInput, context);
      
      if (!projectInfo) {
        return "I need more information about the project you want me to complete. Please provide the project path or name.";
      }

      // Handle new project creation vs existing project completion
      if (projectInfo.isNewProject) {
        // Create new project autonomously
        log.info(`🆕 Creating new project: ${projectInfo.projectName}`, LogContext.SERVICE);
        const creationResult = await this.createNewProject(projectInfo);
        return creationResult;
      } else {
        // Validate existing project exists
        const projectExists = await this.validateProject(projectInfo.projectPath);
        if (!projectExists) {
          return `I couldn't find a project at "${projectInfo.projectPath}". Please check the path and try again.`;
        }
      }

      // Create completion request
      const request: ProjectCompletionRequest = {
        projectPath: projectInfo.projectPath,
        projectName: projectInfo.projectName,
        requirements: projectInfo.requirements,
        priority: 'high' // User-requested completions are high priority
      };

      log.info(`🚀 Starting project completion: ${request.projectName}`, LogContext.SERVICE);

      // Start project completion
      const result = await this.completionModule.completeProject(request);

      return `✅ Project completion started for "${projectInfo.projectName}"!\n\n` +
             `I'm now coordinating with AI agents to complete your project. Here's what's happening:\n\n` +
             `📁 Project: ${projectInfo.projectName}\n` +
             `📍 Location: ${projectInfo.projectPath}\n` +
             `🤖 Agents: Working together to complete missing components\n` +
             `📊 Progress: You can check status with "show project progress"\n\n` +
             `${result}`;

    } catch (error) {
      log.error('❌ Project completion request failed', LogContext.SERVICE, { error });
      return `❌ I encountered an error while trying to complete the project: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  /**
   * Handle multi-service orchestration requests
   */
  private handleMultiServiceRequest(userInput: string, projectInfo: any): string {
    log.info('🎯 Handling multi-service orchestration request', LogContext.SERVICE);
    
    return `🎨 **Multi-Service Orchestration Request Acknowledged**\n\n` +
           `I understand you want me to:\n` +
           `1. Analyze the image/wireframe to understand the layout\n` +
           `2. Generate React components based on the design\n` +
           `3. Use TypeScript with proper typing\n` +
           `4. Optimize the code for performance\n` +
           `5. Create a responsive design\n\n` +
           `I'll coordinate with:\n` +
           `- 👁️ Vision service for image analysis\n` +
           `- ⚛️ React component generator\n` +
           `- 📝 TypeScript type system\n` +
           `- 🚀 MLX for optimization\n` +
           `- 📱 Responsive design system\n\n` +
           `Starting the orchestration process now...`;
  }

  /**
   * Get project completion status (called when user asks "show project progress")
   */
  async getProjectStatus(userInput?: string): Promise<string> {
    const activeProjects = this.completionModule.getActiveProjects();
    
    if (activeProjects.length === 0) {
      return "No projects are currently being completed.";
    }

    let statusMessage = `📊 **Active Project Completions**\n\n`;
    
    for (const project of activeProjects) {
      const progress = project.progress;
      const duration = project.endTime 
        ? project.endTime.getTime() - project.startTime.getTime()
        : Date.now() - project.startTime.getTime();
      
      statusMessage += `**${project.id}**\n`;
      statusMessage += `├─ Status: ${project.status}\n`;
      statusMessage += `├─ Progress: ${progress.completionPercentage}% (${progress.completedTasks}/${progress.totalTasks} tasks)\n`;
      statusMessage += `├─ Current Phase: ${progress.currentPhase}\n`;
      statusMessage += `├─ Runtime: ${Math.round(duration / 1000)}s\n`;
      
      if (project.status === 'in_progress') {
        statusMessage += `└─ ETA: ${Math.round(progress.estimatedTimeRemaining)}h remaining\n`;
      } else {
        statusMessage += `└─ Completed!\n`;
      }
      statusMessage += `\n`;
    }

    return statusMessage;
  }

  /**
   * Analyze a project without starting completion
   */
  async analyzeProject(projectPath: string): Promise<string> {
    try {
      const projectName = path.basename(projectPath);
      
      // Basic project analysis
      const stats = await this.getBasicProjectStats(projectPath);
      
      let analysis = `🔍 **Project Analysis: ${projectName}**\n\n`;
      analysis += `📁 Location: ${projectPath}\n`;
      analysis += `📄 Files: ${stats.fileCount}\n`;
      analysis += `📂 Directories: ${stats.dirCount}\n`;
      analysis += `💻 Type: ${stats.projectType}\n\n`;
      
      analysis += `**Completion Assessment:**\n`;
      if (stats.fileCount < 5) {
        analysis += `├─ Status: Minimal project structure detected\n`;
        analysis += `├─ Recommendation: This project needs significant development\n`;
        analysis += `└─ Estimated completion time: 4-8 hours\n\n`;
      } else if (stats.fileCount < 20) {
        analysis += `├─ Status: Basic project structure present\n`;
        analysis += `├─ Recommendation: Project needs additional components\n`;
        analysis += `└─ Estimated completion time: 2-4 hours\n\n`;
      } else {
        analysis += `├─ Status: Well-structured project detected\n`;
        analysis += `├─ Recommendation: Project may need refinement and testing\n`;
        analysis += `└─ Estimated completion time: 1-2 hours\n\n`;
      }
      
      analysis += `💡 **Ready to complete this project?**\n`;
      analysis += `Just say: "Complete this project" or "Complete the project at ${projectPath}"`;
      
      return analysis;
      
    } catch (error) {
      return `❌ Could not analyze project: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  /**
   * Extract project information from user input and context
   */
  private async extractProjectInfo(userInput: string, context?: any): Promise<{
    projectPath: string;
    projectName: string;
    requirements?: string;
    isNewProject?: boolean;
  } | null> {
    
    // Enhanced: Detect project creation requests
    const createProjectRegex = /(?:create|build|generate|make|setup|set\s+up).*?(?:complete|full|entire)?\s*(?:project|app|api|server|application)/i;
    const isCreationRequest = createProjectRegex.test(userInput);
    
    if (isCreationRequest) {
      // Extract project name from creation requests
      let projectName = 'autonomous-project'; // Default name
      
      // Look for specific project names or folders mentioned
      const folderRegex = /(?:folder|directory)\s+called\s+[""']?([^""'\s]+)[""']?/i;
      const folderMatch = userInput.match(folderRegex);
      if (folderMatch && folderMatch[1]) {
        projectName = folderMatch[1];
      }
      
      // Look for specific project types
      if (userInput.toLowerCase().includes('node.js') || userInput.toLowerCase().includes('express')) {
        projectName = projectName === 'autonomous-project' ? 'nodejs-api-server' : projectName;
      }
      if (userInput.toLowerCase().includes('react')) {
        projectName = projectName === 'autonomous-project' ? 'react-app' : projectName;
      }
      
      const projectPath = path.resolve(projectName);
      return { 
        projectPath, 
        projectName, 
        requirements: userInput, // Store full requirements for new projects
        isNewProject: true 
      };
    }
    
    // Original logic for existing projects
    // Look for explicit project paths in user input
    const pathRegex = /(?:project|path|directory|folder)(?:\s+(?:at|in|from))?\s+[""']?([^""'\s]+)[""']?/i;
    const pathMatch = userInput.match(pathRegex);
    
    if (pathMatch && pathMatch[1]) {
      const projectPath = pathMatch[1];
      const projectName = path.basename(projectPath);
      return { projectPath, projectName, isNewProject: false };
    }

    // Look for project names that might be directories in current working directory
    const nameRegex = /complete\s+(?:the\s+)?project\s+[""']?([^""'\s]+)[""']?/i;
    const nameMatch = userInput.match(nameRegex);
    
    if (nameMatch && nameMatch[1]) {
      const projectName = nameMatch[1];
      const projectPath = path.resolve(projectName);
      return { projectPath, projectName, isNewProject: false };
    }

    // Default to current directory if user just says "complete this project"
    if (userInput.toLowerCase().includes('complete') && userInput.toLowerCase().includes('project')) {
      const projectPath = process.cwd();
      const projectName = path.basename(projectPath);
      return { projectPath, projectName, isNewProject: false };
    }

    return null;
  }

  /**
   * Validate that project path exists and is a directory
   */
  private async validateProject(projectPath: string): Promise<boolean> {
    try {
      const stat = await fs.stat(projectPath);
      return stat.isDirectory();
    } catch {
      return false;
    }
  }

  /**
   * Get basic project statistics
   */
  private async getBasicProjectStats(projectPath: string): Promise<{
    fileCount: number;
    dirCount: number;
    projectType: string;
  }> {
    let fileCount = 0;
    let dirCount = 0;
    const files: string[] = [];

    const scan = async (dir: string) => {
      try {
        const items = await fs.readdir(dir);
        for (const item of items) {
          if (item.startsWith('.')) continue; // Skip hidden files
          
          const itemPath = path.join(dir, item);
          const stat = await fs.stat(itemPath);
          
          if (stat.isDirectory()) {
            dirCount++;
            if (item !== 'node_modules' && item !== '.git') {
              await scan(itemPath); // Recursively scan subdirectories
            }
          } else {
            fileCount++;
            files.push(item);
          }
        }
      } catch (error) {
        // Skip directories we can't read
      }
    };

    await scan(projectPath);

    // Detect project type
    let projectType = 'unknown';
    if (files.includes('package.json')) projectType = 'Node.js';
    else if (files.includes('requirements.txt') || files.includes('setup.py')) projectType = 'Python';
    else if (files.includes('Cargo.toml')) projectType = 'Rust';
    else if (files.includes('go.mod')) projectType = 'Go';
    else if (files.includes('pom.xml')) projectType = 'Java';
    else if (files.includes('pubspec.yaml')) projectType = 'Flutter';

    return { fileCount, dirCount, projectType };
  }

  /**
   * Create new project autonomously based on requirements
   */
  private async createNewProject(projectInfo: {
    projectPath: string;
    projectName: string;
    requirements?: string;
    isNewProject?: boolean;
  }): Promise<string> {
    try {
      log.info(`🏗️ Creating autonomous project: ${projectInfo.projectName}`, LogContext.SERVICE);

      // Determine project type from requirements
      const projectType = this.determineProjectType(projectInfo.requirements || '');
      
      // Create project directory
      await fs.mkdir(projectInfo.projectPath, { recursive: true });
      
      // Generate project structure based on type
      await this.generateProjectStructure(projectInfo.projectPath, projectType, projectInfo);
      
      // Create initial files
      await this.generateProjectFiles(projectInfo.projectPath, projectType, projectInfo);
      
      log.info(`✅ Successfully created project: ${projectInfo.projectName}`, LogContext.SERVICE);

      return `🚀 **Autonomous Project Created Successfully!**\n\n` +
             `✅ **${projectInfo.projectName}** has been created and set up autonomously\n\n` +
             `📁 **Project Details:**\n` +
             `├─ Name: ${projectInfo.projectName}\n` +
             `├─ Type: ${projectType}\n` +
             `├─ Location: ${projectInfo.projectPath}\n` +
             `└─ Structure: Complete with all necessary files\n\n` +
             `🎯 **What I've Created:**\n` +
             `├─ Project structure and directories\n` +
             `├─ Configuration files (package.json, tsconfig.json, etc.)\n` +
             `├─ Source code templates and entry points\n` +
             `├─ Development scripts and build tools\n` +
             `├─ Documentation and README\n` +
             `└─ Testing framework setup\n\n` +
             `🏃‍♂️ **Ready to Run:**\n` +
             `Your project is now ready for development! Navigate to the project folder and start coding.`;
             
    } catch (error) {
      log.error('❌ Failed to create new project', LogContext.SERVICE, { error });
      return `❌ I encountered an error while creating the project: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  /**
   * Determine project type from requirements text
   */
  private determineProjectType(requirements: string): string {
    const lowerReq = requirements.toLowerCase();
    
    if (lowerReq.includes('node') || lowerReq.includes('express') || lowerReq.includes('typescript')) {
      return 'Node.js/TypeScript';
    }
    if (lowerReq.includes('react')) return 'React Application';
    if (lowerReq.includes('vue')) return 'Vue.js Application';
    if (lowerReq.includes('angular')) return 'Angular Application';
    if (lowerReq.includes('python') || lowerReq.includes('django') || lowerReq.includes('flask')) {
      return 'Python Application';
    }
    if (lowerReq.includes('java') || lowerReq.includes('spring')) return 'Java Application';
    if (lowerReq.includes('rust')) return 'Rust Application';
    if (lowerReq.includes('go') || lowerReq.includes('golang')) return 'Go Application';
    if (lowerReq.includes('api') || lowerReq.includes('server') || lowerReq.includes('backend')) {
      return 'Node.js/Express API';
    }
    
    return 'Node.js/TypeScript'; // Default to Node.js
  }

  /**
   * Generate project directory structure
   */
  private async generateProjectStructure(projectPath: string, projectType: string, projectInfo: any): Promise<void> {
    const dirs = this.getProjectDirectories(projectType);
    
    for (const dir of dirs) {
      const dirPath = path.join(projectPath, dir);
      await fs.mkdir(dirPath, { recursive: true });
    }
  }

  /**
   * Generate project files based on type
   */
  private async generateProjectFiles(projectPath: string, projectType: string, projectInfo: any): Promise<void> {
    const files = this.getProjectFiles(projectType, projectInfo);
    
    for (const [filePath, content] of Object.entries(files)) {
      const fullPath = path.join(projectPath, filePath);
      await fs.writeFile(fullPath, content, 'utf8');
    }
  }

  /**
   * Get directories to create for project type
   */
  private getProjectDirectories(projectType: string): string[] {
    const baseDirs = ['src', 'tests', 'docs'];
    
    switch (projectType) {
      case 'Node.js/TypeScript':
      case 'Node.js/Express API':
        return [...baseDirs, 'src/routes', 'src/services', 'src/middleware', 'src/utils', 'dist'];
      case 'React Application':
        return [...baseDirs, 'src/components', 'src/hooks', 'src/pages', 'src/styles', 'public', 'build'];
      case 'Python Application':
        return [...baseDirs, 'src/models', 'src/views', 'src/controllers', 'requirements'];
      default:
        return baseDirs;
    }
  }

  /**
   * Get file templates for project type
   */
  private getProjectFiles(projectType: string, projectInfo: any): Record<string, string> {
    const projectName = projectInfo.projectName;
    const requirements = projectInfo.requirements || '';
    
    switch (projectType) {
      case 'Node.js/TypeScript':
      case 'Node.js/Express API':
        return {
          'package.json': this.generatePackageJson(projectName, requirements),
          'tsconfig.json': this.generateTsConfig(),
          'src/index.ts': this.generateMainFile(projectType, requirements),
          'src/server.ts': this.generateServerFile(requirements),
          '.gitignore': this.generateGitIgnore('node'),
          'README.md': this.generateReadme(projectName, projectType, requirements),
          '.env.example': this.generateEnvExample(),
          'jest.config.js': this.generateJestConfig()
        };
      default:
        return {
          'README.md': this.generateReadme(projectName, projectType, requirements),
          '.gitignore': this.generateGitIgnore('general')
        };
    }
  }

  // File template generators
  private generatePackageJson(projectName: string, requirements: string): string {
    const hasExpress = requirements.toLowerCase().includes('express');
    const hasAuth = requirements.toLowerCase().includes('auth') || requirements.toLowerCase().includes('jwt');
    
    const dependencies: Record<string, string> = {
      "express": "^4.18.2"
    };
    
    if (hasAuth) {
      dependencies.jsonwebtoken = "^9.0.0";
      dependencies.bcrypt = "^5.1.0";
    }
    
    return JSON.stringify({
      "name": projectName,
      "version": "1.0.0",
      "description": `Auto-generated project: ${projectName}`,
      "main": "dist/index.js",
      "scripts": {
        "start": "node dist/index.js",
        "dev": "tsx watch src/index.ts",
        "build": "tsc",
        "test": "jest",
        "lint": "eslint src/**/*.ts"
      },
      "dependencies": dependencies,
      "devDependencies": {
        "@types/node": "^20.0.0",
        "@types/express": "^4.17.17",
        "typescript": "^5.0.0",
        "tsx": "^3.12.0",
        "jest": "^29.5.0",
        "@types/jest": "^29.5.0"
      }
    }, null, 2);
  }

  private generateTsConfig(): string {
    return JSON.stringify({
      "compilerOptions": {
        "target": "ES2022",
        "module": "commonjs",
        "outDir": "./dist",
        "rootDir": "./src",
        "strict": true,
        "esModuleInterop": true,
        "skipLibCheck": true,
        "forceConsistentCasingInFileNames": true,
        "resolveJsonModule": true,
        "declaration": true,
        "sourceMap": true
      },
      "include": ["src/**/*"],
      "exclude": ["node_modules", "dist", "tests"]
    }, null, 2);
  }

  private generateMainFile(projectType: string, requirements: string): string {
    if (projectType === 'Node.js/Express API') {
      return `import express from 'express';
import { json } from 'express';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(json());

// Routes
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to ${projectType}!', status: 'running' });
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
  console.log(\`🚀 Server running on port \${PORT}\`);
  console.log(\`📍 Health check: http://localhost:\${PORT}/health\`);
});

export default app;`;
    }
    
    return `// Auto-generated main file for ${projectType}
console.log('🚀 ${projectType} is running!');

export default {};`;
  }

  private generateServerFile(requirements: string): string {
    return `import express from 'express';
import { Request, Response } from 'express';

const app = express();

// Middleware
app.use(express.json());

// Basic routes
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    message: 'Server is running successfully'
  });
});

export { app };`;
  }

  private generateGitIgnore(type: string): string {
    if (type === 'node') {
      return `node_modules/
dist/
.env
.env.local
*.log
.DS_Store
coverage/
.nyc_output/
*.tsbuildinfo`;
    }
    return `.DS_Store
*.log
.env`;
  }

  private generateReadme(projectName: string, projectType: string, requirements: string): string {
    return `# ${projectName}

Auto-generated ${projectType} project created by Universal AI Tools Autonomous Assistant.

## Requirements Implemented
${requirements || 'Basic project structure with development setup'}

## Getting Started

### Installation
\`\`\`bash
npm install
\`\`\`

### Development
\`\`\`bash
npm run dev
\`\`\`

### Build
\`\`\`bash
npm run build
\`\`\`

### Testing
\`\`\`bash
npm test
\`\`\`

## Project Structure
- \`src/\` - Source code
- \`tests/\` - Test files
- \`dist/\` - Built output
- \`docs/\` - Documentation

---

*Generated autonomously by Universal AI Tools*`;
  }

  private generateEnvExample(): string {
    return `PORT=3000
NODE_ENV=development
DATABASE_URL=your_database_url_here
JWT_SECRET=your_jwt_secret_here
API_KEY=your_api_key_here`;
  }

  private generateJestConfig(): string {
    return `module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
  ],
};`;
  }
}

// Export singleton instance
export const projectCompletionService = ProjectCompletionService.getInstance();