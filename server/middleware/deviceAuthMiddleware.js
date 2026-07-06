const crypto = require("crypto");
const Device = require("../models/Device");

const hashToken = (token) =>
  crypto.createHash("sha256").update(token).digest("hex");

module.exports = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Device token required." });
    }

    const token = authHeader.split(" ")[1];
    const deviceTokenHash = hashToken(token);

    const device = await Device.findOne({ deviceTokenHash, active: true });
    if (!device) {
      return res
        .status(401)
        .json({ error: "Invalid or inactive device token." });
    }

    req.device = device;
    req.deviceToken = token;
    next();
  } catch (error) {
    console.error("Device auth middleware error:", error);
    return res
      .status(500)
      .json({ error: "Server device authentication error." });
  }
};
