export const WEB_VITALS_METRICS = ['FCP', 'TTFB', 'LCP', 'INP', 'CLS'] as const;

export const WEB_VITALS_NAMES = {
  FCP: 'First Contentful Paint',
  TTFB: 'Time to First Byte',
  LCP: 'Largest Contentful Paint',
  INP: 'Interaction to Next Paint',
  CLS: 'Cumulative Layout Shift',
} as const;

export const INDEX_PATTERN = 'analytics_v4_*';