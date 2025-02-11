import express from 'express';
import cors from 'cors';
import compression from 'compression';
import dotenv from 'dotenv';
import {
  getPlayerQoEMetrics,
  getAutocompleteResults,
  getPlayerOverallMetrics,
  getCountryQoEMetrics,
  getWebVitalsMetrics,
  getWebVitalsP75Metrics,
  getWebVitalsHistogram,
  getDeviceTypeCount
} from './opensearch'
import { client } from './opensearch';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Enable CORS for all routes
app.use(cors());

// Enable gzip compression
app.use(compression());

// Create router for API v4 endpoints
const apiV4Router = express.Router();

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
    const { q, size } = req.query;
    const results = await getAutocompleteResults(
      'geoip.continentCode.keyword',
      q as string,
      size ? parseInt(size as string) : undefined
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
    const { q, size } = req.query;
    const results = await getAutocompleteResults(
      'geoip.countryCode.keyword',
      q as string,
      size ? parseInt(size as string) : undefined
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
    const { q, size } = req.query;
    const results = await getAutocompleteResults(
      'geoip.ispName.keyword',
      q as string,
      size ? parseInt(size as string) : undefined
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
    const { q, size } = req.query;
    const results = await getAutocompleteResults(
      'room.keyword',
      q as string,
      size ? parseInt(size as string) : undefined
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
    const { q, size } = req.query;
    const results = await getAutocompleteResults(
      'user_agent.browser.name.keyword',
      q as string,
      size ? parseInt(size as string) : undefined
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
    const { q, size } = req.query;
    const results = await getAutocompleteResults(
      'shortPath.keyword',
      q as string,
      size ? parseInt(size as string) : undefined,
      'web_vitals'
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

    const metrics = await getWebVitalsMetrics({
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

    const metrics = await getWebVitalsP75Metrics({
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

    const data = await getWebVitalsHistogram(
      metric as 'FCP' | 'TTFB' | 'LCP' | 'INP' | 'CLS',
      {
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

// Mount the v4 API router
app.use('/api/v4', apiV4Router);

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});