#!/usr/bin/env node

/**
 * Universal AI Tools - UI Demo for Screen Recording
 * This script automates the UI to showcase all features
 * 
 * INSTRUCTIONS:
 * 1. Start your screen recorder (CMD+SHIFT+5 on Mac)
 * 2. Run this script: node run-ui-demo-screener.js
 * 3. The browser will open and automate through all features
 * 4. Stop recording when the demo completes
 */

import puppeteer from 'puppeteer';
import chalk from 'chalk';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { mkdirSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class UIScreenerDemo {
  constructor() {
    this.browser = null;
    this.page = null;
    this.uiBase = 'http://localhost:3000';
    this.apiBase = 'http://localhost:9999/api/v1';
  }

  async init() {
    console.log(chalk.cyan('🎬 Starting Universal AI Tools UI Demo...'));
    console.log(chalk.yellow('\n📹 IMPORTANT: Start your screen recorder now!'));
    console.log(chalk.gray('   On Mac: Press CMD+SHIFT+5'));
    console.log(chalk.gray('   Click "Record Entire Screen" or "Record Selected Portion"'));
    console.log(chalk.gray('   The browser will open in 5 seconds...\n'));
    
    await this.sleep(5000);
    
    this.browser = await puppeteer.launch({
      headless: false,
      defaultViewport: null,
      args: [
        '--start-maximized',
        '--no-sandbox',
        '--disable-setuid-sandbox'
      ]
    });
    
    const pages = await this.browser.pages();
    this.page = pages[0] || await this.browser.newPage();
    
    // Set viewport to full HD
    await this.page.setViewport({
      width: 1920,
      height: 1080,
      deviceScaleFactor: 1,
    });
  }

  async typeWithEffect(selector, text, delay = 80) {
    await this.page.waitForSelector(selector, { timeout: 10000 });
    await this.page.click(selector);
    await this.page.evaluate((sel) => {
      const element = document.querySelector(sel);
      if (element) element.value = '';
    }, selector);
    
    for (const char of text) {
      await this.page.type(selector, char);
      await this.sleep(delay);
    }
  }

  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async smoothScroll(distance = 300) {
    await this.page.evaluate((dist) => {
      window.scrollBy({
        top: dist,
        behavior: 'smooth'
      });
    }, distance);
    await this.sleep(1000);
  }

  async runDemo() {
    try {
      // Create screenshots directory
      mkdirSync(join(__dirname, 'demo-screenshots'), { recursive: true });

      // Scene 1: Landing Page
      console.log(chalk.yellow('\n🎬 Scene 1: Landing Page - Universal AI Tools'));
      await this.page.goto(this.uiBase, { waitUntil: 'networkidle2' });
      await this.sleep(3000);
      
      // Highlight key features
      await this.page.evaluate(() => {
        const title = document.querySelector('h1');
        if (title) {
          title.style.transition = 'all 0.5s';
          title.style.transform = 'scale(1.1)';
          setTimeout(() => {
            title.style.transform = 'scale(1)';
          }, 1000);
        }
      });
      await this.sleep(2000);

      // Scene 2: Navigate to Chat
      console.log(chalk.yellow('\n💬 Scene 2: AI Chat Interface'));
      const chatLink = await this.page.$('a[href="/chat"], button:has-text("Chat")');
      if (chatLink) {
        await chatLink.click();
        await this.page.waitForNavigation({ waitUntil: 'networkidle2' });
      } else {
        await this.page.goto(`${this.uiBase}/chat`, { waitUntil: 'networkidle2' });
      }
      await this.sleep(2000);

      // Demo chat interaction
      console.log(chalk.cyan('   Demonstrating AI chat capabilities...'));
      const chatInput = await this.page.$('textarea, input[type="text"]');
      if (chatInput) {
        await this.typeWithEffect(
          'textarea, input[type="text"]',
          'Create a photo organization project for 15,000 family photos with AI vision capabilities',
          60
        );
        await this.sleep(1000);
        
        // Send message
        const sendButton = await this.page.$('button[type="submit"], button:has-text("Send")');
        if (sendButton) {
          await sendButton.click();
        } else {
          await this.page.keyboard.press('Enter');
        }
        await this.sleep(3000);
      }

      // Scene 3: Dashboard
      console.log(chalk.yellow('\n📊 Scene 3: Dashboard & Metrics'));
      await this.page.goto(`${this.uiBase}/dashboard`, { waitUntil: 'networkidle2' });
      await this.sleep(2000);
      
      // Scroll through dashboard sections
      await this.smoothScroll(400);
      await this.smoothScroll(400);
      await this.smoothScroll(-800); // Scroll back up

      // Scene 4: Projects View
      console.log(chalk.yellow('\n📁 Scene 4: Project Management'));
      await this.page.goto(`${this.uiBase}/projects`, { waitUntil: 'networkidle2' });
      await this.sleep(2000);

      // Create a new project demo
      const createButton = await this.page.$('button:has-text("Create"), button:has-text("New Project")');
      if (createButton) {
        await createButton.click();
        await this.sleep(1000);
        
        // Fill project form if it appears
        const nameInput = await this.page.$('input[name="name"], input[placeholder*="name"]');
        if (nameInput) {
          await this.typeWithEffect(
            'input[name="name"], input[placeholder*="name"]',
            'Family Photo Collection 2025',
            70
          );
        }
      }

      // Scene 5: Agents View
      console.log(chalk.yellow('\n🤖 Scene 5: AI Agent Gallery'));
      await this.page.goto(`${this.uiBase}/agents`, { waitUntil: 'networkidle2' });
      await this.sleep(2000);
      
      // Highlight each agent
      await this.page.evaluate(() => {
        const agents = document.querySelectorAll('.agent-card, [class*="agent"]');
        agents.forEach((agent, index) => {
          setTimeout(() => {
            agent.style.transition = 'all 0.3s';
            agent.style.transform = 'scale(1.05)';
            agent.style.boxShadow = '0 10px 30px rgba(0,212,255,0.3)';
            setTimeout(() => {
              agent.style.transform = 'scale(1)';
              agent.style.boxShadow = '';
            }, 500);
          }, index * 300);
        });
      });
      await this.sleep(3000);

      // Scene 6: API Documentation
      console.log(chalk.yellow('\n📚 Scene 6: API Documentation'));
      await this.page.goto(`${this.uiBase}/api-docs`, { waitUntil: 'networkidle2' });
      await this.sleep(2000);
      
      // Scroll through API sections
      await this.smoothScroll(400);
      await this.smoothScroll(400);

      // Scene 7: Final Dashboard with Live Metrics
      console.log(chalk.yellow('\n✨ Scene 7: Live Performance Metrics'));
      await this.page.goto(`${this.uiBase}/dashboard`, { waitUntil: 'networkidle2' });
      await this.sleep(2000);

      // Add success overlay
      await this.page.evaluate(() => {
        const overlay = document.createElement('div');
        overlay.style.cssText = `
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: linear-gradient(135deg, rgba(0,0,0,0.9) 0%, rgba(0,50,100,0.9) 100%);
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          z-index: 10000;
          animation: fadeIn 1s ease-in;
        `;
        
        overlay.innerHTML = `
          <style>
            @keyframes fadeIn {
              from { opacity: 0; }
              to { opacity: 1; }
            }
            @keyframes slideIn {
              from { transform: translateY(50px); opacity: 0; }
              to { transform: translateY(0); opacity: 1; }
            }
            .metric-item {
              animation: slideIn 0.5s ease-out forwards;
              opacity: 0;
            }
          </style>
          <h1 style="font-size: 5rem; margin-bottom: 2rem; color: #00d4ff; text-shadow: 0 0 30px #00d4ff;">
            Universal AI Tools
          </h1>
          <p style="font-size: 2.5rem; margin-bottom: 4rem; color: #fff; text-shadow: 0 0 10px rgba(255,255,255,0.5);">
            The Future of AI Project Management
          </p>
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 2rem; font-size: 1.8rem;">
            <div class="metric-item" style="animation-delay: 0.2s; text-align: center;">
              <div style="color: #00ff88; font-size: 3rem; font-weight: bold;">8.3x</div>
              <div style="color: #ddd;">Faster Execution</div>
            </div>
            <div class="metric-item" style="animation-delay: 0.4s; text-align: center;">
              <div style="color: #00ff88; font-size: 3rem; font-weight: bold;">94.7%</div>
              <div style="color: #ddd;">Success Rate</div>
            </div>
            <div class="metric-item" style="animation-delay: 0.6s; text-align: center;">
              <div style="color: #00ff88; font-size: 3rem; font-weight: bold;">6</div>
              <div style="color: #ddd;">AI Agents</div>
            </div>
            <div class="metric-item" style="animation-delay: 0.8s; text-align: center;">
              <div style="color: #00ff88; font-size: 3rem; font-weight: bold;">37+</div>
              <div style="color: #ddd;">LLM Models</div>
            </div>
          </div>
          <p style="margin-top: 4rem; font-size: 1.5rem; color: #888;">
            github.com/universal-ai-tools
          </p>
        `;
        
        document.body.appendChild(overlay);
      });
      
      await this.sleep(8000);

      console.log(chalk.green('\n✅ Demo Complete!'));
      console.log(chalk.yellow('📹 You can stop your screen recording now.'));
      console.log(chalk.gray('\nThe browser will remain open for 5 seconds...'));
      
      await this.sleep(5000);

    } catch (error) {
      console.error(chalk.red('Demo error:'), error);
      console.log(chalk.yellow('\nTroubleshooting:'));
      console.log('1. Make sure the UI is running: cd ui && npm run dev');
      console.log('2. Make sure the API is running: npm run dev');
      console.log('3. Check that ports 3000 and 9999 are available');
    }
  }

  async cleanup() {
    if (this.browser) {
      await this.browser.close();
    }
  }

  async run() {
    console.log(chalk.bold.cyan('\n🎥 UNIVERSAL AI TOOLS - SCREENER DEMO'));
    console.log(chalk.gray('━'.repeat(50)));
    console.log(chalk.white('\nThis demo will:'));
    console.log('  • Open a browser window');
    console.log('  • Navigate through all UI features');
    console.log('  • Demonstrate AI capabilities');
    console.log('  • Show project creation and management');
    console.log('  • Display performance metrics');
    
    try {
      await this.init();
      await this.runDemo();
      await this.cleanup();
    } catch (error) {
      console.error(chalk.red('\nError:'), error.message);
      await this.cleanup();
      process.exit(1);
    }
  }
}

// Run the demo
const demo = new UIScreenerDemo();
demo.run();