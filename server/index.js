require('dotenv').config();
const express = require('express');
const cors = require('cors');        // ✅ Add CORS
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const http = require('http');
const socketIO = require('socket.io');
const storage = require('./storage');
const db = require('./db');
const avatarManager = require('./avatars');
const PaychanguPayment = require('./paychangu');
const cloudinary = require('cloudinary').v2;
const DiscussionSessionService = require('./services/DiscussionSessionService');
const ParticipantService = require('./services/ParticipantService');
const createDiscussionRoutes = require('./routes/discussionRoutes');
const { initializeDiscussionSocket } = require('./sockets/discussionSocket');

const app = express();
const PORT = process.env.PORT || 8787;

// Initialize Cloudinary for video/image storage
if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  });
  console.log('✅ Cloudinary storage initialized');
} else {
  console.warn('⚠️ Cloudinary credentials not set (CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET) — Video uploads will be disabled.');
}

// Initialize Paychangu payment processor
let paychangu = null;
if (process.env.PAYCHANGU_PUBLIC_KEY && process.env.PAYCHANGU_SECRET_KEY) {
  paychangu = new PaychanguPayment(
    process.env.PAYCHANGU_PUBLIC_KEY,
    process.env.PAYCHANGU_SECRET_KEY
  );
  console.log('✅ Paychangu payment processor initialized');
} else {
  console.warn('⚠️ PAYCHANGU_PUBLIC_KEY and/or PAYCHANGU_SECRET_KEY not set — Payment endpoints will be disabled.');
}

// Global error handlers
process.on('uncaughtException', (err) => {
  console.error('❌ UNCAUGHT EXCEPTION:', err.message);
  console.error(err.stack);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ UNHANDLED REJECTION:', reason);
  console.error('Promise:', promise);
});

// --- User Database (simple JSON file) ---
const USERS_FILE = path.join(__dirname, 'users.json');

function loadUsers() { return storage.loadUsers(); }
function saveUsers(users) { return storage.saveUsers(users); }

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

// Helper function to authenticate using token from either admins or users table
function authenticateToken(token) {
  if (!token) return null;
  
  // Check superadmins first
  try {
    const admins = storage.loadAdmins();
    for (const admin of admins) {
      if (admin.token === token) {
        return {
          email: admin.email || admin.idNumber,
          name: admin.name || 'Super Admin',
          role: 'superadmin',
          idNumber: admin.idNumber
        };
      }
    }
  } catch (err) {
    console.warn('Error checking admins:', err.message);
  }
  
  // Check regular admin/instructor users
  try {
    const users = loadUsers();
    for (const [email, user] of Object.entries(users)) {
      if (user.token === token) {
        return {
          email,
          name: user.name || email,
          role: user.role || 'user'
        };
      }
    }
  } catch (err) {
    console.warn('Error checking users:', err.message);
  }
  
  return null;
}

function validatePasswordStrength(password) {
  const errors = [];
  
  if (password.length < 8) {
    errors.push('At least 8 characters');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('At least one uppercase letter (A-Z)');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('At least one lowercase letter (a-z)');
  }
  if (!/[0-9]/.test(password)) {
    errors.push('At least one number (0-9)');
  }
  if (!/[!@#$%^&*]/.test(password)) {
    errors.push('At least one special character (!@#$%^&*)');
  }
  
  return {
    isStrong: errors.length === 0,
    errors: errors
  };
}

// Session timeout configuration (30 minutes of inactivity)
const SESSION_TIMEOUT_MS = 30 * 60 * 1000;
const SESSION_CHECK_INTERVAL_MS = 5 * 60 * 1000; // Check every 5 minutes

// Track active sessions with last activity timestamp
const activeSessions = new Map(); // token -> { email, lastActivityAt, createdAt, ip }

function recordSessionActivity(token) {
  if (activeSessions.has(token)) {
    activeSessions.get(token).lastActivityAt = Date.now();
  }
}

function createSession(token, email, req) {
  const userIp = req.headers['x-forwarded-for'] || req.connection.remoteAddress || req.ip || 'unknown';
  activeSessions.set(token, {
    email: email,
    createdAt: Date.now(),
    lastActivityAt: Date.now(),
    ip: userIp
  });
}

function isSessionValid(token) {
  // Check if session is in active sessions map (normal operation)
  if (activeSessions.has(token)) {
    const session = activeSessions.get(token);
    const inactiveTime = Date.now() - session.lastActivityAt;
    return inactiveTime < SESSION_TIMEOUT_MS;
  }
  
  // Fallback: check if token exists in users.json (handles post-restart)
  // This allows users to stay logged in after server restart
  const users = loadUsers();
  for (const [email, user] of Object.entries(users)) {
    if (user && user.token === token) {
      // Session found in file-based storage, register it in memory for future checks
      recordSessionActivity(token);
      return true;
    }
  }
  
  // Token not found anywhere
  return false;
}

function getSessionInfo(token) {
  return activeSessions.get(token) || null;
}

function revokeSession(token) {
  activeSessions.delete(token);
  // Also add to revoked tokens for persistence
  try {
    const revoked = loadRevokedTokens();
    if (!revoked.includes(token)) {
      revoked.push(token);
      saveRevokedTokens(revoked);
    }
  } catch (e) {
    console.warn('Failed to revoke token:', e);
  }
}

// Periodic cleanup of expired sessions
setInterval(() => {
  const now = Date.now();
  for (const [token, session] of activeSessions.entries()) {
    const inactiveTime = now - session.lastActivityAt;
    if (inactiveTime > SESSION_TIMEOUT_MS) {
      console.log(`⏱️ Session expired for ${session.email} (inactive for ${Math.round(inactiveTime / 1000 / 60)} min)`);
      revokeSession(token);
    }
  }
}, SESSION_CHECK_INTERVAL_MS);

function escapeHtml(text) {
  if (!text) return '';
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return String(text).replace(/[&<>"']/g, m => map[m]);
}

// --- Email helper (uses SendGrid HTTP API or SMTP if configured) ---
let sendGridApiKey = null;
let mailTransporter = null;
let lastEmailAttempt = null;

// Check for SendGrid API key (preferred method, works on Render)
if (process.env.SENDGRID_API_KEY) {
  sendGridApiKey = process.env.SENDGRID_API_KEY.trim();
  console.log('✉️ SendGrid HTTP API configured (preferred method for Render)');
}

// Fallback to SMTP if SendGrid key not available
if (!sendGridApiKey && process.env.SMTP_HOST && process.env.SMTP_USER) {
  try {
    const nodemailer = require('nodemailer');
    // Helper to trim surrounding quotes if present (some .env editors include them)
    const unquote = (v) => {
      if (!v || typeof v !== 'string') return v;
      return v.replace(/^"|"$/g, '').trim();
    };

    const smtpHost = unquote(process.env.SMTP_HOST);
    const smtpPort = Number(unquote(process.env.SMTP_PORT)) || 587;
    const smtpSecure = smtpPort === 465 ? true : false;
    const smtpUser = unquote(process.env.SMTP_USER);
    const smtpPass = unquote(process.env.SMTP_PASS);
    const smtpFrom = unquote(process.env.SMTP_FROM) || smtpUser;
    
    console.log(`🔧 SMTP Configuration: host=${smtpHost}, port=${smtpPort}, secure=${smtpSecure}, user=${smtpUser ? smtpUser.substring(0, 3) + '***' : 'NOT SET'}`);
    
    mailTransporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure,
      requireTLS: smtpPort === 587,
      connectionUrl: null,
      auth: {
        user: smtpUser,
        pass: smtpPass
      },
      tls: {
        rejectUnauthorized: false
      },
      connectionTimeout: 10000,
      socketTimeout: 10000,
      pool: {
        maxConnections: 5,
        maxMessages: 100
      },
      logger: true,
      debug: true
    });
    
    mailTransporter.verify().then(() => {
      console.log('✉️ SMTP transporter verified and ready to send emails (host=%s port=%s secure=%s)', smtpHost, smtpPort, smtpSecure);
    }).catch((err) => {
      console.warn('⚠️ SMTP transporter verification failed. Emails may not send. Error:', err && err.message ? err.message : err);
    });
  } catch (err) {
    console.warn('nodemailer not available — email will be logged to console. Install nodemailer to enable SMTP sending.');
    mailTransporter = null;
  }
}

async function sendEmail(to, subject, text, html) {
  const attempt = { to, subject, text, html, ts: new Date().toISOString(), success: false, error: null };
  
  // Always log email content to console for debugging
  console.log(`📧 Email to ${to}: ${subject}`);
  console.log(`📧 Email content:\n${text}`);
  
  // Try SendGrid HTTP API first (works on Render)
  if (sendGridApiKey) {
    try {
      const fromEmail = process.env.SMTP_FROM || 'renewableenergyh@gmail.com';
      console.log(`📧 Attempting to send email via SendGrid HTTP API from ${fromEmail}...`);
      const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sendGridApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: to }] }],
          from: { email: fromEmail },
          subject: subject,
          content: [
            { type: 'text/plain', value: text },
            { type: 'text/html', value: html }
          ]
        })
      });
      
      if (response.ok) {
        attempt.success = true;
        attempt.info = { method: 'SendGrid HTTP API', status: response.status, from: fromEmail };
        lastEmailAttempt = attempt;
        console.log(`✅ Email sent successfully via SendGrid to ${to} from ${fromEmail}`);
        return true;
      } else {
        const errText = await response.text();
        throw new Error(`SendGrid HTTP API error: ${response.status} - ${errText}`);
      }
    } catch (err) {
      attempt.error = String(err && err.message ? err.message : err);
      lastEmailAttempt = attempt;
      console.error('❌ Error sending email via SendGrid HTTP API:', err.message);
      // Don't fall back to SMTP if SendGrid is configured but fails
      return false;
    }
  }
  
  // Fallback to SMTP if SendGrid not available
  if (mailTransporter) {
    try {
      console.log(`📧 Attempting to send email via SMTP...`);
      const info = await mailTransporter.sendMail({ 
        from: process.env.SMTP_FROM || process.env.SMTP_USER, 
        to, 
        subject, 
        text, 
        html 
      });
      attempt.success = true;
      attempt.info = info;
      lastEmailAttempt = attempt;
      console.log(`✅ Email sent successfully to ${to}`, info.messageId);
      return true;
    } catch (err) {
      attempt.error = String(err && err.message ? err.message : err);
      lastEmailAttempt = attempt;
      console.error('❌ Error sending email via SMTP:', err.message);
      console.error('❌ Full error:', err);
      return false;
    }
  }

  // Fallback: log to console
  console.log(`📧 No email provider configured, logging to console only`);
  attempt.success = true;
  attempt.info = { fallback: true };
  lastEmailAttempt = attempt;
  console.log(`📧 (Console fallback) Email logged for ${to}`);
  return true;
}

// --- Email templates ---
function buildVerificationEmail({ code, name, siteUrl }) {
  const displayName = name || 'Learner';
  const subject = 'Verify your email for Aubie RET Hub';
  const text = `Hello ${displayName},\n\nYour verification code is: ${code}\nThis code will expire in 15 minutes.\n\nIf you did not request this, please ignore this message.\n\nVisit: ${siteUrl}`;

  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;color:#222;background:#f6f8fb;padding:24px;">
    <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #e6e9ef;">
      <div style="padding:20px 24px;background:linear-gradient(90deg,#0b6fb7,#0b9ad6);color:#fff;">
        <h1 style="margin:0;font-size:20px;">Aubie RET Hub</h1>
        <p style="margin:4px 0 0 0;font-size:13px;opacity:0.95">Email Verification</p>
      </div>
      <div style="padding:24px;">
        <p style="margin:0 0 12px 0;font-size:15px;">Hello ${displayName},</p>
        <p style="margin:0 0 18px 0;color:#444;font-size:14px;line-height:1.4">Thank you for creating an account with Aubie RET Hub. To complete your registration, please use the verification code below. This helps us ensure the security of your account.</p>

        <div style="display:flex;align-items:center;justify-content:center;margin:18px 0;">
          <div style="background:#f4f7fb;border-radius:8px;padding:18px 24px;border:1px dashed #d6e4fb;text-align:center">
            <div style="font-size:20px;letter-spacing:2px;color:#0b6fb7;font-weight:700">${code}</div>
            <div style="font-size:12px;color:#6b7280;margin-top:6px">Valid for 15 minutes</div>
          </div>
        </div>

        <p style="margin:0 0 18px 0;color:#555;font-size:13px;">If the button below does not work, copy and paste the code into the verification form on the site.</p>

        <p style="margin:0 0 22px 0;text-align:center;">
          <a href="${siteUrl}/login.html" style="display:inline-block;padding:10px 18px;background:#0b6fb7;color:#fff;border-radius:6px;text-decoration:none;font-weight:600">Open Aubie RET Hub</a>
        </p>

        <p style="margin:0;font-size:12px;color:#888;">If you did not request this code, you can safely ignore this email.</p>
      </div>
      <div style="padding:12px 16px;border-top:1px solid #eef2f7;font-size:12px;color:#8892a0;text-align:center;background:#fbfdff">Aubie RET Hub — Learn renewable energy skills with practical modules.</div>
    </div>
  </div>
  `;

  return { subject, text, html };
}

function buildResetEmail({ code, name, siteUrl, email }) {
  function formatLocalPart(e) {
    if (!e || typeof e !== 'string') return '';
    const p = e.split('@')[0] || '';
    return p.replace(/[._]/g, ' ').split(' ').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' ');
  }
  const displayName = (name && name.trim()) ? name.trim() : (email ? formatLocalPart(email) : 'Learner');
  const subject = 'Password reset for Aubie RET Hub';
  const text = `Hello ${displayName},\n\nYour password reset code is: ${code}\nThis code will expire in 15 minutes.\nIf you did not request a password reset, please contact support.`;

  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;color:#222;background:#f6f8fb;padding:24px;">
    <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #e6e9ef;">
      <div style="padding:20px 24px;background:linear-gradient(90deg,#0b6fb7,#0b9ad6);color:#fff;">
        <h1 style="margin:0;font-size:20px;">Aubie RET Hub</h1>
        <p style="margin:4px 0 0 0;font-size:13px;opacity:0.95">Password Reset Request</p>
      </div>
      <div style="padding:24px;">
        <p style="margin:0 0 12px 0;font-size:15px;">Hello ${displayName},</p>
        <p style="margin:0 0 18px 0;color:#444;font-size:14px;line-height:1.4">We received a request to reset the password for your account. Use the verification code below to set a new password. This code will expire shortly.</p>

        <div style="display:flex;align-items:center;justify-content:center;margin:18px 0;">
          <div style="background:#fff7ed;border-radius:8px;padding:18px 24px;border:1px dashed #f5dcc6;text-align:center">
            <div style="font-size:20px;letter-spacing:2px;color:#d97706;font-weight:700">${code}</div>
            <div style="font-size:12px;color:#6b7280;margin-top:6px">Valid for 15 minutes</div>
          </div>
        </div>

        <p style="margin:0 0 18px 0;color:#555;font-size:13px;">If you did not request a password reset, please ignore this email or contact our support team if you have concerns.</p>

        <p style="margin:0 0 22px 0;text-align:center;">
          <a href="${siteUrl}/login.html" style="display:inline-block;padding:10px 18px;background:#0b6fb7;color:#fff;border-radius:6px;text-decoration:none;font-weight:600">Return to Aubie RET Hub</a>
        </p>

      </div>
      <div style="padding:12px 16px;border-top:1px solid #eef2f7;font-size:12px;color:#8892a0;text-align:center;background:#fbfdff">If you continue to experience issues, please reply to this email for assistance.</div>
    </div>
  </div>
  `;

  return { subject, text, html };
}

function buildPremiumConfirmationEmail({ name, email, siteUrl, planDetails }) {
  const displayName = (name && name.trim()) ? name.trim() : (email ? email.split('@')[0] : 'Learner');
  const subject = 'Premium Subscription Confirmed - Aubie RET Hub';
  
  const text = `Hello ${displayName},

Your premium subscription to Aubie RET Hub is now active!

Subscription Details:
- Plan: Premium Access
- Cost: MWK 16,000
- Valid: 1 month (30 days) from activation

You now have full access to:
✓ All premium modules (Solar, Wind, Hydro, Biomass, Geothermal)
✓ All video lessons and materials
✓ Advanced quizzes and progress tracking
✓ Projects and assignments
✓ Certificates and verification
✓ Aubie RET Assistant

To cancel your subscription at any time, visit: ${siteUrl}/billing.html

Note: No refunds are provided for cancellations, but you will retain access until the end of your subscription period.

If you have any questions, please contact our support team.`;

  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;color:#222;background:#f6f8fb;padding:24px;">
    <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #e6e9ef;">
      <div style="padding:20px 24px;background:linear-gradient(90deg,#4CAF50,#66BB6A);color:#fff;">
        <h1 style="margin:0;font-size:20px;">Aubie RET Hub</h1>
        <p style="margin:4px 0 0 0;font-size:13px;opacity:0.95">Premium Subscription Confirmed ✓</p>
      </div>
      <div style="padding:24px;">
        <p style="margin:0 0 12px 0;font-size:15px;">Hello ${displayName},</p>
        <p style="margin:0 0 18px 0;color:#444;font-size:14px;line-height:1.4">Your premium subscription to Aubie RET Hub is now active! You now have full access to all premium content and features.</p>

        <div style="background:#f0f7f0;border-radius:8px;padding:18px;margin:18px 0;border-left:4px solid #4CAF50;">
          <p style="margin:0 0 12px 0;font-weight:600;color:#2e7d32;font-size:14px;">✓ Subscription Activated</p>
          <p style="margin:0 0 8px 0;color:#555;font-size:13px;">
            <strong>Plan:</strong> Premium Access<br>
            <strong>Cost:</strong> MWK 16,000 / USD 8<br>
            <strong>Duration:</strong> 1 month (30 days) from activation<br>
            <strong>Renewal:</strong> Automatic (you will receive a reminder)
          </p>
        </div>

        <p style="margin:0 0 12px 0;font-weight:600;color:#333;font-size:14px;">You now have access to:</p>
        <ul style="margin:0 0 18px 0;padding-left:20px;color:#555;font-size:13px;">
          <li style="margin:6px 0;">✓ All premium modules (Solar, Wind, Hydro, Biomass, Geothermal)</li>
          <li style="margin:6px 0;">✓ Advanced quizzes and progress tracking</li>
          <li style="margin:6px 0;">✓ Projects and assignments</li>
          <li style="margin:6px 0;">✓ Certificates and verification</li>
          <li style="margin:6px 0;">✓ Aubie RET Assistant</li>
        </ul>

        <p style="margin:0 0 12px 0;color:#d32f2f;font-size:12px;background:#ffebee;padding:12px;border-radius:4px;border-left:3px solid #d32f2f;">
          <strong>Note:</strong> No refunds are provided for cancellations. You will retain access until the end of your subscription period.
        </p>

        <p style="margin:0 0 22px 0;text-align:center;">
          <a href="${siteUrl}/courses.html" style="display:inline-block;padding:10px 18px;background:#4CAF50;color:#fff;border-radius:6px;text-decoration:none;font-weight:600;margin-right:10px;">Explore Premium Courses</a>
          <a href="${siteUrl}/billing.html" style="display:inline-block;padding:10px 18px;background:#f5f5f5;color:#333;border-radius:6px;text-decoration:none;font-weight:600;border:1px solid #ddd;">Manage Subscription</a>
        </p>

        <hr style="border:none;border-top:1px solid #eee;margin:18px 0;" />
        <p style="margin:0 0 8px 0;color:#666;font-size:12px;">Need to cancel? You can manage your subscription anytime at:</p>
        <p style="margin:0 0 12px 0;color:#0b6fb7;font-size:12px;word-break:break-all;">${siteUrl}/billing.html</p>
      </div>
      <div style="padding:12px 16px;border-top:1px solid #eef2f7;font-size:12px;color:#8892a0;text-align:center;background:#fbfdff">Thank you for upgrading to premium! Enjoy your learning journey with Aubie RET Hub.</div>
    </div>
  </div>
  `;

  return { subject, text, html };
}

function buildPremiumCancellationEmail({ name, email, siteUrl }) {
  const displayName = (name && name.trim()) ? name.trim() : (email ? email.split('@')[0] : 'Learner');
  const subject = 'Premium Subscription Canceled - Aubie RET Hub';
  
  const text = `Hello ${displayName},

Your premium subscription to Aubie RET Hub has been canceled.

Your account has been downgraded to a free account. You will retain access to any premium content you've already unlocked until the end of your current billing period.

Free Account Features:
- Access to basic modules
- Limited quizzes
- Community support

To upgrade back to premium at any time, visit: ${siteUrl}/billing.html

If you have any questions or need assistance, please contact our support team.

Thank you for being part of Aubie RET Hub!`;

  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;color:#222;background:#f6f8fb;padding:24px;">
    <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #e6e9ef;">
      <div style="padding:20px 24px;background:linear-gradient(90deg,#f44336,#e57373);color:#fff;">
        <h1 style="margin:0;font-size:20px;">Aubie RET Hub</h1>
        <p style="margin:4px 0 0 0;font-size:13px;opacity:0.95">Premium Subscription Canceled</p>
      </div>
      <div style="padding:24px;">
        <p style="margin:0 0 12px 0;font-size:15px;">Hello ${displayName},</p>
        <p style="margin:0 0 18px 0;color:#444;font-size:14px;line-height:1.4">Your premium subscription to Aubie RET Hub has been successfully canceled. Your account has been downgraded to a free account.</p>
        
        <div style="background:#fff3e0;border-radius:8px;padding:18px;margin:18px 0;border-left:4px solid #ff9800;">
          <p style="margin:0 0 12px 0;font-weight:600;color:#e65100;font-size:14px;">⏰ Access Retained</p>
          <p style="margin:0 0 8px 0;color:#555;font-size:13px;">
            You will continue to have access to premium content until the end of your current billing period.
          </p>
        </div>

        <p style="margin:0 0 12px 0;font-weight:600;color:#333;font-size:14px;">Free Account Features:</p>
        <ul style="margin:0 0 18px 0;padding-left:20px;color:#555;font-size:13px;">
          <li style="margin:6px 0;">✓ Access to basic modules</li>
          <li style="margin:6px 0;">✓ Limited quizzes</li>
          <li style="margin:6px 0;">✓ Community support</li>
        </ul>

        <p style="margin:0 0 22px 0;text-align:center;">
          <a href="${siteUrl}/billing.html" style="display:inline-block;padding:10px 18px;background:#2196F3;color:#fff;border-radius:6px;text-decoration:none;font-weight:600;margin-right:10px;">Upgrade to Premium</a>
          <a href="${siteUrl}/courses.html" style="display:inline-block;padding:10px 18px;background:#f5f5f5;color:#333;border-radius:6px;text-decoration:none;font-weight:600;border:1px solid #ddd;">Explore Free Courses</a>
        </p>

        <hr style="border:none;border-top:1px solid #eee;margin:18px 0;" />
        <p style="margin:0 0 8px 0;color:#666;font-size:12px;">Questions or need help? Contact our support team.</p>
      </div>
      <div style="padding:12px 16px;border-top:1px solid #eef2f7;font-size:12px;color:#8892a0;text-align:center;background:#fbfdff">Thank you for being part of Aubie RET Hub. We hope to see you back soon!</div>
    </div>
  </div>
  `;

  return { subject, text, html };
}

// --- Middlewares ---
// Configure CORS for production and development
const corsOptions = {
  origin: function (origin, callback) {
    // List of allowed origins
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:8787',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:8787',
    ];
    
    // Add environment-based origins for deployment
    if (process.env.SITE_URL) {
      allowedOrigins.push(process.env.SITE_URL);
    }
    if (process.env.NODE_ENV === 'production' && process.env.SITE_URL) {
      // In production with SITE_URL set, be more restrictive
      // Allow the SITE_URL and subdomain variations
      const siteUrl = new URL(process.env.SITE_URL);
      allowedOrigins.push(siteUrl.origin);
    } else if (process.env.NODE_ENV === 'development') {
      // In development, allow all origins for easier testing
      return callback(null, true);
    }
    
    // If no origin header (same-origin requests), allow
    if (!origin) {
      return callback(null, true);
    }
    
    // Check if origin is in allowed list
    if (allowedOrigins.indexOf(origin) !== -1 || allowedOrigins.includes('*')) {
      callback(null, true);
    } else {
      // Log but still allow for same-origin requests and API proxying
      console.log(`⚠️  CORS request from ${origin} - allowing (may be proxied)`);
      callback(null, true);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
};

app.use(cors(corsOptions));         // ✅ Allow cross-origin requests with enhanced config
// Only parse JSON for normal API endpoints (allow larger payloads for file uploads)
app.use('/api', express.json({ limit: '10mb' }));

// Disable caching for HTML and JS files so updates are always fetched
app.use((req, res, next) => {
  if (req.url.endsWith('.html') || req.url.endsWith('.js') || req.url.endsWith('.css')) {
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
  }
  next();
});

// Serve static files from parent directory
app.use(express.static(path.join(__dirname, '..')));

// --- Initialize Discussion System Services ---
let discussionSessionService = null;
let participantService = null;

// Initialize discussion services after db is ready (deferred initialization)
// These will be properly initialized in startServer() when db.models are available
const initializeDiscussionServices = (ioInstance = null) => {
  if (db.models.DiscussionSession && db.models.Participant) {
    discussionSessionService = new DiscussionSessionService(db);
    participantService = new ParticipantService(db);
    console.log('✅ Discussion system services initialized');
    
    // Register discussion routes after services are initialized
    // Pass io instance if available (for broadcasting to clients)
    const discussionRoutes = createDiscussionRoutes(db, discussionSessionService, participantService, ioInstance);
    app.use('/api/discussions', discussionRoutes);
    console.log('✅ Discussion routes registered');
  }
};

// --- Multer Configuration for Video Uploads ---
// Create videos directory if it doesn't exist
// Use Render persistent disk on production, local disk in development
const VIDEOS_DIR = process.env.RENDER 
  ? '/opt/render/project/src/server/storage/videos'
  : path.join(__dirname, 'videos');
if (!fs.existsSync(VIDEOS_DIR)) {
  fs.mkdirSync(VIDEOS_DIR, { recursive: true });
}

// Configure multer for video uploads - use memory storage to get buffer for MongoDB
const videoUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 500 * 1024 * 1024 // 500MB max file size
  },
  fileFilter: (req, file, cb) => {
    // Allow common video formats
    const allowedMimes = ['video/mp4', 'video/mpeg', 'video/quicktime', 'video/webm', 'video/x-msvideo'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type. Allowed types: ${allowedMimes.join(', ')}`));
    }
  }
});

// --- Multer Configuration for Image Uploads ---
// Create images directory if it doesn't exist (persistent location)
const IMAGES_DIR = process.env.RENDER
  ? '/opt/render/project/src/server/storage/images'
  : path.join(__dirname, 'images');
if (!fs.existsSync(IMAGES_DIR)) {
  fs.mkdirSync(IMAGES_DIR, { recursive: true });
}

// Configure multer for image uploads - use memory storage to get buffer for MongoDB
const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB max file size for images
  },
  fileFilter: (req, file, cb) => {
    // Allow common image formats
    const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type. Allowed types: JPEG, PNG, GIF, WebP, SVG`));
    }
  }
});

// --- In-memory stores (avoid writing to disk for ephemeral codes)
// Keeps password reset codes in-memory to avoid touching users.json on request
const inMemoryResetCodes = {};

// Simple help storage (messages)
const HELP_FILE = path.join(__dirname, 'help.json');
const SESSIONS_FILE = path.join(__dirname, 'sessions.json');
const REVOKED_TOKENS_FILE = path.join(__dirname, 'revoked_tokens.json');

function loadHelp() { return storage.loadHelp(); }
function saveHelp(list) { return storage.saveHelp(list); }

function loadSessions() { return storage.loadSessions(); }
function saveSessions(sessions) { return storage.saveSessions(sessions); }

function loadRevokedTokens() { return storage.loadRevokedTokens(); }
function saveRevokedTokens(list) { return storage.saveRevokedTokens(list); }

// Deleted accounts tracking (prevent re-registration)
const DELETED_EMAILS_FILE = path.join(__dirname, 'deleted_emails.json');
function loadDeletedEmails() {
  try {
    if (fs.existsSync(DELETED_EMAILS_FILE)) {
      const data = fs.readFileSync(DELETED_EMAILS_FILE, 'utf-8');
      return JSON.parse(data) || [];
    }
  } catch (err) {
    console.warn('Failed to load deleted emails:', err.message);
  }
  return [];
}
function saveDeletedEmails(list) {
  try {
    fs.writeFileSync(DELETED_EMAILS_FILE, JSON.stringify(list || [], null, 2), 'utf-8');
  } catch (err) {
    console.warn('Failed to save deleted emails:', err.message);
  }
}

// Login activity tracking (audit log)
const LOGIN_ACTIVITY_FILE = path.join(__dirname, 'login_activity.json');
function loadLoginActivity() {
  try {
    if (fs.existsSync(LOGIN_ACTIVITY_FILE)) {
      const data = fs.readFileSync(LOGIN_ACTIVITY_FILE, 'utf-8');
      return JSON.parse(data) || [];
    }
  } catch (err) {
    console.warn('Failed to load login activity:', err.message);
  }
  return [];
}
function saveLoginActivity(activity) {
  try {
    fs.writeFileSync(LOGIN_ACTIVITY_FILE, JSON.stringify(activity || [], null, 2), 'utf-8');
  } catch (err) {
    console.warn('Failed to save login activity:', err.message);
  }
}
function recordLoginAttempt(email, success, ip, userAgent, reason = null) {
  try {
    const activity = loadLoginActivity();
    activity.push({
      email: email,
      success: success,
      timestamp: new Date().toISOString(),
      ip: ip,
      userAgent: userAgent,
      reason: reason // e.g., 'invalid_password', 'account_deleted', 'email_not_found'
    });
    // Keep only last 1000 login records
    if (activity.length > 1000) {
      activity.shift();
    }
    saveLoginActivity(activity);
  } catch (err) {
    console.warn('Failed to record login attempt:', err.message);
  }
}

// SSE clients for real-time updates
const sseClients = [];
const adminChatSSEClients = []; // Separate clients for admin chat updates

function notifyHelpUpdate() {
  try {
    // send a simple 'refresh' event to all SSE clients
    sseClients.forEach(res => {
      try {
        res.write('event: refresh\n');
        res.write('data: {}\n\n');
      } catch (e) { /* ignore client write errors */ }
    });
  } catch (e) { console.error('notifyHelpUpdate error', e); }
}

function notifyAdminChatUpdate() {
  try {
    // send a 'chatUpdated' event to all admin chat SSE clients
    adminChatSSEClients.forEach(res => {
      try {
        res.write('event: chatUpdated\n');
        res.write('data: {}\n\n');
      } catch (e) { /* ignore client write errors */ }
    });
  } catch (e) { console.error('notifyAdminChatUpdate error', e); }
}

// --- Admin Live Chat API ---
// Sessions are stored in sessions.json (simple file-backed store)
app.get('/api/admin/chat/sessions', (req, res) => {
  try {
    // Get help sessions which is where user messages go
    const sessions = loadSessions();
    const help = loadHelp();
    console.log('🔍 Admin fetching sessions. DB sessions:', Object.keys(sessions), 'Help messages:', help.length);
    
    // Build a map of sessions with their messages from help list
    const sessionMap = {};
    
    // First, add existing sessions and preserve their opened status
    for (const [id, session] of Object.entries(sessions || {})) {
      sessionMap[id] = {
        ...session,
        messages: [],
        opened: session.opened || false  // Explicitly preserve the opened property
      };
    }
    console.log('📊 Existing sessions in map:', Object.keys(sessionMap));
    
    // Attach messages to their sessions using sessionId as primary key
    (help || []).forEach((msg, idx) => {
      // Use sessionId as the primary session key (each session is unique)
      const sid = msg.sessionId || msg.userEmail || 'default';
      if (!sessionMap[sid]) {
        const sessionNum = Object.keys(sessionMap).length + 1;
        sessionMap[sid] = {
          id: sid,
          sessionId: sid,
          email: msg.userEmail || '',
          name: msg.userName || `Chat ${sessionNum}`,
          messages: [],
          status: 'open',
          opened: false,
          createdAt: new Date(msg.ts).toISOString(),
          updatedAt: new Date(msg.ts).toISOString()
        };
        console.log('📝 Created new session map entry for:', sid);
      }
      sessionMap[sid].messages.push({
        from: msg.from || 'User',
        text: msg.text,
        files: msg.files || [],
        role: msg.from === 'Admin' ? 'admin' : 'user',
        time: new Date(msg.ts).toISOString()
      });
      sessionMap[sid].updatedAt = new Date(msg.ts).toISOString();
    });
    
    console.log('📊 Returning', Object.keys(sessionMap).length, 'sessions:', Object.keys(sessionMap));
    res.json(sessionMap);
  } catch (err) {
    console.error('Error fetching chat sessions:', err);
    res.status(500).json({ error: 'Failed to load sessions' });
  }
});

app.get('/api/admin/chat/sessions/:id', (req, res) => {
  try {
    const sessions = loadSessions();
    const help = loadHelp();
    const id = req.params.id;
    
    const session = sessions[id] || { id, sessionId: id, email: id, name: `Chat`, messages: [], status: 'open', opened: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    // Filter messages by sessionId (unique per conversation)
    session.messages = (help || [])
      .filter(msg => String(msg.sessionId || msg.userEmail || 'default') === String(id))
      .map(msg => ({
        from: msg.from || 'User',
        text: msg.text,
        files: msg.files || [],
        role: msg.from === 'User' ? 'user' : 'admin',
        time: new Date(msg.ts).toISOString()
      }));
    
    console.log('📋 Fetching session:', id, 'Messages:', session.messages.length, 'Session:', session);
    res.json(session);
  } catch (err) {
    console.error('Error fetching session:', err);
    res.status(500).json({ error: 'Failed to load session' });
  }
});

app.post('/api/admin/chat/sessions/:id/reply', (req, res) => {
  try {
    const id = req.params.id;
    const { from, text } = req.body;
    if (!text) return res.status(400).json({ error: 'Message text required' });

    // Add to help messages (same storage as user messages)
    const help = loadHelp();
    const msg = { text: String(text), from: from || 'Admin', ts: Date.now(), sessionId: id, userEmail: id, role: 'admin' };
    help.push(msg);
    saveHelp(help);
    
    // Ensure session exists
    const sessions = loadSessions();
    if (!sessions[id]) {
      sessions[id] = { id, name: `User — ${id}`, messages: [], status: 'open', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    }
    sessions[id].updatedAt = new Date().toISOString();
    saveSessions(sessions);

    console.log('💬 Admin reply added to session', id, '- Message:', msg);
    return res.json({ success: true, message: { from: msg.from, text: msg.text, role: 'admin', time: new Date(msg.ts).toISOString() } });
  } catch (err) {
    console.error('Error posting reply:', err);
    res.status(500).json({ error: 'Failed to post reply' });
  }
});

app.post('/api/admin/chat/sessions/:id/terminate', (req, res) => {
  try {
    const id = req.params.id;
    const sessions = loadSessions();
    if (!sessions[id]) return res.status(404).json({ error: 'Session not found' });
    sessions[id].status = 'terminated';
    sessions[id].updatedAt = new Date().toISOString();
    saveSessions(sessions);
    
    // Add system message to help messages so user sees the chat is closed
    const help = loadHelp();
    help.push({ 
      text: 'Chat closed by admin', 
      from: 'System', 
      ts: Date.now(), 
      files: [],
      sessionId: id
    });
    saveHelp(help);
    
    // Notify connected clients to refresh
    try { notifyHelpUpdate(); } catch (e) {}
    
    return res.json({ success: true });
  } catch (err) {
    console.error('Error terminating session:', err);
    res.status(500).json({ error: 'Failed to terminate session' });
  }
});

app.post('/api/admin/chat/sessions/:id/delete', async (req, res) => {
  try {
    const id = req.params.id;
    const sessions = loadSessions();
    const help = loadHelp();
    
    // Delete from sessions cache if it exists
    if (sessions[id]) {
      delete sessions[id];
      saveSessions(sessions);
    }
    
    // Always delete from help data (even if not in sessions cache)
    const filtered = help.filter(msg => (msg.sessionId || 'default') !== id);
    saveHelp(filtered);
    
    // Delete from MongoDB if available
    const { deleteOne } = require('./storage.js');
    await deleteOne('Session', { sessionId: id }).catch(err => console.warn('MongoDB delete warning:', err.message));
    
    // Delete from MongoDB help records if available
    const db = require('./db.js');
    if (db && db.models && db.models.Help) {
      try {
        await db.models.Help.deleteMany({ sessionId: id }).catch(err => console.warn('MongoDB help delete warning:', err.message));
      } catch(e) {
        console.warn('Delete help from MongoDB failed:', e.message);
      }
    }
    
    console.log('Deleted session', id, 'and all associated messages');
    return res.json({ success: true });
  } catch (err) {
    console.error('Error deleting session:', err);
    res.status(500).json({ error: 'Failed to delete session' });
  }
});

app.post('/api/admin/chat/sessions/:id/clear', (req, res) => {
  try {
    const id = req.params.id;
    const sessions = loadSessions();
    if (!sessions[id]) return res.status(404).json({ error: 'Session not found' });
    sessions[id].messages = [];
    sessions[id].updatedAt = new Date().toISOString();
    saveSessions(sessions);
    return res.json({ success: true });
  } catch (err) {
    console.error('Error clearing session:', err);
    res.status(500).json({ error: 'Failed to clear session' });
  }
});

app.post('/api/admin/chat/sessions', (req, res) => {
  try {
    const { name } = req.body;
    const sessions = loadSessions();
    const id = 's_' + crypto.randomBytes(6).toString('hex');
    sessions[id] = {
      id,
      name: name || `User — ${id}`,
      messages: [],
      status: 'open',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    saveSessions(sessions);
    res.status(201).json(sessions[id]);
  } catch (err) {
    console.error('Error creating session:', err);
    res.status(500).json({ error: 'Failed to create session' });
  }
});

// Clear/reload chat caches (admin only - for testing/maintenance)
app.post('/api/admin/chat/clear-cache', (req, res) => {
  try {
    storage.reloadCaches();
    res.json({ success: true, message: 'Chat cache reloaded from files' });
  } catch (err) {
    console.error('Error reloading cache:', err);
    res.status(500).json({ error: 'Failed to reload cache' });
  }
});

// Complete clear of all chats (deletes from files and MongoDB)
app.post('/api/admin/chat/clear-all', async (req, res) => {
  try {
    // Clear from files
    const storage = require('./storage.js');
    storage.saveHelp([]);
    storage.saveSessions({});
    
    // Clear from MongoDB if available
    const db = require('./db.js');
    if (db && db.models) {
      if (db.models.Help) await db.models.Help.deleteMany({}).catch(e => console.warn('MongoDB Help clear warning:', e.message));
      if (db.models.Session) await db.models.Session.deleteMany({}).catch(e => console.warn('MongoDB Session clear warning:', e.message));
    }
    
    console.log('✅ All chats cleared completely');
    res.json({ success: true, message: 'All chats cleared from files and database' });
  } catch (err) {
    console.error('Error clearing all chats:', err);
    res.status(500).json({ error: 'Failed to clear chats' });
  }
});

// --- Admin Users API ---
app.get('/api/admin/users', (req, res) => {
  try {
    // Only allow authenticated admins/instructors to fetch users
    const callerToken = req.headers.authorization?.split(' ')[1] || req.headers['x-admin-token'];
    const caller = getRoleFromToken(callerToken);
    if (!caller) return res.status(401).json({ error: 'Unauthorized' });
    
    const users = loadUsers();
    // return array for convenience
    res.json(Object.values(users));
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).json({ error: 'Failed to load users' });
  }
});

// Return active token status for all users (admin only)
app.get('/api/admin/users/status', (req, res) => {
  try {
    const users = loadUsers();
    const revoked = loadRevokedTokens();
    const statusMap = {};
    Object.keys(users).forEach(email => {
      const t = users[email].token;
      statusMap[email] = !!(t && !revoked.includes(t));
    });
    res.json(statusMap);
  } catch (err) {
    console.error('Error building users status:', err);
    res.status(500).json({ error: 'Failed to compute user status' });
  }
});

app.post('/api/admin/users', (req, res) => {
  try {
    const { name, email, password, role, secret } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required' });
    if (!password) return res.status(400).json({ error: 'Password required' });
    if (role === 'admin' && (!secret || String(secret).length < 8)) return res.status(400).json({ error: 'Secret required for admin (min 8 characters)' });
    
    // Auth: ensure caller has permission to create this role
    const callerToken = req.headers.authorization?.split(' ')[1] || req.headers['x-admin-token'];
    const caller = getRoleFromToken(callerToken);
    if (role === 'admin' && (!caller || caller.role !== 'superadmin')) return res.status(403).json({ error: 'Only Super Admin may create Admin users' });

    const users = loadUsers();
    if (users[email]) return res.status(409).json({ error: 'User already exists' });
    
    users[email] = {
      name: name || '',
      email,
      password: hashPassword(password),
      role: role || 'student',
      secret: role === 'admin' ? hashPassword(secret) : undefined,
      hasPremium: false,
      token: generateToken(),
      createdAt: new Date().toISOString()
    };
    
    saveUsers(users);
    
    // Return user data without password hash
    const userResponse = { ...users[email] };
    delete userResponse.password;
    
    res.status(201).json({ success: true, user: userResponse });
  } catch (err) {
    console.error('Error creating user:', err);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

app.delete('/api/admin/users/:email', async (req, res) => {
  console.log(`Attempting to delete user: ${req.params.email}`);
  try {
    const email = req.params.email;
    const users = loadUsers();
    console.log(`Users in cache before deletion: ${Object.keys(users).length}`);
    if (!users[email]) {
      console.log(`User ${email} not found in cache`);
      return res.status(404).json({ error: 'User not found' });
    }
    // Prevent non-superadmins from deleting admin users
    const callerToken = req.headers.authorization?.split(' ')[1] || req.headers['x-admin-token'];
    const caller = getRoleFromToken(callerToken);
    if (users[email].role === 'admin' && (!caller || caller.role !== 'superadmin')) {
      return res.status(403).json({ error: 'Only Super Admin may delete Admin users' });
    }
    // If the user had an active token, revoke it so any logged-in sessions are invalidated
    try {
      const token = users[email].token;
      if (token) {
        const revoked = loadRevokedTokens();
        if (!revoked.includes(token)) {
          revoked.push(token);
          saveRevokedTokens(revoked);
        }
      }
    } catch (e) { console.warn('Could not revoke token for deleted user', e); }

    // Also try to terminate any related chat/help sessions that reference this user's email
    try {
      const sessions = loadSessions();
      let mutated = false;
      Object.keys(sessions).forEach(k => {
        const s = sessions[k];
        // look for common email fields and terminate/mark inactive
        if (s && (s.email === email || s.ownerEmail === email || s.userEmail === email || s.owner === email || s.user === email)) {
          s.status = 'terminated';
          s.active = false;
          s.updatedAt = new Date().toISOString();
          mutated = true;
        }
      });
      if (mutated) saveSessions(sessions);
    } catch (e) { console.warn('Could not update sessions for deleted user', e); }

    // Finally remove user entry
    delete users[email];
    console.log(`User ${email} deleted from cache. Users left: ${Object.keys(users).length}`);
    saveUsers(users);

    // Also delete from DB if connected
    if (db.isConnected()) {
      try {
        console.log(`Deleting user ${email} from MongoDB...`);
        const result = await db.models.User.deleteOne({ email });
        console.log(`MongoDB deletion result:`, result);
      } catch (e) {
        console.warn('Could not delete user from DB', e);
      }
    } else {
      console.log('MongoDB not connected, skipping DB deletion');
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting user:', err);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// Admin: revoke (logout) a user's token without deleting the account
app.post('/api/admin/users/:email/logout', (req, res) => {
  try {
    const email = req.params.email;
    const users = loadUsers();
    const user = users[email];
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Prevent non-superadmins from forcing logout of admin users
    const callerToken = req.headers.authorization?.split(' ')[1] || req.headers['x-admin-token'];
    const caller = getRoleFromToken(callerToken);
    if (user.role === 'admin' && (!caller || caller.role !== 'superadmin')) {
      return res.status(403).json({ error: 'Only Super Admin may manage Admin users' });
    }

    const token = user.token;
    if (token) {
      const revoked = loadRevokedTokens();
      if (!revoked.includes(token)) {
        revoked.push(token);
        saveRevokedTokens(revoked);
      }
    }

    // terminate sessions referencing this user
    try {
      const sessions = loadSessions();
      let mutated = false;
      Object.keys(sessions).forEach(k => {
        const s = sessions[k];
        if (s && (s.email === email || s.ownerEmail === email || s.userEmail === email || s.owner === email || s.user === email)) {
          s.status = 'terminated';
          s.active = false;
          s.updatedAt = new Date().toISOString();
          mutated = true;
        }
      });
      if (mutated) saveSessions(sessions);
    } catch (e) { console.warn('Could not update sessions for logout', e); }

    res.json({ success: true });
  } catch (err) {
    console.error('Error logging out user:', err);
    res.status(500).json({ error: 'Failed to logout user' });
  }
});

// --- Courses API (reads from ../data/courses.json) ---
const COURSES_FILE = path.join(__dirname, '..', 'data', 'courses.json');
function loadCourses() { return storage.loadCourses() || []; }
function saveCourses(list) { return storage.saveCourses(list); }

/**
 * Create a notification for a user
 */
async function createNotification(userEmail, { type, title, message, icon, actionUrl, data }) {
  try {
    console.log(`📨 Creating notification for ${userEmail}, type: ${type}`);
    const Notification = db.models.Notification;
    if (!Notification) {
      console.warn('⚠️ Notification model not available, creating in fallback storage');
      // Fallback: store in memory/json if MongoDB model not available
      try {
        const notif = {
          userEmail,
          type,
          title,
          message,
          icon,
          actionUrl,
          data,
          read: false,
          deleted: false,
          createdAt: new Date().toISOString()
        };
        const result = await storage.insertOne('Notification', notif);
        console.log(`✅ Notification created in fallback storage: ${result._id || result.id}`);
        return result;
      } catch (fallbackErr) {
        console.error('❌ Fallback notification creation failed:', fallbackErr);
        return null;
      }
    }
    
    const notification = new Notification({
      userEmail,
      type,
      title,
      message,
      icon,
      actionUrl,
      data,
      read: false,
      deleted: false,
      createdAt: new Date()
    });
    
    const result = await notification.save();
    console.log(`✅ Notification created: ${result._id}`);
    return result;
  } catch (err) {
    console.error('❌ Error creating notification:', err.message || err);
    return null;
  }
}

app.get('/api/admin/courses', (req, res) => {
  try {
    const courses = loadCourses();
    res.json(courses || []);
  } catch (err) {
    console.error('Error fetching courses:', err);
    res.status(500).json({ error: 'Failed to load courses' });
  }
});

// Public courses endpoint used by the frontend
app.get('/api/courses', (req, res) => {
  try {
    const courses = loadCourses();
    res.json(courses || []);
  } catch (err) {
    console.error('Error fetching public courses:', err);
    res.status(500).json({ error: 'Failed to load courses' });
  }
});

app.post('/api/admin/courses', (req, res) => {
  try {
    const { title, slug, description, image, category } = req.body || {};
    if (!title || !slug) return res.status(400).json({ error: 'Title and slug required' });
    const courses = loadCourses();
    const id = crypto.randomBytes(6).toString('hex');
    const course = {
      id,
      title,
      slug,
      category: category || '',
      description: description || '',
      image: image || '',
      createdAt: new Date().toISOString()
    };
    courses.push(course);
    saveCourses(courses);

    // Ensure modules directory exists for this course so modules can be added
    const courseModulesDir = path.join(MODULES_BASE, id);
    if (!fs.existsSync(courseModulesDir)) {
      try {
        fs.mkdirSync(courseModulesDir, { recursive: true });
        console.log(`Created modules directory for course: ${id}`);
      } catch (dirErr) {
        console.warn(`Warning: could not create modules dir for course ${id}:`, dirErr && dirErr.message ? dirErr.message : dirErr);
      }
    }

    // Notify all users about the new course
    (async () => {
      try {
        const users = loadUsers();
        const userArray = Object.values(users || {});
        for (const user of userArray) {
          await createNotification(user.email, {
            type: 'course',
            title: '📚 New Course Available!',
            message: `${title} - Learn about renewable energy!`,
            icon: 'fa-book',
            actionUrl: `/courses.html`,
            data: {
              courseId: id,
              courseSlug: slug,
              courseName: title
            }
          });
        }
      } catch (notifErr) {
        console.warn('Failed to notify users about new course:', notifErr);
      }
    })();

    res.status(201).json(course);
  } catch (err) {
    console.error('Error creating course:', err);
    res.status(500).json({ error: 'Failed to create course' });
  }
});

app.put('/api/admin/courses/:id', (req, res) => {
  try {
    const id = req.params.id;
    const { title, slug, description, image, category } = req.body || {};
    if (!title || !slug) return res.status(400).json({ error: 'Title and slug required' });
    
    let courses = loadCourses();
    const courseIndex = courses.findIndex(c => String(c.id) === String(id));
    if (courseIndex === -1) return res.status(404).json({ error: 'Course not found' });
    
    courses[courseIndex] = {
      ...courses[courseIndex],
      title,
      slug,
      category: category || '',
      description: description || '',
      image: image || '',
      updatedAt: new Date().toISOString()
    };
    
    saveCourses(courses);
    res.json(courses[courseIndex]);
  } catch (err) {
    console.error('Error updating course:', err);
    res.status(500).json({ error: 'Failed to update course' });
  }
});

app.delete('/api/admin/courses/:id', (req, res) => {
  try {
    const id = req.params.id;
    let courses = loadCourses();
    const before = courses.length;
    courses = courses.filter(c => String(c.id) !== String(id));
    if (courses.length === before) return res.status(404).json({ error: 'Course not found' });
    saveCourses(courses);
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting course:', err);
    res.status(500).json({ error: 'Failed to delete course' });
  }
});

// Reorder courses endpoint
app.post('/api/admin/courses/reorder', (req, res) => {
  try {
    const { courses } = req.body || {};
    if (!Array.isArray(courses)) return res.status(400).json({ error: 'Courses array required' });
    
    // Validate that all courses have required fields
    const valid = courses.every(c => c.id && c.title && c.slug);
    if (!valid) return res.status(400).json({ error: 'Invalid course data' });
    
    // Save reordered list
    saveCourses(courses);
    res.json({ success: true, courses });
  } catch (err) {
    console.error('Error reordering courses:', err);
    res.status(500).json({ error: 'Failed to reorder courses' });
  }
});

// --- Pending Courses API (staged for deploy) ---
const PENDING_COURSES_FILE = path.join(__dirname, '..', 'data', 'pending_courses.json');
function loadPendingCourses() { return storage.loadPendingCourses ? storage.loadPendingCourses() : (() => { try { return JSON.parse(fs.readFileSync(PENDING_COURSES_FILE, 'utf8')); } catch(e) { return []; } })(); }
function savePendingCourses(list) { fs.writeFileSync(PENDING_COURSES_FILE, JSON.stringify(list, null, 2)); }

app.get('/api/pending-courses', (req, res) => {
  try {
    const courses = loadPendingCourses();
    res.json(courses || []);
  } catch (err) {
    console.error('Error fetching pending courses:', err);
    res.status(500).json({ error: 'Failed to load pending courses' });
  }
});

app.post('/api/pending-courses', (req, res) => {
  try {
    const { title, slug, description, image, category, courseId, isNew } = req.body || {};
    if (!title || !slug) return res.status(400).json({ error: 'Title and slug required' });
    const pending = loadPendingCourses();
    const id = isNew ? courseId || crypto.randomBytes(6).toString('hex') : courseId;
    const entry = {
      id,
      title,
      slug,
      category: category || '',
      description: description || '',
      image: image || '',
      isNew: !!isNew,
      createdAt: new Date().toISOString()
    };
    const index = pending.findIndex(c => c.id === id);
    if (index >= 0) pending[index] = entry;
    else pending.push(entry);
    savePendingCourses(pending);
    res.json(entry);
  } catch (err) {
    console.error('Error saving pending course:', err);
    res.status(500).json({ error: 'Failed to save pending course' });
  }
});

app.post('/api/pending-courses/:id/deploy', (req, res) => {
  try {
    const id = req.params.id;
    let pending = loadPendingCourses();
    const index = pending.findIndex(c => c.id === id);
    if (index === -1) return res.status(404).json({ error: 'Pending course not found' });
    const pendingCourse = pending[index];
    let courses = loadCourses();
    const courseIndex = courses.findIndex(c => c.id === id);
    if (pendingCourse.isNew || courseIndex === -1) {
      courses.push({
        id: pendingCourse.id,
        title: pendingCourse.title,
        slug: pendingCourse.slug,
        category: pendingCourse.category,
        description: pendingCourse.description,
        image: pendingCourse.image,
        createdAt: new Date().toISOString()
      });
    } else {
      courses[courseIndex] = {
        ...courses[courseIndex],
        title: pendingCourse.title,
        slug: pendingCourse.slug,
        category: pendingCourse.category,
        description: pendingCourse.description,
        image: pendingCourse.image,
        updatedAt: new Date().toISOString()
      };
    }
    saveCourses(courses);
    
    // Deploy all pending modules for this course
    try {
      const pendingModulesPath = path.join(PENDING_MODULES_BASE, id);
      const pendingModulesIndexPath = path.join(pendingModulesPath, 'index.json');
      if (fs.existsSync(pendingModulesIndexPath)) {
        const pendingModulesList = JSON.parse(fs.readFileSync(pendingModulesIndexPath, 'utf8')) || [];
        const deployedModulesPath = path.join(MODULES_BASE, id);
        if (!fs.existsSync(deployedModulesPath)) fs.mkdirSync(deployedModulesPath, { recursive: true });
        const deployedModulesIndexPath = path.join(deployedModulesPath, 'index.json');
        let deployedModules = [];
        if (fs.existsSync(deployedModulesIndexPath)) {
          try { deployedModules = JSON.parse(fs.readFileSync(deployedModulesIndexPath, 'utf8')) || []; } catch(e) { }
        }
        
        // Merge pending modules into deployed modules
        for (const pModule of pendingModulesList) {
          const existingIdx = deployedModules.findIndex(m => m.file === pModule.file);
          const moduleEntry = {
            id: pModule.id || (String(pModule.file).split('.').slice(0,-1).join('.')||pModule.file).replace(/[^a-zA-Z0-9\-]/g,'-').toLowerCase(),
            title: pModule.title,
            category: pModule.category || undefined,
            tag: pModule.tag || '',
            isPremium: !!pModule.isPremium,
            video: pModule.video || undefined,
            content: pModule.file,
            file: pModule.file,
            createdAt: pModule.createdAt || new Date().toISOString()
          };
          if (existingIdx >= 0) {
            deployedModules[existingIdx] = { ...deployedModules[existingIdx], ...moduleEntry };
          } else {
            deployedModules.push(moduleEntry);
          }
        }
        fs.writeFileSync(deployedModulesIndexPath, JSON.stringify(deployedModules, null, 2));
        
        // Also save to MongoDB
        try {
          const dbModules = storage.loadModules(id) || [];
          for (const pModule of pendingModulesList) {
            const existingIdx = dbModules.findIndex(m => m.file === pModule.file);
            const moduleEntry = {
              id: pModule.id || (String(pModule.file).split('.').slice(0,-1).join('.')||pModule.file).replace(/[^a-zA-Z0-9\-]/g,'-').toLowerCase(),
              title: pModule.title,
              category: pModule.category || undefined,
              tag: pModule.tag || '',
              isPremium: !!pModule.isPremium,
              video: pModule.video || undefined,
              content: pModule.file,
              file: pModule.file,
              createdAt: pModule.createdAt || new Date().toISOString()
            };
            if (existingIdx >= 0) {
              dbModules[existingIdx] = { ...dbModules[existingIdx], ...moduleEntry };
            } else {
              dbModules.push(moduleEntry);
            }
          }
          storage.saveModules(id, dbModules);
          console.log(`✅ Deployed ${pendingModulesList.length} modules to live course: ${id}`);
        } catch (dbErr) {
          console.warn(`⚠️ Warning: Failed to save modules to MongoDB during deploy:`, dbErr);
        }
      }
    } catch (moduleErr) {
      console.warn(`⚠️ Warning: Failed to deploy pending modules for course ${id}:`, moduleErr);
    }
    
    // Deploy all pending content for this course
    try {
      const pendingContentPath = path.join(PENDING_CONTENT_BASE, id);
      const pendingContentIndexPath = path.join(pendingContentPath, 'index.json');
      const deployedModulesPath = path.join(MODULES_BASE, id);
      if (!fs.existsSync(deployedModulesPath)) fs.mkdirSync(deployedModulesPath, { recursive: true });
      
      let pendingContentList = [];
      
      // Try to load from index.json if it exists
      if (fs.existsSync(pendingContentIndexPath)) {
        try {
          pendingContentList = JSON.parse(fs.readFileSync(pendingContentIndexPath, 'utf8')) || [];
        } catch(e) {
          console.warn(`Warning: Could not parse pending content index for ${id}`);
        }
      }
      
      // Also check for any files in the pending content directory that might not be in the index
      if (fs.existsSync(pendingContentPath)) {
        const files = fs.readdirSync(pendingContentPath).filter(f => f !== 'index.json' && fs.statSync(path.join(pendingContentPath, f)).isFile());
        for (const file of files) {
          if (!pendingContentList.find(p => p.file === file)) {
            pendingContentList.push({ file, title: file, courseId: id, createdAt: new Date().toISOString() });
            console.log(`📋 Found untracked pending content file: ${file}`);
          }
        }
      }
      
      // Copy all pending content files to deployed modules directory
      if (pendingContentList.length > 0) {
        for (const pContent of pendingContentList) {
          const pendingFile = path.join(pendingContentPath, pContent.file);
          const deployedFile = path.join(deployedModulesPath, pContent.file);
          if (fs.existsSync(pendingFile)) {
            const content = fs.readFileSync(pendingFile, 'utf8');
            fs.writeFileSync(deployedFile, content);
            console.log(`✅ Copied pending content: ${pContent.file}`);
          } else {
            console.warn(`⚠️ Pending content file not found: ${pendingFile}`);
          }
        }
        
        // Update the modules index to include markdown content
        const deployedModulesIndexPath = path.join(deployedModulesPath, 'index.json');
        let deployedModules = [];
        if (fs.existsSync(deployedModulesIndexPath)) {
          try { deployedModules = JSON.parse(fs.readFileSync(deployedModulesIndexPath, 'utf8')) || []; } catch(e) { }
        }
        // Ensure deployedModules is an array
        if (!Array.isArray(deployedModules)) deployedModules = [];
        
        // Update module entries with content reference and add markdownContent
        // Also CREATE new module entries for content files that don't have a module yet
        for (const pContent of pendingContentList) {
          const contentFile = path.join(deployedModulesPath, pContent.file);
          if (fs.existsSync(contentFile)) {
            const markdownContent = fs.readFileSync(contentFile, 'utf8');
            const existingIdx = deployedModules.findIndex(m => m.file === pContent.file || m.content === pContent.file);
            
            if (existingIdx >= 0) {
              // Update existing module entry
              deployedModules[existingIdx] = {
                ...deployedModules[existingIdx],
                content: pContent.file,
                file: pContent.file,
                markdownContent: markdownContent
              };
              console.log(`📝 Updated module with content: ${pContent.file}`);
            } else {
              // Create new module entry for orphaned content files
              const newModuleId = (String(pContent.file).split('.').slice(0,-1).join('.')||pContent.file).replace(/[^a-zA-Z0-9\-]/g,'-').toLowerCase();
              const newModuleEntry = {
                id: newModuleId,
                title: pContent.title || newModuleId,
                file: pContent.file,
                content: pContent.file,
                category: 'general',
                tag: '',
                isPremium: false,
                markdownContent: markdownContent,
                createdAt: new Date().toISOString()
              };
              deployedModules.push(newModuleEntry);
              console.log(`✅ Created new module from content file: ${pContent.file}`);
            }
          }
        }
        fs.writeFileSync(deployedModulesIndexPath, JSON.stringify(deployedModules, null, 2));
        
        // Also save to MongoDB asynchronously
        setImmediate(() => {
          try {
            let dbModules = storage.loadModules(id) || [];
            if (!Array.isArray(dbModules)) dbModules = [];
            
            for (const pContent of pendingContentList) {
              const existingIdx = dbModules.findIndex(m => m.file === pContent.file || m.content === pContent.file);
              const contentFile = path.join(deployedModulesPath, pContent.file);
              if (fs.existsSync(contentFile)) {
                const markdownContent = fs.readFileSync(contentFile, 'utf8');
                if (existingIdx >= 0) {
                  // Update existing module entry
                  dbModules[existingIdx] = {
                    ...dbModules[existingIdx],
                    markdownContent: markdownContent,
                    content: pContent.file,
                    file: pContent.file
                  };
                } else {
                  // Create new module entry for orphaned content files
                  const newModuleId = (String(pContent.file).split('.').slice(0,-1).join('.')||pContent.file).replace(/[^a-zA-Z0-9\-]/g,'-').toLowerCase();
                  const newModuleEntry = {
                    id: newModuleId,
                    title: pContent.title || newModuleId,
                    file: pContent.file,
                    content: pContent.file,
                    category: 'general',
                    tag: '',
                    isPremium: false,
                    markdownContent: markdownContent,
                    createdAt: new Date().toISOString()
                  };
                  dbModules.push(newModuleEntry);
                }
              }
            }
            storage.saveModules(id, dbModules);
            console.log(`✅ Deployed ${pendingContentList.length} content files to live course: ${id}`);
          } catch (dbErr) {
            console.warn(`⚠️ Storage warning (non-critical):`, dbErr.message || dbErr);
          }
        });
      }
    } catch (contentErr) {
      console.warn(`⚠️ Warning: Failed to deploy pending content for course ${id}:`, contentErr);
    }
    
    // Remove course from pending and clean up pending modules/content directories
    pending.splice(index, 1);
    savePendingCourses(pending);
    
    try {
      const pendingModulesPath = path.join(PENDING_MODULES_BASE, id);
      const pendingContentPath = path.join(PENDING_CONTENT_BASE, id);
      if (fs.existsSync(pendingModulesPath)) {
        fs.rmSync(pendingModulesPath, { recursive: true, force: true });
        console.log(`✅ Cleaned up pending modules directory for deployed course: ${id}`);
      }
      if (fs.existsSync(pendingContentPath)) {
        fs.rmSync(pendingContentPath, { recursive: true, force: true });
        console.log(`✅ Cleaned up pending content directory for deployed course: ${id}`);
      }
    } catch (cleanupErr) {
      console.warn(`⚠️ Warning: Failed to clean up pending directories for course ${id}:`, cleanupErr);
    }
    
    res.json({ success: true, deployed: courses[courseIndex] || courses[courses.length - 1] });
  } catch (err) {
    console.error('Error deploying pending course:', err);
    res.status(500).json({ error: 'Failed to deploy pending course' });
  }
});

app.delete('/api/pending-courses/:id', (req, res) => {
  try {
    const id = req.params.id;
    let pending = loadPendingCourses();
    pending = pending.filter(c => c.id !== id);
    savePendingCourses(pending);
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting pending course:', err);
    res.status(500).json({ error: 'Failed to delete pending course' });
  }
});

// --- Modules & Content API ---
const MODULES_BASE = path.join(__dirname, '..', 'data', 'modules');
// Pending content directory (staged markdown content changes awaiting deploy)
const PENDING_CONTENT_BASE = path.join(__dirname, '..', 'data', 'pending_content');
if (!fs.existsSync(PENDING_CONTENT_BASE)) fs.mkdirSync(PENDING_CONTENT_BASE, { recursive: true });
// Pending modules directory (staged module metadata changes awaiting deploy)
const PENDING_MODULES_BASE = path.join(__dirname, '..', 'data', 'pending_modules');
if (!fs.existsSync(PENDING_MODULES_BASE)) fs.mkdirSync(PENDING_MODULES_BASE, { recursive: true });

function moduleIndexPath(courseId) {
  return path.join(MODULES_BASE, String(courseId));
}

app.get('/api/modules/:courseId', (req, res) => {
  try {
    const courseId = req.params.courseId;
    let list = storage.loadModules(courseId);
    
    // Load markdown content from disk for each module
    const moduleDir = path.join(MODULES_BASE, courseId);
    if (fs.existsSync(moduleDir) && Array.isArray(list)) {
      list = list.map(module => {
        // If module has a file reference, try to load content from disk
        if (module.file && !module.markdownContent) {
          const contentPath = path.join(moduleDir, module.file);
          if (fs.existsSync(contentPath)) {
            try {
              const content = fs.readFileSync(contentPath, 'utf8');
              return { ...module, markdownContent: content };
            } catch (e) {
              console.warn(`Warning: could not load module content ${module.file}:`, e.message);
              return module;
            }
          }
        }
        return module;
      });
    }
    
    res.json(list || []);
  } catch (err) { console.error('Error reading modules', err); res.status(500).json({ error: 'Failed to load modules' }); }
});

app.get('/api/module-content/:courseId/:file', (req, res) => {
  try {
    const { courseId, file } = req.params;
    const list = storage.loadModules(courseId);
    const module = list.find(m => m.file === file || m.content === file);
    if (!module || !module.content) return res.status(404).json({ error: 'Not found' });
    res.type('text/plain').send(module.content);
  } catch (err) { console.error('Error reading module content', err); res.status(500).json({ error: 'Failed to load content' }); }
});

app.post('/api/modules/:courseId', (req, res) => {
  try {
    const courseId = req.params.courseId;
    console.log(`📝 POST /api/modules/${courseId}`, JSON.stringify(req.body || {}).substring(0, 150));
    
    const { id, title, category, file, tag, isPremium, quiz, projects, objectives, resources, content } = req.body || {};
    
    if (!title || !file) {
      console.warn(`  ❌ Missing title or file: title="${title}", file="${file}"`);
      return res.status(400).json({ error: 'Missing title or file' });
    }
    
    // basic filename sanitization
    if (!/^[a-zA-Z0-9_\-\.]+$/.test(file)) {
      console.warn(`  ❌ Invalid file name: "${file}"`);
      return res.status(400).json({ error: 'Invalid file name' });
    }
    
    const dir = path.join(MODULES_BASE, courseId);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`  📁 Created directory: ${dir}`);
    }
    
    const idxPath = path.join(dir, 'index.json');
    let list = storage.loadModules(courseId);
    
    // derive an id if not provided
    let derivedId = id;
    if (!derivedId) {
      derivedId = String(file).split('.').slice(0, -1).join('.') || String(file);
      derivedId = derivedId.replace(/[^a-zA-Z0-9\-]/g, '-').toLowerCase();
    }
    
    const entry = {
      id: derivedId,
      title,
      category: category || undefined,
      isPremium: !!isPremium,
      tag: tag || '',
      content: file,
      file: file
    };
    
    // Handle quiz: store data directly
    if (quiz) {
      if (Array.isArray(quiz)) {
        entry.quiz = quiz;
        console.log(`  ✅ Stored quiz data`);
      } else if (typeof quiz === 'string') {
        entry.quiz = quiz;
      }
    }

    // Handle projects: store data directly
    if (projects) {
      if (Array.isArray(projects)) {
        entry.projects = projects;
        console.log(`  ✅ Stored projects data`);
      } else if (typeof projects === 'string') {
        entry.projects = projects;
      }
    }
    
    // Handle resources: store data directly
    if (resources) {
      if (Array.isArray(resources)) {
        entry.resources = resources;
        console.log(`  ✅ Stored resources data`);
      } else if (typeof resources === 'string') {
        entry.resources = resources;
      }
    }
    
    // Handle objectives: store data directly
    if (objectives) {
      if (Array.isArray(objectives)) {
        entry.objectives = objectives;
        console.log(`  ✅ Stored objectives data`);
      } else if (typeof objectives === 'string') {
        entry.objectives = objectives;
      }
    }
    
    // Add createdAt timestamp
    entry.createdAt = new Date().toISOString();
    
    // replace existing entry with same file if present
    const existingIndex = list.findIndex(m => (m.content === file || m.file === file));
    if (existingIndex >= 0) {
      list[existingIndex] = { ...list[existingIndex], ...entry };
      console.log(`  🔄 Updated existing module at index ${existingIndex}`);
    } else {
      list.push(entry);
      console.log(`  ➕ Added new module`);
    }
    
    // Add content
    entry.content = content || `# ${title}\n\n`;
    
    storage.saveModules(courseId, list);
    console.log(`  ✅ Saved modules with ${list.length} modules for course ${courseId}`);

    // Notify users about the new module
    (async () => {
      try {
        const courses = loadCourses();
        const course = courses.find(c => c.id === courseId);
        const users = loadUsers();
        const userArray = Object.values(users || {});
        for (const user of userArray) {
          await createNotification(user.email, {
            type: 'module',
            title: '📖 New Module Available!',
            message: `${title} - Check out the latest lesson${course ? ` in ${course.title}` : ''}!`,
            icon: 'fa-graduation-cap',
            actionUrl: `/module.html?course=${courseId}&module=${entry.id}`,
            data: {
              courseId: courseId,
              courseSlug: course?.slug,
              courseName: course?.title,
              moduleTitle: title
            }
          });
        }
      } catch (notifErr) {
        console.warn('Failed to notify users about new module:', notifErr);
      }
    })();

    res.status(201).json(entry);
  } catch (err) {
    console.error(`  ❌ Error in POST /api/modules:`, err);
    console.error(`     Message: ${err && err.message ? err.message : err}`);
    console.error(`     Stack: ${err && err.stack ? err.stack : ''}`);
    res.status(500).json({ error: 'Failed to create module', details: err && err.message ? err.message : String(err) });
  }
});

// ==================== NEWS SYSTEM ROUTES ====================

// PUBLIC: Get all news (paginated, sorted by date)
app.get('/api/news', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    let currentUserId = null;

    // Get current user if authenticated
    if (token) {
      const users = loadUsers();
      for (const [email, user] of Object.entries(users)) {
        if (user.token === token) {
          currentUserId = email;
          break;
        }
      }
    }

    const db = require('./db.js');
    if (!db?.models?.News) {
      return res.status(503).json({ error: 'News service unavailable' });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;
    const sort = req.query.sort === 'oldest' ? 1 : -1;

    const news = await db.models.News.find({ published: true })
      .sort({ publishedAt: sort })
      .skip(skip)
      .limit(limit);

    const total = await db.models.News.countDocuments({ published: true });

    // Compute counts and userReaction for each article
    const newsWithCounts = news.map(article => {
      const data = article.toJSON ? article.toJSON() : article;

      // Ensure reactions object has correct format
      if (!data.reactions || typeof data.reactions !== 'object' || Array.isArray(data.reactions)) {
        data.reactions = {
          like: [],
          love: [],
          insightful: [],
          celebrate: []
        };
      }

      // Compute counts
      const counts = {
        like: (data.reactions.like || []).length,
        love: (data.reactions.love || []).length,
        insightful: (data.reactions.insightful || []).length,
        celebrate: (data.reactions.celebrate || []).length
      };

      // Determine user's current reaction
      let userReaction = null;
      if (currentUserId) {
        if ((data.reactions.like || []).includes(currentUserId)) userReaction = 'like';
        else if ((data.reactions.love || []).includes(currentUserId)) userReaction = 'love';
        else if ((data.reactions.insightful || []).includes(currentUserId)) userReaction = 'insightful';
        else if ((data.reactions.celebrate || []).includes(currentUserId)) userReaction = 'celebrate';
      }

      data.counts = counts;
      data.userReaction = userReaction;
      data.reactions = undefined; // Remove raw array from response

      return data;
    });

    res.json({
      news: newsWithCounts,
      total,
      page,
      pages: Math.ceil(total / limit)
    });
  } catch (err) {
    console.error('Error fetching news:', err);
    res.status(500).json({ error: 'Failed to load news' });
  }
});

// PUBLIC: Get single news article by slug
app.get('/api/news/:slug', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    let currentUserId = null;

    // Get current user if authenticated
    if (token) {
      const users = loadUsers();
      for (const [email, user] of Object.entries(users)) {
        if (user.token === token) {
          currentUserId = email;
          break;
        }
      }
    }

    const db = require('./db.js');
    if (!db?.models?.News) {
      return res.status(503).json({ error: 'News service unavailable' });
    }

    const news = await db.models.News.findOne({ slug: req.params.slug, published: true });
    if (!news) {
      return res.status(404).json({ error: 'News not found' });
    }

    // Ensure reactions object has correct format
    if (!news.reactions || typeof news.reactions !== 'object' || Array.isArray(news.reactions)) {
      news.reactions = {
        like: [],
        love: [],
        insightful: [],
        celebrate: []
      };
    }

    // Compute counts
    const counts = {
      like: (news.reactions.like || []).length,
      love: (news.reactions.love || []).length,
      insightful: (news.reactions.insightful || []).length,
      celebrate: (news.reactions.celebrate || []).length
    };

    // Determine user's current reaction
    let userReaction = null;
    if (currentUserId) {
      if ((news.reactions.like || []).includes(currentUserId)) userReaction = 'like';
      else if ((news.reactions.love || []).includes(currentUserId)) userReaction = 'love';
      else if ((news.reactions.insightful || []).includes(currentUserId)) userReaction = 'insightful';
      else if ((news.reactions.celebrate || []).includes(currentUserId)) userReaction = 'celebrate';
    }

    // Return news with computed metadata
    const newsData = news.toJSON ? news.toJSON() : news;
    newsData.counts = counts;
    newsData.userReaction = userReaction;
    newsData.reactions = undefined; // Remove raw array from response

    res.json(newsData);
  } catch (err) {
    console.error('Error fetching news:', err);
    res.status(500).json({ error: 'Failed to load news' });
  }
});

// AUTHENTICATED: React to a news article (like, love, insightful, celebrate)
app.post('/api/news/:newsId/react', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const users = loadUsers();
    let userId = null;
    for (const [email, user] of Object.entries(users)) {
      if (user.token === token) {
        userId = email;
        break;
      }
    }

    if (!userId) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const { reaction } = req.body;
    const validReactions = ['like', 'love', 'insightful', 'celebrate'];
    if (!validReactions.includes(reaction)) {
      return res.status(400).json({ error: 'Invalid reaction type' });
    }

    const db = require('./db.js');
    if (!db?.models?.News) {
      return res.status(503).json({ error: 'News service unavailable' });
    }

    const news = await db.models.News.findById(req.params.newsId);
    if (!news) {
      return res.status(404).json({ error: 'News not found' });
    }

    // Initialize reactions object if needed
    if (!news.reactions) {
      news.reactions = {
        like: [],
        love: [],
        insightful: [],
        celebrate: []
      };
    }

    // Remove user from all reaction arrays
    validReactions.forEach(type => {
      if (!news.reactions[type]) news.reactions[type] = [];
      news.reactions[type] = news.reactions[type].filter(id => id !== userId);
    });

    // Add user to selected reaction array
    if (!news.reactions[reaction]) news.reactions[reaction] = [];
    news.reactions[reaction].push(userId);

    await news.save();

    // Return reaction counts and user's current reaction
    const counts = {};
    validReactions.forEach(type => {
      counts[type] = news.reactions[type].length;
    });

    res.json({
      userReaction: reaction,
      counts
    });
  } catch (err) {
    console.error('Error reacting to news:', err);
    res.status(500).json({ error: 'Failed to process reaction' });
  }
});

// AUTHENTICATED: Remove reaction from a news article
app.delete('/api/news/:newsId/react', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const users = loadUsers();
    let userId = null;
    for (const [email, user] of Object.entries(users)) {
      if (user.token === token) {
        userId = email;
        break;
      }
    }

    if (!userId) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const db = require('./db.js');
    if (!db?.models?.News) {
      return res.status(503).json({ error: 'News service unavailable' });
    }

    const news = await db.models.News.findById(req.params.newsId);
    if (!news) {
      return res.status(404).json({ error: 'News not found' });
    }

    // Initialize reactions object if needed
    if (!news.reactions) {
      news.reactions = {
        like: [],
        love: [],
        insightful: [],
        celebrate: []
      };
    }

    // Remove user from all reaction arrays
    const validReactions = ['like', 'love', 'insightful', 'celebrate'];
    validReactions.forEach(type => {
      if (!news.reactions[type]) news.reactions[type] = [];
      news.reactions[type] = news.reactions[type].filter(id => id !== userId);
    });

    await news.save();

    // Return updated counts
    const counts = {};
    validReactions.forEach(type => {
      counts[type] = news.reactions[type].length;
    });

    res.json({
      userReaction: null,
      counts
    });
  } catch (err) {
    console.error('Error removing reaction:', err);
    res.status(500).json({ error: 'Failed to remove reaction' });
  }
});

// OLD ENDPOINTS (kept for backward compatibility, will be removed later)
app.post('/api/news/:id/like', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const users = loadUsers();
    let userId = null;
    for (const [email, user] of Object.entries(users)) {
      if (user.token === token) {
        userId = email;
        break;
      }
    }

    if (!userId) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const db = require('./db.js');
    if (!db?.models?.News) {
      return res.status(503).json({ error: 'News service unavailable' });
    }

    const news = await db.models.News.findById(req.params.id);
    if (!news) {
      return res.status(404).json({ error: 'News not found' });
    }

    // Migrate to new model if needed
    if (!news.reactions || typeof news.reactions !== 'object' || Array.isArray(news.reactions)) {
      news.reactions = {
        like: [],
        love: [],
        insightful: [],
        celebrate: []
      };
    }

    // Toggle like (using new model)
    if (!news.reactions.like) news.reactions.like = [];
    const likeIndex = news.reactions.like.indexOf(userId);
    if (likeIndex >= 0) {
      news.reactions.like.splice(likeIndex, 1);
    } else {
      news.reactions.like.push(userId);
    }

    await news.save();

    res.json({
      liked: likeIndex < 0,
      likeCount: news.reactions.like.length,
      counts: {
        like: news.reactions.like.length,
        love: (news.reactions.love || []).length,
        insightful: (news.reactions.insightful || []).length,
        celebrate: (news.reactions.celebrate || []).length
      }
    });
  } catch (err) {
    console.error('Error liking news:', err);
    res.status(500).json({ error: 'Failed to process like' });
  }
});

// AUTHENTICATED: React to a news article (OLD ENDPOINT)
app.post('/api/news/:id/react', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    console.log('😊 React endpoint called:', { id: req.params.id, token: token.substring(0, 20) + '...' });

    const users = loadUsers();
    let userId = null;
    for (const [email, user] of Object.entries(users)) {
      if (user.token === token) {
        userId = email;
        break;
      }
    }

    if (!userId) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const { type } = req.body;
    const validTypes = ['love', 'laugh', 'wow', 'sad', 'angry'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ error: 'Invalid reaction type' });
    }

    const db = require('./db.js');
    if (!db?.models?.News) {
      return res.status(503).json({ error: 'News service unavailable' });
    }

    const news = await db.models.News.findById(req.params.id);
    if (!news) {
      return res.status(404).json({ error: 'News not found' });
    }

    // Migrate old model to new model if needed
    if (!news.reactions || Array.isArray(news.reactions)) {
      news.reactions = {
        like: [],
        love: [],
        insightful: [],
        celebrate: []
      };
    }

    // Map old reaction types to new ones (for backward compat with old model)
    const typeMap = {
      'love': 'love',
      'laugh': 'celebrate',
      'wow': 'insightful',
      'sad': 'celebrate',
      'angry': 'celebrate'
    };
    const mappedType = typeMap[type] || 'celebrate';

    // Remove user from all reaction arrays
    ['like', 'love', 'insightful', 'celebrate'].forEach(t => {
      if (!news.reactions[t]) news.reactions[t] = [];
      news.reactions[t] = news.reactions[t].filter(id => id !== userId);
    });

    // Add user to selected reaction array
    if (!news.reactions[mappedType]) news.reactions[mappedType] = [];
    news.reactions[mappedType].push(userId);

    await news.save();

    // Return counts
    const counts = {};
    ['like', 'love', 'insightful', 'celebrate'].forEach(t => {
      counts[t] = (news.reactions[t] || []).length;
    });

    res.json({
      userReaction: type,
      counts
    });
  } catch (err) {
    console.error('Error reacting to news:', err);
    res.status(500).json({ error: 'Failed to process reaction' });
  }
});

// ADMIN: Create news
app.post('/api/admin/news', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const authUser = authenticateToken(token);
    if (!authUser) {
      console.warn('❌ Token validation failed for news creation');
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Check if user is admin or superadmin
    if (!['admin', 'superadmin'].includes(authUser.role)) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { title, slug, excerpt, content, coverImage, author } = req.body;
    if (!title || !slug || !content) {
      return res.status(400).json({ error: 'Title, slug, and content required' });
    }

    const db = require('./db.js');
    if (!db?.models?.News) {
      return res.status(503).json({ error: 'News service unavailable' });
    }

    // Check if slug already exists
    const existing = await db.models.News.findOne({ slug });
    if (existing) {
      return res.status(400).json({ error: 'Slug already exists' });
    }

    const newsArticle = new db.models.News({
      title,
      slug,
      excerpt: excerpt || content.substring(0, 200),
      content,
      coverImage: coverImage || '',
      author: author || authUser.name || authUser.email,
      published: false,
      publishedAt: null,
      reactions: {
        like: [],
        love: [],
        insightful: [],
        celebrate: []
      },
      createdAt: new Date(),
      updatedAt: new Date()
    });

    await newsArticle.save();
    res.status(201).json(newsArticle);
  } catch (err) {
    console.error('Error creating news:', err);
    res.status(500).json({ error: 'Failed to create news' });
  }
});

// ADMIN: Get all news (including unpublished)
app.get('/api/admin/news', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const authUser = authenticateToken(token);
    if (!authUser) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    if (!['admin', 'superadmin'].includes(authUser.role)) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const db = require('./db.js');
    if (!db?.models?.News) {
      return res.status(503).json({ error: 'News service unavailable' });
    }

    const news = await db.models.News.find().sort({ createdAt: -1 });
    
    // Compute counts for each article
    const newsWithCounts = (news || []).map(article => {
      const data = article.toJSON ? article.toJSON() : article;

      // Ensure reactions object has correct format
      if (!data.reactions || typeof data.reactions !== 'object' || Array.isArray(data.reactions)) {
        data.reactions = {
          like: [],
          love: [],
          insightful: [],
          celebrate: []
        };
      }

      // Compute counts
      const counts = {
        like: (data.reactions.like || []).length,
        love: (data.reactions.love || []).length,
        insightful: (data.reactions.insightful || []).length,
        celebrate: (data.reactions.celebrate || []).length
      };

      data.counts = counts;
      data.reactions = undefined; // Remove raw array from response

      return data;
    });

    res.json(newsWithCounts);
  } catch (err) {
    console.error('Error fetching admin news:', err);
    res.status(500).json({ error: 'Failed to load news' });
  }
});

// ADMIN: Edit news
app.put('/api/admin/news/:id', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const authUser = authenticateToken(token);
    if (!authUser) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    if (!['admin', 'superadmin'].includes(authUser.role)) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const db = require('./db.js');
    if (!db?.models?.News) {
      return res.status(503).json({ error: 'News service unavailable' });
    }

    const { title, slug, excerpt, content, coverImage, author } = req.body;
    
    // Build update object
    const updateObj = { updatedAt: new Date() };
    if (title) updateObj.title = title;
    if (slug) updateObj.slug = slug;
    if (excerpt) updateObj.excerpt = excerpt;
    if (content) updateObj.content = content;
    if (coverImage !== undefined) updateObj.coverImage = coverImage;
    if (author) updateObj.author = author;
    
    console.log('✏️ Edit endpoint called:', { id: req.params.id, updateObj });
    
    const updateResult = await db.models.News.updateOne(
      { _id: req.params.id },
      { $set: updateObj }
    );
    
    console.log('✏️ Update result:', { modifiedCount: updateResult.modifiedCount, matchedCount: updateResult.matchedCount });
    
    if (updateResult.matchedCount === 0) {
      return res.status(404).json({ error: 'News not found' });
    }
    
    // Fetch and return the updated article
    const updatedNews = await db.models.News.findById(req.params.id);
    console.log('✅ Article updated:', { id: updatedNews._id, title: updatedNews.title });
    
    res.json(updatedNews);
  } catch (err) {
    console.error('❌ Error updating news:', err);
    res.status(500).json({ error: 'Failed to update news' });
  }
});

// ADMIN: Delete news
app.delete('/api/admin/news/:id', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const authUser = authenticateToken(token);
    if (!authUser) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    if (!['admin', 'superadmin'].includes(authUser.role)) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const db = require('./db.js');
    if (!db?.models?.News) {
      return res.status(503).json({ error: 'News service unavailable' });
    }

    await db.models.News.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting news:', err);
    res.status(500).json({ error: 'Failed to delete news' });
  }
});

// ADMIN: Publish/Unpublish news
app.patch('/api/admin/news/:id/publish', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const authUser = authenticateToken(token);
    if (!authUser) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    if (!['admin', 'superadmin'].includes(authUser.role)) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const db = require('./db.js');
    if (!db?.models?.News) {
      return res.status(503).json({ error: 'News service unavailable' });
    }

    const { published } = req.body;
    console.log('📤 Publish endpoint called:', { id: req.params.id, published, reqBody: req.body, user: authUser.email });
    
    const news = await db.models.News.findById(req.params.id);
    if (!news) {
      console.warn('⚠️ News article not found:', req.params.id);
      return res.status(404).json({ error: 'News not found' });
    }

    console.log('📤 Before update:', { id: news._id, title: news.title, published: news.published });
    console.log('📤 Setting published to:', published, 'type:', typeof published);
    
    // Use updateOne to explicitly update the database
    const updateResult = await db.models.News.updateOne(
      { _id: req.params.id },
      { 
        $set: { 
          published: published === true ? true : false,
          publishedAt: published === true ? new Date() : null,
          updatedAt: new Date()
        }
      }
    );
    
    console.log('📤 Update result:', { modifiedCount: updateResult.modifiedCount, matchedCount: updateResult.matchedCount });
    
    // Fetch the updated article to return
    const updatedNews = await db.models.News.findById(req.params.id);
    console.log('✅ After update:', { id: updatedNews._id, title: updatedNews.title, published: updatedNews.published, publishedAt: updatedNews.publishedAt });

    res.json(updatedNews);
  } catch (err) {
    console.error('❌ Error publishing news:', err);
    res.status(500).json({ error: 'Failed to publish news' });
  }
});

// Video upload endpoint (stores URL references, not actual files)
// Module video upload endpoint - supports both URL references and file uploads
app.post('/api/upload-module-video', express.json(), (req, res) => {
  try {
    const { videoUrl, courseId } = req.body;
    
    // Validate video URL
    if (!videoUrl || !courseId) {
      return res.status(400).json({ error: 'Missing videoUrl or courseId' });
    }
    
    // Basic URL validation
    try {
      new URL(videoUrl);
    } catch (e) {
      return res.status(400).json({ error: 'Invalid video URL' });
    }
    
    // Return the video URL (no actual file storage needed)
    // The video URL is stored in the module metadata via the API
    console.log(`✅ Video URL stored: ${videoUrl} for course: ${courseId}`);
    res.json({ videoUrl: videoUrl, message: 'Video URL stored successfully' });
  } catch (err) {
    console.error('Error in POST /api/upload-module-video:', err);
    res.status(500).json({ error: 'Failed to process video URL' });
  }
});

// Local video file upload endpoint - upload to Cloudinary
app.post('/api/upload-local-video', videoUpload.single('video'), async (req, res) => {
  try {
    if (!req.file) {
      console.error('❌ No video file provided');
      return res.status(400).json({ error: 'No video file provided' });
    }

    const config = cloudinary.config();
    console.log(`🔧 Cloudinary config - cloud_name: ${config.cloud_name ? 'SET' : 'NOT SET'}, api_key: ${config.api_key ? 'SET' : 'NOT SET'}`);

    if (!config.cloud_name || !config.api_key || !config.api_secret) {
      console.error('❌ Cloudinary not properly configured:', {
        cloud_name: !!config.cloud_name,
        api_key: !!config.api_key,
        api_secret: !!config.api_secret
      });
      return res.status(503).json({ error: 'Video storage service not available. Check Cloudinary configuration.' });
    }

    console.log(`📹 Received video upload: ${req.file.originalname}, size: ${req.file.size}, mimetype: ${req.file.mimetype}`);

    // Upload to Cloudinary
    const timestamp = Date.now();
    const originalName = path.parse(req.file.originalname).name.replace(/[^a-z0-9]/gi, '-').toLowerCase();
    const publicId = `ret-hub-videos/${originalName}-${timestamp}`;

    let responsesSent = false;

    const uploadStream = cloudinary.uploader.upload_stream(
      {
        resource_type: 'video',
        public_id: publicId,
        folder: 'ret-hub-videos',
        overwrite: true,
        eager_async: true,
        timeout: 600000
      },
      async (error, result) => {
        if (responsesSent) return; // Prevent double responses
        responsesSent = true;

        if (error) {
          console.error('❌ Cloudinary upload error:', error);
          return res.status(500).json({ error: 'Failed to upload video to cloud storage', details: error.message || String(error) });
        }

        console.log(`✅ Video uploaded to Cloudinary: ${result.public_id}, URL: ${result.secure_url}`);

        // Save metadata to MongoDB if connected
        if (db.isConnected()) {
          try {
            const videoMetadata = {
              filename: req.file.originalname,
              originalName: req.file.originalname,
              mimetype: req.file.mimetype,
              size: req.file.size,
              type: 'video',
              cloudinaryUrl: result.secure_url,
              cloudinaryPublicId: result.public_id,
              duration: result.duration,
              uploadedAt: new Date().toISOString()
            };

            const mediaDoc = new db.models.Media(videoMetadata);
            await mediaDoc.save();
            console.log(`💾 Video metadata saved to MongoDB`);
          } catch (dbErr) {
            console.warn('⚠️ Failed to save metadata to MongoDB:', dbErr.message);
            // Continue anyway - video is already in Cloudinary
          }
        }

        res.status(200).json({
          success: true,
          videoUrl: result.secure_url,
          fileName: req.file.originalname,
          cloudinaryPublicId: result.public_id,
          message: 'Video uploaded successfully'
        });
      }
    );

    // Handle stream errors
    uploadStream.on('error', (error) => {
      if (responsesSent) return;
      responsesSent = true;
      console.error('❌ Upload stream error:', error);
      res.status(500).json({ error: 'Upload stream error', details: error.message });
    });

    // Pipe the buffer to the upload stream
    const Readable = require('stream').Readable;
    const stream = new Readable();
    stream.push(req.file.buffer);
    stream.push(null);
    stream.pipe(uploadStream);

  } catch (err) {
    console.error('❌ Error in video upload endpoint:', err);
    res.status(500).json({ error: 'Failed to process video upload', details: err.message });
  }
});

// Local image file upload endpoint - save to MongoDB
app.post('/api/upload-image', imageUpload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      console.error('❌ No image file provided');
      return res.status(400).json({ error: 'No image file provided' });
    }

    console.log(`🖼️ Received image upload: ${req.file.originalname}, size: ${req.file.size}, mimetype: ${req.file.mimetype}`);

    // Generate unique filename since multer is using memory storage
    const timestamp = Date.now();
    const originalName = path.parse(req.file.originalname).name.replace(/[^a-z0-9]/gi, '-').toLowerCase();
    const ext = path.extname(req.file.originalname).toLowerCase();
    const filename = `${originalName}-${timestamp}${ext}`;

    // Try to save to MongoDB if connected
    if (!db.isConnected()) {
      console.error('❌ MongoDB not connected');
      return res.status(503).json({ error: 'Database service unavailable' });
    }

    // Save image to MongoDB using promises
    const imageData = {
      filename: filename,
      originalName: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      data: req.file.buffer,
      type: 'image',
      uploadedAt: new Date().toISOString()
    };

    console.log(`💾 Saving to MongoDB: ${filename}, buffer size: ${req.file.buffer.length}`);

    const mediaDoc = new db.models.Media(imageData);
    mediaDoc.save()
      .then((savedDoc) => {
        const mediaId = savedDoc._id.toString();
        // Construct absolute URL to ensure images render correctly on deployed sites
        const protocol = req.get('x-forwarded-proto') || req.protocol || 'http';
        const host = req.get('x-forwarded-host') || req.get('host') || 'localhost';
        const imageUrl = `${protocol}://${host}/api/media/${mediaId}`;
        console.log(`✅ Image uploaded to MongoDB: ${mediaId}, URL: ${imageUrl}`);
        return res.json({
          success: true,
          url: imageUrl,
          fileName: filename,
          mediaId: mediaId,
          message: 'Image uploaded successfully'
        });
      })
      .catch((err) => {
        console.error('⚠️ MongoDB save failed:', err);
        return res.status(500).json({ error: 'Failed to save image to database', details: err.message });
      });
  } catch (err) {
    console.error('❌ Error uploading image:', err);
    res.status(500).json({ error: 'Failed to upload image', details: err.message });
  }
});

// Retrieve media from MongoDB by ID
app.get('/api/media/:id', async (req, res) => {
  try {
    const mediaId = req.params.id;
    
    console.log(`🔍 Fetching media: ${mediaId}`);
    
    // Try MongoDB first
    if (!db.isConnected()) {
      console.error('MongoDB not connected');
      return res.status(503).json({ error: 'Media service unavailable' });
    }

    const media = await db.models.Media.findById(mediaId);
    
    if (!media) {
      console.warn(`⚠️ Media not found in MongoDB: ${mediaId}`);
      return res.status(404).json({ error: 'Media not found' });
    }

    console.log(`✅ Retrieved media ${mediaId}: ${media.filename}, size: ${media.size}, mimetype: ${media.mimetype}`);

    // Set appropriate content type
    const contentType = media.mimetype || 'application/octet-stream';
    res.type(contentType);
    res.set('Content-Disposition', `inline; filename="${media.filename}"`);
    res.set('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year
    // Ensure CORS headers for image loading from any origin
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    
    // Handle different data formats from MongoDB
    let binaryData = null;
    
    // Try different approaches to extract binary data
    if (Buffer.isBuffer(media.data)) {
      console.log(`📦 Data is Buffer, size: ${media.data.length}`);
      binaryData = media.data;
    } else if (media.data && media.data.buffer && Buffer.isBuffer(media.data.buffer)) {
      // Mongoose Binary type wraps the buffer
      console.log(`📦 Data is wrapped Buffer, size: ${media.data.buffer.length}`);
      binaryData = media.data.buffer;
    } else if (media.data instanceof Uint8Array) {
      console.log(`📦 Data is Uint8Array, converting to Buffer`);
      binaryData = Buffer.from(media.data);
    } else if (typeof media.data === 'string') {
      console.log(`📦 Data is string, converting to Buffer`);
      binaryData = Buffer.from(media.data, 'binary');
    } else if (media.data && typeof media.data === 'object') {
      // Try to convert object to buffer
      console.log(`📦 Data is object, attempting conversion`);
      try {
        binaryData = Buffer.from(media.data);
      } catch (e) {
        console.error('Failed to convert media.data to buffer:', e.message);
        return res.status(500).json({ error: 'Invalid media data format' });
      }
    } else {
      console.error('Unknown media.data type:', typeof media.data);
      return res.status(500).json({ error: 'Invalid media data format' });
    }

    if (!binaryData || binaryData.length === 0) {
      console.error('No valid binary data found for media:', mediaId);
      return res.status(500).json({ error: 'Media data is empty' });
    }

    console.log(`✅ Sending media, size: ${binaryData.length} bytes`);
    res.send(binaryData);
    
  } catch (err) {
    console.error('Error retrieving media:', err);
    res.status(500).json({ error: 'Failed to retrieve media', details: err.message });
  }
});

// Serve uploaded videos as static files
app.use('/videos', express.static(VIDEOS_DIR));

// Serve uploaded images as static files (persistent storage)
app.use('/images', express.static(IMAGES_DIR));

app.delete('/api/modules/:courseId/:file', (req, res) => {
  try {
    const { courseId, file } = req.params;
    const safe = String(file).replace(/\.{2,}/g, '');
    let list = storage.loadModules(courseId);
    const before = list.length;
    list = list.filter(m => m.file !== safe);
    if (list.length === before) return res.status(404).json({ error: 'Module not found' });
    storage.saveModules(courseId, list);
    res.json({ success: true });
  } catch (err) { console.error('Error deleting module', err); res.status(500).json({ error: 'Failed to delete module' }); }
});

// Delete local video file
app.delete('/api/delete-video', (req, res) => {
  try {
    const { fileName } = req.body;
    
    if (!fileName) {
      return res.status(400).json({ error: 'Missing fileName parameter' });
    }

    // Prevent path traversal attacks
    const safeName = path.basename(fileName);
    const filePath = path.join(VIDEOS_DIR, safeName);

    // Verify the file is actually in the videos directory
    if (!filePath.startsWith(VIDEOS_DIR)) {
      return res.status(400).json({ error: 'Invalid file path' });
    }

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`✅ Video deleted: ${safeName}`);
      res.json({ success: true, message: 'Video deleted successfully' });
    } else {
      res.status(404).json({ error: 'Video file not found' });
    }
  } catch (err) {
    console.error('Error deleting video:', err);
    res.status(500).json({ error: 'Failed to delete video', details: err.message });
  }
});

// accept plain text bodies for module content saves
app.post('/api/module-content/:courseId/:file', express.text({ limit: '10mb' }), (req, res) => {
  try {
    const { courseId, file } = req.params;
    const list = storage.loadModules(courseId);
    const module = list.find(m => m.file === file);
    if (!module) return res.status(404).json({ error: 'Module not found' });
    module.content = req.body || '';
    storage.saveModules(courseId, list);
    res.json({ success: true });
  } catch (err) { console.error('Error saving module content', err); res.status(500).json({ error: 'Failed to save content' }); }
});

// --- Pending content (staged markdown content changes) ---
function pendingContentIndexPath(courseId) { return path.join(PENDING_CONTENT_BASE, String(courseId), 'index.json'); }

app.post('/api/pending-module/:courseId/:file', express.text({ limit: '10mb' }), (req, res) => {
  try {
    const { courseId, file } = req.params;
    const safe = String(file).replace(/\.\.{2,}/g, '');
    const dir = path.join(PENDING_CONTENT_BASE, courseId);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const filePath = path.join(dir, safe);
    const content = req.body || '';
    fs.writeFileSync(filePath, content);

    // update index
    const idxPath = pendingContentIndexPath(courseId);
    let list = [];
    if (fs.existsSync(idxPath)) {
      try { list = JSON.parse(fs.readFileSync(idxPath, 'utf8')) || []; } catch(e) { list = []; }
    }
    // Use filename as title (don't derive from markdown heading)
    let title = String(safe);
    const existingIndex = list.findIndex(m => m.file === safe);
    // capture owner email from header (set by client) for per-user persistence
    const owner = (req.get('x-author-email') || req.get('x-admin-email') || '').trim() || null;
    const entry = { file: safe, title, courseId, owner, createdAt: new Date().toISOString() };
    if (existingIndex >= 0) list[existingIndex] = { ...list[existingIndex], ...entry };
    else list.push(entry);
    fs.writeFileSync(idxPath, JSON.stringify(list, null, 2));

    res.json({ success: true, entry });
  } catch (err) { console.error('Error saving pending content', err); res.status(500).json({ error: 'Failed to save pending content: ' + (err && err.message ? err.message : 'Unknown') }); }
});

app.get('/api/pending-content', (req, res) => {
  try {
    const out = [];
    if (!fs.existsSync(PENDING_CONTENT_BASE)) return res.json(out);
    const courses = fs.readdirSync(PENDING_CONTENT_BASE).filter(f => fs.existsSync(path.join(PENDING_CONTENT_BASE, f)));
    for (const c of courses) {
      const idx = pendingContentIndexPath(c);
      let list = [];
      if (fs.existsSync(idx)) {
        try { 
          const parsed = JSON.parse(fs.readFileSync(idx, 'utf8'));
          list = Array.isArray(parsed) ? parsed : [];
          // Validate index entries: only include if file actually exists
          list = list.filter(entry => {
            const filePath = path.join(PENDING_CONTENT_BASE, c, entry.file);
            return fs.existsSync(filePath);
          });
          // Save cleaned index back
          fs.writeFileSync(idx, JSON.stringify(list, null, 2));
        } catch(e) { 
          console.warn(`Warning: Error reading pending content index for ${c}:`, e.message);
          list = []; 
        }
      } else {
        // Only list files if index.json exists, don't create index from files
        list = [];
      }
      if (!Array.isArray(list)) list = [];
      out.push(...list.map(it => ({ ...it })));
    }
    res.json(out);
  } catch (err) { console.error('Error listing pending content', err); res.status(500).json({ error: 'Failed to list pending content' }); }
});

app.get('/api/pending-module/:courseId/:file', (req, res) => {
  try {
    const { courseId, file } = req.params;
    const safe = String(file).replace(/\.\.{2,}/g, '');
    const filePath = path.join(PENDING_CONTENT_BASE, courseId, safe);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Not found' });
    const content = fs.readFileSync(filePath, 'utf8');
    res.type('text/plain').send(content);
  } catch (err) { console.error('Error reading pending content', err); res.status(500).json({ error: 'Failed to load pending content' }); }
});

// Deploy pending content: copy to live modules and remove pending
app.post('/api/pending-module/:courseId/:file/deploy', (req, res) => {
  try {
    const { courseId, file } = req.params;
    const safe = String(file).replace(/\.\.{2,}/g, '');
    const pendingPath = path.join(PENDING_CONTENT_BASE, courseId, safe);
    if (!fs.existsSync(pendingPath)) return res.status(404).json({ error: 'Pending content not found' });
    const content = fs.readFileSync(pendingPath, 'utf8');

    // ensure modules dir
    const dir = path.join(MODULES_BASE, courseId);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const filePath = path.join(dir, safe);
    fs.writeFileSync(filePath, content);

    // update modules index.json to include entry if missing
    const idxPath = path.join(dir, 'index.json');
    let list = [];
    if (fs.existsSync(idxPath)) {
      try { 
        const parsed = JSON.parse(fs.readFileSync(idxPath, 'utf8'));
        list = Array.isArray(parsed) ? parsed : [];
      } catch(e) { list = []; }
    }
    if (!Array.isArray(list)) list = [];
    // Use title from existing entry if present, don't derive from markdown heading
    const existingIndex = list.findIndex(m => (m.file === safe || m.content === safe));
    let title = String(safe);
    if (existingIndex >= 0 && list[existingIndex].title) {
      title = list[existingIndex].title;
    }
    const entry = { id: (String(safe).split('.').slice(0,-1).join('.')||safe).replace(/[^a-zA-Z0-9\-]/g,'-').toLowerCase(), title, content: safe, file: safe, createdAt: new Date().toISOString() };
    if (existingIndex >= 0) list[existingIndex] = { ...list[existingIndex], ...entry };
    else list.push(entry);
    fs.writeFileSync(idxPath, JSON.stringify(list, null, 2));

    // Try to also load and save to in-memory cache for consistency, but don't fail if storage layer has issues
    setImmediate(() => {
      try {
        const dbList = storage.loadModules(courseId) || [];
        const dbIndex = dbList.findIndex(m => (m.content === safe || m.file === safe));
        if (dbIndex >= 0) {
          dbList[dbIndex] = { ...dbList[dbIndex], title, content: safe, file: safe, markdownContent: content };
        } else {
          dbList.push({ id: entry.id, title, content: safe, file: safe, markdownContent: content, createdAt: new Date().toISOString() });
        }
        storage.saveModules(courseId, dbList);
        console.log(`✅ Deployed module to storage cache: ${courseId}/${safe}`);
      } catch (dbErr) {
        console.warn(`⚠️ Storage cache update warning (non-critical):`, dbErr.message || dbErr);
      }
    });

    // remove pending content file and update pending index
    try {
      fs.unlinkSync(pendingPath);
    } catch (e) {
      console.warn(`Warning: Failed to delete pending file ${pendingPath}:`, e.message);
    }
    
    const pIdx = pendingContentIndexPath(courseId);
    if (fs.existsSync(pIdx)) {
      try { 
        let pList = JSON.parse(fs.readFileSync(pIdx, 'utf8')) || []; 
        if (!Array.isArray(pList)) pList = [];
        pList = pList.filter(it => it.file !== safe); 
        fs.writeFileSync(pIdx, JSON.stringify(pList, null, 2)); 
        console.log(`✅ Updated pending content index for ${courseId}, removed ${safe}`);
      } catch(e){ 
        console.warn(`Warning: Failed to update pending content index:`, e.message);
      }
    }

    res.json({ success: true, deployed: entry, message: 'Content deployed successfully' });
  } catch (err) { 
    console.error('Error deploying pending content', err); 
    res.status(500).json({ error: 'Failed to deploy pending content: ' + (err.message || 'Unknown error') }); 
  }
});

app.delete('/api/pending-module/:courseId/:file', (req, res) => {
  try {
    const { courseId, file } = req.params;
    const safe = String(file).replace(/\.\.{2,}/g, '');
    const pendingPath = path.join(PENDING_CONTENT_BASE, courseId, safe);
    if (!fs.existsSync(pendingPath)) return res.status(404).json({ error: 'Not found' });
    
    // Delete the file
    try {
      fs.unlinkSync(pendingPath);
      console.log(`✅ Deleted pending content file: ${courseId}/${safe}`);
    } catch (e) {
      console.error(`Error deleting pending file ${pendingPath}:`, e.message);
      throw e;
    }
    
    // Update the pending content index to remove the entry
    const pIdx = pendingContentIndexPath(courseId);
    if (fs.existsSync(pIdx)) {
      try { 
        let pList = JSON.parse(fs.readFileSync(pIdx, 'utf8')) || []; 
        if (!Array.isArray(pList)) pList = [];
        const before = pList.length;
        pList = pList.filter(it => it.file !== safe); 
        if (pList.length < before) {
          fs.writeFileSync(pIdx, JSON.stringify(pList, null, 2)); 
          console.log(`✅ Updated pending content index for ${courseId}, removed entry for ${safe}`);
        }
      } catch(e){ 
        console.warn(`Warning: Failed to update pending content index:`, e.message);
      }
    }
    
    // Clean up empty course directories
    try {
      const courseDir = path.join(PENDING_CONTENT_BASE, courseId);
      if (fs.existsSync(courseDir)) {
        const files = fs.readdirSync(courseDir).filter(f => f !== 'index.json');
        if (files.length === 0) {
          // Remove index.json too if no other files
          fs.rmSync(courseDir, { recursive: true, force: true });
          console.log(`✅ Cleaned up empty pending content directory: ${courseId}`);
        }
      }
    } catch (cleanupErr) {
      console.warn(`Warning: Failed to cleanup empty directory:`, cleanupErr.message);
    }
    
    res.json({ success: true });
  } catch (err) { console.error('Error deleting pending content', err); res.status(500).json({ error: 'Failed to delete pending content' }); }
});

// --- Pending modules metadata (staged module metadata changes: id, title, tag, isPremium) ---
function pendingModulesIndexPath(courseId) { return path.join(PENDING_MODULES_BASE, String(courseId), 'index.json'); }

app.post('/api/pending-modules/:courseId', express.json(), (req, res) => {
  try {
    const { courseId } = req.params;
    const { file, title, category, tag, isPremium, id, video } = req.body;
    if (!file) return res.status(400).json({ error: 'file is required' });
    
    const safe = String(file).replace(/\.\.{2,}/g, '');
    const dir = path.join(PENDING_MODULES_BASE, courseId);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    
    // update index
    const idxPath = pendingModulesIndexPath(courseId);
    let list = [];
    if (fs.existsSync(idxPath)) {
      try { 
        const parsed = JSON.parse(fs.readFileSync(idxPath, 'utf8'));
        list = Array.isArray(parsed) ? parsed : [];
      } catch(e) { list = []; }
    }
    if (!Array.isArray(list)) list = [];
    
    const existingIndex = list.findIndex(m => m.file === safe);
    const owner = (req.get('x-author-email') || req.get('x-admin-email') || '').trim() || null;
    const entry = { 
      file: safe,
      title: title || safe,
      category: category || undefined,
      tag: tag || '',
      isPremium: !!isPremium,
      id: id || undefined,
      video: video || undefined,
      courseId,
      owner,
      createdAt: new Date().toISOString()
    };
    
    if (existingIndex >= 0) {
      list[existingIndex] = { ...list[existingIndex], ...entry, updatedAt: new Date().toISOString() };
    } else {
      list.push(entry);
    }
    
    fs.writeFileSync(idxPath, JSON.stringify(list, null, 2));
    res.json({ success: true, entry });
  } catch (err) { 
    console.error('Error saving pending module metadata', err); 
    res.status(500).json({ error: 'Failed to save pending module metadata: ' + (err && err.message ? err.message : 'Unknown') }); 
  }
});

app.get('/api/pending-modules', (req, res) => {
  try {
    const out = [];
    if (!fs.existsSync(PENDING_MODULES_BASE)) return res.json(out);
    const courses = fs.readdirSync(PENDING_MODULES_BASE).filter(f => fs.existsSync(path.join(PENDING_MODULES_BASE, f)));
    for (const c of courses) {
      const idx = pendingModulesIndexPath(c);
      let list = [];
      if (fs.existsSync(idx)) {
        try { 
          const parsed = JSON.parse(fs.readFileSync(idx, 'utf8'));
          list = Array.isArray(parsed) ? parsed : [];
        } catch(e) { list = []; }
      }
      if (!Array.isArray(list)) list = [];
      out.push(...list.map(it => ({ ...it })));
    }
    res.json(out);
  } catch (err) { 
    console.error('Error listing pending modules', err); 
    res.status(500).json({ error: 'Failed to list pending modules' }); 
  }
});

app.get('/api/pending-modules/:courseId/:file', (req, res) => {
  try {
    const { courseId, file } = req.params;
    const safe = String(file).replace(/\.\.{2,}/g, '');
    const idxPath = pendingModulesIndexPath(courseId);
    if (!fs.existsSync(idxPath)) return res.status(404).json({ error: 'Not found' });
    let list = [];
    try { list = JSON.parse(fs.readFileSync(idxPath, 'utf8')) || []; } catch(e) { list = []; }
    const entry = list.find(m => m.file === safe);
    if (!entry) return res.status(404).json({ error: 'Not found' });
    res.json(entry);
  } catch (err) { 
    console.error('Error reading pending module metadata', err); 
    res.status(500).json({ error: 'Failed to load pending module metadata' }); 
  }
});

app.post('/api/pending-modules/:courseId/:file/deploy', (req, res) => {
  try {
    const { courseId, file } = req.params;
    const safe = String(file).replace(/\.\.{2,}/g, '');
    
    // Get pending module metadata
    const pIdxPath = pendingModulesIndexPath(courseId);
    console.log(`📝 Deploying module metadata: ${courseId}/${safe} from ${pIdxPath}`);
    
    if (!fs.existsSync(pIdxPath)) {
      console.error(`❌ Pending modules index not found: ${pIdxPath}`);
      return res.status(404).json({ error: 'Pending module metadata not found' });
    }
    
    let pList = [];
    try {
      const parsed = JSON.parse(fs.readFileSync(pIdxPath, 'utf8'));
      pList = Array.isArray(parsed) ? parsed : [];
    } catch (parseErr) {
      console.error(`❌ Failed to parse pending modules index: ${parseErr.message}`);
      return res.status(500).json({ error: 'Failed to parse pending modules metadata: ' + parseErr.message });
    }
    
    if (!Array.isArray(pList)) pList = [];
    const pEntry = pList.find(m => m.file === safe);
    if (!pEntry) {
      console.error(`❌ Module not found in pending list. Available: ${pList.map(m => m.file).join(', ')}`);
      return res.status(404).json({ error: 'Pending module metadata not found (file: ' + safe + ')' });
    }
    
    console.log(`✅ Found pending module entry: ${pEntry.title || pEntry.file}`);
    
    // Update live modules index.json with new metadata
    const dir = path.join(MODULES_BASE, courseId);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const idxPath = path.join(dir, 'index.json');
    let list = [];
    if (fs.existsSync(idxPath)) {
      try { 
        const parsed = JSON.parse(fs.readFileSync(idxPath, 'utf8'));
        list = Array.isArray(parsed) ? parsed : [];
      } catch(e) { 
        console.warn(`Warning: Could not parse modules index, starting fresh`);
        list = []; 
      }
    }
    
    const existingIndex = list.findIndex(m => (m.file === safe || m.content === safe));
    const entry = {
      id: pEntry.id || (String(safe).split('.').slice(0,-1).join('.')||safe).replace(/[^a-zA-Z0-9\-]/g,'-').toLowerCase(),
      title: pEntry.title,
      category: pEntry.category || undefined,
      tag: pEntry.tag || '',
      isPremium: !!pEntry.isPremium,
      video: pEntry.video || undefined,
      content: safe,
      file: safe,
      createdAt: new Date().toISOString()
    };
    
    if (existingIndex >= 0) {
      list[existingIndex] = { ...list[existingIndex], ...entry };
      console.log(`🔄 Updated existing module entry`);
    } else {
      list.push(entry);
      console.log(`➕ Added new module entry`);
    }
    fs.writeFileSync(idxPath, JSON.stringify(list, null, 2));
    
    // Try to save to storage layer asynchronously (non-blocking)
    setImmediate(() => {
      try {
        let dbList = storage.loadModules(courseId) || [];
        if (!Array.isArray(dbList)) dbList = [];
        const dbIndex = dbList.findIndex(m => (m.content === safe || m.file === safe));
        const dbEntry = { ...entry };
        if (dbIndex >= 0) {
          dbList[dbIndex] = { ...dbList[dbIndex], ...dbEntry };
        } else {
          dbList.push(dbEntry);
        }
        storage.saveModules(courseId, dbList);
        console.log(`✅ Deployed module metadata to storage: ${courseId}/${safe}`);
      } catch (dbErr) {
        console.warn(`⚠️ Storage save warning (non-critical):`, dbErr.message || dbErr);
      }
    });
    
    // Remove from pending and update pending index
    pList = pList.filter(it => it.file !== safe);
    fs.writeFileSync(pIdxPath, JSON.stringify(pList, null, 2));
    
    res.json({ success: true, deployed: entry, message: 'Module metadata deployed successfully' });
  } catch (err) { 
    console.error('Error deploying pending module metadata', err); 
    res.status(500).json({ error: 'Failed to deploy pending module metadata: ' + (err && err.message ? err.message : 'Unknown error') }); 
  }
});

app.delete('/api/pending-modules/:courseId/:file', (req, res) => {
  try {
    const { courseId, file } = req.params;
    const safe = String(file).replace(/\.\.{2,}/g, '');
    const idxPath = pendingModulesIndexPath(courseId);
    if (!fs.existsSync(idxPath)) return res.status(404).json({ error: 'Not found' });
    let list = JSON.parse(fs.readFileSync(idxPath, 'utf8')) || [];
    if (!Array.isArray(list)) list = [];
    list = list.filter(m => m.file !== safe);
    fs.writeFileSync(idxPath, JSON.stringify(list, null, 2));
    res.json({ success: true });
  } catch (err) { 
    console.error('Error deleting pending module metadata', err); 
    res.status(500).json({ error: 'Failed to delete pending module metadata' }); 
  }
});

// --- Analytics ---
// Admin: View all login activity
app.get('/api/admin/login-activity', (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    // Simple admin check - can be replaced with proper role-based access control
    const users = loadUsers();
    let isAdmin = false;
    for (const user of Object.values(users)) {
      if (user.token === token && (user.role === 'admin' || user.isAdmin)) {
        isAdmin = true;
        break;
      }
    }

    if (!isAdmin) {
      return res.status(403).json({ error: 'Unauthorized: Admin access required' });
    }

    // Get all login activity
    const activity = loadLoginActivity();
    
    // Group by email and count attempts
    const activityByEmail = {};
    activity.forEach(log => {
      if (!activityByEmail[log.email]) {
        activityByEmail[log.email] = {
          email: log.email,
          totalAttempts: 0,
          successfulLogins: 0,
          failedAttempts: 0,
          lastLoginAttempt: null,
          lastSuccessfulLogin: null,
          failureReasons: {}
        };
      }
      activityByEmail[log.email].totalAttempts++;
      if (log.success) {
        activityByEmail[log.email].successfulLogins++;
        if (!activityByEmail[log.email].lastSuccessfulLogin || 
            new Date(log.timestamp) > new Date(activityByEmail[log.email].lastSuccessfulLogin)) {
          activityByEmail[log.email].lastSuccessfulLogin = log.timestamp;
        }
      } else {
        activityByEmail[log.email].failedAttempts++;
        if (log.reason) {
          activityByEmail[log.email].failureReasons[log.reason] = 
            (activityByEmail[log.email].failureReasons[log.reason] || 0) + 1;
        }
      }
      if (!activityByEmail[log.email].lastLoginAttempt || 
          new Date(log.timestamp) > new Date(activityByEmail[log.email].lastLoginAttempt)) {
        activityByEmail[log.email].lastLoginAttempt = log.timestamp;
      }
    });

    res.json({
      success: true,
      totalRecords: activity.length,
      summary: Object.values(activityByEmail),
      recentActivity: activity.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 100)
    });
  } catch (err) {
    console.error('Admin login activity error:', err);
    res.status(500).json({ error: 'Failed to retrieve login activity' });
  }
});

app.get('/api/admin/analytics', (req, res) => {
  try {
    const users = loadUsers() || {};
    const courses = loadCourses() || [];
    const sessions = loadSessions() || {};

    // Exclude admin accounts from the user count. Admins can be stored in a separate
    // admins list (server/admins.json) or as users with role 'admin'/'superadmin'.
    const admins = loadAdmins() || [];
    const adminEmails = new Set((admins || []).map(a => String(a.email || '').toLowerCase()));

    // Count only students in analytics (exclude admins and instructors)
    const totalUsers = Object.entries(users).filter(([email, user]) => {
      const e = String(email || '').toLowerCase();
      if (adminEmails.has(e)) return false; // explicit admin entry
      const role = (user && user.role) ? String(user.role).toLowerCase() : 'student';
      // include only explicit students (or default/no-role treated as student)
      return role === 'student';
    }).length;

    const totalCourses = courses.length;
    const activeSessions = Object.values(sessions).filter(s => s && s.status !== 'terminated').length;
    res.json({ totalUsers, totalCourses, activeSessions });
  } catch (err) {
    console.error('Error getting analytics:', err);
    res.status(500).json({ error: 'Failed to compute analytics' });
  }
});

// --- Settings (server-side file) ---
const SETTINGS_FILE = path.join(__dirname, 'settings.json');
function loadSettings() { return storage.loadSettings() || { siteName: 'Aubie RET Hub' }; }
function saveSettings(s) { return storage.saveSettings(s); }

app.get('/api/admin/settings', (req, res) => {
  try { res.json(loadSettings()); } catch (err) { res.status(500).json({ error: 'Failed to load settings' }); }
});

app.post('/api/admin/settings', (req, res) => {
  try {
    console.log('Settings save request received. Body:', req.body);
    saveSettings(req.body || {});
    res.json({ success: true });
  } catch (err) { console.error('Settings save error:', err); res.status(500).json({ error: 'Failed to save settings', details: err.message }); }
});

// Ensure uploads folder exists
const UPLOADS_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// --- API Endpoints ---

// Fetch payment configuration
app.get('/api/config', (req, res) => {
  res.json({ 
    paymentProcessor: 'paychangu',
    paychanguPublicKey: process.env.PAYCHANGU_PUBLIC_KEY || null
  });
});

// Test email endpoint (helps verify SMTP config)
app.post('/api/send-test-email', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required' });

      const siteUrl = process.env.SITE_URL || 'https://renewable-energy-hubbc.onrender.com';
      const subject = 'Aubie RET Hub — Test Email';
      const text = `This is a test email sent to ${email} to verify SMTP configuration.`;
      const html = `
        <div style="font-family:Arial,Helvetica,sans-serif;padding:18px;background:#f6f8fb;">
          <div style="max-width:600px;margin:0 auto;background:#fff;padding:18px;border-radius:8px;border:1px solid #e6e9ef;">
            <h2 style="margin:0 0 8px 0;color:#0b6fb7">Aubie RET Hub</h2>
            <p style="margin:0 0 12px 0;color:#333">This is a test email to <strong>${email}</strong>. If you can see this message, SMTP is configured correctly.</p>
            <p style="margin:0;color:#666;font-size:12px">Visit <a href="${siteUrl}">${siteUrl}</a> to view the application.</p>
          </div>
        </div>
      `;

      const sent = await sendEmail(email, subject, text, html);
    if (sent) {
      return res.json({ success: true, message: 'Test email sent (check inbox/spam)' });
    }
    return res.status(500).json({ error: 'Failed to send test email (check server logs)' });
  } catch (err) {
    console.error('send-test-email error:', err);
    res.status(500).json({ error: 'Failed to send test email' });
  }
});

// ===== AUTH ENDPOINTS =====

// Register new user
app.post('/api/auth/register', (req, res) => {
  try {
    const settings = loadSettings() || {};
    if (settings.maintenanceMode) return res.status(503).json({ error: 'The site is in maintenance mode' });
    if (settings.allowRegistrations === false) return res.status(403).json({ error: 'Registrations are currently disabled' });
    const { name, email, password } = req.body;

    // Validate input
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Missing required fields: name, email, password' });
    }

    if (email.length === 0) {
      return res.status(400).json({ error: 'Email must be valid' });
    }
    
    // Validate password strength
    const passwordValidation = validatePasswordStrength(password);
    if (!passwordValidation.isStrong) {
      return res.status(400).json({ 
        error: 'Password does not meet requirements',
        requirements: passwordValidation.errors
      });
    }

    // Check if email is in deleted accounts list
    const deletedEmails = loadDeletedEmails();
    if (deletedEmails.includes(email.toLowerCase())) {
      return res.status(403).json({ error: 'This email has been used for a deleted account and cannot be re-registered. Please use a different email.' });
    }

    const users = loadUsers();

    // Check if user already exists
    if (users[email]) {
      return res.status(409).json({ error: 'User already exists with this email' });
    }

    // Create new user
    const token = generateToken();
    const hashedPassword = hashPassword(password);

    // For backward compatibility keep this if called directly, but prefer register-request flow
    users[email] = {
      name,
      email,
      password: hashedPassword,
      token,
      hasPremium: false,
      createdAt: new Date().toISOString()
    };

    saveUsers(users);

    // Send welcome notification to new user
    (async () => {
      try {
        console.log(`📬 Attempting to create welcome notification for ${email}`);
        const result = await createNotification(email, {
          type: 'welcome',
          title: `Welcome to Renewable Energy Hub, ${name}! 🎉`,
          message: 'We\'re excited to have you here. Start exploring our courses to begin your renewable energy journey.',
          icon: 'fa-hand-paper',
          actionUrl: '/courses.html'
        });
        console.log(`✅ Welcome notification created for ${email}:`, result);
      } catch (notifErr) {
        console.error(`❌ Failed to create welcome notification for ${email}:`, notifErr);
      }
    })();

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      token,
      user: {
        email,
        name,
        hasPremium: false
      }
    });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Register request (send verification code)
app.post('/api/auth/register-request', async (req, res) => {
  try {
    const settings = loadSettings() || {};
    if (settings.maintenanceMode) return res.status(503).json({ error: 'The site is in maintenance mode' });
    if (settings.allowRegistrations === false) return res.status(403).json({ error: 'Registrations are currently disabled' });
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'Missing fields' });

    // Check if email is in deleted accounts list
    const deletedEmails = loadDeletedEmails();
    if (deletedEmails.includes(email.toLowerCase())) {
      return res.status(403).json({ error: 'This email has been used for a deleted account and cannot be re-registered. Please use a different email.' });
    }

    const users = loadUsers();
    if (users[email] && !users[email].pendingVerification) {
      return res.status(409).json({ error: 'User already exists' });
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 minutes

    users[email] = users[email] || {};
    users[email].name = name;
    users[email].email = email;
    users[email].password = hashPassword(password);
    users[email].pendingVerification = true;
    users[email].verificationCode = code;
    users[email].verificationExpiresAt = expiresAt;
    users[email].createdAt = users[email].createdAt || new Date().toISOString();

    saveUsers(users);

    // send code via email (HTML + text)
    const siteUrl = process.env.SITE_URL || 'https://renewable-energy-hubbc.onrender.com';
    const verificationEmail = buildVerificationEmail({ code, name, siteUrl });
    await sendEmail(email, verificationEmail.subject, verificationEmail.text, verificationEmail.html);

    res.json({ success: true, message: 'Verification code sent' });
  } catch (err) {
    console.error('register-request error:', err);
    res.status(500).json({ error: 'Failed to initiate registration' });
  }
});

// Register verify (complete registration)
app.post('/api/auth/register-verify', (req, res) => {
  try {
    const settings = loadSettings() || {};
    if (settings.maintenanceMode) return res.status(403).json({ error: 'The site is in maintenance mode' });
    if (settings.allowRegistrations === false) return res.status(403).json({ error: 'Registrations are currently disabled' });
    const { email, code } = req.body;
    if (!email || !code) return res.status(400).json({ error: 'Missing fields' });

    const users = loadUsers();
    const user = users[email];
    if (!user || !user.pendingVerification) return res.status(400).json({ error: 'No pending registration for this email' });
    if (user.verificationCode !== code) return res.status(400).json({ error: 'Incorrect code' });
    if (new Date() > new Date(user.verificationExpiresAt)) return res.status(400).json({ error: 'Code expired' });

    // finalize
    user.pendingVerification = false;
    delete user.verificationCode;
    delete user.verificationExpiresAt;
    user.token = generateToken();
    user.hasPremium = user.hasPremium || false;
    user.registeredAt = new Date().toISOString();
    saveUsers(users);

    // Add system message for admin notification
    addSystemMessage(
      'registration',
      `New User Registered: ${user.name || email}`,
      `A new user has successfully registered and verified their email.`,
      {
        email: user.email,
        name: user.name,
        registeredAt: user.registeredAt,
        hasPremium: user.hasPremium
      }
    );

    res.json({ success: true, token: user.token, user: { id: user.email, email: user.email, name: user.name, role: user.role || 'student', hasPremium: user.hasPremium } });
  } catch (err) {
    console.error('register-verify error:', err);
    res.status(500).json({ error: 'Verification failed' });
  }
});

// Forgot password request
app.post('/api/auth/forgot-password-request', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required' });
    
    // Check if email is in deleted accounts list
    const deletedEmails = loadDeletedEmails();
    if (deletedEmails.includes(email.toLowerCase())) {
      return res.status(400).json({ error: 'This account has been deleted and cannot be recovered' });
    }
    
    const users = loadUsers();
    // Check if user exists - return error if not registered
    if (!users[email]) {
      return res.status(400).json({ error: 'Email not registered' });
    }

    // Generate a 6-digit code and store in-memory only (to avoid file writes triggering live-reload)
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    inMemoryResetCodes[email] = { code, expiresAt };

    // Send code via email (HTML + text) or console fallback
    const siteUrl = process.env.SITE_URL || 'https://renewable-energy-hubbc.onrender.com';
    // Use the stored user's name when available so the email greets them personally.
    // If no name is stored, fall back to the email local-part (before the @).
    let userName = '';
    if (users[email] && users[email].name && users[email].name.trim()) {
      userName = users[email].name.trim();
    } else if (email && typeof email === 'string') {
      userName = email.split('@')[0] || '';
      // replace dots/underscores with spaces and capitalize words for nicer display
      userName = userName.replace(/[._]/g, ' ').split(' ').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' ');
    }
    const resetEmail = buildResetEmail({ code, name: userName, siteUrl, email });
    try {
      console.log(`(DEBUG) Reset email text for ${email}:\n${resetEmail.text}`);
      console.log(`(DEBUG) Reset email html preview for ${email}:\n${resetEmail.html.slice(0,200)}...`);
    } catch (dbgErr) {
      console.warn('Failed to log reset email debug info', dbgErr);
    }
    await sendEmail(email, resetEmail.subject, resetEmail.text, resetEmail.html);
    res.json({ success: true });
  } catch (err) {
    console.error('forgot-password-request error:', err);
    res.status(500).json({ error: 'Failed to process request' });
  }
});

// Reset password
app.post('/api/auth/reset-password', (req, res) => {
  try {
    const { email, code, newPassword } = req.body;
    if (!email || !code || !newPassword) return res.status(400).json({ error: 'Missing fields' });
    
    // Validate new password strength
    const passwordValidation = validatePasswordStrength(newPassword);
    if (!passwordValidation.isStrong) {
      return res.status(400).json({ 
        error: 'Password does not meet requirements',
        requirements: passwordValidation.errors
      });
    }
    
    const users = loadUsers();
    const user = users[email];
    if (!user) return res.status(400).json({ error: 'Email not found' });

    // Check in-memory reset code first (preferred)
    const stored = inMemoryResetCodes[email];
    if (!stored) {
      // Fallback to persisted code (for older entries)
      if (!user.resetCode) return res.status(400).json({ error: 'No reset code requested' });
      if (user.resetCode !== code) return res.status(400).json({ error: 'Incorrect code' });
      if (new Date() > new Date(user.resetExpiresAt)) return res.status(400).json({ error: 'Code expired' });
    } else {
      if (stored.code !== code) return res.status(400).json({ error: 'Incorrect code' });
      if (new Date() > new Date(stored.expiresAt)) return res.status(400).json({ error: 'Code expired' });
      // consume in-memory code
      delete inMemoryResetCodes[email];
    }

    // Apply password change and persist once
    // Prevent reuse of previously used passwords
    const newHashed = hashPassword(newPassword);
    user.passwordHistory = user.passwordHistory || [];
    // Check against current and previous passwords
    if (user.password === newHashed || user.passwordHistory.includes(newHashed)) {
      return res.status(400).json({ error: 'New password must not match previously used passwords' });
    }

    // Move current password into history (keep recent 5)
    if (user.password) {
      user.passwordHistory.unshift(user.password);
      if (user.passwordHistory.length > 5) user.passwordHistory = user.passwordHistory.slice(0, 5);
    }

    user.password = newHashed;
    // Remove any persisted reset fields if present
    delete user.resetCode;
    delete user.resetExpiresAt;
    // optionally invalidate tokens
    user.token = generateToken();
    user.lastPasswordResetAt = new Date().toISOString();
    saveUsers(users);

    // Add system message for admin notification
    addSystemMessage(
      'password-reset',
      `User Password Reset: ${user.name || email}`,
      `A user has successfully reset their password.`,
      {
        email: user.email,
        name: user.name,
        resetAt: user.lastPasswordResetAt
      }
    );

    res.json({ success: true });
  } catch (err) {
    console.error('reset-password error:', err);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

// Login user
app.post('/api/auth/login', (req, res) => {
  try {
    const { email, password } = req.body;
    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress || req.ip || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';

    // Validate input
    if (!email || !password) {
      recordLoginAttempt(email || 'unknown', false, ip, userAgent, 'missing_fields');
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Check if email is in deleted accounts list
    const deletedEmails = loadDeletedEmails();
    if (deletedEmails.includes(email.toLowerCase())) {
      recordLoginAttempt(email, false, ip, userAgent, 'account_deleted');
      return res.status(401).json({ error: 'Deleted account' });
    }

    const users = loadUsers();
    const user = users[email];

    // Check if user exists
    if (!user) {
      recordLoginAttempt(email, false, ip, userAgent, 'email_not_found');
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Verify password
    const hashedPassword = hashPassword(password);
    if (user.password !== hashedPassword) {
      recordLoginAttempt(email, false, ip, userAgent, 'invalid_password');
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Generate new token on login
    const token = generateToken();
    user.token = token;
    user.lastLogin = new Date().toISOString();
    
    // Create a new session with activity tracking
    createSession(token, email, req);
    
    // Record successful login
    recordLoginAttempt(email, true, ip, userAgent, null);
    
    saveUsers(users);

    res.json({
      success: true,
      message: 'Login successful',
      token,
      sessionTimeoutMs: SESSION_TIMEOUT_MS,
      user: {
        id: user.email,
        email: user.email,
        name: user.name,
        role: user.role || 'student',
        hasPremium: user.hasPremium || false
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress || req.ip || 'unknown';
    recordLoginAttempt('unknown', false, ip, req.headers['user-agent'] || 'unknown', 'server_error');
    res.status(500).json({ error: 'Login failed' });
  }
});

// Get current user (verify token)
app.post('/api/auth/me', (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    // Reject revoked tokens immediately
    try {
      const revoked = loadRevokedTokens();
      if (revoked && revoked.includes(token)) return res.status(401).json({ error: 'Invalid or expired token' });
    } catch (e) { console.warn('revoked tokens check failed', e); }

    const users = loadUsers();

    // Find user by token FIRST (before checking session validity)
    let currentUser = null;
    let userEmail = null;
    for (const [email, user] of Object.entries(users)) {
      if (user.token === token) {
        currentUser = { ...user };
        userEmail = email;
        delete currentUser.password; // Never send password
        // Add avatar URL if it exists
        if (!currentUser.avatarUrl) {
          const avatarManager = require('./avatars');
          const avatarUrl = avatarManager.getAvatarUrl(email);
          if (avatarUrl) {
            currentUser.avatarUrl = avatarUrl;
          }
        }
        break;
      }
    }

    if (!currentUser) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // NOW check session validity and ensure session is registered
    if (!activeSessions.has(token)) {
      // Session not in memory - create it (handles post-restart)
      createSession(token, userEmail, req);
      console.log(`📋 [/api/auth/me] Session registered for ${userEmail} (post-restart)`);
    } else {
      // Check session validity (timeout check)
      if (!isSessionValid(token)) {
        return res.status(401).json({ error: 'Session expired due to inactivity', sessionExpired: true });
      }
    }

    // Record activity for this session
    recordSessionActivity(token);

    res.json({
      success: true,
      user: currentUser,
      sessionTimeoutMs: SESSION_TIMEOUT_MS
    });
  } catch (err) {
    console.error('Auth verification error:', err);
    res.status(500).json({ error: 'Authentication check failed' });
  }
});

// GET equivalent of /api/auth/me for simpler usage
app.get('/api/user/me', (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    // Reject revoked tokens immediately
    try {
      const revoked = loadRevokedTokens();
      if (revoked && revoked.includes(token)) return res.status(401).json({ error: 'Invalid or expired token' });
    } catch (e) { console.warn('revoked tokens check failed', e); }

    const users = loadUsers();

    // Find user by token FIRST (before checking session validity)
    let currentUser = null;
    let userEmail = null;
    for (const [email, user] of Object.entries(users)) {
      if (user.token === token) {
        currentUser = { ...user };
        userEmail = email;
        delete currentUser.password; // Never send password
        // Add avatar URL if it exists
        if (!currentUser.avatarUrl) {
          const avatarManager = require('./avatars');
          const avatarUrl = avatarManager.getAvatarUrl(email);
          if (avatarUrl) {
            currentUser.avatarUrl = avatarUrl;
          }
        }
        break;
      }
    }

    if (!currentUser) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // NOW check session validity and ensure session is registered
    if (!activeSessions.has(token)) {
      // Session not in memory - create it (handles post-restart)
      createSession(token, userEmail, req);
      console.log(`📋 [/api/user/me] Session registered for ${userEmail} (post-restart)`);
    } else {
      // Check session validity (timeout check)
      if (!isSessionValid(token)) {
        return res.status(401).json({ error: 'Session expired due to inactivity', sessionExpired: true });
      }
    }

    // Record activity for this session
    recordSessionActivity(token);

    res.json({
      success: true,
      user: currentUser,
      sessionTimeoutMs: SESSION_TIMEOUT_MS
    });
  } catch (err) {
    console.error('Auth verification error:', err);
    res.status(500).json({ error: 'Authentication check failed' });
  }
});

// Logout user (revoke session)
app.post('/api/auth/logout', (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (token) {
      revokeSession(token);
      console.log('✅ User logged out and session revoked');
    }
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (err) {
    console.error('Logout error:', err);
    res.status(500).json({ error: 'Logout failed' });
  }
});

// Get login activity history for the authenticated user
app.get('/api/auth/login-activity', (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const users = loadUsers();
    let userEmail = null;

    // Find user by token
    for (const [email, user] of Object.entries(users)) {
      if (user.token === token) {
        userEmail = email;
        break;
      }
    }

    if (!userEmail) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Get all login activity
    const allActivity = loadLoginActivity();
    
    // Filter to only this user's activity and sort by most recent first
    const userActivity = allActivity
      .filter(log => log.email === userEmail)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 50); // Return last 50 login attempts

    res.json({
      success: true,
      email: userEmail,
      activity: userActivity
    });
  } catch (err) {
    console.error('Login activity error:', err);
    res.status(500).json({ error: 'Failed to retrieve login activity' });
  }
});

// Delete account endpoint
app.post('/api/auth/delete-account', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Not authenticated' });

    const users = loadUsers();
    let userEmail = null;
    
    for (const [email, user] of Object.entries(users)) {
      if (user.token === token) {
        userEmail = email;
        break;
      }
    }
    
    if (!userEmail) return res.status(401).json({ error: 'Invalid token' });

    // Delete user from users object
    delete users[userEmail];
    saveUsers(users);
    
    // Add email to deleted accounts list (prevent re-registration)
    const deletedEmails = loadDeletedEmails();
    if (!deletedEmails.includes(userEmail.toLowerCase())) {
      deletedEmails.push(userEmail.toLowerCase());
      saveDeletedEmails(deletedEmails);
    }
    
    // Also delete from MongoDB if connected
    if (db.isConnected()) {
      try {
        await db.models.User.deleteMany({ email: userEmail });
      } catch (e) {
        console.warn('Failed to delete user from MongoDB:', e.message);
      }
    }
    
    // Delete avatar file if exists
    try {
      const avatarManager = require('./avatars');
      avatarManager.deleteAvatar(userEmail);
    } catch (e) {
      console.warn('Failed to delete avatar:', e.message);
    }
    
    console.log(`🗑️ Account deleted for ${userEmail}`);
    res.json({ success: true, message: 'Account deleted successfully' });
  } catch (err) {
    console.error('Error deleting account:', err);
    res.status(500).json({ error: 'Failed to delete account' });
  }
});

// --- Admin accounts (stored in admins.json)
const ADMINS_FILE = path.join(__dirname, 'admins.json');
function loadAdmins() {
  try {
    const raw = storage.loadAdmins() || [];
    // Normalize: if password looks like plaintext (not a 64-char hex SHA256), hash it and persist
    let changed = false;
    const normalized = raw.map(a => {
      const copy = { ...a };
      if (copy.password && !/^[a-f0-9]{64}$/i.test(String(copy.password).trim())) {
        try {
          copy.password = hashPassword(String(copy.password));
          changed = true;
        } catch (e) { console.warn('Failed to hash admin password for', copy.email, e); }
      }
      return copy;
    });
    if (changed) {
      try { storage.saveAdmins(normalized); } catch (e) { console.warn('Failed to persist normalized admins', e); }
    }
    return normalized;
  } catch (err) { console.error('Error loading admins.json', err); }
  return [];
}

// Resolve role and identity from a token (checks admins then users)
function getRoleFromToken(token) {
  if (!token) return null;
  try {
    const admins = loadAdmins() || [];
    const adminMatch = (admins || []).find(a => a.token === token);
    if (adminMatch) return { role: 'superadmin', email: adminMatch.email || null };
    const users = loadUsers() || {};
    for (const [email, user] of Object.entries(users)) {
      if (user && user.token === token) return { role: user.role || null, email };
    }
  } catch (e) { console.warn('getRoleFromToken failed', e); }
  return null;
}

// Admin login endpoint
app.post('/api/auth/admin-login', (req, res) => {
  try {
    const { role, email, idNumber, password, secret } = req.body || {};
    console.log('📝 Admin login attempt:', { role, idNumber: idNumber ? '***' : 'missing', password: password ? '***' : 'missing', secret: secret ? '***' : 'N/A' });
    if (!role) return res.status(400).json({ error: 'Role required' });

    // Superadmin credentials are stored in server/admins.json
    if (role === 'superadmin') {
      if (!idNumber || !password) return res.status(400).json({ error: 'Missing fields' });
      const admins = loadAdmins();
      console.log('🔍 Loaded admins count:', admins ? admins.length : 0);
      if (!admins || !admins.length) return res.status(503).json({ error: 'No admin accounts configured. Populate server/admins.json' });
      const hashed = hashPassword(String(password));
      console.log('🔐 Comparing hashes. Input ID:', idNumber, 'Available IDs:', admins.map(a => a.idNumber));
      const match = admins.find(a => String(a.idNumber) === String(idNumber) && String(a.password) === hashed);
      if (!match) {
        console.log('❌ No match found for Super Admin', idNumber);
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      const token = generateToken();
      try {
        const updated = admins.map(a => {
          if (a.idNumber === match.idNumber) { a.token = token; a.lastLogin = new Date().toISOString(); }
          return a;
        });
        storage.saveAdmins(updated);
      } catch (wErr) { console.warn('Failed to persist admin token', wErr); }
      return res.json({ success: true, token, admin: { email: match.email || '', idNumber: match.idNumber, name: match.name || 'Super Admin', role: 'superadmin' } });
    }

    // Admins and instructors are managed in users store
    if (!email || !password) return res.status(400).json({ error: 'Missing fields' });
    const users = loadUsers();
    const user = users[email];
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    if (user.role !== role) return res.status(403).json({ error: 'Role mismatch' });
    const hashed = hashPassword(String(password));
    if (String(user.password) !== String(hashed)) return res.status(401).json({ error: 'Invalid credentials' });
    if (role === 'admin') {
      // admin requires secret key
      const storedSecret = user.secret || '';
      if (!secret || hashPassword(String(secret)) !== storedSecret) return res.status(401).json({ error: 'Invalid secret key' });
    }

    // create token and persist to user record
    const token = generateToken();
    try {
      const allUsers = loadUsers();
      if (allUsers[email]) { allUsers[email].token = token; allUsers[email].lastLogin = new Date().toISOString(); saveUsers(allUsers); }
    } catch (wErr) { console.warn('Failed to persist user token', wErr); }

    return res.json({ success: true, token, admin: { email: user.email, name: user.name || '', role: user.role } });
  } catch (err) {
    console.error('admin-login error', err);
    res.status(500).json({ error: 'Admin login failed' });
  }
});

// ===== HELP ENDPOINTS =====
// Receive a help message (with optional file)
app.post('/api/help/message', async (req, res) => {
  try {
    const { text, fileName, fileData, sessionId, userName, userEmail } = req.body || {};
    console.log('📨 Received help message:', { text: text?.slice(0, 50), userEmail, userName, fileName, sessionId });
    
    // Check if this session is terminated - that's the only reason to reject
    if (sessionId) {
      const sessions = loadSessions();
      if (sessions[sessionId] && sessions[sessionId].status === 'terminated') {
        console.log('❌ Message rejected: Session is terminated:', sessionId);
        return res.status(403).json({ error: 'Chat session has been terminated' });
      }
    }
    
    const message = { text: text || '', files: [], from: 'User', ts: Date.now(), sessionId: sessionId || null, userEmail: userEmail || 'guest@example.com', userName: userName || 'Guest User' };
    console.log('📝 Message object created:', { userEmail: message.userEmail, userName: message.userName });

    if (fileName && fileData) {
      // fileData expected to be a base64 data URL or raw base64 string
      let base64 = fileData;
      const matches = /data:.*;base64,(.*)/.exec(fileData);
      if (matches) base64 = matches[1];
      let buffer;
      try {
        buffer = Buffer.from(base64, 'base64');
      } catch (bErr) {
        console.error('Invalid base64 data for uploaded file', bErr);
        return res.status(400).json({ error: 'Invalid file data' });
      }
      // limit file size to 100MB (supports video uploads)
      if (buffer.length > 100 * 1024 * 1024) {
        return res.status(413).json({ error: 'File too large (max 100MB)' });
      }
      const safeName = `${Date.now()}_${fileName.replace(/[^a-zA-Z0-9.\-]/g, '_')}`;
      const saveTo = path.join(UPLOADS_DIR, safeName);
      try {
        fs.writeFileSync(saveTo, buffer);
        message.files.push({ name: fileName, url: `/server/uploads/${safeName}` });
        console.log('✅ File saved:', safeName);
      } catch (fsErr) {
        console.error('Failed to save uploaded file', fsErr);
        return res.status(500).json({ error: 'Failed to save file' });
      }
    }

    const list = loadHelp();
    console.log('📖 Loaded help messages. Count:', list.length);
    list.push(message);
    saveHelp(list);
    console.log('✅ Message saved to help.json. Total messages:', list.length);
    
    // ensure session exists - use sessionId if provided, otherwise email
    if (sessionId) {
      const sessions = loadSessions();
      console.log('📋 Loaded sessions:', Object.keys(sessions));
      if (!sessions[sessionId]) {
        sessions[sessionId] = { 
          id: sessionId,
          sessionId: sessionId,
          email: message.userEmail,
          name: message.userName || 'Guest User',
          createdAt: new Date(message.ts).toISOString(), 
          accepted: false, 
          acceptedBy: null, 
          active: false,
          opened: false,
          status: 'active'
        };
        saveSessions(sessions);
        console.log('✅ New session created for:', sessionId);
      } else {
        // update lastActivity and user name, ensure status is not terminated
        sessions[sessionId].lastActivity = message.ts;
        if (message.userName) sessions[sessionId].name = message.userName;
        if (sessions[sessionId].status === 'terminated') {
          sessions[sessionId].status = 'active'; // Re-activate if message comes in
        }
        saveSessions(sessions);
        console.log('✅ Session updated for:', sessionId);
      }
      console.log('📋 Sessions after save:', Object.keys(loadSessions()));
    } else if (message.userEmail) {
      // Fallback to email-based session (backward compatibility)
      const sessions = loadSessions();
      const emailKey = message.userEmail;
      if (!sessions[emailKey]) {
        sessions[emailKey] = { 
          id: emailKey,
          email: message.userEmail,
          name: message.userName || 'Guest User',
          createdAt: new Date(message.ts).toISOString(), 
          accepted: false, 
          acceptedBy: null, 
          active: false,
          opened: false,
          status: 'active'
        };
        saveSessions(sessions);
        console.log('✅ New session created for:', emailKey);
      } else {
        sessions[emailKey].lastActivity = message.ts;
        if (message.userName) sessions[emailKey].name = message.userName;
        saveSessions(sessions);
        console.log('✅ Session updated for:', emailKey);
      }
    } else {
      console.log('⚠️  No sessionId or userEmail in message, session not created');
    }
    // notify connected SSE clients to refresh
    try { notifyHelpUpdate(); } catch (e) { /* ignore */ }
    res.json({ success: true });
  } catch (err) {
    console.error('help message error', err);
    res.status(500).json({ error: 'Failed to save message' });
  }
});

// List help messages
app.get('/api/help/messages', (req, res) => {
  try {
    const list = loadHelp();
    const sessionId = req.query.sessionId;
    const email = req.query.email;
    
    // Priority: sessionId > email > all
    if (sessionId) {
      return res.json(list.filter(m => String(m.sessionId || '') === String(sessionId)));
    }
    if (email) {
      return res.json(list.filter(m => (m.userEmail || '') === email));
    }
    res.json(list);
  } catch (err) {
    console.error('help list error', err);
    res.status(500).json({ error: 'Failed to load messages' });
  }
});

// List chat sessions (live requests)
app.get('/api/help/sessions', (req, res) => {
  try {
    const sessions = loadSessions();
    // compute counts and last message for each session
    const list = loadHelp();
    const out = Object.values(sessions).map(s => {
      const msgs = list.filter(m => String(m.sessionId || '') === String(s.sessionId));
      const last = msgs.length ? msgs[msgs.length-1] : null;
      return Object.assign({}, s, { messages: msgs.length, lastMessage: last ? last.text : '', lastTs: last ? last.ts : s.createdAt });
    }).sort((a,b) => (b.lastTs||0)-(a.lastTs||0));
    res.json(out);
  } catch (err) { console.error('sessions list error', err); res.status(500).json({ error: 'Failed to load sessions' }); }
});

// Accept a session (admin picks up chat)
app.post('/api/help/accept', (req, res) => {
  try {
    const { sessionId, admin } = req.body || {};
    if (!sessionId) return res.status(400).json({ error: 'sessionId required' });
    const sessions = loadSessions();
    sessions[sessionId] = sessions[sessionId] || { sessionId, createdAt: Date.now(), accepted: false, active: false };
    sessions[sessionId].accepted = true;
    sessions[sessionId].acceptedBy = admin || 'Admin';
    sessions[sessionId].acceptedAt = Date.now();
    sessions[sessionId].active = true;
    saveSessions(sessions);
    try { notifyHelpUpdate(); } catch (e) {}
    res.json({ success: true, session: sessions[sessionId] });
  } catch (err) { console.error('accept session error', err); res.status(500).json({ error: 'Failed to accept session' }); }
});

// Set session active/inactive
app.post('/api/help/session-set-active', (req, res) => {
  try {
    const { sessionId, active } = req.body || {};
    if (!sessionId) return res.status(400).json({ error: 'sessionId required' });
    const sessions = loadSessions();
    if (!sessions[sessionId]) return res.status(404).json({ error: 'Session not found' });
    sessions[sessionId].active = !!active;
    // If deactivating, schedule removal shortly after to clean up requests
    if (!sessions[sessionId].active) {
      // set a closing timestamp 30 seconds in the future
      sessions[sessionId].closingAt = Date.now() + 30 * 1000;
    } else {
      // ensure closingAt is cleared when re-activated
      delete sessions[sessionId].closingAt;
    }
    saveSessions(sessions);
    try { notifyHelpUpdate(); } catch (e) {}
    res.json({ success: true });
  } catch (err) { console.error('session-set-active error', err); res.status(500).json({ error: 'Failed to set active' }); }
});

// Delete a session and its messages immediately
app.post('/api/help/session-delete', (req, res) => {
  try {
    const { sessionId } = req.body || {};
    if (!sessionId) return res.status(400).json({ error: 'sessionId required' });
    const sessions = loadSessions();
    if (!sessions[sessionId]) return res.status(404).json({ error: 'Session not found' });
    // remove session
    delete sessions[sessionId];
    saveSessions(sessions);
    // remove associated messages
    try {
      const msgs = loadHelp().filter(m => String(m.sessionId || '') !== String(sessionId));
      saveHelp(msgs);
    } catch (e) { console.error('Failed to remove messages for deleted session', sessionId, e); }
    try { notifyHelpUpdate(); } catch (e) {}
    res.json({ success: true });
  } catch (err) { console.error('session-delete error', err); res.status(500).json({ error: 'Failed to delete session' }); }
});

// Periodic cleanup: remove sessions that have been closed for long enough
function cleanupClosedSessions() {
  try {
    const sessions = loadSessions();
    let changed = false;
    const now = Date.now();
    for (const sid of Object.keys(sessions)) {
      const s = sessions[sid];
      if (s && s.closingAt && now >= s.closingAt) {
        // delete session entry
        delete sessions[sid];
        changed = true;
        // also remove messages tied to this session
        try {
          const msgs = loadHelp().filter(m => String(m.sessionId || '') !== String(sid));
          saveHelp(msgs);
        } catch (e) { console.error('Failed to remove messages for closed session', sid, e); }
      }
    }
    if (changed) {
      saveSessions(sessions);
      try { notifyHelpUpdate(); } catch (e) {}
    }
  } catch (e) { console.error('cleanupClosedSessions error', e); }
}

// Run cleanup periodically (every 10 seconds) and once on startup
setInterval(cleanupClosedSessions, 10 * 1000);
cleanupClosedSessions();

// Server-Sent Events stream for real-time updates
app.get('/api/help/stream', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive'
  });
  // send a ping comment to establish the stream
  res.write(': connected\n\n');
  sseClients.push(res);
  req.on('close', () => {
    const idx = sseClients.indexOf(res);
    if (idx !== -1) sseClients.splice(idx, 1);
  });
});

// Admin Chat SSE stream - for real-time updates across all admin accounts
app.get('/api/admin/chat/stream', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive'
  });
  // send a ping comment to establish the stream
  res.write(': connected\n\n');
  adminChatSSEClients.push(res);
  req.on('close', () => {
    const idx = adminChatSSEClients.indexOf(res);
    if (idx !== -1) adminChatSSEClients.splice(idx, 1);
  });
});

// Notify all admins when a chat is opened
app.post('/api/admin/chat/notify', (req, res) => {
  try {
    const { sessionId } = req.body || {};
    console.log('📢 Broadcasting chat update for sessionId:', sessionId);
    
    // Mark session as opened/attended on the server
    const sessions = loadSessions();
    if (!sessions[sessionId]) {
      // Create session entry if it doesn't exist (new chats from help messages)
      sessions[sessionId] = {
        id: sessionId,
        sessionId: sessionId,
        status: 'open',
        opened: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      console.log('📝 Created new session entry for:', sessionId);
    }
    
    sessions[sessionId].opened = true;
    sessions[sessionId].openedAt = new Date().toISOString();
    saveSessions(sessions);
    console.log('✅ Session marked as opened:', sessionId);
    
    notifyAdminChatUpdate();
    res.json({ success: true });
  } catch (err) {
    console.error('Error notifying admins:', err);
    res.status(500).json({ error: 'Failed to notify' });
  }
});

// Admin reply endpoint (append admin message)
app.post('/api/help/reply', (req, res) => {
  try {
    const { text, from, sessionId } = req.body || {};
    if (!text) return res.status(400).json({ error: 'Text required' });
    const list = loadHelp();
    const msg = { text, from: from || 'Admin', ts: Date.now(), files: [], sessionId: sessionId || null };
    list.push(msg);
    saveHelp(list);
    // update session activity and ensure session exists properly
    if (msg.sessionId) {
      const sessions = loadSessions();
      if (!sessions[msg.sessionId]) {
        // Create proper session object if it doesn't exist
        sessions[msg.sessionId] = { 
          id: msg.sessionId,
          sessionId: msg.sessionId,
          status: 'active',
          opened: false,
          createdAt: new Date(msg.ts).toISOString(),
          updatedAt: new Date(msg.ts).toISOString()
        };
      } else {
        // Update existing session
        sessions[msg.sessionId].lastActivity = msg.ts;
        sessions[msg.sessionId].updatedAt = new Date(msg.ts).toISOString();
      }
      saveSessions(sessions);
    }
    // notify connected SSE clients (users/admin) to refresh
    try { notifyHelpUpdate(); } catch (e) { /* ignore */ }
    res.json({ success: true });
  } catch (err) {
    console.error('help reply error', err);
    res.status(500).json({ error: 'Failed to save reply' });
  }
});

// Terminate chat: append a system message indicating termination
app.post('/api/help/terminate', (req, res) => {
  try {
    const { sessionId, text } = req.body || {};
    const list = loadHelp();
    list.push({ text: text || 'Chat closed by admin', from: 'System', ts: Date.now(), files: [], sessionId: sessionId || null });
    saveHelp(list);
    
    // Mark session as terminated
    if (sessionId) {
      const sessions = loadSessions();
      if (sessions[sessionId]) {
        sessions[sessionId].status = 'terminated';
        sessions[sessionId].terminatedAt = new Date().toISOString();
        saveSessions(sessions);
        console.log('✅ Session marked as terminated:', sessionId);
      }
    }
    
    try { notifyHelpUpdate(); } catch (e) {}
    res.json({ success: true });
  } catch (err) {
    console.error('help terminate error', err);
    res.status(500).json({ error: 'Failed to terminate chat' });
  }
});

// Clear chat: remove all messages
app.post('/api/help/clear', (req, res) => {
  try {
    saveHelp([]);
    try { notifyHelpUpdate(); } catch (e) {}
    res.json({ success: true });
  } catch (err) {
    console.error('help clear error', err);
    res.status(500).json({ error: 'Failed to clear chat' });
  }
});

// Serve uploads (under /server/uploads/*)
app.use('/server/uploads', express.static(UPLOADS_DIR));

// Mark a user as premium. Accepts Authorization: Bearer <token> OR { email }
app.post('/api/auth/mark-premium', (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    const { email: bodyEmail } = req.body || {};

    const users = loadUsers();
    let targetEmail = null;

    if (token) {
      for (const [email, user] of Object.entries(users)) {
        if (user.token === token) {
          targetEmail = email;
          break;
        }
      }
    }

    if (!targetEmail && bodyEmail) {
      targetEmail = bodyEmail;
    }

    if (!targetEmail) {
      return res.status(400).json({ error: 'No authenticated user or email provided' });
    }

    if (users[targetEmail]) {
      users[targetEmail].hasPremium = true;
      users[targetEmail].premiumActivatedAt = new Date().toISOString();
    } else {
      users[targetEmail] = {
        name: '',
        email: targetEmail,
        password: null,
        token: null,
        hasPremium: true,
        premiumActivatedAt: new Date().toISOString(),
        createdAt: new Date().toISOString()
      };
    }

    saveUsers(users);

    // Send premium activation notification
    (async () => {
      try {
        await createNotification(targetEmail, {
          type: 'offer',
          title: `🎉 Premium Activated!`,
          message: `Welcome to Premium! You now have access to all exclusive courses and features. Happy learning!`,
          icon: 'fa-star',
          actionUrl: '/courses.html'
        });
      } catch (notifErr) {
        console.warn('Failed to create premium notification:', notifErr);
      }
    })();

    // Add system message for admin notification
    addSystemMessage(
      'premium',
      `Premium Subscription Activated: ${users[targetEmail].name || targetEmail}`,
      `A user has activated a premium subscription.`,
      {
        email: targetEmail,
        name: users[targetEmail].name,
        activatedAt: users[targetEmail].premiumActivatedAt
      }
    );

    console.log(`✅ Marked ${targetEmail} as premium via mark-premium endpoint`);
    res.json({ success: true, email: targetEmail });
  } catch (err) {
    console.error('Error marking premium:', err);
    res.status(500).json({ error: 'Failed to mark premium' });
  }
});

// Cancel premium subscription
app.post('/api/auth/cancel-premium', (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    const users = loadUsers();
    let targetEmail = null;

    if (token) {
      for (const [email, user] of Object.entries(users)) {
        if (user.token === token) {
          targetEmail = email;
          break;
        }
      }
    }

    if (!targetEmail) {
      return res.status(401).json({ error: 'No authenticated user' });
    }

    if (users[targetEmail]) {
      // Set cancellation flags instead of immediately removing premium
      users[targetEmail].premiumCancelled = true;
      users[targetEmail].premiumCancelledAt = new Date().toISOString();
      saveUsers(users);
      console.log(`✅ Cancelled premium for ${targetEmail} - access retained until period end`);

      // Add system message for cancellation
      const user = users[targetEmail];
      addSystemMessage(
        'premium',
        'Premium Subscription Cancelled',
        `User ${user.name || 'Unknown'} (${targetEmail}) has cancelled their premium subscription.`,
        {
          email: targetEmail,
          name: user.name || 'Unknown',
          cancelledAt: new Date().toISOString()
        }
      );

      // Send cancellation email
      try {
        const siteUrl = process.env.SITE_URL || 'https://renewable-energy-hubbc.onrender.com';
        const cancellationEmail = buildPremiumCancellationEmail({
          name: user.name,
          email: targetEmail,
          siteUrl
        });
        sendEmail(targetEmail, cancellationEmail.subject, cancellationEmail.text, cancellationEmail.html);
        console.log(`📧 Cancellation email sent to ${targetEmail}`);
      } catch (emailErr) {
        console.error('Failed to send cancellation email:', emailErr);
        // Don't fail the request if email fails
      }

      res.json({ success: true, email: targetEmail });
    } else {
      res.status(404).json({ error: 'User not found' });
    }
  } catch (err) {
    console.error('Error canceling premium:', err);
    res.status(500).json({ error: 'Failed to cancel premium' });
  }
});

// Send premium confirmation email
app.post('/api/auth/send-premium-email', async (req, res) => {
  try {
    const { email, name } = req.body || {};

    if (!email) {
      return res.status(400).json({ error: 'Email address is required' });
    }

    const siteUrl = process.env.SITE_URL || 'https://renewable-energy-hubbc.onrender.com';
    const premiumEmail = buildPremiumConfirmationEmail({
      name: name || '',
      email,
      siteUrl,
      planDetails: {
        plan: 'Premium Access',
        cost: 'MWK 16,000 / USD 8',
        duration: '1 month (30 days)'
      }
    });

    const sent = await sendEmail(email, premiumEmail.subject, premiumEmail.text, premiumEmail.html);
    
    if (sent) {
      console.log(`✅ Premium confirmation email sent to ${email}`);
      res.json({ success: true, email });
    } else {
      console.warn(`⚠️ Failed to send premium confirmation email to ${email}`);
      res.status(500).json({ error: 'Failed to send confirmation email (check server logs)', debug: lastEmailAttempt });
    }
  } catch (err) {
    console.error('Error sending premium email:', err);
    res.status(500).json({ error: 'Failed to send premium confirmation email', debug: err && err.message ? err.message : String(err) });
  }
});

// Update user profile
app.post('/api/auth/update-profile', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    const { name, email: newEmail, avatar } = req.body;
    
    console.log('📝 UPDATE-PROFILE: avatar received?', !!avatar, avatar ? `(length: ${avatar.length})` : '(none)');

    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    if (!name || !newEmail) {
      return res.status(400).json({ error: 'Name and email are required' });
    }

    const users = loadUsers();
    let targetEmail = null;

    // Find user by token
    for (const [userEmail, user] of Object.entries(users)) {
      if (user.token === token) {
        targetEmail = userEmail;
        break;
      }
    }

    if (!targetEmail) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const user = users[targetEmail];

    // Check if new email is already taken (and not by the same user)
    if (newEmail !== targetEmail && users[newEmail]) {
      return res.status(409).json({ error: 'Email is already in use' });
    }

    // Update name
    user.name = name;
    
    // Update avatar if provided - save to disk instead of storing in DB
    if (avatar) {
      console.log(`📸 Avatar provided, length: ${avatar.length}`);
      const avatarUrl = avatarManager.saveAvatar(newEmail || targetEmail, avatar);
      if (avatarUrl) {
        user.avatarUrl = avatarUrl;
        // Don't store the full data URL in the database, just the URL
        delete user.avatar;
      }
    }

    // If email changed, move the user to new key
    if (newEmail !== targetEmail) {
      users[newEmail] = user;
      user.email = newEmail;
      user.emailVerified = false; // Require verification for new email
      delete users[targetEmail];

      // Send verification email
      try {
        const siteUrl = process.env.SITE_URL || 'https://renewable-energy-hubbc.onrender.com';
        const verificationCode = Math.random().toString().slice(2, 8);
        user.emailVerificationCode = verificationCode;
        user.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

        const verificationEmail = {
          subject: 'Verify Your New Email Address - Aubie RET Hub',
          text: `Hello ${user.name},\n\nYour new email address is: ${newEmail}\n\nVerification Code: ${verificationCode}\n\nThis code will expire in 24 hours.`,
          html: `<div style="font-family: Poppins, Arial, sans-serif; color: #333;">
            <h2>Verify Your New Email</h2>
            <p>Hello ${escapeHtml(user.name)},</p>
            <p>Your new email address is: <strong>${escapeHtml(newEmail)}</strong></p>
            <p>Verification Code: <strong style="font-size: 18px;">${verificationCode}</strong></p>
            <p><small>This code will expire in 24 hours.</small></p>
          </div>`
        };

        await sendEmail(newEmail, verificationEmail.subject, verificationEmail.text, verificationEmail.html);
      } catch (emailErr) {
        console.warn('Failed to send email verification:', emailErr);
      }
    }

    saveUsers(users);
    console.log(`✅ Profile updated for ${newEmail}`);

    res.json({ success: true, user: { email: user.email, name: user.name, avatarUrl: user.avatarUrl } });
  } catch (err) {
    console.error('Error updating profile:', err);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Verify email with verification code
app.post('/api/verify-email', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Not authenticated' });

    const users = loadUsers();
    
    // Find user by token
    let currentUser = null;
    let currentEmail = null;
    for (const [email, user] of Object.entries(users)) {
      if (user.token === token) {
        currentUser = user;
        currentEmail = email;
        break;
      }
    }
    
    if (!currentUser) return res.status(401).json({ error: 'Invalid token' });

    const { email, verificationCode } = req.body;
    if (!email || !verificationCode) {
      return res.status(400).json({ error: 'Email and verification code required' });
    }

    const user = users[email];

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if verification code matches
    if (user.emailVerificationCode !== verificationCode) {
      return res.status(400).json({ error: 'Incorrect code' });
    }

    // Check if code has expired
    if (new Date() > new Date(user.emailVerificationExpires)) {
      return res.status(400).json({ error: 'Code expired' });
    }

    // Mark email as verified
    user.emailVerified = true;
    delete user.emailVerificationCode;
    delete user.emailVerificationExpires;

    saveUsers(users);
    console.log(`✅ Email verified for ${email}`);

    res.json({ 
      success: true, 
      message: 'Email verified successfully',
      user: { email: user.email, name: user.name, emailVerified: user.emailVerified }
    });
  } catch (err) {
    console.error('Error verifying email:', err);
    res.status(500).json({ error: 'Failed to verify email' });
  }
});

// Resend verification code
app.post('/api/resend-verification-code', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Not authenticated' });

    const users = loadUsers();
    
    // Find user by token
    let currentUser = null;
    for (const [email, user] of Object.entries(users)) {
      if (user.token === token) {
        currentUser = user;
        break;
      }
    }
    
    if (!currentUser) return res.status(401).json({ error: 'Invalid token' });

    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email required' });
    }

    const user = users[email];

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.emailVerified) {
      return res.status(400).json({ error: 'Email is already verified' });
    }

    // Generate new verification code
    const verificationCode = Math.random().toString().slice(2, 8);
    user.emailVerificationCode = verificationCode;
    user.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    // Send verification email
    try {
      const verificationEmail = {
        subject: 'Verify Your Email Address - Aubie RET Hub',
        text: `Hello ${user.name},\n\nVerification Code: ${verificationCode}\n\nThis code will expire in 24 hours.`,
        html: `<div style="font-family: Poppins, Arial, sans-serif; color: #333;">
          <h2>Verify Your Email</h2>
          <p>Hello ${escapeHtml(user.name)},</p>
          <p>Verification Code: <strong style="font-size: 18px;">${verificationCode}</strong></p>
          <p><small>This code will expire in 24 hours.</small></p>
        </div>`
      };

      const emailResult = await sendEmail(email, verificationEmail.subject, verificationEmail.text, verificationEmail.html);
      console.log(`📧 Verification email sent to ${email}, result:`, emailResult);
    } catch (emailErr) {
      console.error('Failed to send verification email:', emailErr);
    }

    saveUsers(users);
    console.log(`✅ Resent verification code to ${email}`);

    res.json({ 
      success: true, 
      message: 'Verification code sent to your email'
    });
  } catch (err) {
    console.error('Error resending verification code:', err);
    res.status(500).json({ error: 'Failed to resend verification code' });
  }
});

// Generate course completion certificate
app.post('/api/certificates/generate', (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    const { courseId, courseName } = req.body;

    if (!token || !courseId || !courseName) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const users = loadUsers();
    let targetEmail = null;

    // Find user by token
    for (const [email, user] of Object.entries(users)) {
      if (user.token === token) {
        targetEmail = email;
        break;
      }
    }

    if (!targetEmail) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const user = users[targetEmail];
    user.certificates = user.certificates || [];

    // Check if certificate already exists for this course
    const existingCert = user.certificates.find(c => c.courseId === courseId);
    if (existingCert) {
      return res.json({ success: true, certificate: existingCert });
    }

    // Generate new certificate
    const certificate = {
      id: Math.random().toString(36).slice(2, 11),
      courseId,
      courseName,
      studentName: user.name,
      studentEmail: user.email,
      completedDate: new Date().toISOString(),
      certificateNumber: `CERT-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`
    };

    user.certificates.push(certificate);
    saveUsers(users);

    // Notify user about certificate
    (async () => {
      try {
        await createNotification(targetEmail, {
          type: 'certificate',
          title: '📜 Certificate Earned!',
          message: `Congratulations! You earned a certificate for completing ${courseName}!`,
          icon: 'fa-award',
          actionUrl: '/progress.html'
        });
      } catch (notifErr) {
        console.warn('Failed to create certificate notification:', notifErr);
      }
    })();

    console.log(`✅ Certificate generated for ${targetEmail}: ${courseId}`);
    res.json({ success: true, certificate });
  } catch (err) {
    console.error('Error generating certificate:', err);
    res.status(500).json({ error: 'Failed to generate certificate' });
  }
});

// Get user certificates
app.get('/api/certificates', (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const users = loadUsers();
    let targetEmail = null;

    for (const [email, user] of Object.entries(users)) {
      if (user.token === token) {
        targetEmail = email;
        break;
      }
    }

    if (!targetEmail) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const user = users[targetEmail];
    const certificates = user.certificates || [];

    res.json({ success: true, certificates });
  } catch (err) {
    console.error('Error fetching certificates:', err);
    res.status(500).json({ error: 'Failed to fetch certificates' });
  }
});

// Start free trial (2 days)
app.post('/api/auth/start-free-trial', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const users = loadUsers();
    let targetEmail = null;

    for (const [email, user] of Object.entries(users)) {
      if (user.token === token) {
        targetEmail = email;
        break;
      }
    }

    if (!targetEmail) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const user = users[targetEmail];

    // Check if they already used trial
    if (user.premiumTrialUsed) {
      return res.status(409).json({ error: 'You have already used your free trial' });
    }

    // Check if already premium
    if (user.hasPremium && !user.premiumTrialExpires) {
      return res.status(409).json({ error: 'You already have an active premium subscription' });
    }

    // Activate 2-day trial
    const trialEndDate = new Date();
    trialEndDate.setDate(trialEndDate.getDate() + 2);

    user.hasPremium = true;
    user.premiumActivatedAt = new Date().toISOString();
    user.premiumTrialExpires = trialEndDate.toISOString();
    user.premiumTrialUsed = true;
    user.premiumCancelled = false;

    saveUsers(users);

    // Send trial activation email
    try {
      const trialEmail = {
        subject: 'Your 2-Day Premium Trial Has Started - Aubie RET Hub',
        text: `Hello ${user.name},\n\nWelcome to Premium! Your 2-day free trial is now active.\n\nTrial expires on: ${trialEndDate.toLocaleDateString()}\n\nYou'll be charged automatically after the trial ends unless you cancel beforehand.`,
        html: `<div style="font-family: Poppins, Arial, sans-serif; color: #333;">
          <h2>Welcome to Premium!</h2>
          <p>Hello ${escapeHtml(user.name)},</p>
          <p>Your 2-day free trial is now active.</p>
          <p><strong>Trial expires on:</strong> ${trialEndDate.toLocaleDateString()}</p>
          <p>You'll be charged automatically after the trial ends unless you cancel beforehand from your Account page.</p>
          <p>Enjoy all premium features!</p>
        </div>`
      };

      await sendEmail(targetEmail, trialEmail.subject, trialEmail.text, trialEmail.html);
    } catch (emailErr) {
      console.warn('Failed to send trial email:', emailErr);
    }

    console.log(`✅ 2-day trial started for ${targetEmail}`);
    res.json({ 
      success: true, 
      message: 'Your 2-day free trial has started!',
      trialExpiresAt: trialEndDate.toISOString()
    });
  } catch (err) {
    console.error('Error starting free trial:', err);
    res.status(500).json({ error: 'Failed to start free trial' });
  }
});

// Test endpoint: Mark course as complete and generate certificate
app.post('/api/test/complete-course', (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    const { courseId, courseName } = req.body;

    if (!token || !courseId || !courseName) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const users = loadUsers();
    let targetEmail = null;

    for (const [email, user] of Object.entries(users)) {
      if (user.token === token) {
        targetEmail = email;
        break;
      }
    }

    if (!targetEmail) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const user = users[targetEmail];
    user.completedCourses = user.completedCourses || [];

    // Mark as completed
    if (!user.completedCourses.includes(courseId)) {
      user.completedCourses.push(courseId);
    }

    user.certificates = user.certificates || [];

    // Check if certificate already exists
    const existingCert = user.certificates.find(c => c.courseId === courseId);
    let certificate = existingCert;

    if (!existingCert) {
      certificate = {
        id: Math.random().toString(36).slice(2, 11),
        courseId,
        courseName,
        studentName: user.name,
        studentEmail: user.email,
        completedDate: new Date().toISOString(),
        certificateNumber: `CERT-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`
      };
      user.certificates.push(certificate);
    }

    saveUsers(users);
    console.log(`✅ Test: Course ${courseId} marked complete for ${targetEmail}`);

    res.json({ success: true, message: 'Course marked as complete', certificate });
  } catch (err) {
    console.error('Error completing course:', err);
    res.status(500).json({ error: 'Failed to complete course' });
  }
});

// Download certificate as PDF (will generate a simple HTML version)
app.get('/api/certificates/:certId/download', (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    const { certId } = req.params;

    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const users = loadUsers();
    let targetEmail = null;

    for (const [email, user] of Object.entries(users)) {
      if (user.token === token) {
        targetEmail = email;
        break;
      }
    }

    if (!targetEmail) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const user = users[targetEmail];
    const certificate = (user.certificates || []).find(c => c.id === certId);

    if (!certificate) {
      return res.status(404).json({ error: 'Certificate not found' });
    }

    // Generate HTML certificate content
    // Extract date directly from ISO string to avoid timezone shifts
    const isoDate = certificate.completedDate.split('T')[0]; // e.g., "2026-02-02"
    const [isoYear, isoMonth, isoDay] = isoDate.split('-');
    const localDate = new Date(parseInt(isoYear), parseInt(isoMonth) - 1, parseInt(isoDay));
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Certificate - ${certificate.courseName}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          html, body { 
            width: 100%;
            height: 100%;
            margin: 0;
            padding: 0;
          }
          body { 
            font-family: 'Poppins', 'Segoe UI', 'Trebuchet MS', sans-serif; 
            background: linear-gradient(135deg, #00796b 0%, #0d8b7f 50%, #005a4f 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
            min-height: 100vh;
          }
          .certificate {
            width: 100%;
            max-width: 950px;
            background: linear-gradient(to bottom right, #ffffff 0%, #f0f9f8 100%);
            border: 4px solid #00796b;
            border-radius: 24px;
            padding: 80px 60px 50px 60px;
            text-align: center;
            box-shadow: 
              0 25px 70px rgba(0, 121, 107, 0.4),
              0 0 0 1px rgba(0, 121, 107, 0.1) inset,
              inset 0 1px 0 rgba(255, 255, 255, 0.8);
            position: relative;
            overflow: visible;
            display: flex;
            flex-direction: column;
            min-height: auto;
            background-image: 
              radial-gradient(circle at 15% 85%, rgba(0, 185, 138, 0.03) 0%, transparent 50%),
              radial-gradient(circle at 85% 15%, rgba(0, 121, 107, 0.03) 0%, transparent 50%),
              linear-gradient(to bottom right, #ffffff 0%, #f0f9f8 100%);
          }
          
          .certificate::before {
            content: '';
            position: absolute;
            top: -15px;
            left: 50%;
            transform: translateX(-50%);
            width: 100%;
            height: 15px;
            background: linear-gradient(90deg, transparent 0%, #00796b 25%, #00796b 75%, transparent 100%);
            border-radius: 50% 50% 0 0;
            z-index: 2;
          }
          
          .certificate::after {
            content: '';
            position: absolute;
            bottom: -15px;
            left: 50%;
            transform: translateX(-50%);
            width: 100%;
            height: 15px;
            background: linear-gradient(90deg, transparent 0%, #00796b 25%, #00796b 75%, transparent 100%);
            border-radius: 0 0 50% 50%;
            z-index: 2;
          }
          
          .seal {
            position: absolute;
            top: 30px;
            right: 30px;
            width: 100px;
            height: 100px;
            background: conic-gradient(from 0deg, #00796b 0deg, #00a88f 90deg, #005a4f 180deg, #00796b 270deg, #00796b 360deg);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            border: 4px solid #00796b;
            box-shadow: 
              0 8px 20px rgba(0, 121, 107, 0.5),
              0 0 0 8px rgba(0, 185, 138, 0.1);
            z-index: 10;
            flex-shrink: 0;
          }
          
          @keyframes fadeIn {
            0% { opacity: 0.8; }
            100% { opacity: 1; }
          }
          
          .seal-inner {
            width: 88px;
            height: 88px;
            background: white;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 40px;
            color: #00796b;
            box-shadow: inset 0 2px 8px rgba(0, 0, 0, 0.1);
          }
          
          .header-line {
            height: 4px;
            background: #00796b;
            margin-bottom: 30px;
            border-radius: 3px;
            z-index: 1;
            position: relative;
          }
          
          h1 { 
            font-size: 52px; 
            color: #00796b; 
            margin-bottom: 8px;
            margin-right: 120px;
            letter-spacing: 4px;
            font-weight: 700;
            text-transform: uppercase;
            z-index: 1;
            position: relative;
          }
          
          .subtitle { 
            font-size: 18px; 
            color: #00796b; 
            margin-bottom: 30px;
            font-weight: 600;
            z-index: 1;
            position: relative;
            letter-spacing: 1px;
            text-transform: uppercase;
          }
          
          .content { 
            margin: 30px 0;
            z-index: 1;
            position: relative;
            flex-grow: 1;
          }
          
          .certifies {
            font-size: 15px;
            color: #555;
            margin-bottom: 15px;
            font-style: italic;
            letter-spacing: 1.5px;
            font-weight: 500;
          }
          
          .student-name { 
            font-size: 42px; 
            font-weight: 700; 
            color: #00796b; 
            margin: 25px 0;
            border-bottom: 3px solid #00a88f;
            padding-bottom: 12px;
            text-transform: capitalize;
            letter-spacing: 1px;
          }
          
          .completion-text {
            font-size: 16px;
            color: #555;
            margin: 18px 0;
            letter-spacing: 1px;
            line-height: 1.6;
            font-weight: 500;
          }
          
          .course-name { 
            font-size: 26px; 
            color: #00796b;
            margin: 18px 0;
            font-weight: 700;
            font-style: italic;
            padding: 8px 0;
          }
          
          .details { 
            font-size: 13px; 
            color: #666; 
            margin-top: 25px;
            z-index: 1;
            position: relative;
            display: flex;
            justify-content: center;
            gap: 30px;
            flex-wrap: wrap;
          }
          
          .detail-item {
            display: flex;
            flex-direction: column;
            align-items: center;
          }
          
          .detail-label {
            font-size: 11px;
            color: #00796b;
            font-weight: 700;
            letter-spacing: 1px;
            text-transform: uppercase;
            margin-bottom: 4px;
          }
          
          .detail-value {
            font-size: 13px;
            color: #333;
            font-weight: 600;
          }
          
          .footer { 
            margin-top: 35px; 
            border-top: 3px dashed #00a88f; 
            padding-top: 15px;
            z-index: 1;
            position: relative;
          }
          
          .org-name {
            font-size: 14px;
            color: #00796b;
            font-weight: 700;
            margin-bottom: 8px;
            letter-spacing: 2px;
            text-transform: uppercase;
          }
          
          .cert-number { 
            font-size: 11px; 
            color: #999; 
            margin-top: 8px;
            letter-spacing: 1.5px;
            font-weight: 500;
            font-family: 'Monaco', 'Courier New', monospace;
          }
          
          @media print {
            body { background: white; padding: 0; }
            .certificate { box-shadow: none; border-radius: 0; }
          }
        </style>
      </head>
      <body>
        <div class="certificate">
          <div class="seal">
            <div class="seal-inner">⭐</div>
          </div>
          
          <div class="header-line"></div>
          
          <h1>Certificate</h1>
          <div class="subtitle">of Completion</div>
          
          <div class="content">
            <p class="certifies">This certificate recognizes that</p>
            <div class="student-name">${certificate.studentName}</div>
            <p class="completion-text">has successfully completed the course</p>
            <div class="course-name">"${certificate.courseName}"</div>
          </div>
          
          <div class="details">
            <div class="detail-item">
              <div class="detail-label">Completion Date</div>
              <div class="detail-value">${localDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
            </div>
          </div>
          
          <div class="footer">
            <div class="org-name">🌍 Aubie Renewable Energy Hub</div>
            <div class="cert-number">ID: ${certificate.certificateNumber}</div>
          </div>
        </div>
      </body>
    </html>`;

    // Send based on requested format
    const format = req.query.format || 'html';
    
    if (format === 'html') {
      // Send as HTML
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="certificate-${certificate.courseId}.html"`);
      res.send(htmlContent);
    } else if (format === 'pdf') {
      // For PDF, we'll use html2pdf library on the client side
      // Send HTML with PDF download instruction
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Content-Disposition', `inline; filename="certificate-${certificate.courseId}.pdf"`);
      
      // Wrap HTML with script to auto-download as PDF
      const pdfHtml = `
        ${htmlContent.replace('</body>', `
        <script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"><\/script>
        <script>
          window.onload = function() {
            const element = document.querySelector('.certificate');
            const opt = {
              margin: 10,
              filename: 'certificate-${certificate.courseId}.pdf',
              image: { type: 'jpeg', quality: 0.98 },
              html2canvas: { scale: 2 },
              jsPDF: { orientation: 'landscape', unit: 'mm', format: 'a4' }
            };
            html2pdf().set(opt).save();
          };
        <\/script>
        </body>`)}
      `;
      res.send(pdfHtml);
    } else if (format === 'image') {
      // For image, send HTML with canvas rendering
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Content-Disposition', `inline; filename="certificate-${certificate.courseId}.png"`);
      
      // Wrap HTML with script to auto-download as image
      const imageHtml = `
        ${htmlContent.replace('</body>', `
        <script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"><\/script>
        <script>
          window.onload = function() {
            setTimeout(() => {
              const element = document.querySelector('.certificate');
              html2canvas(element, {
                scale: 2,
                backgroundColor: '#ffffff',
                logging: false
              }).then(canvas => {
                const link = document.createElement('a');
                link.href = canvas.toDataURL('image/png');
                link.download = 'certificate-${certificate.courseId}.png';
                link.click();
              });
            }, 500);
          };
        <\/script>
        </body>`)}
      `;
      res.send(imageHtml);
    } else {
      // Default to HTML
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="certificate-${certificate.courseId}.html"`);
      res.send(htmlContent);
    }
  } catch (err) {
    console.error('Error downloading certificate:', err);
    res.status(500).json({ error: 'Failed to download certificate' });
  }
});

// Debug endpoint to inspect last email attempt
app.get('/api/debug-last-email', (req, res) => {
  try {
    res.json({ lastEmailAttempt });
  } catch (err) {
    res.status(500).json({ error: 'Failed to read last email attempt' });
  }
});

// ===== END AUTH ENDPOINTS =====

// ===== ADMIN INBOX / MESSAGES ENDPOINTS =====
// Helper function to add a system message
function addSystemMessage(type, title, content, details = null) {
  const messages = storage.loadMessages();
  const message = {
    id: crypto.randomBytes(16).toString('hex'),
    type, // 'registration', 'premium', 'password-reset', 'other'
    title,
    content,
    details,
    isRead: false,
    createdAt: new Date().toISOString()
  };
  messages.push(message);
  storage.saveMessages(messages);
  
  // Also save directly to MongoDB if connected
  if (db.isConnected()) {
    db.models.Message.create(message).catch(err => {
      console.error('Error saving message to MongoDB:', err.message);
    });
  }
  
  console.log(`📨 System message added: [${type}] ${title}`);
  return message;
}

// Get all messages (admin only)
app.get('/api/admin/messages', (req, res) => {
  try {
    const callerToken = req.headers.authorization?.split(' ')[1] || req.headers['x-admin-token'];
    console.log('📨 GET /api/admin/messages - token received:', callerToken ? callerToken.substring(0, 10) + '...' : 'NONE');
    const caller = getRoleFromToken(callerToken);
    console.log('📨 Token verified as:', caller ? caller.role : 'INVALID');
    
    // Only allow admin and superadmin
    if (!caller || (caller.role !== 'admin' && caller.role !== 'superadmin')) {
      console.log('📨 Access denied for role:', caller?.role);
      return res.status(403).json({ error: 'Unauthorized - admin access required' });
    }

    const messages = storage.loadMessages();
    console.log('📨 Returning', messages?.length || 0, 'messages');
    res.json({ messages: messages || [] });
  } catch (err) {
    console.error('Error fetching messages:', err);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// Clear all messages (admin only) - MUST come before /:id route
app.delete('/api/admin/messages/clear-all', (req, res) => {
  try {
    const callerToken = req.headers.authorization?.split(' ')[1] || req.headers['x-admin-token'];
    const caller = getRoleFromToken(callerToken);
    
    // Only allow admin and superadmin
    if (!caller || (caller.role !== 'admin' && caller.role !== 'superadmin')) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    storage.saveMessages([]);
    
    // Also delete from MongoDB if connected
    if (db.isConnected()) {
      db.models.Message.deleteMany({}).catch(err => {
        console.error('Error clearing messages from MongoDB:', err.message);
      });
    }
    
    res.json({ success: true });
  } catch (err) {
    console.error('Error clearing messages:', err);
    res.status(500).json({ error: 'Failed to clear messages' });
  }
});

// Delete a single message (admin only)
app.delete('/api/admin/messages/:id', (req, res) => {
  try {
    const callerToken = req.headers.authorization?.split(' ')[1] || req.headers['x-admin-token'];
    const caller = getRoleFromToken(callerToken);
    const { id } = req.params;
    
    // Only allow admin and superadmin
    if (!caller || (caller.role !== 'admin' && caller.role !== 'superadmin')) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    let messages = storage.loadMessages();
    messages = messages.filter(m => m.id !== id);
    storage.saveMessages(messages);
    
    // Also delete from MongoDB if connected
    if (db.isConnected()) {
      db.models.Message.deleteOne({ id }).catch(err => {
        console.error('Error deleting message from MongoDB:', err.message);
      });
    }
    
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting message:', err);
    res.status(500).json({ error: 'Failed to delete message' });
  }
});

// Mark a message as read (admin only)
app.patch('/api/admin/messages/:id/read', (req, res) => {
  try {
    const callerToken = req.headers.authorization?.split(' ')[1] || req.headers['x-admin-token'];
    const caller = getRoleFromToken(callerToken);
    const { id } = req.params;
    
    // Only allow admin and superadmin
    if (!caller || (caller.role !== 'admin' && caller.role !== 'superadmin')) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    let messages = storage.loadMessages();
    const message = messages.find(m => m.id === id);
    
    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    message.isRead = true;
    message.readAt = new Date().toISOString();
    storage.saveMessages(messages);
    
    // Also update in MongoDB if connected
    if (db.isConnected()) {
      db.models.Message.updateOne({ id }, { $set: { isRead: true, readAt: message.readAt } }).catch(err => {
        console.error('Error updating message in MongoDB:', err.message);
      });
    }
    
    res.json({ success: true });
  } catch (err) {
    console.error('Error marking message as read:', err);
    res.status(500).json({ error: 'Failed to mark message as read' });
  }
});

// Initiate payment with Paychangu
app.post('/api/payment', async (req, res) => {
  try {
    if (!paychangu) {
      return res.status(503).json({ error: 'Payment processor not configured. Set PAYCHANGU_PUBLIC_KEY and PAYCHANGU_SECRET_KEY in server/.env' });
    }

    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { amount, currency = 'MWK', paymentMethod } = req.body;
    if (!amount) {
      return res.status(400).json({ error: 'Missing amount' });
    }

    // Get user from token
    const users = loadUsers();
    let userEmail = null;
    let user = null;

    for (const [email, u] of Object.entries(users)) {
      if (u.token === token) {
        userEmail = email;
        user = u;
        break;
      }
    }

    if (!userEmail || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Generate unique transaction ID
    const transactionId = `RET-${Date.now()}-${Math.random().toString(36).slice(2, 9).toUpperCase()}`;

    // Initiate payment
    const paymentData = {
      amount: amount,
      currency: currency,
      email: userEmail,
      firstName: user.name?.split(' ')[0] || 'User',
      lastName: user.name?.split(' ')[1] || '',
      phoneNumber: user.phoneNumber || '',
      transactionId: transactionId,
      description: 'Premium Subscription - Renewable Energy Hub',
      paymentMethod: paymentMethod || null,
    };

    const response = await paychangu.initiatePayment(paymentData);

    console.log('Paychangu payment response:', JSON.stringify(response).substring(0, 300));

    // Store pending payment
    user.pendingPayment = {
      transactionId: transactionId,
      amount: amount,
      currency: currency,
      initiatedAt: new Date().toISOString(),
      status: 'pending'
    };
    saveUsers(users);

    console.log(`💳 Payment initiated for ${userEmail}: ${transactionId}`);
    
    // Extract the checkout URL from PayChangu response (it's at data.checkout_url)
    const checkoutUrl = response?.data?.checkout_url || response?.checkout_url || response?.link || response?.url;
    
    // Return response with checkout_url at top level for frontend compatibility
    const formattedResponse = {
      ...response,
      checkout_url: checkoutUrl
    };
    
    console.log(`🔗 Checkout URL: ${checkoutUrl}`);
    res.json(formattedResponse);
  } catch (err) {
    console.error('Error initiating payment:', err.message);
    console.error('Error stack:', err.stack);
    res.status(500).json({ error: err.message || 'Failed to initiate payment' });
  }
});

// Paychangu payment callback/webhook - Handle both GET (redirect) and POST (webhook)
app.all('/api/paychangu/callback', express.json(), async (req, res) => {
  try {
    // Get data from either GET query params or POST body
    const data = req.method === 'GET' ? req.query : req.body;
    const { status, tx_ref, amount, email } = data;

    console.log(`📱 Paychangu callback received (${req.method}): tx_ref=${tx_ref}, status=${status}, email=${email}`);

    // For GET requests (browser redirect after payment), auto-activate premium
    if (req.method === 'GET') {
      console.log(`🔄 User redirect from Paychangu for transaction: ${tx_ref}, email: ${email}`);
      
      // If we have tx_ref and email, auto-activate premium immediately
      if (tx_ref && email) {
        try {
          const users = loadUsers();
          console.log(`Looking for user: ${email}`);
          
          if (users[email]) {
            console.log(`✅ Found user: ${email}, activating premium...`);
            users[email].hasPremium = true;
            users[email].premiumActivatedAt = new Date().toISOString();
            users[email].lastPaymentRef = tx_ref;
            users[email].lastPaymentDate = new Date().toISOString();
            users[email].premiumCancelled = false;
            saveUsers(users);
            console.log(`✅ Premium auto-activated for ${email} (${tx_ref})`);
          } else {
            console.warn(`⚠️ User not found: ${email}`);
            // Create new user with premium
            users[email] = {
              name: '',
              email,
              password: null,
              token: null,
              hasPremium: true,
              premiumActivatedAt: new Date().toISOString(),
              createdAt: new Date().toISOString(),
              lastPaymentRef: tx_ref,
              lastPaymentDate: new Date().toISOString()
            };
            saveUsers(users);
            console.log(`✅ Created new premium user: ${email}`);
          }
        } catch (err) {
          console.error('❌ Error activating premium:', err.message);
        }
      } else {
        console.warn(`⚠️ Missing tx_ref or email for activation. tx_ref=${tx_ref}, email=${email}`);
      }
      
      // Redirect to billing.html with success flag
      return res.redirect(`/billing.html?payment=success&tx_ref=${tx_ref}`);
    }

    // POST requests are webhook callbacks from Paychangu (after they send confirmation emails)
    if (!tx_ref || !email) {
      console.warn(`⚠️ Paychangu callback missing data: tx_ref=${tx_ref}, email=${email}`);
      return res.status(400).json({ error: 'Missing required callback data' });
    }

    // Verify payment with Paychangu
    if (!paychangu) {
      console.error('❌ Paychangu processor not available');
      return res.status(503).json({ error: 'Payment processor not configured' });
    }

    console.log(`🔍 Verifying Paychangu payment: ${tx_ref} for ${email}`);
    const paymentVerification = await paychangu.verifyPayment(tx_ref);
    console.log('Payment verification response:', paymentVerification);

    // Check if payment was successful - only unlock premium on webhook confirmation
    if (paymentVerification && paymentVerification.status === 'success') {
      console.log(`✅ Payment verified successfully for ${tx_ref}`);
      const users = loadUsers();
      
      if (users[email]) {
        users[email].hasPremium = true;
        users[email].premiumActivatedAt = new Date().toISOString();
        users[email].lastPaymentRef = tx_ref;
        users[email].lastPaymentAmount = amount;
        users[email].lastPaymentDate = new Date().toISOString();
        users[email].premiumCancelled = false;
        
        // Clear pending payment
        if (users[email].pendingPayment) {
          users[email].pendingPayment.status = 'completed';
          users[email].pendingPayment.completedAt = new Date().toISOString();
        }
      } else {
        users[email] = {
          name: '',
          email,
          password: null,
          token: null,
          hasPremium: true,
          premiumActivatedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          lastPaymentRef: tx_ref,
          lastPaymentAmount: amount,
          lastPaymentDate: new Date().toISOString()
        };
      }
      saveUsers(users);
      console.log(`💾 User data saved with premium status for ${email}`);

      // Create premium activation notification
      try {
        await createNotification(email, {
          type: 'offer',
          title: `🎉 Premium Activated!`,
          message: `Welcome to Premium! You now have access to all exclusive courses and features. Happy learning!`,
          icon: 'fa-star',
          actionUrl: '/courses.html'
        });
      } catch (notifErr) {
        console.warn('Failed to create premium notification:', notifErr);
      }

      // Add system message for admin
      addSystemMessage(
        'premium',
        `Premium Subscription via Paychangu: ${users[email].name || email}`,
        `A user activated premium subscription via Paychangu payment.`,
        {
          email: email,
          name: users[email].name || '',
          transactionRef: tx_ref,
          amount: amount,
          activatedAt: users[email].premiumActivatedAt
        }
      );

      console.log(`✅ Premium activated for ${email} via Paychangu webhook (${tx_ref})`);
      return res.json({ success: true, message: 'Premium activated successfully' });
    } else {
      console.log(`❌ Payment verification failed for ${tx_ref}: ${paymentVerification?.status || 'unknown status'}`);
      return res.status(402).json({ error: 'Payment verification failed' });
    }
  } catch (err) {
    console.error('Error processing Paychangu callback:', err);
    res.status(500).json({ error: 'Failed to process payment callback' });
  }
});

// Paychangu Webhook - For server-to-server payment notifications
app.post('/webhook/paychangu', express.json(), async (req, res) => {
  try {
    const payload = req.body;
    const signature = req.headers['x-paychangu-signature'];

    console.log('🔔 Paychangu webhook received:', payload.tx_ref);

    // Verify webhook signature if provided
    if (signature && paychangu) {
      const expectedSignature = crypto
        .createHmac('sha256', process.env.PAYCHANGU_SECRET_KEY)
        .update(JSON.stringify(payload))
        .digest('hex');

      if (signature !== expectedSignature) {
        console.error('⚠️ Webhook signature verification failed');
        return res.status(403).json({ error: 'Signature verification failed' });
      }
    }

    const { status, tx_ref, email, amount } = payload;

    if (!tx_ref || !email) {
      return res.status(400).json({ error: 'Missing required webhook data' });
    }

    // Process successful payment
    if (status === 'success') {
      const users = loadUsers();

      if (users[email]) {
        users[email].hasPremium = true;
        users[email].premiumActivatedAt = new Date().toISOString();
        users[email].lastPaymentRef = tx_ref;
        users[email].lastPaymentAmount = amount;
        users[email].lastPaymentDate = new Date().toISOString();
        users[email].premiumCancelled = false;
      } else {
        users[email] = {
          name: '',
          email,
          password: null,
          token: null,
          hasPremium: true,
          premiumActivatedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          lastPaymentRef: tx_ref,
          lastPaymentAmount: amount,
          lastPaymentDate: new Date().toISOString()
        };
      }
      saveUsers(users);

      // Notification sent by backend only (no frontend email)
      try {
        await createNotification(email, {
          type: 'offer',
          title: `🎉 Premium Activated!`,
          message: `Welcome to Premium! You now have access to all exclusive courses and features.`,
          icon: 'fa-star',
          actionUrl: '/courses.html'
        });
      } catch (notifErr) {
        console.warn('Failed to create notification:', notifErr);
      }

      addSystemMessage(
        'premium',
        `Premium via Paychangu: ${users[email].name || email}`,
        `Premium activated via Paychangu webhook notification.`,
        {
          email,
          name: users[email].name || '',
          transactionRef: tx_ref,
          amount,
          source: 'webhook'
        }
      );

      console.log(`✅ Premium activated via webhook: ${email}`);
    }

    res.json({ received: true });
  } catch (err) {
    console.error('Error processing Paychangu webhook:', err);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// Test email endpoint
app.post('/api/test-email', async (req, res) => {
  try {
    const { to } = req.body;
    if (!to) {
      return res.status(400).json({ error: 'Email address required' });
    }

    const testEmail = {
      subject: 'Test Email from Aubie RET Hub',
      text: 'This is a test email to verify SMTP configuration.\n\nIf you received this, email sending is working correctly!',
      html: `
        <div style="font-family:Arial,Helvetica,sans-serif;padding:20px;">
          <h2>Test Email</h2>
          <p>This is a test email to verify SMTP configuration.</p>
          <p>If you received this, email sending is working correctly!</p>
          <p>Sent at: ${new Date().toISOString()}</p>
        </div>
      `
    };

    const success = await sendEmail(to, testEmail.subject, testEmail.text, testEmail.html);
    
    if (success) {
      res.json({ success: true, message: 'Test email sent successfully' });
    } else {
      res.status(500).json({ error: 'Failed to send test email' });
    }
  } catch (err) {
    console.error('Test email error:', err);
    res.status(500).json({ error: 'Test email failed' });
  }
});

// --- Bookmarks API ---
// Get user's bookmarks
app.get('/api/bookmarks', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const users = loadUsers();
    let userEmail = null;
    for (const [email, user] of Object.entries(users)) {
      if (user.token === token) {
        userEmail = email;
        break;
      }
    }
    if (!userEmail) return res.status(401).json({ error: 'Invalid token' });

    // Get bookmarks from MongoDB if connected
    let bookmarks = [];
    if (db.isConnected()) {
      try {
        bookmarks = await db.models.Bookmark.find({ userEmail });
      } catch (e) {
        console.warn('Failed to fetch bookmarks from MongoDB:', e.message);
      }
    }

    res.json(bookmarks || []);
  } catch (err) {
    console.error('Error fetching bookmarks:', err);
    res.status(500).json({ error: 'Failed to fetch bookmarks' });
  }
});

// Add bookmark
app.post('/api/bookmarks', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const { moduleId, courseId, moduleTitle } = req.body;
    if (!moduleId || !courseId) return res.status(400).json({ error: 'Missing moduleId or courseId' });

    const users = loadUsers();
    let userEmail = null;
    for (const [email, user] of Object.entries(users)) {
      if (user.token === token) {
        userEmail = email;
        break;
      }
    }
    if (!userEmail) return res.status(401).json({ error: 'Invalid token' });

    const bookmark = {
      userEmail,
      moduleId,
      courseId,
      moduleTitle: moduleTitle || moduleId,
      savedAt: new Date().toISOString()
    };

    if (db.isConnected()) {
      try {
        await db.models.Bookmark.create(bookmark);
      } catch (e) {
        console.warn('Failed to save bookmark to MongoDB:', e.message);
      }
    }

    res.json({ success: true, bookmark });
  } catch (err) {
    console.error('Error adding bookmark:', err);
    res.status(500).json({ error: 'Failed to add bookmark' });
  }
});

// Remove bookmark
app.delete('/api/bookmarks/:moduleId', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const { moduleId } = req.params;

    const users = loadUsers();
    let userEmail = null;
    for (const [email, user] of Object.entries(users)) {
      if (user.token === token) {
        userEmail = email;
        break;
      }
    }
    if (!userEmail) return res.status(401).json({ error: 'Invalid token' });

    if (db.isConnected()) {
      try {
        await db.models.Bookmark.deleteOne({ userEmail, moduleId });
      } catch (e) {
        console.warn('Failed to delete bookmark from MongoDB:', e.message);
      }
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Error removing bookmark:', err);
    res.status(500).json({ error: 'Failed to remove bookmark' });
  }
});

// --- Attendance API ---
// Log module view
app.post('/api/attendance/log-view', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const { moduleId, courseId, duration } = req.body;
    if (!moduleId || !courseId) return res.status(400).json({ error: 'Missing moduleId or courseId' });

    const users = loadUsers();
    let userEmail = null;
    for (const [email, user] of Object.entries(users)) {
      if (user.token === token) {
        userEmail = email;
        break;
      }
    }
    if (!userEmail) return res.status(401).json({ error: 'Invalid token' });

    const attendance = {
      userEmail,
      type: 'module_view',
      moduleId,
      courseId,
      duration: duration || 0,
      viewedAt: new Date().toISOString()
    };

    if (db.isConnected()) {
      try {
        await db.models.Attendance.create(attendance);
      } catch (e) {
        console.warn('Failed to log attendance:', e.message);
      }
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Error logging attendance:', err);
    res.status(500).json({ error: 'Failed to log attendance' });
  }
});

// Log quiz completion
app.post('/api/attendance/log-quiz', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const { moduleId, courseId, score, totalQuestions, passed } = req.body;
    if (!moduleId || !courseId || score === undefined) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const users = loadUsers();
    let userEmail = null;
    for (const [email, user] of Object.entries(users)) {
      if (user.token === token) {
        userEmail = email;
        break;
      }
    }
    if (!userEmail) return res.status(401).json({ error: 'Invalid token' });

    const user = users[userEmail];

    const attendance = {
      userEmail,
      type: 'quiz_completion',
      moduleId,
      courseId,
      score,
      totalQuestions: totalQuestions || 0,
      passed: passed || false,
      completedAt: new Date().toISOString()
    };

    if (db.isConnected()) {
      try {
        await db.models.Attendance.create(attendance);
      } catch (e) {
        console.warn('Failed to log quiz:', e.message);
      }
    }

    // Check if all modules in the course are now completed
    // A quiz pass counts as module completion
    if (passed) {
      try {
        const modules = storage.loadModules(courseId) || [];
        
        if (modules.length > 0) {
          // Load all quiz completions for this user in this course
          let completedModules = new Set();
          
          if (db.isConnected()) {
            try {
              const quizzes = await db.models.Attendance.find({
                userEmail,
                courseId,
                type: 'quiz_completion',
                passed: true
              });
              quizzes.forEach(q => completedModules.add(q.moduleId));
            } catch (e) {
              console.warn('Failed to load quiz history:', e.message);
            }
          }
          
          // Add current module to completed set
          completedModules.add(moduleId);
          
          // Check if all modules are completed
          if (completedModules.size === modules.length) {
            // All modules completed! Mark course as complete and generate certificate
            user.completedCourses = user.completedCourses || [];
            
            if (!user.completedCourses.includes(courseId)) {
              user.completedCourses.push(courseId);
              console.log(`✅ Course ${courseId} marked complete for ${userEmail} (all ${modules.length} modules finished)`);
            }
            
            // Get course name for certificate
            const courses = storage.loadCourses() || [];
            const course = courses.find(c => c.id === courseId || c.slug === courseId);
            const courseName = course?.title || courseId;
            
            // Generate certificate if doesn't exist
            user.certificates = user.certificates || [];
            const existingCert = user.certificates.find(c => c.courseId === courseId);
            
            if (!existingCert) {
              const certificate = {
                id: Math.random().toString(36).slice(2, 11),
                courseId,
                courseName,
                studentName: user.name,
                studentEmail: userEmail,
                completedDate: new Date().toISOString(),
                certificateNumber: `CERT-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`
              };
              user.certificates.push(certificate);
              console.log(`🎓 Certificate generated for ${userEmail}: ${courseId}`);

              // Notify user about certificate
              (async () => {
                try {
                  await createNotification(userEmail, {
                    type: 'certificate',
                    title: '🏆 Course Completed!',
                    message: `Congratulations! You earned a certificate for completing ${courseName}!`,
                    icon: 'fa-trophy',
                    actionUrl: '/progress.html'
                  });
                } catch (notifErr) {
                  console.warn('Failed to create certificate notification:', notifErr);
                }
              })();
            }
            
            saveUsers(users);
          }
        }
      } catch (err) {
        console.warn('Failed to check course completion:', err.message);
      }
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Error logging quiz:', err);
    res.status(500).json({ error: 'Failed to log quiz' });
  }
});

// Get user's attendance stats
app.get('/api/attendance/stats', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const users = loadUsers();
    let userEmail = null;
    for (const [email, user] of Object.entries(users)) {
      if (user.token === token) {
        userEmail = email;
        break;
      }
    }
    if (!userEmail) return res.status(401).json({ error: 'Invalid token' });

    let attendance = [];
    if (db.isConnected()) {
      try {
        attendance = await db.models.Attendance.find({ userEmail });
      } catch (e) {
        console.warn('Failed to fetch attendance stats:', e.message);
      }
    }

    // Calculate stats
    const moduleViews = attendance.filter(a => a.type === 'module_view');
    const quizzes = attendance.filter(a => a.type === 'quiz_completion');
    const uniqueModules = new Set(moduleViews.map(a => a.moduleId)).size;
    const uniqueCourses = new Set(moduleViews.map(a => a.courseId)).size;
    const totalDuration = moduleViews.reduce((sum, a) => sum + (a.duration || 0), 0);
    const quizzesCompleted = quizzes.length;
    const quizzesPassed = quizzes.filter(a => a.passed).length;
    const avgScore = quizzes.length > 0 
      ? (quizzes.reduce((sum, a) => sum + a.score, 0) / quizzes.length).toFixed(1)
      : 0;

    res.json({
      totalModuleViews: moduleViews.length,
      uniqueModulesViewed: uniqueModules,
      uniqueCoursesViewed: uniqueCourses,
      totalDurationMinutes: Math.round(totalDuration / 60),
      quizzesCompleted,
      quizzesPassed,
      averageQuizScore: avgScore,
      allAttendance: attendance
    });
  } catch (err) {
    console.error('Error fetching stats:', err);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// --- Comments API ---
// Get comments for a module
app.get('/api/comments/:moduleId', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const { moduleId } = req.params;
    console.log('📝 Fetching comments for module:', moduleId);

    let comments = [];
    try {
      const mongoComments = await storage.find('Comment', { moduleId });
      console.log(`✅ Found ${mongoComments.length} comments from storage for module ${moduleId}`);
      
      comments = mongoComments.map(c => ({
        _id: c._id || c.id,
        moduleId: c.moduleId,
        courseId: c.courseId,
        userEmail: c.userEmail,
        userName: c.userName,
        text: c.text,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt
      }));
      
      // Sort by createdAt descending
      comments.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    } catch (e) {
      console.error('❌ Failed to fetch comments:', e.message);
    }

    console.log(`📨 Returning ${comments.length} comments for module ${moduleId}`);
    res.json(comments || []);
  } catch (err) {
    console.error('❌ Error fetching comments:', err);
    res.status(500).json({ error: 'Failed to fetch comments' });
  }
});

// Post a new comment
app.post('/api/comments', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const { moduleId, courseId, text } = req.body;
    if (!moduleId || !courseId || !text) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const users = loadUsers();
    let userEmail = null;
    let userName = null;
    for (const [email, user] of Object.entries(users)) {
      if (user.token === token) {
        userEmail = email;
        userName = user.name || email.split('@')[0];
        break;
      }
    }
    if (!userEmail) return res.status(401).json({ error: 'Invalid token' });

    const comment = {
      moduleId,
      courseId,
      userEmail,
      userName,
      text: text.trim(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    console.log('💾 Saving comment:', { moduleId, userEmail, textLength: text.length });
    let savedComment = comment;
    try {
      const result = await storage.insertOne('Comment', comment);
      savedComment = result || comment;
      console.log('✅ Comment saved successfully:', savedComment._id || savedComment.id);
    } catch (e) {
      console.error('❌ Failed to save comment:', e.message);
      savedComment = comment;
    }

    // Extract and notify mentioned users (first name + last name only)
    const mentionRegex = /@([\w]+(?:\s+[\w]+)?)\b/g;
    let mention;
    const mentionedNames = new Set();
    while ((mention = mentionRegex.exec(text)) !== null) {
      mentionedNames.add(mention[1]);
    }

    if (mentionedNames.size > 0) {
      console.log(`📢 Found mentions: ${Array.from(mentionedNames).join(', ')}`);
      
      for (const mentionedName of mentionedNames) {
        // Find user by name
        let mentionedEmail = null;
        for (const [email, user] of Object.entries(users)) {
          if (user.name && user.name.toLowerCase() === mentionedName.toLowerCase()) {
            mentionedEmail = email;
            break;
          }
        }

        if (mentionedEmail && mentionedEmail !== userEmail) {
          console.log(`📬 Creating mention notification for ${mentionedName} (${mentionedEmail})`);
          try {
            const notifResult = await createNotification(mentionedEmail, {
              type: 'mention',
              title: `You were mentioned by ${userName}`,
              message: `${userName} mentioned you in a comment: "${text.substring(0, 100)}${text.length > 100 ? '...' : ''}"`,
              icon: '💬',
              actionUrl: `/module.html?module=${moduleId}&course=${courseId}&highlightComment=${savedComment._id || savedComment.id}#comments`,
              data: { moduleId, courseId, commentId: savedComment._id || savedComment.id }
            });
            console.log(`✅ Mention notification sent successfully:`, notifResult);
          } catch (notifErr) {
            console.error(`❌ Failed to send mention notification:`, notifErr.message);
          }
        } else if (!mentionedEmail) {
          console.log(`⚠️ User not found for mention: ${mentionedName}`);
        }
      }
    }

    res.json({ success: true, comment: { ...savedComment, _id: savedComment._id || savedComment.id } });
  } catch (err) {
    console.error('Error posting comment:', err);
    res.status(500).json({ error: 'Failed to post comment' });
  }
});

// Delete a comment
app.delete('/api/comments/:commentId', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const { commentId } = req.params;

    const users = loadUsers();
    let userEmail = null;
    for (const [email, user] of Object.entries(users)) {
      if (user.token === token) {
        userEmail = email;
        break;
      }
    }
    if (!userEmail) return res.status(401).json({ error: 'Invalid token' });

    if (db.isConnected()) {
      try {
        // Only allow deleting your own comments
        await db.models.Comment.deleteOne({ _id: commentId, userEmail });
      } catch (e) {
        console.warn('Failed to delete comment:', e.message);
      }
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting comment:', err);
    res.status(500).json({ error: 'Failed to delete comment' });
  }
});

// --- Gamification Helper ---
function findUserByToken(token) {
  const users = loadUsers();
  for (const [email, user] of Object.entries(users)) {
    if (user.token === token) {
      return email;
    }
  }
  return null;
}

// --- Gamification Endpoints ---

// Get user's gamification stats (points, level, achievements)
app.get('/api/gamification/stats', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const userEmail = findUserByToken(token);
    if (!userEmail) return res.status(401).json({ error: 'Invalid token' });

    // Get user stats from database
    const stats = await storage.findOne('UserStats', { userEmail });
    const achievements = await storage.findOne('Achievement', { userEmail }) || { achievements: [] };

    const userData = {
      email: userEmail,
      points: stats?.points || 0,
      level: calculateLevel(stats?.points || 0),
      achievements: achievements.achievements || [],
      joinedDate: stats?.createdAt || new Date()
    };

    res.json(userData);
  } catch (err) {
    console.error('Error fetching gamification stats:', err);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// Award points for an action
app.post('/api/gamification/award', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const userEmail = findUserByToken(token);
    if (!userEmail) return res.status(401).json({ error: 'Invalid token' });

    const { action, moduleId, courseId, score, quizId } = req.body;
    const points = calculatePoints(action);

    // Get current stats before update
    const currentStats = await storage.findOne('UserStats', { userEmail });
    const oldPoints = currentStats?.points || 0;
    const oldLevel = calculateLevel(oldPoints).level;

    // Update user stats
    const updatedStats = await storage.updateOne('UserStats', 
      { userEmail },
      { 
        $inc: { points: points },
        $set: { lastActivityDate: new Date() },
        userEmail, // ensure email is set
        createdAt: new Date()
      },
      { upsert: true }
    );

    const newPoints = (updatedStats?.points || 0) + points;
    const newLevel = calculateLevel(newPoints).level;

    // Log the points award
    const log = {
      userEmail,
      action,
      points,
      moduleId,
      courseId,
      quizId,
      timestamp: new Date(),
      totalPoints: newPoints
    };

    await storage.insertOne('PointsLog', log);

    // Check for achievements
    const achievements = await storage.findOne('Achievement', { userEmail }) || { achievements: [] };
    const newAchievements = checkAchievements(userEmail, updatedStats, action);

    // Create notifications for milestones
    (async () => {
      try {
        console.log(`📊 Checking notifications for ${userEmail}: oldPoints=${oldPoints}, newPoints=${newPoints}, oldLevel=${oldLevel}, newLevel=${newLevel}`);
        
        // Points milestone notifications (every 500 points)
        if (Math.floor(oldPoints / 500) < Math.floor(newPoints / 500)) {
          const milestone = Math.floor(newPoints / 500) * 500;
          console.log(`⭐ Creating points milestone notification: ${milestone}`);
          await createNotification(userEmail, {
            type: 'achievement',
            title: `⭐ ${milestone} Points Milestone!`,
            message: `Awesome! You've reached ${milestone} points. You're climbing the leaderboard!`,
            icon: 'fa-star',
            data: { points: newPoints }
          });
        }

        // Level up notification
        if (newLevel > oldLevel) {
          console.log(`🚀 Creating level up notification: ${oldLevel} -> ${newLevel}`);
          await createNotification(userEmail, {
            type: 'achievement',
            title: `🚀 Level ${newLevel} Unlocked!`,
            message: `Congratulations! You've advanced to level ${newLevel}. Keep up the great work!`,
            icon: 'fa-arrow-up',
            data: { level: newLevel, points: newPoints }
          });
        }

        // Get leaderboard and check rank change
        const allStats = await storage.find('UserStats', {});
        const leaderboard = allStats
          .map(stat => ({
            userEmail: stat.userEmail,
            points: stat.points || 0
          }))
          .sort((a, b) => b.points - a.points);

        const newRank = leaderboard.findIndex(u => u.userEmail === userEmail) + 1;
        const oldRank = (currentStats?.previousRank || newRank);

        console.log(`🏆 Leaderboard check: newRank=${newRank}, oldRank=${oldRank}`);

        // Rank change notification
        if (newRank < oldRank) {
          // User moved up in ranking
          console.log(`📈 Creating rank up notification: ${oldRank} -> ${newRank}`);
          await createNotification(userEmail, {
            type: 'achievement',
            title: `📈 New Rank: #${newRank}!`,
            message: `You've climbed to rank #${newRank} on the leaderboard! Keep competing!`,
            icon: 'fa-chart-line',
            actionUrl: '/leaderboard.html',
            data: { rank: newRank, points: newPoints }
          });
        } else if (newRank === 1 && oldRank !== 1) {
          // User reached #1
          console.log(`👑 Creating #1 notification`);
          await createNotification(userEmail, {
            type: 'achievement',
            title: `👑 You're #1!`,
            message: `Incredible! You've reached the top of the leaderboard. You are the champion!`,
            icon: 'fa-crown',
            actionUrl: '/leaderboard.html',
            data: { rank: 1, points: newPoints }
          });
        }

        // Update previous rank for next comparison
        await storage.updateOne('UserStats', 
          { userEmail },
          { $set: { previousRank: newRank } }
        );
      } catch (notifErr) {
        console.warn('Failed to create leaderboard notification:', notifErr);
      }
    })();

    res.json({ 
      success: true, 
      pointsAwarded: points,
      totalPoints: newPoints,
      newAchievements: newAchievements
    });
  } catch (err) {
    console.error('Error awarding points:', err);
    res.status(500).json({ error: 'Failed to award points' });
  }
});

// Get global leaderboard
app.get('/api/gamification/leaderboard', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;

    const allStats = await storage.find('UserStats', {});
    const leaderboard = allStats
      .map(stat => ({
        userEmail: stat.userEmail,
        points: stat.points || 0,
        displayName: stat.userEmail.split('@')[0]
      }))
      .sort((a, b) => b.points - a.points)
      .slice(0, limit);

    // Add rank
    const ranked = leaderboard.map((user, index) => ({
      ...user,
      rank: index + 1
    }));

    res.json(ranked);
  } catch (err) {
    console.error('Error fetching leaderboard:', err);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

// Get user's achievements
app.get('/api/gamification/achievements', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const userEmail = findUserByToken(token);
    if (!userEmail) return res.status(401).json({ error: 'Invalid token' });

    const achievements = await storage.findOne('Achievement', { userEmail }) || { achievements: [] };
    res.json(achievements.achievements || []);
  } catch (err) {
    console.error('Error fetching achievements:', err);
    res.status(500).json({ error: 'Failed to fetch achievements' });
  }
});

// Helper: Calculate points for action
function calculatePoints(action) {
  const points = {
    'module_view': 10,
    'quiz_pass': 50,
    'quiz_attempt': 20,
    'comment': 5,
    'bookmark': 2,
    'first_module': 25,
    'first_quiz_pass': 100
  };
  return points[action] || 0;
}

// Helper: Calculate user level
function calculateLevel(points) {
  const levels = [
    { level: 1, minPoints: 0, maxPoints: 500 },
    { level: 2, minPoints: 500, maxPoints: 1000 },
    { level: 3, minPoints: 1000, maxPoints: 1500 },
    { level: 4, minPoints: 1500, maxPoints: 2500 },
    { level: 5, minPoints: 2500, maxPoints: Infinity }
  ];

  const levelInfo = levels.find(l => points >= l.minPoints && points < l.maxPoints);
  const nextLevel = levels.find(l => l.level === (levelInfo?.level || 1) + 1);

  return {
    level: levelInfo?.level || 1,
    currentPoints: points,
    nextLevelPoints: nextLevel?.minPoints || Infinity,
    progress: levelInfo ? Math.round(((points - levelInfo.minPoints) / (levelInfo.maxPoints - levelInfo.minPoints)) * 100) : 0
  };
}

// Helper: Check achievements to earn
function checkAchievements(userEmail, stats, action) {
  const achievements = [];
  const points = stats?.points || 0;

  if (action === 'module_view' && points === 10) {
    achievements.push('first_step');
  }
  if (points >= 500 && !stats?.achievements?.includes('learner_level_2')) {
    achievements.push('learner_level_2');
  }
  if (points >= 2000 && !stats?.achievements?.includes('learner_level_5')) {
    achievements.push('learner_level_5');
  }

  return achievements;
}

// --- Notification APIs ---

// Get user notifications
app.get('/api/notifications', (req, res) => {
  try {
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const users = loadUsers();
    let userEmail = null;
    
    // Find user by token
    for (const [email, user] of Object.entries(users)) {
      if (user.token === token) {
        userEmail = email;
        break;
      }
    }

    if (!userEmail) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Get notifications from MongoDB
    (async () => {
      try {
        const Notification = db.models.Notification;
        const notifications = await Notification.find({ userEmail, deleted: false })
          .sort({ createdAt: -1 })
          .lean();
        
        res.json({
          success: true,
          notifications: notifications || [],
          unreadCount: notifications?.filter(n => !n.read).length || 0
        });
      } catch (err) {
        console.error('Error fetching notifications:', err);
        res.status(500).json({ error: 'Failed to fetch notifications' });
      }
    })();
  } catch (err) {
    console.error('Notification API error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Mark notification as read
app.put('/api/notifications/:id/read', (req, res) => {
  try {
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const users = loadUsers();
    let userEmail = null;
    
    for (const [email, user] of Object.entries(users)) {
      if (user.token === token) {
        userEmail = email;
        break;
      }
    }

    if (!userEmail) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    (async () => {
      try {
        const Notification = db.models.Notification;
        const notification = await Notification.findOneAndUpdate(
          { _id: req.params.id, userEmail },
          { read: true },
          { new: true }
        );
        
        if (!notification) {
          return res.status(404).json({ error: 'Notification not found' });
        }

        res.json({ success: true, notification });
      } catch (err) {
        console.error('Error marking notification as read:', err);
        res.status(500).json({ error: 'Failed to update notification' });
      }
    })();
  } catch (err) {
    console.error('Notification API error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete notification
app.delete('/api/notifications/:id', (req, res) => {
  try {
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const users = loadUsers();
    let userEmail = null;
    
    for (const [email, user] of Object.entries(users)) {
      if (user.token === token) {
        userEmail = email;
        break;
      }
    }

    if (!userEmail) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    (async () => {
      try {
        const Notification = db.models.Notification;
        const notification = await Notification.findOneAndUpdate(
          { _id: req.params.id, userEmail },
          { deleted: true },
          { new: true }
        );
        
        if (!notification) {
          return res.status(404).json({ error: 'Notification not found' });
        }

        res.json({ success: true, message: 'Notification deleted' });
      } catch (err) {
        console.error('Error deleting notification:', err);
        res.status(500).json({ error: 'Failed to delete notification' });
      }
    })();
  } catch (err) {
    console.error('Notification API error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create notification (API endpoint)
app.post('/api/notifications/create', (req, res) => {
  try {
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) {
      console.log('❌ Notification create: No token provided');
      return res.status(401).json({ error: 'No token provided' });
    }

    const users = loadUsers();
    let userEmail = null;
    
    // Find user by token
    for (const [email, user] of Object.entries(users)) {
      if (user && user.token === token) {
        userEmail = email;
        break;
      }
    }

    if (!userEmail) {
      console.log('❌ Notification create: Invalid token, could not find user');
      return res.status(401).json({ error: 'Invalid token' });
    }

    const { type, title, message, icon, actionUrl, data } = req.body;

    // Validate required fields
    if (!type || !title || !message) {
      return res.status(400).json({ error: 'Missing required fields: type, title, message' });
    }

    console.log(`📬 Creating notification for ${userEmail}:`, { type, title });

    (async () => {
      try {
        const notification = await createNotification(userEmail, {
          type,
          title,
          message,
          icon,
          actionUrl,
          data
        });
        console.log(`✅ Notification created for ${userEmail}`);
      } catch (err) {
        console.error('Failed to create notification in DB:', err);
      }
    })();

    res.json({ success: true, message: 'Notification created' });
  } catch (err) {
    console.error('Error in /api/notifications/create:', err);
    res.status(500).json({ error: 'Failed to create notification' });
  }
});

app.post('/api/notifications', (req, res) => {
  try {
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const users = loadUsers();
    let userEmail = null;
    
    for (const [email, user] of Object.entries(users)) {
      if (user && user.token === token) {
        userEmail = email;
        break;
      }
    }

    if (!userEmail) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const { type, title, message, icon, actionUrl, data } = req.body;

    if (!type || !title || !message) {
      return res.status(400).json({ error: 'Missing required fields: type, title, message' });
    }

    (async () => {
      try {
        const notification = await createNotification(userEmail, {
          type,
          title,
          message,
          icon,
          actionUrl,
          data
        });
        res.json({
          success: true,
          notification
        });
      } catch (err) {
        console.error('Error creating notification:', err);
        res.status(500).json({ error: 'Failed to create notification' });
      }
    })();
  } catch (err) {
    console.error('Notification API error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// --- Start Server ---
// Server startup function with proper initialization sequence

// Diagnostic endpoint for email configuration
app.get('/api/email-config', (req, res) => {
  const hasTransporter = !!mailTransporter;
  const smtpHost = process.env.SMTP_HOST ? process.env.SMTP_HOST.substring(0, 10) + '***' : 'NOT SET';
  const smtpPort = process.env.SMTP_PORT || 'NOT SET';
  const smtpUser = process.env.SMTP_USER ? process.env.SMTP_USER.substring(0, 3) + '***' : 'NOT SET';
  
  res.json({
    hasTransporter,
    configuredVars: {
      SMTP_HOST: smtpHost,
      SMTP_PORT: smtpPort,
      SMTP_USER: smtpUser,
      SMTP_PASS: process.env.SMTP_PASS ? '***SET***' : 'NOT SET',
      SMTP_FROM: process.env.SMTP_FROM || 'NOT SET'
    },
    lastEmailAttempt
  });
});

async function startServer() {
  // initialize storage (connect to MongoDB if configured)
  try {
    await storage.init();
  } catch (e) { console.warn('storage.init warning', e); }
  
  // CLEANUP MIGRATION: Remove all orphaned UUID-based participant records
  // Keep only email-based userIds for regular users (admins are the exception)
  try {
    console.log('🧹 [Startup] Running participant records migration...');
    const Participant = db.models?.Participant;
    if (Participant) {
      // Check for UUID-based userIds (not email format)
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      
      const allParticipants = await Participant.find({}).lean();
      console.log(`📊 [Startup] Found ${allParticipants.length} total participant records`);
      
      // Identify orphaned UUID records
      const uuidRecords = allParticipants.filter(p => !emailRegex.test(p.userId));
      console.log(`🔍 [Startup] Found ${uuidRecords.length} UUID-based records to remove`);
      
      if (uuidRecords.length > 0) {
        // Delete all UUID-based records
        const result = await Participant.deleteMany({
          userId: {
            $regex: /^(?!.*@.*\.)/, // Regex for non-email (no @ and domain pattern)
            $options: 'i'
          }
        });
        console.log(`✅ [Startup] Deleted ${result.deletedCount} orphaned UUID-based participant records`);
        
        // Log the cleanup details
        uuidRecords.forEach(record => {
          console.log(`  - Removed: ${record.userId} (${record.userName}) from session ${record.sessionId}`);
        });
      }
    }
  } catch (err) {
    console.warn(`⚠️ [Startup] Participant migration failed (non-critical):`, err.message);
  }
  
  // Initialize discussion system services after MongoDB is ready (without io yet)
  initializeDiscussionServices();
  
  console.log('About to create HTTP server and initialize Socket.IO...');
  
  // Create HTTP server from Express app
  const server = http.createServer(app);
  
  // Initialize Socket.IO on the HTTP server
  const io = socketIO(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
      credentials: true
    },
    transports: ['websocket', 'polling'],
    pingInterval: 25000,
    pingTimeout: 60000
  });
  
  console.log('✅ Socket.IO initialized');

  // Re-register discussion routes with io instance so they can broadcast to clients
  if (discussionSessionService && participantService) {
    const discussionRoutes = createDiscussionRoutes(db, discussionSessionService, participantService, io);
    app.use('/api/discussions', discussionRoutes);
    console.log('✅ Discussion routes re-registered with Socket.IO');
  }
  
  // Initialize discussion socket handlers
  if (discussionSessionService && participantService) {
    initializeDiscussionSocket(io, db, discussionSessionService, participantService);
  } else {
    console.warn('⚠️ Discussion services not initialized yet, Socket.IO handlers will not be available');
  }
  
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      console.error('❌ Server listen timeout after 10 seconds');
      reject(new Error('Server listen timeout'));
    }, 10000);
    
    server.listen(PORT, () => {
      clearTimeout(timeout);
      console.log(`✓ Server running on http://127.0.0.1:${PORT}`);
      console.log(`✓ Socket.IO ready at ws://127.0.0.1:${PORT}`);
      resolve();
    });
    
    server.on('error', (err) => {
      clearTimeout(timeout);
      console.error('❌ Server listen error:', err.message);
      reject(err);
    });
  });
  
  console.log('Server startup completed and listening');
}

// Start the server if this file is run directly
if (require.main === module) {
  startServer().catch(err => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
}

// Export for server.js and other modules
module.exports = { startServer, addSystemMessage };
