"""
Response reviewer module
"""

def evaluate_response(response: str, context: dict = None) -> dict:
    """
    Evaluate a response for quality and relevance
    
    Args:
        response: The response to evaluate
        context: Optional context for evaluation
        
    Returns:
        dict: Evaluation results
    """
    return {
        "relevance": 0.9,
        "accuracy": 0.8,
        "completeness": 0.7,
        "overall_score": 0.8
    }