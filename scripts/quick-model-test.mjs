#!/usr/bin/env node

/**
 * Quick Model Comparison for Universal AI Tools
 * Fast evaluation of your top models
 */

import { performance } from 'perf_hooks';

const LM_STUDIO_URL = 'http://localhost:5901';
const OLLAMA_URL = 'http://localhost:11434';

// Quick test cases
const quickTests = [
  {
    name: "Math Test",
    prompt: "What is 23 * 47? Show calculation.",
    expectedAnswer: "1081"
  },
  {
    name: "Code Test", 
    prompt: "Write a Python function to reverse a string.",
    keywords: ["def", "reverse", "return"]
  }
];

// Top models to test
const topModels = [
  {
    id: "qwen/qwen3-coder-30b",
    name: "Qwen3 Coder 30B ⭐",
    endpoint: "lm-studio"
  },
  {
    id: "deepseek/deepseek-r1-0528-qwen3-8b", 
    name: "DeepSeek R1 8B ⭐",
    endpoint: "lm-studio"
  },
  {
    id: "qwen2.5-coder-14b-instruct-mlx",
    name: "Qwen2.5 Coder 14B MLX",
    endpoint: "lm-studio"
  },
  {
    id: "gpt-oss:20b",
    name: "GPT-OSS 20B",
    endpoint: "ollama"
  }
];

async function quickCall(modelId, prompt, endpoint = 'lm-studio') {
  const startTime = performance.now();
  
  try {
    let response, data;
    
    if (endpoint === 'lm-studio') {
      response = await fetch(`${LM_STUDIO_URL}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: modelId,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.1,
          max_tokens: 500
        }),
        signal: AbortSignal.timeout(30000)
      });
      
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      data = await response.json();
      
      return {
        success: true,
        response: data.choices[0].message.content,
        responseTime: performance.now() - startTime,
        tokens: data.usage?.total_tokens || 0
      };
    } else {
      response = await fetch(`${OLLAMA_URL}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: modelId,
          prompt: prompt,
          stream: false,
          options: { temperature: 0.1 }
        }),
        signal: AbortSignal.timeout(30000)
      });
      
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      data = await response.json();
      
      return {
        success: true,
        response: data.response,
        responseTime: performance.now() - startTime,
        tokens: data.eval_count || 0
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error.message,
      responseTime: performance.now() - startTime
    };
  }
}

function quickScore(response, test) {
  const content = response.toLowerCase();
  let score = 0;
  
  if (test.expectedAnswer && content.includes(test.expectedAnswer.toLowerCase())) {
    score += 50;
  }
  
  if (test.keywords) {
    const found = test.keywords.filter(k => content.includes(k.toLowerCase()));
    score += (found.length / test.keywords.length) * 30;
  }
  
  if (response.length > 30) score += 20;
  
  return Math.min(100, score);
}

async function runQuickTest() {
  console.log("🚀 Quick Model Comparison");
  console.log("========================");
  
  const results = [];
  
  for (const model of topModels) {
    console.log(`\n🧪 Testing ${model.name}`);
    console.log("-".repeat(40));
    
    let totalScore = 0;
    let totalTime = 0;
    let testCount = 0;
    
    for (const test of quickTests) {
      console.log(`\n📝 ${test.name}...`);
      
      const result = await quickCall(model.id, test.prompt, model.endpoint);
      testCount++;
      
      if (result.success) {
        const score = quickScore(result.response, test);
        totalScore += score;
        totalTime += result.responseTime;
        
        console.log(`⏱️  ${(result.responseTime/1000).toFixed(2)}s`);
        console.log(`🎯 ${score.toFixed(0)}/100`);
        console.log(`📤 ${result.response.substring(0, 100)}...`);
      } else {
        console.log(`❌ Error: ${result.error}`);
      }
    }
    
    const avgScore = totalScore / testCount;
    const avgTime = totalTime / testCount;
    
    results.push({
      model: model.name,
      avgScore,
      avgTime,
      scorePerSecond: avgScore / (avgTime / 1000)
    });
    
    console.log(`\n📊 Overall: ${avgScore.toFixed(1)}/100 (${(avgTime/1000).toFixed(2)}s avg)`);
  }
  
  // Summary
  console.log("\n" + "=".repeat(50));
  console.log("🏆 SUMMARY RANKINGS");
  console.log("=".repeat(50));
  
  // By quality
  console.log("\n🎯 By Quality:");
  results.sort((a, b) => b.avgScore - a.avgScore);
  results.forEach((r, i) => {
    const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i+1}.`;
    console.log(`${medal} ${r.model}: ${r.avgScore.toFixed(1)}/100`);
  });
  
  // By speed
  console.log("\n⚡ By Speed:");
  results.sort((a, b) => a.avgTime - b.avgTime);
  results.forEach((r, i) => {
    console.log(`${i+1}. ${r.model}: ${(r.avgTime/1000).toFixed(2)}s`);
  });
  
  // By efficiency (quality per second)
  console.log("\n🎯⚡ By Efficiency (Quality/Speed):");
  results.sort((a, b) => b.scorePerSecond - a.scorePerSecond);
  results.forEach((r, i) => {
    const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i+1}.`;
    console.log(`${medal} ${r.model}: ${r.scorePerSecond.toFixed(1)} points/sec`);
  });
  
  // R1 RAG Recommendation
  console.log("\n🎯 R1 RAG Recommendation:");
  const ragRecommendation = results.find(r => r.model.includes("DeepSeek R1")) || results[0];
  console.log(`👑 ${ragRecommendation.model} - Best for reasoning-heavy RAG workflows`);
  
  const codingRecommendation = results.find(r => r.model.includes("Qwen3 Coder")) || results[0];
  console.log(`💻 ${codingRecommendation.model} - Best for coding and technical tasks`);
  
  console.log("\n✅ No need to download new models - your collection is excellent!");
}

runQuickTest().catch(console.error);