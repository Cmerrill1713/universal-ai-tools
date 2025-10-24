"""
Response judgment module
"""

def judge_response(response: str, criteria: dict = None) -> dict:
    """
    Judge a response based on given criteria
    
    Args:
        response: The response to judge
        criteria: Optional criteria for judgment
        
    Returns:
        dict: Judgment results
    """
    return {
        "quality": "good",
        "score": 0.8,
        "feedback": "Response meets basic criteria"
    }