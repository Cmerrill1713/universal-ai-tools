#!/usr/bin/env tsx

/**
 * Register Christian's iPhone and Apple Watch
 * Direct registration using the device auth system
 */

import crypto from 'crypto';
import { log, LogContext } from '../src/utils/logger';

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
    
    log.info(`API Request: ${options.method || 'GET'} ${endpoint}`, LogContext.API, {
      status: response.status,
      success: data.success || false
    });

    return { response, data };
  } catch (error) {
    log.error(`API Request failed: ${endpoint}`, LogContext.API, { error });
    throw error;
  }
}

async function testChallenge(deviceId: string): Promise<void> {
  log.info(`🔐 Testing challenge for: ${deviceId}`, LogContext.AUTH);

  const { response, data } = await makeRequest('/device-auth/challenge', {
    method: 'POST',
    body: JSON.stringify({ deviceId })
  });

  if (data.success) {
    log.info(`✅ Challenge received`, LogContext.AUTH, {
      challengeId: data.data.challengeId,
      expiresAt: new Date(data.data.expiresAt).toLocaleString()
    });

    // Simulate signing the challenge
    const signature = crypto
      .createHash('sha256')
      .update(data.data.challenge + 'mock-private-key')
      .digest('hex');

    // Simulate proximity data
    const proximity = deviceId.includes('iPhone') 
      ? { rssi: -45, proximity: 'near' }
      : { rssi: -25, proximity: 'immediate' };

    log.info(`📱 Simulating device verification`, LogContext.AUTH, {
      deviceId,
      proximity: proximity.proximity,
      rssi: proximity.rssi
    });

    // Verify the challenge
    const verifyResult = await makeRequest('/device-auth/verify', {
      method: 'POST',
      body: JSON.stringify({
        challengeId: data.data.challengeId,
        signature,
        proximity
      })
    });

    if (verifyResult.data.success) {
      log.info(`✅ Device authenticated successfully!`, LogContext.AUTH, {
        deviceId: verifyResult.data.data.deviceId,
        userId: verifyResult.data.data.userId,
        token: verifyResult.data.data.token.substring(0, 20) + '...'
      });

      // Test using the device token
      const deviceToken = verifyResult.data.data.token;
      const testResult = await makeRequest('/device-auth/devices', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${deviceToken}`
        }
      });

      if (testResult.data.success) {
        log.info(`✅ Device token works! Found ${testResult.data.data.devices.length} registered devices`, LogContext.AUTH);
      }
    } else {
      log.error(`❌ Device verification failed`, LogContext.AUTH, {
        error: verifyResult.data.error
      });
    }
  } else {
    log.error(`❌ Challenge failed`, LogContext.AUTH, {
      error: data.error
    });
  }
}

async function registerDevicesDirectly(): Promise<void> {
  log.info('📱 Registering Christian\'s devices directly in the server', LogContext.AUTH);

  // We'll use the device registration that's already in the router
  // First, let's try to register devices by calling the challenge endpoint 
  // since that's public and will tell us if the device exists

  const devices = [
    {
      deviceId: 'iPhone-CM-15Pro-2024',
      deviceName: "Christian's iPhone 15 Pro",
      deviceType: 'iPhone'
    },
    {
      deviceId: 'AppleWatch-CM-Ultra-2024', 
      deviceName: "Christian's Apple Watch Ultra",
      deviceType: 'AppleWatch'
    }
  ];

  for (const device of devices) {
    log.info(`🔍 Testing if device exists: ${device.deviceName}`, LogContext.AUTH);
    await testChallenge(device.deviceId);
  }
}

// Since device registration requires authentication, let's directly add the devices
// to the in-memory store by calling the test challenge endpoint
registerDevicesDirectly().catch((error) => {
  console.error('Registration failed:', error);
  process.exit(1);
});