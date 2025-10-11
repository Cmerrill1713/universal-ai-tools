#!/usr/bin/env python3
"""
Prompt Engineer - Auto-generates optimized prompts using the agentic system
Integrates with the God Tier Agentic Platform for advanced prompt engineering
"""

import logging
import httpx
from typing import Dict, Any, Optional
from datetime import datetime
import json

logger = logging.getLogger(__name__)


class PromptEngineer:
    """Automatically generates and optimizes system prompts using AI agents"""
    
    def __init__(self):
        self.agentic_url = "http://localhost:8014"  # Unified Evolutionary API
        self.prompt_cache: Dict[str, str] = {}
        self.use_agentic_generation = True
        
    async def generate_system_prompt(
        self,
        task_type: str,
        context: Optional[Dict[str, Any]] = None,
        user_preferences: Optional[Dict] = None
    ) -> str:
        """
        Generate an optimized system prompt using the agentic platform
        
        Args:
            task_type: Type of task (chat, coding, research, creative)
            context: Current context and enabled features
            user_preferences: User-specific preferences
            
        Returns:
            Optimized system prompt
        """
        context = context or {}
        user_preferences = user_preferences or {}
        
        # Create cache key
        cache_key = f"{task_type}_{json.dumps(context, sort_keys=True)}"
        
        # Check cache first
        if cache_key in self.prompt_cache:
            logger.debug(f"Using cached prompt for {task_type}")
            return self.prompt_cache[cache_key]
        
        # Try agentic generation
        if self.use_agentic_generation:
            try:
                prompt = await self._generate_with_agents(task_type, context, user_preferences)
                if prompt:
                    self.prompt_cache[cache_key] = prompt
                    return prompt
            except Exception as e:
                logger.warning(f"Agentic prompt generation failed: {e}, using fallback")
        
        # Fallback to template-based generation
        return self._generate_from_template(task_type, context)
    
    async def _generate_with_agents(
        self,
        task_type: str,
        context: Dict,
        preferences: Dict
    ) -> Optional[str]:
        """Use the agentic platform to generate optimized prompts"""
        
        # Create prompt engineering request
        engineering_task = f"""
        You are a System Prompt Engineer. Generate an optimized system prompt for an AI assistant.
        
        **Task Type**: {task_type}
        
        **Context**:
        {json.dumps(context, indent=2)}
        
        **User Preferences**:
        {json.dumps(preferences, indent=2)}
        
        **Requirements**:
        1. The prompt should clearly define the AI's personality and capabilities
        2. List active features based on context (memory, voice, vision, macOS control, etc.)
        3. Provide clear response guidelines
        4. Be concise but comprehensive
        5. Include examples if relevant
        6. Adapt tone based on modality (voice vs text)
        
        **Format**:
        Return ONLY the system prompt text, no explanations or meta-commentary.
        The prompt should be 200-400 words.
        
        Generate the optimal system prompt now:
        """
        
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                # Call the agentic platform
                response = await client.post(
                    f"{self.agentic_url}/smart",
                    json={
                        "messages": [
                            {"role": "user", "content": engineering_task}
                        ],
                        "context": context
                    }
                )
                
                if response.status_code == 200:
                    data = response.json()
                    generated_prompt = data.get("response", "").strip()
                    
                    if generated_prompt and len(generated_prompt) > 50:
                        logger.info(f"✨ Generated prompt via agentic platform ({len(generated_prompt)} chars)")
                        return generated_prompt
                        
        except Exception as e:
            logger.error(f"Agentic generation error: {e}")
            
        return None
    
    def _generate_from_template(
        self,
        task_type: str,
        context: Dict
    ) -> str:
        """Fallback: Generate prompt from template"""
        
        # Base prompt
        prompt = f"You are Athena, an advanced AI assistant"
        
        # Add task-specific personality
        if task_type == "coding":
            prompt += " specialized in software development and technical problem-solving"
        elif task_type == "research":
            prompt += " with expertise in research, analysis, and information synthesis"
        elif task_type == "creative":
            prompt += " with strong creative and ideation capabilities"
        else:
            prompt += " with multiple capabilities"
        
        prompt += ".\n\n**Your personality:**\n- Helpful, concise, and accurate\n- Technical but approachable\n- Proactive in suggesting tools\n\n"
        
        # Add capabilities based on context
        capabilities = []
        if context.get("memory_enabled"):
            capabilities.append("📝 **Memory**: You remember conversation history")
        if context.get("vision_enabled"):
            capabilities.append("👁️ **Vision**: You can analyze images")
        if context.get("voice_enabled"):
            capabilities.append("🔊 **Voice**: Responses will be spoken aloud")
        if context.get("macos_control_enabled"):
            capabilities.append("🖥️ **macOS Control**: You can control system functions")
        if context.get("web_search_enabled"):
            capabilities.append("🌐 **Web Search**: You can search the internet")
        
        if capabilities:
            prompt += "**Active capabilities:**\n" + "\n".join(capabilities) + "\n\n"
        
        prompt += "**Response guidelines:**\n"
        prompt += "1. Be concise (2-3 sentences unless detail needed)\n"
        prompt += "2. Use tools proactively\n"
        prompt += "3. Acknowledge errors honestly\n"
        
        return prompt
    
    async def refine_prompt_from_feedback(
        self,
        original_prompt: str,
        feedback: str,
        conversation_history: Optional[list] = None
    ) -> str:
        """
        Refine a prompt based on user feedback or performance metrics
        
        Args:
            original_prompt: The current system prompt
            feedback: User feedback or performance issues
            conversation_history: Recent conversations for context
            
        Returns:
            Refined system prompt
        """
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                refinement_task = f"""
                Improve this system prompt based on feedback:
                
                **Current Prompt**:
                {original_prompt}
                
                **Feedback**:
                {feedback}
                
                **Recent Conversations** (for context):
                {json.dumps(conversation_history[:3] if conversation_history else [], indent=2)}
                
                Generate an improved version that addresses the feedback while maintaining the core functionality.
                Return ONLY the improved prompt text.
                """
                
                response = await client.post(
                    f"{self.agentic_url}/smart",
                    json={"messages": [{"role": "user", "content": refinement_task}]}
                )
                
                if response.status_code == 200:
                    data = response.json()
                    refined = data.get("response", "").strip()
                    if refined and len(refined) > 50:
                        logger.info(f"✨ Refined prompt based on feedback")
                        return refined
                        
        except Exception as e:
            logger.error(f"Prompt refinement error: {e}")
        
        return original_prompt
    
    async def analyze_prompt_performance(
        self,
        prompt: str,
        conversation_sample: list,
        metrics: Dict[str, float]
    ) -> Dict[str, Any]:
        """
        Analyze how well a prompt is performing
        
        Args:
            prompt: The system prompt being analyzed
            conversation_sample: Sample conversations using this prompt
            metrics: Performance metrics (latency, user satisfaction, etc.)
            
        Returns:
            Analysis results with improvement suggestions
        """
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                analysis_task = f"""
                Analyze this system prompt's performance:
                
                **Prompt**:
                {prompt}
                
                **Sample Conversations**:
                {json.dumps(conversation_sample[:5], indent=2)}
                
                **Metrics**:
                {json.dumps(metrics, indent=2)}
                
                Provide:
                1. Overall effectiveness score (0-10)
                2. Strengths
                3. Weaknesses
                4. Specific improvement suggestions
                
                Format as JSON.
                """
                
                response = await client.post(
                    f"{self.agentic_url}/smart",
                    json={"messages": [{"role": "user", "content": analysis_task}]}
                )
                
                if response.status_code == 200:
                    data = response.json()
                    analysis_text = data.get("response", "")
                    
                    # Try to parse as JSON
                    try:
                        return json.loads(analysis_text)
                    except:
                        return {"raw_analysis": analysis_text}
                        
        except Exception as e:
            logger.error(f"Performance analysis error: {e}")
            
        return {"error": "Analysis failed"}


# Global instance
_engineer: Optional[PromptEngineer] = None

def get_prompt_engineer() -> PromptEngineer:
    """Get global prompt engineer instance"""
    global _engineer
    if _engineer is None:
        _engineer = PromptEngineer()
    return _engineer

