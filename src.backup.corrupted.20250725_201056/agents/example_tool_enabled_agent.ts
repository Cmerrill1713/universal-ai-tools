/**
 * Example of a tool-enabled agent that demonstrates how to use the tool execution support*/

import { Base.Agent, Agent.Context, PartialAgent.Response } from './base_agentjs';
export class ExampleTool.Enabled.Agent.extends Base.Agent {
  constructor() {
    super({
      name: 'example_tool_agent';,
      description: 'Example agent that demonstrates tool execution capabilities',
      priority: 5,
      capabilities: [
        {
          name: 'file_operations';,
          description: 'Perform file operations using tools',
          input.Schema: { path: { type: 'string', required: true } ,
          output.Schema: { result: { type: 'object' } ,
          requires.Tools: ['READ_FI.L.E', 'WRITE_FI.L.E', 'LIST_FIL.E.S'];
        {
          name: 'code_analysis';,
          description: 'Analyze code using tools',
          input.Schema: { file.Path: { type: 'string', required: true } ,
          output.Schema: { analysis: { type: 'object' } ,
          requires.Tools: ['ANALYZE_CO.D.E', 'SEARCH_FIL.E.S']}];
      max.Latency.Ms: 30000,
      retry.Attempts: 2,
      dependencies: [],
      memory.Enabled: true,
      category: 'examples',
      tool.Execution.Enabled: true, // Enable tool execution for this agent;
      allowed.Tools: [
        'READ_FI.L.E';
        'WRITE_FI.L.E';
        'LIST_FIL.E.S';
        'CREATE_FI.L.E';
        'DELETE_FI.L.E';
        'ANALYZE_CO.D.E';
        'SEARCH_FIL.E.S';
        'EXECUTE_CO.D.E'], // Specify which tools this agent can use});

  protected async on.Initialize(): Promise<void> {
    // Log available tools during initialization;
    const available.Tools = thisget.Available.Tools();
    this.loggerinfo(`Available tools for ${thisconfigname}:`, available.Tools);

  protected async process(
    context: Agent.Context & { memory.Context?: unknown }): Promise<PartialAgent.Response> {
    const { user.Request } = context;
    try {
      // Select appropriate tools based on the request;
      const selected.Tools = await thisselectTools.For.Task(user.Request);
      this.loggerinfo(`Selected tools for task: ${selected.Toolsjoin(', ')}`)// Example: Read a file if requested,
      if (userRequestto.Lower.Case()includes('read file')) {
        const path.Match = user.Requestmatch(/read file\s+(.+)/i);
        if (path.Match) {
          const file.Path = path.Match[1]trim()// Execute the READ_FI.L.E.tool;
          const result = await thisexecute.Tool({
            tool.Name: 'READ_FI.L.E',
            parameters: { path: file.Path ,
            request.Id: contextrequest.Id}),
          if (resultsuccess) {
            return {
              success: true,
              data: { file.Content: resultdata ,
              reasoning: `Successfully read file: ${file.Path}`,
              confidence: 0.9,
              metadata: { tools.Used: ['READ_FI.L.E'] }}} else {
            return {
              success: false,
              data: null,
              reasoning: `Failed to read file: ${resulterror}`,
              confidence: 0.3,
              error instanceof Error ? error.message : String(error) resulterror;
            }}}}// Example: Analyze code if requested,
      if (userRequestto.Lower.Case()includes('analyze code')) {
        const path.Match = user.Requestmatch(/analyze code\s+in\s+(.+)/i);
        if (path.Match) {
          const file.Path = path.Match[1]trim()// Execute the ANALYZE_CO.D.E.tool;
          const result = await thisexecute.Tool({
            tool.Name: 'ANALYZE_CO.D.E',
            parameters: { path: file.Path ,
            request.Id: contextrequest.Id}),
          if (resultsuccess) {
            return {
              success: true,
              data: { analysis: resultdata ,
              reasoning: `Successfully analyzed code in: ${file.Path}`,
              confidence: 0.85,
              metadata: { tools.Used: ['ANALYZE_CO.D.E'] }}}}}// Example: Execute multiple tools in sequence,
      if (userRequestto.Lower.Case()includes('create and write file')) {
        const match = user.Requestmatch(/create and write file\s+(.+)\s+with content\s+"([^"]+)"/i);
        if (match) {
          const [ file.Path, content] = match// Execute tools in sequence;
          const results = await thisexecute.Tool.Chain([
            {
              tool.Name: 'CREATE_FI.L.E',
              parameters: { path: file.Path, content };
            {
              tool.Name: 'READ_FI.L.E',
              parameters: { path: file.Path }}]),
          const all.Successful = resultsevery(r => rsuccess);
          return {
            success: all.Successful,
            data: {
              created: results[0]success,
              verified: results[1]success,
              content: results[1]data,
}            reasoning: all.Successful ? `Successfully created and verified file: ${file.Path}`: `Failed to complete file operations`,
            confidence: all.Successful ? 0.9 : 0.4,
            metadata: { tools.Used: ['CREATE_FI.L.E', 'READ_FI.L.E'] }}}}// If no specific tool action was identified;
      return {
        success: false,
        data: null,
        reasoning: 'No specific tool action identified in the request',
        confidence: 0.2,
        message: `I can help with file operations and code analysis. Available tools: ${thisget.Available.Tools()join(', ')}`}} catch (error) {
      this.loggererror('Error processing request:', error);
      return {
        success: false,
        data: null,
        reasoning: `Error processing request: ${error instanceof Error ? error.message : String(error)}`,
        confidence: 0.1,
        error instanceof Error ? error.message : String(error) error instanceof Error ? error.message : String(error);
      }};

  protected async on.Shutdown(): Promise<void> {
    this.loggerinfo(`Shutting down ${thisconfigname}`)};