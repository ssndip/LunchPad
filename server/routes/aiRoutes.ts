import { Router } from 'express';
import { suggestRules } from '../controllers/aiController';
import { requireAuth } from '../middleware/auth';

const router = Router();

// Only managers/admins should be able to call AI rules generation
router.post('/suggest-rules', requireAuth, suggestRules);

export default router;
