#!/usr/bin/env python3
"""
Generate test traces and metrics for Universal AI Tools
"""

import time
import random
import requests
import json
from datetime import datetime
from opentelemetry import trace, metrics
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.exporter.otlp.proto.grpc.metric_exporter import OTLPMetricExporter
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.sdk.metrics import MeterProvider
from opentelemetry.sdk.metrics.export import PeriodicExportingMetricReader
from opentelemetry.sdk.resources import Resource
from opentelemetry.semconv.resource import ResourceAttributes
from opentelemetry.trace import Status, StatusCode

def setup_telemetry():
    """Setup OpenTelemetry"""
    resource = Resource.create({
        ResourceAttributes.SERVICE_NAME: "test-generator",
        ResourceAttributes.SERVICE_VERSION: "1.0.0",
        ResourceAttributes.SERVICE_NAMESPACE: "universal-ai-tools",
        "deployment.environment": "production",
    })
    
    # Tracing
    tracer_provider = TracerProvider(resource=resource)
    span_exporter = OTLPSpanExporter(endpoint="localhost:4317", insecure=True)
    span_processor = BatchSpanProcessor(span_exporter)
    tracer_provider.add_span_processor(span_processor)
    trace.set_tracer_provider(tracer_provider)
    
    # Metrics
    metric_exporter = OTLPMetricExporter(endpoint="localhost:4317", insecure=True)
    metric_reader = PeriodicExportingMetricReader(
        exporter=metric_exporter,
        export_interval_millis=5000
    )
    meter_provider = MeterProvider(resource=resource, metric_readers=[metric_reader])
    metrics.set_meter_provider(meter_provider)
    
    return trace.get_tracer("test-generator"), metrics.get_meter("test-generator")

def simulate_llm_request(tracer, meter):
    """Simulate an LLM request with traces"""
    request_counter = meter.create_counter("llm_requests_total", description="Total LLM requests")
    latency_histogram = meter.create_histogram("llm_request_duration_ms", description="LLM request duration")
    
    providers = ["openai", "anthropic", "ollama", "groq"]
    models = ["gpt-4", "claude-3", "llama-3", "mixtral"]
    
    with tracer.start_as_current_span("llm_request") as span:
        provider = random.choice(providers)
        model = random.choice(models)
        
        span.set_attribute("llm.provider", provider)
        span.set_attribute("llm.model", model)
        span.set_attribute("llm.prompt_tokens", random.randint(10, 500))
        span.set_attribute("llm.completion_tokens", random.randint(50, 1000))
        
        # Simulate processing
        with tracer.start_as_current_span("provider_call") as provider_span:
            provider_span.set_attribute("provider.name", provider)
            provider_span.set_attribute("provider.endpoint", f"https://{provider}.api.com")
            
            # Random latency
            latency = random.uniform(0.1, 2.0)
            time.sleep(latency)
            
            # Simulate occasional errors
            if random.random() < 0.1:
                provider_span.set_status(Status(StatusCode.ERROR, "Provider timeout"))
                provider_span.record_exception(Exception("Request timeout"))
            else:
                provider_span.set_attribute("http.status_code", 200)
        
        # Record metrics
        request_counter.add(1, {"provider": provider, "model": model})
        latency_histogram.record(latency * 1000, {"provider": provider})

def simulate_vector_search(tracer, meter):
    """Simulate a vector database search"""
    search_counter = meter.create_counter("vector_searches_total", description="Total vector searches")
    
    with tracer.start_as_current_span("vector_search") as span:
        span.set_attribute("db.system", "qdrant")
        span.set_attribute("db.operation", "search")
        span.set_attribute("db.collection", "embeddings")
        span.set_attribute("search.k", 10)
        span.set_attribute("search.dimension", 1536)
        
        # Add to Qdrant
        try:
            response = requests.post(
                "http://localhost:6333/collections/embeddings/points/search",
                json={
                    "vector": [random.random() for _ in range(1536)],
                    "limit": 10
                },
                timeout=5
            )
            span.set_attribute("search.results", 10)
            span.set_attribute("search.score", random.uniform(0.7, 0.99))
        except:
            pass  # Ignore errors for demo
        
        search_counter.add(1, {"collection": "embeddings"})
        time.sleep(random.uniform(0.01, 0.1))

def simulate_websocket_connection(tracer, meter):
    """Simulate WebSocket activity"""
    connection_gauge = meter.create_up_down_counter("websocket_connections", description="Active WebSocket connections")
    message_counter = meter.create_counter("websocket_messages_total", description="Total WebSocket messages")
    
    with tracer.start_as_current_span("websocket_session") as span:
        client_id = f"client_{random.randint(1000, 9999)}"
        span.set_attribute("ws.client_id", client_id)
        span.set_attribute("ws.protocol", "wss")
        
        connection_gauge.add(1, {"type": "connect"})
        
        # Simulate message exchange
        for i in range(random.randint(1, 5)):
            with tracer.start_as_current_span(f"ws_message_{i}") as msg_span:
                msg_span.set_attribute("message.type", random.choice(["text", "binary"]))
                msg_span.set_attribute("message.size", random.randint(100, 10000))
                message_counter.add(1, {"client": client_id})
                time.sleep(random.uniform(0.1, 0.5))
        
        connection_gauge.add(-1, {"type": "disconnect"})

def main():
    print("🚀 Generating test data for Universal AI Tools tracing...")
    print("=" * 50)
    
    tracer, meter = setup_telemetry()
    
    # Create system metrics
    cpu_gauge = meter.create_gauge("system_cpu_usage", description="CPU usage percentage")
    memory_gauge = meter.create_gauge("system_memory_usage", description="Memory usage in MB")
    
    print("\n📊 Generating traces and metrics...")
    print("   Press Ctrl+C to stop\n")
    
    iteration = 0
    try:
        while True:
            iteration += 1
            print(f"Iteration {iteration}:", end=" ")
            
            # Generate different types of traces
            if random.random() < 0.7:
                simulate_llm_request(tracer, meter)
                print("LLM", end=" ")
            
            if random.random() < 0.5:
                simulate_vector_search(tracer, meter)
                print("Vector", end=" ")
            
            if random.random() < 0.3:
                simulate_websocket_connection(tracer, meter)
                print("WebSocket", end=" ")
            
            # System metrics
            cpu_gauge.set(random.uniform(10, 80), {"host": "localhost"})
            memory_gauge.set(random.uniform(500, 2000), {"host": "localhost"})
            
            print("✓")
            time.sleep(random.uniform(1, 3))
            
            if iteration % 10 == 0:
                print(f"\n📈 Generated {iteration} iterations")
                print(f"   View traces: http://localhost:16686")
                print(f"   View metrics: http://localhost:3000/d/universal-ai-overview\n")
    
    except KeyboardInterrupt:
        print(f"\n\n✅ Generated {iteration} iterations of test data")
        print("\n📊 View your data:")
        print("   • Jaeger: http://localhost:16686")
        print("   • Grafana: http://localhost:3000/d/universal-ai-overview")
        print("   • Prometheus: http://localhost:9090")

if __name__ == "__main__":
    main()