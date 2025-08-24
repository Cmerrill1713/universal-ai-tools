/**
 * ArXiv API Guide - Proper Usage for Research Paper Access
 *
 * This guide shows how to properly access ArXiv papers using their official API
 * instead of scraping, which would violate their terms of service.
 */

// ArXiv API Information
const arxivAPIGuide = {
  title: 'ArXiv API Usage Guide',
  version: '1.0.0',
  lastUpdated: new Date().toISOString(),

  overview: {
    description:
      'ArXiv provides a free, open-access API for searching and retrieving paper metadata',
    totalPapers: '2.4+ million scholarly articles',
    categories: [
      'Physics',
      'Mathematics',
      'Computer Science',
      'Quantitative Biology',
      'Quantitative Finance',
      'Statistics',
      'Electrical Engineering and Systems Science',
      'Economics',
    ],
    apiUrl: 'http://export.arxiv.org/api/query',
    documentation: 'https://info.arxiv.org/help/api/index.html',
  },

  // Example API queries
  exampleQueries: {
    // Search for AI papers
    aiPapers: {
      query: 'search_query=all:artificial+intelligence&start=0&max_results=10',
      description: 'Search for papers about artificial intelligence',
      url: 'http://export.arxiv.org/api/query?search_query=all:artificial+intelligence&start=0&max_results=10',
    },

    // Get papers by category
    computerScience: {
      query: 'search_query=cat:cs.AI&start=0&max_results=20',
      description: 'Get recent papers in Computer Science - AI category',
      url: 'http://export.arxiv.org/api/query?search_query=cat:cs.AI&start=0&max_results=20',
    },

    // Search by author
    byAuthor: {
      query: 'search_query=au:Bengio&start=0&max_results=10',
      description: 'Search papers by author name',
      url: 'http://export.arxiv.org/api/query?search_query=au:Bengio&start=0&max_results=10',
    },

    // Date-based search
    recentPapers: {
      query: 'search_query=all:transformer&sortBy=submittedDate&sortOrder=descending',
      description: 'Get recent papers about transformers',
      url: 'http://export.arxiv.org/api/query?search_query=all:transformer&sortBy=submittedDate&sortOrder=descending&max_results=10',
    },
  },

  // API rate limits and best practices
  bestPractices: {
    rateLimit: {
      description: 'Respect rate limits to avoid being blocked',
      recommendations: [
        'Maximum 1 request every 3 seconds',
        'Use delays between requests',
        'Cache results locally',
        'Batch queries when possible',
      ],
    },

    etiquette: {
      description: 'Follow ArXiv API etiquette',
      rules: [
        'Include User-Agent header with contact info',
        'Do not make concurrent requests',
        'Respect robots.txt',
        'Use official API, not web scraping',
        'Credit ArXiv in any derived work',
      ],
    },

    dataUsage: {
      description: 'Proper use of retrieved data',
      guidelines: [
        'Papers are under various licenses',
        'Check individual paper licenses',
        'Cite papers appropriately',
        'Do not redistribute entire database',
        'Link back to ArXiv for full papers',
      ],
    },
  },

  // Example TypeScript code for API usage
  sampleCode: `
// Example: Search ArXiv for AI papers using their API
async function searchArxiv(query: string, maxResults: number = 10) {
  const baseUrl = 'http://export.arxiv.org/api/query';
  const params = new URLSearchParams({
    search_query: query,
    start: '0',
    max_results: maxResults.toString(),
    sortBy: 'submittedDate',
    sortOrder: 'descending'
  });
  
  try {
    // Add delay to respect rate limits
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const response = await fetch(\`\${baseUrl}?\${params.toString()}\`, {
      headers: {
        'User-Agent': 'YourApp/1.0 (your-email@example.com)'
      }
    });
    
    if (!response.ok) {
      throw new Error('API request failed: ' + response.status);
    }
    
    const xmlText = await response.text();
    // Parse XML response (use xml2js or similar library)
    return parseArxivXML(xmlText);
    
  } catch (_error) {
    if (process.env.NODE_ENV === 'development') {
        console.error('ArXiv API error:', _error);
        }
    throw _error;
  }
}

// Example usage
const papers = await searchArxiv('cat:cs.AI AND all:transformer', 20);
if (process.env.NODE_ENV === 'development') {
  console.log('Found ' + papers.length + ' papers on AI transformers');
}
`,

  // Computer Science categories on ArXiv
  csCategories: {
    'cs.AI': 'Artificial Intelligence',
    'cs.CL': 'Computation and Language',
    'cs.CC': 'Computational Complexity',
    'cs.CE': 'Computational Engineering, Finance, and Science',
    'cs.CG': 'Computational Geometry',
    'cs.CV': 'Computer Vision and Pattern Recognition',
    'cs.CY': 'Computers and Society',
    'cs.CR': 'Cryptography and Security',
    'cs.DB': 'Databases',
    'cs.DC': 'Distributed, Parallel, and Cluster Computing',
    'cs.DL': 'Digital Libraries',
    'cs.DM': 'Discrete Mathematics',
    'cs.DS': 'Data Structures and Algorithms',
    'cs.ET': 'Emerging Technologies',
    'cs.FL': 'Formal Languages and Automata Theory',
    'cs.GL': 'General Literature',
    'cs.GR': 'Graphics',
    'cs.AR': 'Hardware Architecture',
    'cs.HC': 'Human-Computer Interaction',
    'cs.IR': 'Information Retrieval',
    'cs.IT': 'Information Theory',
    'cs.LG': 'Machine Learning',
    'cs.LO': 'Logic in Computer Science',
    'cs.MA': 'Multiagent Systems',
    'cs.MM': 'Multimedia',
    'cs.MS': 'Mathematical Software',
    'cs.NA': 'Numerical Analysis',
    'cs.NE': 'Neural and Evolutionary Computing',
    'cs.NI': 'Networking and Internet Architecture',
    'cs.OH': 'Other Computer Science',
    'cs.OS': 'Operating Systems',
    'cs.PF': 'Performance',
    'cs.PL': 'Programming Languages',
    'cs.RO': 'Robotics',
    'cs.SC': 'Symbolic Computation',
    'cs.SD': 'Sound',
    'cs.SE': 'Software Engineering',
    'cs.SI': 'Social and Information Networks',
    'cs.SY': 'Systems and Control',
  },

  // Alternative data sources
  alternatives: {
    datasets: [
      {
        name: 'ArXiv Dataset on Kaggle',
        url: 'https://www.kaggle.com/Cornell-University/arxiv',
        description: 'Official ArXiv dataset with metadata for all papers',
        size: '3.5GB compressed JSON',
      },
      {
        name: 'ArXiv Bulk Data Access',
        url: 'https://info.arxiv.org/help/bulk_data.html',
        description: 'Official bulk data access via Amazon S3',
        format: 'PDF source files and metadata',
      },
      {
        name: 'Papers With Code',
        url: 'https://paperswithcode.com',
        description: 'ML papers with code implementations',
        papers: '100,000+ papers with code',
      },
    ],
  },
};

// Function to demonstrate proper API usage
async function demonstrateArxivAPI() {
  console.log('ArXiv API Guide');
  console.log('===============');
  console.log('');
  console.log('Total Papers Available: 2.4+ million');
  console.log('Categories: ' + arxivAPIGuide.overview.categories.join(', '));
  console.log('');
  console.log('Proper API Usage:');
  console.log('- Use official API: http://export.arxiv.org/api/query');
  console.log('- Respect rate limits: 1 request per 3 seconds');
  console.log('- Include User-Agent header');
  console.log('- Do not scrape the website');
  console.log('');
  console.log('Example Queries:');
  Object.entries(arxivAPIGuide.exampleQueries).forEach(([key, query]) => {
    console.log(`- ${query.description}`);
    console.log(`  ${query.url}`);
  });
  console.log('');
  console.log('For bulk data access, use:');
  arxivAPIGuide.alternatives.datasets.forEach(dataset => {
    console.log(`- ${dataset.name}: ${dataset.description}`);
  });
}

// Export for use
export { arxivAPIGuide, demonstrateArxivAPI };

// Run demonstration
if (require.main === module) {
  demonstrateArxivAPI();
}
