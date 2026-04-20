import { Router } from 'express';
import { suggestRules, ocrImage, testConnection, listModels } from '../controllers/aiController';
import { requireAuth } from '../middleware/auth';

const router = Router();

// Only managers/admins should be able to call AI rules generation
router.post('/suggest-rules', requireAuth, suggestRules);
router.post('/ocr', requireAuth, ocrImage);
router.post('/test', requireAuth, testConnection);
router.get('/models', requireAuth, listModels);

export default router;
