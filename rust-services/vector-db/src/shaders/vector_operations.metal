#include <metal_stdlib>
using namespace metal;

// Compute cosine similarity between query vector and candidate vectors
kernel void cosine_similarity(
    device const float* query [[buffer(0)]],
    device const float* candidates [[buffer(1)]],
    device float* results [[buffer(2)]],
    device const uint* dimensions [[buffer(3)]],
    uint index [[thread_position_in_grid]]
) {
    const uint dim = *dimensions;
    const uint candidate_offset = index * dim;
    
    float dot_product = 0.0;
    float query_norm = 0.0;
    float candidate_norm = 0.0;
    
    // Compute dot product and norms in parallel
    for (uint i = 0; i < dim; ++i) {
        const float q_val = query[i];
        const float c_val = candidates[candidate_offset + i];
        
        dot_product += q_val * c_val;
        query_norm += q_val * q_val;
        candidate_norm += c_val * c_val;
    }
    
    // Compute cosine similarity
    const float norm_product = sqrt(query_norm) * sqrt(candidate_norm);
    results[index] = (norm_product > 0.0) ? (dot_product / norm_product) : 0.0;
}

// Compute Euclidean distance between query vector and candidate vectors
kernel void euclidean_distance(
    device const float* query [[buffer(0)]],
    device const float* candidates [[buffer(1)]],
    device float* results [[buffer(2)]],
    device const uint* dimensions [[buffer(3)]],
    uint index [[thread_position_in_grid]]
) {
    const uint dim = *dimensions;
    const uint candidate_offset = index * dim;
    
    float sum_squared_diff = 0.0;
    
    // Compute sum of squared differences
    for (uint i = 0; i < dim; ++i) {
        const float diff = query[i] - candidates[candidate_offset + i];
        sum_squared_diff += diff * diff;
    }
    
    // Convert distance to similarity (smaller distance = higher similarity)
    const float distance = sqrt(sum_squared_diff);
    results[index] = 1.0 / (1.0 + distance);
}

// Compute dot product between query vector and candidate vectors
kernel void dot_product(
    device const float* query [[buffer(0)]],
    device const float* candidates [[buffer(1)]],
    device float* results [[buffer(2)]],
    device const uint* dimensions [[buffer(3)]],
    uint index [[thread_position_in_grid]]
) {
    const uint dim = *dimensions;
    const uint candidate_offset = index * dim;
    
    float dot_result = 0.0;
    
    // Compute dot product
    for (uint i = 0; i < dim; ++i) {
        dot_result += query[i] * candidates[candidate_offset + i];
    }
    
    results[index] = dot_result;
}

// Normalize vectors in-place
kernel void vector_normalize(
    device float* vectors [[buffer(0)]],
    device const uint* dimensions [[buffer(1)]],
    uint index [[thread_position_in_grid]]
) {
    const uint dim = *dimensions;
    const uint vector_offset = index * dim;
    
    // Compute vector norm
    float norm_squared = 0.0;
    for (uint i = 0; i < dim; ++i) {
        const float val = vectors[vector_offset + i];
        norm_squared += val * val;
    }
    
    const float norm = sqrt(norm_squared);
    
    // Normalize if norm is not zero
    if (norm > 0.0) {
        const float inv_norm = 1.0 / norm;
        for (uint i = 0; i < dim; ++i) {
            vectors[vector_offset + i] *= inv_norm;
        }
    }
}

// Advanced kernel: Batch cosine similarity with SIMD optimization
kernel void batch_cosine_similarity(
    device const float* queries [[buffer(0)]],
    device const float* candidates [[buffer(1)]],
    device float* results [[buffer(2)]],
    device const uint* dimensions [[buffer(3)]],
    device const uint* num_queries [[buffer(4)]],
    device const uint* num_candidates [[buffer(5)]],
    uint2 index [[thread_position_in_grid]]
) {
    const uint dim = *dimensions;
    const uint query_idx = index.x;
    const uint candidate_idx = index.y;
    
    if (query_idx >= *num_queries || candidate_idx >= *num_candidates) {
        return;
    }
    
    const uint query_offset = query_idx * dim;
    const uint candidate_offset = candidate_idx * dim;
    const uint result_offset = query_idx * (*num_candidates) + candidate_idx;
    
    float dot_product = 0.0;
    float query_norm = 0.0;
    float candidate_norm = 0.0;
    
    // Use SIMD instructions for better performance
    for (uint i = 0; i < dim; i += 4) {
        const uint remaining = min(4u, dim - i);
        
        float4 q_vals = float4(0.0);
        float4 c_vals = float4(0.0);
        
        for (uint j = 0; j < remaining; ++j) {
            q_vals[j] = queries[query_offset + i + j];
            c_vals[j] = candidates[candidate_offset + i + j];
        }
        
        dot_product += dot(q_vals, c_vals);
        query_norm += dot(q_vals, q_vals);
        candidate_norm += dot(c_vals, c_vals);
    }
    
    const float norm_product = sqrt(query_norm) * sqrt(candidate_norm);
    results[result_offset] = (norm_product > 0.0) ? (dot_product / norm_product) : 0.0;
}

// K-nearest neighbors search kernel
kernel void knn_search(
    device const float* query [[buffer(0)]],
    device const float* candidates [[buffer(1)]],
    device float* similarities [[buffer(2)]],
    device uint* indices [[buffer(3)]],
    device const uint* dimensions [[buffer(4)]],
    device const uint* k [[buffer(5)]],
    uint index [[thread_position_in_grid]]
) {
    const uint dim = *dimensions;
    const uint candidate_offset = index * dim;
    
    // Compute cosine similarity
    float dot_product = 0.0;
    float query_norm = 0.0;
    float candidate_norm = 0.0;
    
    for (uint i = 0; i < dim; ++i) {
        const float q_val = query[i];
        const float c_val = candidates[candidate_offset + i];
        
        dot_product += q_val * c_val;
        query_norm += q_val * q_val;
        candidate_norm += c_val * c_val;
    }
    
    const float norm_product = sqrt(query_norm) * sqrt(candidate_norm);
    const float similarity = (norm_product > 0.0) ? (dot_product / norm_product) : 0.0;
    
    similarities[index] = similarity;
    indices[index] = index;
}

// Matrix multiplication for batch operations
kernel void matrix_multiply(
    device const float* matrix_a [[buffer(0)]],
    device const float* matrix_b [[buffer(1)]],
    device float* result [[buffer(2)]],
    device const uint* rows_a [[buffer(3)]],
    device const uint* cols_a [[buffer(4)]],
    device const uint* cols_b [[buffer(5)]],
    uint2 index [[thread_position_in_grid]]
) {
    const uint row = index.x;
    const uint col = index.y;
    
    if (row >= *rows_a || col >= *cols_b) {
        return;
    }
    
    float sum = 0.0;
    for (uint k = 0; k < *cols_a; ++k) {
        sum += matrix_a[row * (*cols_a) + k] * matrix_b[k * (*cols_b) + col];
    }
    
    result[row * (*cols_b) + col] = sum;
}

// Optimized vector addition for large batches
kernel void vector_add(
    device const float* vector_a [[buffer(0)]],
    device const float* vector_b [[buffer(1)]],
    device float* result [[buffer(2)]],
    device const uint* length [[buffer(3)]],
    uint index [[thread_position_in_grid]]
) {
    if (index >= *length) {
        return;
    }
    
    result[index] = vector_a[index] + vector_b[index];
}

// Optimized vector scaling
kernel void vector_scale(
    device const float* vector [[buffer(0)]],
    device float* result [[buffer(1)]],
    device const float* scale [[buffer(2)]],
    device const uint* length [[buffer(3)]],
    uint index [[thread_position_in_grid]]
) {
    if (index >= *length) {
        return;
    }
    
    result[index] = vector[index] * (*scale);
}

// Locality Sensitive Hashing computation
kernel void lsh_hash(
    device const float* vectors [[buffer(0)]],
    device const float* random_planes [[buffer(1)]],
    device uint* hash_values [[buffer(2)]],
    device const uint* dimensions [[buffer(3)]],
    device const uint* num_planes [[buffer(4)]],
    uint index [[thread_position_in_grid]]
) {
    const uint dim = *dimensions;
    const uint planes = *num_planes;
    const uint vector_offset = index * dim;
    
    uint hash_result = 0;
    
    for (uint plane = 0; plane < planes; ++plane) {
        float dot = 0.0;
        
        for (uint d = 0; d < dim; ++d) {
            dot += vectors[vector_offset + d] * random_planes[plane * dim + d];
        }
        
        if (dot > 0.0) {
            hash_result |= (1u << plane);
        }
    }
    
    hash_values[index] = hash_result;
}