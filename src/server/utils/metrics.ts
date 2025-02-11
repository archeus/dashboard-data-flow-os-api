import { OverallMetrics } from '../types';

export function calculateQoE(playtime: number, bufferingTime: number): number {
  const totalTime = playtime + bufferingTime;
  return totalTime > 0 ? (playtime / totalTime) * 100 : 100;
}

export function calculateMetricsFromResponse(response: any): OverallMetrics {
  const totalPlaytime = response.body.aggregations.total_playtime.value;
  const totalBufferingTime = response.body.aggregations.total_buffering.value;
  
  return {
    totalPlaytime,
    totalBufferingTime,
    overallQuality: calculateQoE(totalPlaytime, totalBufferingTime),
  };
}