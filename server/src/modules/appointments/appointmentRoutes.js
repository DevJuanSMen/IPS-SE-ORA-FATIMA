const express = require('express');
const router = express.Router();
const AppointmentControllerFactory = require('./AppointmentController');

module.exports = (client) => {
    const AppointmentController = AppointmentControllerFactory(client);

    router.get('/', AppointmentController.getAll);
    router.get('/availability', AppointmentController.getAvailability);
    router.post('/', AppointmentController.create);
    router.put('/:id', AppointmentController.update);
    router.put('/:id/cancel', AppointmentController.cancel);

    // New routes for attendance
    router.post('/validate-code', AppointmentController.validateCode);

    return router;
};
