const express = require('express');
const router = express.Router();
const authController = require('./authController');

router.post('/login', authController.login);
router.post('/setup-admin', authController.registerInitialAdmin); // TO DO: Remove or secure after first run

module.exports = router;
