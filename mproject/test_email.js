const nodemailer = require("nodemailer");

async function main() {
  console.log("⏳ Testing Gmail connection...");

  // Using the credentials from your server.js
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: "harinimuthukumar202@gmail.com",
      pass: "nepm fixr thrb rgzn", // Make sure this matches your generated App Password!
    },
  });

  try {
    const info = await transporter.sendMail({
      from: '"Test Service" <harinimuthukumar202@gmail.com>',
      to: "harinimuthukumar202@gmail.com", // Sending to yourself
      subject: "✅ Zero Hunger Email Test",
      text: "If you see this email, your App Password is working correctly!",
    });

    console.log("✅ SUCCESS: Email sent successfully!");
    console.log("Message ID:", info.messageId);
  } catch (error) {
    console.error("\n❌ FAILED: Could not send email.");
    console.error("Error Message:", error.message);
    
    if (error.response) {
      console.error("\nReason:", error.response);
      if (error.response.includes("535")) {
        console.error("\n💡 TIP: '535-5.7.8 Username and Password not accepted'");
        console.error("   1. Check if the email address is spelled correctly.");
        console.error("   2. Generate a NEW App Password from Google Account > Security.");
        console.error("   3. Ensure 2-Step Verification is ON.");
      }
    }
  }
}

main();
