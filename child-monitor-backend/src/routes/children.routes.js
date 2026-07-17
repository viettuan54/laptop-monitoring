const express = require('express');
const router = express.Router();
const auth = require('../middlewares/auth.middleware');
const requireRole = require('../middlewares/role.middleware');
const withRls = require('../middlewares/rls.middleware');
const childrenController = require('../controllers/children.controller');

// Tất cả các route quản lý trẻ em đều yêu cầu đăng nhập và áp dụng cơ chế RLS
router.get('/', auth, requireRole('parent'), withRls, childrenController.getChildren);
router.post('/', auth, requireRole('parent'), withRls, childrenController.createChild);
router.put('/:id', auth, requireRole('parent'), withRls, childrenController.updateChild);
router.delete('/:id', auth, requireRole('parent'), withRls, childrenController.deleteChild);

module.exports = router;
