#!/usr/bin/env python3
"""
Fix Weaviate vectorizer configuration to disable OpenAI dependency
"""


import requests


def fix_weaviate_vectorizer():
    """Update Memory class to disable vectorization"""

    weaviate_url = "http://localhost:8090"

    # Delete the existing Memory class
    try:
        response = requests.delete(f"{weaviate_url}/v1/schema/Memory")
        if response.status_code in [200, 404]:  # 404 means class doesn't exist
            print("✅ Memory class deleted (or didn't exist)")
        else:
            print(f"❌ Failed to delete Memory class: {response.status_code}")
            print(f"Response: {response.text}")
            return False
    except Exception as e:
        print(f"❌ Error deleting Memory class: {e}")
        return False

    # Create new Memory class without vectorization
    memory_schema = {
        "class": "Memory",
        "description": "Memory storage for the Universal AI Tools platform",
        "vectorizer": "none",  # Disable vectorization
        "properties": [
            {
                "name": "user_id",
                "dataType": ["string"],
                "description": "User identifier"
            },
            {
                "name": "type",
                "dataType": ["string"],
                "description": "Memory type (conversation, knowledge, experience)"
            },
            {
                "name": "content",
                "dataType": ["text"],
                "description": "Memory content"
            },
            {
                "name": "metadata",
                "dataType": ["text"],
                "description": "Additional metadata as JSON string"
            },
            {
                "name": "tags",
                "dataType": ["string[]"],
                "description": "Memory tags"
            },
            {
                "name": "created_at",
                "dataType": ["date"],
                "description": "Creation timestamp"
            },
            {
                "name": "updated_at",
                "dataType": ["date"],
                "description": "Last update timestamp"
            },
            {
                "name": "access_count",
                "dataType": ["int"],
                "description": "Number of times accessed"
            },
            {
                "name": "last_access",
                "dataType": ["date"],
                "description": "Last access timestamp"
            }
        ]
    }

    # Create the class
    try:
        response = requests.post(
            f"{weaviate_url}/v1/schema",
            headers={"Content-Type": "application/json"},
            json=memory_schema
        )

        if response.status_code == 200:
            print("✅ Memory class recreated without vectorization")
            return True
        else:
            print(f"❌ Failed to recreate Memory class: {response.status_code}")
            print(f"Response: {response.text}")
            return False

    except Exception as e:
        print(f"❌ Error recreating Memory class: {e}")
        return False

if __name__ == "__main__":
    print("🔧 Fixing Weaviate vectorizer configuration...")
    success = fix_weaviate_vectorizer()
    if success:
        print("🎉 Weaviate vectorizer fix complete!")
    else:
        print("💥 Weaviate vectorizer fix failed!")
