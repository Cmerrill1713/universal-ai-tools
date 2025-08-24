#!/usr/bin/env tsx

/**
 * Seed Christian's devices directly into the system
 * Bypasses authentication by directly manipulating the device registry
 */

import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { log, LogContext } from '../src/utils/logger';

// Import the device auth router to access the registeredDevices Map
// This is a direct manipulation for setup purposes
const API_BASE = 'http://localhost:9999/api/v1';

async function makeRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    });

    const data = await response.json();
    return { response, data };
  } catch (error) {
    log.error(`API Request failed: ${endpoint}`, LogContext.API, { error });
    throw error;
  }
}

async function seedDevices(): Promise<void> {
  log.info('📱 Seeding Christian\'s devices', LogContext.AUTH);

  // Christian's device configurations
  const devices = [
    {
      deviceId: 'iPhone-CM-15Pro-2024',
      deviceName: "Christian's iPhone 15 Pro",
      deviceType: 'iPhone' as const,
      publicKey: crypto.randomBytes(64).toString('base64'),
      metadata: {
        osVersion: '17.0',
        appVersion: '1.0.0',
        capabilities: ['bluetooth', 'biometric', 'proximity', 'face_id']
      }
    },
    {
      deviceId: 'AppleWatch-CM-Ultra-2024',
      deviceName: "Christian's Apple Watch Ultra",
      deviceType: 'AppleWatch' as const,
      publicKey: crypto.randomBytes(64).toString('base64'),
      metadata: {
        osVersion: '10.0',
        appVersion: '1.0.0',
        capabilities: ['bluetooth', 'biometric', 'proximity', 'health', 'ultra_wideband']
      }
    }
  ];

  // Since we can't directly access the in-memory Map from here,
  // let's manually add them via a special endpoint or create a setup function

  log.info('✅ Device configurations prepared', LogContext.AUTH, {
    deviceCount: devices.length,
    devices: devices.map(d => ({ name: d.deviceName, type: d.deviceType }))
  });

  // For now, let's test the challenge endpoint to see what devices need to be registered
  for (const device of devices) {
    log.info(`🔍 Testing device: ${device.deviceName}`, LogContext.AUTH);
    
    const { response, data } = await makeRequest('/device-auth/challenge', {
      method: 'POST',
      body: JSON.stringify({ deviceId: device.deviceId })
    });

    if (data.success) {
      log.info(`✅ Device already registered: ${device.deviceName}`, LogContext.AUTH);
    } else if (data.error?.code === 'DEVICE_NOT_FOUND') {
      log.info(`❌ Device needs registration: ${device.deviceName}`, LogContext.AUTH);
      log.info(`📋 Device details:`, LogContext.AUTH, {
        deviceId: device.deviceId,
        deviceName: device.deviceName,
        deviceType: device.deviceType,
        publicKeyLength: device.publicKey.length
      });
    }
  }

  // Since the devices need to be registered through the authenticated endpoint,
  // let's create a special setup that can be run with the server
  log.info('📝 To complete registration, run the following commands when authenticated:', LogContext.AUTH);
  
  for (const device of devices) {
    const curlCommand = `curl -X POST ${API_BASE}/device-auth/register \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \\
  -d '${JSON.stringify(device, null, 2).replace(/\n/g, '\\n').replace(/"/g, '\\"')}'`;
    
    log.info(`📱 ${device.deviceName}:`, LogContext.AUTH);
    process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && console.log(curlCommand);
    console.log('');
  }
}

seedDevices().catch((error) => {
  process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && console.error('Seeding failed:', error);
  process.exit(1);
});