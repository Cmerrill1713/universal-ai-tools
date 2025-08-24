#!/usr/bin/env node

const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const util = require('util');

const app = express();
const PORT = 3004;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Security: Define allowed directories and commands
const ALLOWED_DIRECTORIES = [
    '/Users/christianmerrill/Desktop/universal-ai-tools',
    '/tmp'
];

const ALLOWED_COMMANDS = [
    'ls', 'cat', 'grep', 'find', 'pwd', 'echo', 'npm', 'node', 'python3',
    'curl', 'git status', 'git diff', 'npm test', 'npm run'
];

// Utility to check if path is allowed
function isPathAllowed(filePath) {
    const absolutePath = path.resolve(filePath);
    return ALLOWED_DIRECTORIES.some(dir => absolutePath.startsWith(dir));
}

// Utility to check if command is allowed
function isCommandAllowed(command) {
    return ALLOWED_COMMANDS.some(allowed => command.startsWith(allowed));
}

// Tool Registry
const tools = {
    // Execute shell commands
    bash: {
        description: 'Execute shell commands',
        parameters: ['command'],
        execute: async ({ command }) => {
            if (!isCommandAllowed(command)) {
                throw new Error(`Command not allowed: ${command}`);
            }
            
            const execPromise = util.promisify(exec);
            try {
                const { stdout, stderr } = await execPromise(command, {
                    timeout: 30000, // 30 second timeout
                    maxBuffer: 1024 * 1024 * 10 // 10MB buffer
                });
                return {
                    success: true,
                    stdout: stdout.trim(),
                    stderr: stderr.trim()
                };
            } catch (error) {
                return {
                    success: false,
                    error: error.message,
                    stdout: error.stdout?.trim() || '',
                    stderr: error.stderr?.trim() || ''
                };
            }
        }
    },

    // Read files
    readFile: {
        description: 'Read file contents',
        parameters: ['path'],
        execute: async ({ path: filePath }) => {
            if (!isPathAllowed(filePath)) {
                throw new Error(`Access denied: ${filePath}`);
            }
            
            try {
                const content = await fs.readFile(filePath, 'utf-8');
                return {
                    success: true,
                    content,
                    path: filePath
                };
            } catch (error) {
                return {
                    success: false,
                    error: error.message
                };
            }
        }
    },

    // Write files
    writeFile: {
        description: 'Write content to a file',
        parameters: ['path', 'content'],
        execute: async ({ path: filePath, content }) => {
            if (!isPathAllowed(filePath)) {
                throw new Error(`Access denied: ${filePath}`);
            }
            
            try {
                await fs.writeFile(filePath, content, 'utf-8');
                return {
                    success: true,
                    path: filePath,
                    bytesWritten: Buffer.byteLength(content, 'utf-8')
                };
            } catch (error) {
                return {
                    success: false,
                    error: error.message
                };
            }
        }
    },

    // List directory contents
    listDirectory: {
        description: 'List directory contents',
        parameters: ['path'],
        execute: async ({ path: dirPath }) => {
            if (!isPathAllowed(dirPath)) {
                throw new Error(`Access denied: ${dirPath}`);
            }
            
            try {
                const files = await fs.readdir(dirPath);
                const details = await Promise.all(
                    files.map(async (file) => {
                        const fullPath = path.join(dirPath, file);
                        const stats = await fs.stat(fullPath);
                        return {
                            name: file,
                            type: stats.isDirectory() ? 'directory' : 'file',
                            size: stats.size,
                            modified: stats.mtime
                        };
                    })
                );
                return {
                    success: true,
                    path: dirPath,
                    files: details
                };
            } catch (error) {
                return {
                    success: false,
                    error: error.message
                };
            }
        }
    },

    // Search for text in files
    searchInFiles: {
        description: 'Search for text pattern in files',
        parameters: ['directory', 'pattern', 'filePattern'],
        execute: async ({ directory, pattern, filePattern = '*' }) => {
            if (!isPathAllowed(directory)) {
                throw new Error(`Access denied: ${directory}`);
            }
            
            const command = `grep -r "${pattern}" ${directory} --include="${filePattern}" -l 2>/dev/null | head -20`;
            const execPromise = util.promisify(exec);
            
            try {
                const { stdout } = await execPromise(command, {
                    timeout: 10000,
                    maxBuffer: 1024 * 1024
                });
                
                const files = stdout.trim().split('\n').filter(f => f);
                return {
                    success: true,
                    pattern,
                    matchingFiles: files,
                    count: files.length
                };
            } catch (error) {
                return {
                    success: false,
                    error: error.message
                };
            }
        }
    },

    // Fix TypeScript/JavaScript errors
    fixCode: {
        description: 'Attempt to fix code issues',
        parameters: ['filePath', 'errorMessage'],
        execute: async ({ filePath, errorMessage }) => {
            if (!isPathAllowed(filePath)) {
                throw new Error(`Access denied: ${filePath}`);
            }
            
            try {
                // Read the file
                const content = await fs.readFile(filePath, 'utf-8');
                
                // Common fixes based on error patterns
                let fixed = content;
                let changes = [];
                
                // Fix missing semicolons
                if (errorMessage.includes('Missing semicolon')) {
                    fixed = fixed.replace(/^(?!.*[;{}]).*[a-zA-Z0-9\)\]"']$/gm, '$&;');
                    changes.push('Added missing semicolons');
                }
                
                // Fix missing imports
                if (errorMessage.includes('Cannot find name') || errorMessage.includes('is not defined')) {
                    const match = errorMessage.match(/Cannot find name '(\w+)'|'(\w+)' is not defined/);
                    if (match) {
                        const identifier = match[1] || match[2];
                        // Common import fixes
                        const imports = {
                            'useState': "import { useState } from 'react';",
                            'useEffect': "import { useEffect } from 'react';",
                            'express': "const express = require('express');",
                            'fs': "const fs = require('fs');",
                            'path': "const path = require('path');"
                        };
                        
                        if (imports[identifier] && !fixed.includes(imports[identifier])) {
                            fixed = imports[identifier] + '\n' + fixed;
                            changes.push(`Added import for ${identifier}`);
                        }
                    }
                }
                
                // Fix async/await issues
                if (errorMessage.includes('await is only valid in async')) {
                    fixed = fixed.replace(/function\s+(\w+)\s*\([^)]*\)\s*{([^}]*await[^}]*)}/g, 
                                         'async function $1(...args) {$2}');
                    changes.push('Made functions async where await is used');
                }
                
                if (changes.length > 0) {
                    // Write the fixed content
                    await fs.writeFile(filePath, fixed, 'utf-8');
                    return {
                        success: true,
                        filePath,
                        changes,
                        message: `Applied ${changes.length} fixes`
                    };
                } else {
                    return {
                        success: false,
                        message: 'No automatic fixes available for this error'
                    };
                }
            } catch (error) {
                return {
                    success: false,
                    error: error.message
                };
            }
        }
    },

    // Run tests
    runTests: {
        description: 'Run project tests',
        parameters: ['directory', 'testCommand'],
        execute: async ({ directory, testCommand = 'npm test' }) => {
            if (!isPathAllowed(directory)) {
                throw new Error(`Access denied: ${directory}`);
            }
            
            const execPromise = util.promisify(exec);
            try {
                const { stdout, stderr } = await execPromise(testCommand, {
                    cwd: directory,
                    timeout: 60000, // 1 minute timeout
                    maxBuffer: 1024 * 1024 * 10
                });
                
                const passed = !stderr.includes('FAIL') && !stdout.includes('FAIL');
                return {
                    success: true,
                    passed,
                    output: stdout + stderr,
                    summary: passed ? 'All tests passed' : 'Some tests failed'
                };
            } catch (error) {
                return {
                    success: false,
                    error: error.message,
                    output: error.stdout + error.stderr
                };
            }
        }
    },

    // Install dependencies
    installDependencies: {
        description: 'Install project dependencies',
        parameters: ['directory', 'packageManager'],
        execute: async ({ directory, packageManager = 'npm' }) => {
            if (!isPathAllowed(directory)) {
                throw new Error(`Access denied: ${directory}`);
            }
            
            const command = packageManager === 'npm' ? 'npm install' : 'yarn install';
            const execPromise = util.promisify(exec);
            
            try {
                const { stdout, stderr } = await execPromise(command, {
                    cwd: directory,
                    timeout: 120000, // 2 minute timeout
                    maxBuffer: 1024 * 1024 * 10
                });
                
                return {
                    success: true,
                    output: stdout,
                    message: 'Dependencies installed successfully'
                };
            } catch (error) {
                return {
                    success: false,
                    error: error.message
                };
            }
        }
    },

    // Restart service
    restartService: {
        description: 'Restart a service',
        parameters: ['serviceName', 'command'],
        execute: async ({ serviceName, command }) => {
            if (!isCommandAllowed(command)) {
                throw new Error(`Command not allowed: ${command}`);
            }
            
            const execPromise = util.promisify(exec);
            
            try {
                // First, try to stop the service
                await execPromise(`pkill -f "${serviceName}"`, { timeout: 5000 }).catch(() => {});
                
                // Wait a bit
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                // Start the service
                exec(command, {
                    detached: true,
                    stdio: 'ignore'
                }).unref();
                
                return {
                    success: true,
                    message: `Service ${serviceName} restarted`,
                    command
                };
            } catch (error) {
                return {
                    success: false,
                    error: error.message
                };
            }
        }
    }
};

// API Endpoints

// List available tools
app.get('/api/tools', (req, res) => {
    const toolList = Object.entries(tools).map(([name, tool]) => ({
        name,
        description: tool.description,
        parameters: tool.parameters
    }));
    res.json({ tools: toolList });
});

// Execute a tool
app.post('/api/execute', async (req, res) => {
    const { tool, parameters } = req.body;
    
    if (!tools[tool]) {
        return res.status(400).json({
            success: false,
            error: `Unknown tool: ${tool}`
        });
    }
    
    try {
        console.log(`Executing tool: ${tool}`, parameters);
        const result = await tools[tool].execute(parameters);
        res.json(result);
    } catch (error) {
        console.error(`Error executing ${tool}:`, error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Analyze and suggest fixes
app.post('/api/analyze', async (req, res) => {
    const { error, context } = req.body;
    
    const suggestions = [];
    
    // Analyze error and suggest tools
    if (error.includes('Cannot find module') || error.includes('Module not found')) {
        suggestions.push({
            tool: 'installDependencies',
            parameters: { directory: context.directory || process.cwd() },
            description: 'Install missing dependencies'
        });
    }
    
    if (error.includes('ENOENT') || error.includes('no such file')) {
        suggestions.push({
            tool: 'listDirectory',
            parameters: { path: context.directory || process.cwd() },
            description: 'Check if file exists'
        });
    }
    
    if (error.includes('Missing semicolon') || error.includes('Unexpected token')) {
        suggestions.push({
            tool: 'fixCode',
            parameters: { filePath: context.file, errorMessage: error },
            description: 'Attempt automatic code fixes'
        });
    }
    
    if (error.includes('test fail') || error.includes('FAIL')) {
        suggestions.push({
            tool: 'runTests',
            parameters: { directory: context.directory || process.cwd() },
            description: 'Run tests to identify failures'
        });
    }
    
    res.json({ suggestions });
});

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        service: 'action-assistant',
        tools: Object.keys(tools).length,
        timestamp: new Date().toISOString()
    });
});

// Start server
app.listen(PORT, () => {
    console.log('🔧 Action Assistant Server');
    console.log('===========================');
    console.log(`📍 Running on: http://localhost:${PORT}`);
    console.log('');
    console.log('🛠️ Available Tools:');
    Object.entries(tools).forEach(([name, tool]) => {
        console.log(`  • ${name}: ${tool.description}`);
    });
    console.log('');
    console.log('🔒 Security:');
    console.log('  • Sandboxed to project directory');
    console.log('  • Limited command execution');
    console.log('  • File access restrictions');
    console.log('');
    console.log('📡 API Endpoints:');
    console.log('  GET  /api/tools    - List available tools');
    console.log('  POST /api/execute  - Execute a tool');
    console.log('  POST /api/analyze  - Get fix suggestions');
    console.log('  GET  /health       - Health check');
});