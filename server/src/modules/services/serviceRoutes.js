const express = require('express');
const router = express.Router();
const ServiceController = require('./ServiceController');

router.get('/', ServiceController.getAll);
router.post('/', ServiceController.create);
router.put('/:id', ServiceController.update);
router.delete('/:id', ServiceController.delete);

module.exports = router;
