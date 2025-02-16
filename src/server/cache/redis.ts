import Redis from 'ioredis';
import { WebVitalsP75Metrics } from '../types';

const redis = new Redis(process.env.REDIS_URL || 'redis://redis:6379/1');

// Duration to TTL mapping (in seconds)
const TTL_MAP = {
  '15min': 225, // 3.75 minutes (15/4)
  '1h': 900, // 15 minutes (60/4)
  '1d': 21600, // 6 hours (24*60*60/4)
  '2d': 43200, // 12 hours (48*60*60/4)
  '3d': 64800, // 18 hours (72*60*60/4)
};

// Update interval mapping (in milliseconds)
const UPDATE_INTERVALS = {
  '15min': 60 * 1000, // 1 minute
  '1h': 5 * 60 * 1000, // 5 minutes
  '1d': 10 * 60 * 1000, // 10 minutes
  '2d': 60 * 60 * 1000, // 1 hour
  '3d': 60 * 60 * 1000, // 1 hour
};

// Lock duration in seconds for each interval
const LOCK_DURATIONS = {
  '15min': 60, // 1 minute
  '1h': 300, // 5 minutes
  '1d': 600, // 10 minutes
  '2d': 3600, // 1 hour
  '3d': 3600, // 1 hour
};

export async function getCachedWebVitalsP75(duration: string, deviceType?: string): Promise<WebVitalsP75Metrics | null> {
  const key = `cwv_p75_${duration}${deviceType ? '_' + deviceType : ''}`;
  const data = await redis.get(key);
  return data ? JSON.parse(data) : null;
}

export async function cacheWebVitalsP75(duration: string, deviceType: string | undefined, data: WebVitalsP75Metrics): Promise<void> {
  const key = `cwv_p75_${duration}${deviceType ? '_' + deviceType : ''}`;
  await redis.setex(key, TTL_MAP[duration as keyof typeof TTL_MAP], JSON.stringify(data));
}

export async function acquireLock(duration: string, deviceType: string | undefined): Promise<boolean> {
  const lockKey = `cwv_p75_${duration}${deviceType ? '_' + deviceType : ''}_lock`;
  const lockTTL = LOCK_DURATIONS[duration as keyof typeof LOCK_DURATIONS];
  
  // Use SET NX with expiry to implement locking
  const result = await redis.set(lockKey, '1', 'EX', lockTTL, 'NX');
  return result === 'OK';
}

function getRandomDelay(): number {
  return Math.floor(Math.random() * 30000); // Random delay up to 30 seconds
}

export function startCacheUpdaters(updateCallback: (duration: string, deviceType: string | undefined) => Promise<void>): void {
  const deviceTypes = [undefined, 'mobile', 'desktop'];
  
  // For each duration and device type combination
  Object.entries(UPDATE_INTERVALS).forEach(([duration, interval]) => {
    deviceTypes.forEach(deviceType => {
      // Initial update with random delay
      setTimeout(() => {
        updateCallback(duration, deviceType).catch(console.error);
      }, getRandomDelay());
      
      // Schedule periodic updates
      let timeoutId: NodeJS.Timeout;
      
      function scheduleNextUpdate() {
        const nextInterval = interval + getRandomDelay();
        timeoutId = setTimeout(() => {
          updateCallback(duration, deviceType)
            .catch(console.error)
            .finally(() => {
              scheduleNextUpdate();
            });
        }, nextInterval);
      }
      
      scheduleNextUpdate();
    });
  });
}