const Home = require("../models/Home");
const User = require("../models/User");
const Household = require("../models/Household");
const HouseholdMember = require("../models/HouseholdMember");
const { logChange } = require("./auditController");
const bcrypt = require("bcryptjs");

exports.createHome = async (req, res) => {
  try {
    const { name, currency } = req.body;
    if (!name) {
      return res.status(400).json({ error: "Home name is required." });
    }

    const userId = req.user._id;

    // Create the new Home
    const home = await Home.create({
      name: name.trim(),
      admin: userId,
      members: [userId],
      currency: currency ? currency.trim() : "৳",
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

exports.updateHomeSettings = async (req, res) => {
  try {
    const { name, currency } = req.body;
    const homeId = req.user.homeId;
    if (!homeId) {
      return res.status(400).json({ error: "You do not belong to a home." });
    }

    const home = await Home.findById(homeId);
    if (!home) {
      return res.status(404).json({ error: "Home not found." });
    }

    if (home.admin.toString() !== req.user._id.toString()) {
      return res
        .status(403)
        .json({ error: "Only the household admin can modify home settings." });
    }

    if (name && name.trim()) home.name = name.trim();
    if (currency && currency.trim()) home.currency = currency.trim();

    await home.save();
    await home.populate({
      path: "members",
      select: "name nickname email role",
    });

    return res
      .status(200)
      .json({ message: "Home settings updated successfully!", home });
  } catch (error) {
    console.error("Update home settings error:", error);
    return res
      .status(500)
      .json({ error: "Internal server error updating home settings." });
  }
};

exports.updateRoommateCredentials = async (req, res) => {
  try {
    const { memberId, newEmail, newNickname, newPassword } = req.body;
    const homeId = req.user.homeId;

    if (!memberId) {
      return res.status(400).json({ error: "memberId is required" });
    }
    if (!homeId) {
      return res.status(400).json({ error: "You do not belong to a home." });
    }

    const home = await Home.findById(homeId);
    if (!home) {
      return res.status(404).json({ error: "Home not found." });
    }

    // Check if target member belongs to this home
    const targetUser = await User.findOne({ _id: memberId, homeId });
    if (!targetUser) {
      return res.status(404).json({ error: "Roommate not found in your home." });
    }

    const changes = [];

    // Update Email
    if (newEmail && newEmail.trim() !== "") {
      const emailLower = newEmail.trim().toLowerCase();
      if (emailLower !== targetUser.email) {
        const existingEmail = await User.findOne({ email: emailLower, _id: { $ne: memberId } });
        if (existingEmail) {
          return res.status(400).json({ error: `Email "${emailLower}" is already used by another account.` });
        }
        changes.push({ field: "email", oldValue: targetUser.email, newValue: emailLower, detail: `Updated ${targetUser.name}'s email to ${emailLower}` });
        targetUser.email = emailLower;
      }
    }

    // Update Nickname / Handle
    if (newNickname && newNickname.trim() !== "") {
      const nickLower = newNickname.trim().toLowerCase();
      if (nickLower !== targetUser.nickname) {
        const existingNick = await User.findOne({ nickname: nickLower, _id: { $ne: memberId } });
        if (existingNick) {
          return res.status(400).json({ error: `Handle "@${nickLower}" is already taken.` });
        }
        changes.push({ field: "nickname", oldValue: targetUser.nickname, newValue: nickLower, detail: `Updated ${targetUser.name}'s handle to @${nickLower}` });
        targetUser.nickname = nickLower;
      }
    }

    // Update Password
    if (newPassword && newPassword.trim() !== "") {
      if (newPassword.length < 4) {
        return res.status(400).json({ error: "New password must be at least 4 characters." });
      }
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      targetUser.password = hashedPassword;
      changes.push({ field: "password", oldValue: "********", newValue: "********", detail: `Reset ${targetUser.name}'s password` });
    }

    await targetUser.save();

    if (changes.length > 0) {
      await logChange({
        monthId: "ALL",
        homeId,
        action: "UPDATE_CONFIG",
        entity: "User",
        entityId: targetUser._id.toString(),
        userId: req.user._id,
        userName: req.user.name,
        changes,
      });
    }

    // Return updated home details
    const updatedHome = await Home.findById(homeId).populate({
      path: "members",
      select: "name nickname email role",
    });

    return res.status(200).json({
      message: `Credentials updated for ${targetUser.name}!`,
      user: {
        _id: targetUser._id,
        name: targetUser.name,
        nickname: targetUser.nickname,
        email: targetUser.email,
        role: targetUser.role,
      },
      home: updatedHome,
    });
  } catch (error) {
    console.error("Update roommate credentials error:", error);
    return res.status(500).json({ error: "Internal server error updating roommate credentials." });
  }
};

