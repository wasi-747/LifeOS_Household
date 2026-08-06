const nodemailer = require("nodemailer");

async function test() {
  console.log("Testing Nodemailer transport with lifeos.household@gmail.com...");
  
  const user = "lifeos.household@gmail.com";
  const pass = "lqnzjlbbiaxyrvvz";

  // Transporter 1: service gmail
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass }
  });

  try {
    console.log("Verifying Nodemailer connection...");
    await transporter.verify();
    console.log("SUCCESS! Transporter verified.");

    const info = await transporter.sendMail({
      from: '"LifeOS Household" <lifeos.household@gmail.com>',
      to: "wasisakib7846@gmail.com",
      subject: "🔑 Test LifeOS OTP Code: 123456",
      text: "Your test OTP code is 123456"
    });
    console.log("Email sent successfully! MessageId:", info.messageId);
  } catch (err) {
    console.error("Transporter 1 failed:", err);

    console.log("Retrying with Transporter 2 (smtp.gmail.com port 465)...");
    const transporter2 = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: { user, pass }
    });

    try {
      await transporter2.verify();
      console.log("SUCCESS on Transporter 2!");
      const info2 = await transporter2.sendMail({
        from: '"LifeOS Household" <lifeos.household@gmail.com>',
        to: "wasisakib7846@gmail.com",
        subject: "🔑 Test LifeOS OTP Code: 123456",
        text: "Your test OTP code is 123456"
      });
      console.log("Email sent successfully on Transporter 2! MessageId:", info2.messageId);
    } catch (err2) {
      console.error("Transporter 2 failed:", err2);
    }
  }
}

test();
