import { subDays, parseISO, differenceInDays } from 'date-fns';
import { TimeRange } from '../types';

export function getTimeRangeFromDuration(duration: string): { actualStartTime: Date; actualEndTime: Date } {
  const now = new Date();
  let actualStartTime: Date;

  switch (duration) {
    case '15min':
      actualStartTime = new Date(now.getTime() - 15 * 60 * 1000);
      break;
    case '1h':
      actualStartTime = new Date(now.getTime() - 60 * 60 * 1000);
      break;
    case '1d':
      actualStartTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      break;
    case '2d':
      actualStartTime = new Date(now.getTime() - 48 * 60 * 60 * 1000);
      break;
    case '3d':
      actualStartTime = new Date(now.getTime() - 72 * 60 * 60 * 1000);
      break;
    default:
      throw new Error('Invalid duration. Supported values: 15min, 1h, 1d, 2d, 3d');
  }

  return { actualStartTime, actualEndTime: now };
}

export function getTimeRange(startTime?: string, endTime?: string): { actualStartTime: Date; actualEndTime: Date } {
  const now = new Date();
  const actualEndTime = endTime ? parseISO(endTime) : now;
  const actualStartTime = startTime ? parseISO(startTime) : subDays(now, 1);
  return { actualStartTime, actualEndTime };
}

export function shouldIncludeCardinality(startTime: Date, endTime: Date): boolean {
  const diffInMinutes = (endTime.getTime() - startTime.getTime()) / (1000 * 60);
  return diffInMinutes <= 90;
}

export function calculateInterval(startTime: Date, endTime: Date, defaultInterval: string = '1m'): string {
  const daysDifference = differenceInDays(endTime, startTime);
  
  if (daysDifference > 7) {
    return '1h';
  } else if (daysDifference > 1) {
    return '10m';
  }
  
  return defaultInterval;
}