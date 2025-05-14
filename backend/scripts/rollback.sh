#!/bin/bash

# This script performs a rollback to the previous working version
TIMESTAMP=$(date +%Y%m%d%H%M%S)
CURRENT_RELEASE=$(readlink -f ~/ato/current)

# Find the second newest release (previous version)
PREV_RELEASE=$(find ~/ato/releases -maxdepth 1 -mindepth 1 -type d | sort -r | sed -n 2p)

# Check if we have a backup to restore
if [ -z "$PREV_RELEASE" ] && [ ! -d ~/ato/backups ]; then
    echo "No previous release or backup found to roll back to!"
    exit 1
fi

echo "Rolling back from $CURRENT_RELEASE"

# If no previous release but we have a backup
if [ -z "$PREV_RELEASE" ] && [ -d ~/ato/backups ]; then
    LATEST_BACKUP=$(find ~/ato/backups -name "backup-*.tar.gz" -type f | sort -r | head -n1)
    if [ -n "$LATEST_BACKUP" ]; then
        echo "Using backup: $LATEST_BACKUP"
        mkdir -p ~/ato/releases/rollback-$TIMESTAMP
        tar -xzf $LATEST_BACKUP -C ~/ato/releases/rollback-$TIMESTAMP
        PREV_RELEASE=~/ato/releases/rollback-$TIMESTAMP
    else
        echo "No backups found!"
        exit 1
    fi
else
    echo "Using previous release: $PREV_RELEASE"
fi

# Update current symlink to previous release
ln -sfn $PREV_RELEASE ~/ato/current
echo "Updated current symlink to: $(readlink -f ~/ato/current)"

# Restart application
cd ~/ato/current/backend
pm2 stop invoice-ocr-backend || true
pm2 delete invoice-ocr-backend || true
pm2 start server.js --name invoice-ocr-backend
pm2 save

echo "Rollback completed successfully"
