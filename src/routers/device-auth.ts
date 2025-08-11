/**
 * Device Authentication Router
 * Manages device registration and authentication for Swift companion app
 * Supports iPhone/Apple Watch proximity-based authentication
 */

import crypto from 'crypto';
import type { Request, Response } from 'express';
import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';

import { getJwtSecret } from '@/config/environment';
import { authenticate } from '@/middleware/auth';
import { zodValidate } from '@/middleware/zod-validate';
import { deviceAuthWebSocket } from '@/services/device-auth-websocket';
import { log, LogContext } from '@/utils/logger';

interface RegisteredDevice {
  id: string;
  userId: string;
  deviceId: string; // Unique device identifier from iOS/watchOS
  deviceName: string;
  deviceType: 'iPhone' | 'iPad' | 'AppleWatch' | 'Mac';
  publicKey: string; // For secure communication
  createdAt: string;
  lastSeen: string;
  trusted: boolean;
  metadata: {
    osVersion?: string;
    appVersion?: string;
    capabilities?: string[];
  };
}

interface DeviceChallenge {
  id: string;
  deviceId: string;
  challenge: string;
  expiresAt: number;
  completed: boolean;
}

interface ProximitySession {
  sessionId: string;
  userId: string;
  deviceId: string;
  rssi: number; // Bluetooth signal strength
  proximity: 'immediate' | 'near' | 'far' | 'unknown';
  startedAt: string;
  lastUpdated: string;
  active: boolean;
}

// In-memory storage (should be moved to database)
const registeredDevices: Map<string, RegisteredDevice> = new Map();
const deviceChallenges: Map<string, DeviceChallenge> = new Map();
const proximitySessions: Map<string, ProximitySession> = new Map();

// Helper function to generate device auth token
async function generateDeviceAuthToken(device: RegisteredDevice): Promise<string> {
  const secret = await getJwtSecret();
  return jwt.sign(
    {
      deviceId: device.id,
      userId: device.userId,
      deviceType: device.deviceType,
      trusted: device.trusted,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 24 * 60 * 60, // 24 hours
    },
    secret
  );
}

// Pre-register Christian's devices for testing
function seedChristianDevices(): void {
  const christianUserId = 'christian';

  const devices: RegisteredDevice[] = [
    {
      id: uuidv4(),
      userId: christianUserId,
      deviceId: 'iPhone-CM-15Pro-2024',
      deviceName: "Christian's iPhone 15 Pro",
      deviceType: 'iPhone',
      publicKey: 'iphone-public-key-2024',
      createdAt: new Date().toISOString(),
      lastSeen: new Date().toISOString(),
      trusted: true,
      metadata: {
        osVersion: '17.0',
        appVersion: '1.0.0',
        capabilities: ['bluetooth', 'biometric', 'proximity', 'face_id'],
      },
    },
    {
      id: uuidv4(),
      userId: christianUserId,
      deviceId: 'AppleWatch-CM-Ultra-2024',
      deviceName: "Christian's Apple Watch Ultra",
      deviceType: 'AppleWatch',
      publicKey: 'applewatch-public-key-2024',
      createdAt: new Date().toISOString(),
      lastSeen: new Date().toISOString(),
      trusted: true,
      metadata: {
        osVersion: '10.0',
        appVersion: '1.0.0',
        capabilities: ['bluetooth', 'biometric', 'proximity', 'health', 'ultra_wideband'],
      },
    },
  ];

  devices.forEach((device) => {
    registeredDevices.set(device.id, device);
  });

  log.info("✅ Pre-registered Christian's devices", LogContext.AUTH, {
    devices: devices.map((d) => ({ name: d.deviceName, type: d.deviceType, trusted: d.trusted })),
  });
}

// Seed devices on module load
seedChristianDevices();

const router = Router();

/**
 * POST /api/v1/device-auth/register-initial
 * Initial device registration without authentication (for Swift app first-time setup)
 */
router.post(
  '/register-initial',
  zodValidate(
    z.object({
      deviceId: z.string(),
      deviceName: z.string(),
      deviceType: z.enum(['iPhone', 'iPad', 'AppleWatch', 'Mac']),
      publicKey: z.string(),
      userId: z.string().optional(),
      metadata: z.record(z.any()).optional(),
    })
  ),
  async (req: Request, res: Response) => {
    try {
      const {
        deviceId,
        deviceName,
        deviceType,
        publicKey,
        userId = 'default-user',
        metadata = {},
      } = req.body;

      // Check if device already registered
      const existingDevice = Array.from(registeredDevices.values()).find(
        (d) => d.deviceId === deviceId
      );

      if (existingDevice) {
        // Update existing device
        existingDevice.deviceName = deviceName;
        existingDevice.publicKey = publicKey;
        existingDevice.lastSeen = new Date().toISOString();
        existingDevice.metadata = { ...existingDevice.metadata, ...metadata };

        return res.json({
          success: true,
          data: {
            deviceId: existingDevice.id,
            message: 'Device updated successfully',
            authToken: await generateDeviceAuthToken(existingDevice),
          },
        });
      }

      // Register new device
      const device: RegisteredDevice = {
        id: uuidv4(),
        userId,
        deviceId,
        deviceName,
        deviceType,
        publicKey,
        createdAt: new Date().toISOString(),
        lastSeen: new Date().toISOString(),
        trusted: true, // Auto-trust for initial registration
        metadata,
      };

      registeredDevices.set(device.id, device);

      log.info('Device registered (initial)', LogContext.AUTH, {
        userId,
        deviceType,
        deviceName,
      });

      // Broadcast device registration event
      deviceAuthWebSocket.broadcastAuthEvent({
        type: 'device_registered',
        deviceId: device.id,
        userId,
        timestamp: new Date().toISOString(),
        data: {
          deviceName,
          deviceType,
          trusted: device.trusted,
        },
      });

      return res.json({
        success: true,
        data: {
          deviceId: device.id,
          message: 'Device registered successfully',
          authToken: await generateDeviceAuthToken(device),
          requiresTrust: false,
        },
        metadata: {
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || uuidv4(),
        },
      });
    } catch (error) {
      log.error('Device registration failed', LogContext.AUTH, { error });
      return res.status(500).json({
        success: false,
        error: { code: 'REGISTRATION_ERROR', message: 'Failed to register device' },
      });
    }
  }
);

/**
 * POST /api/v1/device-auth/register
 * Register a new device for authentication (requires authentication)
 */
router.post(
  '/register',
  authenticate,
  zodValidate(
    z.object({
      deviceId: z.string(),
      deviceName: z.string(),
      deviceType: z.enum(['iPhone', 'iPad', 'AppleWatch', 'Mac']),
      publicKey: z.string(),
      metadata: z.record(z.any()).optional(),
    })
  ),
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      const { deviceId, deviceName, deviceType, publicKey, metadata = {} } = req.body;

      // Check if device already registered
      const existingDevice = Array.from(registeredDevices.values()).find(
        (d) => d.deviceId === deviceId && d.userId === userId
      );

      if (existingDevice) {
        // Update existing device
        existingDevice.deviceName = deviceName;
        existingDevice.publicKey = publicKey;
        existingDevice.lastSeen = new Date().toISOString();
        existingDevice.metadata = { ...existingDevice.metadata, ...metadata };

        return res.json({
          success: true,
          data: {
            deviceId: existingDevice.id,
            message: 'Device updated successfully',
          },
        });
      }

      // Register new device
      const device: RegisteredDevice = {
        id: uuidv4(),
        userId,
        deviceId,
        deviceName,
        deviceType,
        publicKey,
        createdAt: new Date().toISOString(),
        lastSeen: new Date().toISOString(),
        trusted: false, // Require manual trust
        metadata,
      };

      registeredDevices.set(device.id, device);

      log.info('Device registered', LogContext.AUTH, {
        userId,
        deviceType,
        deviceName,
      });

      // Broadcast device registration event
      deviceAuthWebSocket.broadcastAuthEvent({
        type: 'device_registered',
        deviceId: device.id,
        userId,
        timestamp: new Date().toISOString(),
        data: {
          deviceName,
          deviceType,
          trusted: device.trusted,
        },
      });

      return res.json({
        success: true,
        data: {
          deviceId: device.id,
          message: 'Device registered successfully',
          requiresTrust: true,
        },
        metadata: {
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || uuidv4(),
        },
      });
    } catch (error) {
      log.error('Device registration failed', LogContext.AUTH, {
        error: error instanceof Error ? error.message : String(error),
      });

      return res.status(500).json({
        success: false,
        error: {
          code: 'DEVICE_REGISTRATION_ERROR',
          message: 'Failed to register device',
        },
      });
    }
  }
);

/**
 * GET /api/v1/device-auth/devices
 * List registered devices for a user
 */
router.get('/devices', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;

    const userDevices = Array.from(registeredDevices.values())
      .filter((device) => device.userId === userId)
      .map((device) => ({
        id: device.id,
        deviceName: device.deviceName,
        deviceType: device.deviceType,
        trusted: device.trusted,
        lastSeen: device.lastSeen,
        createdAt: device.createdAt,
      }));

    return res.json({
      success: true,
      data: {
        devices: userDevices,
        total: userDevices.length,
      },
      metadata: {
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || uuidv4(),
      },
    });
  } catch (error) {
    log.error('Failed to list devices', LogContext.AUTH, {
      error: error instanceof Error ? error.message : String(error),
    });

    return res.status(500).json({
      success: false,
      error: {
        code: 'DEVICE_LIST_ERROR',
        message: 'Failed to retrieve devices',
      },
    });
  }
});

/**
 * POST /api/v1/device-auth/challenge
 * Request authentication challenge for device
 */
router.post(
  '/challenge',
  zodValidate(z.object({ deviceId: z.string() })),
  async (req: Request, res: Response) => {
    try {
      const { deviceId } = req.body;

      // Find registered device by deviceId (user-provided ID)
      const device = Array.from(registeredDevices.values()).find((d) => d.deviceId === deviceId);

      if (!device) {
        // Only create temporary device for test devices with specific prefix
        if (deviceId.startsWith('TEST-DEVICE-') || deviceId.startsWith('test-device-')) {
          const tempDevice = {
            id: uuidv4(),
            userId: 'default-user',
            deviceId,
            deviceName: 'Temporary Test Device',
            deviceType: 'iPhone' as const,
            publicKey: 'temp-key',
            createdAt: new Date().toISOString(),
            lastSeen: new Date().toISOString(),
            trusted: true,
            metadata: {},
          };
          registeredDevices.set(tempDevice.id, tempDevice);

          // Generate challenge for temp device
          const challenge: DeviceChallenge = {
            id: uuidv4(),
            deviceId: tempDevice.id,
            challenge: crypto.randomBytes(32).toString('hex'),
            expiresAt: Date.now() + 300000, // 5 minutes
            completed: false,
          };

          deviceChallenges.set(challenge.id, challenge);

          return res.json({
            success: true,
            data: {
              challengeId: challenge.id,
              challenge: challenge.challenge,
              expiresAt: challenge.expiresAt,
            },
            metadata: {
              timestamp: new Date().toISOString(),
              requestId: req.headers['x-request-id'] || uuidv4(),
            },
          });
        }

        // Return 404 for truly unregistered devices
        return res.status(404).json({
          success: false,
          error: {
            code: 'DEVICE_NOT_FOUND',
            message: 'Device not registered',
          },
        });
      }

      // Generate challenge
      const challenge: DeviceChallenge = {
        id: uuidv4(),
        deviceId: device.id,
        challenge: crypto.randomBytes(32).toString('hex'),
        expiresAt: Date.now() + 300000, // 5 minutes
        completed: false,
      };

      deviceChallenges.set(challenge.id, challenge);

      return res.json({
        success: true,
        data: {
          challengeId: challenge.id,
          challenge: challenge.challenge,
          expiresAt: challenge.expiresAt,
        },
        metadata: {
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || uuidv4(),
        },
      });
    } catch (error) {
      log.error('Challenge generation failed', LogContext.AUTH, {
        error: error instanceof Error ? error.message : String(error),
      });

      return res.status(500).json({
        success: false,
        error: {
          code: 'CHALLENGE_ERROR',
          message: 'Failed to generate challenge',
        },
      });
    }
  }
);

/**
 * POST /api/v1/device-auth/verify
 * Verify challenge response and issue JWT
 */
router.post(
  '/verify',
  zodValidate(
    z.object({
      challengeId: z.string(),
      signature: z.string(),
      proximity: z
        .object({
          rssi: z.number().int().min(-100).max(0),
        })
        .optional(),
    })
  ),
  async (req: Request, res: Response) => {
    try {
      const { challengeId, signature, proximity } = req.body;

      const challenge = deviceChallenges.get(challengeId);
      if (!challenge) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'CHALLENGE_NOT_FOUND',
            message: 'Challenge not found or expired',
          },
        });
      }

      // Check expiration
      if (Date.now() > challenge.expiresAt) {
        deviceChallenges.delete(challengeId);
        return res.status(401).json({
          success: false,
          error: {
            code: 'CHALLENGE_EXPIRED',
            message: 'Challenge has expired',
          },
        });
      }

      const device = registeredDevices.get(challenge.deviceId);
      if (!device) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'DEVICE_NOT_FOUND',
            message: 'Device not found',
          },
        });
      }

      // TODO: Verify signature using device's public key
      // For now, accept any signature for testing

      // Update device last seen
      device.lastSeen = new Date().toISOString();

      // Create proximity session if proximity data provided
      if (proximity && proximity.rssi) {
        const session: ProximitySession = {
          sessionId: uuidv4(),
          userId: device.userId,
          deviceId: device.id,
          rssi: proximity.rssi,
          proximity: determineProximity(proximity.rssi),
          startedAt: new Date().toISOString(),
          lastUpdated: new Date().toISOString(),
          active: true,
        };
        proximitySessions.set(session.sessionId, session);
      }

      // Generate JWT with device claims
      const token = jwt.sign(
        {
          userId: device.userId,
          deviceId: device.id,
          deviceType: device.deviceType,
          trusted: device.trusted,
        },
        await getJwtSecret(),
        {
          expiresIn: '24h',
          issuer: 'universal-ai-tools',
          subject: device.userId,
        }
      );

      // Mark challenge as completed
      challenge.completed = true;
      deviceChallenges.delete(challengeId);

      log.info('Device authenticated', LogContext.AUTH, {
        userId: device.userId,
        deviceType: device.deviceType,
        proximity: proximity?.rssi ? determineProximity(proximity.rssi) : 'unknown',
      });

      // Broadcast authentication state change
      deviceAuthWebSocket.broadcastAuthEvent({
        type: 'auth_state_changed',
        deviceId: device.id,
        userId: device.userId,
        timestamp: new Date().toISOString(),
        data: {
          authenticated: true,
          deviceType: device.deviceType,
          proximity: proximity?.rssi ? determineProximity(proximity.rssi) : 'unknown',
        },
      });

      return res.json({
        success: true,
        data: {
          token,
          expiresIn: 86400, // 24 hours
          deviceId: device.id,
          userId: device.userId,
        },
        metadata: {
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || uuidv4(),
        },
      });
    } catch (error) {
      log.error('Verification failed', LogContext.AUTH, {
        error: error instanceof Error ? error.message : String(error),
      });

      return res.status(500).json({
        success: false,
        error: {
          code: 'VERIFICATION_ERROR',
          message: 'Failed to verify device',
        },
      });
    }
  }
);

/**
 * POST /api/v1/device-auth/proximity
 * Update proximity information
 */
router.post(
  '/proximity',
  authenticate,
  zodValidate(z.object({ deviceId: z.string(), rssi: z.number().int().min(-100).max(0) })),
  async (req: Request, res: Response) => {
    try {
      const { deviceId, rssi } = req.body;
      const userId = (req as any).user?.id;

      // Find active session
      let session = Array.from(proximitySessions.values()).find(
        (s) => s.deviceId === deviceId && s.userId === userId && s.active
      );

      if (!session) {
        // Create new session
        session = {
          sessionId: uuidv4(),
          userId,
          deviceId,
          rssi,
          proximity: determineProximity(rssi),
          startedAt: new Date().toISOString(),
          lastUpdated: new Date().toISOString(),
          active: true,
        };
        proximitySessions.set(session.sessionId, session);
      } else {
        // Update existing session
        session.rssi = rssi;
        session.proximity = determineProximity(rssi);
        session.lastUpdated = new Date().toISOString();
      }

      return res.json({
        success: true,
        data: {
          sessionId: session.sessionId,
          proximity: session.proximity,
          locked: session.proximity === 'far' || session.proximity === 'unknown',
        },
        metadata: {
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || uuidv4(),
        },
      });
    } catch (error) {
      log.error('Proximity update failed', LogContext.AUTH, {
        error: error instanceof Error ? error.message : String(error),
      });

      return res.status(500).json({
        success: false,
        error: {
          code: 'PROXIMITY_ERROR',
          message: 'Failed to update proximity',
        },
      });
    }
  }
);

/**
 * Helper function to determine proximity from RSSI
 */
function determineProximity(rssi: number): 'immediate' | 'near' | 'far' | 'unknown' {
  if (rssi >= -50) return 'immediate'; // < 1 meter
  if (rssi >= -70) return 'near'; // 1-3 meters
  if (rssi >= -90) return 'far'; // 3-10 meters
  return 'unknown'; // > 10 meters or no signal
}

export default router;
