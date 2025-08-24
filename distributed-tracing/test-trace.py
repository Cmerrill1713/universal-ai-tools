#!/usr/bin/env python3
"""
Test script to send sample traces to OpenTelemetry Collector
Verifies the distributed tracing pipeline is working
"""

import time
import random
from opentelemetry import trace
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.trace import Status, StatusCode

# Configure OpenTelemetry
resource = Resource.create({
    "service.name": "test-trace-generator",
    "service.version": "1.0.0",
    "service.namespace": "universal-ai-tools",
    "deployment.environment": "test"
})

# Create tracer provider
provider = TracerProvider(resource=resource)

# Configure OTLP exporter
otlp_exporter = OTLPSpanExporter(
    endpoint="localhost:4317",
    insecure=True
)

# Add span processor
provider.add_span_processor(BatchSpanProcessor(otlp_exporter))

# Set global tracer provider
trace.set_tracer_provider(provider)

# Get tracer
tracer = trace.get_tracer("test-tracer", "1.0.0")

def simulate_llm_request():
    """Simulate an LLM API request with nested spans"""
    with tracer.start_as_current_span("llm_request") as span:
        span.set_attribute("llm.model", "gpt-4")
        span.set_attribute("llm.provider", "openai")
        span.set_attribute("http.method", "POST")
        span.set_attribute("http.url", "/api/v1/completions")
        
        # Simulate preprocessing
        with tracer.start_as_current_span("preprocessing") as prep_span:
            prep_span.set_attribute("tokens.input", 150)
            prep_span.set_attribute("preprocessing.type", "tokenization")
            time.sleep(random.uniform(0.01, 0.05))
        
        # Simulate model inference
        with tracer.start_as_current_span("model_inference") as inf_span:
            inf_span.set_attribute("model.temperature", 0.7)
            inf_span.set_attribute("model.max_tokens", 500)
            time.sleep(random.uniform(0.5, 2.0))
            inf_span.set_attribute("tokens.output", 250)
        
        # Simulate postprocessing
        with tracer.start_as_current_span("postprocessing") as post_span:
            post_span.set_attribute("postprocessing.type", "formatting")
            time.sleep(random.uniform(0.01, 0.03))
        
        span.set_attribute("llm.total_tokens", 400)
        span.set_attribute("llm.latency_ms", random.uniform(500, 2500))
        span.set_status(Status(StatusCode.OK))

def simulate_websocket_connection():
    """Simulate a WebSocket connection with message exchanges"""
    with tracer.start_as_current_span("websocket_connection") as span:
        span.set_attribute("websocket.client_id", f"client_{random.randint(1000, 9999)}")
        span.set_attribute("websocket.protocol", "wss")
        
        # Simulate connection establishment
        with tracer.start_as_current_span("ws_handshake") as hs_span:
            hs_span.set_attribute("handshake.protocol", "HTTP/1.1")
            time.sleep(random.uniform(0.01, 0.05))
        
        # Simulate message exchanges
        for i in range(random.randint(3, 7)):
            with tracer.start_as_current_span(f"ws_message_{i}") as msg_span:
                msg_type = random.choice(["chat", "status", "heartbeat"])
                msg_span.set_attribute("message.type", msg_type)
                msg_span.set_attribute("message.size_bytes", random.randint(50, 500))
                time.sleep(random.uniform(0.01, 0.1))
        
        span.set_attribute("websocket.messages_exchanged", i + 1)
        span.set_status(Status(StatusCode.OK))

def simulate_agent_workflow():
    """Simulate an agent workflow with multiple steps"""
    with tracer.start_as_current_span("agent_workflow") as span:
        span.set_attribute("agent.id", f"agent_{random.randint(100, 999)}")
        span.set_attribute("agent.type", random.choice(["reasoning", "coding", "research"]))
        
        # Simulate workflow steps
        steps = ["initialization", "context_loading", "processing", "result_generation"]
        for step in steps:
            with tracer.start_as_current_span(f"agent_{step}") as step_span:
                step_span.set_attribute("step.name", step)
                step_span.set_attribute("step.memory_mb", random.randint(50, 200))
                
                if step == "processing":
                    # Simulate calling LLM during processing
                    simulate_llm_request()
                
                time.sleep(random.uniform(0.1, 0.5))
        
        span.set_attribute("workflow.steps_completed", len(steps))
        span.set_status(Status(StatusCode.OK))

def main():
    """Generate test traces"""
    print("Starting trace generation...")
    print("Sending traces to OpenTelemetry Collector at localhost:4317")
    print("-" * 50)
    
    # Generate various types of traces
    scenarios = [
        ("LLM Request", simulate_llm_request),
        ("WebSocket Connection", simulate_websocket_connection),
        ("Agent Workflow", simulate_agent_workflow)
    ]
    
    for i in range(3):  # Generate 3 rounds of traces
        print(f"\nRound {i + 1}:")
        for name, func in scenarios:
            print(f"  Generating {name} trace...")
            try:
                func()
                time.sleep(0.5)  # Small delay between traces
            except Exception as e:
                print(f"    Error: {e}")
    
    # Allow time for spans to be exported
    print("\nWaiting for spans to be exported...")
    time.sleep(5)
    
    print("\nTrace generation complete!")
    print("Check the following UIs to view traces:")
    print("  - Jaeger UI: http://localhost:16686")
    print("  - Zipkin UI: http://localhost:9411")
    print("  - Grafana: http://localhost:3001 (admin/tracing123)")

if __name__ == "__main__":
    main()