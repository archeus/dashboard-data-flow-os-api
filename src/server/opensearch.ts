import { Client } from '@opensearch-project/opensearch';
import { subDays, parseISO, differenceInDays } from 'date-fns';

// Initialize the OpenSearch client
export const client = new Client({
  node: process.env.OPENSEARCH_URL || 'http://localhost:9200',
});

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

export interface AutocompleteResult {
  value: string;
  count: number;
}

export interface CountryQoEMetric {
  country: string;
  countryCode: string;
  latitude: number;
  longitude: number;
  qoe: number;
  totalPlaytime: number;
  totalBufferingTime: number;
  totalSessions: number;
  uniqueUsers: number;
}

export async function getAutocompleteResults(
  field: string,
  prefix: string = '',
  size: number = 10
): Promise<AutocompleteResult[]> {
  const response = await client.search({
    index: 'analytics_v4_*',
    body: {
      size: 0,
      query: {
        bool: {
          must: [
            { term: { event: 'player' } },
            prefix && {
              wildcard: {
                [field]: {
                  value: `${prefix}*`,
                  case_insensitive: true
                }
              },
            },
          ].filter(Boolean),
        },
      },
      aggs: {
        values: {
          terms: {
            field,
            size,
            order: { _count: 'desc' },
          },
        },
      },
    },
  });

  return response.body.aggregations.values.buckets.map((bucket: any) => ({
    value: bucket.key,
    count: bucket.doc_count,
  }));
}

export async function getPlayerOverallMetrics(
  startTime?: string,
  endTime?: string,
  room?: string,
  sessionId?: string,
  guestUser?: boolean,
  continentCode?: string,
  countryCode?: string,
  browserName?: string,
  ispName?: string
): Promise<OverallMetricsResponse> {
  // Set default time range to last 24 hours if not provided
  const now = new Date();
  const actualEndTime = endTime ? parseISO(endTime) : now;
  const actualStartTime = startTime ? parseISO(startTime) : subDays(now, 1);

  const baseMustClauses = [
    {
      range: {
        '@timestamp': {
          gte: actualStartTime.toISOString(),
          lte: actualEndTime.toISOString(),
        },
      },
    },
    {
      term: {
        event: 'player',
      },
    },
  ];

  if (room) {
    baseMustClauses.push({
      term: {
        'room.keyword': room,
      },
    });
  }

  if (sessionId) {
    baseMustClauses.push({
      term: {
        'sessionId.keyword': sessionId,
      },
    });
  }

  if (continentCode) {
    baseMustClauses.push({
      term: {
        'geoip.continentCode.keyword': continentCode,
      },
    });
  }

  if (countryCode) {
    baseMustClauses.push({
      term: {
        'geoip.countryCode.keyword': countryCode,
      },
    });
  }

  if (browserName) {
    baseMustClauses.push({
      term: {
        'user_agent.browser.name.keyword': browserName,
      },
    });
  }

  if (ispName) {
    baseMustClauses.push({
      term: {
        'geoip.ispName.keyword': ispName,
      },
    });
  }

  const [overallResponse, guestResponse, loggedInResponse] = await Promise.all([
    // Overall metrics (no user type filter)
    client.search({
      index: 'analytics_v4_*',
      body: {
        size: 0,
        query: {
          bool: {
            must: baseMustClauses,
          },
        },
        aggs: {
          total_playtime: {
            sum: {
              field: 'payload_player_playtime',
            },
          },
          total_buffering: {
            sum: {
              field: 'payload_player_bufferingTime',
            },
          },
        },
      },
    }),
    // Guest metrics
    client.search({
      index: 'analytics_v4_*',
      body: {
        size: 0,
        query: {
          bool: {
            must: [
              ...baseMustClauses,
              {
                term: {
                  guestUser: true,
                },
              },
            ],
          },
        },
        aggs: {
          total_playtime: {
            sum: {
              field: 'payload_player_playtime',
            },
          },
          total_buffering: {
            sum: {
              field: 'payload_player_bufferingTime',
            },
          },
        },
      },
    }),
    // Logged-in metrics
    client.search({
      index: 'analytics_v4_*',
      body: {
        size: 0,
        query: {
          bool: {
            must: [
              ...baseMustClauses,
              {
                term: {
                  guestUser: false,
                },
              },
            ],
          },
        },
        aggs: {
          total_playtime: {
            sum: {
              field: 'payload_player_playtime',
            },
          },
          total_buffering: {
            sum: {
              field: 'payload_player_bufferingTime',
            },
          },
        },
      },
    }),
  ]);

  function calculateMetrics(response: any): OverallMetrics {
    const totalPlaytime = response.body.aggregations.total_playtime.value;
    const totalBufferingTime = response.body.aggregations.total_buffering.value;
    const totalTime = totalPlaytime + totalBufferingTime;

    return {
      totalPlaytime,
      totalBufferingTime,
      overallQuality: totalTime > 0 ? (totalPlaytime / totalTime) * 100 : 100,
    };
  }

  return {
    overall: calculateMetrics(overallResponse),
    guest: calculateMetrics(guestResponse),
    loggedIn: calculateMetrics(loggedInResponse),
  };
}
export async function getPlayerQoEMetrics(
  startTime?: string,
  endTime?: string,
  interval: string = '1m',
  room?: string,
  sessionId?: string,
  guestUser?: boolean,
  continentCode?: string,
  countryCode?: string,
  browserName?: string,
  ispName?: string
): Promise<QoEMetricsResult> {
  // Set default time range to last 24 hours if not provided
  const now = new Date();
  const actualEndTime = endTime ? parseISO(endTime) : now;
  const actualStartTime = startTime ? parseISO(startTime) : subDays(now, 1);

  // Calculate time range in days
  const daysDifference = differenceInDays(actualEndTime, actualStartTime);

  // Adjust bucket size based on time range
  let actualInterval = interval;
  if (daysDifference > 7) {
    actualInterval = '1h';
  } else if (daysDifference > 1) {
    actualInterval = '10m';
  }

  const mustClauses = [
    {
      range: {
        '@timestamp': {
          gte: actualStartTime.toISOString(),
          lte: actualEndTime.toISOString(),
        },
      },
    },
    {
      term: {
        event: 'player',
      },
    },
  ];

  if (room) {
    mustClauses.push({
      term: {
        'room.keyword': room,
      },
    });
  }

  if (sessionId) {
    mustClauses.push({
      term: {
        'sessionId.keyword': sessionId,
      },
    });
  }

  if (guestUser !== undefined) {
    mustClauses.push({
      term: {
        guestUser: guestUser,
      },
    });
  }

  if (continentCode) {
    mustClauses.push({
      term: {
        'geoip.continentCode.keyword': continentCode,
      },
    });
  }

  if (countryCode) {
    mustClauses.push({
      term: {
        'geoip.countryCode.keyword': countryCode,
      },
    });
  }

  if (browserName) {
    mustClauses.push({
      term: {
        'user_agent.browser.name.keyword': browserName,
      },
    });
  }

  if (ispName) {
    mustClauses.push({
      term: {
        'geoip.ispName.keyword': ispName,
      },
    });
  }

  const response = await client.search({
    index: 'analytics_v4_*',
    body: {
      size: 0,
      query: {
        bool: {
          must: mustClauses,
        },
      },
      aggs: {
        timeline: {
          date_histogram: {
            field: '@timestamp',
            fixed_interval: actualInterval,
            min_doc_count: 1,
          },
          aggs: {
            total_playtime: {
              sum: {
                field: 'payload_player_playtime',
              },
            },
            total_buffering: {
              sum: {
                field: 'payload_player_bufferingTime',
              },
            },
          },
        },
      },
    },
  });

  const buckets = response.body.aggregations.timeline.buckets;
  const data = buckets.map((bucket: any) => {
    const playtime = bucket.total_playtime.value;
    const bufferingTime = bucket.total_buffering.value;
    const totalTime = playtime + bufferingTime;

    return {
      timestamp: bucket.key_as_string,
      playtime: playtime,
      bufferingTime: bufferingTime,
      qoe: totalTime > 0 ? (playtime / totalTime) * 100 : 100,
    };
  });

  return {
    bucketDuration: actualInterval,
    data,
  };
}

export async function getCountryQoEMetrics(
  startTime?: string,
  endTime?: string,
  room?: string,
  sessionId?: string,
  guestUser?: boolean,
  continentCode?: string,
  browserName?: string,
  ispName?: string
): Promise<CountryQoEMetric[]> {
  // Set default time range to last 24 hours if not provided
  const now = new Date();
  const actualEndTime = endTime ? parseISO(endTime) : now;
  const actualStartTime = startTime ? parseISO(startTime) : subDays(now, 1);

  const mustClauses = [
    {
      range: {
        '@timestamp': {
          gte: actualStartTime.toISOString(),
          lte: actualEndTime.toISOString(),
        },
      },
    },
    {
      term: {
        event: 'player',
      },
    },
  ];

  if (room) {
    mustClauses.push({
      term: {
        'room.keyword': room,
      },
    });
  }

  if (sessionId) {
    mustClauses.push({
      term: {
        'sessionId.keyword': sessionId,
      },
    });
  }

  if (guestUser !== undefined) {
    mustClauses.push({
      term: {
        guestUser: guestUser,
      },
    });
  }

  if (continentCode) {
    mustClauses.push({
      term: {
        'geoip.continentCode.keyword': continentCode,
      },
    });
  }

  if (browserName) {
    mustClauses.push({
      term: {
        'user_agent.browser.name.keyword': browserName,
      },
    });
  }

  if (ispName) {
    mustClauses.push({
      term: {
        'geoip.ispName.keyword': ispName,
      },
    });
  }

  const response = await client.search({
    index: 'analytics_v4_*',
    body: {
      size: 0,
      query: {
        bool: {
          must: mustClauses,
        },
      },
      aggs: {
        by_country: {
          terms: {
            field: 'geoip.countryCode.keyword',
            size: 1000,
          },
          aggs: {
            country_name: {
              terms: {
                field: 'geoip.country.keyword',
                size: 1,
              },
            },
            total_playtime: {
              sum: {
                field: 'payload_player_playtime',
              },
            },
            total_buffering: {
              sum: {
                field: 'payload_player_bufferingTime',
              },
            },
            location: {
              geo_centroid: {
                field: 'geoip.point'
              }
            },
            unique_sessions: {
              cardinality: {
                field: 'pageId.keyword'
              }
            },
            unique_users: {
              cardinality: {
                field: 'sessionId.keyword'
              }
            }
          }
        },
      },
    },
  });

  return response.body.aggregations.by_country.buckets.map((bucket: any) => {
    const playtime = bucket.total_playtime.value;
    const bufferingTime = bucket.total_buffering.value;
    const totalTime = playtime + bufferingTime;
    const countryName = bucket.country_name.buckets[0]?.key || bucket.key;
    const location = bucket.location.location;

    return {
      country: countryName,
      countryCode: bucket.key,
      latitude: location ? location.lat : 0,
      longitude: location ? location.lon : 0,
      totalPlaytime: playtime,
      totalBufferingTime: bufferingTime,
      qoe: totalTime > 0 ? (playtime / totalTime) * 100 : 100,
      totalSessions: bucket.unique_sessions.value,
      uniqueUsers: bucket.unique_users.value,
    };
  });
}
