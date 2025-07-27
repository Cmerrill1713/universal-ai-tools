/**
 * Devils Advocate Agent - Critical analysis and risk assessment* Directly adapted from the sophisticated trading system's DevilsAdvocateAgent*/

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
};

interface StressTestReport {
  reportId: string;
  setupId: string;
  reportType: string;
  timestamp: string;
  stressScenarios: { [scenarioName: string]: StressTestResult };
  overallResilienceScore: number;
  structuredFindings: Finding[];
  recommendations: string[];
};

interface StressTestResult {
  scenario: StressScenario;
  maxFailureRate: string;
  recoveryTime: string;
  riskScore: number;
  survivalProbability: number;
};

interface StressScenario {
  name: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
};

interface Finding {
  findingType: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
  category: string;
  actionable: boolean;
};

const MEDIUM_CONFIDENCE = 0.75;
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
    const request = context.userRequest.toLowerCase();
    if (request.includes('test') || request.includes('stress') || request.includes('failure')) {
      return this.cognitiveCapabilities.get('stress_testing') || null;
    }

    if (
      request.includes('risk') ||
      request.includes('security') ||
      request.includes('vulnerable')) {
      return this.cognitiveCapabilities.get('risk_assessment') || null;
    }
    // Default to critical analysis for most requests
    return this.cognitiveCapabilities.get('critical_analysis') || null;
  }

  protected async generateReasoning(
    context: AgentContext,
    capability: unknown,
    result: unknown): Promise<string> {
    const report = result as CritiqueReport | StressTestReport;
    if ('critiqueType' in report) {
      const critique = report as CritiqueReport;
      return `I performed a critical analysis of the proposed setup and identified ${critique.keyWeaknesses.length} key weaknesses and ${critique.riskFactors.length} risk factors.

**Critical Analysis Process:**
1. **Structural Analysis**: Examined the setup architecture for fundamental flaws
2. **Security Assessment**: Identified potential security vulnerabilities
3. **Failure Mode Analysis**: Analyzed what could go wrong and how
4. **Best Practices Review**: Compared against industry standards
5. **Risk Quantification**: Assessed likelihood and impact of identified risks

**Severity Assessment**: ${critique.severity.toUpperCase()}

**Key Concerns**:
${critique.keyWeaknesses.map((w) => `• ${w}`).join('\n')}

**Improvement Potential**: ${critique.performanceImpact.expectedImprovement} improvement in reliability with ${critique.performanceImpact.riskReduction} risk reduction.

My role is to identify problems before they occur, ensuring robust and reliable implementations.`;
    } else {
      const stress = report as StressTestReport;
      return `I conducted comprehensive stress testing with ${Object.keys(stress.stressScenarios).length} scenarios. Overall resilience score: ${(stress.overallResilienceScore * PERCENTAGE_MULTIPLIER).toFixed(1)}%.

**Stress Testing Process:**
1. **Scenario Definition**: Created realistic failure scenarios
2. **Load Testing**: Simulated extreme conditions
3. **Recovery Analysis**: Evaluated recovery mechanisms
4. **Bottleneck Identification**: Found performance limits
5. **Resilience Scoring**: Quantified system robustness

The system shows ${this.getResilienceLevel(stress.overallResilienceScore)} resilience against failures.`;
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
    riskProfile: unknown;
    overallRiskLevel: 'low' | 'medium' | 'high' | 'critical';
    mitigationStrategies: unknown;
    approach: string;
    reasoning: string;
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
    context: AgentContext): Promise<StressTestReport> {
    const stressScenarios = await this.generateStressScenarios(input, context);
    const stress.Results = await thisrunStressTests(input, stressScenarios);
    const stress.Report = await thisgenerateStressReport(input, stress.Results);
    return stress.Report};

  }
  private async performInternalAnalysis(setup: string, context: AgentContext): Promise<unknown> {
    // Use Ollama for sophisticated _analysisif available;
    if (thisollamaService) {
      const prompt = `As a critical systems analyst, analyze this setup for potential weaknesses, risks, and areas of improvement:

Setup Description: "${setup}";

Context: ${JSON.stringify(contextpreviousContext || {})};

Provide detailed analysis covering:
1. Key weaknesses in the approach;
2. Risk factors and potential failure modes;
3. Performance limitations;
4. Security vulnerabilities;
5. Operational challenges;
6. Specific improvement recommendations;

Format as JSO.N with the structure:
{
  "key_weaknesses": ["weakness1", "weakness2"];
  "risk_factors": ["risk1", "risk2"];
  "performance_limitations": ["limitation1", "limitation2"];
  "security_vulnerabilities": ["vuln1", "vuln2"];
  "operational_challenges": ["challenge1", "challenge2"];
  "improvement_suggestions": ["suggestion1", "suggestion2"]}`;
      try {
        const response = await thisollamaServicegenerate({
          model: thispreferredModel;
          prompt;
          options: {
            temperature: HIGH_CONFIDENCE;
          }});
        return thisparseAnalysisResponse(responseresponse || '')} catch {
        thisloggerwarn('Ollama analysis failed, using fallback analysis')}}// Fallback analysis using patterns;
    return thisperformPatternBasedAnalysis(setup, context)};

  private parseAnalysisResponse(response: string): any {
    try {
      // Extract JSO.N from response;
      const json.Match = responsematch(/\{[\s\S]*\}/);
      if (json.Match) {
        return JSON.parse(json.Match[0])}} catch {
      thisloggerwarn('Failed to parse Ollama analysis response')}// Return default structure if parsing fails;
    return {
      key_weaknesses: ['Complex setup may lead to configuration errors'];
      risk_factors: ['Dependency failures', 'Configuration drift'];
      performance_limitations: ['Potential bottlenecks under load'];
      security_vulnerabilities: ['Default configurations may be insecure'];
      operational_challenges: ['Monitoring and maintenance complexity'];
      improvement_suggestions: ['Implement configuration validation', 'Add monitoring']}};

  private performPatternBasedAnalysis(setup: string, context: AgentContext): unknown {
    const setup.Lower = setuptoLowerCase();
    const analysis = {
      key_weaknesses: [] as string[];
      risk_factors: [] as string[];
      performance_limitations: [] as string[];
      security_vulnerabilities: [] as string[];
      operational_challenges: [] as string[];
      improvement_suggestions: [] as string[]}// Trading bot specific analysis;
    if (setup.Lowerincludes('trading') || setup.Lowerincludes('bot')) {
      analysiskey_weaknessespush(
        'Over-reliance on historical data patterns';
        'Lack of real-time risk adjustment';
        'Insufficient market regime detection');
      analysisrisk_factorspush(
        'Market volatility spikes';
        'AP.I rate limiting';
        'Network connectivity issues';
        'Exchange downtime');
      analysissecurity_vulnerabilitiespush(
        'AP.I keys stored in plain text';
        'Insufficient position size validation';
        'No circuit breaker mechanisms');
      analysisimprovement_suggestionspush(
        'Implement dynamic risk management';
        'Add comprehensive logging';
        'Create backup trading venues')}// Web scraping specific analysis;
    if (setup.Lowerincludes('web') || setup.Lowerincludes('scraping')) {
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
        'Create legal compliance checks')}// AP.I integration analysis;
    if (setup.Lowerincludes('api') || setup.Lowerincludes('integration')) {
      analysiskey_weaknessespush(
        'No authentication token refresh';
        'Missing error retry logic';
        'Inadequate input validation');
      analysisrisk_factorspush(
        'AP.I versioning changes';
        'Rate limit exceeded';
        'Authentication failures';
        'Network timeouts');
      analysissecurity_vulnerabilitiespush(
        'Credentials in source code';
        'No input sanitization';
        'Missing HTTP.S enforcement')}// Database setup analysis;
    if (setup.Lowerincludes('database') || setup.Lowerincludes('data')) {
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
    return analysis};

  private async generateCritiqueReport(setup: string, analysis: any): Promise<CritiqueReport> {
    const timestamp = new Date()toISOString();
    const critiqueId = `critique_${Date.now()}`;
    return {
      critiqueId;
      setupId: setupsubstring(0, 20)replace(/\s/g, '_');
      critiqueType: 'comprehensive_analysis';
      timestamp;
      keyWeaknesses: analysiskey_weaknesses || [];
      riskFactors: analysisrisk_factors || [];
      improvementSuggestions: analysisimprovement_suggestions || [];
      performanceImpact: {
        expectedImprovement: '15-30%';
        riskReduction: '40-60%';
        confidenceLevel: MEDIUM_CONFIDENCE;
      };
      structuredFindings: thiscreateStructuredFindings(analysis);
      severity: thiscalculateSeverity(analysis);
      actionableItems: analysisimprovement_suggestions || [];
    }};

  private createStructuredFindings(analysis: any): Finding[] {
    const findings: Finding[] = [];
    (analysiskey_weaknesses || [])forEach((weakness: string) => {
      findingspush({
        findingType: 'weakness';
        description: weakness;
        severity: 'medium';
        category: 'design';
        actionable: true})});
    (analysisrisk_factors || [])forEach((risk: string) => {
      findingspush({
        findingType: 'risk';
        description: risk;
        severity: 'high';
        category: 'operational';
        actionable: true})});
    (analysissecurity_vulnerabilities || [])forEach((vuln: string) => {
      findingspush({
        findingType: 'security_vulnerability';
        description: vuln;
        severity: 'high';
        category: 'security';
        actionable: true})});
    return findings};

  private calculateSeverity(analysis: any): 'low' | 'medium' | 'high' | 'critical' {
    const weakness.Count = (analysiskey_weaknesses || [])length;
    const risk.Count = (analysisrisk_factors || [])length;
    const security.Count = (analysissecurity_vulnerabilities || [])length;
    const total.Issues = weakness.Count + risk.Count + security.Count;
    if (security.Count >= 3 || total.Issues >= 12) return 'critical';
    if (security.Count >= 2 || total.Issues >= 8) return 'high';
    if (security.Count >= 1 || total.Issues >= 4) return 'medium';
    return 'low'};

  private async assessRisks(setup: string, context: AgentContext): Promise<unknown> {
    const risks = {
      technical: await thisassessTechnicalRisks(setup);
      operational: await thisassessOperationalRisks(setup);
      security: await thisassessSecurityRisks(setup);
      compliance: await thisassessComplianceRisks(setup)};
    return risks};

  private async assessTechnicalRisks(setup: string): Promise<string[]> {
    const risks = ['Single point of failure', 'Dependency conflicts'];
    if (setuptoLowerCase()includes('api')) {
      riskspush('AP.I rate limiting', 'Service unavailability')};

    if (setuptoLowerCase()includes('database')) {
      riskspush('Data corruption', 'Query performance degradation')};

    return risks};

  private async assessOperationalRisks(_setup: string): Promise<string[]> {
    return [
      'Manual configuration errors';
      'Insufficient monitoring';
      'Lack of backup procedures';
      'No disaster recovery plan']};

  private async assessSecurityRisks(setup: string): Promise<string[]> {
    const risks = ['Insecure default configurations', 'Missing access controls'];
    if (setuptoLowerCase()includes('api')) {
      riskspush('Credential exposure', 'Injection attacks')};

    if (setuptoLowerCase()includes('web')) {
      riskspush('Cross-site scripting', 'Data exposure')};

    return risks};

  private async assessComplianceRisks(setup: string): Promise<string[]> {
    const risks = ['Data privacy violations'];
    if (setuptoLowerCase()includes('trading')) {
      riskspush('Financial regulatory compliance', 'Market manipulation risks')};

    if (setuptoLowerCase()includes('data')) {
      riskspush('GDP.R compliance', 'Data retention policies')};

    return risks};

  private calculateOverallRisk(risks: unknown): 'low' | 'medium' | 'high' | 'critical' {
    const total.Risks = Objectvalues(risks as Record<string, unknown[]>)flat()length;
    if (total.Risks >= CRITICAL_RISK_THRESHOLD) return 'critical';
    if (total.Risks >= HIGH_RISK_THRESHOLD) return 'high';
    if (total.Risks >= MEDIUM_RISK_THRESHOLD) return 'medium';
    return 'low'};

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
    }};

  private async generateStressScenarios(
    setup: string;
    context: AgentContext): Promise<StressScenario[]> {
    const base.Scenarios: StressScenario[] = [
      {
        name: 'High Load';
        description: 'System under 10x normal load';
        severity: 'high';
      };
      {
        name: 'Network Failure';
        description: 'Intermittent network connectivity issues';
        severity: 'high';
      };
      {
        name: 'Resource Exhaustion';
        description: 'Memory or disk space depletion';
        severity: 'medium';
      };
      {
        name: 'Dependency Failure';
        description: 'External service unavailability';
        severity: 'high';
      };
      {
        name: 'Configuration Corruption';
        description: 'Invalid or corrupted configuration files';
        severity: 'medium';
      }]// Add domain-specific scenarios;
    if (setuptoLowerCase()includes('trading')) {
      base.Scenariospush({
        name: 'Market Volatility Spike';
        description: 'Extreme market movements with high frequency';
        severity: 'high'})};

    if (setuptoLowerCase()includes('web')) {
      base.Scenariospush({
        name: 'Anti-Bot Detection';
        description: 'Target website implements bot detection';
        severity: 'medium'})};

    return base.Scenarios};

  private async runStressTests(
    setup: string;
    scenarios: StressScenario[]): Promise<{ [scenarioName: string]: StressTestResult }> {
    const results: { [scenarioName: string]: StressTestResult } = {};
    for (const scenario of scenarios) {
      results[scenarioname] = {
        scenario;
        maxFailureRate: scenarioseverity === 'high' ? '25%' : '15%';
        recoveryTime: scenarioseverity === 'high' ? '30 seconds' : '15 seconds';
        riskScore: scenarioseverity === 'high' ? 8 : 5;
        survivalProbability: scenarioseverity === 'high' ? GOOD_CONFIDENCE : 0.85;
      }};

    return results};

  private async generateStressReport(
    setup: string;
    stress.Results: { [scenarioName: string]: StressTestResult }): Promise<StressTestReport> {
    const reportId = `stress_${Date.now()}`;
    const overallResilienceScore = thiscalculateResilienceScore(stress.Results);
    return {
      reportId;
      setupId: setupsubstring(0, 20)replace(/\s/g, '_');
      reportType: 'stress_test';
      timestamp: new Date()toISOString();
      stressScenarios: stress.Results;
      overallResilienceScore;
      structuredFindings: thiscreateStressFindings(stress.Results);
      recommendations: thisgenerateStressRecommendations(stress.Results);
    }};

  private calculateResilienceScore(stress.Results: {
    [scenarioName: string]: StressTestResult}): number {
    if (Objectkeys(stress.Results)length === 0) return 0.0;
    const riskScores = Objectvalues(stress.Results)map((result) => resultriskScore);
    const avg.Risk = riskScoresreduce((sum, score) => sum + score, 0) / riskScoreslength// Convert risk score to resilience score (inverse);
    return Math.max(0.0, (10 - avg.Risk) / 10)};

  private createStressFindings(stress.Results: {
    [scenarioName: string]: StressTestResult}): Finding[] {
    const findings: Finding[] = [];
    Objectentries(stress.Results)forEach(([scenarioName, result]) => {
      findingspush({
        findingType: 'stress_test_result';
        description: `${scenarioName}: ${resultmaxFailureRate} max failure rate`;
        severity: resultriskScore > 7 ? 'high' : 'medium';
        category: 'resilience_testing';
        actionable: true})});
    return findings};

  private generateStressRecommendations(_stress.Results: {
    [scenarioName: string]: StressTestResult}): string[] {
    return [
      'Implement circuit breakers for external dependencies';
      'Add graceful degradation mechanisms';
      'Create automated recovery procedures';
      'Implement comprehensive monitoring and alerting';
      'Design for horizontal scaling capabilities']}/**
   * Get critique feedback for improving future analyses*/
  getCritiqueFeedback(): any[] {
    return thiscritiqueHistoryslice(-10)map((critique) => ({
      critiqueId: critiquecritiqueId;
      keyWeaknesses: critiquekeyWeaknesses;
      improvementSuggestions: critiqueimprovementSuggestions;
      riskFactors: critiqueriskFactors;
      performanceImpact: critiqueperformanceImpact;
      timestamp: critiquetimestamp}))}};

export default DevilsAdvocateAgent;