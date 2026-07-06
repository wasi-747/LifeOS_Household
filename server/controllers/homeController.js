const Home = require("../models/Home");
const User = require("../models/User");
const Household = require("../models/Household");
const HouseholdMember = require("../models/HouseholdMember");
const { logChange } = require("./auditController");

exports.createHome = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ error: "Home name is required." });
    }

    const userId = req.user._id;

    // Create the new Home
    const home = await Home.create({
      name: name.trim(),
      admin: userId,
      members: [userId],
    });

    await Household.create({
      _id: home._id,
      name: home.name,
      admin: userId,
      members: [userId],
      utilityControlMembers: [userId],
    });

    await HouseholdMember.findOneAndUpdate(
      { householdId: home._id, userId },
      {
        householdId: home._id,
        userId,
        role: "admin",
        joinedAt: new Date(),
      },
      { upsert: true, new: true },
    );

    // Update the creator's homeId and set them as Admin
    await User.findByIdAndUpdate(userId, {
      homeId: home._id,
      role: "admin",
    });

    return res.status(201).json({
      message: `Welcome to your new home, ${home.name}!`,
      home,
      user: {
        ...req.user,
        homeId: home._id,
        role: "admin",
      },
    });
  } catch (error) {
    console.error("Create home error:", error);
    return res
      .status(500)
      .json({ error: "Internal server error creating home." });
  }
};

exports.inviteMember = async (req, res) => {
  try {
    const { nickname } = req.body;
    if (!nickname) {
      return res.status(400).json({ error: "Roommate nickname is required." });
    }

    const inviteeNickname = nickname.trim().toLowerCase();

    // Check if user exists
    const invitee = await User.findOne({ nickname: inviteeNickname });
    if (!invitee) {
      return res
        .status(404)
        .json({ error: `No user found with nickname "${inviteeNickname}".` });
    }

    // Check if invitee is already in a home
    if (invitee.homeId) {
      return res
        .status(400)
        .json({
          error: `${invitee.name} already belongs to another household.`,
        });
    }

    // Get current user's home
    const homeId = req.user.homeId;
    if (!homeId) {
      return res
        .status(400)
        .json({ error: "You must belong to a home to invite roommates." });
    }

    const home = await Home.findById(homeId);
    if (!home) {
      return res.status(404).json({ error: "Home household not found." });
    }

    // Add member to Home
    if (!home.members.includes(invitee._id)) {
      home.members.push(invitee._id);
      await home.save();
    }

    await Household.findByIdAndUpdate(homeId, {
      $addToSet: {
        members: invitee._id,
      },
    });

    await HouseholdMember.findOneAndUpdate(
      { householdId: homeId, userId: invitee._id },
      {
        householdId: homeId,
        userId: invitee._id,
        role: "member",
        joinedAt: new Date(),
      },
      { upsert: true, new: true },
    );

    // Set invitee's home association
    invitee.homeId = homeId;
    invitee.role = "member";
    await invitee.save();

    // Log the audit trail
    await logChange({
      monthId: "ALL",
      homeId,
      action: "UPDATE_CONFIG",
      entity: "Home",
      entityId: homeId.toString(),
      userId: req.user._id,
      userName: req.user.name,
      changes: [
        {
          field: "members",
          oldValue: null,
          newValue: invitee.name,
          detail: `Added roommate ${invitee.name} (@${invitee.nickname}) to the household.`,
        },
      ],
    });

    return res.status(200).json({
      message: `Successfully added ${invitee.name} to your home!`,
      invitee: {
        _id: invitee._id,
        name: invitee.name,
        nickname: invitee.nickname,
        role: invitee.role,
      },
    });
  } catch (error) {
    console.error("Invite member error:", error);
    return res
      .status(500)
      .json({ error: "Internal server error inviting roommate." });
  }
};

exports.getHomeDetails = async (req, res) => {
  try {
    const homeId = req.user.homeId;
    if (!homeId) {
      return res.status(200).json({ home: null });
    }

    const home = await Home.findById(homeId).populate({
      path: "members",
      select: "name nickname email role",
    });

    return res.status(200).json({ home });
  } catch (error) {
    console.error("Get home details error:", error);
    return res
      .status(500)
      .json({ error: "Internal server error fetching home details." });
  }
};

exports.updatePermission = async (req, res) => {
  try {
    const { memberId, hasControl } = req.body;
    const homeId = req.user.homeId;

    if (!memberId) {
      return res.status(400).json({ error: "memberId is required" });
    }
    if (!homeId) {
      return res.status(400).json({ error: "You do not belong to a home." });
    }

    const home = await Home.findById(homeId);
    if (!home) {
      return res.status(404).json({ error: "Home not found" });
    }

    // Only owner (admin) can change permissions
    if (home.admin.toString() !== req.user._id.toString()) {
      return res
        .status(403)
        .json({
          error: "Only the home owner can modify roommate permissions.",
        });
    }

    // Toggle logic
    const midStr = memberId.toString();
    const index = home.utilityControlMembers.findIndex(
      (id) => id.toString() === midStr,
    );

    if (hasControl) {
      if (index === -1) {
        home.utilityControlMembers.push(midStr);
      }
    } else {
      if (index !== -1) {
        home.utilityControlMembers.splice(index, 1);
      }
    }

    await home.save();

    await Household.findByIdAndUpdate(homeId, {
      $set: {
        utilityControlMembers: home.utilityControlMembers,
      },
    });

    // Log the permission change in Audit Log
    const targetUser = await User.findById(memberId);
    const targetName = targetUser ? targetUser.name : "Unknown User";
    await logChange({
      monthId: "ALL",
      homeId,
      action: "UPDATE_CONFIG",
      entity: "Home",
      entityId: homeId.toString(),
      userId: req.user._id,
      userName: req.user.name,
      changes: [
        {
          field: "utilityControlMembers",
          oldValue: null,
          newValue: null,
          detail: `${hasControl ? "Granted" : "Revoked"} full bill config control permission for ${targetName}.`,
        },
      ],
    });

    await home.populate({
      path: "members",
      select: "name nickname email role",
    });

    return res
      .status(200)
      .json({ message: "Permissions updated successfully", home });
  } catch (error) {
    console.error("Update permission error:", error);
    return res
      .status(500)
      .json({ error: "Internal server error updating permissions." });
  }
};
