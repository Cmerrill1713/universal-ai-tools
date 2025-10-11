export default {
  apps: [
    {
      name: 'syntax-guardian',
      script: 'npm',
      args: 'run syntax:guard',
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'development'
      },
      error_file: './logs/syntax-guardian-error.log',
      out_file: './logs/syntax-guardian-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss'
    },
    {
      name: 'adaptive-fixer',
      script: 'npm',
      args: 'run fix:adaptive',
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'development'
      },
      error_file: './logs/adaptive-fixer-error.log',
      out_file: './logs/adaptive-fixer-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss'
    },
    {
      name: 'error-monitor',
      script: 'npm',
      args: 'run dev:monitor',
      watch: false,
      max_memory_restart: '300M',
      env: {
        NODE_ENV: 'development'
      },
      error_file: './logs/error-monitor-error.log',
      out_file: './logs/error-monitor-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss'
    },
    {
      name: 'syntax-watcher',
      script: 'npm',
      args: 'run fix:syntax:watch',
      watch: false,
      max_memory_restart: '400M',
      env: {
        NODE_ENV: 'development'
      },
      error_file: './logs/syntax-watcher-error.log',
      out_file: './logs/syntax-watcher-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss'
    }
  ]
};