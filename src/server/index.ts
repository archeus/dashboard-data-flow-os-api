import express from 'express';
import cors from 'cors';
import compression from 'compression';
import dotenv from 'dotenv';
import path from 'path';
import { startCacheUpdaters } from './cache/redis';
import { updateWebVitalsP75Cache } from './cache/updater';
import { getCachedWebVitalsP75 } from './cache/redis';
dotenv.config();
import { validateCredentials } from './auth';
import {
  getPlayerQoEMetrics,
  getAutocompleteResults,
  getPlayerOverallMetrics,
  getCountryQoEMetrics,
  getWebVitalsMetrics,
  getWebVitalsP75Metrics,
  getWebVitalsHistogram,
  getDeviceTypeCount,
  getUserMetrics,
  getActivityMetrics,
  getEventCount,
  getCountryRoomMetrics
} from './opensearch'
import { client } from './opensearch';


const app = express();
const port = process.env.PORT || 3000;

// Enable CORS for all routes
app.use(cors());

// Enable gzip compression
app.use(compression());

// Parse JSON bodies
app.use(express.json());

// Create router for API v4 endpoints
const apiV4Router = express.Router();

// Session proxy endpoint
apiV4Router.all('/sessions/*', async (req, res) => {
  const baseUrl = process.env.SESSION_AGG_URL || 'http://dashboard-data-flow-os-agg:3000';
  const targetPath = req.url.replace('/sessions', '/api/sessions');
  const targetUrl = new URL(targetPath, baseUrl).toString();

  try {
    const response = await fetch(targetUrl, {
      method: req.method,
      body: req.body && Object.keys(req.body).length > 0 ? JSON.stringify(req.body) : undefined
    });

    const data = await response.text();
    const responseContentType = response.headers.get('content-type');
    
    if (response.ok && responseContentType) {
      res.status(response.status).set('content-type', responseContentType).send(data);
    } else {
      res.status(response.status).send(data);
    }
  } catch (error) {
    console.error('Proxy request error:', error);
    const errorMessage = process.env.NODE_ENV === 'production' 
      ? 'An internal server error occurred'
      : 'Failed to connect to session service';
    
    res.status(502).json({
      success: false,
      error: errorMessage
    });
  }
});
// Login endpoint
apiV4Router.post('/login', (req, res) => {
  const { username, password } = req.body;

  // Validate required fields
  if (!username || !password) {
    return res.status(400).json({
      success: false,
      error: 'Username and password are required'
    });
  }

  // Validate credentials and get auth response
  const authResponse = validateCredentials(username, password);
  if (authResponse) {
    res.json({
      success: true,
      data: authResponse
    });
  } else {
    res.status(401).json({
      success: false,
      error: 'Invalid credentials'
    });
  }
});

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    // Check OpenSearch connection
    await client.ping();

    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        db: 'connected',
        api: 'running'
      }
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      services: {
        db: 'disconnected',
        api: 'running'
      },
      error: 'OpenSearch connection failed'
    });
  }
});

// Autocomplete endpoints
apiV4Router.get('/autocomplete/continent', async (req, res) => {
  try {
    const { q, size, startTime, endTime } = req.query;
    const results = await getAutocompleteResults(
      'geoip.continentCode.keyword',
      q as string,
      size ? parseInt(size as string) : undefined,
      'player',
      startTime as string,
      endTime as string
    );
    res.json({ success: true, data: results });
  } catch (error) {
    console.error('Error fetching continent suggestions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch continent suggestions',
    });
  }
});

apiV4Router.get('/autocomplete/country', async (req, res) => {
  try {
    const { q, size, startTime, endTime } = req.query;
    const results = await getAutocompleteResults(
      'geoip.countryCode.keyword',
      q as string,
      size ? parseInt(size as string) : undefined,
      'player',
      startTime as string,
      endTime as string
    );
    res.json({ success: true, data: results });
  } catch (error) {
    console.error('Error fetching country suggestions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch country suggestions',
    });
  }
});

apiV4Router.get('/autocomplete/isp', async (req, res) => {
  try {
    const { q, size, startTime, endTime } = req.query;
    const results = await getAutocompleteResults(
      'geoip.ispName.keyword',
      q as string,
      size ? parseInt(size as string) : undefined,
      'player',
      startTime as string,
      endTime as string
    );
    res.json({ success: true, data: results });
  } catch (error) {
    console.error('Error fetching ISP suggestions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch ISP suggestions',
    });
  }
});

apiV4Router.get('/autocomplete/room', async (req, res) => {
  try {
    const { q, size, startTime, endTime } = req.query;
    const results = await getAutocompleteResults(
      'room.keyword',
      q as string,
      size ? parseInt(size as string) : undefined,
      'player',
      startTime as string,
      endTime as string
    );
    res.json({ success: true, data: results });
  } catch (error) {
    console.error('Error fetching room suggestions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch room suggestions',
    });
  }
});

apiV4Router.get('/autocomplete/browser', async (req, res) => {
  try {
    const { q, size, startTime, endTime } = req.query;
    const results = await getAutocompleteResults(
      'user_agent.browser.name.keyword',
      q as string,
      size ? parseInt(size as string) : undefined,
      'player',
      startTime as string,
      endTime as string
    );
    res.json({ success: true, data: results });
  } catch (error) {
    console.error('Error fetching browser suggestions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch browser suggestions',
    });
  }
});

apiV4Router.get('/autocomplete/route', async (req, res) => {
  try {
    const { q, size, startTime, endTime } = req.query;
    const results = await getAutocompleteResults(
      'shortPath.keyword',
      q as string,
      size ? parseInt(size as string) : undefined,
      'web_vitals',
      startTime as string,
      endTime as string
    );
    res.json({ success: true, data: results });
  } catch (error) {
    console.error('Error fetching route suggestions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch route suggestions',
    });
  }
});

apiV4Router.get('/agg/player/QoE', async (req, res) => {
  try {
    const {
      startTime,
      endTime,
      interval,
      room,
      sessionId,
      guestUser,
      continentCode,
      countryCode,
      browserName,
      ispName,
      deviceType,
    } = req.query;

    const metrics = await getPlayerQoEMetrics({
      startTime: startTime as string,
      endTime: endTime as string,
      interval: interval as string,
      room: room as string,
      sessionId: sessionId as string,
      guestUser: guestUser === 'true' ? true : guestUser === 'false' ? false : undefined,
      continentCode: continentCode as string,
      countryCode: countryCode as string,
      browserName: browserName as string,
      ispName: ispName as string,
      deviceType: deviceType as string
    });

    res.json({
      success: true,
      bucketDuration: metrics.bucketDuration,
      data: metrics.data,
    });
  } catch (error) {
    console.error('Error fetching QoE metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch QoE metrics',
    });
  }
});

apiV4Router.get('/agg/player/overall', async (req, res) => {
  try {
    const {
      startTime,
      endTime,
      room,
      sessionId,
      guestUser,
      continentCode,
      countryCode,
      browserName,
      ispName,
      deviceType,
    } = req.query;

    const metrics = await getPlayerOverallMetrics({
      startTime: startTime as string,
      endTime: endTime as string,
      room: room as string,
      sessionId: sessionId as string,
      guestUser: guestUser === 'true' ? true : guestUser === 'false' ? false : undefined,
      continentCode: continentCode as string,
      countryCode: countryCode as string,
      browserName: browserName as string,
      ispName: ispName as string,
      deviceType: deviceType as string
    });

    res.json({
      success: true,
      data: metrics,
    });
  } catch (error) {
    console.error('Error fetching overall metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch overall metrics',
    });
  }
});

apiV4Router.get('/agg/player/country', async (req, res) => {
  try {
    const {
      startTime,
      endTime,
      room,
      sessionId,
      guestUser,
      continentCode,
      browserName,
      ispName,
      deviceType,
    } = req.query;

    const metrics = await getCountryQoEMetrics({
      startTime: startTime as string,
      endTime: endTime as string,
      room: room as string,
      sessionId: sessionId as string,
      guestUser: guestUser === 'true' ? true : guestUser === 'false' ? false : undefined,
      continentCode: continentCode as string,
      browserName: browserName as string,
      ispName: ispName as string,
      deviceType: deviceType as string
    });

    res.json({
      success: true,
      data: metrics,
    });
  } catch (error) {
    console.error('Error fetching country QoE metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch country QoE metrics',
    });
  }
});

apiV4Router.get('/agg/web-vitals', async (req, res) => {
  try {
    const {
      startTime,
      endTime,
      duration,
      room,
      sessionId,
      guestUser,
      continentCode,
      countryCode,
      browserName,
      ispName,
      deviceType,
      route,
    } = req.query;

    if (duration && !['15min', '1h', '1d', '2d', '3d'].includes(duration as string)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid duration. Supported values: 15min, 1h, 1d, 2d, 3d'
      });
    }

    const metrics = await getWebVitalsMetrics({
      duration: duration as string,
      startTime: startTime as string,
      endTime: endTime as string,
      room: room as string,
      sessionId: sessionId as string,
      guestUser: guestUser === 'true' ? true : guestUser === 'false' ? false : undefined,
      continentCode: continentCode as string,
      countryCode: countryCode as string,
      browserName: browserName as string,
      ispName: ispName as string,
      deviceType: deviceType as string,
      route: route as string
    });

    res.json({
      success: true,
      data: metrics,
    });
  } catch (error) {
    console.error('Error fetching Web Vitals metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch Web Vitals metrics',
    });
  }
});

apiV4Router.get('/agg/web-vitals/p75', async (req, res) => {
  try {
    const {
      duration,
      startTime,
      endTime,
      room,
      sessionId,
      guestUser,
      continentCode,
      countryCode,
      browserName,
      ispName,
      deviceType,
      route,
    } = req.query;

    if (duration && !['15min', '1h', '1d', '2d', '3d'].includes(duration as string)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid duration. Supported values: 15min, 1h, 1d, 2d, 3d'
      });
    }

    const metrics = await getWebVitalsP75Metrics({
      duration: duration as string,
      startTime: startTime as string,
      endTime: endTime as string,
      room: room as string,
      sessionId: sessionId as string,
      guestUser: guestUser === 'true' ? true : guestUser === 'false' ? false : undefined,
      continentCode: continentCode as string,
      countryCode: countryCode as string,
      browserName: browserName as string,
      ispName: ispName as string,
      deviceType: deviceType as string,
      route: route as string
    });

    res.json({
      success: true,
      data: metrics,
    });
  } catch (error) {
    console.error('Error fetching Web Vitals p75 metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch Web Vitals p75 metrics',
    });
  }
});

apiV4Router.get('/agg/web-vitals/histogram', async (req, res) => {
  try {
    const {
      metric,
      startTime,
      endTime,
      duration,
      interval,
      room,
      sessionId,
      guestUser,
      continentCode,
      countryCode,
      browserName,
      ispName,
      deviceType,
      route,
    } = req.query;

    // Validate metric parameter
    const validMetrics = ['FCP', 'TTFB', 'LCP', 'INP', 'CLS'];
    if (!metric || !validMetrics.includes(metric as string)) {
      return res.status(400).json({
        success: false,
        error: `Invalid metric. Must be one of: ${validMetrics.join(', ')}`,
      });
    }

    if (duration && !['15min', '1h', '1d', '2d', '3d'].includes(duration as string)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid duration. Supported values: 15min, 1h, 1d, 2d, 3d'
      });
    }

    const data = await getWebVitalsHistogram(
      metric as 'FCP' | 'TTFB' | 'LCP' | 'INP' | 'CLS',
      {
        duration: duration as string,
        startTime: startTime as string,
        endTime: endTime as string,
        interval: interval as string,
        room: room as string,
        sessionId: sessionId as string,
        guestUser: guestUser === 'true' ? true : guestUser === 'false' ? false : undefined,
        continentCode: continentCode as string,
        countryCode: countryCode as string,
        browserName: browserName as string,
        ispName: ispName as string,
        deviceType: deviceType as string,
        route: route as string
      }
    );

    res.json({
      success: true,
      bucketDuration: data.bucketDuration,
      data: data.data,
    });
  } catch (error) {
    console.error('Error fetching Web Vitals histogram:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch Web Vitals histogram',
    });
  }
});

apiV4Router.get('/autocomplete/device', async (req, res) => {
  try {
    const results = [
      { value: 'mobile', count: await getDeviceTypeCount('mobile') },
      { value: 'desktop', count: await getDeviceTypeCount('desktop') }
    ];
    res.json({ success: true, data: results });
  } catch (error) {
    console.error('Error fetching device type suggestions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch device type suggestions',
    });
  }
});

apiV4Router.get('/agg/users', async (req, res) => {
  try {
    const {
      startTime,
      endTime,
      room,
      sessionId,
      guestUser,
      continentCode,
      countryCode,
      browserName,
      ispName,
      deviceType,
      route,
    } = req.query;

    const metrics = await getUserMetrics({
      startTime: startTime as string,
      endTime: endTime as string,
      room: room as string,
      sessionId: sessionId as string,
      guestUser: guestUser === 'true' ? true : guestUser === 'false' ? false : undefined,
      continentCode: continentCode as string,
      countryCode: countryCode as string,
      browserName: browserName as string,
      ispName: ispName as string,
      deviceType: deviceType as string,
      route: route as string
    });

    res.json({
      success: true,
      data: metrics
    });
  } catch (error) {
    console.error('Error fetching user metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user metrics'
    });
  }
});

apiV4Router.get('/agg/activity', async (req, res) => {
  try {
    const {
      duration,
      startTime, 
      endTime,
      room,
      sessionId,
      guestUser,
      continentCode,
      countryCode,
      browserName,
      ispName,
      deviceType,
      route
    } = req.query;

    if (duration && !['15min', '1h', '1d', '2d', '3d'].includes(duration as string)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid duration. Supported values: 15min, 1h, 1d, 2d, 3d'
      });
    }

    const metrics = await getActivityMetrics({
      duration: duration as string,
      startTime: startTime as string,
      endTime: endTime as string,
      room: room as string,
      sessionId: sessionId as string,
      guestUser: guestUser === 'true' ? true : guestUser === 'false' ? false : undefined,
      continentCode: continentCode as string,
      countryCode: countryCode as string,
      browserName: browserName as string,
      ispName: ispName as string,
      deviceType: deviceType as string,
      route: route as string
    });

    res.json({
      success: true,
      data: metrics
    });
  } catch (error) {
    console.error('Error fetching activity metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch activity metrics'
    });
  }
});

apiV4Router.get('/agg/events', async (req, res) => {
  try {
    const {
      duration,
      startTime,
      endTime,
      room,
      sessionId,
      guestUser,
      continentCode,
      countryCode,
      browserName,
      ispName,
      deviceType,
      route
    } = req.query;

    if (duration && !['15min', '1h', '1d', '2d', '3d'].includes(duration as string)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid duration. Supported values: 15min, 1h, 1d, 2d, 3d'
      });
    }

    const metrics = await getEventCount({
      duration: duration as string,
      startTime: startTime as string,
      endTime: endTime as string,
      room: room as string,
      sessionId: sessionId as string,
      guestUser: guestUser === 'true' ? true : guestUser === 'false' ? false : undefined,
      continentCode: continentCode as string,
      countryCode: countryCode as string,
      browserName: browserName as string,
      ispName: ispName as string,
      deviceType: deviceType as string,
      route: route as string
    });

    res.json({
      success: true,
      data: {
        count: metrics.count,
        interval: metrics.interval
      }
    });
  } catch (error) {
    console.error('Error fetching event counts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch event counts'
    });
  }
});

apiV4Router.get('/agg/rooms', async (req, res) => {
  try {
    const {
      duration,
      startTime,
      endTime,
      countryCode
    } = req.query;

    if (duration && !['15min', '1h', '1d', '2d', '3d'].includes(duration as string)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid duration. Supported values: 15min, 1h, 1d, 2d, 3d'
      });
    }

    const metrics = await getCountryRoomMetrics({
      duration: duration as string,
      startTime: startTime as string,
      endTime: endTime as string,
      countryCode: countryCode as string
    });

    res.json({
      success: true,
      data: metrics
    });
  } catch (error) {
    console.error('Error fetching country room metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch country room metrics'
    });
  }
});

// Serve countries GeoJSON with 1 year cache
apiV4Router.get('/data/countries-110m.json', (req, res) => {
  res.set('Cache-Control', 'public, max-age=31536000'); // 1 year in seconds
  res.sendFile(path.join(process.cwd(), 'src/server/data/countries-110m.json'));
});

// Mount the v4 API router
app.use('/api/v4', apiV4Router);

// Start cache updaters if enabled (defaults to true)
if (process.env.ENABLE_CACHE_UPDATERS !== 'false') {
  startCacheUpdaters(updateWebVitalsP75Cache);
}

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});