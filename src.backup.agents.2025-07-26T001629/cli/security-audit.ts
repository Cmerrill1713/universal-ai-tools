/* eslint-disable no-undef */
#!/usr/bin/env node;
import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { Log.Context, logger } from './utils/enhanced-logger'// import Table from 'cli-table3'// Package not available, using simple table implementation;
interface Table.Options {
  head?: string[];
  col.Widths?: number[];
  style?: any// Ignore style properties for now};
class Simple.Table {
  private options: Table.Options;
  private rows: string[][] = [];
  constructor(options: Table.Options = {}) {
    thisoptions = options};

  push(.args: any[]) {
    if (argslength === 1 && Array.is.Array(args[0])) {
      thisrowspush(args[0])} else {
      thisrowspush(argsmap(String))}};

  to.String(): string {
    const { head = [], col.Widths = [] } = thisoptions;
    let result = '';
    if (headlength > 0) {
      result += `${headmap((h, i) => hpad.End(col.Widths[i] || 20))join(' | ')}\n`;
      result += `${headmap((_, i) => '-'repeat(col.Widths[i] || 20))join('-+-')}\n`};

    for (const row of thisrows) {
      result += `${rowmap((cell, i) => String(cell)pad.End(col.Widths[i] || 20))join(' | ')}\n`};

    return result}};
const Table = Simple.Table;
import { securityHardening.Service } from './services/security-hardening';
import { config } from './config'// Removed duplicate logger import - using enhanced-logger instead;
import * as fs from 'fs/promises';
import * as path from 'path';
const program = new Command();
program;
  name('security-audit');
  description('Security audit and hardening CL.I for Universal A.I Tools');
  version('1.0.0')// Run security audit;
program;
  command('audit');
  description('Run a comprehensive security audit');
  option('-v, --verbose', 'Show detailed output');
  option('-o, --output <file>', 'Save report to file');
  action(async (options) => {
    const spinner = ora('Running security audit.')start();
    try {
      const result = await securityHardeningServicerunSecurity.Audit();
      spinnersucceed('Security audit completed')// Display results;
      loggerinfo(`\n${chalkbold('Security Audit Report')}`);
      loggerinfo('='repeat(50));
      loggerinfo(`Timestamp: ${resulttimestamptoISO.String()}`);
      loggerinfo(
        `Overall Score: ${getScore.Color(resultoverall.Score)(`${resultoverall.Score}/100`)}\n`)// Vulnerabilities table;
      if (resultvulnerabilitieslength > 0) {
        loggerinfo(chalkboldred('Vulnerabilities Found:'));
        const vuln.Table = new Table({
          head: ['Severity', 'Package', 'Vulnerability', 'Fix Available'];
          style: { head: ['cyan'] }});
        resultvulnerabilitiesfor.Each((vuln) => {
          vuln.Tablepush([
            getSeverity.Color(vulnseverity)(vulnseverity);
            vulnpackage;
            vulnvulnerability;
            vulnfix.Available ? chalkgreen('Yes') : chalkred('No')])});
        loggerinfo(vulnTableto.String())} else {
        loggerinfo(chalkgreen('✓ No vulnerabilities found'))}// Security headers;
      loggerinfo(`\n${chalkbold('Security Headers:')}`);
      const header.Table = new Table({
        head: ['Header', 'Status', 'Value'];
        style: { head: ['cyan'] }});
      resultsecurityHeadersfor.Each((header) => {
        header.Tablepush([
          headerheader;
          headerpresent ? chalkgreen('✓') : chalkred('✗');
          headervalue || '-'])});
      loggerinfo(headerTableto.String())// AP.I Key Status;
      loggerinfo(`\n${chalkbold('AP.I Key Rotation Status:')}`);
      const key.Table = new Table({
        head: ['Key Type', 'Last Rotated', 'Status', 'Expires In'];
        style: { head: ['cyan'] }});
      resultapiKeyStatusfor.Each((key) => {
        key.Tablepush([
          keykey.Name;
          keylastRotatedtoLocaleDate.String();
          keyneeds.Rotation ? chalkred('Needs Rotation') : chalkgreen('O.K');
          `${keyexpires.In} days`])});
      loggerinfo(keyTableto.String())// Recommendations;
      if (resultrecommendationslength > 0) {
        loggerinfo(`\n${chalkbold('Recommendations:')}`);
        resultrecommendationsfor.Each((rec, index) => {
          const is.Urgent = recincludes('URGEN.T');
          const prefix = is.Urgent ? chalkred('!') : chalkyellow('•');
          loggerinfo(`${prefix} ${rec}`)})}// Save to file if requested;
      if (optionsoutput) {
        await fswrite.File(optionsoutput, JSO.N.stringify(result, null, 2));
        loggerinfo(`\n${chalkgreen('✓')} Report saved to ${optionsoutput}`)}} catch (error) {
      spinnerfail('Security audit failed');
      loggererror`Security audit operation failed`, LogContextSECURIT.Y, { error instanceof Error ? errormessage : String(error));
      console.errorchalkred('Error:'), error instanceof Error ? errormessage : String(error) processexit(1);
    }})// Check for vulnerabilities;
program;
  command('check-deps');
  description('Check dependencies for known vulnerabilities');
  option('--fix', 'Attempt to fix vulnerabilities automatically');
  option('--dry-run', 'Show what would be fixed without making changes');
  action(async (options) => {
    const spinner = ora('Scanning dependencies.')start();
    try {
      const vulnerabilities = await securityHardeningServicescan.Dependencies();
      spinnersucceed(`Found ${vulnerabilitieslength} vulnerabilities`);
      if (vulnerabilitieslength === 0) {
        loggerinfo(chalkgreen('✓ No vulnerabilities found!'));
        return}// Group by severity;
      const by.Severity = vulnerabilitiesreduce(
        (acc: Record<string, number>, vuln: any) => {
          acc[vulnseverity] = (acc[vulnseverity] || 0) + 1;
          return acc};
        {} as Record<string, number>);
      loggerinfo('\n.Vulnerability Summary:');
      Objectentries(by.Severity)for.Each(([severity, count]) => {
        loggerinfo(`  ${getSeverity.Color(severity)(`${severity}: ${count}`)}`)})// Fix if requested;
      if (optionsfix || optionsdry.Run) {
        loggerinfo(`\n${chalkbold('Attempting to fix vulnerabilities.')}`);
        const { fixed, failed } = await securityHardeningServicefix.Vulnerabilities(optionsdry.Run);
        if (fixedlength > 0) {
          loggerinfo(chalkgreen('\n✓ Fixed:'));
          fixedfor.Each((f: string) => loggerinfo(`  - ${f}`))};

        if (failedlength > 0) {
          loggerinfo(chalkred('\n✗ Failed:'));
          failedfor.Each((f: string) => loggerinfo(`  - ${f}`))}}} catch (error) {
      spinnerfail('Dependency scan failed');
      loggererror`Security audit operation failed`, LogContextSECURIT.Y, { error instanceof Error ? errormessage : String(error));
      console.errorchalkred('Error:'), error instanceof Error ? errormessage : String(error) processexit(1);
    }})// Rotate AP.I keys;
program;
  command('rotate-key <key.Type>');
  description('Rotate an AP.I key');
  option('--force', 'Force rotation even if not expired');
  action(async (key.Type, options) => {
    const spinner = ora(`Rotating ${key.Type}.`)start();
    try {
      const new.Key = await securityHardeningServicerotateApi.Key(key.Type);
      spinnersucceed(`${key.Type} rotated successfully`);
      loggerinfo(`\n${chalkbold('New Key Generated:')}`);
      loggerinfo(chalkgray('Key (first 16 chars):'), `${new.Keysubstring(0, 16)}.`);
      loggerinfo(chalkyellow('\n⚠️  Save this key securely. It will not be shown again.'))// Update environment file reminder;
      loggerinfo(`\n${chalkbold('Next Steps:')}`);
      loggerinfo('1. Update your env file with the new key');
      loggerinfo('2. Restart the service to apply changes');
      loggerinfo('3. Update any external services using this key')} catch (error) {
      spinnerfail('Key rotation failed');
      loggererror`Security audit operation failed`, LogContextSECURIT.Y, { error instanceof Error ? errormessage : String(error));
      console.errorchalkred('Error:'), error instanceof Error ? errormessage : String(error) processexit(1);
    }})// Check common vulnerabilities;
program;
  command('check-common');
  description('Check for common security issues');
  action(async () => {
    const spinner = ora('Checking common vulnerabilities.')start();
    try {
      const result = await securityHardeningServicecheckCommon.Vulnerabilities();
      spinnersucceed('Check completed');
      if (resultpassed) {
        loggerinfo(chalkgreen('\n✓ No common vulnerabilities found!'))} else {
        loggerinfo(chalkred(`\n✗ Found ${resultissueslength} issues:`));
        resultissuesfor.Each((issue: string, index: number) => {
          loggerinfo(`  ${index + 1}. ${issue}`)})}} catch (error) {
      spinnerfail('Check failed');
      loggererror`Security audit operation failed`, LogContextSECURIT.Y, { error instanceof Error ? errormessage : String(error));
      console.errorchalkred('Error:'), error instanceof Error ? errormessage : String(error) processexit(1);
    }})// Generate security report;
program;
  command('report');
  description('Generate a comprehensive security report');
  option('-f, --format <format>', 'Output format (json, html, markdown)', 'markdown');
  option('-o, --output <file>', 'Save report to file');
  action(async (options) => {
    const spinner = ora('Generating security report.')start();
    try {
      const audit = await securityHardeningServicerunSecurity.Audit();
      spinnersucceed('Report generated');
      let report = '';
      switch (optionsformat) {
        case 'markdown':
          report = generateMarkdown.Report(audit);
          break;
        case 'html':
          report = generateHTML.Report(audit);
          break;
        case 'json':
          report = JSO.N.stringify(audit, null, 2);
          break;
        default:
          throw new Error(`Unknown format: ${optionsformat}`)};

      if (optionsoutput) {
        await fswrite.File(optionsoutput, report);
        loggerinfo(`\n${chalkgreen('✓')} Report saved to ${optionsoutput}`)} else {
        loggerinfo(`\n${report}`)}} catch (error) {
      spinnerfail('Report generation failed');
      loggererror`Security audit operation failed`, LogContextSECURIT.Y, { error instanceof Error ? errormessage : String(error));
      console.errorchalkred('Error:'), error instanceof Error ? errormessage : String(error) processexit(1);
    }})// Configuration validation;
program;
  command('validate-config');
  description('Validate security configuration');
  action(async () => {
    const spinner = ora('Validating security configuration.')start();
    try {
      const issues: string[] = []// Check JW.T secret strength;
      if (configsecurityjwt.Secretlength < 32) {
        issuespush('JW.T secret is too short (minimum 32 characters)')}// Check encryption key strength;
      if (configsecurityencryption.Keylength < 32) {
        issuespush('Encryption key is too short (minimum 32 characters)')}// Check COR.S origins in production;
      if (configserveris.Production && configsecuritycors.Originsincludes('localhost')) {
        issuespush('Localhost is allowed in COR.S origins in production')}// Check rate limiting;
      if (!configrate.Limitingenabled && configserveris.Production) {
        issuespush('Rate limiting is disabled in production')};

      spinnersucceed('Configuration validated');
      if (issueslength === 0) {
        loggerinfo(chalkgreen('\n✓ Security configuration is valid'))} else {
        loggerinfo(chalkred(`\n✗ Found ${issueslength} configuration issues:`));
        issuesfor.Each((issue, index) => {
          loggerinfo(`  ${index + 1}. ${issue}`)})}} catch (error) {
      spinnerfail('Validation failed');
      loggererror`Security audit operation failed`, LogContextSECURIT.Y, { error instanceof Error ? errormessage : String(error));
      console.errorchalkred('Error:'), error instanceof Error ? errormessage : String(error) processexit(1);
    }})// Helper functions;
function getScore.Color(score: number): (text: string) => string {
  if (score >= 90) return chalkgreen;
  if (score >= 70) return chalkyellow;
  if (score >= 50) return chalkmagenta;
  return chalkred};

function getSeverity.Color(severity: string): (text: string) => string {
  switch (severitytoLower.Case()) {
    case 'critical':
      return chalkredbold;
    case 'high':
      return chalkred;
    case 'moderate':
      return chalkyellow;
    case 'low':
      return chalkblue;
    default:
      return chalkgray}};

function generateMarkdown.Report(audit: any): string {
  let report = `# Security Audit Report\n\n`;
  report += `**Generated:** ${audittimestamptoISO.String()}\n`;
  report += `**Overall Score:** ${auditoverall.Score}/100\n\n`;
  report += `## Vulnerabilities\n\n`;
  if (auditvulnerabilitieslength === 0) {
    report += `✓ No vulnerabilities found\n\n`} else {
    report += `| Severity | Package | Vulnerability | Fix Available |\n`;
    report += `|----------|---------|---------------|---------------|\n`;
    auditvulnerabilitiesfor.Each((vuln: any) => {
      report += `| ${vulnseverity} | ${vulnpackage} | ${vulnvulnerability} | ${vulnfix.Available ? 'Yes' : 'No'} |\n`});
    report += `\n`};

  report += `## Security Headers\n\n`;
  report += `| Header | Present | Value |\n`;
  report += `|--------|---------|-------|\n`;
  auditsecurityHeadersfor.Each((header: any) => {
    report += `| ${headerheader} | ${headerpresent ? '✓' : '✗'} | ${headervalue || '-'} |\n`});
  report += `\n`;
  report += `## AP.I Key Rotation Status\n\n`;
  report += `| Key Type | Last Rotated | Status | Expires In |\n`;
  report += `|----------|--------------|--------|------------|\n`;
  auditapiKeyStatusfor.Each((key: any) => {
    report += `| ${keykey.Name} | ${keylastRotatedtoLocaleDate.String()} | ${keyneeds.Rotation ? 'Needs Rotation' : 'O.K'} | ${keyexpires.In} days |\n`});
  report += `\n`;
  if (auditrecommendationslength > 0) {
    report += `## Recommendations\n\n`;
    auditrecommendationsfor.Each((rec: string) => {
      report += `- ${rec}\n`})};

  return report};

function generateHTML.Report(audit: any): string {
  return `<!DOCTYP.E html>`<html><head><title>Security Audit Report</title><style>
    body { font-family: Arial, sans-serif; margin: 20px};
    h1, h2 { color: #333};
    table { border-collapse: collapse; width: 100%; margin: 20px 0};
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left};
    th { background-color: #f2f2f2};
    score { font-size: 24px; font-weight: bold};
    good { color: #4CA.F50};
    warning { color: #ff9800};
    danger { color: #f44336};
    success { color: #4CA.F50};
    error instanceof Error ? errormessage : String(error)  color: #f44336}</style></head><body><h1>Security Audit Report</h1><p><strong>Generated:</strong> ${audittimestamptoISO.String()}</p><p class="score">Overall Score: <span class="${auditoverall.Score >= 90 ? 'good' : auditoverall.Score >= 70 ? 'warning' : 'danger'}">${auditoverall.Score}/100</span></p><h2>Vulnerabilities</h2>
  ${
    auditvulnerabilitieslength === 0? '<p class="success">✓ No vulnerabilities found</p>': ``<table><tr><th>Severity</th><th>Package</th><th>Vulnerability</th><th>Fix Available</th></tr>
    ${auditvulnerabilities;
      map(
        (vuln: any) => ``<tr><td class="${vulnseverity === 'critical' || vulnseverity === 'high' ? 'danger' : vulnseverity === 'moderate' ? 'warning' : ''}">${vulnseverity}</td><td>${vulnpackage}</td><td>${vulnvulnerability}</td><td>${vulnfix.Available ? '<span class="success">Yes</span>' : '<span class="error instanceof Error ? errormessage : String(error) No</span>'}</td></tr>``);
      join('')}</table>``};
  <h2>Security Headers</h2><table><tr><th>Header</th><th>Present</th><th>Value</th></tr>
    ${auditsecurity.Headers;
      map(
        (header: any) => ``<tr><td>${headerheader}</td><td>${headerpresent ? '<span class="success">✓</span>' : '<span class="error instanceof Error ? errormessage : String(error) ✗</span>'}</td><td>${headervalue || '-'}</td></tr>``);
      join('')}</table><h2>AP.I Key Rotation Status</h2><table><tr><th>Key Type</th><th>Last Rotated</th><th>Status</th><th>Expires In</th></tr>
    ${auditapiKey.Status;
      map(
        (key: any) => ``<tr><td>${keykey.Name}</td><td>${keylastRotatedtoLocaleDate.String()}</td><td class="${keyneeds.Rotation ? 'error instanceof Error ? errormessage : String(error): 'success'}">${keyneeds.Rotation ? 'Needs Rotation' : 'O.K'}</td><td>${keyexpires.In} days</td></tr>``);
      join('')}</table>
  ${
    auditrecommendationslength > 0? ``<h2>Recommendations</h2><ul>
    ${auditrecommendationsmap((rec: string) => `<li>${rec}</li>`)join('')}</ul>``: '';
  }</body></html>`;`};

programparse(processargv);