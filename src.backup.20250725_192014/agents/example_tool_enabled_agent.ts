/**
 * Example of a tool-enabled agent that demonstrates how to use the tool execution support*/

import { BaseAgent, AgentContext, PartialAgentResponse } from './base_agentjs';
export class ExampleToolEnabled.Agent extends BaseAgent {
  constructor() {
    super({
      name: 'example_tool_agent';
      description: 'Example agent that demonstrates tool execution capabilities';
      priority: 5;
      capabilities: [
        {
          name: 'file_operations';
          description: 'Perform file operations using tools';
          input.Schema: { path: { type: 'string', required: true } };
          output.Schema: { result: { type: 'object' } };
          requires.Tools: ['READ_FIL.E', 'WRITE_FIL.E', 'LIST_FILE.S']};
        {
          name: 'code_analysis';
          description: 'Analyze code using tools';
          input.Schema: { file.Path: { type: 'string', required: true } };
          output.Schema: { analysis: { type: 'object' } };
          requires.Tools: ['ANALYZE_COD.E', 'SEARCH_FILE.S']}];
      maxLatency.Ms: 30000;
      retry.Attempts: 2;
      dependencies: [];
      memory.Enabled: true;
      category: 'examples';
      toolExecution.Enabled: true, // Enable tool execution for this agent;
      allowed.Tools: [
        'READ_FIL.E';
        'WRITE_FIL.E';
        'LIST_FILE.S';
        'CREATE_FIL.E';
        'DELETE_FIL.E';
        'ANALYZE_COD.E';
        'SEARCH_FILE.S';
        'EXECUTE_COD.E'], // Specify which tools this agent can use})};

  protected async on.Initialize(): Promise<void> {
    // Log available tools during initialization;
    const available.Tools = thisgetAvailable.Tools();
    thisloggerinfo(`Available tools for ${thisconfigname}:`, available.Tools)};

  protected async process(
    context: AgentContext & { memory.Context?: unknown }): Promise<PartialAgentResponse> {
    const { user.Request } = context;
    try {
      // Select appropriate tools based on the request;
      const selected.Tools = await thisselectToolsFor.Task(user.Request);
      thisloggerinfo(`Selected tools for task: ${selected.Toolsjoin(', ')}`)// Example: Read a file if requested;
      if (userRequesttoLower.Case()includes('read file')) {
        const path.Match = user.Requestmatch(/read file\s+(.+)/i);
        if (path.Match) {
          const file.Path = path.Match[1]trim()// Execute the READ_FIL.E tool;
          const result = await thisexecute.Tool({
            tool.Name: 'READ_FIL.E';
            parameters: { path: file.Path };
            request.Id: contextrequest.Id});
          if (resultsuccess) {
            return {
              success: true;
              data: { file.Content: resultdata };
              reasoning: `Successfully read file: ${file.Path}`;
              confidence: 0.9;
              metadata: { tools.Used: ['READ_FIL.E'] }}} else {
            return {
              success: false;
              data: null;
              reasoning: `Failed to read file: ${resulterror}`;
              confidence: 0.3;
              error instanceof Error ? errormessage : String(error) resulterror;
            }}}}// Example: Analyze code if requested;
      if (userRequesttoLower.Case()includes('analyze code')) {
        const path.Match = user.Requestmatch(/analyze code\s+in\s+(.+)/i);
        if (path.Match) {
          const file.Path = path.Match[1]trim()// Execute the ANALYZE_COD.E tool;
          const result = await thisexecute.Tool({
            tool.Name: 'ANALYZE_COD.E';
            parameters: { path: file.Path };
            request.Id: contextrequest.Id});
          if (resultsuccess) {
            return {
              success: true;
              data: { analysis: resultdata };
              reasoning: `Successfully analyzed code in: ${file.Path}`;
              confidence: 0.85;
              metadata: { tools.Used: ['ANALYZE_COD.E'] }}}}}// Example: Execute multiple tools in sequence;
      if (userRequesttoLower.Case()includes('create and write file')) {
        const match = user.Requestmatch(/create and write file\s+(.+)\s+with content\s+"([^"]+)"/i);
        if (match) {
          const [ file.Path, content] = match// Execute tools in sequence;
          const results = await thisexecuteTool.Chain([
            {
              tool.Name: 'CREATE_FIL.E';
              parameters: { path: file.Path, content }};
            {
              tool.Name: 'READ_FIL.E';
              parameters: { path: file.Path }}]);
          const all.Successful = resultsevery(r => rsuccess);
          return {
            success: all.Successful;
            data: {
              created: results[0]success;
              verified: results[1]success;
              content: results[1]data;
            };
            reasoning: all.Successful ? `Successfully created and verified file: ${file.Path}`: `Failed to complete file operations`;
            confidence: all.Successful ? 0.9 : 0.4;
            metadata: { tools.Used: ['CREATE_FIL.E', 'READ_FIL.E'] }}}}// If no specific tool action was identified;
      return {
        success: false;
        data: null;
        reasoning: 'No specific tool action identified in the request';
        confidence: 0.2;
        message: `I can help with file operations and code analysis. Available tools: ${thisgetAvailable.Tools()join(', ')}`}} catch (error) {
      thisloggererror('Error processing request:', error);
      return {
        success: false;
        data: null;
        reasoning: `Error processing request: ${error instanceof Error ? errormessage : String(error)}`;
        confidence: 0.1;
        error instanceof Error ? errormessage : String(error) error instanceof Error ? errormessage : String(error);
      }}};

  protected async on.Shutdown(): Promise<void> {
    thisloggerinfo(`Shutting down ${thisconfigname}`)}};