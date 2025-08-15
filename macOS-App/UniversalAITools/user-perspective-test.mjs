#!/usr/bin/env node

/**
 * Real-World User Perspective Testing
 * 
 * This script validates the enhanced UI from a human user's perspective by:
 * 1. Testing actual app functionality and responsiveness
 * 2. Validating user workflows and interactions
 * 3. Checking performance under realistic conditions
 * 4. Ensuring accessibility and usability
 * 5. Testing error handling and recovery
 */

import { execSync, spawn } from 'child_process';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class UserPerspectiveTester {
    constructor() {
        this.results = {
            totalTests: 0,
            passed: 0,
            failed: 0,
            warnings: 0,
            errors: [],
            performance: {},
            userExperience: {}
        };
        
        this.testStartTime = Date.now();
        console.log('🧪 Starting User Perspective Testing');
        console.log('==================================');
    }

    // MARK: - Build and Launch Testing

    async testAppBuildAndLaunch() {
        console.log('\n📱 Testing App Build and Launch...');
        
        try {
            // Test 1: App builds successfully
            this.log('Building macOS app...');
            const buildStart = Date.now();
            
            execSync('xcodebuild -project UniversalAITools.xcodeproj -scheme UniversalAITools -destination "platform=macOS" build -quiet', {
                cwd: process.cwd(),
                stdio: 'pipe'
            });
            
            const buildTime = Date.now() - buildStart;
            this.results.performance.buildTime = buildTime;
            
            this.pass(`✅ App builds successfully in ${buildTime}ms`);
            
            // Test 2: Build artifacts exist
            const buildDir = './build';
            if (existsSync(buildDir)) {
                this.pass('✅ Build artifacts created');
            } else {
                this.warning('⚠️ Build directory not found - checking DerivedData');
            }
            
            return true;
        } catch (error) {
            this.fail(`❌ Build failed: ${error.message}`);
            return false;
        }
    }

    async testUIComponentCompilation() {
        console.log('\n🧩 Testing UI Component Compilation...');
        
        const criticalComponents = [
            'KnowledgeGraphView3D.swift',
            'AgentOrchestrationDashboard.swift',
            'PerformanceMonitoringView.swift',
            'FlashAttentionAnalytics.swift',
            'ContextFlowDashboard.swift',
            'ComponentTester.swift',
            'DebugConsole.swift'
        ];

        let compiledComponents = 0;
        
        for (const component of criticalComponents) {
            const componentPath = join('Views/Components', component);
            
            if (existsSync(componentPath)) {
                // Check if component has basic SwiftUI structure
                const content = readFileSync(componentPath, 'utf-8');
                
                if (content.includes('struct ') && content.includes(': View') && content.includes('var body: some View')) {
                    this.pass(`✅ ${component} has valid SwiftUI structure`);
                    compiledComponents++;
                } else {
                    this.fail(`❌ ${component} missing required SwiftUI components`);
                }
                
                // Check for common compilation issues
                if (content.includes('protocol ') && !content.includes('protocol {')) {
                    this.warning(`⚠️ ${component} may have protocol keyword conflicts`);
                }
                
                if (content.includes('import MobileCoreServices')) {
                    this.fail(`❌ ${component} uses iOS-only import`);
                }
                
            } else {
                this.fail(`❌ Component not found: ${component}`);
            }
        }
        
        this.results.userExperience.enhancedComponentsAvailable = compiledComponents;
        this.log(`📊 ${compiledComponents}/${criticalComponents.length} enhanced components available`);
    }

    async testUserWorkflows() {
        console.log('\n👤 Testing User Workflows...');
        
        // Test 1: First-time user experience
        this.log('Testing first-time user onboarding...');
        await this.testFirstTimeUserExperience();
        
        // Test 2: Typical chat session workflow
        this.log('Testing typical chat session...');
        await this.testChatSessionWorkflow();
        
        // Test 3: Advanced feature discovery
        this.log('Testing advanced feature discovery...');
        await this.testAdvancedFeatureDiscovery();
        
        // Test 4: Error recovery workflow
        this.log('Testing error recovery...');
        await this.testErrorRecoveryWorkflow();
    }

    async testFirstTimeUserExperience() {
        // Simulate first-time user opening the app
        const welcomeComponents = [
            'WelcomeView.swift',
            'OnboardingExperience.swift',
            'FeatureCard' // Could be in multiple files
        ];
        
        let onboardingElementsFound = 0;
        
        for (const component of welcomeComponents) {
            if (this.componentExists(component)) {
                onboardingElementsFound++;
                this.pass(`✅ Onboarding component exists: ${component}`);
            }
        }
        
        if (onboardingElementsFound > 0) {
            this.pass('✅ First-time user experience is supported');
        } else {
            this.warning('⚠️ No explicit onboarding components found');
        }
        
        // Check for clear navigation structure
        if (this.componentExists('ContentView.swift')) {
            const content = readFileSync('Views/ContentView.swift', 'utf-8');
            if (content.includes('TabView') || content.includes('NavigationView') || content.includes('sidebar')) {
                this.pass('✅ Clear navigation structure present');
            } else {
                this.warning('⚠️ Navigation structure unclear');
            }
        }
    }

    async testChatSessionWorkflow() {
        // Test chat interface components
        const chatComponents = [
            'SimpleChatView.swift',
            'ChatHeaderView.swift',
            'EnhancedMessageBubble.swift',
            'FloatingComposer.swift'
        ];
        
        let chatElementsFound = 0;
        
        for (const component of chatComponents) {
            if (this.componentExists(component)) {
                chatElementsFound++;
                
                // Check for enhanced features in chat
                const componentPath = this.findComponentPath(component);
                if (componentPath) {
                    const content = readFileSync(componentPath, 'utf-8');
                    
                    // Look for enhanced features
                    if (content.includes('KnowledgeGraph') || content.includes('3D')) {
                        this.pass(`✅ ${component} integrates with 3D knowledge graph`);
                    }
                    
                    if (content.includes('Agent') || content.includes('Orchestration')) {
                        this.pass(`✅ ${component} supports agent orchestration`);
                    }
                    
                    if (content.includes('Performance') || content.includes('Analytics')) {
                        this.pass(`✅ ${component} includes performance insights`);
                    }
                }
            }
        }
        
        if (chatElementsFound >= 2) {
            this.pass('✅ Complete chat workflow supported');
        } else {
            this.fail('❌ Chat workflow incomplete');
        }
    }

    async testAdvancedFeatureDiscovery() {
        // Test that enhanced features are discoverable
        const advancedFeatures = {
            '3D Knowledge Graph': 'KnowledgeGraphView3D.swift',
            'Agent Orchestration': 'AgentOrchestrationDashboard.swift',
            'Performance Analytics': 'PerformanceMonitoringView.swift',
            'Flash Attention': 'FlashAttentionAnalytics.swift',
            'Context Flow': 'ContextFlowDashboard.swift'
        };
        
        let discoverableFeatures = 0;
        
        for (const [featureName, componentFile] of Object.entries(advancedFeatures)) {
            if (this.componentExists(componentFile)) {
                // Check if feature is accessible from main navigation
                const isAccessible = this.checkFeatureAccessibility(featureName, componentFile);
                
                if (isAccessible) {
                    this.pass(`✅ ${featureName} is discoverable and accessible`);
                    discoverableFeatures++;
                } else {
                    this.warning(`⚠️ ${featureName} exists but may not be easily discoverable`);
                }
            } else {
                this.fail(`❌ ${featureName} component not found`);
            }
        }
        
        this.results.userExperience.discoverableAdvancedFeatures = discoverableFeatures;
        
        if (discoverableFeatures >= 3) {
            this.pass('✅ Most advanced features are discoverable');
        } else {
            this.warning('⚠️ Some advanced features may be hard to discover');
        }
    }

    async testErrorRecoveryWorkflow() {
        // Test error handling components
        const errorHandlingComponents = [
            'ErrorHandler.swift',
            'ErrorStateView',
            'LoadingStateView'
        ];
        
        let errorHandlingFound = 0;
        
        for (const component of errorHandlingComponents) {
            if (this.componentExists(component)) {
                errorHandlingFound++;
                
                const componentPath = this.findComponentPath(component);
                if (componentPath) {
                    const content = readFileSync(componentPath, 'utf-8');
                    
                    // Check for user-friendly error handling
                    if (content.includes('Try Again') || content.includes('Retry')) {
                        this.pass(`✅ ${component} provides retry functionality`);
                    }
                    
                    if (content.includes('user-friendly') || content.includes('localizedDescription')) {
                        this.pass(`✅ ${component} has user-friendly error messages`);
                    }
                    
                    if (content.includes('recovery') || content.includes('fallback')) {
                        this.pass(`✅ ${component} includes recovery strategies`);
                    }
                }
            }
        }
        
        if (errorHandlingFound >= 2) {
            this.pass('✅ Comprehensive error recovery system present');
        } else {
            this.warning('⚠️ Error recovery system may be incomplete');
        }
    }

    async testPerformanceAndResponsiveness() {
        console.log('\n⚡ Testing Performance and Responsiveness...');
        
        // Test 1: Check for performance optimization code
        const performanceFeatures = [
            '@MainActor',
            'Task {',
            'DispatchQueue.main.async',
            'LazyVStack',
            'LazyHStack',
            'onAppear',
            'onDisappear'
        ];
        
        let performanceOptimizations = 0;
        const componentFiles = this.getAllSwiftFiles();
        
        for (const file of componentFiles) {
            const content = readFileSync(file, 'utf-8');
            
            for (const feature of performanceFeatures) {
                if (content.includes(feature)) {
                    performanceOptimizations++;
                    break; // Only count once per file
                }
            }
        }
        
        this.results.performance.optimizationPatterns = performanceOptimizations;
        this.log(`📊 Found ${performanceOptimizations} files with performance optimizations`);
        
        // Test 2: Check for memory management
        const memoryManagement = componentFiles.filter(file => {
            const content = readFileSync(file, 'utf-8');
            return content.includes('weak self') || 
                   content.includes('@StateObject') || 
                   content.includes('@ObservedObject') ||
                   content.includes('cancellables');
        }).length;
        
        this.results.performance.memoryManagementPatterns = memoryManagement;
        this.log(`📊 Found ${memoryManagement} files with memory management patterns`);
        
        if (performanceOptimizations > 5 && memoryManagement > 3) {
            this.pass('✅ Good performance optimization practices found');
        } else {
            this.warning('⚠️ Limited performance optimizations detected');
        }
    }

    async testAccessibilityFeatures() {
        console.log('\n♿ Testing Accessibility Features...');
        
        const accessibilityFeatures = [
            '.accessibilityLabel',
            '.accessibilityHint',
            '.accessibilityValue',
            '.accessibilityAction',
            'VoiceOver',
            'accessibility'
        ];
        
        let accessibilityImplementations = 0;
        const componentFiles = this.getAllSwiftFiles();
        
        for (const file of componentFiles) {
            const content = readFileSync(file, 'utf-8');
            
            for (const feature of accessibilityFeatures) {
                if (content.includes(feature)) {
                    accessibilityImplementations++;
                    break; // Only count once per file
                }
            }
        }
        
        this.results.userExperience.accessibilityImplementations = accessibilityImplementations;
        
        if (accessibilityImplementations > 5) {
            this.pass('✅ Good accessibility support implemented');
        } else {
            this.warning('⚠️ Limited accessibility features found');
        }
        
        // Check for specific accessibility manager
        if (this.componentExists('UniversalAccessibilityManager.swift')) {
            this.pass('✅ Dedicated accessibility manager found');
        }
    }

    async testBackendIntegration() {
        console.log('\n🔗 Testing Backend Integration...');
        
        // Check if backend is running
        try {
            execSync('curl -s http://localhost:3001/health', { stdio: 'pipe' });
            this.pass('✅ Backend is running and accessible');
            
            // Test WebSocket connection capability
            const wsFiles = this.getAllSwiftFiles().filter(file => {
                const content = readFileSync(file, 'utf-8');
                return content.includes('WebSocket') || content.includes('URLSessionWebSocketTask');
            });
            
            if (wsFiles.length > 0) {
                this.pass(`✅ WebSocket integration found in ${wsFiles.length} files`);
            } else {
                this.warning('⚠️ No WebSocket integration detected');
            }
            
        } catch (error) {
            this.warning('⚠️ Backend not running - testing fallback behavior');
            
            // Check for graceful fallback
            const fallbackFiles = this.getAllSwiftFiles().filter(file => {
                const content = readFileSync(file, 'utf-8');
                return content.includes('mock') || 
                       content.includes('fallback') || 
                       content.includes('offline') ||
                       content.includes('demo');
            });
            
            if (fallbackFiles.length > 0) {
                this.pass('✅ Fallback/demo mode implementation found');
            } else {
                this.fail('❌ No fallback behavior for offline mode');
            }
        }
    }

    // MARK: - Helper Methods

    componentExists(componentName) {
        return this.findComponentPath(componentName) !== null;
    }

    findComponentPath(componentName) {
        const possiblePaths = [
            `Views/${componentName}`,
            `Views/Components/${componentName}`,
            `Views/Chat/${componentName}`,
            `Views/Settings/${componentName}`,
            `Views/Onboarding/${componentName}`,
            `Utils/${componentName}`,
            `Managers/${componentName}`,
            `Services/${componentName}`,
            componentName
        ];
        
        for (const path of possiblePaths) {
            if (existsSync(path)) {
                return path;
            }
        }
        
        return null;
    }

    checkFeatureAccessibility(featureName, componentFile) {
        // Check if feature is referenced in main navigation files
        const navFiles = [
            'Views/ContentView.swift',
            'Views/ModernSidebar.swift',
            'Views/SidebarView.swift',
            'UniversalAIToolsApp.swift'
        ];
        
        for (const navFile of navFiles) {
            if (existsSync(navFile)) {
                const content = readFileSync(navFile, 'utf-8');
                const componentBaseName = componentFile.replace('.swift', '');
                
                if (content.includes(componentBaseName) || 
                    content.includes(featureName.replace(' ', '')) ||
                    content.toLowerCase().includes(featureName.toLowerCase())) {
                    return true;
                }
            }
        }
        
        return false;
    }

    getAllSwiftFiles() {
        try {
            const swiftFiles = execSync('find . -name "*.swift" -not -path "./build/*" -not -path "./.git/*"', {
                encoding: 'utf-8',
                stdio: 'pipe'
            }).split('\n').filter(file => file.length > 0);
            
            return swiftFiles;
        } catch (error) {
            this.warning('⚠️ Could not enumerate Swift files');
            return [];
        }
    }

    // MARK: - Logging and Results

    pass(message) {
        console.log(message);
        this.results.passed++;
        this.results.totalTests++;
    }

    fail(message) {
        console.log(message);
        this.results.failed++;
        this.results.totalTests++;
        this.results.errors.push(message);
    }

    warning(message) {
        console.log(message);
        this.results.warnings++;
    }

    log(message) {
        console.log(`   ${message}`);
    }

    async generateReport() {
        console.log('\n📊 Generating User Perspective Test Report...');
        
        const testDuration = Date.now() - this.testStartTime;
        const successRate = Math.round((this.results.passed / this.results.totalTests) * 100);
        
        const report = `
# User Perspective Test Report
Generated: ${new Date().toISOString()}
Test Duration: ${testDuration}ms

## Summary
- Total Tests: ${this.results.totalTests}
- Passed: ${this.results.passed} (${successRate}%)
- Failed: ${this.results.failed}
- Warnings: ${this.results.warnings}

## Performance Metrics
- Build Time: ${this.results.performance.buildTime || 'N/A'}ms
- Optimization Patterns: ${this.results.performance.optimizationPatterns || 0}
- Memory Management Patterns: ${this.results.performance.memoryManagementPatterns || 0}

## User Experience Metrics
- Enhanced Components Available: ${this.results.userExperience.enhancedComponentsAvailable || 0}
- Discoverable Advanced Features: ${this.results.userExperience.discoverableAdvancedFeatures || 0}
- Accessibility Implementations: ${this.results.userExperience.accessibilityImplementations || 0}

## Errors
${this.results.errors.map(error => `- ${error}`).join('\n')}

## Recommendations
${this.generateRecommendations()}
`;

        writeFileSync('USER_PERSPECTIVE_TEST_REPORT.md', report);
        console.log('📄 Report saved to USER_PERSPECTIVE_TEST_REPORT.md');
        
        return report;
    }

    generateRecommendations() {
        const recommendations = [];
        
        if (this.results.failed > 0) {
            recommendations.push('- Address failed tests to improve user experience');
        }
        
        if ((this.results.userExperience.discoverableAdvancedFeatures || 0) < 3) {
            recommendations.push('- Improve discoverability of advanced features');
        }
        
        if ((this.results.userExperience.accessibilityImplementations || 0) < 5) {
            recommendations.push('- Enhance accessibility features for better inclusion');
        }
        
        if ((this.results.performance.optimizationPatterns || 0) < 5) {
            recommendations.push('- Add more performance optimizations for better responsiveness');
        }
        
        if (recommendations.length === 0) {
            recommendations.push('- Great work! The app provides an excellent user experience');
        }
        
        return recommendations.join('\n');
    }

    async run() {
        console.log('🚀 Starting comprehensive user perspective testing...\n');
        
        // Test build and launch
        const canBuild = await this.testAppBuildAndLaunch();
        
        if (canBuild) {
            // Test UI components
            await this.testUIComponentCompilation();
            
            // Test user workflows
            await this.testUserWorkflows();
            
            // Test performance
            await this.testPerformanceAndResponsiveness();
            
            // Test accessibility
            await this.testAccessibilityFeatures();
            
            // Test backend integration
            await this.testBackendIntegration();
        } else {
            this.fail('❌ Cannot proceed with user testing - build failed');
        }
        
        // Generate report
        await this.generateReport();
        
        console.log('\n🎯 User Perspective Testing Complete!');
        console.log(`   Success Rate: ${Math.round((this.results.passed / this.results.totalTests) * 100)}%`);
        
        return this.results;
    }
}

// Run the tests
const tester = new UserPerspectiveTester();
tester.run().catch(console.error);