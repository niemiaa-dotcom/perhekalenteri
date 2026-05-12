import "dotenv/config";
import nodemailer from "nodemailer";

console.log("EMAIL_USER set:", !!process.env.EMAIL_USER);
console.log("EMAIL_PASS set:", !!process.env.EMAIL_PASS);

if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });

  transporter.verify(function(error, success) {
    if (error) {
      console.log("Verification error:", error);
    } else {
      console.log("Server is ready to take our messages");
    }
  });
} else {
  console.log("Missing credentials.");
}
