const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const User = require("../models/User");

const JWT_SECRET = process.env.JWT_SECRET || "cozy_lifeos_secret_key";

const createTransporter = () => {
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;
  if (!user || !pass) return null;

  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
      user: user.trim(),
      pass: pass.replace(/\s+/g, ""),
    },
    tls: {
      rejectUnauthorized: false,
    },
    connectionTimeout: 5000,
    greetingTimeout: 5000,
    socketTimeout: 5000,
  });
};

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

    const cleanNickname = nickname.trim().toLowerCase().replace(/^@+/, "");
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

    const rawKey = emailOrNickname.trim().toLowerCase();
    const cleanHandle = rawKey.replace(/^@+/, "");
    const escapedSearch = cleanHandle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    // Find user by email, nickname (with or without @), or full name (case-insensitive)
    const user = await User.findOne({
      $or: [
        { email: rawKey },
        { email: cleanHandle },
        { nickname: cleanHandle },
        { nickname: rawKey },
        { name: { $regex: new RegExp(`^${escapedSearch}$`, "i") } },
      ],
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

exports.forgotPassword = async (req, res) => {
  try {
    const { emailOrNickname } = req.body;
    if (!emailOrNickname) {
      return res.status(400).json({ error: "Email or handle is required." });
    }

    const rawKey = emailOrNickname.trim().toLowerCase();
    const cleanHandle = rawKey.replace(/^@+/, "");
    const user = await User.findOne({
      $or: [
        { email: rawKey },
        { email: cleanHandle },
        { nickname: cleanHandle },
        { nickname: rawKey },
      ],
    });

    if (!user) {
      return res
        .status(404)
        .json({ error: "No household member found with that email or handle." });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    user.resetOtp = otp;
    user.resetOtpExpires = otpExpires;
    await user.save();

    const emailHtml = `
      <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #1C1512; color: #FAF6F0; padding: 32px; border-radius: 16px; max-width: 500px; margin: 0 auto; border: 1px solid #382923;">
        <div style="text-align: center; margin-bottom: 24px;">
          <div style="background-color: #E38D73; display: inline-block; padding: 12px 18px; border-radius: 14px; font-weight: bold; font-size: 20px; color: #1C1512;">🏠 LifeOS</div>
          <h2 style="color: #FAF6F0; font-size: 22px; margin-top: 16px; margin-bottom: 4px;">Password Reset Key</h2>
          <p style="color: #A69788; font-size: 13px; margin: 0;">Hello ${user.name}, you requested to reset your household login key.</p>
        </div>

        <div style="background-color: #251B17; border: 1px solid #382923; padding: 20px; border-radius: 14px; text-align: center; margin-bottom: 24px;">
          <span style="display: block; color: #A69788; font-size: 11px; text-transform: uppercase; tracking-wider: 1px; font-weight: bold; margin-bottom: 8px;">Your 6-Digit OTP Code</span>
          <span style="font-size: 32px; font-weight: 800; letter-spacing: 6px; color: #E38D73;">${otp}</span>
          <p style="color: #78695C; font-size: 11px; margin-top: 8px; margin-bottom: 0;">This key will expire in 15 minutes.</p>
        </div>

        <p style="color: #A69788; font-size: 12px; line-height: 1.5; text-align: center;">
          If you did not request a password reset, you can safely ignore this email.
        </p>
      </div>
    `;

    // 1. Try Resend API (Fast 200ms HTTPS REST API - Cloud Safe)
    const resendApiKey = process.env.RESEND_API_KEY;
    if (resendApiKey) {
      try {
        const resendRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendApiKey.trim()}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "LifeOS Household <onboarding@resend.dev>",
            to: [user.email],
            subject: `🔑 Your LifeOS Password Reset Key: ${otp}`,
            html: emailHtml,
          }),
        });

        if (resendRes.ok) {
          return res.status(200).json({
            message: `Reset OTP sent successfully to ${user.email}`,
            email: user.email,
          });
        } else {
          const resendErr = await resendRes.json();
          console.error("Resend API error response:", resendErr);
        }
      } catch (rErr) {
        console.error("Resend fetch error:", rErr);
      }
    }

    // 2. Fallback to Nodemailer SMTP
    const transporter = createTransporter();
    if (!transporter) {
      return res.status(500).json({
        error: "Email service configuration (RESEND_API_KEY or EMAIL_USER/EMAIL_PASS) is not configured on server.",
      });
    }

    const mailOptions = {
      from: `"LifeOS Household" <${process.env.EMAIL_USER || "no-reply@lifeos.dev"}>`,
      to: user.email,
      subject: `🔑 Your LifeOS Password Reset Key: ${otp}`,
      html: emailHtml,
    };

    await transporter.sendMail(mailOptions);

    return res.status(200).json({
      message: `Reset OTP sent successfully to ${user.email}`,
      email: user.email,
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    return res
      .status(500)
      .json({ error: error.message || "Failed to send reset email. Please try again." });
  }
};

exports.verifyOtp = async (req, res) => {
  try {
    const { emailOrNickname, otp } = req.body;
    if (!emailOrNickname || !otp) {
      return res.status(400).json({ error: "Email/Handle and OTP are required." });
    }

    const rawKey = emailOrNickname.trim().toLowerCase();
    const cleanHandle = rawKey.replace(/^@+/, "");
    const user = await User.findOne({
      $or: [
        { email: rawKey },
        { email: cleanHandle },
        { nickname: cleanHandle },
        { nickname: rawKey },
      ],
    });

    if (!user || !user.resetOtp || !user.resetOtpExpires) {
      return res.status(400).json({ error: "No active password reset request found." });
    }

    if (user.resetOtp !== otp.trim()) {
      return res.status(400).json({ error: "Invalid 6-digit OTP code." });
    }

    if (user.resetOtpExpires < new Date()) {
      return res.status(400).json({ error: "OTP code has expired. Please request a new key." });
    }

    return res.status(200).json({ message: "OTP verified successfully!" });
  } catch (error) {
    console.error("Verify OTP error:", error);
    return res.status(500).json({ error: "Failed to verify OTP." });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { emailOrNickname, otp, newPassword } = req.body;
    if (!emailOrNickname || !otp || !newPassword) {
      return res
        .status(400)
        .json({ error: "Email/Handle, OTP, and new password are required." });
    }

    if (newPassword.length < 4) {
      return res
        .status(400)
        .json({ error: "New password must be at least 4 characters." });
    }

    const rawKey = emailOrNickname.trim().toLowerCase();
    const cleanHandle = rawKey.replace(/^@+/, "");
    const user = await User.findOne({
      $or: [
        { email: rawKey },
        { email: cleanHandle },
        { nickname: cleanHandle },
        { nickname: rawKey },
      ],
    });

    if (!user || !user.resetOtp || !user.resetOtpExpires) {
      return res.status(400).json({ error: "No active password reset request found." });
    }

    if (user.resetOtp !== otp.trim()) {
      return res.status(400).json({ error: "Invalid 6-digit OTP code." });
    }

    if (user.resetOtpExpires < new Date()) {
      return res.status(400).json({ error: "OTP code has expired. Please request a new key." });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    user.password = hashedPassword;
    user.resetOtp = null;
    user.resetOtpExpires = null;
    await user.save();

    return res.status(200).json({
      message: "Password reset successful! You can now log in with your new key.",
    });
  } catch (error) {
    console.error("Reset password error:", error);
    return res.status(500).json({ error: "Failed to reset password." });
  }
};
