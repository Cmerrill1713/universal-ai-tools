#ifndef RUST_GO_BRIDGE_H
#define RUST_GO_BRIDGE_H

#include <stdint.h>
#include <stdbool.h>

#ifdef __cplusplus
extern "C" {
#endif

// Memory management functions
typedef struct {
    uint8_t* data;
    size_t len;
    size_t capacity;
} GoSlice;

typedef struct {
    const char* data;
    size_t len;
} RustGoString;

// Shared memory operations
bool rust_init_shared_memory(const char* name, size_t size);
bool rust_write_shared_memory(const char* name, const uint8_t* data, size_t len);
GoSlice rust_read_shared_memory(const char* name, size_t offset, size_t len);
bool rust_close_shared_memory(const char* name);

// Memory pool operations
bool rust_create_memory_pool(const char* name, size_t block_size, size_t num_blocks);
GoSlice rust_allocate_from_pool(const char* name);
bool rust_deallocate_to_pool(const char* name, GoSlice block);
bool rust_destroy_memory_pool(const char* name);

// Utility functions
void rust_free_slice(GoSlice slice);
const char* rust_get_last_error(void);
void rust_clear_error(void);

#ifdef __cplusplus
}
#endif

#endif // RUST_GO_BRIDGE_H
