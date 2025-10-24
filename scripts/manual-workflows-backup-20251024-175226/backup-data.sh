#!/bin/bash

# Universal AI Tools Data Backup Script

BACKUP_DIR="$HOME/Desktop/universal-ai-tools/backups"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="universal-ai-backup-$DATE"

echo "💾 Universal AI Tools Data Backup"
echo "=================================="
echo ""

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Backup Supabase data
echo "🗄️  Backing up Supabase database..."
if command -v supabase >/dev/null 2>&1; then
    cd ~/supabase 2>/dev/null || {
        echo "❌ Supabase directory not found at ~/supabase"
        exit 1
    }
    
    if supabase db dump > "$BACKUP_DIR/${BACKUP_NAME}_supabase.sql"; then
        echo "✅ Supabase backup completed"
    else
        echo "❌ Supabase backup failed"
    fi
else
    echo "⚠️  Supabase CLI not found, skipping database backup"
fi

# Backup configuration files
echo "⚙️  Backing up configuration files..."
CONFIG_BACKUP="$BACKUP_DIR/${BACKUP_NAME}_config.tar.gz"

tar -czf "$CONFIG_BACKUP" \
    -C ~/Desktop/universal-ai-tools .env 2>/dev/null || true \
    -C ~/Desktop/universal-ai-tools/src/schema universal-schema.sql 2>/dev/null || true \
    -C "$HOME/Library/Application Support/Claude" claude_desktop_config.json 2>/dev/null || true

if [ -f "$CONFIG_BACKUP" ]; then
    echo "✅ Configuration backup completed"
else
    echo "❌ Configuration backup failed"
fi

# Backup custom tools and memory data
echo "🛠️  Backing up custom data..."
CUSTOM_BACKUP="$BACKUP_DIR/${BACKUP_NAME}_custom.tar.gz"

# Create a manifest of what we're backing up
echo "# Universal AI Tools Backup Manifest" > "$BACKUP_DIR/${BACKUP_NAME}_manifest.txt"
echo "# Created: $(date)" >> "$BACKUP_DIR/${BACKUP_NAME}_manifest.txt"
echo "# Backup: $BACKUP_NAME" >> "$BACKUP_DIR/${BACKUP_NAME}_manifest.txt"
echo "" >> "$BACKUP_DIR/${BACKUP_NAME}_manifest.txt"

if [ -d ~/Desktop/universal-ai-tools/docs ]; then
    echo "📚 Documentation files" >> "$BACKUP_DIR/${BACKUP_NAME}_manifest.txt"
    ls -la ~/Desktop/universal-ai-tools/docs/ >> "$BACKUP_DIR/${BACKUP_NAME}_manifest.txt"
fi

echo "✅ Backup manifest created"

# List all backups
echo ""
echo "📋 Available backups:"
ls -la "$BACKUP_DIR" | grep "universal-ai-backup"

echo ""
echo "🎉 Backup completed successfully!"
echo "📁 Backup location: $BACKUP_DIR"
echo "📄 Files created:"
echo "   - ${BACKUP_NAME}_supabase.sql (database)"
echo "   - ${BACKUP_NAME}_config.tar.gz (configuration)"
echo "   - ${BACKUP_NAME}_manifest.txt (backup info)"
echo ""
echo "💡 To restore: Use the restore-data.sh script"