#!/usr/bin/env tsx

/**
 * Test script for the Sweet Athena Widget Creation Pipeline
 *
 * This script demonstrates creating widgets through natural language
 */

import axios from 'axios';
import { config } from 'dotenv';
import chalk from 'chalk';

config();

const API_URL = process.env.API_URL || 'http://localhost:3000';
const API_KEY = process.env.API_KEY || 'dev-test-key';

async function testWidgetCreation() {
  console.log(chalk.blue('\n🎯 Testing Sweet Athena Widget Creation Pipeline\n'));

  const widgetRequests = [
    {
      description:
        'Create a user profile card widget that displays avatar, name, email, and bio with a follow button',
      requirements: {
        style: 'material-ui',
        features: ['avatar', 'follow-button', 'social-links'],
        responsive: true,
        theme: 'auto',
      },
    },
    {
      description:
        'Build a data table widget with sorting, filtering, and pagination for displaying products',
      requirements: {
        style: 'styled-components',
        features: ['sorting', 'filtering', 'pagination', 'row-selection'],
        dataSource: 'props',
        responsive: true,
      },
    },
    {
      description:
        'Create a weather forecast widget showing current conditions and 5-day forecast with icons',
      requirements: {
        style: 'tailwind',
        features: ['current-weather', 'forecast', 'weather-icons', 'location-search'],
        dataSource: 'api',
        theme: 'light',
      },
    },
  ];

  for (const request of widgetRequests) {
    console.log(chalk.yellow(`\n📝 Creating widget: "${request.description}"`));

    try {
      // Create the widget
      const createResponse = await axios.post(`${API_URL}/api/widgets/create`, request, {
        headers: {
          'X-API-Key': API_KEY,
          'X-AI-Service': 'widget-creator',
          'Content-Type': 'application/json',
        },
      });

      if (createResponse.data.success) {
        const widget = createResponse.data.widget;
        console.log(chalk.green(`✅ Widget created successfully!`));
        console.log(chalk.cyan(`   ID: ${widget.id}`));
        console.log(chalk.cyan(`   Name: ${widget.name}`));
        console.log(chalk.cyan(`   Dependencies: ${widget.dependencies.join(', ')}`));
        console.log(chalk.cyan(`   Preview URL: ${API_URL}${widget.previewUrl}`));
        console.log(chalk.cyan(`   Export URL: ${API_URL}${widget.exportUrl}`));

        // Generate preview
        console.log(chalk.yellow('\n🔍 Generating preview...'));
        const previewResponse = await axios.get(`${API_URL}/api/widgets/preview/${widget.id}`, {
          headers: {
            'X-API-Key': API_KEY,
            'X-AI-Service': 'widget-creator',
          },
        });

        if (previewResponse.status === 200) {
          console.log(chalk.green('✅ Preview generated successfully!'));
          console.log(
            chalk.dim(`   Preview available at: ${API_URL}/api/widgets/preview/${widget.id}`)
          );
        }
      } else {
        console.log(chalk.red(`❌ Widget creation failed: ${createResponse.data.error}`));
        if (createResponse.data.suggestions) {
          console.log(chalk.yellow('💡 Suggestions:'));
          createResponse.data.suggestions.forEach((s: string) => console.log(`   - ${s}`));
        }
      }
    } catch (error: any) {
      console.log(chalk.red(`❌ Error: ${error.response?.data?.error || error.message}`));
      if (error.response?.data?.details) {
        console.log(chalk.dim(`   Details: ${error.response.data.details}`));
      }
    }
  }

  // List all widgets
  console.log(chalk.blue('\n📋 Listing all widgets...'));
  try {
    const listResponse = await axios.get(`${API_URL}/api/widgets`, {
      headers: {
        'X-API-Key': API_KEY,
        'X-AI-Service': 'widget-creator',
      },
    });

    if (listResponse.data.success) {
      console.log(chalk.green(`✅ Found ${listResponse.data.widgets.length} widgets:`));
      listResponse.data.widgets.forEach((w: any) => {
        console.log(chalk.cyan(`\n   📦 ${w.name}`));
        console.log(chalk.dim(`      ID: ${w.id}`));
        console.log(chalk.dim(`      Created: ${new Date(w.created_at).toLocaleString()}`));
        console.log(chalk.dim(`      Preview: ${API_URL}${w.previewUrl}`));
      });
    }
  } catch (error: any) {
    console.log(
      chalk.red(`❌ Error listing widgets: ${error.response?.data?.error || error.message}`)
    );
  }
}

// Test integration with Athena conversation engine
async function testAthenaIntegration() {
  console.log(chalk.blue('\n\n🤖 Testing Sweet Athena Conversation Integration\n'));

  const conversationRequests = [
    'Can you create a beautiful contact form widget with name, email, and message fields?',
    'I need a chart widget that can display sales data over time',
    'Build me a task list widget where users can add, complete, and delete tasks',
    'Create a notification widget that shows alerts with different severity levels',
  ];

  // Note: This would integrate with the actual Athena conversation engine
  // For now, we'll simulate the conversation flow
  console.log(chalk.yellow('💬 Simulating conversations with Sweet Athena...'));

  for (const request of conversationRequests) {
    console.log(chalk.cyan(`\nUser: "${request}"`));
    console.log(
      chalk.magenta(
        `Athena: "I'd love to create that widget for you! Let me work on that right away... 🌸"`
      )
    );
    console.log(
      chalk.dim('(In a real integration, this would trigger the widget creation pipeline)')
    );
  }
}

// Run the tests
(async () => {
  try {
    await testWidgetCreation();
    await testAthenaIntegration();

    console.log(chalk.green('\n\n✨ Widget creation pipeline test completed successfully!\n'));
  } catch (error) {
    console.error(chalk.red('\n❌ Test failed:'), error);
    process.exit(1);
  }
})();
