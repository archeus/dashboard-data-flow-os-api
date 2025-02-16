// Common interfaces
export interface TimeRange {
  startTime?: string;
  endTime?: string;
  duration?: string;
}

export interface FilterParams extends TimeRange {
  room?: string;
  sessionId?: string;
  guestUser?: boolean;
  continentCode?: string;
  countryCode?: string;
  browserName?: string;
  ispName?: string;
  deviceType?: string;
  route?: string;
}

// QoE related interfaces
export interface QoEResponse {
  timestamp: string;
  playtime: number;
  bufferingTime: number;
  qoe: number;
}

export interface OverallMetrics {
  totalPlaytime: number;
  totalBufferingTime: number;
  overallQuality: number;
}

export interface OverallMetricsResponse {
  overall: OverallMetrics;
  guest: OverallMetrics;
  loggedIn: OverallMetrics;
}

export interface QoEMetricsResult {
  bucketDuration: string;
  data: QoEResponse[];
}

// Autocomplete interfaces
export interface AutocompleteResult {
  value: string;
  count: number;
}

// Country metrics interfaces
export interface CountryQoEMetric {
  country: string;
  countryCode: string;
  latitude: number;
  longitude: number;
  qoe: number;
  totalPlaytime: number;
  totalBufferingTime: number;
  totalSessions: number | null;
  uniqueUsers: number | null;
}

// Web Vitals interfaces
export interface WebVitalsMetric {
  name: string;
  ratings: {
    good: number;
    'needs-improvement': number;
    poor: number;
  };
}

export interface WebVitalsP75Metric {
  name: string;
  p75: number;
}

export interface WebVitalsMetrics {
  FCP: WebVitalsMetric;
  TTFB: WebVitalsMetric;
  LCP: WebVitalsMetric;
  INP: WebVitalsMetric;
  CLS: WebVitalsMetric;
}

export interface WebVitalsP75Metrics {
  FCP: WebVitalsP75Metric;
  TTFB: WebVitalsP75Metric;
  LCP: WebVitalsP75Metric;
  INP: WebVitalsP75Metric;
  CLS: WebVitalsP75Metric;
}

export type WebVitalMetricType = 'FCP' | 'TTFB' | 'LCP' | 'INP' | 'CLS';

export interface UserMetrics {
  uniqueUsers: number;
  loggedInUsers: number;
  guestUsers: number;
  goldUsers: number;
  performers: number;
  moderators: number;
  guestBilling: number;
  goldFree: number;
  goldPromo: number;
}

export interface ActivityMetrics {
  onlineCams: number;
  tips: number;
  purchases: number;
  topDomains: Array<{
    domain: string;
    count: number;
  }>;
}