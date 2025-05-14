#!/bin/bash

# This script performs a rollback to the previous working version
TIMESTAMP=$(date +%Y%m%d%H%M%S)
CURRENT_RELEASE=$(readlink -f ~/ato/current)
echo "Current release: $CURRENT_RELEASE"

# Find the most recent successful deployment
echo "Looking for successful deployments..."
SUCCESSFUL_RELEASE=""
for release_dir in $(find ~/ato/releases -maxdepth 1 -mindepth 1 -type d | sort -r); do
    if [ "$release_dir" != "$CURRENT_RELEASE" ] && [ -f "$release_dir/.deployment-successful" ]; then
        SUCCESSFUL_RELEASE=$release_dir
        echo "Found successful deployment: $SUCCESSFUL_RELEASE"
        echo "Last successful on: $(cat $SUCCESSFUL_RELEASE/.deployment-successful)"
        break
    fi
done

# If no successful releases found, try using backups
if [ -z "$SUCCESSFUL_RELEASE" ]; then
    echo "No successful releases found, checking backups..."
    if [ -d ~/ato/backups ]; then
        LATEST_BACKUP=$(find ~/ato/backups -name "backup-*.tar.gz" -type f | sort -r | head -n1)
        if [ -n "$LATEST_BACKUP" ]; then
            echo "Using backup: $LATEST_BACKUP"
            mkdir -p ~/ato/releases/rollback-$TIMESTAMP
            tar -xzf $LATEST_BACKUP -C ~/ato/releases/rollback-$TIMESTAMP
            SUCCESSFUL_RELEASE=~/ato/releases/rollback-$TIMESTAMP
        else
            echo "No backups found!"
            exit 1
        fi
    else
        echo "No backups directory found!"
        exit 1
    fi
fi

# If still no successful release, fallback to previous release as last resort
if [ -z "$SUCCESSFUL_RELEASE" ]; then
    echo "WARNING: No marked successful releases found. Falling back to previous release as last resort."
    SUCCESSFUL_RELEASE=$(find ~/ato/releases -maxdepth 1 -mindepth 1 -type d | grep -v "$CURRENT_RELEASE" | sort -r | head -n1)

    if [ -z "$SUCCESSFUL_RELEASE" ]; then
        echo "No previous release found to roll back to!"
        exit 1
    fi

    echo "Using previous release as fallback: $SUCCESSFUL_RELEASE"
fi

# Update current symlink to successful release
ln -sfn $SUCCESSFUL_RELEASE ~/ato/current
echo "Updated current symlink to: $(readlink -f ~/ato/current)"

# Restart application
cd ~/ato/current/backend
pm2 stop invoice-ocr-backend || true
pm2 delete invoice-ocr-backend || true
pm2 start server.js --name invoice-ocr-backend
pm2 save

echo "Rollback completed successfully"
