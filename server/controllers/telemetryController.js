const DeviceTelemetry = require('../models/DeviceTelemetry');
const User = require('../models/User');

exports.saveTelemetry = async (req, res) => {
  try {
    const {
      device_id,
      timestamp,
      cpu_usage_avg,
      ram_usage_avg,
      uptime_seconds,
      activity_breakdown,
      username // Option to send user nickname from python agent to link it
    } = req.body;

    if (!device_id) {
      return res.status(400).json({ error: 'device_id is required' });
    }

    let ownerId = null;
    let homeId = null;

    if (username) {
      const user = await User.findOne({ nickname: username.toLowerCase() });
      if (user) {
        ownerId = user._id;
        homeId = user.homeId;
      }
    }

    const telemetryRecord = new DeviceTelemetry({
      deviceId: device_id,
      ownerId,
      homeId,
      timestamp: timestamp ? new Date(timestamp) : new Date(),
      cpuUsage: cpu_usage_avg || 0,
      ramUsage: ram_usage_avg || 0,
      uptime: uptime_seconds || 0,
      activityBreakdown: {
        Coding: activity_breakdown?.Coding || 0,
        Gaming: activity_breakdown?.Gaming || 0,
        Browsing: activity_breakdown?.Browsing || 0,
        Other: activity_breakdown?.Other || 0
      }
    });

    const saved = await telemetryRecord.save();
    return res.status(201).json({
      message: 'Telemetry received successfully',
      data: saved
    });
  } catch (error) {
    console.error('Error saving telemetry payload:', error);
    return res.status(500).json({ error: 'Internal server error saving telemetry' });
  }
};

exports.getTelemetryByDevice = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const homeId = req.user.homeId;

    if (!deviceId) {
      return res.status(400).json({ error: 'deviceId is required' });
    }
    if (!homeId) {
      return res.status(200).json([]);
    }

    const logs = await DeviceTelemetry.find({ deviceId, homeId })
      .sort({ timestamp: -1 })
      .limit(50);

    return res.status(200).json(logs);
  } catch (error) {
    console.error('Error retrieving telemetry records:', error);
    return res.status(500).json({ error: 'Internal server error retrieving telemetry' });
  }
};

exports.getDevices = async (req, res) => {
  try {
    const homeId = req.user.homeId;
    if (!homeId) {
      return res.status(200).json([]);
    }

    const telemetries = await DeviceTelemetry.find({ homeId })
      .populate('ownerId', 'name email role')
      .select('deviceId ownerId')
      .lean();
    
    const deviceMap = {};
    telemetries.forEach(t => {
      if (t.deviceId && !deviceMap[t.deviceId]) {
        deviceMap[t.deviceId] = {
          deviceId: t.deviceId,
          owner: t.ownerId || null
        };
      }
    });

    const devices = Object.values(deviceMap);
    return res.status(200).json(devices);
  } catch (error) {
    console.error('Error fetching telemetry devices:', error);
    return res.status(500).json({ error: 'Internal server error fetching devices list' });
  }
};
