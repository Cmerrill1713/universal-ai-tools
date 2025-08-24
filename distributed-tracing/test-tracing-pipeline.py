#!/usr/bin/env python3
"""
Test script for validating the Universal AI Tools tracing pipeline
Tests OTLP, Jaeger, Prometheus, and Grafana integration
"""

import json
import time
import random
import requests
from typing import Dict, List, Optional
from datetime import datetime
from opentelemetry import trace, metrics
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.exporter.otlp.proto.grpc.metric_exporter import OTLPMetricExporter
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.sdk.metrics import MeterProvider
from opentelemetry.sdk.metrics.export import PeriodicExportingMetricReader
from opentelemetry.sdk.resources import Resource
from opentelemetry.trace import Status, StatusCode
from opentelemetry.semconv.resource import ResourceAttributes
from opentelemetry.semconv.trace import SpanAttributes

# ANSI color codes
RED = '\033[0;31m'
GREEN = '\033[0;32m'
YELLOW = '\033[1;33m'
BLUE = '\033[0;34m'
NC = '\033[0m'  # No Color

class TracingPipelineTest:
    def __init__(self, otel_endpoint: str = "localhost:4317"):
        self.otel_endpoint = otel_endpoint
        self.test_results = []
        self.setup_telemetry()
    
    def setup_telemetry(self):
        """Initialize OpenTelemetry with OTLP exporters"""
        # Create resource
        resource = Resource.create({
            ResourceAttributes.SERVICE_NAME: "tracing-test",
            ResourceAttributes.SERVICE_VERSION: "1.0.0",
            ResourceAttributes.SERVICE_NAMESPACE: "universal-ai-tools",
            "deployment.environment": "test",
            "test.run_id": f"test_{int(time.time())}",
        })
        
        # Setup tracing
        tracer_provider = TracerProvider(resource=resource)
        span_exporter = OTLPSpanExporter(
            endpoint=self.otel_endpoint,
            insecure=True
        )
        span_processor = BatchSpanProcessor(span_exporter)
        tracer_provider.add_span_processor(span_processor)
        trace.set_tracer_provider(tracer_provider)
        self.tracer = trace.get_tracer("tracing-test")
        
        # Setup metrics
        metric_exporter = OTLPMetricExporter(
            endpoint=self.otel_endpoint,
            insecure=True
        )
        metric_reader = PeriodicExportingMetricReader(
            exporter=metric_exporter,
            export_interval_millis=5000
        )
        meter_provider = MeterProvider(
            resource=resource,
            metric_readers=[metric_reader]
        )
        metrics.set_meter_provider(meter_provider)
        self.meter = metrics.get_meter("tracing-test")
        
        # Create test metrics
        self.test_counter = self.meter.create_counter(
            "test_runs_total",
            description="Total number of test runs"
        )
        self.test_histogram = self.meter.create_histogram(
            "test_duration_ms",
            description="Test execution duration in milliseconds"
        )
    
    def test_service_health(self, service_name: str, url: str) -> bool:
        """Test if a service is healthy"""
        try:
            response = requests.get(url, timeout=5)
            is_healthy = response.status_code in [200, 204]
            self.test_results.append({
                "service": service_name,
                "status": "healthy" if is_healthy else "unhealthy",
                "status_code": response.status_code
            })
            return is_healthy
        except Exception as e:
            self.test_results.append({
                "service": service_name,
                "status": "error",
                "error": str(e)
            })
            return False
    
    def test_otlp_traces(self) -> bool:
        """Send test traces through OTLP"""
        print(f"{BLUE}Testing OTLP trace export...{NC}")
        
        try:
            with self.tracer.start_as_current_span("test_root_span") as root_span:
                root_span.set_attribute("test.type", "integration")
                root_span.set_attribute("test.component", "otlp")
                
                # Create child spans
                with self.tracer.start_as_current_span("test_child_1") as child1:
                    child1.set_attribute("operation", "database_query")
                    child1.set_attribute("db.system", "postgresql")
                    time.sleep(0.1)  # Simulate work
                
                with self.tracer.start_as_current_span("test_child_2") as child2:
                    child2.set_attribute("operation", "llm_call")
                    child2.set_attribute("llm.provider", "test_provider")
                    child2.set_attribute("llm.model", "test-model")
                    time.sleep(0.2)  # Simulate work
                    
                    # Simulate an error
                    if random.random() > 0.7:
                        child2.set_status(Status(StatusCode.ERROR, "Simulated error"))
                        child2.record_exception(Exception("Test exception"))
            
            # Record metrics
            self.test_counter.add(1, {"test.type": "otlp_traces"})
            self.test_histogram.record(300, {"test.type": "otlp_traces"})
            
            print(f"{GREEN}✓ OTLP traces sent successfully{NC}")
            return True
            
        except Exception as e:
            print(f"{RED}✗ OTLP trace export failed: {e}{NC}")
            return False
    
    def test_jaeger_query(self) -> bool:
        """Query Jaeger for traces"""
        print(f"{BLUE}Testing Jaeger query API...{NC}")
        
        try:
            # Wait for traces to be processed
            time.sleep(2)
            
            # Query Jaeger API
            response = requests.get(
                "http://localhost:16686/api/services",
                timeout=5
            )
            
            if response.status_code == 200:
                services = response.json().get("data", [])
                if "tracing-test" in services:
                    print(f"{GREEN}✓ Test service found in Jaeger{NC}")
                    
                    # Query for specific traces
                    trace_response = requests.get(
                        "http://localhost:16686/api/traces",
                        params={
                            "service": "tracing-test",
                            "limit": 10
                        },
                        timeout=5
                    )
                    
                    if trace_response.status_code == 200:
                        traces = trace_response.json().get("data", [])
                        print(f"{GREEN}✓ Found {len(traces)} traces in Jaeger{NC}")
                        return True
                else:
                    print(f"{YELLOW}⚠ Test service not yet visible in Jaeger{NC}")
                    return False
            else:
                print(f"{RED}✗ Jaeger API returned status {response.status_code}{NC}")
                return False
                
        except Exception as e:
            print(f"{RED}✗ Jaeger query failed: {e}{NC}")
            return False
    
    def test_prometheus_metrics(self) -> bool:
        """Query Prometheus for metrics"""
        print(f"{BLUE}Testing Prometheus metrics...{NC}")
        
        try:
            # Query Prometheus API
            response = requests.get(
                "http://localhost:9090/api/v1/query",
                params={"query": "up"},
                timeout=5
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get("status") == "success":
                    results = data.get("data", {}).get("result", [])
                    print(f"{GREEN}✓ Found {len(results)} up metrics in Prometheus{NC}")
                    
                    # Check for OTEL collector metrics
                    otel_response = requests.get(
                        "http://localhost:9090/api/v1/query",
                        params={"query": "otelcol_process_uptime"},
                        timeout=5
                    )
                    
                    if otel_response.status_code == 200:
                        print(f"{GREEN}✓ OTel Collector metrics found{NC}")
                        return True
                    else:
                        print(f"{YELLOW}⚠ OTel Collector metrics not found{NC}")
                        return False
                        
            print(f"{RED}✗ Prometheus query failed{NC}")
            return False
            
        except Exception as e:
            print(f"{RED}✗ Prometheus test failed: {e}{NC}")
            return False
    
    def test_grafana_datasources(self) -> bool:
        """Test Grafana datasource configuration"""
        print(f"{BLUE}Testing Grafana datasources...{NC}")
        
        try:
            # Grafana API with basic auth
            response = requests.get(
                "http://localhost:3000/api/datasources",
                auth=("admin", "tracing123"),
                timeout=5
            )
            
            if response.status_code == 200:
                datasources = response.json()
                ds_names = [ds.get("name") for ds in datasources]
                
                required_datasources = ["Prometheus", "Jaeger", "Tempo"]
                found_datasources = [ds for ds in required_datasources if ds in ds_names]
                
                if len(found_datasources) == len(required_datasources):
                    print(f"{GREEN}✓ All required datasources configured in Grafana{NC}")
                    return True
                else:
                    missing = set(required_datasources) - set(found_datasources)
                    print(f"{YELLOW}⚠ Missing datasources: {missing}{NC}")
                    return False
            else:
                print(f"{RED}✗ Grafana API returned status {response.status_code}{NC}")
                return False
                
        except Exception as e:
            print(f"{RED}✗ Grafana test failed: {e}{NC}")
            return False
    
    def test_qdrant_health(self) -> bool:
        """Test Qdrant vector database health"""
        print(f"{BLUE}Testing Qdrant health...{NC}")
        
        try:
            response = requests.get("http://localhost:6333/health", timeout=5)
            
            if response.status_code == 200:
                print(f"{GREEN}✓ Qdrant is healthy{NC}")
                
                # Check collections
                collections_response = requests.get(
                    "http://localhost:6333/collections",
                    timeout=5
                )
                
                if collections_response.status_code == 200:
                    collections = collections_response.json().get("result", {}).get("collections", [])
                    print(f"{GREEN}✓ Qdrant has {len(collections)} collections{NC}")
                    return True
                    
            print(f"{RED}✗ Qdrant health check failed{NC}")
            return False
            
        except Exception as e:
            print(f"{RED}✗ Qdrant test failed: {e}{NC}")
            return False
    
    def run_all_tests(self):
        """Run all tests"""
        print("=" * 50)
        print("Universal AI Tools - Tracing Pipeline Test")
        print("=" * 50)
        print()
        
        # Test service health
        print(f"{BLUE}Checking service health...{NC}")
        services = [
            ("OTel Collector", "http://localhost:13133/health"),
            ("Jaeger", "http://localhost:16686/"),
            ("Tempo", "http://localhost:3200/ready"),
            ("Prometheus", "http://localhost:9090/-/healthy"),
            ("Grafana", "http://localhost:3000/api/health"),
            ("Qdrant", "http://localhost:6333/health"),
        ]
        
        all_healthy = True
        for service_name, url in services:
            is_healthy = self.test_service_health(service_name, url)
            status = f"{GREEN}✓{NC}" if is_healthy else f"{RED}✗{NC}"
            print(f"  {status} {service_name}")
            all_healthy = all_healthy and is_healthy
        
        print()
        
        if not all_healthy:
            print(f"{RED}Some services are not healthy. Stopping tests.{NC}")
            return False
        
        # Run integration tests
        print(f"{BLUE}Running integration tests...{NC}")
        print()
        
        test_results = []
        
        # Test OTLP traces
        test_results.append(("OTLP Traces", self.test_otlp_traces()))
        print()
        
        # Test Jaeger
        test_results.append(("Jaeger Query", self.test_jaeger_query()))
        print()
        
        # Test Prometheus
        test_results.append(("Prometheus Metrics", self.test_prometheus_metrics()))
        print()
        
        # Test Grafana
        test_results.append(("Grafana Datasources", self.test_grafana_datasources()))
        print()
        
        # Test Qdrant
        test_results.append(("Qdrant Vector DB", self.test_qdrant_health()))
        print()
        
        # Summary
        print("=" * 50)
        print("Test Summary")
        print("=" * 50)
        
        all_passed = True
        for test_name, passed in test_results:
            status = f"{GREEN}PASSED{NC}" if passed else f"{RED}FAILED{NC}"
            print(f"  {test_name}: {status}")
            all_passed = all_passed and passed
        
        print()
        
        if all_passed:
            print(f"{GREEN}✅ All tests passed!{NC}")
            print()
            print("Next steps:")
            print("  1. View traces in Jaeger: http://localhost:16686")
            print("  2. Explore metrics in Grafana: http://localhost:3000")
            print("  3. Check Prometheus targets: http://localhost:9090/targets")
            return True
        else:
            print(f"{RED}❌ Some tests failed{NC}")
            print()
            print("Troubleshooting:")
            print("  1. Check service logs: docker-compose -f docker-compose-fixed.yml logs [service]")
            print("  2. Verify network connectivity")
            print("  3. Ensure all services are running: docker-compose -f docker-compose-fixed.yml ps")
            return False

if __name__ == "__main__":
    import sys
    
    # Check if custom OTLP endpoint is provided
    otel_endpoint = sys.argv[1] if len(sys.argv) > 1 else "localhost:4317"
    
    tester = TracingPipelineTest(otel_endpoint)
    success = tester.run_all_tests()
    
    sys.exit(0 if success else 1)