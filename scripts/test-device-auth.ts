#!/usr/bin/env tsx

/**
 * Test Device Authentication Flow
 * Tests the complete Apple device authentication system
 */

import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { log, LogContext } from '../src/utils/logger';

const API_BASE = 'http://localhost:9999/api/v1';
const JWT_SECRET = process.env.JWT_SECRET || '';

interface DeviceConfig {
  deviceId: string;
  deviceName: string;
  deviceType: 'iPhone' | 'iPad' | 'AppleWatch' | 'Mac';
  publicKey: string;
  metadata: {
    osVersion?: string;
    appVersion?: string;
    capabilities?: string[];
  };
}

async function generateTestJWT(userId: string = 'christian'): Promise<string> {
  const payload = {
    userId,
    email: 'christian@universal-ai-tools.com',
    isAdmin: true,
    permissions: ['*'],
  };

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: '1h',
    issuer: 'universal-ai-tools',
    subject: userId,
  });
}

async function makeRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });

    const data = await response.json();

    log.info(`API Request: ${options.method || 'GET'} ${endpoint}`, LogContext.API, {
      status: response.status,
      success: data.success || false,
    });

    return { response, data };
  } catch (error) {
    log.error(`API Request failed: ${endpoint}`, LogContext.API, { error });
    throw error;
  }
}

async function registerDevice(token: string, device: DeviceConfig): Promise<string | null> {
  try {
    const { response, data } = await makeRequest('/device-auth/register', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(device),
    });

    if (data.success) {
      log.info(`✅ Device registered: ${device.deviceName}`, LogContext.AUTH, {
        deviceId: data.data.deviceId,
        deviceType: device.deviceType,
      });
      return data.data.deviceId;
    } else {
      log.error(`❌ Device registration failed: ${device.deviceName}`, LogContext.AUTH, {
        error: data.error,
      });
      return null;
    }
  } catch (error) {
    log.error(`❌ Device registration error: ${device.deviceName}`, LogContext.AUTH, { error });
    return null;
  }
}

async function requestChallenge(
  deviceId: string
): Promise<{ challengeId: string; challenge: string } | null> {
  try {
    const { response, data } = await makeRequest('/device-auth/challenge', {
      method: 'POST',
      body: JSON.stringify({ deviceId }),
    });

    if (data.success) {
      log.info(`✅ Challenge received for device`, LogContext.AUTH, {
        challengeId: data.data.challengeId,
        expiresAt: data.data.expiresAt,
      });
      return {
        challengeId: data.data.challengeId,
        challenge: data.data.challenge,
      };
    } else {
      log.error(`❌ Challenge request failed`, LogContext.AUTH, {
        error: data.error,
      });
      return null;
    }
  } catch (error) {
    log.error(`❌ Challenge request error`, LogContext.AUTH, { error });
    return null;
  }
}

async function verifyChallenge(
  challengeId: string,
  signature: string,
  proximity?: unknown
): Promise<string | null> {
  try {
    const { response, data } = await makeRequest('/device-auth/verify', {
      method: 'POST',
      body: JSON.stringify({
        challengeId,
        signature,
        proximity,
      }),
    });

    if (data.success) {
      log.info(`✅ Device authenticated successfully`, LogContext.AUTH, {
        deviceId: data.data.deviceId,
        userId: data.data.userId,
        expiresIn: data.data.expiresIn,
      });
      return data.data.token;
    } else {
      log.error(`❌ Device verification failed`, LogContext.AUTH, {
        error: data.error,
      });
      return null;
    }
  } catch (error) {
    log.error(`❌ Device verification error`, LogContext.AUTH, { error });
    return null;
  }
}

async function testCompleteFlow(): Promise<void> {
  log.info('🧪 Starting complete device authentication test', LogContext.AUTH);

  // Generate test JWT for user registration
  const userToken = await generateTestJWT('christian');
  log.info('✅ Generated test JWT token', LogContext.AUTH);

  // Test device configurations
  const devices: DeviceConfig[] = [
    {
      deviceId: 'iPhone-CM-2024',
      deviceName: "Christian's iPhone 15 Pro",
      deviceType: 'iPhone',
      publicKey: crypto.randomBytes(64).toString('base64'),
      metadata: {
        osVersion: '17.0',
        appVersion: '1.0.0',
        capabilities: ['bluetooth', 'biometric', 'proximity'],
      },
    },
    {
      deviceId: 'AppleWatch-CM-2024',
      deviceName: "Christian's Apple Watch Ultra",
      deviceType: 'AppleWatch',
      publicKey: crypto.randomBytes(64).toString('base64'),
      metadata: {
        osVersion: '10.0',
        appVersion: '1.0.0',
        capabilities: ['bluetooth', 'biometric', 'proximity', 'health'],
      },
    },
  ];

  // Register devices
  const registeredDevices: { [key: string]: string } = {};

  for (const device of devices) {
    const deviceId = await registerDevice(userToken, device);
    if (deviceId) {
      registeredDevices[device.deviceId] = deviceId;
    }
  }

  // Test authentication flow for each device
  for (const [originalDeviceId, registeredDeviceId] of Object.entries(registeredDevices)) {
    log.info(`🔐 Testing authentication for: ${originalDeviceId}`, LogContext.AUTH);

    // Request challenge
    const challenge = await requestChallenge(originalDeviceId);
    if (!challenge) continue;

    // Simulate signing challenge (in real app, this would use private key)
    const signature = crypto
      .createHash('sha256')
      .update(challenge.challenge + 'mock-private-key')
      .digest('hex');

    // Simulate proximity data (iPhone close, Apple Watch immediate)
    const proximity = originalDeviceId.includes('iPhone')
      ? { rssi: -45, proximity: 'near' }
      : { rssi: -35, proximity: 'immediate' };

    // Verify challenge
    const deviceToken = await verifyChallenge(challenge.challengeId, signature, proximity);
    if (deviceToken) {
      log.info(`✅ Device token received`, LogContext.AUTH, {
        device: originalDeviceId,
        tokenLength: deviceToken.length,
      });

      // Test using the device token for API access
      const { response, data } = await makeRequest('/device-auth/devices', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${deviceToken}`,
        },
      });

      if (data.success) {
        log.info(`✅ Device token works for API access`, LogContext.AUTH, {
          devicesCount: data.data.devices.length,
        });
      }
    }
  }

  log.info('🎉 Device authentication test completed', LogContext.AUTH);
}

// Run the test
testCompleteFlow().catch((error) => {
  process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && console.error('Test failed:', error);
  process.exit(1);
});

export { generateTestJWT, registerDevice, testCompleteFlow };
