# Enhanced Development Tools

These development tools help diagnose and fix issues in the Universal AI Tools codebase.

## Available Tools

### 1. Smart Server Launcher (`npm run dev:smart`)
An intelligent server launcher that:
- Runs pre-launch health checks
- Auto-fixes common issues
- Provides interactive commands (r=restart, d=diagnostics, f=fix, c=clear, q=quit)
- Monitors for errors and attempts automatic recovery
- Finds available ports if default is in use

**Usage:**
```bash
npm run dev:smart                    # Normal mode
npm run dev:smart -- --production   # Production mode
npm run dev:smart -- --debug        # Debug mode with verbose logging
npm run dev:smart -- --no-fix       # Disable auto-fix
npm run dev:smart -- --skip-check   # Skip TypeScript check
npm run dev:smart -- --port=3000    # Custom port
```

### 2. Real-Time Error Monitor (`npm run dev:monitor`)
Monitors all TypeScript files for errors in real-time:
- Live syntax checking
- TypeScript error detection
- Web dashboard at http://localhost:3001
- WebSocket updates for instant feedback
- Shows error trends and fixes

**Usage:**
```bash
npm run dev:monitor
```

Then open http://localhost:3001 in your browser for the dashboard.

### 3. Enhanced Error Diagnostics (`npm run dev:diagnose`)
Comprehensive error analysis tool that:
- Runs TypeScript compiler checks
- ESLint analysis
- Syntax validation
- Import verification
- Generates detailed error reports
- Creates auto-fix scripts

**Usage:**
```bash
npm run dev:diagnose
```

This will:
1. Run all diagnostics
2. Generate `error-diagnostic-report.json`
3. Create `auto-fix-errors.sh` if there are fixable issues

## Recommended Workflow

1. **First Time Setup:**
   ```bash
   npm run dev:diagnose    # Check for existing errors
   ./auto-fix-errors.sh    # Apply auto-fixes if generated
   ```

2. **Development:**
   ```bash
   # In terminal 1 - Run the smart server
   npm run dev:smart
   
   # In terminal 2 - Monitor errors in real-time
   npm run dev:monitor
   ```

3. **When Errors Occur:**
   - Press `d` in the smart server terminal for diagnostics
   - Press `f` to attempt auto-fix
   - Check the web dashboard for detailed error info
   - Run `npm run dev:diagnose` for comprehensive analysis

## Features

### Auto-Fix Capabilities
- Missing semicolons
- ESLint fixable rules
- Prettier formatting
- Common TypeScript patterns

### Error Detection
- Unterminated strings
- Missing parentheses in arrow functions
- Unmatched brackets
- Import resolution issues
- TypeScript type errors

### Interactive Commands (Smart Server)
- `r` - Restart server
- `d` - Run diagnostics
- `f` - Run auto-fix
- `c` - Clear console
- `q` - Quit

## Troubleshooting

### Port Already in Use
The smart server will automatically find an alternative port.

### Transform Errors
The smart server will detect transform errors and run diagnostics automatically.

### Memory Issues
Use `NODE_OPTIONS='--max-old-space-size=8192' npm run dev:smart` for more memory.

### WebSocket Connection Failed
Ensure port 3001 is available for the error monitor dashboard.

## Environment Variables

These tools respect all standard environment variables plus:
- `DEBUG=*` - Enable debug logging
- `LOG_LEVEL=debug` - Set log level
- `FORCE_COLOR=1` - Force colored output

## Integration with VS Code

Add these tasks to `.vscode/tasks.json`:

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "Smart Dev Server",
      "type": "shell",
      "command": "npm run dev:smart",
      "problemMatcher": ["$tsc-watch"],
      "isBackground": true
    },
    {
      "label": "Error Monitor",
      "type": "shell", 
      "command": "npm run dev:monitor",
      "isBackground": true
    },
    {
      "label": "Run Diagnostics",
      "type": "shell",
      "command": "npm run dev:diagnose"
    }
  ]
}
```

## Future Enhancements

- [ ] AI-powered error fix suggestions
- [ ] Historical error tracking
- [ ] Performance profiling integration
- [ ] Git integration for error regression detection
- [ ] Team collaboration features