import { Router } from 'express';
import { suggestRules, ocrImage, testConnection, listModels } from '../controllers/aiController';
import { requireAdmin, requireAuth } from '../middleware/auth';

const router = Router();

// Only managers/admins should be able to call AI rules generation
router.post('/suggest-rules', requireAdmin, suggestRules);
router.post('/ocr', requireAdmin, ocrImage);
router.post('/test', requireAdmin, testConnection);
router.get('/models', requireAdmin, listModels);

export default router;
