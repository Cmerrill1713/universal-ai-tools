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
      const docker.Compose.Path = pathjoin(root.Dir, 'docker-composeyml');
      expect(fsexists.Sync(docker.Compose.Path))to.Be(true)});
    it('should have Dockerfile for main A.P.I', () => {
      const dockerfile.Path = pathjoin(root.Dir, 'Dockerfile');
      expect(fsexists.Sync(dockerfile.Path))to.Be(true)});
    it('should have Dockerfile for dashboard', () => {
      const dockerfile.Path = pathjoin(root.Dir, 'Dockerfiledashboard');
      expect(fsexists.Sync(dockerfile.Path))to.Be(true)});
    it('should have nginx configuration', () => {
      const nginx.Config.Path = pathjoin(root.Dir, 'nginx/nginxconf');
      expect(fsexists.Sync(nginx.Config.Path))to.Be(true)});
    it('should have SearX.N.G.configuration', () => {
      const searxng.Config.Path = pathjoin(root.Dir, 'searxng/settingsyml');
      expect(fsexists.Sync(searxng.Config.Path))to.Be(true)});
    it('should have Prometheus configuration', () => {
      const prometheus.Config.Path = pathjoin(root.Dir, 'monitoring/prometheus/prometheusyml');
      expect(fsexists.Sync(prometheus.Config.Path))to.Be(true)})});
  describe('Docker Compose Validation', () => {
    it('should have valid docker-composeyml syntax', async () => {
      try {
        const { stdout, stderr } = await exec.Async('docker-compose config', { cwd: root.Dir }),
        if (stderr) {
          console.warn('Docker compose warnings:', stderr);

        expect(stdout)to.Be.Truthy()} catch (error instanceof Error ? error.message : String(error) any) {
        // If docker-compose is not installed, skip this test;
        if (error.message.includes('command not found')) {
          loggerinfo('Docker Compose not installed, skipping validation');
          return;
        throw error instanceof Error ? error.message : String(error)}});
    it('should define all required services', () => {
      const docker.Compose.Path = pathjoin(root.Dir, 'docker-composeyml');
      const docker.Compose.Content = fsread.File.Sync(docker.Compose.Path, 'utf8');
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
      required.Servicesfor.Each((service) => {
        expect(docker.Compose.Content)to.Contain(`${service}:`)})});
    it('should have proper network configuration', () => {
      const docker.Compose.Path = pathjoin(root.Dir, 'docker-composeyml');
      const docker.Compose.Content = fsread.File.Sync(docker.Compose.Path, 'utf8');
      expect(docker.Compose.Content)to.Contain('networks:');
      expect(docker.Compose.Content)to.Contain('ai-tools-network')});
    it('should have volume definitions', () => {
      const docker.Compose.Path = pathjoin(root.Dir, 'docker-composeyml');
      const docker.Compose.Content = fsread.File.Sync(docker.Compose.Path, 'utf8');
      const required.Volumes = [
        'model_cache';
        'ollama_models';
        'redis_data';
        'postgres_data';
        'prometheus_data';
        'grafana_data'];
      required.Volumesfor.Each((volume) => {
        expect(docker.Compose.Content)to.Contain(`${volume}:`)})})});
  describe('Service Dependencies', () => {
    it('should have correct service dependencies', () => {
      const docker.Compose.Path = pathjoin(root.Dir, 'docker-composeyml');
      const docker.Compose.Content = fsread.File.Sync(docker.Compose.Path, 'utf8')// A.P.I.should depend on redis, ollama, and searxng;
      const api.Section = docker.Compose.Contentmatch(/api:[\s\S]*?(?=\n\s{2}\w+:|$)/);
      expect(api.Section?.[0])to.Contain('depends_on:');
      expect(api.Section?.[0])to.Contain('- redis');
      expect(api.Section?.[0])to.Contain('- ollama');
      expect(api.Section?.[0])to.Contain('- searxng')// Dashboard should depend on api and redis;
      const dashboard.Section = docker.Compose.Contentmatch(/dashboard:[\s\S]*?(?=\n\s{2}\w+:|$)/);
      expect(dashboard.Section?.[0])to.Contain('depends_on:');
      expect(dashboard.Section?.[0])to.Contain('- api');
      expect(dashboard.Section?.[0])to.Contain('- redis')})});
  describe('Environment Variables', () => {
    it('should reference required environment variables', () => {
      const docker.Compose.Path = pathjoin(root.Dir, 'docker-composeyml');
      const docker.Compose.Content = fsread.File.Sync(docker.Compose.Path, 'utf8');
      const required.Env.Vars = [
        'SUPABASE_U.R.L';
        'SUPABASE_ANON_K.E.Y';
        'OLLAMA_HO.S.T';
        'SEARXNG_SECRET_K.E.Y';
        'POSTGRES_US.E.R';
        'POSTGRES_PASSWO.R.D';
        'GRAFANA_US.E.R';
        'GRAFANA_PASSWO.R.D'];
      requiredEnv.Varsfor.Each((env.Var) => {
        expect(docker.Compose.Content)to.Contain(`\${${env.Var}`)})})});
  describe('Port Mappings', () => {
    it('should expose correct ports', () => {
      const docker.Compose.Path = pathjoin(root.Dir, 'docker-composeyml');
      const docker.Compose.Content = fsread.File.Sync(docker.Compose.Path, 'utf8');
      const port.Mappings = [
        { service: 'api', port: '3000:3000' ,
        { service: 'ollama', port: '11434:11434' ,
        { service: 'redis', port: '6379:6379' ,
        { service: 'searxng', port: '8080:8080' ,
        { service: 'dashboard', port: '3001:3001' ,
        { service: 'dashboard', port: '3002:3002' }, // Web.Socket;
        { service: 'postgres', port: '5432:5432' ,
        { service: 'prometheus', port: '9090:9090' ,
        { service: 'grafana', port: '3003:3000' ,
        { service: 'nginx', port: '80:80' }],
      port.Mappingsfor.Each(({ port }) => {
        expect(docker.Compose.Content)to.Contain(`- "${port}"`)})})})});