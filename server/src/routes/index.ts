import { Router } from 'express';
import { MapController } from '../controllers/MapController';
import { testConnection } from '../config/db';

export const router = Router();

router.get('/health', async (_req, res) => {
  const status = await testConnection();
  res.json({ service: 'api', ...status });
});

router.use('/maps', MapController);

