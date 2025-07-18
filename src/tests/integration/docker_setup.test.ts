/**
 * Integration tests for Docker setup
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

const execAsync = promisify(exec);

describe('Docker Infrastructure', () => {
  const rootDir = path.join(__dirname, '../../..');
  
  describe('Docker Configuration Files', () => {
    it('should have docker-compose.yml file', () => {
      const dockerComposePath = path.join(rootDir, 'docker-compose.yml');
      expect(fs.existsSync(dockerComposePath)).toBe(true);
    });

    it('should have Dockerfile for main API', () => {
      const dockerfilePath = path.join(rootDir, 'Dockerfile');
      expect(fs.existsSync(dockerfilePath)).toBe(true);
    });

    it('should have Dockerfile for dashboard', () => {
      const dockerfilePath = path.join(rootDir, 'Dockerfile.dashboard');
      expect(fs.existsSync(dockerfilePath)).toBe(true);
    });

    it('should have nginx configuration', () => {
      const nginxConfigPath = path.join(rootDir, 'nginx/nginx.conf');
      expect(fs.existsSync(nginxConfigPath)).toBe(true);
    });

    it('should have SearXNG configuration', () => {
      const searxngConfigPath = path.join(rootDir, 'searxng/settings.yml');
      expect(fs.existsSync(searxngConfigPath)).toBe(true);
    });

    it('should have Prometheus configuration', () => {
      const prometheusConfigPath = path.join(rootDir, 'monitoring/prometheus/prometheus.yml');
      expect(fs.existsSync(prometheusConfigPath)).toBe(true);
    });
  });

  describe('Docker Compose Validation', () => {
    it('should have valid docker-compose.yml syntax', async () => {
      try {
        const { stdout, stderr } = await execAsync(
          'docker-compose config',
          { cwd: rootDir }
        );
        
        if (stderr) {
          console.warn('Docker compose warnings:', stderr);
        }
        
        expect(stdout).toBeTruthy();
      } catch (error: any) {
        // If docker-compose is not installed, skip this test
        if (error.message.includes('command not found')) {
          console.log('Docker Compose not installed, skipping validation');
          return;
        }
        throw error;
      }
    });

    it('should define all required services', () => {
      const dockerComposePath = path.join(rootDir, 'docker-compose.yml');
      const dockerComposeContent = fs.readFileSync(dockerComposePath, 'utf8');
      
      const requiredServices = [
        'api',
        'ollama',
        'redis',
        'searxng',
        'dashboard',
        'postgres',
        'prometheus',
        'grafana',
        'nginx'
      ];
      
      requiredServices.forEach(service => {
        expect(dockerComposeContent).toContain(`${service}:`);
      });
    });

    it('should have proper network configuration', () => {
      const dockerComposePath = path.join(rootDir, 'docker-compose.yml');
      const dockerComposeContent = fs.readFileSync(dockerComposePath, 'utf8');
      
      expect(dockerComposeContent).toContain('networks:');
      expect(dockerComposeContent).toContain('ai-tools-network');
    });

    it('should have volume definitions', () => {
      const dockerComposePath = path.join(rootDir, 'docker-compose.yml');
      const dockerComposeContent = fs.readFileSync(dockerComposePath, 'utf8');
      
      const requiredVolumes = [
        'model_cache',
        'ollama_models',
        'redis_data',
        'postgres_data',
        'prometheus_data',
        'grafana_data'
      ];
      
      requiredVolumes.forEach(volume => {
        expect(dockerComposeContent).toContain(`${volume}:`);
      });
    });
  });

  describe('Service Dependencies', () => {
    it('should have correct service dependencies', () => {
      const dockerComposePath = path.join(rootDir, 'docker-compose.yml');
      const dockerComposeContent = fs.readFileSync(dockerComposePath, 'utf8');
      
      // API should depend on redis, ollama, and searxng
      const apiSection = dockerComposeContent.match(/api:[\s\S]*?(?=\n\s{2}\w+:|$)/);
      expect(apiSection?.[0]).toContain('depends_on:');
      expect(apiSection?.[0]).toContain('- redis');
      expect(apiSection?.[0]).toContain('- ollama');
      expect(apiSection?.[0]).toContain('- searxng');
      
      // Dashboard should depend on api and redis
      const dashboardSection = dockerComposeContent.match(/dashboard:[\s\S]*?(?=\n\s{2}\w+:|$)/);
      expect(dashboardSection?.[0]).toContain('depends_on:');
      expect(dashboardSection?.[0]).toContain('- api');
      expect(dashboardSection?.[0]).toContain('- redis');
    });
  });

  describe('Environment Variables', () => {
    it('should reference required environment variables', () => {
      const dockerComposePath = path.join(rootDir, 'docker-compose.yml');
      const dockerComposeContent = fs.readFileSync(dockerComposePath, 'utf8');
      
      const requiredEnvVars = [
        'SUPABASE_URL',
        'SUPABASE_ANON_KEY',
        'OLLAMA_HOST',
        'SEARXNG_SECRET_KEY',
        'POSTGRES_USER',
        'POSTGRES_PASSWORD',
        'GRAFANA_USER',
        'GRAFANA_PASSWORD'
      ];
      
      requiredEnvVars.forEach(envVar => {
        expect(dockerComposeContent).toContain(`\${${envVar}`);
      });
    });
  });

  describe('Port Mappings', () => {
    it('should expose correct ports', () => {
      const dockerComposePath = path.join(rootDir, 'docker-compose.yml');
      const dockerComposeContent = fs.readFileSync(dockerComposePath, 'utf8');
      
      const portMappings = [
        { service: 'api', port: '3000:3000' },
        { service: 'ollama', port: '11434:11434' },
        { service: 'redis', port: '6379:6379' },
        { service: 'searxng', port: '8080:8080' },
        { service: 'dashboard', port: '3001:3001' },
        { service: 'dashboard', port: '3002:3002' }, // WebSocket
        { service: 'postgres', port: '5432:5432' },
        { service: 'prometheus', port: '9090:9090' },
        { service: 'grafana', port: '3003:3000' },
        { service: 'nginx', port: '80:80' }
      ];
      
      portMappings.forEach(({ port }) => {
        expect(dockerComposeContent).toContain(`- "${port}"`);
      });
    });
  });
});