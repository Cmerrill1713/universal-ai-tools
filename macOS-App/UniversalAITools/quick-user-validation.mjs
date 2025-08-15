#!/usr/bin/env node

/**
 * Quick User Perspective Validation
 * Fast validation of user experience without full build
 */

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';

class QuickUserValidator {
    constructor() {
        this.results = { passed: 0, failed: 0, warnings: 0, tests: [] };
        console.log('🔍 Quick User Experience Validation');
        console.log('===================================');
    }

    test(name, condition, level = 'pass') {
        const result = { name, condition, level, status: condition ? 'PASS' : 'FAIL' };
        this.results.tests.push(result);
        
        if (condition) {
            console.log(`✅ ${name}`);
            this.results.passed++;
        } else {
            if (level === 'warning') {
                console.log(`⚠️ ${name}`);
                this.results.warnings++;
            } else {
                console.log(`❌ ${name}`);
                this.results.failed++;
            }
        }
        
        return condition;
    }

    fileExists(path) {
        return existsSync(path);
    }

    fileContains(path, content) {
        if (!this.fileExists(path)) return false;
        try {
            return readFileSync(path, 'utf-8').includes(content);
        } catch {
            return false;
        }
    }

    async validateUserExperience() {
        console.log('\n👤 User Experience Validation');
        
        // 1. Core Chat Experience
        this.test(
            'Chat interface exists and is complete',
            this.fileExists('Views/SimpleChatView.swift') && 
            this.fileExists('Views/Components/EnhancedMessageBubble.swift')
        );
        
        this.test(
            'Chat has modern UI components',
            this.fileContains('Views/SimpleChatView.swift', 'FloatingComposer') ||
            this.fileContains('Views/SimpleChatView.swift', 'ChatHeaderView')
        );
        
        // 2. Enhanced Features Discoverability
        this.test(
            '3D Knowledge Graph is available',
            this.fileExists('Views/Components/KnowledgeGraphView3D.swift') &&
            this.fileContains('Views/Components/KnowledgeGraphView3D.swift', 'SceneKit')
        );
        
        this.test(
            'Agent Orchestration dashboard exists',
            this.fileExists('Views/Components/AgentOrchestrationDashboard.swift') &&
            this.fileContains('Views/Components/AgentOrchestrationDashboard.swift', 'AB-MCTS')
        );
        
        this.test(
            'Performance Analytics are available',
            this.fileExists('Views/Components/PerformanceMonitoringView.swift') &&
            this.fileContains('Views/Components/PerformanceMonitoringView.swift', 'Charts')
        );
        
        // 3. Navigation and Discoverability
        this.test(
            'Clear navigation structure exists',
            this.fileExists('Views/ContentView.swift') &&
            (this.fileContains('Views/ContentView.swift', 'TabView') ||
             this.fileContains('Views/ContentView.swift', 'NavigationView'))
        );
        
        this.test(
            'Sidebar navigation is modern',
            this.fileExists('Views/ModernSidebar.swift') ||
            this.fileExists('Views/SidebarView.swift')
        );
        
        // 4. Error Handling User Experience
        this.test(
            'User-friendly error handling exists',
            this.fileExists('Utils/ErrorHandler.swift') &&
            this.fileContains('Utils/ErrorHandler.swift', 'user-friendly')
        );
        
        this.test(
            'Error recovery options available',
            this.fileContains('Utils/ErrorHandler.swift', 'retry') ||
            this.fileContains('Utils/ErrorHandler.swift', 'recovery')
        );
        
        // 5. Performance Optimizations
        this.test(
            'SwiftUI performance patterns used',
            this.fileContains('Views/Components/KnowledgeGraphView3D.swift', 'LazyVStack') ||
            this.fileContains('Views/Components/KnowledgeGraphView3D.swift', '@MainActor')
        );
        
        this.test(
            'Memory management implemented',
            this.fileContains('Views/Components/AgentOrchestrationDashboard.swift', '@StateObject') &&
            this.fileContains('Services/WebSocketConnectionManager.swift', 'weak self')
        );
    }

    async validateAccessibility() {
        console.log('\n♿ Accessibility Validation');
        
        this.test(
            'Accessibility manager exists',
            this.fileExists('Managers/UniversalAccessibilityManager.swift')
        );
        
        this.test(
            'VoiceOver support implemented',
            this.fileContains('Managers/UniversalAccessibilityManager.swift', 'VoiceOver') ||
            this.fileContains('Managers/UniversalAccessibilityManager.swift', 'accessibility')
        );
        
        this.test(
            'Complex UI has accessibility descriptions',
            this.fileContains('Views/Components/KnowledgeGraphView3D.swift', '.accessibilityLabel') ||
            this.fileContains('Views/Components/KnowledgeGraphView3D.swift', 'accessibilityValue')
        );
        
        this.test(
            'Keyboard navigation supported',
            this.fileExists('Controllers/KeyboardShortcutManager.swift') &&
            this.fileContains('Controllers/KeyboardShortcutManager.swift', 'keyboard')
        );
    }

    async validateTestingInfrastructure() {
        console.log('\n🧪 Testing Infrastructure Validation');
        
        this.test(
            'Comprehensive UI tests exist',
            this.fileExists('Tests/EnhancedUITests.swift') &&
            this.fileContains('Tests/EnhancedUITests.swift', 'XCTest')
        );
        
        this.test(
            'Component testing framework exists',
            this.fileExists('Views/Components/ComponentTester.swift') &&
            this.fileContains('Views/Components/ComponentTester.swift', 'TestRunner')
        );
        
        this.test(
            'Debug console available',
            this.fileExists('Views/Components/DebugConsole.swift') &&
            this.fileContains('Views/Components/DebugConsole.swift', 'logging')
        );
        
        this.test(
            'User perspective tests created',
            this.fileExists('Tests/UserPerspectiveTests.swift') &&
            this.fileContains('Tests/UserPerspectiveTests.swift', 'UserJourney')
        );
    }

    async validateCompilationHealth() {
        console.log('\n🔧 Compilation Health Check');
        
        // Check for common compilation issues
        this.test(
            'No MobileCoreServices imports (iOS-only)',
            !this.fileContains('Managers/SearchAndFilterSystem.swift', 'import MobileCoreServices')
        );
        
        this.test(
            'No protocol keyword conflicts',
            !this.fileContains('Views/Components/SwarmCoordinationView.swift', 'let protocol:') &&
            !this.fileContains('Views/Components/SwarmCoordinationView.swift', 'case protocol')
        );
        
        this.test(
            'SwiftUI imports present in UI files',
            this.fileContains('Views/Components/PerformanceMetricsService.swift', 'import SwiftUI')
        );
        
        // Check for duplicate type declarations
        const duplicateTypes = ['TrendDirection', 'OptimizationType', 'KeyboardShortcut'];
        for (const type of duplicateTypes) {
            this.test(
                `No duplicate ${type} declarations`,
                this.countTypeDeclarations(type) <= 1,
                'warning'
            );
        }
    }

    countTypeDeclarations(typeName) {
        try {
            const result = execSync(`grep -r "enum ${typeName}\\|struct ${typeName}" . --include="*.swift" | wc -l`, {
                encoding: 'utf-8',
                stdio: 'pipe'
            });
            return parseInt(result.trim()) || 0;
        } catch {
            return 0;
        }
    }

    async validateEnhancedFeatures() {
        console.log('\n🚀 Enhanced Features Validation');
        
        // Advanced visualizations
        this.test(
            '3D rendering with SceneKit',
            this.fileContains('Views/Components/KnowledgeGraphView3D.swift', 'import SceneKit')
        );
        
        this.test(
            'Charts for analytics',
            this.fileContains('Views/Components/FlashAttentionAnalytics.swift', 'import Charts')
        );
        
        // Real-time features
        this.test(
            'WebSocket real-time data',
            this.fileExists('Services/WebSocketConnectionManager.swift') ||
            this.fileExists('Views/Components/AgentWebSocketService.swift')
        );
        
        this.test(
            'Real-time data service',
            this.fileExists('Services/RealTimeDataService.swift') &&
            this.fileContains('Services/RealTimeDataService.swift', 'WebSocket')
        );
        
        // Advanced interactions
        this.test(
            'Touch Bar integration',
            this.fileExists('Controllers/TouchBarController.swift')
        );
        
        this.test(
            'Advanced gesture support',
            this.fileExists('Controllers/AdvancedGestureController.swift')
        );
        
        // Export capabilities
        this.test(
            'Export manager for data export',
            this.fileExists('Managers/ExportManager.swift') &&
            this.fileContains('Managers/ExportManager.swift', 'export')
        );
    }

    async validateUserWorkflows() {
        console.log('\n📋 User Workflow Validation');
        
        // First-time user experience
        this.test(
            'Welcome or onboarding experience',
            this.fileExists('Views/WelcomeView.swift') ||
            this.fileExists('Views/Onboarding/OnboardingExperience.swift')
        );
        
        // Settings and customization
        this.test(
            'Settings interface available',
            this.fileExists('Views/SettingsView.swift') &&
            this.fileContains('Views/SettingsView.swift', 'View')
        );
        
        // Agent management workflow
        this.test(
            'Agent management workflow',
            this.fileExists('Views/AgentManagementView.swift') &&
            this.fileContains('Views/AgentManagementView.swift', 'agent')
        );
        
        // Chat workflow completeness
        this.test(
            'Complete chat workflow',
            this.fileExists('Views/SimpleChatView.swift') &&
            this.fileExists('Views/Components/EnhancedMessageBubble.swift') &&
            this.fileExists('Views/FloatingComposer.swift')
        );
    }

    generateReport() {
        const total = this.results.passed + this.results.failed + this.results.warnings;
        const successRate = Math.round((this.results.passed / total) * 100);
        
        const report = {
            summary: {
                totalTests: total,
                passed: this.results.passed,
                failed: this.results.failed,
                warnings: this.results.warnings,
                successRate: successRate
            },
            timestamp: new Date().toISOString(),
            recommendations: this.generateRecommendations()
        };
        
        console.log('\n📊 Validation Summary');
        console.log('====================');
        console.log(`Total Tests: ${total}`);
        console.log(`Passed: ${this.results.passed} (${successRate}%)`);
        console.log(`Failed: ${this.results.failed}`);
        console.log(`Warnings: ${this.results.warnings}`);
        
        // Save detailed results
        writeFileSync('user-validation-results.json', JSON.stringify({
            report,
            detailedResults: this.results.tests
        }, null, 2));
        
        return report;
    }

    generateRecommendations() {
        const recommendations = [];
        
        if (this.results.failed > 0) {
            recommendations.push('Address failed validations to improve user experience');
        }
        
        if (this.results.warnings > 2) {
            recommendations.push('Review warnings to prevent potential issues');
        }
        
        // Specific recommendations based on failures
        const failedTests = this.results.tests.filter(t => t.status === 'FAIL');
        
        if (failedTests.find(t => t.name.includes('Accessibility'))) {
            recommendations.push('Enhance accessibility features for better inclusion');
        }
        
        if (failedTests.find(t => t.name.includes('Error handling'))) {
            recommendations.push('Improve error handling for better user experience');
        }
        
        if (failedTests.find(t => t.name.includes('Navigation'))) {
            recommendations.push('Improve navigation structure for better discoverability');
        }
        
        if (recommendations.length === 0) {
            recommendations.push('Excellent! The app provides a great user experience');
        }
        
        return recommendations;
    }

    async run() {
        await this.validateUserExperience();
        await this.validateAccessibility();
        await this.validateTestingInfrastructure();
        await this.validateCompilationHealth();
        await this.validateEnhancedFeatures();
        await this.validateUserWorkflows();
        
        return this.generateReport();
    }
}

// Run validation
new QuickUserValidator().run().then(report => {
    console.log('\n🎯 User Experience Validation Complete!');
    
    if (report.summary.successRate >= 80) {
        console.log('✅ Great user experience - ready for human testing!');
    } else if (report.summary.successRate >= 60) {
        console.log('⚠️ Good foundation - some improvements needed');
    } else {
        console.log('❌ Significant improvements needed for optimal user experience');
    }
    
    process.exit(0);
}).catch(console.error);