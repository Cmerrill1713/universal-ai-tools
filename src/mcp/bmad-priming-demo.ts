#!/usr/bin/env node
/**
 * BMAD Priming Questions Demo
 * Demonstrates how the intelligent priming questions work
 */

// Example usage of the BMAD MCP Server priming questions

interface PrimingQuestion {
  id: string;
  category: string;
  question: string;
  description: string;
  answer_type: string;
  required: boolean;
  priority: string;
  answered: boolean;
  answer?: string;
}

// Example priming questions for different project types
const exampleQuestions: Record<string, PrimingQuestion[]> = {
  WebApplication: [
    {
      id: 'project_name',
      category: 'Project Basics',
      question: 'What is the name of your web application?',
      description: 'Provide a clear, descriptive name for your web application.',
      answer_type: 'text',
      required: true,
      priority: 'Critical',
      answered: false
    },
    {
      id: 'project_purpose',
      category: 'Project Basics',
      question: 'What problem does your web application solve?',
      description: 'Describe the main purpose and value proposition of your application.',
      answer_type: 'text',
      required: true,
      priority: 'Critical',
      answered: false
    },
    {
      id: 'target_users',
      category: 'User Analysis',
      question: 'Who will use your web application?',
      description: 'Describe your target users including demographics and technical skill level.',
      answer_type: 'text',
      required: true,
      priority: 'Critical',
      answered: false
    },
    {
      id: 'key_features',
      category: 'Feature Requirements',
      question: 'What are the essential features your web application must have?',
      description: 'List the core functionality that defines your application.',
      answer_type: 'list',
      required: true,
      priority: 'Critical',
      answered: false
    },
    {
      id: 'web_platforms',
      category: 'Platform Requirements',
      question: 'Which platforms should your web application support?',
      description: 'Consider desktop browsers, mobile devices, tablets, and specific browser requirements.',
      answer_type: 'multiple_choice',
      required: true,
      priority: 'High',
      answered: false
    },
    {
      id: 'technical_preferences',
      category: 'Technical Stack',
      question: 'Do you have any specific technology preferences?',
      description: 'Mention programming languages, frameworks, databases, or any technical requirements.',
      answer_type: 'text',
      required: false,
      priority: 'High',
      answered: false
    },
    {
      id: 'timeline',
      category: 'Project Planning',
      question: 'What is your project timeline?',
      description: 'When do you need this project completed? Include any important milestones.',
      answer_type: 'text',
      required: false,
      priority: 'High',
      answered: false
    },
    {
      id: 'success_metrics',
      category: 'Success Criteria',
      question: 'How will you measure the success of your web application?',
      description: 'Define key performance indicators, user engagement metrics, or business goals.',
      answer_type: 'text',
      required: false,
      priority: 'High',
      answered: false
    }
  ],
  
  MobileApp: [
    {
      id: 'project_name',
      category: 'Project Basics',
      question: 'What is the name of your mobile app?',
      description: 'Provide a clear, descriptive name for your mobile application.',
      answer_type: 'text',
      required: true,
      priority: 'Critical',
      answered: false
    },
    {
      id: 'project_purpose',
      category: 'Project Basics',
      question: 'What problem does your mobile app solve?',
      description: 'Describe the main purpose and value proposition of your mobile application.',
      answer_type: 'text',
      required: true,
      priority: 'Critical',
      answered: false
    },
    {
      id: 'target_users',
      category: 'User Analysis',
      question: 'Who will use your mobile app?',
      description: 'Describe your target users including demographics and mobile usage patterns.',
      answer_type: 'text',
      required: true,
      priority: 'Critical',
      answered: false
    },
    {
      id: 'key_features',
      category: 'Feature Requirements',
      question: 'What are the essential features your mobile app must have?',
      description: 'List the core functionality that defines your mobile application.',
      answer_type: 'list',
      required: true,
      priority: 'Critical',
      answered: false
    },
    {
      id: 'mobile_platforms',
      category: 'Platform Requirements',
      question: 'Which mobile platforms do you want to target?',
      description: 'Choose the mobile platforms for your application.',
      answer_type: 'multiple_choice',
      required: true,
      priority: 'High',
      answered: false
    },
    {
      id: 'offline_functionality',
      category: 'Mobile Features',
      question: 'Does your app need to work offline?',
      description: 'Consider if your app needs to function without internet connectivity.',
      answer_type: 'yes_no',
      required: false,
      priority: 'Medium',
      answered: false
    },
    {
      id: 'push_notifications',
      category: 'Mobile Features',
      question: 'Do you need push notifications?',
      description: 'Consider if your app needs to send notifications to users.',
      answer_type: 'yes_no',
      required: false,
      priority: 'Medium',
      answered: false
    }
  ],
  
  ApiService: [
    {
      id: 'project_name',
      category: 'Project Basics',
      question: 'What is the name of your API service?',
      description: 'Provide a clear, descriptive name for your API service.',
      answer_type: 'text',
      required: true,
      priority: 'Critical',
      answered: false
    },
    {
      id: 'project_purpose',
      category: 'Project Basics',
      question: 'What problem does your API service solve?',
      description: 'Describe the main purpose and value proposition of your API.',
      answer_type: 'text',
      required: true,
      priority: 'Critical',
      answered: false
    },
    {
      id: 'api_consumers',
      category: 'API Design',
      question: 'Who will consume your API?',
      description: 'Describe the clients that will use your API (web apps, mobile apps, other services, etc.).',
      answer_type: 'text',
      required: true,
      priority: 'High',
      answered: false
    },
    {
      id: 'key_features',
      category: 'Feature Requirements',
      question: 'What are the essential endpoints your API must provide?',
      description: 'List the core API endpoints and functionality.',
      answer_type: 'list',
      required: true,
      priority: 'Critical',
      answered: false
    },
    {
      id: 'authentication',
      category: 'API Security',
      question: 'What type of authentication does your API need?',
      description: 'Consider API keys, OAuth, JWT tokens, or other authentication methods.',
      answer_type: 'multiple_choice',
      required: false,
      priority: 'High',
      answered: false
    },
    {
      id: 'rate_limiting',
      category: 'API Performance',
      question: 'Do you need rate limiting for your API?',
      description: 'Consider if you need to limit the number of requests per user or client.',
      answer_type: 'yes_no',
      required: false,
      priority: 'Medium',
      answered: false
    }
  ],
  
  MLModel: [
    {
      id: 'project_name',
      category: 'Project Basics',
      question: 'What is the name of your ML model project?',
      description: 'Provide a clear, descriptive name for your machine learning project.',
      answer_type: 'text',
      required: true,
      priority: 'Critical',
      answered: false
    },
    {
      id: 'ml_objective',
      category: 'ML Requirements',
      question: 'What is your machine learning objective?',
      description: 'Describe what you want your ML model to predict, classify, or analyze.',
      answer_type: 'text',
      required: true,
      priority: 'High',
      answered: false
    },
    {
      id: 'data_sources',
      category: 'Data Requirements',
      question: 'What data sources will you use for training?',
      description: 'Describe the data you have available for training your ML model.',
      answer_type: 'text',
      required: true,
      priority: 'High',
      answered: false
    },
    {
      id: 'model_type',
      category: 'ML Requirements',
      question: 'What type of ML model do you need?',
      description: 'Consider classification, regression, clustering, or other ML approaches.',
      answer_type: 'multiple_choice',
      required: false,
      priority: 'High',
      answered: false
    },
    {
      id: 'performance_requirements',
      category: 'ML Performance',
      question: 'What are your model performance requirements?',
      description: 'Define accuracy, precision, recall, or other performance metrics.',
      answer_type: 'text',
      required: false,
      priority: 'Medium',
      answered: false
    }
  ]
};

// Demo function to show how priming questions work
function demonstratePrimingQuestions(projectType: string) {
  console.log(`\n🎯 BMAD Priming Questions Demo - ${projectType}`);
  console.log('=' .repeat(60));
  
  const questions = exampleQuestions[projectType] || exampleQuestions.WebApplication;
  
  console.log(`\n📋 Generated ${questions.length} intelligent priming questions:`);
  
  questions.forEach((question, index) => {
    console.log(`\n${index + 1}. [${question.priority}] ${question.question}`);
    console.log(`   Category: ${question.category}`);
    console.log(`   Description: ${question.description}`);
    console.log(`   Answer Type: ${question.answer_type}`);
    console.log(`   Required: ${question.required ? 'Yes' : 'No'}`);
  });
  
  console.log(`\n✅ These questions ensure comprehensive context gathering for ${projectType} projects!`);
}

// Example usage scenarios
console.log('🚀 BMAD Intelligent Priming Questions System');
console.log('This system ensures the LLM has enough context to build any widget or project!');

// Demo different project types
demonstratePrimingQuestions('WebApplication');
demonstratePrimingQuestions('MobileApp');
demonstratePrimingQuestions('ApiService');
demonstratePrimingQuestions('MLModel');

console.log('\n🎉 The BMAD MCP Server will use these intelligent questions to:');
console.log('1. Gather comprehensive project context');
console.log('2. Ensure all critical information is captured');
console.log('3. Generate detailed project artifacts');
console.log('4. Provide the LLM with complete context for development');
console.log('5. Build exactly what the user needs!');

export { exampleQuestions, demonstratePrimingQuestions };
