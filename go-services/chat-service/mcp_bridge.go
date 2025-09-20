package main

import (
	
	"encoding/json"
	"fmt"
	
	
	"os/exec"
	
)

// MCPBridge handles communication with MCP servers
type MCPBridge struct {
	nodePath string
}

// NewMCPBridge creates a new MCP bridge
func NewMCPBridge() *MCPBridge {
	return &MCPBridge{
		nodePath: "node", // Assuming node is in PATH
	}
}

// CallMCPTool calls an MCP tool via the TypeScript integration service
func (m *MCPBridge) CallMCPTool(toolName string, params map[string]interface{}) (map[string]interface{}, error) {
	// Create the request payload
	request := map[string]interface{}{
		"tool":   toolName,
		"params": params,
	}

	// Convert to JSON
	jsonData, err := json.Marshal(request)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %v", err)
	}

	// Call the TypeScript MCP integration service
	cmd := exec.Command("node", "-e", `
		const { enhancedMCPIntegrationService } = require('./src/services/enhanced-mcp-integration-service.ts');
		const request = JSON.parse(process.argv[1]);
		enhancedMCPIntegrationService.callTool(request.tool, request.params)
			.then(result => console.log(JSON.stringify(result)))
			.catch(error => console.error(JSON.stringify({error: error.message})));
	`, string(jsonData))

	output, err := cmd.Output()
	if err != nil {
		return nil, fmt.Errorf("failed to call MCP tool: %v", err)
	}

	// Parse the response
	var result map[string]interface{}
	if err := json.Unmarshal(output, &result); err != nil {
		return nil, fmt.Errorf("failed to parse MCP response: %v", err)
	}

	return result, nil
}

// ListMCPTools lists available MCP tools
func (m *MCPBridge) ListMCPTools() ([]map[string]interface{}, error) {
	cmd := exec.Command("node", "-e", `
		const { enhancedMCPIntegrationService } = require('./src/services/enhanced-mcp-integration-service.ts');
		enhancedMCPIntegrationService.listTools()
			.then(tools => console.log(JSON.stringify(tools)))
			.catch(error => console.error(JSON.stringify({error: error.message})));
	`)

	output, err := cmd.Output()
	if err != nil {
		return nil, fmt.Errorf("failed to list MCP tools: %v", err)
	}

	var tools []map[string]interface{}
	if err := json.Unmarshal(output, &tools); err != nil {
		return nil, fmt.Errorf("failed to parse tools list: %v", err)
	}

	return tools, nil
}
