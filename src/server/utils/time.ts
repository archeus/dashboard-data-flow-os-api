import { subDays, parseISO, differenceInDays } from 'date-fns';
import { TimeRange } from '../types';

export function getTimeRange(startTime?: string, endTime?: string): { actualStartTime: Date; actualEndTime: Date } {
  const now = new Date();
  const actualEndTime = endTime ? parseISO(endTime) : now;
  const actualStartTime = startTime ? parseISO(startTime) : subDays(now, 1);
  return { actualStartTime, actualEndTime };
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