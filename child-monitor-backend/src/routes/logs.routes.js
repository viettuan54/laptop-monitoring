const express = require('express');
const expressJson1mb = express.json({ limit: '1mb' }); // Override 100kb global limit cho batch routes
const router = express.Router();
const auth = require('../middlewares/auth.middleware');
const requireRole = require('../middlewares/role.middleware');
const withRls = require('../middlewares/rls.middleware');
const deviceAuth = require('../middlewares/deviceAuth.middleware');
const { parentLimiter, agentLimiter } = require('../middlewares/rateLimit.middleware');
const logsController = require('../controllers/logs.controller');

// ── Agent Routes (dùng X-Device-Secret, KHÔNG cần JWT phụ huynh) ──────────
// Agent trên laptop con gọi các route này để gửi dữ liệu
router.post('/app', agentLimiter, deviceAuth, logsController.logAppUsage);
router.post('/web', agentLimiter, deviceAuth, logsController.logWebsite);

// ── Batch routes: override body-size limit lên 1mb (global là 100kb) ──────
// Middleware expressJson1mb đặt TRƯỚC deviceAuth để body được parse đúng
// trước khi deviceAuth đọc header X-Device-Secret.
// device_id LUÔN lấy từ req.device trong controller, KHÔNG từ body.
router.post('/app/batch', agentLimiter, expressJson1mb, deviceAuth, logsController.logAppBatch);
router.post('/web/batch', agentLimiter, expressJson1mb, deviceAuth, logsController.logWebBatch);

// ── Parent Routes (dùng JWT phụ huynh + RLS) ──────────────────────────────
// Phụ huynh xem lịch sử app/web của con
// ?device_id=&start=&end=&limit=&offset=
router.get('/app', parentLimiter, auth, requireRole('parent'), withRls, logsController.getAppLogs);
router.get('/web', parentLimiter, auth, requireRole('parent'), withRls, logsController.getWebLogs);

module.exports = router;