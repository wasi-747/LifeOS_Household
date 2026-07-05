const AuditLog = require('../models/AuditLog');

/**
 * Internal helper — call from other controllers to log a change.
 * @param {Object} data
 * @param {string} data.monthId
 * @param {ObjectId} data.homeId - the home context
 * @param {string} data.action - e.g. 'UPDATE_MEAL'
 * @param {string} data.entity - e.g. 'DailyMeal'
 * @param {string} data.entityId - document _id
 * @param {string} data.userId - who made the change
 * @param {string} data.userName
 * @param {Array}  data.changes - [{ field, oldValue, newValue, detail }]
 */
exports.logChange = async (data) => {
  try {
    if (!data.homeId) {
      console.warn('logChange called without homeId context');
      return;
    }

    await AuditLog.create({
      monthId: data.monthId || '',
      homeId: data.homeId,
      action: data.action,
      entity: data.entity || '',
      entityId: data.entityId || '',
      userId: data.userId || 'system',
      userName: data.userName || 'System',
      changes: data.changes || []
    });
  } catch (err) {
    // Don't let audit failures break the main operation
    console.error('Audit log write failed:', err.message);
  }
};

/**
 * GET /audit/:monthId — List audit logs for a month
 */
exports.getAuditLogs = async (req, res) => {
  try {
    const { monthId } = req.params;
    const homeId = req.user.homeId;
    if (!homeId) {
      return res.status(200).json({ logs: [], total: 0, page: 1, totalPages: 0 });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    const filter = { homeId };
    if (monthId && monthId !== 'all') {
      filter.monthId = monthId;
    }
    if (req.query.action) {
      filter.action = req.query.action;
    }
    if (req.query.userId) {
      filter.userId = req.query.userId;
    }

    // Dynamic search filtering on changes detail
    if (req.query.search) {
      filter['changes.detail'] = { $regex: req.query.search, $options: 'i' };
    }

    const [logs, total] = await Promise.all([
      AuditLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      AuditLog.countDocuments(filter)
    ]);

    return res.status(200).json({
      logs,
      total,
      page,
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    return res.status(500).json({ error: 'Internal server error fetching audit logs' });
  }
};
