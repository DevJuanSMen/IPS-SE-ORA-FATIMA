const express = require('express');
const router = express.Router();
const authController = require('./authController');
const authMiddleware = require('../../middleware/authMiddleware');

// Public routes
router.post('/login', authController.login);
router.post('/setup-admin', authController.registerInitialAdmin);
router.post('/register-patient', authController.registerPatient);

// Admin-only: create staff users
router.post('/register', authMiddleware(['ADMIN', 'MANAGER', 'DIRECTOR']), authController.registerUser);
router.get('/users', authMiddleware(['ADMIN', 'MANAGER', 'DIRECTOR']), authController.getUsers);
router.patch('/users/:id/toggle', authMiddleware(['ADMIN', 'MANAGER', 'DIRECTOR']), authController.toggleUserStatus);

// Profile (any authenticated user)
router.get('/me', authMiddleware([]), authController.getMe);
router.put('/me', authMiddleware([]), authController.updateMe);
router.put('/me/password', authMiddleware([]), authController.changePassword);
router.put('/me/avatar', authMiddleware([]), authController.updateAvatar);

module.exports = router;
