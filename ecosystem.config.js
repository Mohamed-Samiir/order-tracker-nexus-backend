module.exports = {
  apps: [
    {
      name: 'order-tracker-backend',
      script: 'dist/main.js',
      instances: 'max', // Use all available CPU cores
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'development',
        PORT: 3001,
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
      // Logging
      log_file: '/var/log/order-tracker/combined.log',
      out_file: '/var/log/order-tracker/out.log',
      error_file: '/var/log/order-tracker/error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      
      // Process management
      max_memory_restart: '1G',
      min_uptime: '10s',
      max_restarts: 10,
      restart_delay: 4000,
      
      // Monitoring
      watch: false,
      ignore_watch: ['node_modules', 'logs', 'uploads'],
      
      // Advanced features
      kill_timeout: 5000,
      listen_timeout: 3000,
      
      // Health monitoring
      health_check_grace_period: 3000,
      
      // Auto restart on file changes (development only)
      watch_options: {
        followSymlinks: false,
        usePolling: false,
      },
      
      // Environment variables
      env_file: '.env.production',
      
      // Graceful shutdown
      kill_retry_time: 100,
      
      // Source map support
      source_map_support: true,
      
      // Instance variables
      instance_var: 'INSTANCE_ID',
      
      // Merge logs
      merge_logs: true,
      
      // Time zone
      time: true,
      
      // Autorestart
      autorestart: true,
      
      // Cron restart (optional - restart every day at 2 AM)
      cron_restart: '0 2 * * *',
      
      // Post deploy hooks
      post_update: ['npm install', 'npm run build:prod', 'npm run migration:prod'],
      
      // Pre-load modules
      node_args: '--max-old-space-size=1024',
    },
  ],
  
  // Deployment configuration
  deploy: {
    production: {
      user: 'deploy',
      host: ['your-production-server.com'],
      ref: 'origin/main',
      repo: 'https://github.com/your-username/order-tracker-nexus-backend.git',
      path: '/var/www/order-tracker-backend',
      'post-deploy': 'npm install && npm run build:prod && npm run migration:prod && pm2 reload ecosystem.config.js --env production',
      'pre-setup': 'apt update && apt install git -y',
      'ssh_options': 'StrictHostKeyChecking=no',
    },
  },
};
