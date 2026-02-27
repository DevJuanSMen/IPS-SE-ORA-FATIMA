const express = require('express');
const router = express.Router();
const ReportsController = require('./ReportsController');

router.get('/summary', ReportsController.getSummary);
router.get('/by-specialty', ReportsController.getBySpecialty);
router.get('/by-doctor', ReportsController.getByDoctor);
router.get('/by-service', ReportsController.getByService);
router.get('/by-entity', ReportsController.getByEntity);
router.get('/trends', ReportsController.getTrends);

module.exports = router;
