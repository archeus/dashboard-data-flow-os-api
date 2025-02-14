import { FilterParams } from '../types';

export function buildTimeRangeQuery(startTime: string, endTime: string) {
  return {
    range: {
      '@timestamp': {
        gte: startTime,
        lte: endTime,
      },
    },
  };
}

export function buildDeviceTypeQuery(deviceType?: string) {
  if (deviceType === 'mobile') {
    return {
      term: {
        'user_agent.device.type.keyword': 'mobile'
      }
    };
  } else if (deviceType === 'desktop') {
    return {
      bool: {
        must_not: {
          exists: {
            field: 'user_agent.device.type.keyword'
          }
        }
      }
    };
  }
  return null;
}

export function buildBasicFilters(params: FilterParams, eventType: 'player' | 'web_vitals' | 'page_ping') {
  const mustClauses = [
    {
      term: {
        event: eventType,
      },
    },
  ];

  if (params.room) {
    mustClauses.push({ term: { 'room.keyword': params.room } });
  }
  if (params.sessionId) {
    mustClauses.push({ term: { 'sessionId.keyword': params.sessionId } });
  }
  if (params.guestUser !== undefined) {
    mustClauses.push({ term: { guestUser: params.guestUser } });
  }
  if (params.continentCode) {
    mustClauses.push({ term: { 'geoip.continentCode.keyword': params.continentCode } });
  }
  if (params.countryCode) {
    mustClauses.push({ term: { 'geoip.countryCode.keyword': params.countryCode } });
  }
  if (params.browserName) {
    mustClauses.push({ term: { 'user_agent.browser.name.keyword': params.browserName } });
  }
  if (params.ispName) {
    mustClauses.push({ term: { 'geoip.ispName.keyword': params.ispName } });
  }
  if (params.route) {
    mustClauses.push({ term: { 'shortPath.keyword': params.route } });
  }

  const deviceTypeQuery = buildDeviceTypeQuery(params.deviceType);
  if (deviceTypeQuery) {
    mustClauses.push(deviceTypeQuery);
  }

  return mustClauses;
}