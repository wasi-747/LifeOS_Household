const crypto = require("crypto");
const Device = require("../models/Device");
const DevicePairingCode = require("../models/DevicePairingCode");
const DeviceUsageSession = require("../models/DeviceUsageSession");
const DeviceTrackingConsent = require("../models/DeviceTrackingConsent");
const AppCategory = require("../models/AppCategory");
const User = require("../models/User");

const CONSENT_VERSION = "1.0";
const PAIRING_CODE_TTL_MINUTES = 15;

const generatePairingCode = () =>
  crypto.randomBytes(4).toString("hex").toUpperCase();
const generateDeviceToken = () => crypto.randomBytes(32).toString("hex");
const hashToken = (token) =>
  crypto.createHash("sha256").update(token).digest("hex");

const getScopedHouseholdId = (req) =>
  req.user?.householdId || req.user?.homeId || null;

const getActiveConsent = async (userId, householdId) =>
  DeviceTrackingConsent.findOne({
    userId,
    householdId,
    revokedAt: null,
  }).sort({ consentedAt: -1 });

const normalizeAppName = (name) => String(name || "").trim().toLowerCase();

const getDateRange = (period) => {
  const now = new Date();
  if (period === "monthly") {
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  return start;
};

exports.pairDevice = async (req, res) => {
  try {
    const { pairingCode, deviceId, deviceName, os } = req.body;

    if (req.user && !pairingCode) {
      const householdId = getScopedHouseholdId(req);
      if (!householdId) {
        return res
          .status(400)
          .json({
            error: "You must belong to a household to create a pairing code.",
          });
      }

      const code = generatePairingCode();
      const expiresAt = new Date(
        Date.now() + PAIRING_CODE_TTL_MINUTES * 60 * 1000,
      );

      await DevicePairingCode.create({
        code,
        userId: req.user._id,
        householdId,
        deviceName: deviceName || "",
        os: os || "unknown",
        expiresAt,
      });

      return res.status(201).json({
        pairingCode: code,
        expiresAt,
        consentVersion: CONSENT_VERSION,
      });
    }

    if (!pairingCode) {
      return res.status(400).json({ error: "pairingCode is required." });
    }
    if (!deviceId) {
      return res.status(400).json({ error: "deviceId is required." });
    }

    const codeRecord = await DevicePairingCode.findOne({
      code: pairingCode.trim().toUpperCase(),
      claimedAt: null,
      expiresAt: { $gt: new Date() },
    });

    if (!codeRecord) {
      return res
        .status(404)
        .json({ error: "Invalid or expired pairing code." });
    }

    const deviceToken = generateDeviceToken();
    const tokenHash = hashToken(deviceToken);
    const now = new Date();

    await Device.findOneAndUpdate(
      { deviceId: deviceId.trim() },
      {
        deviceId: deviceId.trim(),
        userId: codeRecord.userId,
        householdId: codeRecord.householdId,
        deviceName: deviceName || codeRecord.deviceName || "Unnamed Device",
        os: os || codeRecord.os || "unknown",
        pairedAt: now,
        deviceTokenHash: tokenHash,
        active: true,
        lastSeenAt: now,
      },
      { upsert: true, new: true, runValidators: true },
    );

    codeRecord.claimedAt = now;
    codeRecord.claimedDeviceId = deviceId.trim();
    await codeRecord.save();

    return res.status(200).json({
      message: "Device paired successfully.",
      deviceToken,
      deviceId: deviceId.trim(),
      householdId: codeRecord.householdId,
      userId: codeRecord.userId,
    });
  } catch (error) {
    console.error("Pair device error:", error);
    return res
      .status(500)
      .json({ error: "Internal server error pairing device." });
  }
};

exports.ingestUsage = async (req, res) => {
  try {
    const device = req.device;
    if (!device) {
      return res.status(401).json({ error: "Device authentication required." });
    }

    const activeConsent = await getActiveConsent(
      device.userId,
      device.householdId,
    );
    if (!activeConsent) {
      return res
        .status(403)
        .json({
          error: "No active device tracking consent found for this user.",
        });
    }

    const payloadItems = Array.isArray(req.body)
      ? req.body
      : Array.isArray(req.body.sessions)
        ? req.body.sessions
        : Array.isArray(req.body.batch)
          ? req.body.batch
          : [];

    if (!payloadItems.length) {
      return res
        .status(400)
        .json({ error: "A non-empty batch of usage sessions is required." });
    }

    const normalizedItems = payloadItems
      .map((item) => {
        const appName = String(item.app_name || item.appName || "").trim();
        const durationSeconds = Number(
          item.duration_seconds ?? item.durationSeconds,
        );
        const gpuAvgPercentRaw = item.gpu_avg_percent ?? item.gpuAvgPercent;
        const startedAtRaw = item.started_at || item.startedAt;

        if (
          !appName ||
          !Number.isFinite(durationSeconds) ||
          durationSeconds <= 0
        ) {
          return null;
        }

        const startedAt = startedAtRaw ? new Date(startedAtRaw) : new Date();
        if (Number.isNaN(startedAt.getTime())) {
          return null;
        }

        const gpuAvgPercent =
          gpuAvgPercentRaw === undefined ||
          gpuAvgPercentRaw === null ||
          gpuAvgPercentRaw === ""
            ? null
            : Number(gpuAvgPercentRaw);

        return {
          deviceId: device.deviceId,
          userId: device.userId,
          householdId: device.householdId,
          appName,
          durationSeconds,
          gpuAvgPercent: Number.isFinite(gpuAvgPercent) ? gpuAvgPercent : null,
          startedAt,
        };
      })
      .filter(Boolean);

    if (!normalizedItems.length) {
      return res
        .status(400)
        .json({ error: "No valid usage sessions were provided." });
    }

    const uniqueAppNames = [
      ...new Set(normalizedItems.map((item) => normalizeAppName(item.appName))),
    ];
    const existingCategories = await AppCategory.find({
      householdId: device.householdId,
      appName: { $in: uniqueAppNames },
    });

    const categoryMap = new Map(
      existingCategories.map((category) => [
        normalizeAppName(category.appName),
        category,
      ]),
    );

    const docsToInsert = normalizedItems.map((item) => {
      const category =
        categoryMap.get(normalizeAppName(item.appName)) || null;

      return {
        ...item,
        categoryId: category ? category._id : null,
        categoryLabel: category ? category.category : "Uncategorized",
      };
    });

    const inserted = await DeviceUsageSession.insertMany(docsToInsert);

    await Device.findOneAndUpdate(
      { deviceId: device.deviceId },
      { lastSeenAt: new Date() },
      { new: true },
    );

    return res.status(201).json({
      message: "Usage batch ingested successfully.",
      insertedCount: inserted.length,
    });
  } catch (error) {
    console.error("Device usage ingest error:", error);
    return res
      .status(500)
      .json({ error: "Internal server error ingesting usage data." });
  }
};

exports.exportMine = async (req, res) => {
  try {
    const householdId = getScopedHouseholdId(req);
    if (!householdId) {
      return res.status(200).json({ sessions: [] });
    }

    const sessions = await DeviceUsageSession.find({
      householdId,
      userId: req.user._id,
    })
      .sort({ startedAt: -1 })
      .populate("categoryId", "appName category")
      .lean();

    return res.status(200).json({
      sessions,
      exportedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Device usage export error:", error);
    return res
      .status(500)
      .json({ error: "Internal server error exporting usage data." });
  }
};

exports.deleteMine = async (req, res) => {
  try {
    const householdId = getScopedHouseholdId(req);
    if (!householdId) {
      return res
        .status(200)
        .json({ message: "No household found. Nothing to delete." });
    }

    const result = await DeviceUsageSession.deleteMany({
      householdId,
      userId: req.user._id,
    });

    return res.status(200).json({
      message: "Your tracked usage data has been deleted.",
      deletedCount: result.deletedCount || 0,
    });
  } catch (error) {
    console.error("Device usage delete error:", error);
    return res
      .status(500)
      .json({ error: "Internal server error deleting usage data." });
  }
};

exports.getConsentStatus = async (req, res) => {
  try {
    const device = req.device;
    if (!device) {
      return res.status(401).json({ error: "Device authentication required." });
    }

    const activeConsent = await getActiveConsent(
      device.userId,
      device.householdId,
    );

    return res.status(200).json({
      isActive: !!activeConsent,
      consentVersion: activeConsent?.consentVersion || null,
      consentedAt: activeConsent?.consentedAt || null,
    });
  } catch (error) {
    console.error("Consent status error:", error);
    return res
      .status(500)
      .json({ error: "Internal server error checking consent status." });
  }
};

exports.listDevices = async (req, res) => {
  try {
    const householdId = getScopedHouseholdId(req);
    if (!householdId) {
      return res.status(200).json({ devices: [] });
    }

    const devices = await Device.find({ householdId, active: true })
      .sort({ lastSeenAt: -1, pairedAt: -1 })
      .lean();

    const userIds = [...new Set(devices.map((d) => String(d.userId)))];
    const users = await User.find({ _id: { $in: userIds } })
      .select("name email role nickname")
      .lean();
    const userMap = new Map(users.map((u) => [String(u._id), u]));

    return res.status(200).json({
      devices: devices.map((device) => ({
        deviceId: device.deviceId,
        deviceName: device.deviceName,
        os: device.os,
        pairedAt: device.pairedAt,
        lastSeenAt: device.lastSeenAt,
        userId: device.userId,
        owner: userMap.get(String(device.userId)) || null,
      })),
    });
  } catch (error) {
    console.error("List devices error:", error);
    return res
      .status(500)
      .json({ error: "Internal server error listing devices." });
  }
};

exports.getUsageSummary = async (req, res) => {
  try {
    const householdId = getScopedHouseholdId(req);
    if (!householdId) {
      return res.status(200).json({
        categoryBreakdown: [],
        deviceLedger: [],
        totalHours: 0,
        period: req.query.period || "daily",
      });
    }

    const period = req.query.period === "monthly" ? "monthly" : "daily";
    const rangeStart = getDateRange(period);
    const targetUserId = req.query.userId || String(req.user._id);
    const deviceId = req.query.deviceId || null;

    const sessionFilter = {
      householdId,
      userId: targetUserId,
      startedAt: { $gte: rangeStart },
    };
    if (deviceId) {
      sessionFilter.deviceId = deviceId;
    }

    const sessions = await DeviceUsageSession.find(sessionFilter).lean();

    const categoryTotals = {};
    const deviceTotals = {};
    let totalSeconds = 0;

    sessions.forEach((session) => {
      const label = session.categoryLabel || "Uncategorized";
      const seconds = session.durationSeconds || 0;
      totalSeconds += seconds;
      categoryTotals[label] = (categoryTotals[label] || 0) + seconds;
      deviceTotals[session.deviceId] =
        (deviceTotals[session.deviceId] || 0) + seconds;
    });

    const householdDevices = await Device.find({ householdId }).lean();
    const deviceOwnerMap = new Map(
      householdDevices.map((d) => [d.deviceId, d]),
    );
    const ownerIds = [
      ...new Set(householdDevices.map((d) => String(d.userId))),
    ];
    const owners = await User.find({ _id: { $in: ownerIds } })
      .select("name")
      .lean();
    const ownerNameMap = new Map(owners.map((o) => [String(o._id), o.name]));

    const categoryBreakdown = Object.entries(categoryTotals)
      .map(([name, seconds]) => ({
        name,
        seconds,
        hours: seconds / 3600,
      }))
      .sort((a, b) => b.seconds - a.seconds);

    const totalDeviceSeconds = Object.values(deviceTotals).reduce(
      (sum, val) => sum + val,
      0,
    );
    const deviceLedger = Object.entries(deviceTotals)
      .map(([devId, seconds]) => {
        const device = deviceOwnerMap.get(devId);
        return {
          deviceId: devId,
          deviceName: device?.deviceName || devId,
          ownerName: device
            ? ownerNameMap.get(String(device.userId)) || "Unknown"
            : "Unknown",
          usageHours: seconds / 3600,
          usagePercent:
            totalDeviceSeconds > 0 ? (seconds / totalDeviceSeconds) * 100 : 0,
        };
      })
      .sort((a, b) => b.usageHours - a.usageHours);

    return res.status(200).json({
      period,
      rangeStart,
      totalHours: totalSeconds / 3600,
      categoryBreakdown,
      deviceLedger,
      sessionCount: sessions.length,
    });
  } catch (error) {
    console.error("Usage summary error:", error);
    return res
      .status(500)
      .json({ error: "Internal server error fetching usage summary." });
  }
};

exports.getUntaggedApps = async (req, res) => {
  try {
    const householdId = getScopedHouseholdId(req);
    if (!householdId) {
      return res.status(200).json({ apps: [] });
    }

    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const sessions = await DeviceUsageSession.find({
      householdId,
      startedAt: { $gte: weekAgo },
      categoryLabel: "Uncategorized",
    }).lean();

    const taggedCategories = await AppCategory.find({
      householdId,
      category: { $ne: "Uncategorized" },
    })
      .select("appName")
      .lean();
    const taggedSet = new Set(
      taggedCategories.map((c) => normalizeAppName(c.appName)),
    );

    const appStats = new Map();
    sessions.forEach((session) => {
      const key = normalizeAppName(session.appName);
      if (taggedSet.has(key)) return;

      const existing = appStats.get(key) || {
        appName: session.appName,
        totalSeconds: 0,
        maxGpu: null,
        sessionCount: 0,
      };
      existing.totalSeconds += session.durationSeconds || 0;
      existing.sessionCount += 1;
      if (
        session.gpuAvgPercent !== null &&
        session.gpuAvgPercent !== undefined
      ) {
        existing.maxGpu =
          existing.maxGpu === null
            ? session.gpuAvgPercent
            : Math.max(existing.maxGpu, session.gpuAvgPercent);
      }
      appStats.set(key, existing);
    });

    const apps = [...appStats.values()]
      .map((app) => ({
        appName: app.appName,
        totalSeconds: app.totalSeconds,
        totalHours: app.totalSeconds / 3600,
        sessionCount: app.sessionCount,
        suggestedCategory:
          app.maxGpu !== null && app.maxGpu > 50 ? "Gaming" : null,
      }))
      .sort((a, b) => b.totalSeconds - a.totalSeconds);

    return res.status(200).json({ apps });
  } catch (error) {
    console.error("Untagged apps error:", error);
    return res
      .status(500)
      .json({ error: "Internal server error fetching untagged apps." });
  }
};

exports.tagAppCategory = async (req, res) => {
  try {
    const householdId = getScopedHouseholdId(req);
    if (!householdId) {
      return res
        .status(400)
        .json({ error: "You must belong to a household to tag apps." });
    }

    const { appName, category } = req.body;
    const normalizedName = normalizeAppName(appName);
    const validCategories = ["Gaming", "Work", "Entertainment", "Other"];

    if (!normalizedName) {
      return res.status(400).json({ error: "appName is required." });
    }
    if (!validCategories.includes(category)) {
      return res.status(400).json({
        error: `category must be one of: ${validCategories.join(", ")}`,
      });
    }

    const now = new Date();
    const categoryDoc = await AppCategory.findOneAndUpdate(
      { householdId, appName: normalizedName },
      {
        householdId,
        appName: normalizedName,
        category,
        taggedBy: req.user._id,
        taggedAt: now,
      },
      { upsert: true, new: true, runValidators: true },
    );

    const updateResult = await DeviceUsageSession.updateMany(
      {
        householdId,
        appName: {
          $regex: new RegExp(
            `^${normalizedName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
            "i",
          ),
        },
      },
      {
        categoryId: categoryDoc._id,
        categoryLabel: category,
      },
    );

    return res.status(200).json({
      message: "App category tagged successfully.",
      category: categoryDoc,
      sessionsUpdated: updateResult.modifiedCount || 0,
    });
  } catch (error) {
    console.error("Tag app category error:", error);
    return res
      .status(500)
      .json({ error: "Internal server error tagging app category." });
  }
};
