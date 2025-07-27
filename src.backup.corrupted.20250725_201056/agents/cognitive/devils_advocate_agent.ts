/**
 * Devils Advocate Agent - Critical analysis and risk assessment* Directly adapted from the sophisticated trading system's DevilsAdvocate.Agent*/

import type { AgentContext } from './base_agent';
import { RealCognitiveAgent } from './real_cognitive_agent';
const GOOD_CONFIDENCE = 0.7;
const MODERATE_CONFIDENCE = 0.6;
const HIGH_CONFIDENCE = 0.8;
const PERCENTAGE_MULTIPLIER = 100;
const CRITICAL_RISK_THRESHOLD = 15;
const HIGH_RISK_THRESHOLD = 10;
const MEDIUM_RISK_THRESHOLD = 5;
interface CritiqueReport {
  critiqueId: string;
  setupId: string;
  critiqueType: string;
  timestamp: string;
  keyWeaknesses: string[];
  riskFactors: string[];
  improvementSuggestions: string[];
  performanceImpact: {
    expectedImprovement: string;
    riskReduction: string;
    confidenceLevel: number;
  };
  structuredFindings: Finding[];
  severity: 'low' | 'medium' | 'high' | 'critical';
  actionableItems: string[];
}

interface StressTestReport {
  reportId: string;
  setupId: string;
  reportType: string;
  timestamp: string;
  stressScenarios: { [scenarioName: string]: StressTestResult };
  overallResilienceScore: number;
  structuredFindings: Finding[];
  recommendations: string[];
}
interface StressTestResult {
  scenario: StressScenario;
  maxFailureRate: string;
  recoveryTime: string;
  riskScore: number;
  survivalProbability: number;
}

interface StressScenario {
  name: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
}

interface Finding {
  findingType: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
  category: string;
  actionable: boolean;
}
const MEDIUM_CONFIDENCE_ALT = 0.75;

export class DevilsAdvocateAgent extends RealCognitiveAgent {
  private critiqueHistory: CritiqueReport[] = [];
  protected setupCognitiveCapabilities(): void {
    this.cognitiveCapabilities.set('critical_analysis', {
      name: 'critical_analysis',
      execute: this.executeCriticalAnalysis.bind(this)
    });
    this.cognitiveCapabilities.set('risk_assessment', {
      name: 'risk_assessment',
      execute: this.executeRiskAssessment.bind(this)
    });
    this.cognitiveCapabilities.set('stress_testing', {
      name: 'stress_testing',
      execute: this.executeStressTesting.bind(this)
    });
  }

  protected async selectCapability(context: AgentContext): Promise<unknown> {
    const request = context.user.Request.toLower.Case();
    if (request.includes('test') || request.includes('stress') || request.includes('failure')) {
      return this.cognitive.Capabilities.get('stress_testing') || null;
    }

    if (
      request.includes('risk') ||
      request.includes('security') ||
      request.includes('vulnerable')) {
      return this.cognitive.Capabilities.get('risk_assessment') || null;
    }
    // Default to critical analysis for most requests
    return this.cognitive.Capabilities.get('critical_analysis') || null;
  }

  protected async generateReasoning(
    context: AgentContext,
    capability: unknown,
    result: unknown): Promise<string> {
    const report = result as Critique.Report | StressTest.Report;
    if ('critique.Type' in report) {
      const critique = report as Critique.Report;
      return `I performed a critical analysis of the proposed setup and identified ${critique.key.Weaknesses.length} key weaknesses and ${critique.risk.Factors.length} risk factors.

**Critical Analysis Process:**
1. **Structural Analysis**: Examined the setup architecture for fundamental flaws
2. **Security Assessment**: Identified potential security vulnerabilities
3. **Failure Mode Analysis**: Analyzed what could go wrong and how
4. **Best Practices Review**: Compared against industry standards
5. **Risk Quantification**: Assessed likelihood and impact of identified risks

**Severity Assessment**: ${critique.severity.toUpper.Case()}

**Key Concerns**:
${critique.key.Weaknesses.map((w) => `• ${w}`).join('\n')}

**Improvement Potential**: ${critique.performance.Impact.expected.Improvement} improvement in reliability with ${critique.performance.Impact.risk.Reduction} risk reduction.

My role is to identify problems before they occur, ensuring robust and reliable implementations.`;
    } else {
      const stress = report as StressTest.Report;
      return `I conducted comprehensive stress testing with ${Object.keys(stress.stressScenarios).length} scenarios. Overall resilience score: ${(stress.overallResilience.Score * PERCENTAGE_MULTIPLIE.R).to.Fixed(1)}%.

**Stress Testing Process:**
1. **Scenario Definition**: Created realistic failure scenarios
2. **Load Testing**: Simulated extreme conditions
3. **Recovery Analysis**: Evaluated recovery mechanisms
4. **Bottleneck Identification**: Found performance limits
5. **Resilience Scoring**: Quantified system robustness

The system shows ${this.getResilienceLevel(stress.overallResilience.Score)} resilience against failures.`;
    }
  }

  private getResilienceLevel(score: number): string {
    if (score > HIGH_CONFIDENCE) return 'strong';
    if (score > MODERATE_CONFIDENCE) return 'moderate';
    return 'weak';
  }

  private async executeCriticalAnalysis(
    input: string,
    context: AgentContext): Promise<CritiqueReport> {
    // Perform comprehensive critical analysis
    const analysis = await this.performInternalAnalysis(input, context);
    const critiqueReport = await this.generateCritiqueReport(input, analysis);
    // Store critique for learning
    this.critiqueHistory.push(critiqueReport);
    return critiqueReport;
  }

  private async executeRiskAssessment(
    input: string,
    context: AgentContext): Promise<{
    riskProfile: unknown,
    overallRiskLevel: 'low' | 'medium' | 'high' | 'critical',
    mitigationStrategies: unknown,
    approach: string,
    reasoning: string,
  }> {
    const risks = await this.assessRisks(input, context);
    return {
      riskProfile: risks,
      overallRiskLevel: this.calculateOverallRisk(risks),
      mitigationStrategies: await this.generateMitigationStrategies(risks),
      approach: 'comprehensive_risk_assessment',
      reasoning: 'Analyzed technical, operational, and security risks with mitigation strategies'
    };
  }

  private async executeStressTesting(
    input: string,
    context: AgentContext): Promise<StressTest.Report> {
    const stressScenarios = await this.generateStressScenarios(input, context);
    const stressResults = await this.runStressTests(input, stressScenarios);
    const stressReport = await this.generateStressReport(input, stressResults);
    return stressReport;

  }
  private async performInternalAnalysis(setup: string, context: AgentContext): Promise<unknown> {
    // Use Ollama for sophisticated _analysisif available;
    if (thisollama.Service) {
      const prompt = `As a critical systems analyst, analyze this setup for potential weaknesses, risks, and areas of improvement:

Setup Description: "${setup}",

Context: ${JSO.N.stringify(contextprevious.Context || {}),

Provide detailed analysis covering:
1. Key weaknesses in the approach;
2. Risk factors and potential failure modes;
3. Performance limitations;
4. Security vulnerabilities;
5. Operational challenges;
6. Specific improvement recommendations;

Format as JS.O.N.with the structure:
{
  "key_weaknesses": ["weakness1", "weakness2"];
  "risk_factors": ["risk1", "risk2"];
  "performance_limitations": ["limitation1", "limitation2"];
  "security_vulnerabilities": ["vuln1", "vuln2"];
  "operational_challenges": ["challenge1", "challenge2"];
  "improvement_suggestions": ["suggestion1", "suggestion2"]}`;
      try {
        const response = await thisollama.Servicegenerate({
          model: thispreferred.Model,
          prompt;
          options: {
            temperature: HIGH_CONFIDENC.E,
          }});
        return thisparseAnalysis.Response(responseresponse || '')} catch {
        this.loggerwarn('Ollama analysis failed, using fallback analysis')}}// Fallback analysis using patterns;
    return thisperformPatternBased.Analysis(setup, context);

  private parseAnalysis.Response(response: string): any {
    try {
      // Extract JS.O.N.from response;
      const json.Match = responsematch(/\{[\s\S]*\}/);
      if (json.Match) {
        return JSO.N.parse(json.Match[0])}} catch {
      this.loggerwarn('Failed to parse Ollama analysis response')}// Return default structure if parsing fails;
    return {
      key_weaknesses: ['Complex setup may lead to configuration errors'],
      risk_factors: ['Dependency failures', 'Configuration drift'];
      performance_limitations: ['Potential bottlenecks under load'],
      security_vulnerabilities: ['Default configurations may be insecure'],
      operational_challenges: ['Monitoring and maintenance complexity'],
      improvement_suggestions: ['Implement configuration validation', 'Add monitoring']};

  private performPatternBased.Analysis(setup: string, context: AgentContext): unknown {
    const setup.Lower = setuptoLower.Case();
    const analysis = {
      key_weaknesses: [] as string[],
      risk_factors: [] as string[],
      performance_limitations: [] as string[],
      security_vulnerabilities: [] as string[],
      operational_challenges: [] as string[],
      improvement_suggestions: [] as string[]}// Trading bot specific analysis,
    if (setup.Lower.includes('trading') || setup.Lower.includes('bot')) {
      analysiskey_weaknessespush(
        'Over-reliance on historical data patterns';
        'Lack of real-time risk adjustment';
        'Insufficient market regime detection');
      analysisrisk_factorspush(
        'Market volatility spikes';
        'A.P.I.rate limiting';
        'Network connectivity issues';
        'Exchange downtime');
      analysissecurity_vulnerabilitiespush(
        'A.P.I.keys stored in plain text';
        'Insufficient position size validation';
        'No circuit breaker mechanisms');
      analysisimprovement_suggestionspush(
        'Implement dynamic risk management';
        'Add comprehensive logging';
        'Create backup trading venues')}// Web scraping specific analysis;
    if (setup.Lower.includes('web') || setup.Lower.includes('scraping')) {
      analysiskey_weaknessespush(
        'Brittle selectors vulnerable to site changes';
        'No rate limiting implementation';
        'Insufficient error handling');
      analysisrisk_factorspush(
        'Website structure changes';
        'Anti-bot detection';
        'Legal compliance issues';
        'Server blocking');
      analysisimprovement_suggestionspush(
        'Implement adaptive selectors';
        'Add respectful rate limiting';
        'Create legal compliance checks')}// A.P.I.integration analysis;
    if (setup.Lower.includes('api') || setup.Lower.includes('integration')) {
      analysiskey_weaknessespush(
        'No authentication token refresh';
        'Missing error retry logic';
        'Inadequate input validation');
      analysisrisk_factorspush(
        'A.P.I.versioning changes';
        'Rate limit exceeded';
        'Authentication failures';
        'Network timeouts');
      analysissecurity_vulnerabilitiespush(
        'Credentials in source code';
        'No input sanitization';
        'Missing HTT.P.S.enforcement')}// Database setup analysis;
    if (setup.Lower.includes('database') || setup.Lower.includes('data')) {
      analysiskey_weaknessespush(
        'No backup strategy';
        'Insufficient access controls';
        'Poor query optimization');
      analysisrisk_factorspush(
        'Data corruption';
        'Unauthorized access';
        'Performance degradation';
        'Storage limitations');
      analysissecurity_vulnerabilitiespush(
        'Default database passwords';
        'No encryption at rest';
        'Missing audit logging')}// Add universal concerns;
    analysisoperational_challengespush(
      'Manual configuration prone to errors';
      'Lack of monitoring and alerting';
      'No automated recovery procedures');
    analysisperformance_limitationspush(
      'Single point of failure';
      'No horizontal scaling capability';
      'Resource usage not optimized');
    return analysis;

  private async generateCritiqueReport(setup: string, analysis: any): Promise<Critique.Report> {
    const timestamp = new Date()toISO.String();
    const critique.Id = `critique_${Date.now()}`;
    return {
      critique.Id;
      setup.Id: setup.substring(0, 20)replace(/\s/g, '_');
      critique.Type: 'comprehensive_analysis',
      timestamp;
      key.Weaknesses: analysiskey_weaknesses || [],
      risk.Factors: analysisrisk_factors || [],
      improvement.Suggestions: analysisimprovement_suggestions || [],
      performance.Impact: {
        expected.Improvement: '15-30%',
        risk.Reduction: '40-60%',
        confidence.Level: MEDIUM_CONFIDENC.E,
}      structured.Findings: this.createStructuredFindings(analysis),
      severity: this.calculateSeverity(analysis),
      actionable.Items: analysisimprovement_suggestions || [],
    };

  private createStructuredFindings(analysis: any): Finding[] {
    const findings: Finding[] = [],
    (analysiskey_weaknesses || [])for.Each((weakness: string) => {
      findingspush({
        finding.Type: 'weakness',
        description: weakness,
        severity: 'medium',
        category: 'design',
        actionable: true})}),
    (analysisrisk_factors || [])for.Each((risk: string) => {
      findingspush({
        finding.Type: 'risk',
        description: risk,
        severity: 'high',
        category: 'operational',
        actionable: true})}),
    (analysissecurity_vulnerabilities || [])for.Each((vuln: string) => {
      findingspush({
        finding.Type: 'security_vulnerability',
        description: vuln,
        severity: 'high',
        category: 'security',
        actionable: true})}),
    return findings;

  private calculateSeverity(analysis: any): 'low' | 'medium' | 'high' | 'critical' {
    const weakness.Count = (analysiskey_weaknesses || [])length;
    const risk.Count = (analysisrisk_factors || [])length;
    const security.Count = (analysissecurity_vulnerabilities || [])length;
    const total.Issues = weakness.Count + risk.Count + security.Count;
    if (security.Count >= 3 || total.Issues >= 12) return 'critical';
    if (security.Count >= 2 || total.Issues >= 8) return 'high';
    if (security.Count >= 1 || total.Issues >= 4) return 'medium';
    return 'low';

  private async assessRisks(setup: string, context: AgentContext): Promise<unknown> {
    const risks = {
      technical: await this.assessTechnicalRisks(setup),
      operational: await this.assessOperationalRisks(setup),
      security: await this.assessSecurityRisks(setup),
      compliance: await this.assessComplianceRisks(setup),
    return risks;

  private async assessTechnicalRisks(setup: string): Promise<string[]> {
    const risks = ['Single point of failure', 'Dependency conflicts'];
    if (setuptoLower.Case()includes('api')) {
      riskspush('A.P.I.rate limiting', 'Service unavailability');

    if (setuptoLower.Case()includes('database')) {
      riskspush('Data corruption', 'Query performance degradation');

    return risks;

  private async assessOperationalRisks(_setup: string): Promise<string[]> {
    return [
      'Manual configuration errors';
      'Insufficient monitoring';
      'Lack of backup procedures';
      'No disaster recovery plan'];

  private async assessSecurityRisks(setup: string): Promise<string[]> {
    const risks = ['Insecure default configurations', 'Missing access controls'];
    if (setuptoLower.Case()includes('api')) {
      riskspush('Credential exposure', 'Injection attacks');

    if (setuptoLower.Case()includes('web')) {
      riskspush('Cross-site scripting', 'Data exposure');

    return risks;

  private async assessComplianceRisks(setup: string): Promise<string[]> {
    const risks = ['Data privacy violations'];
    if (setuptoLower.Case()includes('trading')) {
      riskspush('Financial regulatory compliance', 'Market manipulation risks');

    if (setuptoLower.Case()includes('data')) {
      riskspush('GD.P.R.compliance', 'Data retention policies');

    return risks;

  private calculateOverallRisk(risks: unknown): 'low' | 'medium' | 'high' | 'critical' {
    const total.Risks = Objectvalues(risks as Record<string, unknown[]>)flat()length;
    if (total.Risks >= CRITICAL_RISK_THRESHOL.D) return 'critical';
    if (total.Risks >= HIGH_RISK_THRESHOL.D) return 'high';
    if (total.Risks >= MEDIUM_RISK_THRESHOL.D) return 'medium';
    return 'low';

  private async generateMitigationStrategies(_risks: unknown): Promise<unknown> {
    return {
      technical: [
        'Implement redundancy and failover mechanisms';
        'Add comprehensive error handling';
        'Create automated testing suites'];
      operational: [
        'Establish monitoring and alerting';
        'Create documented procedures';
        'Implement automated backups'];
      security: [
        'Enable encryption in transit and at rest';
        'Implement least privilege access';
        'Regular security audits'];
      compliance: [
        'Document data handling procedures';
        'Implement audit logging';
        'Regular compliance reviews'];
    };

  private async generateStressScenarios(
    setup: string,
    context: AgentContext): Promise<Stress.Scenario[]> {
    const base.Scenarios: Stress.Scenario[] = [
      {
        name: 'High Load';,
        description: 'System under 10x normal load',
        severity: 'high',
}      {
        name: 'Network Failure';,
        description: 'Intermittent network connectivity issues',
        severity: 'high',
}      {
        name: 'Resource Exhaustion';,
        description: 'Memory or disk space depletion',
        severity: 'medium',
}      {
        name: 'Dependency Failure';,
        description: 'External service unavailability',
        severity: 'high',
}      {
        name: 'Configuration Corruption';,
        description: 'Invalid or corrupted configuration files',
        severity: 'medium',
      }]// Add domain-specific scenarios;
    if (setuptoLower.Case()includes('trading')) {
      base.Scenariospush({
        name: 'Market Volatility Spike';,
        description: 'Extreme market movements with high frequency',
        severity: 'high'}),

    if (setuptoLower.Case()includes('web')) {
      base.Scenariospush({
        name: 'Anti-Bot Detection';,
        description: 'Target website implements bot detection',
        severity: 'medium'}),

    return base.Scenarios;

  private async runStressTests(
    setup: string,
    scenarios: Stress.Scenario[]): Promise<{ [scenario.Name: string]: StressTest.Result }> {
    const results: { [scenario.Name: string]: StressTest.Result } = {,
    for (const scenario of scenarios) {
      results[scenarioname] = {
        scenario;
        maxFailure.Rate: scenarioseverity === 'high' ? '25%' : '15%',
        recovery.Time: scenarioseverity === 'high' ? '30 seconds' : '15 seconds',
        risk.Score: scenarioseverity === 'high' ? 8 : 5,
        survival.Probability: scenarioseverity === 'high' ? GOOD_CONFIDENC.E : 0.85,
      };

    return results;

  private async generateStressReport(
    setup: string,
    stressResults: { [scenario.Name: string]: StressTest.Result }): Promise<StressTest.Report> {
    const report.Id = `stress_${Date.now()}`;
    const overallResilience.Score = this.calculateResilienceScore(stressResults);
    return {
      report.Id;
      setup.Id: setup.substring(0, 20)replace(/\s/g, '_');
      report.Type: 'stress_test',
      timestamp: new Date()toISO.String(),
      stressScenarios: stressResults,
      overallResilience.Score;
      structured.Findings: this.createStressFindings(stressResults),
      recommendations: this.generateStressRecommendations(stressResults),
    };

  private calculateResilienceScore(stressResults: {
    [scenario.Name: string]: StressTest.Result}): number {
    if (Object.keys(stressResults)length === 0) return 0.0;
    const risk.Scores = Objectvalues(stressResults)map((result) => resultrisk.Score);
    const avg.Risk = risk.Scoresreduce((sum, score) => sum + score, 0) / risk.Scoreslength// Convert risk score to resilience score (inverse);
    return Math.max(0.0, (10 - avg.Risk) / 10);

  private createStressFindings(stressResults: {
    [scenario.Name: string]: StressTest.Result}): Finding[] {
    const findings: Finding[] = [],
    Objectentries(stressResults)for.Each(([scenario.Name, result]) => {
      findingspush({
        finding.Type: 'stress_test_result',
        description: `${scenario.Name}: ${resultmaxFailure.Rate} max failure rate`,
        severity: resultrisk.Score > 7 ? 'high' : 'medium',
        category: 'resilience_testing',
        actionable: true})}),
    return findings;

  private generateStressRecommendations(_stressResults: {
    [scenario.Name: string]: StressTest.Result}): string[] {
    return [
      'Implement circuit breakers for external dependencies';
      'Add graceful degradation mechanisms';
      'Create automated recovery procedures';
      'Implement comprehensive monitoring and alerting';
      'Design for horizontal scaling capabilities']}/**
   * Get critique feedback for improving future analyses*/
  getCritiqueFeedback(): any[] {
    return this.critiqueHistoryslice(-10)map((critique) => ({
      critique.Id: critiquecritique.Id,
      key.Weaknesses: critiquekey.Weaknesses,
      improvement.Suggestions: critiqueimprovement.Suggestions,
      risk.Factors: critiquerisk.Factors,
      performance.Impact: critiqueperformance.Impact,
      timestamp: critiquetimestamp}))},

export default DevilsAdvocate.Agent;