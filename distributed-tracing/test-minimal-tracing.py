#!/usr/bin/env python3
"""
Minimal test for the tracing stack
Sends test traces directly to Jaeger's OTLP endpoint
"""

import time
import requests
from opentelemetry import trace
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.sdk.resources import Resource
from opentelemetry.semconv.resource import ResourceAttributes

def test_minimal_tracing():
    print("Setting up OpenTelemetry...")
    
    # Create resource
    resource = Resource.create({
        ResourceAttributes.SERVICE_NAME: "test-service",
        ResourceAttributes.SERVICE_VERSION: "1.0.0",
    })
    
    # Setup tracing with Jaeger's OTLP endpoint
    tracer_provider = TracerProvider(resource=resource)
    span_exporter = OTLPSpanExporter(
        endpoint="localhost:4317",  # Jaeger's OTLP endpoint
        insecure=True
    )
    span_processor = BatchSpanProcessor(span_exporter)
    tracer_provider.add_span_processor(span_processor)
    trace.set_tracer_provider(tracer_provider)
    
    tracer = trace.get_tracer("test-tracer")
    
    print("Sending test traces...")
    
    # Create some test spans
    with tracer.start_as_current_span("test-operation") as span:
        span.set_attribute("test.type", "integration")
        span.set_attribute("test.component", "minimal")
        
        # Nested span
        with tracer.start_as_current_span("database-query") as db_span:
            db_span.set_attribute("db.system", "postgresql")
            db_span.set_attribute("db.statement", "SELECT * FROM users")
            time.sleep(0.1)
        
        # Another nested span
        with tracer.start_as_current_span("http-request") as http_span:
            http_span.set_attribute("http.method", "GET")
            http_span.set_attribute("http.url", "https://api.example.com/data")
            http_span.set_attribute("http.status_code", 200)
            time.sleep(0.2)
    
    print("Traces sent! Waiting for processing...")
    time.sleep(2)
    
    # Check if traces appear in Jaeger
    print("\nChecking Jaeger for traces...")
    try:
        response = requests.get("http://localhost:16686/api/services")
        if response.status_code == 200:
            services = response.json().get("data", [])
            if "test-service" in services:
                print("✅ Success! Test service found in Jaeger")
                print(f"   Services: {services}")
            else:
                print("⚠️  Test service not yet visible in Jaeger")
                print(f"   Available services: {services}")
        else:
            print(f"❌ Jaeger API error: {response.status_code}")
    except Exception as e:
        print(f"❌ Failed to query Jaeger: {e}")
    
    print("\n📊 View your traces at: http://localhost:16686")
    print("   1. Select 'test-service' from the Service dropdown")
    print("   2. Click 'Find Traces'")

if __name__ == "__main__":
    test_minimal_tracing()