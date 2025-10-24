# Athena Prompt Engineering Guide

## Overview
Athena uses a two-tier prompt engineering system:
1. **Agentic Generation** - AI-powered prompt optimization (primary)
2. **Template Fallback** - Hand-crafted prompts (backup)

## Current Architecture

### System Components

#### 1. PromptEngineer (`src/core/chat/prompt_engineer.py`)
- **Purpose**: Auto-generates optimized prompts using God Tier Agentic System
- **Features**:
  - Task-specific prompt generation (chat, coding, research, creative)
  - Context-aware adaptation
  - Prompt caching for performance
  - Feedback-based refinement
  - Performance analysis

#### 2. ChatOptimizer (`src/core/chat/chat_optimizer.py`)
- **Purpose**: Manages system prompts and conversation context
- **Features**:
  - Template-based prompt generation (fallback)
  - Feature-based capability listing
  - Voice mode optimization
  - Conversation history management

## Base Prompt Template

### Current Template
```
You are Athena, an advanced AI assistant with multiple capabilities.

Your personality:
- Helpful, concise, and accurate
- Technical but approachable
- Proactive in suggesting tools/features
- Honest about limitations
- Named after the Greek goddess of wisdom

[Dynamic capabilities based on enabled features]

Response guidelines:
1. Be concise but complete - aim for 2-3 sentences unless detail is needed
2. Use tools proactively - if a task needs macOS/browser automation, just do it
3. If you use a tool, briefly mention what you did
4. For factual questions, be precise
5. For creative tasks, be engaging
6. Always acknowledge errors honestly

[Voice mode tuning if enabled]
```

## Prompt Improvement Strategies

### 1. Enhanced Personality Traits
Consider adding:
- **Wisdom & Strategy**: As Athena, embody strategic thinking
- **Empowerment**: Help users become more capable
- **Contextual Intelligence**: Adapt tone based on task complexity
- **Curiosity**: Ask clarifying questions when needed

Example addition:
```
Your core values:
- Strategic thinking: Consider long-term impact and connections
- User empowerment: Teach, don't just do
- Contextual intelligence: Match complexity to user expertise
- Proactive problem-solving: Anticipate needs and obstacles
```

### 2. Feature-Specific Enhancements

#### Memory-Enabled
```
📝 Memory: I remember our conversation history across sessions.
- I can reference previous discussions
- I track your preferences and working style
- I build context over time to serve you better
```

#### Vision-Enabled
```
👁️ Vision: I can analyze images, screenshots, and diagrams.
- Describe what you see
- Extract text from images (OCR)
- Identify objects, patterns, UI elements
- Compare visual differences
```

#### macOS Control
```
🖥️ macOS Control: I can control your Mac directly.
- Open/close applications
- Take screenshots
- Execute terminal commands
- Manage files and folders
- Control system settings
```

### 3. Voice Mode Optimization

Current voice guidelines are good. Consider adding:
```
Voice mode active:
- Natural conversation flow - speak as you would to a colleague
- Avoid excessive formatting
- Use "I'm" and "let me" for actions in progress
- Confirm completion: "Done!" or "All set"
- Ask for clarification if unclear
- Shorter responses unless depth is requested
```

### 4. Task-Specific Prompts

The agentic system supports task types:

#### Coding Tasks
```
Coding Mode Active:
- Provide complete, working code
- Explain architectural decisions
- Follow language-specific best practices
- Include error handling
- Test coverage considerations
```

#### Research Tasks
```
Research Mode Active:
- Cite sources when available
- Distinguish facts from analysis
- Present multiple perspectives
- Acknowledge uncertainty
- Provide actionable insights
```

#### Creative Tasks
```
Creative Mode Active:
- Embrace experimentation
- Offer multiple approaches
- Build on ideas iteratively
- Balance practicality with innovation
```

## Agentic Prompt Generation

### How It Works
1. `ChatOptimizer` checks if agentic mode is enabled
2. Calls `PromptEngineer.generate_system_prompt()`
3. PromptEngineer queries God Tier Agentic System (port 3033)
4. Generated prompt is cached for reuse
5. Falls back to template if agentic generation fails

### Enabling Agentic Mode
```python
# In chat_optimizer.py
self.use_agentic_prompts = True  # Already enabled

# In prompt_engineer.py
self.use_agentic_generation = True  # Already enabled
```

### Customizing Agentic Requests
Edit the prompt engineering task in `_generate_with_agents()`:
```python
engineering_task = f"""
You are a System Prompt Engineer. Generate an optimized system prompt for an AI assistant.

**Task Type**: {task_type}
**Context**: {context}
**User Preferences**: {preferences}

Requirements:
1. Define AI's personality and capabilities
2. List active features
3. Provide clear response guidelines
4. Be concise but comprehensive (200-400 words)
5. Include examples if relevant
6. Adapt tone based on modality (voice vs text)

Generate the optimal system prompt now:
"""
```

## Feedback Loop

### Refining Prompts from User Feedback
```python
# After collecting user feedback
refined_prompt = await prompt_engineer.refine_prompt_from_feedback(
    original_prompt=current_prompt,
    feedback="Users want more concise responses",
    conversation_history=recent_messages
)
```

### Analyzing Prompt Performance
```python
analysis = await prompt_engineer.analyze_prompt_performance(
    prompt=current_prompt,
    conversation_sample=sample_conversations,
    metrics={
        "avg_response_time": 2.5,
        "user_satisfaction": 4.2,
        "task_completion_rate": 0.85
    }
)
```

## Best Practices

### 1. Clarity Over Brevity
- Be explicit about capabilities
- Define expected behavior clearly
- Provide concrete examples when helpful

### 2. Context Matters
- Adapt prompts based on enabled features
- Consider user's technical level
- Match tone to interaction mode (voice vs text)

### 3. Maintain Consistency
- Core personality should remain stable
- Features should enhance, not change character
- Guidelines should be actionable

### 4. Test and Iterate
- Monitor user satisfaction
- Track task completion rates
- Refine based on real usage patterns

### 5. Version Control
- Track prompt changes
- Document why changes were made
- A/B test significant modifications

## Advanced Techniques

### 1. Multi-Agent Prompt Generation
```python
# Use different agents for different aspects
personality_agent = await agentic_system.query("personality_designer")
capability_agent = await agentic_system.query("feature_documenter")
guideline_agent = await agentic_system.query("behavior_architect")

# Combine outputs
final_prompt = merge_agent_outputs(...)
```

### 2. Dynamic Prompt Adaptation
```python
# Adapt based on conversation flow
if user_frustrated:
    add_empathy_component()
if technical_task:
    add_precision_component()
if creative_task:
    add_openness_component()
```

### 3. Prompt A/B Testing
```python
# Test different prompts with similar users
variant_a = generate_prompt(strategy="concise")
variant_b = generate_prompt(strategy="detailed")

# Track metrics and compare
performance_a = track_metrics(variant_a)
performance_b = track_metrics(variant_b)
```

## Monitoring and Metrics

### Key Metrics to Track
1. **User Satisfaction**: Thumbs up/down ratings
2. **Task Completion**: Did Athena solve the user's problem?
3. **Response Quality**: Accuracy, relevance, helpfulness
4. **Conversation Length**: Are responses too long/short?
5. **Feature Utilization**: Are capabilities being used effectively?

### Logging Prompt Performance
```python
await optimizer.log_prompt_metrics(
    prompt_version="1.2.0",
    metrics={
        "avg_rating": 4.5,
        "completion_rate": 0.87,
        "avg_response_length": 150,
        "feature_usage": {
            "memory": 0.65,
            "vision": 0.23,
            "macos_control": 0.42
        }
    }
)
```

## Quick Improvements You Can Make Now

### 1. Enhance Base Personality
Edit `src/core/chat/chat_optimizer.py` line 72-80 to add:
- Strategic thinking emphasis
- Learning orientation
- User empowerment focus

### 2. Add Task Context Detection
Detect task type from user input:
- Coding: mentions of "code", "function", "debug"
- Research: "research", "find information", "compare"
- Creative: "design", "create", "brainstorm"

### 3. Improve Feature Descriptions
Make capability descriptions more actionable in lines 86-102

### 4. Add Conversation State
Track conversation state (exploratory, problem-solving, execution) and adapt prompts

### 5. Enable Prompt Versioning
Add version tracking to prompts for better monitoring and rollback

## Resources

- **God Tier Agentic System**: `http://localhost:3033`
- **Prompt Engineer**: `src/core/chat/prompt_engineer.py`
- **Chat Optimizer**: `src/core/chat/chat_optimizer.py`
- **Conversation Storage**: `src/core/chat/conversation_storage.py`

## Next Steps

1. ✅ Review current prompt effectiveness
2. 📊 Set up prompt performance monitoring
3. 🧪 Test agentic generation vs templates
4. 🔄 Implement feedback loop
5. 📈 Establish baseline metrics
6. 🎯 Define target improvements
7. 🚀 Deploy refined prompts incrementally

