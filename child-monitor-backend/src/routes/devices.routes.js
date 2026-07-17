const express = require('express');
const router = express.Router();
const auth = require('../middlewares/auth.middleware');
const requireRole = require('../middlewares/role.middleware');
const withRls = require('../middlewares/rls.middleware');
const devicesController = require('../controllers/devices.controller');

// Tất cả các route quản lý thiết bị đều yêu cầu đăng nhập và áp dụng cơ chế RLS
router.get('/', auth, requireRole('parent'), withRls, devicesController.getDevices);
router.post('/', auth, requireRole('parent'), withRls, devicesController.registerDevice);
router.put('/:id', auth, requireRole('parent'), withRls, devicesController.updateDevice);
router.delete('/:id', auth, requireRole('parent'), withRls, devicesController.deleteDevice);

// Xoay vòng Device Secret – secret cũ bị vô hiệu ngay lập tức
router.post('/:id/rotate-secret', auth, requireRole('parent'), withRls, devicesController.rotateSecret);

module.exports = router;
