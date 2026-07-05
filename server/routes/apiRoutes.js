const express = require('express');
const router = express.Router();

// Controllers
const authController = require('../controllers/authController');
const homeController = require('../controllers/homeController');
const calculationController = require('../controllers/calculationController');
const telemetryController = require('../controllers/telemetryController');
const trackerController = require('../controllers/trackerController');
const monthlyBillController = require('../controllers/monthlyBillController');
const bazarWalletController = require('../controllers/bazarWalletController');
const monthController = require('../controllers/monthController');
const notepadController = require('../controllers/notepadController');
const auditController = require('../controllers/auditController');

// Middleware
const authMiddleware = require('../middleware/authMiddleware');

// Public Auth routes
router.post('/auth/signup', authController.signup);
router.post('/auth/login', authController.login);

// Protected Auth & Home routes
router.get('/auth/me', authMiddleware, authController.getMe);
router.post('/home/create', authMiddleware, homeController.createHome);
router.post('/home/invite', authMiddleware, homeController.inviteMember);
router.get('/home/details', authMiddleware, homeController.getHomeDetails);
router.post('/home/permission', authMiddleware, homeController.updatePermission);

// Protected Calculation Endpoint
router.get('/summary/:monthId', authMiddleware, calculationController.getSummary);

// Protected Telemetry (Read) & Public (Write from Python script)
router.post('/telemetry', telemetryController.saveTelemetry); // Public for agent access
router.get('/telemetry/info/devices', authMiddleware, telemetryController.getDevices);
router.get('/telemetry/:deviceId', authMiddleware, telemetryController.getTelemetryByDevice);

// Protected Tracker Endpoints
router.get('/tracker/:monthId', authMiddleware, trackerController.getTrackerData);
router.post('/tracker/meals/update', authMiddleware, trackerController.updateMeals);
router.post('/tracker/bazar/update', authMiddleware, trackerController.updateBazar);
router.post('/tracker/bazar/assign', authMiddleware, trackerController.assignBazarUser);
router.post('/tracker/deposits/update', authMiddleware, trackerController.updateDeposit);
router.post('/tracker/config', authMiddleware, trackerController.updateConfig);

// Protected Monthly Bill Configuration Endpoints
router.get('/monthly-bill/:monthId', authMiddleware, monthlyBillController.getMonthlyBill);
router.post('/monthly-bill', authMiddleware, monthlyBillController.saveMonthlyBill);

// Protected Bazar Wallet Endpoints
router.get('/bazar-wallet/:monthId', authMiddleware, bazarWalletController.getWallet);
router.post('/bazar-wallet/transfer', authMiddleware, bazarWalletController.addTransfer);
router.delete('/bazar-wallet/transfer/:transferId', authMiddleware, bazarWalletController.deleteTransfer);

// Protected Month Management Endpoints
router.get('/months', authMiddleware, monthController.listMonths);
router.post('/months', authMiddleware, monthController.createMonth);

// Protected Notepad Endpoints
router.get('/notepad/:monthId', authMiddleware, notepadController.getNotes);
router.post('/notepad', authMiddleware, notepadController.createNote);
router.put('/notepad/:noteId', authMiddleware, notepadController.updateNote);
router.delete('/notepad/:noteId', authMiddleware, notepadController.deleteNote);

// Protected Audit History Endpoints
router.get('/audit/:monthId', authMiddleware, auditController.getAuditLogs);

module.exports = router;
