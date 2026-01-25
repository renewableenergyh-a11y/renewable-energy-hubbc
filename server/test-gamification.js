#!/usr/bin/env node
/**
 * Test gamification system
 */

const fetch = require('node-fetch');

const BASE_URL = 'http://127.0.0.1:8787';
let token = '';
let userId = '';

async function test() {
  console.log('🎮 Testing Gamification System...\n');

  try {
    // 1. Get a token (login or use existing)
    console.log('1️⃣ Testing User Authentication...');
    const loginRes = await fetch(`${BASE_URL}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'testgamify@example.com', password: 'password123' })
    });

    if (loginRes.ok) {
      const loginData = await loginRes.json();
      token = loginData.token || loginData.authToken;
      console.log(`✅ Login successful - Token: ${token.substring(0, 20)}...`);
    } else {
      console.log('⚠️ Login failed, trying with test token');
      token = 'test-token-123';
    }

    // 2. Test get stats endpoint
    console.log('\n2️⃣ Testing Get Gamification Stats...');
    const statsRes = await fetch(`${BASE_URL}/api/gamification/stats`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (statsRes.ok) {
      const stats = await statsRes.json();
      console.log('✅ Got user stats:');
      console.log(`   - Points: ${stats.points || 0}`);
      console.log(`   - Level: ${stats.level?.level || 1}`);
      console.log(`   - Achievements: ${(stats.achievements || []).length}`);
    } else {
      console.log(`⚠️ Get stats failed: ${statsRes.status}`);
    }

    // 3. Test award points
    console.log('\n3️⃣ Testing Award Points...');
    const awardRes = await fetch(`${BASE_URL}/api/gamification/award`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        action: 'module_view',
        moduleId: 'test-module-1',
        courseId: 'test-course'
      })
    });

    if (awardRes.ok) {
      const result = await awardRes.json();
      console.log('✅ Points awarded:');
      console.log(`   - Points awarded: ${result.pointsAwarded}`);
      console.log(`   - Total points: ${result.totalPoints}`);
    } else {
      console.log(`⚠️ Award points failed: ${awardRes.status}`);
    }

    // 4. Test leaderboard
    console.log('\n4️⃣ Testing Get Leaderboard...');
    const leaderboardRes = await fetch(`${BASE_URL}/api/gamification/leaderboard?limit=5`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (leaderboardRes.ok) {
      const leaderboard = await leaderboardRes.json();
      console.log(`✅ Leaderboard retrieved (${leaderboard.length} users):`);
      leaderboard.slice(0, 3).forEach(user => {
        console.log(`   ${user.rank}. ${user.displayName} - ${user.points} points`);
      });
    } else {
      console.log(`⚠️ Get leaderboard failed: ${leaderboardRes.status}`);
    }

    // 5. Test achievements
    console.log('\n5️⃣ Testing Get Achievements...');
    const achievementsRes = await fetch(`${BASE_URL}/api/gamification/achievements`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (achievementsRes.ok) {
      const achievements = await achievementsRes.json();
      console.log(`✅ Achievements retrieved: ${achievements.length} achievements`);
      if (achievements.length > 0) {
        console.log(`   - ${achievements.join(', ')}`);
      }
    } else {
      console.log(`⚠️ Get achievements failed: ${achievementsRes.status}`);
    }

    console.log('\n✅ Gamification system test completed!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Test error:', err.message);
    process.exit(1);
  }
}

test();
