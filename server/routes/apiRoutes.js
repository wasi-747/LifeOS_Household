const express = require("express");
const router = express.Router();

// Controllers
const authController = require("../controllers/authController");
const homeController = require("../controllers/homeController");
const calculationController = require("../controllers/calculationController");
const telemetryController = require("../controllers/telemetryController");
const trackerController = require("../controllers/trackerController");
const monthlyBillController = require("../controllers/monthlyBillController");
const bazarWalletController = require("../controllers/bazarWalletController");
const monthController = require("../controllers/monthController");
const notepadController = require("../controllers/notepadController");
const auditController = require("../controllers/auditController");
const deviceUsageController = require("../controllers/deviceUsageController");
const deviceConsentController = require("../controllers/deviceConsentController");

// Middleware
const authMiddleware = require("../middleware/authMiddleware");
const optionalAuthMiddleware = require("../middleware/optionalAuthMiddleware");
const deviceAuthMiddleware = require("../middleware/deviceAuthMiddleware");

// Public Auth routes
router.post("/auth/signup", authController.signup);
router.post("/auth/login", authController.login);

// Protected Auth & Home routes
router.get("/auth/me", authMiddleware, authController.getMe);
router.put("/auth/completed-tour", authMiddleware, authController.completeTour);
router.post("/home/create", authMiddleware, homeController.createHome);
router.post("/home/invite", authMiddleware, homeController.inviteMember);
router.get("/home/details", authMiddleware, homeController.getHomeDetails);
router.post(
  "/home/permission",
  authMiddleware,
  homeController.updatePermission,
);

// Protected Device Tracking Endpoints
router.post(
  "/devices/pair",
  optionalAuthMiddleware,
  deviceUsageController.pairDevice,
);
router.get("/devices", authMiddleware, deviceUsageController.listDevices);
router.post(
  "/device-usage/ingest",
  deviceAuthMiddleware,
  deviceUsageController.ingestUsage,
);
router.get(
  "/device-usage/export",
  authMiddleware,
  deviceUsageController.exportMine,
);
router.delete(
  "/device-usage/mine",
  authMiddleware,
  deviceUsageController.deleteMine,
);
router.get(
  "/device-usage/summary",
  authMiddleware,
  deviceUsageController.getUsageSummary,
);
router.get(
  "/device-usage/untagged",
  authMiddleware,
  deviceUsageController.getUntaggedApps,
);
router.post(
  "/device-usage/categories/tag",
  authMiddleware,
  deviceUsageController.tagAppCategory,
);
router.get(
  "/device-consent/status",
  deviceAuthMiddleware,
  deviceUsageController.getConsentStatus,
);
router.get(
  "/device-consent/me",
  authMiddleware,
  deviceConsentController.getMyConsent,
);
router.post(
  "/device-consent",
  authMiddleware,
  deviceConsentController.grantConsent,
);
router.delete(
  "/device-consent/me",
  authMiddleware,
  deviceConsentController.revokeConsent,
);

// Protected Calculation Endpoint
router.get(
  "/summary/:monthId",
  authMiddleware,
  calculationController.getSummary,
);

// Protected Telemetry (Read) & Public (Write from Python script)
router.post("/telemetry", telemetryController.saveTelemetry); // Public for agent access
router.get(
  "/telemetry/info/devices",
  authMiddleware,
  telemetryController.getDevices,
);
router.get(
  "/telemetry/:deviceId",
  authMiddleware,
  telemetryController.getTelemetryByDevice,
);

// Protected Tracker Endpoints
router.get(
  "/tracker/:monthId",
  authMiddleware,
  trackerController.getTrackerData,
);
router.post(
  "/tracker/meals/update",
  authMiddleware,
  trackerController.updateMeals,
);
router.post(
  "/tracker/bazar/update",
  authMiddleware,
  trackerController.updateBazar,
);
router.post(
  "/tracker/bazar/assign",
  authMiddleware,
  trackerController.assignBazarUser,
);
router.post(
  "/tracker/deposits/update",
  authMiddleware,
  trackerController.updateDeposit,
);
router.post("/tracker/config", authMiddleware, trackerController.updateConfig);

// Protected Monthly Bill Configuration Endpoints
router.get(
  "/monthly-bill/:monthId",
  authMiddleware,
  monthlyBillController.getMonthlyBill,
);
router.post(
  "/monthly-bill",
  authMiddleware,
  monthlyBillController.saveMonthlyBill,
);

// Protected Bazar Wallet Endpoints
router.get(
  "/bazar-wallet/:monthId",
  authMiddleware,
  bazarWalletController.getWallet,
);
router.post(
  "/bazar-wallet/transfer",
  authMiddleware,
  bazarWalletController.addTransfer,
);
router.delete(
  "/bazar-wallet/transfer/:transferId",
  authMiddleware,
  bazarWalletController.deleteTransfer,
);

// Protected Month Management Endpoints
router.get("/months", authMiddleware, monthController.listMonths);
router.post("/months", authMiddleware, monthController.createMonth);

// Protected Notepad Endpoints
router.get("/notepad/:monthId", authMiddleware, notepadController.getNotes);
router.post("/notepad", authMiddleware, notepadController.createNote);
router.put("/notepad/:noteId", authMiddleware, notepadController.updateNote);
router.delete("/notepad/:noteId", authMiddleware, notepadController.deleteNote);

// Protected Audit History Endpoints
router.get("/audit/:monthId", authMiddleware, auditController.getAuditLogs);

module.exports = router;
