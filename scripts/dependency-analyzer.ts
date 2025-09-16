#!/usr/bin/env tsx

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

interface PackageInfo {
  name: string;
  version: string;
  type: 'dependency' | 'devDependency';
  size?: string;
  used: boolean;
  usageCount: number;
  files: string[];
}

class DependencyAnalyzer {
  private packageJson: any;
  private dependencies: Map<string, PackageInfo> = new Map();
  private sourceFiles: string[] = [];

  constructor() {
    this.loadPackageJson();
    this.scanSourceFiles();
  }

  private loadPackageJson() {
    const packagePath = path.join(process.cwd(), 'package.json');
    this.packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    
    // Load dependencies
    const deps = this.packageJson.dependencies || {};
    const devDeps = this.packageJson.devDependencies || {};
    
    Object.entries(deps).forEach(([name, version]) => {
      this.dependencies.set(name, {
        name,
        version: version as string,
        type: 'dependency',
        used: false,
        usageCount: 0,
        files: []
      });
    });

    Object.entries(devDeps).forEach(([name, version]) => {
      this.dependencies.set(name, {
        name,
        version: version as string,
        type: 'devDependency',
        used: false,
        usageCount: 0,
        files: []
      });
    });
  }

  private scanSourceFiles() {
    const patterns = [
      'src/**/*.ts',
      'src/**/*.tsx',
      'src/**/*.js',
      'src/**/*.jsx',
      'scripts/**/*.ts',
      'scripts/**/*.js',
      '*.ts',
      '*.js'
    ];

    try {
      for (const pattern of patterns) {
        try {
          const files = execSync(`find . -path "./node_modules" -prune -o -name "${pattern.replace('**/', '')}" -type f -print`, { encoding: 'utf8' })
            .split('\n')
            .filter(f => f.trim() && !f.includes('node_modules') && !f.includes('dist/') && !f.includes('build/'));
          
          this.sourceFiles.push(...files);
        } catch (e) {
          // Pattern not found, continue
        }
      }
    } catch (error) {
      console.warn('Could not scan source files with find, using manual approach');
      this.scanSourceFilesManual();
    }
    
    // Remove duplicates
    this.sourceFiles = [...new Set(this.sourceFiles)];
    console.log(`📁 Found ${this.sourceFiles.length} source files`);
  }

  private scanSourceFilesManual() {
    const scanDir = (dir: string): string[] => {
      const files: string[] = [];
      
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          
          if (entry.isDirectory()) {
            if (['node_modules', 'dist', 'build', 'coverage', '.git'].includes(entry.name)) {
              continue;
            }
            files.push(...scanDir(fullPath));
          } else if (entry.isFile()) {
            const ext = path.extname(entry.name);
            if (['.ts', '.tsx', '.js', '.jsx'].includes(ext)) {
              files.push(fullPath);
            }
          }
        }
      } catch (error) {
        // Directory might not exist or be accessible
      }
      
      return files;
    };

    this.sourceFiles = [
      ...scanDir('src'),
      ...scanDir('scripts'),
      ...fs.readdirSync('.').filter(f => f.endsWith('.ts') || f.endsWith('.js'))
    ];
  }

  private analyzeUsage() {
    console.log('🔍 Analyzing dependency usage...');
    
    for (const filePath of this.sourceFiles) {
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        
        // Check each dependency
        for (const [depName, depInfo] of this.dependencies) {
          const patterns = [
            `import.*from\\s+['"]${depName}['"]`,
            `import\\s+['"]${depName}['"]`,
            `require\\s*\\(\\s*['"]${depName}['"]\\s*\\)`,
            `import.*from\\s+['"]${depName}/`,
            `require\\s*\\(\\s*['"]${depName}/`
          ];
          
          let foundInFile = false;
          for (const pattern of patterns) {
            if (new RegExp(pattern).test(content)) {
              if (!foundInFile) {
                depInfo.used = true;
                depInfo.usageCount++;
                depInfo.files.push(filePath);
                foundInFile = true;
              }
            }
          }
        }
      } catch (error) {
        console.warn(`Could not read file: ${filePath}`);
      }
    }
  }

  private async getDependencySizes() {
    console.log('📊 Getting dependency sizes...');
    
    for (const [depName, depInfo] of this.dependencies) {
      try {
        const packagePath = path.join('node_modules', depName, 'package.json');
        if (fs.existsSync(packagePath)) {
          const packageInfo = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
          
          // Try to get size from node_modules
          const depDir = path.join('node_modules', depName);
          if (fs.existsSync(depDir)) {
            const sizeOutput = execSync(`du -sh "${depDir}" 2>/dev/null || echo "unknown"`, { encoding: 'utf8' });
            depInfo.size = sizeOutput.split('\t')[0].trim();
          }
        }
      } catch (error) {
        depInfo.size = 'unknown';
      }
    }
  }

  private generateReport() {
    const unused = Array.from(this.dependencies.values()).filter(d => !d.used);
    const used = Array.from(this.dependencies.values()).filter(d => d.used);
    
    console.log('\n📋 Dependency Analysis Report');
    console.log('============================');
    
    console.log(`\n📦 Total Dependencies: ${this.dependencies.size}`);
    console.log(`✅ Used Dependencies: ${used.length}`);
    console.log(`❌ Unused Dependencies: ${unused.length}`);
    console.log(`📈 Usage Rate: ${Math.round((used.length / this.dependencies.size) * 100)}%`);

    if (unused.length > 0) {
      console.log('\n🚫 Unused Dependencies:');
      unused.sort((a, b) => a.name.localeCompare(b.name));
      
      for (const dep of unused) {
        console.log(`   ${dep.name}@${dep.version} (${dep.type}) ${dep.size ? `[${dep.size}]` : ''}`);
      }
      
      console.log('\n💡 Recommendations:');
      console.log('   Run the following to remove unused dependencies:');
      
      const unusedDeps = unused.filter(d => d.type === 'dependency');
      const unusedDevDeps = unused.filter(d => d.type === 'devDependency');
      
      if (unusedDeps.length > 0) {
        console.log(`   npm uninstall ${unusedDeps.map(d => d.name).join(' ')}`);
      }
      
      if (unusedDevDeps.length > 0) {
        console.log(`   npm uninstall --save-dev ${unusedDevDeps.map(d => d.name).join(' ')}`);
      }
    }

    // Heavily used dependencies
    const heavyUsers = used.filter(d => d.usageCount > 5).sort((a, b) => b.usageCount - a.usageCount);
    if (heavyUsers.length > 0) {
      console.log('\n🔥 Most Used Dependencies:');
      for (const dep of heavyUsers.slice(0, 10)) {
        console.log(`   ${dep.name} (${dep.usageCount} files) ${dep.size ? `[${dep.size}]` : ''}`);
      }
    }

    // Save detailed report
    const reportPath = path.join('reports', `dependency-analysis-${Date.now()}.json`);
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        total: this.dependencies.size,
        used: used.length,
        unused: unused.length,
        usageRate: Math.round((used.length / this.dependencies.size) * 100)
      },
      unused: unused.map(d => ({
        name: d.name,
        version: d.version,
        type: d.type,
        size: d.size
      })),
      mostUsed: heavyUsers.slice(0, 20).map(d => ({
        name: d.name,
        version: d.version,
        usageCount: d.usageCount,
        size: d.size,
        files: d.files
      }))
    };
    
    try {
      if (!fs.existsSync('reports')) {
        fs.mkdirSync('reports', { recursive: true });
      }
      fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
      console.log(`\n📄 Detailed report saved: ${reportPath}`);
    } catch (error) {
      console.log('⚠️  Could not save detailed report');
    }

    return { unused, used, report };
  }

  async analyze() {
    console.log('🔍 Starting dependency analysis...');
    
    this.analyzeUsage();
    await this.getDependencySizes();
    
    return this.generateReport();
  }
}

// Run the analyzer
const analyzer = new DependencyAnalyzer();
analyzer.analyze();