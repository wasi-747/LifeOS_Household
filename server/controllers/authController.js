const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

const JWT_SECRET = process.env.JWT_SECRET || "cozy_lifeos_secret_key";

exports.signup = async (req, res) => {
  try {
    const { name, nickname, email, password } = req.body;
    if (!name || !nickname || !email || !password) {
      return res
        .status(400)
        .json({
          error: "All fields (name, nickname, email, password) are required.",
        });
    }

    const cleanNickname = nickname.trim().toLowerCase();
    const cleanEmail = email.trim().toLowerCase();

    // Check if alphanumeric nickname
    if (!/^[a-zA-Z0-9_]+$/.test(cleanNickname)) {
      return res
        .status(400)
        .json({
          error:
            "Nickname must be alphanumeric (letters, numbers, underscores only).",
        });
    }

    // Check availability
    const existingUser = await User.findOne({
      $or: [{ nickname: cleanNickname }, { email: cleanEmail }],
    });

    if (existingUser) {
      if (existingUser.nickname === cleanNickname) {
        return res
          .status(400)
          .json({ error: "This nickname is already taken." });
      }
      return res
        .status(400)
        .json({ error: "An account with this email already exists." });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create User
    const user = await User.create({
      name: name.trim(),
      nickname: cleanNickname,
      email: cleanEmail,
      password: hashedPassword,
      role: "member",
      homeId: null,
    });

    // Create Token
    const token = jwt.sign({ userId: user._id }, JWT_SECRET, {
      expiresIn: "30d",
    });

    return res.status(201).json({
      token,
      user: {
        _id: user._id,
        name: user.name,
        nickname: user.nickname,
        email: user.email,
        homeId: user.homeId,
        householdId: user.homeId,
        role: user.role,
        hasCompletedTour: user.hasCompletedTour,
      },
    });
  } catch (error) {
    console.error("Signup error:", error);
    return res
      .status(500)
      .json({ error: "Internal server error during registration." });
  }
};

exports.login = async (req, res) => {
  try {
    const { emailOrNickname, password } = req.body;
    if (!emailOrNickname || !password) {
      return res
        .status(400)
        .json({ error: "Email/Nickname and password are required." });
    }

    const searchKey = emailOrNickname.trim().toLowerCase();

    // Find user
    const user = await User.findOne({
      $or: [{ email: searchKey }, { nickname: searchKey }],
    });

    if (!user) {
      return res.status(401).json({ error: "Invalid credentials." });
    }

    // Compare password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid credentials." });
    }

    // Create Token
    const token = jwt.sign({ userId: user._id }, JWT_SECRET, {
      expiresIn: "30d",
    });

    return res.status(200).json({
      token,
      user: {
        _id: user._id,
        name: user.name,
        nickname: user.nickname,
        email: user.email,
        homeId: user.homeId,
        householdId: user.homeId,
        role: user.role,
        hasCompletedTour: user.hasCompletedTour,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    return res
      .status(500)
      .json({ error: "Internal server error during login." });
  }
};

exports.getMe = async (req, res) => {
  try {
    // req.user has already been verified and fetched in authMiddleware
    return res.status(200).json({ user: req.user });
  } catch (error) {
    console.error("Get me error:", error);
    return res
      .status(500)
      .json({ error: "Internal server error fetching account details." });
  }
};

exports.completeTour = async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user._id, { hasCompletedTour: true });
    return res
      .status(200)
      .json({ message: "Tour completion saved successfully." });
  } catch (error) {
    console.error("Complete tour error:", error);
    return res
      .status(500)
      .json({ error: "Internal server error saving tour completion." });
  }
};
