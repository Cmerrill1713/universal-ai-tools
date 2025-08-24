#!/usr/bin/env node
/**
 * Demo: Personal AI Assistant in Action
 * Shows practical examples of using the AI agents
 */

const readline = require('readline');
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

// Demo scenarios
const demos = {
  1: {
    name: '📅 Calendar Management',
    examples: [
      'Schedule a team meeting next Tuesday at 2pm',
      'Find a free slot for a 2-hour workshop next week',
      'Reschedule my 3pm appointment to 4pm',
      'What meetings do I have tomorrow?',
      'Block time for deep work every morning',
    ],
  },
  2: {
    name: '📸 Photo Organization',
    examples: [
      'Organize all photos from my Hawaii trip',
      'Find all photos of Sarah and create an album',
      'Remove duplicate photos from my Pictures folder',
      'Organize photos by year and month',
      'Find photos taken at the beach',
    ],
  },
  3: {
    name: '📁 File Management',
    examples: [
      'Organize my Downloads folder by file type',
      'Find all PDF documents about project X',
      'Clean up files older than 6 months',
      'Find duplicate files and remove them',
      'Create a backup of important documents',
    ],
  },
  4: {
    name: '💻 Code Assistant',
    examples: [
      'Generate a Python script to process CSV files',
      'Analyze this codebase and suggest improvements',
      'Create unit tests for the user service',
      'Refactor this function to be more efficient',
      'Generate a commit message for recent changes',
    ],
  },
  5: {
    name: '⚙️ System Control',
    examples: [
      'How much free disk space do I have?',
      'Open Safari and go to github.com',
      'Clean up system caches',
      'Show me CPU and memory usage',
      'Quit all browsers',
    ],
  },
  6: {
    name: '🌐 Web Scraping',
    examples: [
      'Get the latest tech news from Hacker News',
      'Monitor Apple.com for new products',
      'Extract product prices from Amazon',
      'Get weather forecast for San Francisco',
      'Track stock prices for AAPL',
    ],
  },
  7: {
    name: '🔧 Tool Creation',
    examples: [
      'Create a tool to convert markdown to PDF',
      'Build a Slack integration for notifications',
      'Create a workflow to backup photos daily',
      'Generate a script to resize images',
      'Create a tool to monitor website uptime',
    ],
  },
  8: {
    name: '🤝 Multi-Agent Tasks',
    examples: [
      'Organize photos from my trip, create a presentation, and schedule a meeting to share it',
      'Analyze this project, fix issues, commit changes, and update documentation',
      'Clean my system, organize files, and create a backup of important data',
      'Research a topic online, create a summary document, and schedule time to review it',
      'Monitor my favorite websites for updates and email me a daily digest',
    ],
  },
};

// Simulate agent responses
async function simulateAgentResponse(category, request) {
  process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && console.log('\n🤖 Processing request...\n');

  // Simulate processing time
  await new Promise((resolve) => setTimeout(resolve, 1500));

  // Generate mock responses based on category
  const responses = {
    1: `✅ Calendar Agent Response:
    I've scheduled your meeting for next Tuesday at 2pm.
    - No conflicts detected
    - Meeting room available
    - Invitations will be sent to attendees
    - Added to your calendar with reminder 15 minutes before`,

    2: `✅ Photo Organizer Response:
    Found 247 photos from your Hawaii trip.
    - Created album "Hawaii Trip 2024"
    - Organized by date and location
    - Detected 12 duplicate photos (removed)
    - Face detection found 5 people in photos`,

    3: `✅ File Manager Response:
    Organized 156 files in Downloads folder:
    - Documents: 45 files → ~/Downloads/Documents
    - Images: 62 files → ~/Downloads/Images
    - Videos: 23 files → ~/Downloads/Videos
    - Archives: 26 files → ~/Downloads/Archives
    - Found and removed 18 duplicate files`,

    4: `✅ Code Assistant Response:
    Generated Python CSV processor script:
    \`\`\`python
    import pandas as pd
    
    def process_csv(file_path):
        df = pd.read_csv(file_path)
        # Data cleaning and processing
        return df
    \`\`\`
    - Added error handling
    - Optimized for large files
    - Included unit tests`,

    5: `✅ System Control Response:
    System Status:
    - Free disk space: 245.3 GB (52% available)
    - CPU usage: 23%
    - Memory: 8.2 GB used of 16 GB
    - Network: Active, 45 Mbps
    - Battery: 87% (3 hours remaining)`,

    6: `✅ Web Scraper Response:
    Latest tech news from Hacker News:
    1. "OpenAI announces new breakthrough" - 342 points
    2. "SpaceX successful Mars simulation" - 298 points
    3. "New JavaScript framework released" - 276 points
    4. "Apple Vision Pro gets major update" - 251 points
    5. "Quantum computing milestone achieved" - 189 points`,

    7: `✅ Tool Maker Response:
    Created markdown-to-pdf converter tool:
    - Installed required dependencies
    - Generated conversion script
    - Added CLI interface
    - Created automated workflow
    - Tool available at: ~/tools/md2pdf`,

    8: `✅ Multi-Agent Coordination:
    Completed complex task with 3 agents:
    
    📸 Photo Organizer: Organized 156 trip photos
    📁 File Manager: Created presentation with 20 best photos
    📅 Calendar Agent: Scheduled meeting for Friday 3pm
    
    All tasks completed successfully!`,
  };

  return responses[category] || 'Processing your request...';
}

// Interactive demo
async function runInteractiveDemo() {
  console.log('🤖 Personal AI Assistant Demo');
  console.log('==============================\n');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  function showMenu() {
    console.log('\nChoose a demo category:');
    Object.entries(demos).forEach(([key, demo]) => {
      console.log(`${key}. ${demo.name}`);
    });
    console.log('0. Exit\n');
  }

  async function handleCategory(category) {
    if (!demos[category]) return false;

    console.log(`\n${demos[category].name}`);
    console.log('Example commands:');
    demos[category].examples.forEach((ex, i) => {
      console.log(`  ${i + 1}. "${ex}"`);
    });

    const example = await new Promise((resolve) => {
      rl.question('\nChoose an example (1-5) or type your own request: ', resolve);
    });

    let request;
    const exampleNum = parseInt(example);
    if (exampleNum >= 1 && exampleNum <= 5) {
      request = demos[category].examples[exampleNum - 1];
      console.log(`\n📝 Request: "${request}"`);
    } else {
      request = example;
    }

    const response = await simulateAgentResponse(category, request);
    console.log('\n' + response);

    return true;
  }

  // Main loop
  let running = true;
  while (running) {
    showMenu();

    const choice = await new Promise((resolve) => {
      rl.question('Enter your choice: ', resolve);
    });

    if (choice === '0') {
      running = false;
    } else {
      await handleCategory(choice);

      const cont = await new Promise((resolve) => {
        rl.question('\n\nPress Enter to continue...', resolve);
      });
    }
  }

  rl.close();
  console.log('\n👋 Thanks for trying the Personal AI Assistant demo!\n');
}

// Quick demos
async function runQuickDemo() {
  console.log('🚀 Personal AI Assistant - Quick Demo');
  console.log('====================================\n');

  const quickDemos = [
    {
      agent: 'Calendar',
      request: 'Schedule a meeting tomorrow at 3pm',
      icon: '📅',
    },
    {
      agent: 'Photo Organizer',
      request: 'Find all photos of John and create an album',
      icon: '📸',
    },
    {
      agent: 'File Manager',
      request: 'Organize my Downloads folder',
      icon: '📁',
    },
    {
      agent: 'Code Assistant',
      request: 'Generate a Python web scraper',
      icon: '💻',
    },
  ];

  for (const demo of quickDemos) {
    console.log(`${demo.icon} ${demo.agent} Agent Demo`);
    console.log(`Request: "${demo.request}"`);

    // Simulate processing
    process.stdout.write('Processing');
    for (let i = 0; i < 3; i++) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      process.stdout.write('.');
    }
    console.log(' Done!');

    console.log(`✅ Task completed successfully\n`);
  }

  console.log('💡 These are just simulations. The real agents can:');
  console.log('  • Actually manage your calendar');
  console.log('  • Organize real photos with face recognition');
  console.log('  • Clean up and organize your files');
  console.log('  • Generate and run actual code');
  console.log('  • Control your system and applications');
  console.log('  • Scrape websites and monitor changes');
  console.log('  • Create custom tools on demand');
  console.log('  • Coordinate multiple agents for complex tasks\n');
}

// Main
async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--quick')) {
    await runQuickDemo();
  } else {
    await runInteractiveDemo();
  }
}

main().catch(console.error);
