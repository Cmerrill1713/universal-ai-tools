#!/usr/bin/env node

import chalk from 'chalk';

const fixGuides = {
  infrastructure: {
    title: 'Infrastructure Issues Fix Guide',
    steps: [
      {
        issue: 'Port conflicts',
        solution: 'Check and kill processes using required ports:\n  - lsof -i :3000 (frontend)\n  - lsof -i :8080 (backend)\n  - kill -9 <PID>'
      },
      {
        issue: 'Docker containers not starting',
        solution: 'Reset Docker environment:\n  - docker-compose down -v\n  - docker system prune -a\n  - docker-compose up -d'
      },
      {
        issue: 'Supabase connection issues',
        solution: 'Verify Supabase setup:\n  - npx supabase status\n  - Check .env variables\n  - Restart Supabase: npx supabase stop && npx supabase start'
      },
      {
        issue: 'Database migrations failing',
        solution: 'Fix migration issues:\n  - npm run migrate:validate\n  - Check for conflicts in supabase/migrations/\n  - Remove .disabled extensions\n  - npm run migrate:up'
      }
    ]
  },
  
  security: {
    title: 'Security Issues Fix Guide',
    steps: [
      {
        issue: 'npm audit vulnerabilities',
        solution: 'Fix npm vulnerabilities:\n  - npm audit fix\n  - npm audit fix --force (if needed)\n  - Update specific packages manually'
      },
      {
        issue: 'Hardcoded credentials',
        solution: 'Move credentials to environment:\n  - Create/update .env file\n  - Use process.env.VARIABLE_NAME\n  - Never commit .env files'
      },
      {
        issue: 'Insecure code patterns',
        solution: 'Replace insecure patterns:\n  - eval() → Use Function constructor or safer alternatives\n  - innerHTML → Use textContent or sanitize input\n  - Disable TLS rejection → Configure proper certificates'
      },
      {
        issue: 'Missing security headers',
        solution: 'Add security middleware:\n  - Ensure helmet is configured\n  - Add CORS restrictions\n  - Enable rate limiting'
      }
    ]
  },
  
  migrations: {
    title: 'Migration Issues Fix Guide',
    steps: [
      {
        issue: 'Timestamp conflicts',
        solution: 'Resolve migration conflicts:\n  - Rename files with unique timestamps\n  - Use format: YYYYMMDDHHMMSS_description.sql\n  - Run npm run migrate:validate'
      },
      {
        issue: 'Disabled migrations',
        solution: 'Enable migrations:\n  - Remove .disabled extension\n  - Review migration content\n  - Test in development first'
      },
      {
        issue: 'Failed migrations',
        solution: 'Debug migration failures:\n  - Check Supabase logs: npx supabase db logs\n  - Validate SQL syntax\n  - Check for dependency order\n  - Use transactions for safety'
      }
    ]
  }
};

const fixType = process.argv[2] || 'all';

function displayGuide(guide) {
  console.log(chalk.bold.blue(`\n${guide.title}\n`));
  
  guide.steps.forEach((step, index) => {
    console.log(chalk.yellow(`${index + 1}. ${step.issue}`));
    console.log(chalk.gray(step.solution));
    console.log();
  });
}

if (fixType === 'all') {
  Object.values(fixGuides).forEach(displayGuide);
} else if (fixGuides[fixType]) {
  displayGuide(fixGuides[fixType]);
} else {
  console.error(chalk.red(`Unknown fix type: ${fixType}`));
  console.log(chalk.gray('\nAvailable types: infrastructure, security, migrations'));
  process.exit(1);
}