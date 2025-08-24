/**
 * DSPy Widget Creation Example
 * 
 * This example demonstrates how to use the DSPy widget orchestration system
 * to create complex widgets through intelligent multi-agent coordination.
 */

import { dspyWidgetOrchestrator } from '../src/services/dspy-widget-orchestrator';
import { logger } from '../src/utils/logger';

async function demonstrateWidgetCreation() {
  console.log('🎨 DSPy Widget Creation Demo\n');

  // Example 1: Create a data visualization widget
  console.log('1. Creating a data visualization widget...');
  try {
    const dashboardWidget = await dspyWidgetOrchestrator.generateWidget(
      'Create a real-time dashboard widget that displays sales metrics with charts, filters for date ranges, and export functionality',
      {
        styling: 'mui',
        targetFramework: 'React',
        includeTests: true,
        accessibility: 'WCAG21'
      }
    );

    console.log(`✅ Generated: ${dashboardWidget.name}`);
    console.log(`   Complexity: ${dashboardWidget.metadata.complexity}/10`);
    console.log(`   Confidence: ${(dashboardWidget.metadata.confidence * 100).toFixed(0)}%`);
    console.log(`   Participating Agents: ${dashboardWidget.metadata.participatingAgents.join(', ')}`);
    console.log(`   Lines of Code: ${dashboardWidget.code.split('\n').length}`);
    console.log('');
  } catch (error) {
    console.error('❌ Failed to create dashboard widget:', error);
  }

  // Example 2: Create a form widget with validation
  console.log('2. Creating a form widget with validation...');
  try {
    const formWidget = await dspyWidgetOrchestrator.generateWidget(
      'Build a user registration form with email validation, password strength indicator, terms acceptance, and real-time field validation',
      {
        styling: 'mui',
        functionality: [
          'Email format validation',
          'Password strength meter',
          'Terms and conditions checkbox',
          'Submit button with loading state',
          'Error message display'
        ],
        constraints: [
          'Must be accessible',
          'Mobile responsive',
          'TypeScript with proper types'
        ]
      }
    );

    console.log(`✅ Generated: ${formWidget.name}`);
    console.log(`   Description: ${formWidget.description}`);
    console.log(`   Required Functionality: ${formWidget.requirements.functionality.join(', ')}`);
    console.log('');
  } catch (error) {
    console.error('❌ Failed to create form widget:', error);
  }

  // Example 3: Improve an existing widget
  console.log('3. Improving an existing widget...');
  try {
    const existingCode = `
import React from 'react';

const SimpleButton = ({ label, onClick }) => {
  return <button onClick={onClick}>{label}</button>;
};

export default SimpleButton;
    `;

    const improvedWidget = await dspyWidgetOrchestrator.improveWidget(
      existingCode,
      'Add loading state, disabled state, multiple variants (primary, secondary, danger), proper TypeScript types, and accessibility attributes',
      {
        preserveInterface: false,
        addTests: true
      }
    );

    console.log(`✅ Improved: ${improvedWidget.name}`);
    console.log(`   Improvements Applied: Added loading states, variants, TypeScript, accessibility`);
    console.log(`   New Complexity: ${improvedWidget.metadata.complexity}/10`);
    console.log('');
  } catch (error) {
    console.error('❌ Failed to improve widget:', error);
  }

  // Example 4: Track generation progress
  console.log('4. Creating widget with progress tracking...');
  try {
    // Start generation (non-blocking)
    const progressPromise = dspyWidgetOrchestrator.generateWidget(
      'Create an advanced data table with sorting, filtering, pagination, row selection, and CSV export',
      {
        complexity: 'high',
        performance: 'optimized'
      }
    );

    // Simulate checking progress
    const widgetId = 'demo-widget-id'; // In real usage, this would come from the API response
    let lastStage = '';
    
    const checkProgress = setInterval(() => {
      const progress = dspyWidgetOrchestrator.getProgress(widgetId);
      if (progress && progress.stage !== lastStage) {
        console.log(`   Progress: ${progress.stage} (${progress.progress}%) - ${progress.currentTask}`);
        lastStage = progress.stage;
        
        if (progress.stage === 'completed' || progress.stage === 'failed') {
          clearInterval(checkProgress);
        }
      }
    }, 1000);

    // Wait for completion
    const tableWidget = await progressPromise;
    console.log(`✅ Generated: ${tableWidget.name}`);
    console.log('');
  } catch (error) {
    console.error('❌ Failed to create table widget:', error);
  }

  // Example 5: Complex multi-component widget
  console.log('5. Creating a complex multi-component widget system...');
  try {
    const complexWidget = await dspyWidgetOrchestrator.generateWidget(
      'Design a complete e-commerce product page component with image gallery, product details, size/color selectors, add to cart functionality, reviews section, and related products carousel',
      {
        componentArchitecture: 'compound',
        subComponents: [
          'ImageGallery',
          'ProductDetails', 
          'VariantSelector',
          'AddToCart',
          'ReviewsList',
          'RelatedProducts'
        ],
        stateManagement: 'context',
        apiIntegration: true
      }
    );

    console.log(`✅ Generated: ${complexWidget.name}`);
    console.log(`   Architecture: ${complexWidget.design.componentName} with ${complexWidget.design.children?.length || 0} sub-components`);
    console.log(`   State Management: ${Object.keys(complexWidget.design.state || {}).length} state properties`);
    console.log(`   Methods: ${complexWidget.design.methods?.join(', ') || 'None'}`);
    console.log(`   Total Generation Time: ${complexWidget.metadata.generatedAt}`);
  } catch (error) {
    console.error('❌ Failed to create complex widget:', error);
  }

  console.log('\n✨ DSPy Widget Creation Demo Complete!');
}

// Run the demo
if (import.meta.url === `file://${process.argv[1]}`) {
  demonstrateWidgetCreation().catch(console.error);
}

export { demonstrateWidgetCreation };