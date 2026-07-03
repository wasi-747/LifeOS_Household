const express = require('express');
const router = express.Router();
const calculationController = require('../controllers/calculationController');
const telemetryController = require('../controllers/telemetryController');

// Calculation Endpoint
router.get('/summary/:monthId', calculationController.getSummary);

// Telemetry Endpoints
router.post('/telemetry', telemetryController.saveTelemetry);
router.get('/telemetry/info/devices', telemetryController.getDevices);
router.get('/telemetry/:deviceId', telemetryController.getTelemetryByDevice);

module.exports = router;
