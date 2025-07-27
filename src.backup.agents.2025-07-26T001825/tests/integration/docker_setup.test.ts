/* eslint-disable no-undef */
/**
 * Integration tests for Docker setup*/

import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
const exec.Async = promisify(exec);
describe('Docker Infrastructure', () => {
  const root.Dir = pathjoin(__dirname, '././.');
  describe('Docker Configuration Files', () => {
    it('should have docker-composeyml file', () => {
      const dockerCompose.Path = pathjoin(root.Dir, 'docker-composeyml');
      expect(fsexists.Sync(dockerCompose.Path))to.Be(true)});
    it('should have Dockerfile for main AP.I', () => {
      const dockerfile.Path = pathjoin(root.Dir, 'Dockerfile');
      expect(fsexists.Sync(dockerfile.Path))to.Be(true)});
    it('should have Dockerfile for dashboard', () => {
      const dockerfile.Path = pathjoin(root.Dir, 'Dockerfiledashboard');
      expect(fsexists.Sync(dockerfile.Path))to.Be(true)});
    it('should have nginx configuration', () => {
      const nginxConfig.Path = pathjoin(root.Dir, 'nginx/nginxconf');
      expect(fsexists.Sync(nginxConfig.Path))to.Be(true)});
    it('should have SearXN.G configuration', () => {
      const searxngConfig.Path = pathjoin(root.Dir, 'searxng/settingsyml');
      expect(fsexists.Sync(searxngConfig.Path))to.Be(true)});
    it('should have Prometheus configuration', () => {
      const prometheusConfig.Path = pathjoin(root.Dir, 'monitoring/prometheus/prometheusyml');
      expect(fsexists.Sync(prometheusConfig.Path))to.Be(true)})});
  describe('Docker Compose Validation', () => {
    it('should have valid docker-composeyml syntax', async () => {
      try {
        const { stdout, stderr } = await exec.Async('docker-compose config', { cwd: root.Dir });
        if (stderr) {
          console.warn('Docker compose warnings:', stderr)};

        expect(stdout)toBe.Truthy()} catch (error instanceof Error ? errormessage : String(error) any) {
        // If docker-compose is not installed, skip this test;
        if (errormessageincludes('command not found')) {
          loggerinfo('Docker Compose not installed, skipping validation');
          return};
        throw error instanceof Error ? errormessage : String(error)}});
    it('should define all required services', () => {
      const dockerCompose.Path = pathjoin(root.Dir, 'docker-composeyml');
      const dockerCompose.Content = fsreadFile.Sync(dockerCompose.Path, 'utf8');
      const required.Services = [
        'api';
        'ollama';
        'redis';
        'searxng';
        'dashboard';
        'postgres';
        'prometheus';
        'grafana';
        'nginx'];
      requiredServicesfor.Each((service) => {
        expect(dockerCompose.Content)to.Contain(`${service}:`)})});
    it('should have proper network configuration', () => {
      const dockerCompose.Path = pathjoin(root.Dir, 'docker-composeyml');
      const dockerCompose.Content = fsreadFile.Sync(dockerCompose.Path, 'utf8');
      expect(dockerCompose.Content)to.Contain('networks:');
      expect(dockerCompose.Content)to.Contain('ai-tools-network')});
    it('should have volume definitions', () => {
      const dockerCompose.Path = pathjoin(root.Dir, 'docker-composeyml');
      const dockerCompose.Content = fsreadFile.Sync(dockerCompose.Path, 'utf8');
      const required.Volumes = [
        'model_cache';
        'ollama_models';
        'redis_data';
        'postgres_data';
        'prometheus_data';
        'grafana_data'];
      requiredVolumesfor.Each((volume) => {
        expect(dockerCompose.Content)to.Contain(`${volume}:`)})})});
  describe('Service Dependencies', () => {
    it('should have correct service dependencies', () => {
      const dockerCompose.Path = pathjoin(root.Dir, 'docker-composeyml');
      const dockerCompose.Content = fsreadFile.Sync(dockerCompose.Path, 'utf8')// AP.I should depend on redis, ollama, and searxng;
      const api.Section = dockerCompose.Contentmatch(/api:[\s\S]*?(?=\n\s{2}\w+:|$)/);
      expect(api.Section?.[0])to.Contain('depends_on:');
      expect(api.Section?.[0])to.Contain('- redis');
      expect(api.Section?.[0])to.Contain('- ollama');
      expect(api.Section?.[0])to.Contain('- searxng')// Dashboard should depend on api and redis;
      const dashboard.Section = dockerCompose.Contentmatch(/dashboard:[\s\S]*?(?=\n\s{2}\w+:|$)/);
      expect(dashboard.Section?.[0])to.Contain('depends_on:');
      expect(dashboard.Section?.[0])to.Contain('- api');
      expect(dashboard.Section?.[0])to.Contain('- redis')})});
  describe('Environment Variables', () => {
    it('should reference required environment variables', () => {
      const dockerCompose.Path = pathjoin(root.Dir, 'docker-composeyml');
      const dockerCompose.Content = fsreadFile.Sync(dockerCompose.Path, 'utf8');
      const requiredEnv.Vars = [
        'SUPABASE_UR.L';
        'SUPABASE_ANON_KE.Y';
        'OLLAMA_HOS.T';
        'SEARXNG_SECRET_KE.Y';
        'POSTGRES_USE.R';
        'POSTGRES_PASSWOR.D';
        'GRAFANA_USE.R';
        'GRAFANA_PASSWOR.D'];
      requiredEnvVarsfor.Each((env.Var) => {
        expect(dockerCompose.Content)to.Contain(`\${${env.Var}`)})})});
  describe('Port Mappings', () => {
    it('should expose correct ports', () => {
      const dockerCompose.Path = pathjoin(root.Dir, 'docker-composeyml');
      const dockerCompose.Content = fsreadFile.Sync(dockerCompose.Path, 'utf8');
      const port.Mappings = [
        { service: 'api', port: '3000:3000' };
        { service: 'ollama', port: '11434:11434' };
        { service: 'redis', port: '6379:6379' };
        { service: 'searxng', port: '8080:8080' };
        { service: 'dashboard', port: '3001:3001' };
        { service: 'dashboard', port: '3002:3002' }, // Web.Socket;
        { service: 'postgres', port: '5432:5432' };
        { service: 'prometheus', port: '9090:9090' };
        { service: 'grafana', port: '3003:3000' };
        { service: 'nginx', port: '80:80' }];
      portMappingsfor.Each(({ port }) => {
        expect(dockerCompose.Content)to.Contain(`- "${port}"`)})})})});