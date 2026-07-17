const express = require('express');
const router = express.Router();
const auth = require('../middlewares/auth.middleware');
const requireRole = require('../middlewares/role.middleware');
const withRls = require('../middlewares/rls.middleware');
const alertsController = require('../controllers/alerts.controller');

// Lấy danh sách cảnh báo (có thể lọc qua query: device_id, is_read, limit, offset)
router.get('/', auth, requireRole('parent'), withRls, alertsController.getAlerts);

// Đánh dấu cảnh báo đã đọc
router.put('/:id/read', auth, requireRole('parent'), withRls, alertsController.markAsRead);

module.exports = router;
