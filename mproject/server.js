const express = require("express");
const mysql = require("mysql2");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const multer = require("multer");
const bodyParser = require("body-parser");
const path = require("path");
const nodemailer = require("nodemailer");

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static("."));
app.use("/uploads", express.static("uploads"));

// Database Connection
const db = mysql.createConnection({
  host: "localhost",
  user: "root", // change if needed
  password: "", // your MySQL password
  database: "harvesthope",
});

db.connect((err) => {
  if (err) {
    console.error("❌ MySQL Connection Failed:", err.message);
    console.log("Server will continue without database connection.");
    return;
  }
  console.log("✅ MySQL Connected");
});

// File Upload Setup (Food Images)
const storage = multer.diskStorage({
  destination: "./uploads/",
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});
const upload = multer({ storage });

// ✅ User Registration
app.post("/register", async (req, res) => {
  const { name, email, phone, password, role } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);

  db.query(
    "INSERT INTO users (name, email, phone, password, role) VALUES (?, ?, ?, ?, ?)",
    [name, email, phone, hashedPassword, role || "donor"],
    (err, result) => {
      if (err) return res.status(500).json(err);
      res.json({ message: "User registered successfully!" });
    }
  );
});

// ✅ User Login
app.post("/login", (req, res) => {
  const { email, password } = req.body;
  db.query(
    "SELECT * FROM users WHERE email = ?",
    [email],
    async (err, result) => {
      if (err) return res.status(500).json({ error: "Database error" });
      if (result.length === 0)
        return res.status(401).json({ error: "User not found" });

      const user = result[0];
      const match = await bcrypt.compare(password, user.password);
      if (!match) return res.status(401).json({ error: "Invalid credentials" });

      const token = jwt.sign({ id: user.id, role: user.role }, "secret123", {
        expiresIn: "1d",
      });
      res.json({ message: "Login successful", token });
    }
  );
});

// ✅ Add Donation
app.post("/donate", upload.single("image"), (req, res) => {
  const { donor_id, food_type, details, quantity, expiry } = req.body;
  const image_url = req.file ? "/uploads/" + req.file.filename : null;

  db.query(
    "INSERT INTO donations (donor_id, food_type, details, quantity, expiry, image_url) VALUES (?, ?, ?, ?, ?, ?)",
    [donor_id, food_type, details, quantity, expiry, image_url],
    (err, result) => {
      if (err) return res.status(500).json(err);
      res.json({ message: "Donation submitted successfully!" });
    }
  );
});

// ✅ View Donations
app.get("/donations", (req, res) => {
  db.query(
    "SELECT donations.*, users.name AS donor_name FROM donations JOIN users ON donations.donor_id = users.id ORDER BY created_at DESC",
    (err, result) => {
      if (err) return res.status(500).json(err);
      res.json(result);
    }
  );
});

// ✅ Update Donation Status (Collector Page)
app.put("/donations/:id", (req, res) => {
  const { status } = req.body;
  db.query(
    "UPDATE donations SET status = ? WHERE id = ?",
    [status, req.params.id],
    (err, result) => {
      if (err) return res.status(500).json(err);
      res.json({ message: "Donation status updated!" });
    }
  );
});

// ✅ Submit Feedback
app.post("/feedback", (req, res) => {
  const { user_id, message, rating } = req.body;
  db.query(
    "INSERT INTO feedback (user_id, message, rating) VALUES (?, ?, ?)",
    [user_id, message, rating],
    (err, result) => {
      if (err) return res.status(500).json(err);
      res.json({ message: "Feedback submitted successfully!" });
    }
  );
});

// ✅ View Feedback (Admin Page)
app.get("/feedback", (req, res) => {
  db.query(
    "SELECT feedback.*, users.name FROM feedback JOIN users ON feedback.user_id = users.id ORDER BY created_at DESC",
    (err, result) => {
      if (err) return res.status(500).json(err);
      res.json(result);
    }
  );
});

// ✅ Notification Setup
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "",
    pass: "",
  },
});

// ✅ Send Donation Notification
app.post("/notify-donation", (req, res) => {
  const {
    donorName,
    foodDetails,
    foodQuantity,
    areaName,
    time,
    location,
    recipientEmails,
  } = req.body;

  let mapLink = "";
  if (location) {
    const latMatch = location.match(/Lat:\s*([-0-9.]+)/);
    const lngMatch = location.match(/Lng:\s*([-0-9.]+)/);
    if (latMatch && lngMatch) {
      mapLink = `https://www.google.com/maps?q=${latMatch[1]},${lngMatch[1]}`;
    }
  }

  // Helper to send email
  const sendEmail = (emails) => {
    if (!emails || emails.length === 0) {
      return res.json({ message: "No users to notify." });
    }

    const mailOptions = {
      from: '"Zero Hunger" <harinimuthukumar202@gmail.com>', // Updated with your email
      to: typeof emails === "string" ? emails : emails.join(","),
      subject: "🍱 New Food Donation Available!",
      html: `
        <h3>New Donation Alert! 🚨</h3>
        <p>A new food donation has just been posted.</p>
        <ul>
          <li><strong>Donor:</strong> ${donorName}</li>
          <li><strong>Food:</strong> ${foodType}</li>
          <li><strong>Quantity:</strong> ${foodQuantity}</li>
          <li><strong>Location:</strong> ${areaName}</li>
          <li><strong>Time:</strong> ${time}</li>
        </ul>
        ${
          mapLink
            ? `<p><a href="${mapLink}" style="background: #28a745; color: white; padding: 10px 15px; text-decoration: none; border-radius: 5px;">📍 View Live Location on Google Maps</a></p>`
            : ""
        }
        <p>Login to the app to view more details or claim this donation.</p>
        <br>
        <p><em>Thank you for supporting Zero Hunger! 💚</em></p>
      `,
    };

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.log("Error sending email:", error);
        return res.status(500).json({ error: "Failed to send email" });
      }
      console.log("Email sent: " + info.response);
      res.json({ message: "Notification sent successfully!" });
    });
  };

  // 1. Use Frontend provided emails if available (Preferred for LocalStorage users)
  if (recipientEmails && recipientEmails.length > 0) {
    console.log("Using recipient list from frontend:", recipientEmails);
    return sendEmail(recipientEmails);
  }

  // 2. Fallback: Get users from database
  console.log("Fetching users from database...");
  db.query("SELECT email FROM users", (err, result) => {
    if (err) {
      console.error(
        "Error fetching users from DB (Non-fatal if using frontend list):",
        err.message
      );
      // If DB fails but we have no frontend list, we can't do anything
      return res.status(500).json({
        error: "No recipients found and Database error: " + err.message,
      });
    }

    if (result.length === 0) {
      return res.json({ message: "No database users to notify." });
    }

    const emails = result.map((row) => row.email);
    sendEmail(emails);
  });
});

// ✅ Send Inventory Digest Email (triggered on Login)
app.post("/send-inventory-email", (req, res) => {
  const { email, foodList } = req.body;

  if (!foodList || foodList.length === 0) {
    return res.json({ message: "No food to notify about." });
  }

  const foodRows = foodList
    .map(
      (item) => `
    <tr>
      <td style="padding: 8px; border: 1px solid #ddd;">${item.donorName}</td>
      <td style="padding: 8px; border: 1px solid #ddd;">${item.foodType}</td>
      <td style="padding: 8px; border: 1px solid #ddd;">${item.foodQuantity}</td>
      <td style="padding: 8px; border: 1px solid #ddd;">${item.areaName}</td>
    </tr>`
    )
    .join("");

  const mailOptions = {
    from: '"Zero Hunger" <dharaniravi7280@gmail.com>',
    to: email,
    subject: "🍲 Available Food Donations - Login Digest",
    html: `
      <h3>Welcome back!</h3>
      <p>Here is the list of currently available food donations:</p>
      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr style="background-color: #0b3d2e; color: white;">
            <th style="padding: 8px; border: 1px solid #ddd;">Donor</th>
            <th style="padding: 8px; border: 1px solid #ddd;">Food</th>
            <th style="padding: 8px; border: 1px solid #ddd;">Qty</th>
            <th style="padding: 8px; border: 1px solid #ddd;">Location</th>
          </tr>
        </thead>
        <tbody>
          ${foodRows}
        </tbody>
      </table>
      <p>Visit the App to collect these!</p>
    `,
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.log("Error sending digest email:", error);
      return res.status(500).json({ error: "Failed to send email" });
    }
    console.log("Digest email sent to " + email);
    res.json({ message: "Digest email sent successfuly!" });
  });
});

// Start Server
app.listen(5000, () =>
  console.log("🚀 Server running on http://localhost:5000")
);
