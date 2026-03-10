const express = require('express');
const router = express.Router();
const results = require('./resultsController');
const authMiddleware = require('../../middleware/authMiddleware');

router.get('/folders', authMiddleware(['ADMIN', 'MANAGER', 'DIRECTOR', 'LAB']), results.getPatientFolders);
router.get('/patient/:patient_id', authMiddleware([]), results.getPatientResults);
router.get('/:id', authMiddleware([]), results.getResultById);
router.post('/', authMiddleware(['ADMIN', 'MANAGER', 'DIRECTOR', 'LAB', 'PATIENT']), results.uploadResult);
router.delete('/:id', authMiddleware(['ADMIN', 'MANAGER', 'DIRECTOR', 'LAB']), results.deleteResult);

module.exports = router;
