#!/usr/bin/env python3
"""
Setup Weaviate schema for Memory Service
"""

import requests
import json

def setup_weaviate_schema():
    """Create the Memory class schema in Weaviate"""
    
    weaviate_url = "http://localhost:8090"
    
    # Check if Weaviate is running
    try:
        response = requests.get(f"{weaviate_url}/v1/meta")
        if response.status_code != 200:
            print("❌ Weaviate is not running or not accessible")
            return False
        print("✅ Weaviate is running")
    except Exception as e:
        print(f"❌ Cannot connect to Weaviate: {e}")
        return False
    
    # Check if Memory class already exists
    try:
        response = requests.get(f"{weaviate_url}/v1/schema")
        if response.status_code == 200:
            schema = response.json()
            for class_info in schema.get("classes", []):
                if class_info.get("class") == "Memory":
                    print("✅ Memory class already exists")
                    return True
    except Exception as e:
        print(f"❌ Error checking schema: {e}")
        return False
    
    # Create Memory class schema
    memory_schema = {
        "class": "Memory",
        "description": "Memory storage for the Universal AI Tools platform",
        "vectorizer": "none",  # Disable vectorization to avoid OpenAI API key requirement
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
                "dataType": ["object"],
                "description": "Additional metadata"
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
            print("✅ Memory class created successfully")
            return True
        else:
            print(f"❌ Failed to create Memory class: {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Error creating Memory class: {e}")
        return False

if __name__ == "__main__":
    print("🔧 Setting up Weaviate schema for Memory Service...")
    success = setup_weaviate_schema()
    if success:
        print("🎉 Weaviate schema setup complete!")
    else:
        print("💥 Weaviate schema setup failed!")
