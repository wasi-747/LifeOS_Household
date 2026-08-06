const nodemailer = require("nodemailer");

async function testPort465() {
  console.log("Testing Port 465 SSL Nodemailer transport...");
  const user = "lifeos.household@gmail.com";
  const pass = "lqnzjlbbiaxyrvvz";

  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user, pass },
    tls: { rejectUnauthorized: false }
  });

  try {
    await transporter.verify();
    console.log("Port 465 SSL Verified!");
    const info = await transporter.sendMail({
      from: '"LifeOS Household" <lifeos.household@gmail.com>',
      to: "wasisakib7846@gmail.com",
      subject: "🔑 Port 465 SSL Test OTP: 999888",
      text: "Port 465 SSL Test OTP Code: 999888"
    });
    console.log("Port 465 SSL Email Sent! MessageId:", info.messageId);
  } catch (err) {
    console.error("Port 465 SSL Failed:", err);
  }
}

testPort465();
