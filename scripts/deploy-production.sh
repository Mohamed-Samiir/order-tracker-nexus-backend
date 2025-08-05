#!/bin/bash

# Production Deployment Script for Order Tracker Nexus
# This script handles the complete deployment process for both frontend and backend

set -e  # Exit on any error

# Configuration
BACKEND_DIR="backend/order-tracker-nexus-backend"
FRONTEND_DIR="."
BACKUP_DIR="/var/backups/order-tracker"
LOG_FILE="/var/log/order-tracker/deploy.log"
DEPLOY_USER="deploy"
APP_NAME="order-tracker-nexus"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR:${NC} $1" | tee -a "$LOG_FILE"
    exit 1
}

warning() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING:${NC} $1" | tee -a "$LOG_FILE"
}

info() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] INFO:${NC} $1" | tee -a "$LOG_FILE"
}

# Check if running as correct user
check_user() {
    if [ "$USER" != "$DEPLOY_USER" ]; then
        error "This script must be run as the $DEPLOY_USER user"
    fi
}

# Check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."
    
    # Check if Node.js is installed
    if ! command -v node &> /dev/null; then
        error "Node.js is not installed"
    fi
    
    # Check if npm is installed
    if ! command -v npm &> /dev/null; then
        error "npm is not installed"
    fi
    
    # Check if PM2 is installed
    if ! command -v pm2 &> /dev/null; then
        error "PM2 is not installed. Install with: npm install -g pm2"
    fi
    
    # Check if MySQL is running
    if ! systemctl is-active --quiet mysql; then
        error "MySQL service is not running"
    fi
    
    # Check if required directories exist
    if [ ! -d "$BACKEND_DIR" ]; then
        error "Backend directory not found: $BACKEND_DIR"
    fi
    
    # Create backup directory if it doesn't exist
    sudo mkdir -p "$BACKUP_DIR"
    sudo chown "$DEPLOY_USER:$DEPLOY_USER" "$BACKUP_DIR"
    
    # Create log directory if it doesn't exist
    sudo mkdir -p "$(dirname "$LOG_FILE")"
    sudo chown "$DEPLOY_USER:$DEPLOY_USER" "$(dirname "$LOG_FILE")"
    
    log "Prerequisites check completed successfully"
}

# Create backup
create_backup() {
    log "Creating backup..."
    
    local backup_timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_path="$BACKUP_DIR/backup_$backup_timestamp"
    
    mkdir -p "$backup_path"
    
    # Backup current application
    if [ -d "/var/www/$APP_NAME" ]; then
        cp -r "/var/www/$APP_NAME" "$backup_path/app"
        log "Application backup created at $backup_path/app"
    fi
    
    # Backup database
    local db_name=$(grep "DB_NAME=" "$BACKEND_DIR/.env.production" | cut -d '=' -f2)
    local db_user=$(grep "DB_USERNAME=" "$BACKEND_DIR/.env.production" | cut -d '=' -f2)
    local db_password=$(grep "DB_PASSWORD=" "$BACKEND_DIR/.env.production" | cut -d '=' -f2)
    
    if [ -n "$db_name" ] && [ -n "$db_user" ]; then
        mysqldump -u "$db_user" -p"$db_password" "$db_name" > "$backup_path/database.sql"
        log "Database backup created at $backup_path/database.sql"
    fi
    
    # Keep only last 7 backups
    find "$BACKUP_DIR" -name "backup_*" -type d -mtime +7 -exec rm -rf {} \;
    
    echo "$backup_path" > /tmp/last_backup_path
    log "Backup completed successfully"
}

# Build backend
build_backend() {
    log "Building backend..."
    
    cd "$BACKEND_DIR"
    
    # Install dependencies
    npm ci --only=production
    
    # Build application
    npm run build:prod
    
    # Run database migrations
    npm run migration:prod
    
    log "Backend build completed successfully"
    cd - > /dev/null
}

# Build frontend
build_frontend() {
    log "Building frontend..."
    
    # Install dependencies
    npm ci --only=production
    
    # Build application
    npm run build:prod
    
    log "Frontend build completed successfully"
}

# Deploy backend
deploy_backend() {
    log "Deploying backend..."
    
    local deploy_path="/var/www/$APP_NAME/backend"
    
    # Create deployment directory
    sudo mkdir -p "$deploy_path"
    sudo chown "$DEPLOY_USER:$DEPLOY_USER" "$deploy_path"
    
    # Copy built application
    cp -r "$BACKEND_DIR/dist" "$deploy_path/"
    cp -r "$BACKEND_DIR/node_modules" "$deploy_path/"
    cp "$BACKEND_DIR/package.json" "$deploy_path/"
    cp "$BACKEND_DIR/.env.production" "$deploy_path/.env"
    cp "$BACKEND_DIR/ecosystem.config.js" "$deploy_path/"
    
    # Set correct permissions
    sudo chown -R "$DEPLOY_USER:$DEPLOY_USER" "$deploy_path"
    sudo chmod -R 755 "$deploy_path"
    
    log "Backend deployment completed successfully"
}

# Deploy frontend
deploy_frontend() {
    log "Deploying frontend..."
    
    local deploy_path="/var/www/$APP_NAME/frontend"
    
    # Create deployment directory
    sudo mkdir -p "$deploy_path"
    sudo chown "$DEPLOY_USER:$DEPLOY_USER" "$deploy_path"
    
    # Copy built application
    cp -r "dist/"* "$deploy_path/"
    
    # Set correct permissions
    sudo chown -R www-data:www-data "$deploy_path"
    sudo chmod -R 755 "$deploy_path"
    
    log "Frontend deployment completed successfully"
}

# Start services
start_services() {
    log "Starting services..."
    
    cd "/var/www/$APP_NAME/backend"
    
    # Stop existing PM2 processes
    pm2 stop "$APP_NAME" 2>/dev/null || true
    pm2 delete "$APP_NAME" 2>/dev/null || true
    
    # Start application with PM2
    pm2 start ecosystem.config.js --env production
    
    # Save PM2 configuration
    pm2 save
    
    # Setup PM2 startup script
    sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u "$DEPLOY_USER" --hp "/home/$DEPLOY_USER"
    
    log "Services started successfully"
}

# Health check
health_check() {
    log "Performing health check..."
    
    local max_attempts=30
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if curl -f http://localhost:3001/health > /dev/null 2>&1; then
            log "Health check passed"
            return 0
        fi
        
        info "Health check attempt $attempt/$max_attempts failed, retrying in 5 seconds..."
        sleep 5
        ((attempt++))
    done
    
    error "Health check failed after $max_attempts attempts"
}

# Rollback function
rollback() {
    warning "Rolling back deployment..."
    
    if [ -f /tmp/last_backup_path ]; then
        local backup_path=$(cat /tmp/last_backup_path)
        
        if [ -d "$backup_path" ]; then
            # Stop current services
            pm2 stop "$APP_NAME" 2>/dev/null || true
            
            # Restore application
            if [ -d "$backup_path/app" ]; then
                sudo rm -rf "/var/www/$APP_NAME"
                sudo cp -r "$backup_path/app" "/var/www/$APP_NAME"
                sudo chown -R "$DEPLOY_USER:$DEPLOY_USER" "/var/www/$APP_NAME"
            fi
            
            # Restore database
            if [ -f "$backup_path/database.sql" ]; then
                local db_name=$(grep "DB_NAME=" "$BACKEND_DIR/.env.production" | cut -d '=' -f2)
                local db_user=$(grep "DB_USERNAME=" "$BACKEND_DIR/.env.production" | cut -d '=' -f2)
                local db_password=$(grep "DB_PASSWORD=" "$BACKEND_DIR/.env.production" | cut -d '=' -f2)
                
                mysql -u "$db_user" -p"$db_password" "$db_name" < "$backup_path/database.sql"
            fi
            
            # Restart services
            cd "/var/www/$APP_NAME/backend"
            pm2 start ecosystem.config.js --env production
            
            warning "Rollback completed"
        else
            error "Backup not found at $backup_path"
        fi
    else
        error "No backup path found"
    fi
}

# Main deployment function
main() {
    log "Starting deployment of Order Tracker Nexus..."
    
    # Set trap for rollback on error
    trap rollback ERR
    
    check_user
    check_prerequisites
    create_backup
    
    build_backend
    build_frontend
    
    deploy_backend
    deploy_frontend
    
    start_services
    health_check
    
    log "Deployment completed successfully!"
    log "Application is running at:"
    log "  - Frontend: http://localhost (via nginx)"
    log "  - Backend API: http://localhost:3001"
    log "  - Health Check: http://localhost:3001/health"
    log "  - API Documentation: http://localhost:3001/api/docs"
    
    # Clear trap
    trap - ERR
}

# Script entry point
if [ "${BASH_SOURCE[0]}" == "${0}" ]; then
    main "$@"
fi
