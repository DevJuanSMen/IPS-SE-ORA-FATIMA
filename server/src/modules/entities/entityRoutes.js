const express = require('express');
const router = express.Router();
const EntityController = require('./EntityController');

router.get('/', EntityController.getAll);
router.get('/active', EntityController.getActive);
router.post('/', EntityController.create);
router.put('/:id', EntityController.update);
router.patch('/:id/toggle', EntityController.toggleStatus);

module.exports = router;
