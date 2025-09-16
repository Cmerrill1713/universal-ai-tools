#!/bin/bash

# Generate gRPC code for Go and Rust from proto definitions

set -e

PROTO_DIR="./proto"
GO_OUT_DIR="./go-services/grpc/pb"
RUST_OUT_DIR="./rust-services/grpc/src"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Generating gRPC code from proto definitions...${NC}"

# Check if protoc is installed
if ! command -v protoc &> /dev/null; then
    echo -e "${RED}protoc is not installed. Please install protocol buffers compiler.${NC}"
    echo "On macOS: brew install protobuf"
    echo "On Ubuntu: apt-get install protobuf-compiler"
    exit 1
fi

# Check if Go protoc plugins are installed
if ! command -v protoc-gen-go &> /dev/null; then
    echo -e "${YELLOW}Installing Go protoc plugins...${NC}"
    go install google.golang.org/protobuf/cmd/protoc-gen-go@latest
    go install google.golang.org/grpc/cmd/protoc-gen-go-grpc@latest
fi

# Create output directories
mkdir -p "$GO_OUT_DIR"
mkdir -p "$RUST_OUT_DIR"

# Generate Go code
echo -e "${GREEN}Generating Go code...${NC}"
protoc \
    --go_out="$GO_OUT_DIR" \
    --go_opt=paths=source_relative \
    --go-grpc_out="$GO_OUT_DIR" \
    --go-grpc_opt=paths=source_relative \
    -I "$PROTO_DIR" \
    "$PROTO_DIR"/*.proto

# Generate Rust code (requires tonic-build)
echo -e "${GREEN}Generating Rust code...${NC}"
if [ -f "./rust-services/grpc/build.rs" ]; then
    cd ./rust-services/grpc
    cargo build --release
    cd ../..
else
    echo -e "${YELLOW}Creating Rust gRPC project...${NC}"
    mkdir -p ./rust-services/grpc
    cat > ./rust-services/grpc/Cargo.toml << 'EOF'
[package]
name = "grpc-services"
version = "0.1.0"
edition = "2021"

[dependencies]
tonic = "0.10"
prost = "0.12"
tokio = { version = "1.35", features = ["full"] }
tokio-stream = "0.1"
futures = "0.3"
tower = "0.4"
hyper = "0.14"
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
tracing = "0.1"
tracing-subscriber = "0.3"
anyhow = "1.0"

[build-dependencies]
tonic-build = "0.10"

[[bin]]
name = "grpc-server"
path = "src/main.rs"
EOF

    cat > ./rust-services/grpc/build.rs << 'EOF'
fn main() -> Result<(), Box<dyn std::error::Error>> {
    tonic_build::configure()
        .build_server(true)
        .build_client(true)
        .compile(&["../../proto/services.proto"], &["../../proto"])?;
    Ok(())
}
EOF

    cd ./rust-services/grpc
    cargo build --release
    cd ../..
fi

echo -e "${GREEN}✓ gRPC code generation complete!${NC}"
echo -e "${GREEN}  Go output: $GO_OUT_DIR${NC}"
echo -e "${GREEN}  Rust output: $RUST_OUT_DIR${NC}"