const express = require('express');
const router = express.Router();
const auth = require('../middlewares/auth.middleware');
const requireRole = require('../middlewares/role.middleware');
const withRls = require('../middlewares/rls.middleware');
const settingsController = require('../controllers/settings.controller');

// Lấy cấu hình giám sát của trẻ em
router.get('/:child_id', auth, requireRole('parent'), withRls, settingsController.getSettings);

// Cập nhật cấu hình giám sát của trẻ em
router.put('/:child_id', auth, requireRole('parent'), withRls, settingsController.updateSettings);

module.exports = router;
