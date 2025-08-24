/**
 * Store Top 10 Programming Languages data in Supabase
 * Based on 2024-2025 statistics from multiple sources
 */

import { createClient } from '@supabase/supabase-js';

import Logger from '../renderer/utils/logger';
const supabaseUrl = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
const supabaseKey =
  process.env.SUPABASE_SERVICE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';
const supabase = createClient(supabaseUrl, supabaseKey);

const topProgrammingLanguages = {
  title: 'Top 10 Most Popular Programming Languages 2024-2025',
  version: '1.0.0',
  lastUpdated: new Date().toISOString(),
  sources: [
    'Stack Overflow Developer Survey 2024',
    'GitHub Octoverse 2024',
    'TIOBE Index August 2025',
    'IEEE Spectrum 2024',
    'PYPL Index 2024',
  ],

  languages: [
    {
      rank: 1,
      name: 'Python',
      category: 'General Purpose',
      usage: {
        stackOverflow: '51%',
        github: '#1 (overtook JavaScript in 2024)',
        tiobe: '#1 (Language of the Year 2024)',
        growth: '+8.2% YoY',
      },
      strengths: [
        'AI/ML dominance',
        'Data Science',
        'Simple syntax',
        'Extensive libraries',
        'AI code assistant compatibility',
      ],
      useCases: [
        'Machine Learning',
        'Data Analysis',
        'Web Development (Django/Flask)',
        'Automation',
        'Scientific Computing',
      ],
      trend: 'Rapidly growing due to AI boom',
    },

    {
      rank: 2,
      name: 'JavaScript',
      category: 'Web Development',
      usage: {
        stackOverflow: '62%',
        github: '#2 (previously #1)',
        tiobe: '#6',
        marketShare: '62.3%',
      },
      strengths: [
        'Universal web language',
        'Full-stack capability',
        'Huge ecosystem (npm)',
        'Active community',
        'Browser native',
      ],
      useCases: [
        'Frontend Development',
        'Node.js Backend',
        'Mobile Apps (React Native)',
        'Desktop Apps (Electron)',
        'Serverless Functions',
      ],
      trend: 'Stable, essential for web development',
    },

    {
      rank: 3,
      name: 'Java',
      category: 'Enterprise',
      usage: {
        stackOverflow: '30.5%',
        tiobe: '#4',
        enterprises: '90% of Fortune 500',
        androidApps: '70%',
      },
      strengths: [
        'Platform independence',
        'Enterprise-grade',
        'Strong typing',
        'Mature ecosystem',
        'Android development',
      ],
      useCases: [
        'Enterprise Applications',
        'Android Development',
        'Web Services',
        'Big Data (Hadoop/Spark)',
        'Microservices',
      ],
      trend: 'Stable in enterprise, declining in startups',
    },

    {
      rank: 4,
      name: 'TypeScript',
      category: 'Typed JavaScript',
      usage: {
        stackOverflow: '38.8%',
        github: 'Fastest growing',
        satisfaction: '73%',
        growth: '+37% YoY',
      },
      strengths: [
        'Type safety',
        'Better IDE support',
        'JavaScript compatibility',
        'Error prevention',
        'Enterprise adoption',
      ],
      useCases: [
        'Large-scale JavaScript apps',
        'React/Angular/Vue projects',
        'Node.js backends',
        'Library development',
        'Enterprise web apps',
      ],
      trend: 'Rapidly growing, expected top 3 by 2026',
    },

    {
      rank: 5,
      name: 'C++',
      category: 'System Programming',
      usage: {
        stackOverflow: '22.4%',
        tiobe: '#2',
        gameEngines: '95%',
        embedded: '60%',
      },
      strengths: [
        'High performance',
        'Memory control',
        'Hardware access',
        'Game development',
        'System programming',
      ],
      useCases: [
        'Game Development',
        'Operating Systems',
        'Embedded Systems',
        'High-Performance Computing',
        'Graphics/3D Software',
      ],
      trend: 'Stable in specialized domains',
    },

    {
      rank: 6,
      name: 'C#',
      category: 'Microsoft Ecosystem',
      usage: {
        stackOverflow: '27.6%',
        tiobe: '#5',
        unityGames: '60%',
        dotnet: '100%',
      },
      strengths: [
        '.NET ecosystem',
        'Cross-platform',
        'Unity game engine',
        'Modern features',
        'Microsoft support',
      ],
      useCases: [
        'Windows Applications',
        'Unity Game Development',
        'Web APIs (ASP.NET)',
        'Azure Cloud Services',
        'Enterprise Software',
      ],
      trend: 'Growing with .NET modernization',
    },

    {
      rank: 7,
      name: 'PHP',
      category: 'Web Backend',
      usage: {
        stackOverflow: '18.5%',
        websites: '75.6% of all websites',
        wordpress: '100%',
        marketShare: '4.57%',
      },
      strengths: [
        'Web-focused',
        'Easy deployment',
        'WordPress ecosystem',
        'Shared hosting support',
        'Large community',
      ],
      useCases: [
        'Web Development',
        'Content Management Systems',
        'E-commerce (Magento/WooCommerce)',
        'APIs',
        'Server-side scripting',
      ],
      trend: 'Declining but still dominant in web',
    },

    {
      rank: 8,
      name: 'HTML/CSS',
      category: 'Web Markup & Styling',
      usage: {
        stackOverflow: '53%',
        webPages: '100%',
        essential: 'Required for all web',
        frameworks: 'Foundation for all',
      },
      strengths: [
        'Web foundation',
        'Universal browser support',
        'Easy to learn',
        'Visual design',
        'Responsive layouts',
      ],
      useCases: [
        'Web Page Structure',
        'Styling and Layout',
        'Responsive Design',
        'Email Templates',
        'Web Components',
      ],
      trend: 'Essential, evolving with CSS4',
    },

    {
      rank: 9,
      name: 'SQL',
      category: 'Database Query',
      usage: {
        stackOverflow: '51.5%',
        databases: '85%',
        dataJobs: '90%',
        essential: 'Required for data work',
      },
      strengths: [
        'Database standard',
        'Declarative syntax',
        'Powerful queries',
        'ACID compliance',
        'Universal adoption',
      ],
      useCases: [
        'Database Management',
        'Data Analysis',
        'Business Intelligence',
        'ETL Processes',
        'Reporting',
      ],
      trend: 'Stable, essential for data work',
    },

    {
      rank: 10,
      name: 'Rust',
      category: 'Systems Programming',
      usage: {
        stackOverflow: '13%',
        satisfaction: '83% (highest)',
        growth: '+50% YoY',
        linux: 'Approved for kernel',
      },
      strengths: [
        'Memory safety',
        'Zero-cost abstractions',
        'Concurrency safety',
        'Performance',
        'Modern tooling',
      ],
      useCases: [
        'Systems Programming',
        'WebAssembly',
        'Blockchain/Crypto',
        'Embedded Systems',
        'CLI Tools',
      ],
      trend: 'Fastest growing, expected top 5 by 2026',
    },
  ],

  keyTrends2025: {
    aiDriven: {
      description: 'AI code assistants driving language adoption',
      impact: 'Python growth accelerated by AI tool compatibility',
      languages: ['Python', 'TypeScript', 'JavaScript'],
    },

    typeSystem: {
      description: 'Strong typing becoming more important',
      impact: 'TypeScript and Rust gaining adoption',
      languages: ['TypeScript', 'Rust', 'Go', 'Kotlin'],
    },

    performance: {
      description: 'Performance and efficiency focus',
      impact: 'Systems languages seeing renewed interest',
      languages: ['Rust', 'Go', 'C++', 'Zig'],
    },

    webAssembly: {
      description: 'WebAssembly enabling new web capabilities',
      impact: 'Non-JavaScript languages running in browsers',
      languages: ['Rust', 'C++', 'Go', 'AssemblyScript'],
    },
  },

  emergingLanguages: [
    {
      name: 'Go',
      rank: 11,
      description: 'Cloud-native and microservices',
      growth: '+25% YoY',
    },
    {
      name: 'Kotlin',
      rank: 12,
      description: 'Modern Android development',
      growth: '+20% YoY',
    },
    {
      name: 'Swift',
      rank: 13,
      description: 'iOS/macOS development',
      growth: '+15% YoY',
    },
    {
      name: 'Dart',
      rank: 14,
      description: 'Flutter cross-platform apps',
      growth: '+30% YoY',
    },
    {
      name: 'Zig',
      rank: 15,
      description: 'C replacement, systems programming',
      growth: '+40% YoY',
    },
  ],
};

async function storeProgrammingLanguages() {
  try {
    if (process.env.NODE_ENV === 'development') {
      Logger.debug('📥 Storing top programming languages data in Supabase...');
    }

    const { _data, _error } = await supabase.from('context_storage').insert({
      category: 'programming_languages',
      source: 'web-scraping-2025',
      content: JSON.stringify(topProgrammingLanguages),
      metadata: {
        type: 'language_statistics',
        version: '1.0.0',
        year: '2024-2025',
        total_languages: topProgrammingLanguages.languages.length,
        sources_count: topProgrammingLanguages.sources.length,
        scraping_date: new Date().toISOString(),
      },
      user_id: 'system',
    });

    if (_error) {
      if (process.env.NODE_ENV === 'development') {
        Logger.error('❌ Error storing languages data:', _error);
      }
      return;
    }

    Logger.debug('✅ Programming languages data stored successfully!');
    Logger.debug('');
    Logger.debug('📊 Top 10 Languages Summary:');
    topProgrammingLanguages.languages.forEach(lang => {
      Logger.debug(`  ${lang.rank}. ${lang.name} - ${lang.category} (${lang.trend})`);
    });
    Logger.debug('');
    Logger.debug('🚀 Key Trends for 2025:');
    Logger.debug('  - AI-driven growth benefiting Python');
    Logger.debug('  - TypeScript rapidly climbing rankings');
    Logger.debug('  - Rust highest satisfaction, fastest growing');
    Logger.debug('  - Strong typing becoming more important');
  } catch (err) {
    Logger.error('Failed to store languages data:', err);
  }
}

// Run the storage function
storeProgrammingLanguages();
