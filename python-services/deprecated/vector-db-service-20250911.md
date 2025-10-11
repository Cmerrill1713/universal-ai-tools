# DEPRECATED: Python Vector DB Service

This service has been deprecated and replaced by the Rust Vector DB service.

## Migration Information

- **Old Service**: python-services/vector-db-service.py (Port 3035)
- **New Service**: crates/vector-db (Port 3034)
- **Migration Date**: Thu Sep 11 21:32:53 CDT 2025

## What Changed

- All vector operations now go through the Rust Vector DB service
- Port changed from 3035 to 3034
- Improved performance and memory efficiency
- Better integration with other Rust services

## For Developers

If you were using this service directly, update your client code to:
- Use port 3034 instead of 3035
- Update service discovery to use 'vector-db' instead of 'vector-db-service.py'

## Alternative Services

- **Rust Vector DB**: crates/vector-db (Port 3034) - Primary vector operations
- **Go Weaviate Client**: go-services/weaviate-client (Port 8090) - Weaviate integration

## Rollback

If you need to rollback, the original files are backed up in:
/Users/christianmerrill/Desktop/universal-ai-tools/backups/python_vector_db_removal_20250911_213253

