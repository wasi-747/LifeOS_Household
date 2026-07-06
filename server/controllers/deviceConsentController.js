const DeviceTrackingConsent = require("../models/DeviceTrackingConsent");

const CONSENT_VERSION = "1.0";

const getHouseholdId = (req) =>
  req.user?.householdId || req.user?.homeId || null;

exports.getMyConsent = async (req, res) => {
  try {
    const householdId = getHouseholdId(req);
    if (!householdId) {
      return res.status(200).json({ consent: null, isActive: false });
    }

    const consent = await DeviceTrackingConsent.findOne({
      userId: req.user._id,
      householdId,
    }).sort({ consentedAt: -1 });

    return res.status(200).json({
      consent,
      isActive: !!consent && !consent.revokedAt,
    });
  } catch (error) {
    console.error("Get consent error:", error);
    return res
      .status(500)
      .json({ error: "Internal server error fetching consent state." });
  }
};

exports.grantConsent = async (req, res) => {
  try {
    const householdId = getHouseholdId(req);
    if (!householdId) {
      return res
        .status(400)
        .json({ error: "You must belong to a household to grant consent." });
    }

    const activeConsent = await DeviceTrackingConsent.findOne({
      userId: req.user._id,
      householdId,
      revokedAt: null,
    }).sort({ consentedAt: -1 });

    if (activeConsent) {
      return res.status(200).json({
        message: "Consent already active.",
        consent: activeConsent,
        isActive: true,
      });
    }

    const consent = await DeviceTrackingConsent.create({
      userId: req.user._id,
      householdId,
      consentedAt: new Date(),
      revokedAt: null,
      consentVersion: req.body?.consentVersion || CONSENT_VERSION,
    });

    return res.status(201).json({
      message: "Consent granted successfully.",
      consent,
      isActive: true,
    });
  } catch (error) {
    console.error("Grant consent error:", error);
    return res
      .status(500)
      .json({ error: "Internal server error granting consent." });
  }
};

exports.revokeConsent = async (req, res) => {
  try {
    const householdId = getHouseholdId(req);
    if (!householdId) {
      return res
        .status(400)
        .json({ error: "You must belong to a household to revoke consent." });
    }

    const consent = await DeviceTrackingConsent.findOne({
      userId: req.user._id,
      householdId,
      revokedAt: null,
    }).sort({ consentedAt: -1 });

    if (!consent) {
      return res
        .status(200)
        .json({ message: "No active consent found.", isActive: false });
    }

    consent.revokedAt = new Date();
    await consent.save();

    return res.status(200).json({
      message: "Consent revoked successfully.",
      consent,
      isActive: false,
    });
  } catch (error) {
    console.error("Revoke consent error:", error);
    return res
      .status(500)
      .json({ error: "Internal server error revoking consent." });
  }
};
