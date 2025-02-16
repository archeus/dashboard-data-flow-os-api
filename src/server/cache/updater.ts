import { getWebVitalsP75Metrics } from '../opensearch';
import { acquireLock, cacheWebVitalsP75 } from './redis';
import { getTimeRangeFromDuration } from '../utils/time';

export async function updateWebVitalsP75Cache(duration: string, deviceType: string | undefined): Promise<void> {
  // Try to acquire lock
  const hasLock = await acquireLock(duration, deviceType);
  if (!hasLock) {
    console.log("No lock acquired for duration", duration, "and device type", deviceType);
    return; // Another instance is updating
  }

  let t0
  try {
    t0 = performance.now()
    console.log('Updating Web Vitals P75 cache for', duration, deviceType || 'all')
    // Fetch fresh data
    const { actualStartTime, actualEndTime } = getTimeRangeFromDuration(duration)

    const metrics = await getWebVitalsP75Metrics({
      startTime: actualStartTime.toISOString(),
      endTime: actualEndTime.toISOString(),
      deviceType
    })

    // Update cache
    await cacheWebVitalsP75(duration, deviceType, metrics)
    console.log('Web Vitals P75 cache updated for', duration, deviceType || 'all' + ' in', performance.now() - t0, 'ms')
  } catch (error) {
    console.error(`Error updating Web Vitals P75 cache for ${duration}${deviceType ? ' ' + deviceType : ''}: after`, performance.now() - t0, 'ms', error)
  }
}
