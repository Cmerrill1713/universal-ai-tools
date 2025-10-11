# DEPRECATED: Go LLM Router Service

This service has been deprecated and replaced by the Rust LLM Router.

## Migration Information

- **Old Service**: go-services/llm-router-service (Port 3040)
- **New Service**: crates/llm-router (Port 3031)
- **Migration Date**: Thu Sep 11 21:31:04 CDT 2025

## What Changed

- All routing now goes through the Rust LLM Router
- Port changed from 3040 to 3031
- Improved performance and streaming capabilities
- Better provider management

## For Developers

If you were using this service directly, update your client code to:
- Use port 3031 instead of 3040
- Update service discovery to use 'llm-router' instead of 'llm-router-service'

## Rollback

If you need to rollback, the original files are backed up in:
/Users/christianmerrill/Desktop/universal-ai-tools/backups/llm_router_migration_20250911_213104

