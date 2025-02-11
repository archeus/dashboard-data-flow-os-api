import { Client } from '@opensearch-project/opensearch';
import { getTimeRange, calculateInterval } from './utils/time';
import { buildBasicFilters, buildTimeRangeQuery } from './utils/query-builder';
import { calculateQoE, calculateMetricsFromResponse } from './utils/metrics';
import { WEB_VITALS_METRICS, WEB_VITALS_NAMES, INDEX_PATTERN } from './constants';
import type {
  AutocompleteResult,
  CountryQoEMetric,
  FilterParams,
  OverallMetricsResponse,
  QoEMetricsResult,
  WebVitalsMetrics,
  WebVitalsP75Metrics,
  WebVitalMetricType
} from './types';

// Initialize the OpenSearch client
export const client = new Client({
  node: process.env.OPENSEARCH_URL || 'http://localhost:9200',
});

export async function getAutocompleteResults(
  field: string,
  prefix: string = '',
  size: number = 10,
  event: string = 'player'
): Promise<AutocompleteResult[]> {
  const response = await client.search({
    index: INDEX_PATTERN,
    body: {
      size: 0,
      query: {
        bool: {
          must: [
            event && { term: { event } },
            prefix && {
              wildcard: {
                [field]: {
                  value: `${prefix}*`,
                  case_insensitive: true
                }
              }
            }
          ].filter(Boolean)
        }
      },
      aggs: {
        values: {
          terms: {
            field,
            size,
            order: { _count: 'desc' }
          }
        }
      }
    }
  });

  return response.body.aggregations.values.buckets.map((bucket: any) => ({
    value: bucket.key,
    count: bucket.doc_count
  }));
}

export async function getPlayerQoEMetrics(params: FilterParams): Promise<QoEMetricsResult> {
  const { actualStartTime, actualEndTime } = getTimeRange(params.startTime, params.endTime);
  const interval = calculateInterval(actualStartTime, actualEndTime, params.interval);

  const mustClauses = [
    buildTimeRangeQuery(actualStartTime.toISOString(), actualEndTime.toISOString()),
    ...buildBasicFilters(params, 'player')
  ];

  const response = await client.search({
    index: INDEX_PATTERN,
    body: {
      size: 0,
      query: { bool: { must: mustClauses } },
      aggs: {
        timeline: {
          date_histogram: {
            field: '@timestamp',
            fixed_interval: interval,
            min_doc_count: 1,
          },
          aggs: {
            total_playtime: { sum: { field: 'payload_player_playtime' } },
            total_buffering: { sum: { field: 'payload_player_bufferingTime' } }
          }
        }
      }
    }
  });

  const data = response.body.aggregations.timeline.buckets.map((bucket: any) => ({
    timestamp: bucket.key_as_string,
    playtime: bucket.total_playtime.value,
    bufferingTime: bucket.total_buffering.value,
    qoe: calculateQoE(bucket.total_playtime.value, bucket.total_buffering.value)
  }));

  return {
    bucketDuration: interval,
    data
  };
}

export async function getPlayerOverallMetrics(params: FilterParams): Promise<OverallMetricsResponse> {
  const { actualStartTime, actualEndTime } = getTimeRange(params.startTime, params.endTime);
  const timeRangeQuery = buildTimeRangeQuery(actualStartTime.toISOString(), actualEndTime.toISOString());
  const baseFilters = buildBasicFilters(params, 'player');

  const [overallResponse, guestResponse, loggedInResponse] = await Promise.all([
    client.search({
      index: INDEX_PATTERN,
      body: {
        size: 0,
        query: { bool: { must: [timeRangeQuery, ...baseFilters] } },
        aggs: {
          total_playtime: { sum: { field: 'payload_player_playtime' } },
          total_buffering: { sum: { field: 'payload_player_bufferingTime' } }
        }
      }
    }),
    client.search({
      index: INDEX_PATTERN,
      body: {
        size: 0,
        query: { bool: { must: [timeRangeQuery, ...baseFilters, { term: { guestUser: true } }] } },
        aggs: {
          total_playtime: { sum: { field: 'payload_player_playtime' } },
          total_buffering: { sum: { field: 'payload_player_bufferingTime' } }
        }
      }
    }),
    client.search({
      index: INDEX_PATTERN,
      body: {
        size: 0,
        query: { bool: { must: [timeRangeQuery, ...baseFilters, { term: { guestUser: false } }] } },
        aggs: {
          total_playtime: { sum: { field: 'payload_player_playtime' } },
          total_buffering: { sum: { field: 'payload_player_bufferingTime' } }
        }
      }
    })
  ]);

  return {
    overall: calculateMetricsFromResponse(overallResponse),
    guest: calculateMetricsFromResponse(guestResponse),
    loggedIn: calculateMetricsFromResponse(loggedInResponse)
  };
}

export async function getCountryQoEMetrics(params: FilterParams): Promise<CountryQoEMetric[]> {
  const { actualStartTime, actualEndTime } = getTimeRange(params.startTime, params.endTime);
  const mustClauses = [
    buildTimeRangeQuery(actualStartTime.toISOString(), actualEndTime.toISOString()),
    ...buildBasicFilters(params, 'player')
  ];

  const response = await client.search({
    index: INDEX_PATTERN,
    body: {
      size: 0,
      query: { bool: { must: mustClauses } },
      aggs: {
        by_country: {
          terms: {
            field: 'geoip.countryCode.keyword',
            size: 1000
          },
          aggs: {
            country_name: { terms: { field: 'geoip.country.keyword', size: 1 } },
            total_playtime: { sum: { field: 'payload_player_playtime' } },
            total_buffering: { sum: { field: 'payload_player_bufferingTime' } },
            location: { geo_centroid: { field: 'geoip.point' } },
            unique_sessions: { cardinality: { field: 'pageId.keyword' } },
            unique_users: { cardinality: { field: 'sessionId.keyword' } }
          }
        }
      }
    }
  });

  return response.body.aggregations.by_country.buckets.map((bucket: any) => {
    const playtime = bucket.total_playtime.value;
    const bufferingTime = bucket.total_buffering.value;
    const location = bucket.location.location;

    return {
      country: bucket.country_name.buckets[0]?.key || bucket.key,
      countryCode: bucket.key,
      latitude: location?.lat || 0,
      longitude: location?.lon || 0,
      totalPlaytime: playtime,
      totalBufferingTime: bufferingTime,
      qoe: calculateQoE(playtime, bufferingTime),
      totalSessions: bucket.unique_sessions.value,
      uniqueUsers: bucket.unique_users.value
    };
  });
}

export async function getWebVitalsMetrics(params: FilterParams): Promise<WebVitalsMetrics> {
  const { actualStartTime, actualEndTime } = getTimeRange(params.startTime, params.endTime);
  const mustClauses = [
    buildTimeRangeQuery(actualStartTime.toISOString(), actualEndTime.toISOString()),
    ...buildBasicFilters(params, 'web_vitals')
  ];

  const response = await client.search({
    index: INDEX_PATTERN,
    body: {
      size: 0,
      query: { bool: { must: mustClauses } },
      aggs: Object.fromEntries(
        WEB_VITALS_METRICS.map((metric) => [
          metric,
          {
            filters: {
              filters: {
                good: { term: { [`payload_web_vitals_${metric}_rating.keyword`]: 'good' } },
                'needs-improvement': { term: { [`payload_web_vitals_${metric}_rating.keyword`]: 'needs-improvement' } },
                poor: { term: { [`payload_web_vitals_${metric}_rating.keyword`]: 'poor' } }
              }
            }
          }
        ])
      )
    }
  });

  return Object.fromEntries(
    WEB_VITALS_METRICS.map(metric => [
      metric,
      {
        name: WEB_VITALS_NAMES[metric],
        ratings: {
          good: response.body.aggregations[metric]?.buckets?.good?.doc_count || 0,
          'needs-improvement': response.body.aggregations[metric]?.buckets?.['needs-improvement']?.doc_count || 0,
          poor: response.body.aggregations[metric]?.buckets?.poor?.doc_count || 0
        }
      }
    ])
  ) as WebVitalsMetrics;
}

export async function getWebVitalsP75Metrics(params: FilterParams): Promise<WebVitalsP75Metrics> {
  const { actualStartTime, actualEndTime } = getTimeRange(params.startTime, params.endTime);
  const mustClauses = [
    buildTimeRangeQuery(actualStartTime.toISOString(), actualEndTime.toISOString()),
    ...buildBasicFilters(params, 'web_vitals')
  ];

  const response = await client.search({
    index: INDEX_PATTERN,
    body: {
      size: 0,
      query: { bool: { must: mustClauses } },
      aggs: Object.fromEntries(
        WEB_VITALS_METRICS.map((metric) => [
          metric,
          {
            percentiles: {
              field: `payload_web_vitals_${metric}_value`,
              percents: [75]
            }
          }
        ])
      )
    }
  });

  return Object.fromEntries(
    WEB_VITALS_METRICS.map(metric => [
      metric,
      {
        name: WEB_VITALS_NAMES[metric],
        p75: response.body.aggregations[metric]?.values?.['75.0'] || 0
      }
    ])
  ) as WebVitalsP75Metrics;
}

export async function getWebVitalsHistogram(
  metric: WebVitalMetricType,
  params: FilterParams
): Promise<{ bucketDuration: string; data: { timestamp: string; p75: number }[] }> {
  const { actualStartTime, actualEndTime } = getTimeRange(params.startTime, params.endTime);
  const interval = calculateInterval(actualStartTime, actualEndTime, params.interval);

  const mustClauses = [
    buildTimeRangeQuery(actualStartTime.toISOString(), actualEndTime.toISOString()),
    ...buildBasicFilters(params, 'web_vitals')
  ];

  const response = await client.search({
    index: INDEX_PATTERN,
    body: {
      size: 0,
      query: { bool: { must: mustClauses } },
      aggs: {
        histogram: {
          date_histogram: {
            field: '@timestamp',
            fixed_interval: interval,
            min_doc_count: 1
          },
          aggs: {
            p75: {
              percentiles: {
                field: `payload_web_vitals_${metric}_value`,
                percents: [75]
              }
            }
          }
        }
      }
    }
  });

  return {
    bucketDuration: interval,
    data: response.body.aggregations.histogram.buckets.map((bucket: any) => ({
      timestamp: bucket.key_as_string,
      p75: bucket.p75.values['75.0'] || 0
    }))
  };
}

export async function getDeviceTypeCount(type: 'mobile' | 'desktop'): Promise<number> {
  const query = type === 'mobile'
    ? { term: { 'user_agent.device.type.keyword': 'mobile' } }
    : {
      bool: {
        must_not: {
          exists: {
            field: 'user_agent.device.type.keyword'
          }
        }
      }
    };

  const response = await client.search({
    index: INDEX_PATTERN,
    body: {
      size: 0,
      query: {
        bool: {
          must: [
            { term: { event: 'player' } },
            query
          ]
        }
      }
    }
  });

  return response.body.hits.total.value;
}
