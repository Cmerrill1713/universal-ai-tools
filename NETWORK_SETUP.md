# Network Setup Guide - Universal AI Tools

This guide explains how to configure Universal AI Tools to work as a server that other computers on your network can connect to.

## Server Architecture

Universal AI Tools consists of two main components:
- **Backend Server** (Port 9999): Provides all AI services, agents, memory, and APIs
- **Electron Frontend**: Desktop application that connects to the backend

## Current Network Configuration

### Server Details
- **Local IP Address**: `192.168.1.213`
- **Backend Port**: `9999`
- **Backend URL**: `http://192.168.1.213:9999`

### What's Been Configured

1. **Backend Server**
   - Now listens on all network interfaces (`0.0.0.0:9999`)
   - CORS configured to accept connections from local network IPs
   - Allows connections from `192.168.x.x`, `10.x.x.x`, and `172.16-31.x.x` ranges

2. **Electron Frontend**
   - Backend URL is now fully configurable in Settings
   - Can connect to remote backend servers
   - Settings persist across app restarts

## How to Connect From Other Computers

### Option 1: Using Another Electron App

1. **Install the Electron app** on the client computer
2. **Launch the app** and navigate to Settings
3. **Change Backend URL** to: `http://192.168.1.213:9999`
4. **Save settings** and restart the app
5. The app will now connect to your server

**Note**: For production use, you'll need to add the API key header to Electron requests.

### Option 2: Direct API Access

For network connections, include the API key in your requests:

```bash
# Test connection (no auth needed)
curl http://192.168.1.213:9999/health

# Access API endpoints (requires API key)
curl -H "X-API-Key: universal-ai-tools-network-2025" \
  http://192.168.1.213:9999/api/v1/agents

# Get monitoring data
curl -H "X-API-Key: universal-ai-tools-network-2025" \
  http://192.168.1.213:9999/api/v1/monitoring/health/detailed
```

**API Key**: `universal-ai-tools-network-2025`

### Option 3: Web Browser (Future)

A web interface can be added to allow browser-based access. This would enable:
- Access from any device with a web browser
- No installation required
- Mobile device support

## Testing Network Connection

### From the Server Machine

1. Check the backend is running:
```bash
lsof -i :9999
```

2. Test local network binding:
```bash
netstat -an | grep 9999
# Should show: *.9999 LISTEN
```

### From Client Machines

1. **Ping the server** (ensure firewall allows):
```bash
ping 192.168.1.213
```

2. **Test backend connection**:
```bash
curl http://192.168.1.213:9999/health
```

3. **Test from browser**:
Navigate to `http://192.168.1.213:9999/health`

## Firewall Configuration

If connections fail, you may need to allow port 9999 through your firewall:

### macOS
```bash
# Check firewall status
sudo pfctl -s info

# Allow port 9999 (add to /etc/pf.conf if needed)
pass in proto tcp from any to any port 9999
```

### Windows
```powershell
# Add firewall rule
New-NetFirewallRule -DisplayName "Universal AI Tools" -Direction Inbound -Protocol TCP -LocalPort 9999 -Action Allow
```

### Linux
```bash
# Using iptables
sudo iptables -A INPUT -p tcp --dport 9999 -j ACCEPT

# Using ufw
sudo ufw allow 9999/tcp
```

## Authentication & Security

### Current Security Features

✅ **Network Authentication**: 
- Localhost connections (same machine) are allowed without authentication
- Local network connections require the API key: `universal-ai-tools-network-2025`
- External connections are blocked for security

✅ **Rate Limiting**: 
- Built-in rate limiting prevents API abuse
- Applies to all endpoints automatically

✅ **CORS Protection**:
- Only allows connections from local network ranges
- Development mode allows all origins with warnings

### Security Considerations

⚠️ **For Production Use**:

1. **Change the API Key**: Generate a unique API key for your installation
2. **Use HTTPS**: Set up SSL certificates for encrypted connections
3. **Monitor Access**: Check logs for unauthorized access attempts
4. **Firewall Configuration**: Ensure only necessary ports are open
5. **Consider VPN**: For remote access outside your local network

## Starting the Services

### Backend Server
```bash
# From the project root
npm run dev
# or for production
npm start
```

### Electron Frontend
```bash
# From electron-frontend directory
npm start
```

## Troubleshooting

### Backend not accessible from network

1. **Check server is running**:
```bash
ps aux | grep node
```

2. **Verify network binding**:
```bash
netstat -an | grep 9999
```
Should show `*.9999` or `0.0.0.0:9999`

3. **Test locally first**:
```bash
curl http://localhost:9999/health
```

4. **Check firewall**:
- Ensure port 9999 is open
- Temporarily disable firewall to test

### Electron app can't connect

1. **Verify Backend URL** in Settings
2. **Check network connectivity** to server
3. **Review console logs** (View → Developer Tools)
4. **Restart the app** after changing settings

### CORS errors

If you see CORS errors in the browser console:
1. The backend server may need restart after configuration changes
2. Check that your client's IP is in an allowed range
3. For development, the server allows all origins when `NODE_ENV=development`

## Advanced Configuration

### Using a Different Port

1. Set environment variable before starting backend:
```bash
PORT=8080 npm start
```

2. Update Electron app's Backend URL to match

### Enabling WebSocket Connections

WebSocket connections are automatically configured when you set the backend URL. The app converts:
- `http://192.168.1.213:9999` → `ws://192.168.1.213:9999/ws`
- `https://192.168.1.213:9999` → `wss://192.168.1.213:9999/ws`

### Running as a System Service

To run the backend as a persistent service:

#### macOS (using launchd)
Create `/Library/LaunchDaemons/com.universal-ai-tools.plist`

#### Linux (using systemd)
Create `/etc/systemd/system/universal-ai-tools.service`

#### Windows (using NSSM)
Use NSSM to install as a Windows service

## API Endpoints

Once connected, these endpoints are available:

- `/health` - Health check
- `/api/v1/agents` - AI Agents management
- `/api/v1/memory` - Memory storage
- `/api/v1/monitoring/health/detailed` - System monitoring
- `/api/v1/news/aggregate` - News aggregation
- `/api/v1/mcp/tools` - MCP tools
- `/api/v1/vision/process` - Vision processing

## Support

For issues or questions:
1. Check the logs in both backend and Electron app
2. Ensure all prerequisites are installed
3. Verify network connectivity between machines
4. Review firewall and security settings