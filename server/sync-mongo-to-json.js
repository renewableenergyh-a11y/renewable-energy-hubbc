#!/usr/bin/env node
/**
 * Sync MongoDB users data to users.json file
 * Usage: node sync-mongo-to-json.js
 */

const fs = require('fs');
const path = require('path');
const db = require('./db');

const USERS_FILE = path.join(__dirname, 'users.json');

async function syncUsersToJson() {
  try {
    console.log('Initializing MongoDB connection...');
    await db.init();

    if (!db.isConnected()) {
      throw new Error('MongoDB is not connected');
    }

    console.log('Fetching users from MongoDB...');
    const users = await db.models.User.find({}).lean().exec();

    if (!users || users.length === 0) {
      console.log('No users found in MongoDB. Creating empty users.json');
      fs.writeFileSync(USERS_FILE, JSON.stringify({}, null, 2));
      console.log('✓ users.json cleared');
      return;
    }

    // Convert MongoDB documents to users.json format (email -> user object)
    const usersJson = {};
    users.forEach(user => {
      if (user.email) {
        usersJson[user.email] = user;
      }
    });

    // Write to file with nice formatting
    fs.writeFileSync(USERS_FILE, JSON.stringify(usersJson, null, 2));
    
    console.log(`✓ Synced ${Object.keys(usersJson).length} users from MongoDB to users.json`);
    console.log('\nUsers in MongoDB:');
    Object.keys(usersJson).forEach(email => {
      console.log(`  - ${email}`);
    });
    
  } catch (error) {
    console.error('Error syncing users:', error.message);
    process.exit(1);
  }
}

syncUsersToJson();
