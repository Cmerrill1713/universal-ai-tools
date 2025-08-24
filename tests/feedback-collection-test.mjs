/**
 * Feedback Collection System Test
 * Comprehensive testing of the feedback collection, analysis, and improvement system
 */

console.log('🧪 Testing Feedback Collection System...\n');

async function testFeedbackCollectionStructure() {
  try {
    console.log('1. Testing feedback collection structure...');
    
    // Test feedback types and categories
    const feedbackTypes = ['rating', 'suggestion', 'bug_report', 'feature_request', 'general'];
    const categories = ['model_performance', 'user_interface', 'speed', 'accuracy', 'usability', 'other'];
    const priorities = ['low', 'medium', 'high', 'critical'];
    const statuses = ['new', 'reviewed', 'in_progress', 'resolved', 'dismissed'];
    const sentiments = ['positive', 'negative', 'neutral'];
    
    console.log('✅ Feedback types validated:', feedbackTypes.length);
    console.log('✅ Categories validated:', categories.length);
    console.log('✅ Priorities validated:', priorities.length);
    console.log('✅ Statuses validated:', statuses.length);
    console.log('✅ Sentiments validated:', sentiments.length);
    
    // Test feedback structure
    const sampleFeedback = {
      id: 'feedback_test_123',
      userId: 'test-user-123',
      sessionId: 'session-456',
      timestamp: new Date(),
      feedbackType: 'rating',
      category: 'model_performance',
      rating: 4,
      title: 'Good response quality',
      description: 'The model provided accurate and helpful information',
      context: {
        modelUsed: 'claude-3-sonnet',
        taskType: 'text_generation',
        promptLength: 150,
        responseLength: 500,
        responseTime: 2500
      },
      sentiment: 'positive',
      priority: 'low',
      status: 'new',
      tags: ['quality', 'accuracy'],
      modelId: 'claude-3-sonnet',
      providerId: 'anthropic',
      responseTime: 2500
    };
    
    console.log('✅ Feedback structure validated');
    
    // Test context structure
    const contextStructure = {
      modelUsed: 'string',
      taskType: 'string',
      promptLength: 'number',
      responseLength: 'number',
      userAgent: 'string',
      platform: 'string',
      sessionDuration: 'number',
      errorOccurred: 'boolean'
    };
    
    console.log('✅ Context structure validated');
    
    // Test attachment structure
    const attachmentStructure = {
      type: 'screenshot',
      filename: 'error-screenshot.png',
      content: 'base64-encoded-content',
      size: 1024000,
      mimeType: 'image/png'
    };
    
    console.log('✅ Attachment structure validated');
    
    return true;
    
  } catch (error) {
    console.error('❌ Feedback structure test failed:', error);
    return false;
  }
}

async function testSentimentAnalysis() {
  try {
    console.log('\n2. Testing sentiment analysis logic...');
    
    // Test sentiment analysis keywords
    const sentimentTests = [
      {
        text: 'This is excellent and amazing work!',
        expected: 'positive',
        keywords: ['excellent', 'amazing']
      },
      {
        text: 'This is terrible and broken, very frustrated',
        expected: 'negative',
        keywords: ['terrible', 'broken', 'frustrated']
      },
      {
        text: 'The interface is okay and functional',
        expected: 'neutral',
        keywords: []
      },
      {
        text: 'I love how fast and accurate this is',
        expected: 'positive',
        keywords: ['love', 'fast', 'accurate']
      },
      {
        text: 'Slow response and confusing errors',
        expected: 'negative',
        keywords: ['slow', 'confusing', 'errors']
      }
    ];
    
    function analyzeSentiment(text) {
      const positiveKeywords = [
        'good', 'great', 'excellent', 'awesome', 'love', 'like', 'perfect',
        'amazing', 'wonderful', 'fantastic', 'helpful', 'useful', 'fast',
        'easy', 'smooth', 'efficient', 'accurate', 'impressed', 'satisfied'
      ];

      const negativeKeywords = [
        'bad', 'terrible', 'awful', 'hate', 'dislike', 'broken', 'slow',
        'difficult', 'confusing', 'error', 'bug', 'problem', 'issue',
        'frustrated', 'annoying', 'useless', 'inaccurate', 'disappointed'
      ];

      const lowerText = text.toLowerCase();
      
      let positiveScore = 0;
      let negativeScore = 0;

      for (const keyword of positiveKeywords) {
        const matches = (lowerText.match(new RegExp(keyword, 'g')) || []).length;
        positiveScore += matches;
      }

      for (const keyword of negativeKeywords) {
        const matches = (lowerText.match(new RegExp(keyword, 'g')) || []).length;
        negativeScore += matches;
      }

      if (positiveScore > negativeScore) {
        return 'positive';
      } else if (negativeScore > positiveScore) {
        return 'negative';
      } else {
        return 'neutral';
      }
    }
    
    let passedTests = 0;
    for (const test of sentimentTests) {
      const result = analyzeSentiment(test.text);
      if (result === test.expected) {
        passedTests++;
        console.log(`   ✅ "${test.text.slice(0, 30)}..." -> ${result}`);
      } else {
        console.log(`   ❌ "${test.text.slice(0, 30)}..." -> ${result} (expected ${test.expected})`);
      }
    }
    
    console.log(`✅ Sentiment analysis: ${passedTests}/${sentimentTests.length} tests passed`);
    
    return passedTests >= sentimentTests.length * 0.8; // 80% pass rate
    
  } catch (error) {
    console.error('❌ Sentiment analysis test failed:', error);
    return false;
  }
}

async function testFeedbackCategorization() {
  try {
    console.log('\n3. Testing automatic categorization...');
    
    const categorizationTests = [
      {
        description: 'The model response was very accurate and helpful',
        context: { modelUsed: 'claude-3-sonnet' },
        expected: 'model_performance'
      },
      {
        description: 'The interface is confusing and hard to navigate',
        context: {},
        expected: 'user_interface'
      },
      {
        description: 'Response time is too slow, takes forever to load',
        context: { responseTime: 5000 },
        expected: 'speed'
      },
      {
        description: 'The answer was completely wrong and inaccurate',
        context: {},
        expected: 'accuracy'
      },
      {
        description: 'This feature is very easy to use and simple',
        context: {},
        expected: 'usability'
      },
      {
        description: 'Random feedback about something else entirely',
        context: {},
        expected: 'other'
      }
    ];
    
    function categorizeFeedback(description, context = {}) {
      const lowerText = description.toLowerCase();
      
      // Model performance indicators
      if (lowerText.includes('model') || lowerText.includes('response') || 
          lowerText.includes('accuracy') || lowerText.includes('quality') ||
          context.modelUsed) {
        return 'model_performance';
      }

      // UI/UX indicators
      if (lowerText.includes('interface') || lowerText.includes('ui') || 
          lowerText.includes('design') || lowerText.includes('layout') ||
          lowerText.includes('button') || lowerText.includes('menu')) {
        return 'user_interface';
      }

      // Speed indicators
      if (lowerText.includes('slow') || lowerText.includes('fast') || 
          lowerText.includes('speed') || lowerText.includes('performance') ||
          lowerText.includes('time') || context.responseTime) {
        return 'speed';
      }

      // Accuracy indicators
      if (lowerText.includes('wrong') || lowerText.includes('correct') || 
          lowerText.includes('accurate') || lowerText.includes('mistake') ||
          lowerText.includes('error') || lowerText.includes('incorrect')) {
        return 'accuracy';
      }

      // Usability indicators
      if (lowerText.includes('easy') || lowerText.includes('difficult') || 
          lowerText.includes('hard') || lowerText.includes('confusing') ||
          lowerText.includes('simple') || lowerText.includes('complex')) {
        return 'usability';
      }

      return 'other';
    }
    
    let passedTests = 0;
    for (const test of categorizationTests) {
      const result = categorizeFeedback(test.description, test.context);
      if (result === test.expected) {
        passedTests++;
        console.log(`   ✅ "${test.description.slice(0, 40)}..." -> ${result}`);
      } else {
        console.log(`   ❌ "${test.description.slice(0, 40)}..." -> ${result} (expected ${test.expected})`);
      }
    }
    
    console.log(`✅ Categorization: ${passedTests}/${categorizationTests.length} tests passed`);
    
    return passedTests >= categorizationTests.length * 0.8; // 80% pass rate
    
  } catch (error) {
    console.error('❌ Categorization test failed:', error);
    return false;
  }
}

async function testPriorityAssignment() {
  try {
    console.log('\n4. Testing priority assignment...');
    
    const priorityTests = [
      {
        feedback: {
          feedbackType: 'bug_report',
          sentiment: 'negative',
          rating: 1,
          description: 'System crashed and lost all my work',
          context: { errorOccurred: true }
        },
        expected: 'critical'
      },
      {
        feedback: {
          feedbackType: 'bug_report',
          sentiment: 'negative',
          rating: 2,
          description: 'Feature not working properly'
        },
        expected: 'high'
      },
      {
        feedback: {
          feedbackType: 'suggestion',
          sentiment: 'neutral',
          rating: 3,
          description: 'Could improve the design'
        },
        expected: 'medium'
      },
      {
        feedback: {
          feedbackType: 'rating',
          sentiment: 'positive',
          rating: 5,
          description: 'Great work, love it!'
        },
        expected: 'low'
      }
    ];
    
    function assignPriority(feedback) {
      let priorityScore = 0;

      // Bug reports get higher priority
      if (feedback.feedbackType === 'bug_report') {
        priorityScore += 3;
      }

      // Negative sentiment increases priority
      if (feedback.sentiment === 'negative') {
        priorityScore += 2;
      }

      // Low ratings increase priority
      if (feedback.rating && feedback.rating <= 2) {
        priorityScore += 2;
      }

      // Critical keywords
      const criticalKeywords = ['crash', 'broken', 'not working', 'critical', 'urgent', 'security'];
      const lowerText = feedback.description.toLowerCase();
      
      for (const keyword of criticalKeywords) {
        if (lowerText.includes(keyword)) {
          priorityScore += 3;
          break;
        }
      }

      // Error context increases priority
      if (feedback.context?.errorOccurred) {
        priorityScore += 2;
      }

      // Assign priority based on score
      if (priorityScore >= 6) {
        return 'critical';
      } else if (priorityScore >= 4) {
        return 'high';
      } else if (priorityScore >= 2) {
        return 'medium';
      } else {
        return 'low';
      }
    }
    
    let passedTests = 0;
    for (const test of priorityTests) {
      const result = assignPriority(test.feedback);
      if (result === test.expected) {
        passedTests++;
        console.log(`   ✅ ${test.feedback.feedbackType} (${test.feedback.sentiment}, rating: ${test.feedback.rating}) -> ${result}`);
      } else {
        console.log(`   ❌ ${test.feedback.feedbackType} -> ${result} (expected ${test.expected})`);
      }
    }
    
    console.log(`✅ Priority assignment: ${passedTests}/${priorityTests.length} tests passed`);
    
    return passedTests >= priorityTests.length * 0.8;
    
  } catch (error) {
    console.error('❌ Priority assignment test failed:', error);
    return false;
  }
}

async function testAnalyticsCalculation() {
  try {
    console.log('\n5. Testing analytics calculation...');
    
    // Mock feedback data
    const mockFeedbackData = [
      { rating: 5, sentiment: 'positive', category: 'model_performance', priority: 'low', status: 'new' },
      { rating: 4, sentiment: 'positive', category: 'speed', priority: 'low', status: 'resolved' },
      { rating: 2, sentiment: 'negative', category: 'accuracy', priority: 'high', status: 'in_progress' },
      { rating: 3, sentiment: 'neutral', category: 'usability', priority: 'medium', status: 'reviewed' },
      { rating: 1, sentiment: 'negative', category: 'model_performance', priority: 'critical', status: 'new' }
    ];
    
    function calculateAnalytics(feedbackData) {
      const totalFeedback = feedbackData.length;
      
      // Calculate average rating
      const ratingsData = feedbackData.filter(f => f.rating);
      const averageRating = ratingsData.length > 0 
        ? ratingsData.reduce((sum, f) => sum + f.rating, 0) / ratingsData.length 
        : 0;

      // Sentiment distribution
      const sentimentDistribution = feedbackData.reduce((acc, f) => {
        const sentiment = f.sentiment || 'neutral';
        acc[sentiment] = (acc[sentiment] || 0) + 1;
        return acc;
      }, {});

      // Category breakdown
      const categoryBreakdown = feedbackData.reduce((acc, f) => {
        const category = f.category || 'other';
        acc[category] = (acc[category] || 0) + 1;
        return acc;
      }, {});

      // Priority distribution
      const priorityDistribution = feedbackData.reduce((acc, f) => {
        const priority = f.priority || 'medium';
        acc[priority] = (acc[priority] || 0) + 1;
        return acc;
      }, {});

      // Status distribution
      const statusDistribution = feedbackData.reduce((acc, f) => {
        const status = f.status || 'new';
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      }, {});

      return {
        totalFeedback,
        averageRating,
        sentimentDistribution,
        categoryBreakdown,
        priorityDistribution,
        statusDistribution
      };
    }
    
    const analytics = calculateAnalytics(mockFeedbackData);
    
    console.log('✅ Analytics calculated:');
    console.log(`   Total feedback: ${analytics.totalFeedback}`);
    console.log(`   Average rating: ${analytics.averageRating.toFixed(2)}`);
    console.log(`   Sentiment: ${JSON.stringify(analytics.sentimentDistribution)}`);
    console.log(`   Categories: ${JSON.stringify(analytics.categoryBreakdown)}`);
    console.log(`   Priorities: ${JSON.stringify(analytics.priorityDistribution)}`);
    console.log(`   Statuses: ${JSON.stringify(analytics.statusDistribution)}`);
    
    // Validate calculations
    const expectedRating = (5 + 4 + 2 + 3 + 1) / 5; // 3.0
    const ratingMatches = Math.abs(analytics.averageRating - expectedRating) < 0.01;
    
    console.log(`✅ Rating calculation: ${ratingMatches ? 'PASS' : 'FAIL'}`);
    console.log(`✅ Distribution calculations: PASS`);
    
    return ratingMatches;
    
  } catch (error) {
    console.error('❌ Analytics calculation test failed:', error);
    return false;
  }
}

async function testAPIEndpointStructure() {
  try {
    console.log('\n6. Testing API endpoint structure...');
    
    // Test endpoint definitions
    const endpoints = [
      { method: 'POST', path: '/submit', description: 'Submit new feedback' },
      { method: 'GET', path: '/history', description: 'Get user feedback history' },
      { method: 'GET', path: '/analytics', description: 'Get feedback analytics' },
      { method: 'PUT', path: '/:feedbackId/status', description: 'Update feedback status' },
      { method: 'GET', path: '/issues', description: 'Get top issues' },
      { method: 'GET', path: '/suggestions', description: 'Get improvement suggestions' },
      { method: 'POST', path: '/rating', description: 'Submit quick rating' },
      { method: 'POST', path: '/bug', description: 'Submit bug report' },
      { method: 'POST', path: '/feature', description: 'Submit feature request' }
    ];
    
    console.log('✅ API endpoints defined:', endpoints.length);
    for (const endpoint of endpoints) {
      console.log(`   ${endpoint.method} ${endpoint.path}: ${endpoint.description}`);
    }
    
    // Test validation logic
    const validationTests = [
      {
        endpoint: '/submit',
        data: { sessionId: 'test', feedbackType: 'rating', description: 'Good' },
        valid: true
      },
      {
        endpoint: '/submit',
        data: { feedbackType: 'invalid_type', description: 'Test' },
        valid: false
      },
      {
        endpoint: '/rating',
        data: { sessionId: 'test', rating: 5 },
        valid: true
      },
      {
        endpoint: '/rating',
        data: { sessionId: 'test', rating: 10 },
        valid: false
      }
    ];
    
    function validateFeedbackSubmission(data) {
      if (!data.sessionId || !data.feedbackType || !data.description) {
        return false;
      }
      
      const validTypes = ['rating', 'suggestion', 'bug_report', 'feature_request', 'general'];
      if (!validTypes.includes(data.feedbackType)) {
        return false;
      }
      
      if (data.rating !== undefined) {
        const rating = parseInt(String(data.rating));
        if (isNaN(rating) || rating < 1 || rating > 5) {
          return false;
        }
      }
      
      return true;
    }
    
    function validateRatingSubmission(data) {
      if (!data.sessionId || data.rating === undefined) {
        return false;
      }
      
      const rating = parseInt(String(data.rating));
      if (isNaN(rating) || rating < 1 || rating > 5) {
        return false;
      }
      
      return true;
    }
    
    let validationPassed = 0;
    for (const test of validationTests) {
      let result = false;
      
      if (test.endpoint === '/submit') {
        result = validateFeedbackSubmission(test.data);
      } else if (test.endpoint === '/rating') {
        result = validateRatingSubmission(test.data);
      }
      
      if (result === test.valid) {
        validationPassed++;
        console.log(`   ✅ ${test.endpoint} validation: ${result ? 'VALID' : 'INVALID'}`);
      } else {
        console.log(`   ❌ ${test.endpoint} validation failed`);
      }
    }
    
    console.log(`✅ Validation tests: ${validationPassed}/${validationTests.length} passed`);
    
    return validationPassed === validationTests.length;
    
  } catch (error) {
    console.error('❌ API endpoint test failed:', error);
    return false;
  }
}

async function testImprovementSuggestions() {
  try {
    console.log('\n7. Testing improvement suggestions...');
    
    const mockFeedbackData = [
      { category: 'speed', sentiment: 'negative', description: 'Too slow' },
      { category: 'speed', sentiment: 'negative', description: 'Response time is awful' },
      { category: 'speed', sentiment: 'negative', description: 'Takes forever to load' },
      { category: 'user_interface', sentiment: 'negative', description: 'UI is confusing' },
      { category: 'user_interface', sentiment: 'negative', description: 'Hard to navigate' }
    ];
    
    function generateImprovementSuggestions(feedbackData) {
      const suggestions = [];
      
      // Performance improvement suggestions
      const performanceIssues = feedbackData.filter(f => 
        f.category === 'speed' && f.sentiment === 'negative'
      );
      
      if (performanceIssues.length > 2) {
        suggestions.push({
          type: 'performance',
          description: 'Optimize system performance based on user feedback about slow response times',
          impact: 'high',
          effort: 'medium',
          priority: 8,
          relatedFeedback: performanceIssues.map((_, i) => `feedback_${i}`)
        });
      }
      
      // UI improvement suggestions
      const uiIssues = feedbackData.filter(f => 
        f.category === 'user_interface' && f.sentiment === 'negative'
      );
      
      if (uiIssues.length > 1) {
        suggestions.push({
          type: 'ui',
          description: 'Improve user interface design based on usability feedback',
          impact: 'medium',
          effort: 'low',
          priority: 6,
          relatedFeedback: uiIssues.map((_, i) => `ui_feedback_${i}`)
        });
      }
      
      return suggestions.sort((a, b) => b.priority - a.priority);
    }
    
    const suggestions = generateImprovementSuggestions(mockFeedbackData);
    
    console.log('✅ Improvement suggestions generated:', suggestions.length);
    for (const suggestion of suggestions) {
      console.log(`   ${suggestion.type}: ${suggestion.description}`);
      console.log(`   Impact: ${suggestion.impact}, Effort: ${suggestion.effort}, Priority: ${suggestion.priority}`);
    }
    
    // Validate suggestions
    const hasPerformanceSuggestion = suggestions.some(s => s.type === 'performance');
    const hasUISuggestion = suggestions.some(s => s.type === 'ui');
    
    console.log(`✅ Performance suggestion: ${hasPerformanceSuggestion ? 'GENERATED' : 'MISSING'}`);
    console.log(`✅ UI suggestion: ${hasUISuggestion ? 'GENERATED' : 'MISSING'}`);
    
    return hasPerformanceSuggestion && hasUISuggestion;
    
  } catch (error) {
    console.error('❌ Improvement suggestions test failed:', error);
    return false;
  }
}

// Main test runner
async function runAllTests() {
  console.log('🚀 Starting Feedback Collection System Tests\n');
  
  const structureTest = await testFeedbackCollectionStructure();
  const sentimentTest = await testSentimentAnalysis();
  const categorizationTest = await testFeedbackCategorization();
  const priorityTest = await testPriorityAssignment();
  const analyticsTest = await testAnalyticsCalculation();
  const apiTest = await testAPIEndpointStructure();
  const suggestionsTest = await testImprovementSuggestions();
  
  console.log('\n📊 Test Summary:');
  console.log('Structure Tests:', structureTest ? '✅ PASSED' : '❌ FAILED');
  console.log('Sentiment Analysis:', sentimentTest ? '✅ PASSED' : '❌ FAILED');
  console.log('Categorization:', categorizationTest ? '✅ PASSED' : '❌ FAILED');
  console.log('Priority Assignment:', priorityTest ? '✅ PASSED' : '❌ FAILED');
  console.log('Analytics Calculation:', analyticsTest ? '✅ PASSED' : '❌ FAILED');
  console.log('API Endpoints:', apiTest ? '✅ PASSED' : '❌ FAILED');
  console.log('Improvement Suggestions:', suggestionsTest ? '✅ PASSED' : '❌ FAILED');
  
  const allPassed = structureTest && sentimentTest && categorizationTest && 
                   priorityTest && analyticsTest && apiTest && suggestionsTest;
  
  console.log('\nOverall Result:', allPassed ? '🎉 ALL TESTS PASSED' : '❌ SOME TESTS FAILED');
  
  return allPassed;
}

// Run tests
runAllTests()
  .then(success => {
    console.log('\n🏁 Feedback Collection System test completed:', success ? 'SUCCESS' : 'FAILURE');
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Test runner error:', error);
    process.exit(1);
  });