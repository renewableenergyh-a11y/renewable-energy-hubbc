const fs = require('fs');
const path = require('path');

const AVATARS_DIR = path.join(__dirname, '..', 'data', 'avatars');

// Ensure avatars directory exists
if (!fs.existsSync(AVATARS_DIR)) {
  fs.mkdirSync(AVATARS_DIR, { recursive: true });
}

/**
 * Save avatar image for a user
 * @param {string} email - User email
 * @param {string} dataUrl - Data URL of the image
 * @returns {string} - Relative path to avatar file
 */
function saveAvatar(email, dataUrl) {
  if (!dataUrl) return null;
  
  try {
    // Remove invalid characters from email for filename
    const sanitized = email.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filename = `${sanitized}.jpg`;
    const filepath = path.join(AVATARS_DIR, filename);
    
    // Extract base64 data from data URL
    const base64Data = dataUrl.replace(/^data:image\/\w+;base64,/, '');
    
    // Write to file
    fs.writeFileSync(filepath, Buffer.from(base64Data, 'base64'));
    
    console.log(`📸 Avatar saved for ${email} (${Buffer.from(base64Data, 'base64').length} bytes)`);
    return `/data/avatars/${filename}`;
  } catch (err) {
    console.error('Error saving avatar:', err.message);
    return null;
  }
}

/**
 * Get avatar URL for a user
 * @param {string} email - User email
 * @returns {string|null} - Avatar URL or null
 */
function getAvatarUrl(email) {
  try {
    const sanitized = email.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filename = `${sanitized}.jpg`;
    const filepath = path.join(AVATARS_DIR, filename);
    
    if (fs.existsSync(filepath)) {
      return `/data/avatars/${filename}`;
    }
    return null;
  } catch (err) {
    console.error('Error getting avatar:', err.message);
    return null;
  }
}

/**
 * Delete avatar for a user
 * @param {string} email - User email
 */
function deleteAvatar(email) {
  try {
    const sanitized = email.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filename = `${sanitized}.jpg`;
    const filepath = path.join(AVATARS_DIR, filename);
    
    if (fs.existsSync(filepath)) {
      fs.unlinkSync(filepath);
      console.log(`📸 Avatar deleted for ${email}`);
    }
  } catch (err) {
    console.error('Error deleting avatar:', err.message);
  }
}

module.exports = { saveAvatar, getAvatarUrl, deleteAvatar };
