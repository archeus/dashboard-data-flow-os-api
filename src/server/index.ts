import express from 'express';
import cors from 'cors';
import compression from 'compression';
import dotenv from 'dotenv';
import { getPlayerQoEMetrics, getAutocompleteResults, getPlayerOverallMetrics, getCountryQoEMetrics } from './opensearch';
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
    } = req.query;

    const metrics = await getPlayerQoEMetrics(
      startTime as string,
      endTime as string,
      interval as string,
      room as string,
      sessionId as string,
      guestUser === 'true' ? true : guestUser === 'false' ? false : undefined,
      continentCode as string,
      countryCode as string,
      browserName as string,
      ispName as string
    );

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
    } = req.query;

    const metrics = await getPlayerOverallMetrics(
      startTime as string,
      endTime as string,
      room as string,
      sessionId as string,
      guestUser === 'true' ? true : guestUser === 'false' ? false : undefined,
      continentCode as string,
      countryCode as string,
      browserName as string,
      ispName as string
    );

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
    } = req.query;

    const metrics = await getCountryQoEMetrics(
      startTime as string,
      endTime as string,
      room as string,
      sessionId as string,
      guestUser === 'true' ? true : guestUser === 'false' ? false : undefined,
      continentCode as string,
      browserName as string,
      ispName as string
    );

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

// Mount the v4 API router
app.use('/api/v4', apiV4Router);

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
