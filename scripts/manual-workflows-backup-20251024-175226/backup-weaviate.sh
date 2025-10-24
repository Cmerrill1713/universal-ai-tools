#!/bin/bash

# Weaviate Backup Script
# This script creates backups of Weaviate data and manages retention

set -e

# Configuration
WEAVIATE_URL="${WEAVIATE_URL:-http://localhost:8090}"
WEAVIATE_API_KEY="${WEAVIATE_API_KEY}"
BACKUP_DIR="${BACKUP_DIR:-/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"
BACKUP_ID="backup-$(date +%Y%m%d-%H%M%S)"
S3_ENABLED="${BACKUP_S3_ENABLED:-false}"
S3_BUCKET="${BACKUP_S3_BUCKET}"
S3_ENDPOINT="${BACKUP_S3_ENDPOINT}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to log messages
log() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')] ERROR:${NC} $1" >&2
}

warning() {
    echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')] WARNING:${NC} $1"
}

# Check if Weaviate is accessible
check_weaviate() {
    log "Checking Weaviate connectivity..."
    
    HEADERS=""
    if [ ! -z "$WEAVIATE_API_KEY" ]; then
        HEADERS="-H 'Authorization: Bearer $WEAVIATE_API_KEY'"
    fi
    
    if curl -s -f $HEADERS "$WEAVIATE_URL/v1/.well-known/ready" > /dev/null; then
        log "Weaviate is accessible at $WEAVIATE_URL"
        return 0
    else
        error "Cannot connect to Weaviate at $WEAVIATE_URL"
        return 1
    fi
}

# Create filesystem backup
create_filesystem_backup() {
    log "Creating filesystem backup: $BACKUP_ID"
    
    AUTH_HEADER=""
    if [ ! -z "$WEAVIATE_API_KEY" ]; then
        AUTH_HEADER="Authorization: Bearer $WEAVIATE_API_KEY"
    fi
    
    # Create backup via Weaviate API
    RESPONSE=$(curl -s -X POST \
        -H "Content-Type: application/json" \
        -H "$AUTH_HEADER" \
        -d "{
            \"id\": \"$BACKUP_ID\",
            \"backend\": \"filesystem\",
            \"include\": [\"*\"],
            \"exclude\": []
        }" \
        "$WEAVIATE_URL/v1/backups/filesystem")
    
    # Check if backup was created successfully
    if echo "$RESPONSE" | grep -q "error"; then
        error "Backup creation failed: $RESPONSE"
        return 1
    fi
    
    log "Backup initiated: $BACKUP_ID"
    
    # Wait for backup to complete
    wait_for_backup "filesystem"
}

# Create S3 backup
create_s3_backup() {
    if [ "$S3_ENABLED" != "true" ]; then
        warning "S3 backup is not enabled"
        return 0
    fi
    
    if [ -z "$S3_BUCKET" ]; then
        error "S3_BUCKET not set"
        return 1
    fi
    
    log "Creating S3 backup: $BACKUP_ID"
    
    AUTH_HEADER=""
    if [ ! -z "$WEAVIATE_API_KEY" ]; then
        AUTH_HEADER="Authorization: Bearer $WEAVIATE_API_KEY"
    fi
    
    # Create S3 backup via Weaviate API
    RESPONSE=$(curl -s -X POST \
        -H "Content-Type: application/json" \
        -H "$AUTH_HEADER" \
        -d "{
            \"id\": \"$BACKUP_ID\",
            \"backend\": \"s3\",
            \"include\": [\"*\"],
            \"exclude\": []
        }" \
        "$WEAVIATE_URL/v1/backups/s3/$S3_BUCKET")
    
    if echo "$RESPONSE" | grep -q "error"; then
        error "S3 backup creation failed: $RESPONSE"
        return 1
    fi
    
    log "S3 backup initiated: $BACKUP_ID"
    
    # Wait for backup to complete
    wait_for_backup "s3/$S3_BUCKET"
}

# Wait for backup to complete
wait_for_backup() {
    local BACKEND=$1
    local MAX_WAIT=3600  # 1 hour timeout
    local ELAPSED=0
    local INTERVAL=10
    
    AUTH_HEADER=""
    if [ ! -z "$WEAVIATE_API_KEY" ]; then
        AUTH_HEADER="-H 'Authorization: Bearer $WEAVIATE_API_KEY'"
    fi
    
    log "Waiting for backup to complete..."
    
    while [ $ELAPSED -lt $MAX_WAIT ]; do
        STATUS_RESPONSE=$(curl -s $AUTH_HEADER "$WEAVIATE_URL/v1/backups/$BACKEND/$BACKUP_ID")
        
        if echo "$STATUS_RESPONSE" | grep -q "\"status\":\"SUCCESS\""; then
            log "Backup completed successfully!"
            return 0
        elif echo "$STATUS_RESPONSE" | grep -q "\"status\":\"FAILED\""; then
            error "Backup failed: $STATUS_RESPONSE"
            return 1
        fi
        
        sleep $INTERVAL
        ELAPSED=$((ELAPSED + INTERVAL))
        
        if [ $((ELAPSED % 60)) -eq 0 ]; then
            log "Still waiting... ($((ELAPSED / 60)) minutes elapsed)"
        fi
    done
    
    error "Backup timed out after $MAX_WAIT seconds"
    return 1
}

# Clean up old backups
cleanup_old_backups() {
    log "Cleaning up backups older than $RETENTION_DAYS days..."
    
    if [ -d "$BACKUP_DIR" ]; then
        find "$BACKUP_DIR" -name "backup-*" -type d -mtime +$RETENTION_DAYS -exec rm -rf {} \; 2>/dev/null || true
        log "Cleanup completed"
    fi
    
    # If S3 is enabled, list and potentially delete old S3 backups
    if [ "$S3_ENABLED" == "true" ] && [ ! -z "$S3_BUCKET" ]; then
        cleanup_s3_backups
    fi
}

# Clean up old S3 backups
cleanup_s3_backups() {
    log "Checking S3 backups for cleanup..."
    
    AUTH_HEADER=""
    if [ ! -z "$WEAVIATE_API_KEY" ]; then
        AUTH_HEADER="-H 'Authorization: Bearer $WEAVIATE_API_KEY'"
    fi
    
    # List S3 backups
    BACKUPS=$(curl -s $AUTH_HEADER "$WEAVIATE_URL/v1/backups/s3/$S3_BUCKET" | jq -r '.[] | .id')
    
    for backup in $BACKUPS; do
        # Parse backup date from ID (assuming format: backup-YYYYMMDD-HHMMSS)
        if [[ $backup =~ backup-([0-9]{8}) ]]; then
            BACKUP_DATE="${BASH_REMATCH[1]}"
            BACKUP_EPOCH=$(date -d "$BACKUP_DATE" +%s 2>/dev/null || echo 0)
            CURRENT_EPOCH=$(date +%s)
            AGE_DAYS=$(( (CURRENT_EPOCH - BACKUP_EPOCH) / 86400 ))
            
            if [ $AGE_DAYS -gt $RETENTION_DAYS ]; then
                log "Deleting old S3 backup: $backup (age: $AGE_DAYS days)"
                # Note: Weaviate doesn't have a direct API to delete S3 backups
                # You would need to use AWS CLI or SDK here
            fi
        fi
    done
}

# Get backup statistics
get_backup_stats() {
    log "Gathering backup statistics..."
    
    AUTH_HEADER=""
    if [ ! -z "$WEAVIATE_API_KEY" ]; then
        AUTH_HEADER="-H 'Authorization: Bearer $WEAVIATE_API_KEY'"
    fi
    
    # Get filesystem backups
    if [ -d "$BACKUP_DIR" ]; then
        FS_COUNT=$(find "$BACKUP_DIR" -name "backup-*" -type d 2>/dev/null | wc -l)
        FS_SIZE=$(du -sh "$BACKUP_DIR" 2>/dev/null | cut -f1)
        log "Filesystem backups: $FS_COUNT (Total size: $FS_SIZE)"
    fi
    
    # Get Weaviate statistics
    STATS=$(curl -s $AUTH_HEADER "$WEAVIATE_URL/v1/meta")
    if [ ! -z "$STATS" ]; then
        OBJECT_COUNT=$(echo "$STATS" | jq -r '.objectCount // 0')
        log "Weaviate objects: $OBJECT_COUNT"
    fi
}

# Verify backup integrity
verify_backup() {
    log "Verifying backup integrity..."
    
    AUTH_HEADER=""
    if [ ! -z "$WEAVIATE_API_KEY" ]; then
        AUTH_HEADER="-H 'Authorization: Bearer $WEAVIATE_API_KEY'"
    fi
    
    # Check backup status
    STATUS=$(curl -s $AUTH_HEADER "$WEAVIATE_URL/v1/backups/filesystem/$BACKUP_ID" | jq -r '.status')
    
    if [ "$STATUS" == "SUCCESS" ]; then
        log "Backup verification passed"
        return 0
    else
        error "Backup verification failed: Status is $STATUS"
        return 1
    fi
}

# Send notification (customize based on your notification system)
send_notification() {
    local STATUS=$1
    local MESSAGE=$2
    
    # Example: Send to webhook
    if [ ! -z "$NOTIFICATION_WEBHOOK" ]; then
        curl -s -X POST "$NOTIFICATION_WEBHOOK" \
            -H "Content-Type: application/json" \
            -d "{
                \"status\": \"$STATUS\",
                \"message\": \"$MESSAGE\",
                \"backup_id\": \"$BACKUP_ID\",
                \"timestamp\": \"$(date -Iseconds)\"
            }"
    fi
    
    # Example: Send email (requires mail/sendmail configured)
    if [ ! -z "$NOTIFICATION_EMAIL" ]; then
        echo "$MESSAGE" | mail -s "Weaviate Backup $STATUS - $BACKUP_ID" "$NOTIFICATION_EMAIL"
    fi
}

# Main execution
main() {
    log "Starting Weaviate backup process..."
    
    # Check prerequisites
    if ! check_weaviate; then
        send_notification "FAILED" "Cannot connect to Weaviate"
        exit 1
    fi
    
    # Create filesystem backup
    if create_filesystem_backup; then
        log "Filesystem backup successful"
    else
        error "Filesystem backup failed"
        send_notification "FAILED" "Filesystem backup failed for $BACKUP_ID"
        exit 1
    fi
    
    # Create S3 backup if enabled
    if [ "$S3_ENABLED" == "true" ]; then
        if create_s3_backup; then
            log "S3 backup successful"
        else
            warning "S3 backup failed, but continuing..."
        fi
    fi
    
    # Verify backup
    verify_backup
    
    # Clean up old backups
    cleanup_old_backups
    
    # Get statistics
    get_backup_stats
    
    # Send success notification
    send_notification "SUCCESS" "Backup $BACKUP_ID completed successfully"
    
    log "Backup process completed successfully!"
}

# Run main function
main