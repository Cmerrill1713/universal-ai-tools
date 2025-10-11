#!/usr/bin/env python3
"""
Code Quality Benchmark: Universal AI Tools
Analyzes codebase for maintainability, performance, security, and best practices
"""

import json
import re
import subprocess
import time
from pathlib import Path
from typing import Tuple


class CodeQualityBenchmark:
    def __init__(self):
        self.project_root = Path(".")
        self.results = []
        self.benchmark_start = time.time()

        # Define code quality metrics
        self.metrics = {
            "rust_services": [],
            "go_services": [],
            "python_scripts": [],
            "overall_metrics": {},
        }

    def run_command(self, command: str,
                    cwd: str = None) -> Tuple[int, str, str]:
        """Run a shell command and return exit code, stdout, stderr"""
        try:
            result = subprocess.run(
                command,
                shell=True,
                capture_output=True,
                text=True,
                cwd=cwd or self.project_root,
            )
            return result.returncode, result.stdout, result.stderr
        except Exception as e:
            return -1, "", str(e)

    def analyze_rust_code_quality(self):
        """Analyze Rust code quality using cargo tools"""
        print("\n🦀 Analyzing Rust Code Quality...")

        rust_crates = [
            "crates/llm-router",
            "crates/ml-inference",
            "crates/vision-service",
            "crates/vector-db",
            "crates/redis-service",
            "crates/voice-processing",
            "crates/assistantd",
            "crates/parameter-analytics",
        ]

        total_warnings = 0
        total_errors = 0
        compile_success = 0
        clippy_issues = 0

        for crate in rust_crates:
            crate_path = self.project_root / crate
            if not crate_path.exists():
                continue

            print(f"  📦 Analyzing {crate}...")

            # Check compilation
            exit_code, stdout, stderr = self.run_command(
                "cargo check", str(crate_path))
            if exit_code == 0:
                compile_success += 1
                # Count warnings
                warnings = len(re.findall(r"warning:", stdout + stderr))
                total_warnings += warnings
            else:
                # Count errors
                errors = len(re.findall(r"error:", stdout + stderr))
                total_errors += errors

            # Run clippy for additional quality checks
            exit_code, stdout, stderr = self.run_command(
                "cargo clippy -- -D warnings", str(crate_path)
            )
            if exit_code != 0:
                clippy_issues += len(re.findall(r"warning:", stdout + stderr))

            # Analyze code metrics
            self.analyze_rust_file_metrics(crate_path)

        self.metrics["rust_services"] = {
            "total_crates": len(rust_crates),
            "compile_success": compile_success,
            "compile_rate": compile_success / len(rust_crates) * 100,
            "total_warnings": total_warnings,
            "total_errors": total_errors,
            "clippy_issues": clippy_issues,
            "quality_score": max(
                0, 100 - (total_warnings + total_errors + clippy_issues) * 2
            ),
        }

        print("  ✅ Rust Analysis Complete:")
        print(
            f"    📊 Compile Success: {compile_success}/{
                len(rust_crates)} ({
                compile_success / len(rust_crates) * 100:.1f}%)")
        print(f"    ⚠️  Total Warnings: {total_warnings}")
        print(f"    ❌ Total Errors: {total_errors}")
        print(f"    🔍 Clippy Issues: {clippy_issues}")

    def analyze_rust_file_metrics(self, crate_path: Path):
        """Analyze individual Rust file metrics"""
        rust_files = list(crate_path.rglob("*.rs"))

        total_lines = 0
        total_functions = 0
        total_structs = 0
        total_imports = 0
        complexity_score = 0

        for rust_file in rust_files:
            try:
                with open(rust_file, "r", encoding="utf-8") as f:
                    content = f.read()

                lines = content.split("\n")
                total_lines += len(lines)

                # Count functions
                functions = len(re.findall(r"fn\s+\w+", content))
                total_functions += functions

                # Count structs
                structs = len(re.findall(r"struct\s+\w+", content))
                total_structs += structs

                # Count imports
                imports = len(re.findall(r"use\s+", content))
                total_imports += imports

                # Simple complexity estimation (cyclomatic complexity
                # approximation)
                complexity_indicators = [
                    "if ", "for ", "while ", "match ", "loop "]
                file_complexity = sum(content.count(indicator)
                                      for indicator in complexity_indicators)
                complexity_score += file_complexity

            except Exception as e:
                print(f"    ⚠️  Error analyzing {rust_file}: {e}")

        self.metrics["rust_services"].append(
            {
                "crate": crate_path.name,
                "files": len(rust_files),
                "lines": total_lines,
                "functions": total_functions,
                "structs": total_structs,
                "imports": total_imports,
                "complexity": complexity_score,
                "avg_complexity_per_function": complexity_score
                / max(total_functions, 1),
            }
        )

    def analyze_go_code_quality(self):
        """Analyze Go code quality"""
        print("\n🐹 Analyzing Go Code Quality...")

        go_services = [
            "go-services/api-gateway",
            "go-services/auth-service",
            "go-services/chat-service",
            "go-services/fast-llm-service",
            "go-services/load-balancer",
            "go-services/memory-service",
            "go-services/metrics-aggregator",
            "go-services/websocket-hub",
            "go-services/cache-coordinator",
            "go-services/parameter-analytics",
        ]

        total_warnings = 0
        total_errors = 0
        build_success = 0
        vet_issues = 0

        for service in go_services:
            service_path = self.project_root / service
            if not service_path.exists():
                continue

            print(f"  📦 Analyzing {service}...")

            # Check if go.mod exists
            if not (service_path / "go.mod").exists():
                continue

            # Try to build
            exit_code, stdout, stderr = self.run_command(
                "go build", str(service_path))
            if exit_code == 0:
                build_success += 1
            else:
                errors = len(re.findall(r"error:", stdout + stderr))
                total_errors += errors

            # Run go vet
            exit_code, stdout, stderr = self.run_command(
                "go vet", str(service_path))
            if exit_code != 0:
                vet_issues += len(re.findall(r"warning:", stdout + stderr))

            # Analyze Go file metrics
            self.analyze_go_file_metrics(service_path)

        self.metrics["go_services"] = {
            "total_services": len(go_services),
            "build_success": build_success,
            "build_rate": build_success / len(go_services) * 100,
            "total_warnings": total_warnings,
            "total_errors": total_errors,
            "vet_issues": vet_issues,
            "quality_score": max(
                0, 100 - (total_warnings + total_errors + vet_issues) * 2
            ),
        }

        print("  ✅ Go Analysis Complete:")
        print(
            f"    📊 Build Success: {build_success}/{
                len(go_services)} ({
                build_success / len(go_services) * 100:.1f}%)")
        print(f"    ⚠️  Total Warnings: {total_warnings}")
        print(f"    ❌ Total Errors: {total_errors}")
        print(f"    🔍 Vet Issues: {vet_issues}")

    def analyze_go_file_metrics(self, service_path: Path):
        """Analyze individual Go file metrics"""
        go_files = list(service_path.rglob("*.go"))

        total_lines = 0
        total_functions = 0
        total_structs = 0
        total_imports = 0
        complexity_score = 0

        for go_file in go_files:
            try:
                with open(go_file, "r", encoding="utf-8") as f:
                    content = f.read()

                lines = content.split("\n")
                total_lines += len(lines)

                # Count functions
                functions = len(re.findall(r"func\s+\w+", content))
                total_functions += functions

                # Count structs
                structs = len(re.findall(r"type\s+\w+\s+struct", content))
                total_structs += structs

                # Count imports
                imports = len(re.findall(r"import\s+", content))
                total_imports += imports

                # Simple complexity estimation
                complexity_indicators = [
                    "if ", "for ", "switch ", "case ", "go func"]
                file_complexity = sum(content.count(indicator)
                                      for indicator in complexity_indicators)
                complexity_score += file_complexity

            except Exception as e:
                print(f"    ⚠️  Error analyzing {go_file}: {e}")

        self.metrics["go_services"].append(
            {
                "service": service_path.name,
                "files": len(go_files),
                "lines": total_lines,
                "functions": total_functions,
                "structs": total_structs,
                "imports": total_imports,
                "complexity": complexity_score,
                "avg_complexity_per_function": complexity_score
                / max(total_functions, 1),
            }
        )

    def analyze_python_scripts(self):
        """Analyze Python script quality"""
        print("\n🐍 Analyzing Python Script Quality...")

        python_files = list(self.project_root.rglob("*.py"))

        total_lines = 0
        total_functions = 0
        total_classes = 0
        total_imports = 0
        complexity_score = 0
        style_issues = 0

        for py_file in python_files:
            try:
                with open(py_file, "r", encoding="utf-8") as f:
                    content = f.read()

                lines = content.split("\n")
                total_lines += len(lines)

                # Count functions
                functions = len(re.findall(r"def\s+\w+", content))
                total_functions += functions

                # Count classes
                classes = len(re.findall(r"class\s+\w+", content))
                total_classes += classes

                # Count imports
                imports = len(re.findall(r"import\s+", content))
                total_imports += imports

                # Simple complexity estimation
                complexity_indicators = [
                    "if ",
                    "for ",
                    "while ",
                    "try:",
                    "except:",
                    "with ",
                ]
                file_complexity = sum(content.count(indicator)
                                      for indicator in complexity_indicators)
                complexity_score += file_complexity

                # Check for common style issues
                style_issues += self.check_python_style_issues(content)

            except Exception as e:
                print(f"    ⚠️  Error analyzing {py_file}: {e}")

        self.metrics["python_scripts"] = {
            "total_files": len(python_files),
            "total_lines": total_lines,
            "total_functions": total_functions,
            "total_classes": total_classes,
            "total_imports": total_imports,
            "complexity_score": complexity_score,
            "style_issues": style_issues,
            "avg_complexity_per_function": complexity_score / max(total_functions, 1),
            "quality_score": max(0, 100 - style_issues * 5),
        }

        print("  ✅ Python Analysis Complete:")
        print(f"    📊 Files: {len(python_files)}")
        print(f"    📝 Total Lines: {total_lines}")
        print(f"    🔧 Functions: {total_functions}")
        print(f"    🏗️  Classes: {total_classes}")
        print(f"    ⚠️  Style Issues: {style_issues}")

    def check_python_style_issues(self, content: str) -> int:
        """Check for common Python style issues"""
        issues = 0

        lines = content.split("\n")

        for i, line in enumerate(lines):
            # Check line length
            if len(line) > 120:
                issues += 1

            # Check for trailing whitespace
            if line.rstrip() != line:
                issues += 1

            # Check for mixed tabs and spaces
            if "\t" in line and "    " in line:
                issues += 1

            # Check for missing docstrings in functions
            if re.match(r"def\s+\w+", line) and i + 1 < len(lines):
                next_line = lines[i + 1].strip()
                if not next_line.startswith(
                        '"""') and not next_line.startswith("'''"):
                    issues += 1

        return issues

    def analyze_security_issues(self):
        """Analyze security-related code issues"""
        print("\n🔒 Analyzing Security Issues...")

        security_issues = {
            "hardcoded_secrets": 0,
            "sql_injection_risks": 0,
            "unsafe_deserialization": 0,
            "missing_input_validation": 0,
            "insecure_random": 0,
            "file_path_traversal": 0,
        }

        # Scan all code files
        code_files = (
            list(self.project_root.rglob("*.rs"))
            + list(self.project_root.rglob("*.go"))
            + list(self.project_root.rglob("*.py"))
        )

        for file_path in code_files:
            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    content = f.read()

                # Check for hardcoded secrets
                secret_patterns = [
                    r'password\s*=\s*["\'][^"\']+["\']',
                    r'api_key\s*=\s*["\'][^"\']+["\']',
                    r'secret\s*=\s*["\'][^"\']+["\']',
                    r'token\s*=\s*["\'][^"\']+["\']',
                ]
                for pattern in secret_patterns:
                    security_issues["hardcoded_secrets"] += len(
                        re.findall(pattern, content, re.IGNORECASE)
                    )

                # Check for SQL injection risks
                sql_patterns = [
                    r'query\s*=\s*["\'][^"\']*\+.*["\']',
                    r"fmt\.Sprintf.*SELECT",
                    r"format!.*SELECT",
                ]
                for pattern in sql_patterns:
                    security_issues["sql_injection_risks"] += len(
                        re.findall(pattern, content, re.IGNORECASE)
                    )

                # Check for unsafe deserialization
                unsafe_patterns = [
                    r"pickle\.loads?",
                    r"json\.loads?.*eval",
                    r"unmarshal.*interface\{\}",
                ]
                for pattern in unsafe_patterns:
                    security_issues["unsafe_deserialization"] += len(
                        re.findall(pattern, content, re.IGNORECASE)
                    )

                # Check for missing input validation
                validation_patterns = [
                    r"http\.Request.*\.Form\[",
                    r"query\.Get\(",
                    r"request\.body",
                ]
                for pattern in validation_patterns:
                    if pattern in content and "validate" not in content.lower():
                        security_issues["missing_input_validation"] += 1

                # Check for insecure random
                insecure_random_patterns = [
                    r"math\.rand",
                    r"random\.random",
                    r"rand\.Int",
                ]
                for pattern in insecure_random_patterns:
                    security_issues["insecure_random"] += len(
                        re.findall(pattern, content)
                    )

                # Check for file path traversal
                path_patterns = [r"\.\./", r"\.\.\\\\", r"file://"]
                for pattern in path_patterns:
                    security_issues["file_path_traversal"] += len(
                        re.findall(pattern, content)
                    )

            except Exception as e:
                print(f"    ⚠️  Error analyzing {file_path}: {e}")

        total_security_issues = sum(security_issues.values())
        security_score = max(0, 100 - total_security_issues * 10)

        self.metrics["security"] = {
            **security_issues,
            "total_issues": total_security_issues,
            "security_score": security_score,
        }

        print("  ✅ Security Analysis Complete:")
        print(f"    🔐 Security Score: {security_score}/100")
        print(f"    ⚠️  Total Issues: {total_security_issues}")
        for issue_type, count in security_issues.items():
            if count > 0:
                print(f"    🚨 {issue_type.replace('_', ' ').title()}: {count}")

    def analyze_performance_patterns(self):
        """Analyze performance-related code patterns"""
        print("\n⚡ Analyzing Performance Patterns...")

        performance_issues = {
            "inefficient_loops": 0,
            "memory_leaks": 0,
            "blocking_operations": 0,
            "unnecessary_allocations": 0,
            "missing_caching": 0,
            "synchronous_operations": 0,
        }

        # Scan code files for performance issues
        code_files = (
            list(self.project_root.rglob("*.rs"))
            + list(self.project_root.rglob("*.go"))
            + list(self.project_root.rglob("*.py"))
        )

        for file_path in code_files:
            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    content = f.read()

                # Check for inefficient loops
                inefficient_patterns = [
                    r"for.*in.*range.*len\(",
                    r"for.*i.*<.*len\(",
                    r"\.map\(.*\.map\(",
                    r"\.filter\(.*\.filter\(",
                ]
                for pattern in inefficient_patterns:
                    performance_issues["inefficient_loops"] += len(
                        re.findall(pattern, content)
                    )

                # Check for potential memory leaks
                memory_patterns = [
                    r"new\s+\w+\(",
                    r"malloc\(",
                    r"Box::new\(",
                    r"Arc::new\(",
                ]
                for pattern in memory_patterns:
                    performance_issues["memory_leaks"] += len(
                        re.findall(pattern, content)
                    )

                # Check for blocking operations
                blocking_patterns = [
                    r"\.block_on\(",
                    r"\.wait\(",
                    r"\.join\(",
                    r"time\.sleep\(",
                ]
                for pattern in blocking_patterns:
                    performance_issues["blocking_operations"] += len(
                        re.findall(pattern, content)
                    )

                # Check for unnecessary allocations
                allocation_patterns = [
                    r"String::new\(\)",
                    r"Vec::new\(\)",
                    r"make\(map",
                    r"\[\]string\{",
                ]
                for pattern in allocation_patterns:
                    performance_issues["unnecessary_allocations"] += len(
                        re.findall(pattern, content)
                    )

                # Check for missing caching opportunities
                if "http" in content.lower() and "cache" not in content.lower():
                    performance_issues["missing_caching"] += 1

                # Check for synchronous operations in async contexts
                sync_patterns = [
                    r"async.*\.await.*\.get\(",
                    r"async.*\.await.*\.post\(",
                    r"tokio::spawn.*\.block_on",
                ]
                for pattern in sync_patterns:
                    performance_issues["synchronous_operations"] += len(
                        re.findall(pattern, content)
                    )

            except Exception as e:
                print(f"    ⚠️  Error analyzing {file_path}: {e}")

        total_performance_issues = sum(performance_issues.values())
        performance_score = max(0, 100 - total_performance_issues * 5)

        self.metrics["performance"] = {
            **performance_issues,
            "total_issues": total_performance_issues,
            "performance_score": performance_score,
        }

        print("  ✅ Performance Analysis Complete:")
        print(f"    ⚡ Performance Score: {performance_score}/100")
        print(f"    ⚠️  Total Issues: {total_performance_issues}")
        for issue_type, count in performance_issues.items():
            if count > 0:
                print(f"    🚨 {issue_type.replace('_', ' ').title()}: {count}")

    def analyze_documentation_quality(self):
        """Analyze documentation quality"""
        print("\n📚 Analyzing Documentation Quality...")

        doc_files = list(self.project_root.rglob("*.md")) + list(
            self.project_root.rglob("README*")
        )

        total_docs = len(doc_files)
        total_lines = 0
        code_examples = 0
        api_docs = 0

        for doc_file in doc_files:
            try:
                with open(doc_file, "r", encoding="utf-8") as f:
                    content = f.read()

                lines = content.split("\n")
                total_lines += len(lines)

                # Count code examples
                code_examples += len(re.findall(r"```", content))

                # Count API documentation
                api_docs += len(re.findall(r"GET|POST|PUT|DELETE|PATCH", content))

            except Exception as e:
                print(f"    ⚠️  Error analyzing {doc_file}: {e}")

        # Check for missing documentation
        rust_crates = list(self.project_root.glob("crates/*"))
        go_services = list(self.project_root.glob("go-services/*"))

        missing_docs = 0
        for crate in rust_crates:
            if not (crate / "README.md").exists():
                missing_docs += 1

        for service in go_services:
            if not (service / "README.md").exists():
                missing_docs += 1

        doc_score = max(0, 100 - missing_docs * 10)

        self.metrics["documentation"] = {
            "total_docs": total_docs,
            "total_lines": total_lines,
            "code_examples": code_examples,
            "api_docs": api_docs,
            "missing_docs": missing_docs,
            "documentation_score": doc_score,
        }

        print("  ✅ Documentation Analysis Complete:")
        print(f"    📚 Total Docs: {total_docs}")
        print(f"    📝 Total Lines: {total_lines}")
        print(f"    💻 Code Examples: {code_examples}")
        print(f"    🔗 API Docs: {api_docs}")
        print(f"    📊 Documentation Score: {doc_score}/100")

    def calculate_overall_metrics(self):
        """Calculate overall code quality metrics"""
        print("\n📊 Calculating Overall Metrics...")

        # Get individual scores
        rust_score = self.metrics.get(
            "rust_services", {}).get(
            "quality_score", 0)
        go_score = self.metrics.get("go_services", {}).get("quality_score", 0)
        python_score = self.metrics.get(
            "python_scripts", {}).get(
            "quality_score", 0)
        security_score = self.metrics.get(
            "security", {}).get(
            "security_score", 0)
        performance_score = self.metrics.get("performance", {}).get(
            "performance_score", 0
        )
        doc_score = self.metrics.get(
            "documentation", {}).get(
            "documentation_score", 0)

        # Calculate weighted overall score
        weights = {
            "rust": 0.3,  # Rust services are core
            "go": 0.25,  # Go services are important
            "python": 0.1,  # Python scripts are auxiliary
            "security": 0.2,  # Security is critical
            "performance": 0.1,  # Performance matters
            "documentation": 0.05,  # Documentation is nice to have
        }

        overall_score = (
            rust_score * weights["rust"]
            + go_score * weights["go"]
            + python_score * weights["python"]
            + security_score * weights["security"]
            + performance_score * weights["performance"]
            + doc_score * weights["documentation"]
        )

        self.metrics["overall_metrics"] = {
            "overall_score": overall_score,
            "rust_score": rust_score,
            "go_score": go_score,
            "python_score": python_score,
            "security_score": security_score,
            "performance_score": performance_score,
            "documentation_score": doc_score,
            "weights": weights,
        }

    def print_benchmark_summary(self):
        """Print comprehensive benchmark summary"""
        print("\n" + "=" * 70)
        print("🎯 CODE QUALITY BENCHMARK SUMMARY")
        print("=" * 70)

        overall = self.metrics["overall_metrics"]
        print(
            f"📊 Overall Code Quality Score: {
                overall['overall_score']:.1f}/100")

        # Grade the code quality
        if overall["overall_score"] >= 90:
            grade = "🥇 EXCELLENT"
            description = "Production-ready, enterprise-grade code"
        elif overall["overall_score"] >= 80:
            grade = "🥈 VERY GOOD"
            description = "High-quality code with minor improvements needed"
        elif overall["overall_score"] >= 70:
            grade = "🥉 GOOD"
            description = "Solid codebase with some areas for improvement"
        elif overall["overall_score"] >= 60:
            grade = "📈 IMPROVING"
            description = "Decent codebase that needs attention"
        else:
            grade = "🔧 NEEDS WORK"
            description = "Codebase requires significant improvements"

        print(f"🏆 Grade: {grade}")
        print(f"📝 Assessment: {description}")

        print("\n📋 Detailed Scores:")
        print("-" * 50)
        print(f"🦀 Rust Services:     {overall['rust_score']:.1f}/100")
        print(f"🐹 Go Services:       {overall['go_score']:.1f}/100")
        print(f"🐍 Python Scripts:    {overall['python_score']:.1f}/100")
        print(f"🔒 Security:          {overall['security_score']:.1f}/100")
        print(f"⚡ Performance:       {overall['performance_score']:.1f}/100")
        print(f"📚 Documentation:     {overall['documentation_score']:.1f}/100")

        # Show key metrics
        print("\n🔍 Key Metrics:")
        print("-" * 50)

        rust_metrics = self.metrics.get("rust_services", {})
        if rust_metrics:
            print(
                f"🦀 Rust Compile Rate: {
                    rust_metrics.get(
                        'compile_rate',
                        0):.1f}%")
            print(f"🦀 Rust Warnings: {rust_metrics.get('total_warnings', 0)}")
            print(f"🦀 Rust Errors: {rust_metrics.get('total_errors', 0)}")

        go_metrics = self.metrics.get("go_services", {})
        if go_metrics:
            print(f"🐹 Go Build Rate: {go_metrics.get('build_rate', 0):.1f}%")
            print(f"🐹 Go Warnings: {go_metrics.get('total_warnings', 0)}")
            print(f"🐹 Go Errors: {go_metrics.get('total_errors', 0)}")

        python_metrics = self.metrics.get("python_scripts", {})
        if python_metrics:
            print(f"🐍 Python Files: {python_metrics.get('total_files', 0)}")
            print(f"🐍 Style Issues: {python_metrics.get('style_issues', 0)}")

        security_metrics = self.metrics.get("security", {})
        if security_metrics:
            print(
                f"🔒 Security Issues: {
                    security_metrics.get(
                        'total_issues',
                        0)}")

        performance_metrics = self.metrics.get("performance", {})
        if performance_metrics:
            print(
                f"⚡ Performance Issues: {
                    performance_metrics.get(
                        'total_issues',
                        0)}")

        doc_metrics = self.metrics.get("documentation", {})
        if doc_metrics:
            print(f"📚 Documentation Files: {doc_metrics.get('total_docs', 0)}")
            print(f"📚 Missing Docs: {doc_metrics.get('missing_docs', 0)}")

        # Recommendations
        print("\n💡 Recommendations:")
        print("-" * 50)

        if overall["rust_score"] < 80:
            print("🦀 Focus on fixing Rust compilation warnings and errors")
        if overall["go_score"] < 80:
            print("🐹 Improve Go code quality and fix build issues")
        if overall["security_score"] < 80:
            print("🔒 Address security vulnerabilities immediately")
        if overall["performance_score"] < 80:
            print("⚡ Optimize performance-critical code paths")
        if overall["documentation_score"] < 70:
            print("📚 Add missing documentation and improve existing docs")

        if overall["overall_score"] >= 85:
            print("🎉 Excellent work! Your codebase is production-ready!")
        elif overall["overall_score"] >= 75:
            print("👍 Good job! Minor improvements will make it excellent.")
        else:
            print("🔧 Focus on the areas with lowest scores for maximum impact.")

    def save_results(self):
        """Save benchmark results to file"""
        results = {
            "timestamp": time.time(),
            "benchmark_duration": time.time() - self.benchmark_start,
            "metrics": self.metrics,
        }

        with open("code_quality_benchmark_results.json", "w") as f:
            json.dump(results, f, indent=2)

        print("\n💾 Detailed results saved to: code_quality_benchmark_results.json")

    def run_benchmark(self):
        """Run the complete code quality benchmark"""
        print("🚀 Starting Code Quality Benchmark")
        print("=" * 70)

        self.analyze_rust_code_quality()
        self.analyze_go_code_quality()
        self.analyze_python_scripts()
        self.analyze_security_issues()
        self.analyze_performance_patterns()
        self.analyze_documentation_quality()
        self.calculate_overall_metrics()
        self.print_benchmark_summary()
        self.save_results()

        return self.metrics["overall_metrics"]["overall_score"]


def main():
    benchmark = CodeQualityBenchmark()
    score = benchmark.run_benchmark()
    return score


if __name__ == "__main__":
    main()
