#!/usr/bin/env python3
"""
Chat Optimizer - Intelligent system prompts, context management, and response tuning
"""

import logging
from datetime import datetime
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


class ChatOptimizer:
    """Optimizes chat quality through system prompts, context, and response tuning"""

    def __init__(self):
        self.conversation_history: Dict[str, List[Dict]] = {}  # Fallback in-memory cache
        self.max_history_length = 10
        self.storage = None  # Will be initialized async
        self.use_persistent_storage = True
        self.prompt_engineer = None  # Will be initialized async
        self.use_agentic_prompts = True  # Enable agentic prompt generation

    async def build_system_prompt_agentic(self, context: Optional[Dict[str, Any]] = None) -> str:
        """
        Build optimized system prompt using agentic prompt engineering
        
        Args:
            context: Dict with enabled features (memory_enabled, vision_enabled, etc.)
        
        Returns:
            AI-generated optimized system prompt string
        """
        if self.use_agentic_prompts and self.prompt_engineer:
            try:
                # Determine task type from context
                task_type = "chat"  # default
                if context and context.get("coding_mode"):
                    task_type = "coding"
                elif context and context.get("research_mode"):
                    task_type = "research"

                # Generate optimized prompt via agentic system
                prompt = await self.prompt_engineer.generate_system_prompt(
                    task_type=task_type,
                    context=context
                )

                if prompt:
                    logger.info(f"✨ Using agentic-generated prompt ({len(prompt)} chars)")
                    return prompt

            except Exception as e:
                logger.warning(f"Agentic prompt generation failed: {e}, using template")

        # Fallback to template
        return self.build_system_prompt(context)

    def build_system_prompt(self, context: Optional[Dict[str, Any]] = None) -> str:
        """
        Build optimized system prompt based on enabled features (template fallback)
        
        Args:
            context: Dict with enabled features (memory_enabled, vision_enabled, etc.)
        
        Returns:
            Optimized system prompt string
        """
        context = context or {}

        # Base personality
        prompt = """You are Athena, an advanced AI assistant with multiple capabilities.

Your personality:
- Helpful, concise, and accurate
- Technical but approachable
- Proactive in suggesting tools/features
- Honest about limitations
- Named after the Greek goddess of wisdom

"""

        # Add capabilities based on context
        capabilities = []

        if context.get("memory_enabled"):
            capabilities.append("📝 **Memory**: You remember our conversation history and can reference previous topics.")

        if context.get("vision_enabled"):
            capabilities.append("👁️ **Vision**: You can analyze images when the user shares them.")

        if context.get("voice_enabled"):
            capabilities.append("🔊 **Voice**: Your responses will be spoken aloud.")

        if context.get("macos_control_enabled"):
            capabilities.append("🖥️ **macOS Control**: You can open apps, take screenshots, control system settings.")

        if context.get("web_search_enabled"):
            capabilities.append("🌐 **Web Search**: You can search the internet and browse websites for current information.")

        if context.get("evolution_enabled"):
            capabilities.append("🔄 **Learning**: You learn from feedback to improve over time.")

        if capabilities:
            prompt += "**Your active capabilities:**\n" + "\n".join(capabilities) + "\n\n"

        # Response guidelines
        prompt += """**Response guidelines:**
1. Be concise but complete - aim for 2-3 sentences unless detail is needed
2. Use tools proactively - if a task needs macOS/browser automation, just do it
3. If you use a tool, briefly mention what you did
4. For factual questions, be precise
5. For creative tasks, be engaging
6. Always acknowledge errors honestly

"""

        # Voice-specific tuning
        if context.get("voice_enabled"):
            prompt += """**Voice mode active:**
- Keep responses natural and conversational
- Avoid excessive formatting (bullets, markdown)
- Use shorter sentences for clarity when spoken
- Mention visual actions ("I'm opening...", "I found...")

"""

        return prompt.strip()

    async def add_conversation_context(
        self,
        user_id: str,
        message: str,
        response: str,
        thread_id: Optional[str] = None,
        metadata: Optional[Dict] = None,
        model_used: Optional[str] = None,
        processing_time: Optional[float] = None
    ) -> None:
        """Add message to conversation history - saves to Postgres"""
        # Use thread_id or user_id as thread identifier
        thread_id = thread_id or f"user_{user_id}"

        # Try persistent storage first
        if self.use_persistent_storage and self.storage:
            try:
                # Ensure thread exists
                await self.storage.create_thread(user_id, thread_id)

                # Add user message
                await self.storage.add_message(
                    thread_id=thread_id,
                    role="user",
                    content=message,
                    metadata=metadata
                )

                # Add assistant response
                await self.storage.add_message(
                    thread_id=thread_id,
                    role="assistant",
                    content=response,
                    metadata=metadata,
                    model_used=model_used,
                    processing_time=processing_time
                )

                logger.debug(f"💾 Saved conversation to Postgres: thread={thread_id}")
                return

            except Exception as e:
                logger.warning(f"Failed to save to persistent storage, using fallback: {e}")

        # Fallback to in-memory storage
        if user_id not in self.conversation_history:
            self.conversation_history[user_id] = []

        self.conversation_history[user_id].append({
            "timestamp": datetime.now().isoformat(),
            "user": message,
            "assistant": response
        })

        # Keep only recent history
        if len(self.conversation_history[user_id]) > self.max_history_length:
            self.conversation_history[user_id] = self.conversation_history[user_id][-self.max_history_length:]

    async def get_conversation_context(
        self,
        user_id: str,
        max_messages: int = 5,
        thread_id: Optional[str] = None
    ) -> List[Dict]:
        """Get recent conversation history for context - from Postgres if available"""
        thread_id = thread_id or f"user_{user_id}"

        # Try persistent storage first
        if self.use_persistent_storage and self.storage:
            try:
                messages = await self.storage.get_thread_history(thread_id, limit=max_messages)
                if messages:
                    return messages
            except Exception as e:
                logger.warning(f"Failed to load from persistent storage: {e}")

        # Fallback to in-memory
        if user_id not in self.conversation_history:
            return []

        return self.conversation_history[user_id][-max_messages:]

    async def format_context_for_prompt(self, user_id: str, thread_id: Optional[str] = None) -> str:
        """Format conversation history into a context string"""
        history = await self.get_conversation_context(user_id, thread_id=thread_id)
        if not history:
            return ""

        context_str = "\n**Recent conversation:**\n"
        for entry in history:
            if isinstance(entry, dict) and "role" in entry:
                # From Postgres
                role_emoji = "👤" if entry["role"] == "user" else "🤖"
                context_str += f"{role_emoji} {entry['role'].capitalize()}: {entry['content'][:100]}\n"
            else:
                # From in-memory
                context_str += f"User: {entry.get('user', '')[:100]}\n"
                context_str += f"You: {entry.get('assistant', '')[:100]}\n"

        return context_str

    def optimize_model_selection(self, message: str, context: Optional[Dict] = None) -> str:
        """
        Select best model based on task complexity
        
        Args:
            message: User's message
            context: Additional context
        
        Returns:
            Model name to use
        """
        message_lower = message.lower()

        # Complex tasks -> Better model
        complex_keywords = [
            "analyze", "explain", "compare", "research", "design",
            "architecture", "algorithm", "optimize", "debug"
        ]

        if any(kw in message_lower for kw in complex_keywords):
            # Use larger model for complex tasks
            return "llama3.2:3b"  # Could upgrade to llama3:8b or mixtral

        # Code tasks -> Code-specialized model
        code_keywords = ["code", "function", "class", "debug", "refactor", "implement"]
        if any(kw in message_lower for kw in code_keywords):
            return "llama3.2:3b"  # Could use codellama

        # Math/logic -> Keep light
        if any(c.isdigit() for c in message) and any(op in message for op in ['+', '-', '*', '/', 'times', 'plus']):
            return "llama3.2:3b"  # Fast is fine for math

        # Default to fast model
        return "llama3.2:3b"

    def tune_response(
        self,
        response: str,
        context: Optional[Dict] = None,
        tool_result: Optional[Dict] = None
    ) -> str:
        """
        Post-process and tune the AI response
        
        Args:
            response: Raw AI response
            context: Request context
            tool_result: Result from tool execution if any
        
        Returns:
            Tuned response
        """
        context = context or {}

        # If tool was used, ensure it's mentioned
        if tool_result and tool_result.get("success"):
            tool_name = tool_result.get("tool", "tool")
            if tool_name not in response.lower():
                tool_msg = tool_result.get("message", "")
                if tool_msg:
                    response = f"{tool_msg}\n\n{response}"

        # Voice mode tuning
        if context.get("voice_enabled"):
            # Remove excessive markdown
            response = response.replace("**", "")
            response = response.replace("##", "")
            # Simplify bullets
            response = response.replace("- ", "\n")

        # Truncate if too long and voice is enabled
        if context.get("voice_enabled") and len(response) > 500:
            sentences = response.split(". ")
            if len(sentences) > 3:
                response = ". ".join(sentences[:3]) + "."

        return response.strip()

    async def initialize_storage(self):
        """Initialize persistent storage and prompt engineer"""
        # Initialize conversation storage
        try:
            from src.core.chat.conversation_storage import get_conversation_storage
            self.storage = await get_conversation_storage()
            logger.info("✅ Chat optimizer using Postgres for persistence")
        except Exception as e:
            logger.warning(f"Postgres storage unavailable, using in-memory fallback: {e}")
            self.use_persistent_storage = False

        # Initialize prompt engineer
        try:
            from src.core.chat.prompt_engineer import get_prompt_engineer
            self.prompt_engineer = get_prompt_engineer()
            logger.info("✅ Agentic prompt engineering enabled")
        except Exception as e:
            logger.warning(f"Prompt engineer unavailable: {e}")
            self.use_agentic_prompts = False

        return True

    async def get_performance_stats(self) -> Dict[str, Any]:
        """Get optimizer performance statistics"""
        # Try to get from persistent storage
        if self.use_persistent_storage and self.storage:
            try:
                db_stats = await self.storage.get_stats()
                if db_stats:
                    return {
                        **db_stats,
                        "in_memory_users": len(self.conversation_history),
                        "storage_mode": "postgres_primary"
                    }
            except Exception as e:
                logger.warning(f"Failed to get DB stats: {e}")

        # Fallback to in-memory stats
        total_conversations = len(self.conversation_history)
        total_messages = sum(len(history) for history in self.conversation_history.values())

        return {
            "total_users": total_conversations,
            "total_messages": total_messages,
            "avg_messages_per_user": total_messages / max(total_conversations, 1),
            "storage_mode": "in_memory_only",
            "memory_usage": f"{len(self.conversation_history)} users tracked"
        }


# Global instance
_optimizer = None

async def get_chat_optimizer() -> ChatOptimizer:
    """Get global chat optimizer instance"""
    global _optimizer
    if _optimizer is None:
        _optimizer = ChatOptimizer()
        await _optimizer.initialize_storage()
    return _optimizer

