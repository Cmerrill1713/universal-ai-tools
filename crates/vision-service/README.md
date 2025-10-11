# Vision Service

A comprehensive computer vision service providing image analysis, OCR, and image generation capabilities.

## Features

- **Image Analysis**: Detailed image description and analysis
- **OCR Processing**: Text extraction from images
- **Image Generation**: AI-powered image creation
- **Upload Support**: File upload and processing
- **Async Processing**: Non-blocking image processing

## Endpoints

- `GET /health` - Service health check
- `POST /vision/analyze` - Analyze image content
- `POST /vision/upload` - Upload and analyze image
- `GET /vision/result/:id` - Get processing result by ID
- `POST /vision/ocr` - Extract text from image
- `POST /vision/generate` - Generate image from prompt

## Configuration

Set the following environment variables:

- `PORT` - Service port (default: 8084)
- `MAX_FILE_SIZE` - Maximum upload file size (default: 10MB)
- `SUPPORTED_FORMATS` - Supported image formats (default: jpg,png,gif)

## Usage

```bash
# Start the service
cargo run -p vision-service

# Health check
curl http://localhost:8084/health

# Analyze image
curl -X POST http://localhost:8084/vision/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "image": "base64_encoded_image_data",
    "prompt": "Describe this image in detail",
    "model": "default"
  }'

# Extract text (OCR)
curl -X POST http://localhost:8084/vision/ocr \
  -H "Content-Type: application/json" \
  -d '{
    "image": "base64_encoded_image_data",
    "language": "en"
  }'
```

## Request Formats

### Image Analysis

```json
{
  "image": "base64_string",
  "prompt": "string",
  "model": "string"
}
```

### OCR

```json
{
  "image": "base64_string",
  "language": "string"
}
```

### Image Generation

```json
{
  "prompt": "string",
  "width": 512,
  "height": 512,
  "style": "string"
}
```

## Response Formats

### Analysis Result

```json
{
  "description": "string",
  "confidence": 0.95,
  "processing_time_ms": 1500,
  "tags": ["tag1", "tag2"]
}
```

### OCR Result

```json
{
  "text": "extracted text",
  "confidence": 0.98,
  "language": "en",
  "regions": []
}
```

## Development

```bash
# Run tests
cargo test -p vision-service

# Run with debug logging
RUST_LOG=debug cargo run -p vision-service
```
