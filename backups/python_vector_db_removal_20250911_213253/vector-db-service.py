#!/usr/bin/env python3
"""
Vector Database Service - Python-based Vector Database
Provides Weaviate-like functionality for semantic search and vector operations
"""

import hashlib
import logging
import os
import uuid
from datetime import datetime
from typing import Dict, List

import numpy as np
from flask import Flask, jsonify, request
from flask_cors import CORS
from sklearn.metrics.pairwise import cosine_similarity, euclidean_distances

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('vector-db-service')

# Initialize Flask app
app = Flask(__name__)
CORS(app)


class VectorIndex:
    """Simple in-memory vector index"""

    def __init__(self, dimension: int, metric: str = "cosine"):
        self.dimension = dimension
        self.metric = metric
        self.vectors: Dict[str, Dict] = {}
        self.logger = logging.getLogger(f"{__name__}.VectorIndex")

    def add(self, id: str, vector: List[float], metadata: Dict = None):
        """Add a vector to the index"""
        if len(vector) != self.dimension:
            raise ValueError(
                f"Vector dimension mismatch: expected {
                    self.dimension}, got {
                    len(vector)}")

        self.vectors[id] = {
            'vector': np.array(vector),
            'metadata': metadata or {},
            'timestamp': datetime.now().isoformat()
        }

    def search(
            self,
            query_vector: List[float],
            k: int = 10,
            filter_metadata: Dict = None) -> List[Dict]:
        """Search for similar vectors"""
        if len(query_vector) != self.dimension:
            raise ValueError(
                f"Query dimension mismatch: expected {
                    self.dimension}, got {
                    len(query_vector)}")

        if not self.vectors:
            return []

        query = np.array(query_vector).reshape(1, -1)
        results = []

        for id, data in self.vectors.items():
            # Apply metadata filter
            if filter_metadata:
                if not self._matches_filter(data['metadata'], filter_metadata):
                    continue

            vector = data['vector'].reshape(1, -1)

            # Calculate similarity/distance
            if self.metric == "cosine":
                similarity = cosine_similarity(query, vector)[0][0]
                score = float(similarity)
            elif self.metric == "euclidean":
                distance = euclidean_distances(query, vector)[0][0]
                score = float(distance)
            else:
                similarity = cosine_similarity(query, vector)[0][0]
                score = float(similarity)

            results.append({
                'id': id,
                'score': score,
                'metadata': data['metadata']
            })

        # Sort by score (higher for cosine, lower for euclidean)
        if self.metric == "euclidean":
            results.sort(key=lambda x: x['score'])
        else:
            results.sort(key=lambda x: x['score'], reverse=True)

        return results[:k]

    def delete(self, id: str) -> bool:
        """Delete a vector from the index"""
        if id in self.vectors:
            del self.vectors[id]
            return True
        return False

    def size(self) -> int:
        """Get the number of vectors in the index"""
        return len(self.vectors)

    def clear(self):
        """Clear all vectors from the index"""
        self.vectors.clear()

    def _matches_filter(
            self,
            item_metadata: Dict,
            filter_metadata: Dict) -> bool:
        """Check if item metadata matches filter criteria"""
        for key, value in filter_metadata.items():
            if key not in item_metadata or item_metadata[key] != value:
                return False
        return True


class MockEmbeddingModel:
    """Mock embedding model for testing"""

    def __init__(self, dimension: int = 768):
        self.dimension = dimension

    def embed(self, text: str) -> List[float]:
        """Generate mock embeddings from text"""
        # Simple hash-based deterministic embeddings
        hash_obj = hashlib.md5(text.encode())
        hash_int = int(hash_obj.hexdigest(), 16)

        # Generate pseudo-random but deterministic vector
        np.random.seed(hash_int % 2**32)
        vector = np.random.normal(0, 1, self.dimension)

        # Normalize
        vector = vector / np.linalg.norm(vector)

        return vector.tolist()


class VectorDatabase:
    """Main vector database class"""

    def __init__(self):
        self.collections: Dict[str, Dict] = {}
        self.embedding_model = MockEmbeddingModel()
        self.logger = logging.getLogger(f"{__name__}.VectorDatabase")

    def create_collection(
            self,
            name: str,
            dimension: int,
            metric: str = "cosine") -> Dict:
        """Create a new collection"""
        if name in self.collections:
            raise ValueError(f"Collection '{name}' already exists")

        collection_id = str(uuid.uuid4())
        index = VectorIndex(dimension, metric)

        collection = {
            'id': collection_id,
            'name': name,
            'dimension': dimension,
            'metric': metric,
            'index': index,
            'size': 0,
            'created_at': datetime.now().isoformat(),
            'updated_at': datetime.now().isoformat()
        }

        self.collections[collection_id] = collection
        self.logger.info(
            f"Created collection '{name}' with ID {collection_id}")

        # Return only serializable data, exclude the VectorIndex
        return {
            'id': collection_id,
            'name': name,
            'dimension': dimension,
            'metric': metric,
            'size': 0,
            'created_at': collection['created_at'],
            'updated_at': collection['updated_at']
        }

    def get_collection(self, collection_id: str) -> Dict:
        """Get collection by ID"""
        if collection_id not in self.collections:
            raise ValueError(f"Collection '{collection_id}' not found")

        collection = self.collections[collection_id]
        # Return only serializable data, exclude the VectorIndex
        return {
            'id': collection['id'],
            'name': collection['name'],
            'dimension': collection['dimension'],
            'metric': collection['metric'],
            'size': collection['index'].size(),
            'created_at': collection['created_at'],
            'updated_at': collection['updated_at']
        }

    def list_collections(self) -> List[Dict]:
        """List all collections"""
        result = []
        for collection in self.collections.values():
            result.append({
                'id': collection['id'],
                'name': collection['name'],
                'dimension': collection['dimension'],
                'metric': collection['metric'],
                'size': collection['index'].size(),
                'created_at': collection['created_at'],
                'updated_at': collection['updated_at']
            })
        return result

    def embed_text(self, text: str, model: str = None) -> Dict:
        """Generate embeddings for text"""
        embedding = self.embedding_model.embed(text)
        return {
            'embedding': embedding,
            'model': model or 'mock-embedding-v1',
            'dimension': len(embedding)
        }

    def embed_batch(self, texts: List[str], model: str = None) -> Dict:
        """Generate embeddings for multiple texts"""
        embeddings = [self.embedding_model.embed(text) for text in texts]
        return {
            'embeddings': embeddings,
            'model': model or 'mock-embedding-v1',
            'dimension': len(embeddings[0]) if embeddings else 0
        }


# Global database instance
db = VectorDatabase()

# Default collection
try:
    db.create_collection("default", 768, "cosine")
except ValueError:
    pass  # Collection already exists


@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        "status": "healthy",
        "service": "vector-db-service",
        "timestamp": datetime.now().timestamp(),
        "collections_count": len(db.collections)
    })


@app.route('/collections', methods=['GET'])
def list_collections():
    """List all collections"""
    try:
        collections = db.list_collections()
        return jsonify({
            "success": True,
            "message": "Collections retrieved successfully",
            "data": collections
        })
    except Exception as e:
        logger.error(f"List collections error: {str(e)}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


@app.route('/collections', methods=['POST'])
def create_collection():
    """Create a new collection"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({
                "success": False,
                "error": "No data provided"
            }), 400

        name = data.get('name')
        dimension = data.get('dimension', 768)
        metric = data.get('metric', 'cosine')

        if not name:
            return jsonify({
                "success": False,
                "error": "Collection name is required"
            }), 400

        collection = db.create_collection(name, dimension, metric)
        return jsonify({
            "success": True,
            "message": "Collection created successfully",
            "data": collection
        })
    except ValueError as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 400
    except Exception as e:
        logger.error(f"Create collection error: {str(e)}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


@app.route('/collections/<collection_id>', methods=['GET'])
def get_collection(collection_id):
    """Get collection details"""
    try:
        collection = db.get_collection(collection_id)
        return jsonify({
            "success": True,
            "message": "Collection retrieved successfully",
            "data": collection
        })
    except ValueError as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 404
    except Exception as e:
        logger.error(f"Get collection error: {str(e)}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


@app.route('/collections/<collection_id>/vectors', methods=['POST'])
def add_vector(collection_id):
    """Add a vector to a collection"""
    try:
        collection = db.get_collection(collection_id)
        data = request.get_json()

        if not data:
            return jsonify({
                "success": False,
                "error": "No data provided"
            }), 400

        vector = data.get('vector')
        metadata = data.get('metadata', {})
        vector_id = data.get('id', str(uuid.uuid4()))

        if not vector:
            return jsonify({
                "success": False,
                "error": "Vector data is required"
            }), 400

        collection['index'].add(vector_id, vector, metadata)
        collection['size'] = collection['index'].size()
        collection['updated_at'] = datetime.now().isoformat()

        return jsonify({
            "success": True,
            "message": "Vector added successfully",
            "data": {
                "id": vector_id,
                "collection_id": collection_id
            }
        })
    except ValueError as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 400
    except Exception as e:
        logger.error(f"Add vector error: {str(e)}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


@app.route('/collections/<collection_id>/search', methods=['POST'])
def search_vectors(collection_id):
    """Search for similar vectors"""
    try:
        collection = db.get_collection(collection_id)
        data = request.get_json()

        if not data:
            return jsonify({
                "success": False,
                "error": "No data provided"
            }), 400

        query_vector = data.get('vector')
        k = data.get('k', 10)
        filter_metadata = data.get('filter')

        if not query_vector:
            return jsonify({
                "success": False,
                "error": "Query vector is required"
            }), 400

        results = collection['index'].search(query_vector, k, filter_metadata)

        return jsonify({
            "success": True,
            "message": "Search completed successfully",
            "data": results
        })
    except ValueError as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 400
    except Exception as e:
        logger.error(f"Search vectors error: {str(e)}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


@app.route('/collections/<collection_id>/vectors/<vector_id>',
           methods=['DELETE'])
def delete_vector(collection_id, vector_id):
    """Delete a vector from a collection"""
    try:
        collection = db.get_collection(collection_id)
        deleted = collection['index'].delete(vector_id)

        if deleted:
            collection['size'] = collection['index'].size()
            collection['updated_at'] = datetime.now().isoformat()

        return jsonify({
            "success": True,
            "message": "Vector deletion attempted",
            "data": {
                "deleted": deleted
            }
        })
    except ValueError as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 404
    except Exception as e:
        logger.error(f"Delete vector error: {str(e)}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


@app.route('/embed', methods=['POST'])
def embed_text():
    """Generate embeddings for text"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({
                "success": False,
                "error": "No data provided"
            }), 400

        text = data.get('text')
        model = data.get('model')

        if not text:
            return jsonify({
                "success": False,
                "error": "Text is required"
            }), 400

        result = db.embed_text(text, model)
        return jsonify({
            "success": True,
            "message": "Text embedded successfully",
            "data": result
        })
    except Exception as e:
        logger.error(f"Embed text error: {str(e)}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


@app.route('/embed/batch', methods=['POST'])
def embed_batch():
    """Generate embeddings for multiple texts"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({
                "success": False,
                "error": "No data provided"
            }), 400

        texts = data.get('texts', [])
        model = data.get('model')

        if not texts:
            return jsonify({
                "success": False,
                "error": "Texts array is required"
            }), 400

        result = db.embed_batch(texts, model)
        return jsonify({
            "success": True,
            "message": "Batch embedding completed successfully",
            "data": result
        })
    except Exception as e:
        logger.error(f"Batch embed error: {str(e)}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


@app.errorhandler(404)
def not_found(error):
    return jsonify({
        "success": False,
        "error": "Endpoint not found"
    }), 404


@app.errorhandler(500)
def internal_error(error):
    logger.error(f"Internal server error: {str(error)}")
    return jsonify({
        "success": False,
        "error": "Internal server error"
    }), 500


if __name__ == "__main__":
    port = int(os.environ.get('VECTOR_DB_PORT', '3035'))
    host = os.environ.get('VECTOR_DB_HOST', '0.0.0.0')

    logger.info(f"Starting Vector Database Service on {host}:{port}")

    app.run(
        host=host,
        port=port,
        debug=False,
        threaded=True
    )
