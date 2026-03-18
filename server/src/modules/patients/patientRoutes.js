const express = require('express');
const router = express.Router();
const PatientController = require('./PatientController');

router.get('/', PatientController.getAll);
router.post('/', PatientController.create);
router.get('/results', PatientController.getResults);
router.get('/results/:id', PatientController.getResultData);

module.exports = router;
