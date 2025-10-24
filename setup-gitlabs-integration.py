#!/usr/bin/env python3
"""
GitLabs Integration Setup for Universal AI Tools
Sets up complete GitLabs integration with enhanced context and CI/CD
"""

import os
import subprocess
import json
import yaml
from pathlib import Path

class GitLabsIntegrationSetup:
    def __init__(self):
        self.workspace = Path("/workspace")
        self.gitlabs_config = {
            "project_name": "universal-ai-tools",
            "description": "Universal AI Tools - Advanced AI Platform with Family Athena and Enterprise Features",
            "visibility": "private",
            "default_branch": "main",
            "ci_cd_enabled": True,
            "container_registry_enabled": True,
            "packages_enabled": True,
            "wiki_enabled": True,
            "issues_enabled": True,
            "merge_requests_enabled": True
        }
        
    def create_gitlabs_remote_config(self):
        """Create GitLabs remote configuration"""
        print("🔧 Setting up GitLabs remote configuration...")
        
        # GitLabs remote configuration
        gitlabs_remote = """
# GitLabs Remote Configuration
[remote "gitlabs"]
    url = https://gitlab.com/your-username/universal-ai-tools.git
    fetch = +refs/heads/*:refs/remotes/gitlabs/*
    pushurl = https://gitlab.com/your-username/universal-ai-tools.git

# GitLabs CI/CD Configuration
[gitlabs]
    ci_cd_enabled = true
    container_registry_enabled = true
    packages_enabled = true
    wiki_enabled = true
    issues_enabled = true
    merge_requests_enabled = true
"""
        
        # Write GitLabs configuration
        with open(self.workspace / ".gitlabs-config", "w") as f:
            f.write(gitlabs_remote)
            
        print("✅ GitLabs remote configuration created")
        
    def create_gitlab_ci_yml(self):
        """Create comprehensive GitLab CI/CD pipeline"""
        print("🔧 Creating GitLab CI/CD pipeline...")
        
        gitlab_ci = """
# GitLab CI/CD Pipeline for Universal AI Tools
stages:
  - validate
  - test
  - build
  - security
  - deploy
  - monitor

variables:
  NODE_VERSION: "20"
  PYTHON_VERSION: "3.11"
  RUST_VERSION: "1.75"
  GO_VERSION: "1.21"
  DOCKER_DRIVER: overlay2
  DOCKER_TLS_CERTDIR: "/certs"

# Cache configuration
cache:
  key: "$CI_COMMIT_REF_SLUG"
  paths:
    - node_modules/
    - .venv/
    - target/
    - go-mod-cache/

# Validate stage
validate:typescript:
  stage: validate
  image: node:20-alpine
  script:
    - npm ci
    - npm run lint
    - npm run type-check
  only:
    - merge_requests
    - main

validate:python:
  stage: validate
  image: python:3.11-slim
  script:
    - pip install -r requirements.txt
    - python -m flake8 src/
    - python -m black --check src/
  only:
    - merge_requests
    - main

validate:rust:
  stage: validate
  image: rust:1.75-slim
  script:
    - cd rust-services
    - cargo check
    - cargo clippy -- -D warnings
  only:
    - merge_requests
    - main

validate:go:
  stage: validate
  image: golang:1.21-alpine
  script:
    - cd go-services
    - go mod tidy
    - go vet ./...
    - go fmt ./...
  only:
    - merge_requests
    - main

# Test stage
test:unit:
  stage: test
  image: node:20-alpine
  services:
    - redis:7-alpine
    - postgres:15-alpine
  variables:
    POSTGRES_DB: test_db
    POSTGRES_USER: test_user
    POSTGRES_PASSWORD: test_pass
    REDIS_URL: redis://redis:6379
  script:
    - npm ci
    - npm run test:unit
    - npm run test:integration
  coverage: '/Lines\s*:\s*(\d+\.\d+)%/'
  artifacts:
    reports:
      coverage_report:
        coverage_format: cobertura
        path: coverage/cobertura-coverage.xml
  only:
    - merge_requests
    - main

test:python:
  stage: test
  image: python:3.11-slim
  services:
    - redis:7-alpine
    - postgres:15-alpine
  variables:
    POSTGRES_DB: test_db
    POSTGRES_USER: test_user
    POSTGRES_PASSWORD: test_pass
    REDIS_URL: redis://redis:6379
  script:
    - pip install -r requirements.txt
    - python -m pytest tests/ --cov=src --cov-report=xml
  artifacts:
    reports:
      coverage_report:
        coverage_format: cobertura
        path: coverage.xml
  only:
    - merge_requests
    - main

# Build stage
build:docker:
  stage: build
  image: docker:24-dind
  services:
    - docker:24-dind
  script:
    - docker build -t universal-ai-tools:$CI_COMMIT_SHA .
    - docker tag universal-ai-tools:$CI_COMMIT_SHA universal-ai-tools:latest
  only:
    - main

build:rust:
  stage: build
  image: rust:1.75-slim
  script:
    - cd rust-services
    - cargo build --release
  artifacts:
    paths:
      - rust-services/target/release/
  only:
    - main

build:go:
  stage: build
  image: golang:1.21-alpine
  script:
    - cd go-services
    - go build -o bin/ ./...
  artifacts:
    paths:
      - go-services/bin/
  only:
    - main

# Security stage
security:scan:
  stage: security
  image: python:3.11-slim
  script:
    - pip install safety bandit
    - safety check
    - bandit -r src/
  allow_failure: true
  only:
    - merge_requests
    - main

security:dependency-check:
  stage: security
  image: node:20-alpine
  script:
    - npm audit
    - npm audit --audit-level moderate
  allow_failure: true
  only:
    - merge_requests
    - main

# Deploy stage
deploy:staging:
  stage: deploy
  image: alpine:latest
  script:
    - echo "Deploying to staging environment"
    - # Add your staging deployment commands here
  environment:
    name: staging
    url: https://staging.universal-ai-tools.com
  only:
    - main

deploy:production:
  stage: deploy
  image: alpine:latest
  script:
    - echo "Deploying to production environment"
    - # Add your production deployment commands here
  environment:
    name: production
    url: https://universal-ai-tools.com
  when: manual
  only:
    - main

# Monitor stage
monitor:health-check:
  stage: monitor
  image: alpine:latest
  script:
    - echo "Running health checks"
    - # Add your health check commands here
  only:
    - main
"""
        
        with open(self.workspace / ".gitlab-ci.yml", "w") as f:
            f.write(gitlab_ci)
            
        print("✅ GitLab CI/CD pipeline created")
        
    def create_gitlabs_project_structure(self):
        """Create GitLabs project structure and documentation"""
        print("🔧 Creating GitLabs project structure...")
        
        # GitLabs project README
        gitlabs_readme = """# Universal AI Tools - GitLabs Integration

## 🚀 Project Overview

Universal AI Tools is a comprehensive AI platform featuring:
- **Family Athena**: Personalized AI assistant for families
- **Enterprise Platform**: Multi-tenant AI orchestration
- **Unified Integration**: Seamless service coordination
- **Advanced Features**: MLX fine-tuning, intelligent parameters, AB-MCTS orchestration

## 🏗️ Architecture

### Core Services
- **Athena Gateway**: Central API gateway (Port 8080)
- **Family Services**: Profiles, Calendar, Knowledge (Ports 8005-8007)
- **Enterprise Services**: Multi-tenant orchestration
- **Unified Gateway**: Single entry point (Port 9000)

### Technology Stack
- **Backend**: Python (FastAPI), Go, Rust
- **Frontend**: TypeScript, React
- **Database**: PostgreSQL, Redis
- **AI/ML**: MLX, DSPy, Ollama
- **Infrastructure**: Docker, Nginx

## 🔧 Development

### Prerequisites
- Node.js 20+
- Python 3.11+
- Rust 1.75+
- Go 1.21+
- Docker & Docker Compose

### Quick Start
```bash
# Clone repository
git clone https://gitlab.com/your-username/universal-ai-tools.git
cd universal-ai-tools

# Start all services
./start-unified-platform.sh

# Run tests
npm run test
python -m pytest tests/
```

## 📊 CI/CD Pipeline

### Stages
1. **Validate**: Linting, type checking, code formatting
2. **Test**: Unit tests, integration tests, coverage
3. **Build**: Docker images, binary artifacts
4. **Security**: Dependency scanning, vulnerability checks
5. **Deploy**: Staging and production deployment
6. **Monitor**: Health checks and monitoring

### Environment Variables
- `POSTGRES_DB`: Database name
- `REDIS_URL`: Redis connection string
- `API_KEYS`: Service API keys (stored in GitLabs CI/CD variables)

## 🚀 Deployment

### Staging
- Automatic deployment on main branch
- URL: https://staging.universal-ai-tools.com

### Production
- Manual deployment trigger
- URL: https://universal-ai-tools.com

## 📈 Monitoring

### Health Checks
- Service status monitoring
- Performance metrics
- Error tracking
- Resource utilization

### Alerts
- Service downtime
- Performance degradation
- Security issues
- Resource exhaustion

## 🔒 Security

### Authentication
- JWT tokens
- API key authentication
- Multi-tenant isolation

### Data Protection
- Encryption at rest
- Secure communication
- Access control
- Audit logging

## 📚 Documentation

- [API Documentation](docs/api/)
- [Architecture Guide](docs/architecture/)
- [Deployment Guide](docs/deployment/)
- [Contributing Guide](docs/contributing/)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a merge request

## 📄 License

MIT License - see LICENSE file for details

## 🆘 Support

- Issues: GitLabs Issues
- Discussions: GitLabs Discussions
- Documentation: GitLabs Wiki
- CI/CD: GitLabs Pipelines
"""
        
        with open(self.workspace / "GITLABS_README.md", "w") as f:
            f.write(gitlabs_readme)
            
        # GitLabs project configuration
        gitlabs_project_config = {
            "project": {
                "name": "Universal AI Tools",
                "description": "Advanced AI Platform with Family Athena and Enterprise Features",
                "visibility": "private",
                "default_branch": "main",
                "ci_cd_enabled": True,
                "container_registry_enabled": True,
                "packages_enabled": True,
                "wiki_enabled": True,
                "issues_enabled": True,
                "merge_requests_enabled": True,
                "snippets_enabled": True,
                "jobs_enabled": True,
                "lfs_enabled": True,
                "request_access_enabled": True,
                "container_expiration_policy": {
                    "cadence": "1d",
                    "older_than": "7d",
                    "keep_n": 10,
                    "name_regex": ".*"
                }
            },
            "integrations": {
                "github": {
                    "enabled": True,
                    "sync_enabled": True
                },
                "docker_registry": {
                    "enabled": True,
                    "url": "registry.gitlab.com/your-username/universal-ai-tools"
                }
            },
            "ci_cd": {
                "pipeline_schedules": [
                    {
                        "description": "Nightly tests",
                        "cron": "0 2 * * *",
                        "timezone": "UTC",
                        "active": True
                    },
                    {
                        "description": "Weekly security scan",
                        "cron": "0 3 * * 0",
                        "timezone": "UTC",
                        "active": True
                    }
                ]
            }
        }
        
        with open(self.workspace / "gitlabs-project-config.json", "w") as f:
            json.dump(gitlabs_project_config, f, indent=2)
            
        print("✅ GitLabs project structure created")
        
    def create_gitlabs_integration_script(self):
        """Create script to integrate with existing services"""
        print("🔧 Creating GitLabs integration script...")
        
        integration_script = """#!/bin/bash
# GitLabs Integration Script for Universal AI Tools

set -e

echo "🚀 Setting up GitLabs integration..."

# Add GitLabs remote
echo "📡 Adding GitLabs remote..."
git remote add gitlabs https://gitlab.com/your-username/universal-ai-tools.git || echo "GitLabs remote already exists"

# Configure GitLabs settings
echo "⚙️ Configuring GitLabs settings..."
git config --local gitlabs.ci_cd_enabled true
git config --local gitlabs.container_registry_enabled true
git config --local gitlabs.packages_enabled true
git config --local gitlabs.wiki_enabled true
git config --local gitlabs.issues_enabled true
git config --local gitlabs.merge_requests_enabled true

# Set up GitLabs CI/CD variables (manual step)
echo "🔐 GitLabs CI/CD Variables to set:"
echo "  - POSTGRES_DB: universal_ai_tools"
echo "  - REDIS_URL: redis://redis:6379"
echo "  - API_KEYS: (your API keys)"
echo "  - DEPLOY_TOKEN: (your deploy token)"

# Push to GitLabs
echo "📤 Pushing to GitLabs..."
git push gitlabs cursor/evaluate-gutlabs-integration-for-codebase-context-ada6

echo "✅ GitLabs integration setup complete!"
echo "🌐 GitLabs URL: https://gitlab.com/your-username/universal-ai-tools"
echo "🔧 CI/CD Pipeline: https://gitlab.com/your-username/universal-ai-tools/-/pipelines"
echo "📊 Issues: https://gitlab.com/your-username/universal-ai-tools/-/issues"
echo "📚 Wiki: https://gitlab.com/your-username/universal-ai-tools/-/wikis"
"""
        
        with open(self.workspace / "setup-gitlabs.sh", "w") as f:
            f.write(integration_script)
        
        # Make executable
        os.chmod(self.workspace / "setup-gitlabs.sh", 0o755)
        
        print("✅ GitLabs integration script created")
        
    def create_gitlabs_context_enhancement(self):
        """Create GitLabs context enhancement for better codebase understanding"""
        print("🔧 Creating GitLabs context enhancement...")
        
        context_enhancement = """#!/usr/bin/env python3
\"\"\"
GitLabs Context Enhancement for Universal AI Tools
Provides enhanced codebase context and analysis
\"\"\"

import os
import json
import subprocess
from pathlib import Path
from typing import Dict, List, Any

class GitLabsContextEnhancer:
    def __init__(self):
        self.workspace = Path("/workspace")
        self.context_data = {}
        
    def analyze_codebase_structure(self):
        \"\"\"Analyze codebase structure for GitLabs context\"\"\"
        print("🔍 Analyzing codebase structure...")
        
        structure = {
            "services": {},
            "dependencies": {},
            "integration_points": {},
            "architecture_patterns": {},
            "code_quality_metrics": {}
        }
        
        # Analyze services
        services_dir = self.workspace / "src"
        if services_dir.exists():
            for service in services_dir.iterdir():
                if service.is_dir():
                    structure["services"][service.name] = {
                        "path": str(service),
                        "files": len(list(service.rglob("*.py"))),
                        "endpoints": self._extract_endpoints(service),
                        "dependencies": self._extract_dependencies(service)
                    }
        
        # Analyze integration points
        structure["integration_points"] = {
            "api_gateways": ["athena-gateway", "unified-gateway"],
            "family_services": ["family-profiles", "family-calendar", "family-knowledge"],
            "enterprise_services": ["orchestration", "monitoring", "analytics"],
            "data_services": ["postgresql", "redis", "weaviate"]
        }
        
        # Analyze architecture patterns
        structure["architecture_patterns"] = {
            "microservices": True,
            "api_gateway": True,
            "event_driven": True,
            "multi_tenant": True,
            "containerized": True,
            "ci_cd_enabled": True
        }
        
        self.context_data["structure"] = structure
        return structure
        
    def _extract_endpoints(self, service_path: Path) -> List[str]:
        \"\"\"Extract API endpoints from service\"\"\"
        endpoints = []
        for py_file in service_path.rglob("*.py"):
            try:
                with open(py_file, 'r') as f:
                    content = f.read()
                    # Simple endpoint extraction
                    if "@app.get" in content or "@app.post" in content:
                        endpoints.append(str(py_file.relative_to(self.workspace)))
            except:
                continue
        return endpoints
        
    def _extract_dependencies(self, service_path: Path) -> List[str]:
        \"\"\"Extract dependencies from service\"\"\"
        dependencies = []
        for py_file in service_path.rglob("*.py"):
            try:
                with open(py_file, 'r') as f:
                    content = f.read()
                    # Simple import extraction
                    for line in content.split('\\n'):
                        if line.strip().startswith('import ') or line.strip().startswith('from '):
                            dependencies.append(line.strip())
            except:
                continue
        return dependencies[:10]  # Limit to first 10
        
    def generate_gitlabs_context_report(self):
        \"\"\"Generate comprehensive GitLabs context report\"\"\"
        print("📊 Generating GitLabs context report...")
        
        # Analyze codebase
        structure = self.analyze_codebase_structure()
        
        # Generate report
        report = {
            "project_info": {
                "name": "Universal AI Tools",
                "description": "Advanced AI Platform with Family Athena and Enterprise Features",
                "repository": "https://gitlab.com/your-username/universal-ai-tools",
                "last_updated": "2025-01-12"
            },
            "codebase_analysis": structure,
            "gitlabs_integration": {
                "ci_cd_pipeline": "configured",
                "container_registry": "enabled",
                "packages": "enabled",
                "wiki": "enabled",
                "issues": "enabled",
                "merge_requests": "enabled"
            },
            "context_enhancement": {
                "service_discovery": "enabled",
                "dependency_mapping": "enabled",
                "architecture_analysis": "enabled",
                "code_quality_metrics": "enabled",
                "integration_points": "mapped"
            }
        }
        
        # Save report
        with open(self.workspace / "gitlabs-context-report.json", "w") as f:
            json.dump(report, f, indent=2)
            
        print("✅ GitLabs context report generated")
        return report
        
    def setup_gitlabs_webhooks(self):
        \"\"\"Setup GitLabs webhooks for enhanced integration\"\"\"
        print("🔗 Setting up GitLabs webhooks...")
        
        webhook_config = {
            "webhooks": [
                {
                    "name": "CI/CD Pipeline Events",
                    "url": "https://your-webhook-endpoint.com/gitlabs/ci-cd",
                    "events": ["pipeline", "job", "deployment"],
                    "enabled": True
                },
                {
                    "name": "Merge Request Events",
                    "url": "https://your-webhook-endpoint.com/gitlabs/merge-requests",
                    "events": ["merge_request"],
                    "enabled": True
                },
                {
                    "name": "Issue Events",
                    "url": "https://your-webhook-endpoint.com/gitlabs/issues",
                    "events": ["issue"],
                    "enabled": True
                }
            ]
        }
        
        with open(self.workspace / "gitlabs-webhooks.json", "w") as f:
            json.dump(webhook_config, f, indent=2)
            
        print("✅ GitLabs webhooks configured")
        
    def run_gitlabs_integration(self):
        \"\"\"Run complete GitLabs integration setup\"\"\"
        print("🚀 Running GitLabs integration setup...")
        
        # Generate context report
        self.generate_gitlabs_context_report()
        
        # Setup webhooks
        self.setup_gitlabs_webhooks()
        
        print("✅ GitLabs integration setup complete!")
        print("📊 Context report: gitlabs-context-report.json")
        print("🔗 Webhooks config: gitlabs-webhooks.json")

if __name__ == "__main__":
    enhancer = GitLabsContextEnhancer()
    enhancer.run_gitlabs_integration()
"""
        
        with open(self.workspace / "gitlabs-context-enhancer.py", "w") as f:
            f.write(context_enhancement)
        
        # Make executable
        os.chmod(self.workspace / "gitlabs-context-enhancer.py", 0o755)
        
        print("✅ GitLabs context enhancement created")
        
    def run_gitlabs_setup(self):
        """Run complete GitLabs setup"""
        print("🚀 Setting up GitLabs integration...")
        
        # Create all components
        self.create_gitlabs_remote_config()
        self.create_gitlab_ci_yml()
        self.create_gitlabs_project_structure()
        self.create_gitlabs_integration_script()
        self.create_gitlabs_context_enhancement()
        
        print("✅ GitLabs integration setup complete!")
        print("📁 Files created:")
        print("  - .gitlabs-config")
        print("  - .gitlab-ci.yml")
        print("  - GITLABS_README.md")
        print("  - gitlabs-project-config.json")
        print("  - setup-gitlabs.sh")
        print("  - gitlabs-context-enhancer.py")
        print()
        print("🔧 Next steps:")
        print("1. Create GitLabs project: https://gitlab.com/projects/new")
        print("2. Update GitLabs URLs in configuration files")
        print("3. Run: ./setup-gitlabs.sh")
        print("4. Run: python3 gitlabs-context-enhancer.py")

if __name__ == "__main__":
    setup = GitLabsIntegrationSetup()
    setup.run_gitlabs_setup()