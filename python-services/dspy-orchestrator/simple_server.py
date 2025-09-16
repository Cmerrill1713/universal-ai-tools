#!/usr/bin/env python3
"""
Simple DSPy Server for Testing
"""

import asyncio
import json
from datetime import datetime

import websockets


async def handle_client(websocket, path):
    """Handle WebSocket client connections"""
    print(f"Client connected: {websocket.remote_address}")

    try:
        async for message in websocket:
            try:
                request = json.loads(message)
                request_id = request.get("requestId", "unknown")
                method = request.get("method", "unknown")

                print(f"Received request {request_id}: {method}")

                # Simple response
                response = {
                    "requestId": request_id,
                    "data": {
                        "status": "success",
                        "message": f"Processed {method} request",
                        "timestamp": datetime.now().isoformat(),
                    },
                    "timestamp": datetime.now().isoformat(),
                }

                await websocket.send(json.dumps(response))
                print(f"Sent response for {request_id}")

            except json.JSONDecodeError:
                error_response = {
                    "error": "Invalid JSON",
                    "timestamp": datetime.now().isoformat(),
                }
                await websocket.send(json.dumps(error_response))
            except Exception as e:
                print(f"Error handling message: {e}")
                error_response = {
                    "error": str(e),
                    "timestamp": datetime.now().isoformat(),
                }
                await websocket.send(json.dumps(error_response))

    except websockets.exceptions.ConnectionClosed:
        print("Client disconnected")
    except Exception as e:
        print(f"WebSocket error: {e}")


async def main():
    """Start the simple DSPy server"""
    print("Starting Simple DSPy Server on port 8766")

    try:
        server = await websockets.serve(
            handle_client, "localhost", 8766, ping_interval=20, ping_timeout=10
        )

        print("DSPy server is running on ws://localhost:8766")
        print("Press Ctrl+C to stop.")

        await server.wait_closed()

    except KeyboardInterrupt:
        print("Shutting down DSPy server...")
    except Exception as e:
        print(f"Server error: {e}")


if __name__ == "__main__":
    asyncio.run(main())
