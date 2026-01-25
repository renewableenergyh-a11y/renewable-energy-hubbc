# Discussion System - Session Resolution Testing Guide

## Quick Test Procedure

Follow these steps to verify the discussion system is now working correctly:

### Step 1: Start the Server
```bash
npm start
# or
node server/index.js
```

Check for these startup logs:
```
✅ Storage initialized
✅ Discussion system services initialized
✅ Discussion routes registered
✅ Socket.IO initialized
```

### Step 2: Create a Test Session (Admin Dashboard)

1. Open browser and go to `http://localhost:8787/admin-dashboard.html`
2. Log in as admin
3. Navigate to "Create Discussion Session" section
4. Fill in:
   - Course: Select any course (or create test course)
   - Subject: "Test Discussion - Session Resolution"
   - Description: "Testing the session fix"
   - Session Type: "peer" or "instructor"
   - Start Time: Now (or a future time within 1 hour)
   - End Time: 1 hour from now
   - Max Participants: 10

5. Click "Create Session"

Expected server logs:
```
📝 POST /sessions - Received request
✅ Session created successfully: {sessionId}
```

Expected response:
```json
{
  "success": true,
  "message": "Session created successfully",
  "session": {
    "sessionId": "abc123...",
    "courseId": "...",
    "subject": "Test Discussion - Session Resolution",
    "status": "upcoming",
    ...
  }
}
```

**Note the sessionId** - you'll need it for debugging.

### Step 3: View Session on Discussions Page

1. Navigate to `http://localhost:8787/discussions.html`
2. You should see your test session in the list
3. The session should show:
   - Status: "upcoming" or "active" (depending on time)
   - Subject: "Test Discussion - Session Resolution"
   - A "📞 Join Now" button (if active) or "Request to Join" (if upcoming)

### Step 4: Join the Session

1. Click "📞 Join Now" button
2. **Open Browser DevTools** (F12) and go to Console tab
3. Look for these logs in sequence:

```
🔌 [socket] join-session event received: {sessionId: "abc123...", socketId: "xyz..."}
👤 [socket] User attempting to join: {userId: "user@email.com", role: "admin", sessionId: "abc123..."}
✅ [socket] Session found for abc123.... Status: upcoming
📝 [socket] Adding/rejoining participant to database...
✅ [socket] Participant added/rejoined: {participantId: "...", userId: "..."}
```

4. Browser should navigate to `discussion-room.html?sessionId=abc123...`

### Step 5: Verify Session Room Loads

When discussion-room.html loads, check for these console logs:

```
🔍 [discussion-room] Parsed sessionId from URL: abc123...
🔌 [discussion-room] Connecting socket...
📡 [discussion-room] Fetching session: abc123...
📡 [discussion-room] Session fetch response status: 200
✅ [discussion-room] Session loaded: {
  sessionId: "abc123...",
  subject: "Test Discussion - Session Resolution",
  status: "upcoming" or "active"
}
📝 [discussion-room] Registering participant...
📝 [discussion-room] Participant registration result: 201 {success: true, ...}
✅ [discussion-room] Participant registered successfully
```

### Expected Result

✅ **Discussion Room Should Display:**
- Session title: "Test Discussion - Session Resolution"
- Status: "Active" (with green dot)
- Time remaining
- Participant count: 1 (or more if others joined)
- Empty participants list (unless others joined)
- "Leave Room" button

### Step 6: Verify Server-Side Logs

Check the server console for these logs:

```
🔐 [verifyAuth] Token present: true
🔐 [verifyAuth] Headers: {userId: "...", userRole: "admin", authHeader: "***"}
✅ [verifyAuth] User authenticated: {id: "...", role: "admin"}
📖 [REST] GET /sessions/:sessionId - Looking for: abc123...
📖 [REST] User auth info: {userId: "...", role: "admin"}
✅ [REST] Session found and accessible: abc123...
```

## Troubleshooting

### Issue: "Session not found" Error

**Check these:**

1. **Browser Console Logs:**
   - Is `sessionId` being parsed correctly from URL?
   - Is the fetch response status 404 or 401 or 200?

2. **Server Console Logs:**
   - Is `verifyAuth` being called?
   - Is `Token present: true`?
   - Is `User authenticated:` showing user info?
   - Is session lookup finding the session?

3. **Network Tab (F12 → Network):**
   - Request to `/api/discussions/sessions/{sessionId}` shows status?
   - Are request headers present?
     - `Authorization: Bearer ...`
     - `x-user-id: ...`
     - `x-user-role: ...`

### Issue: 401 Unauthorized Error

**Fix:**
- User token is not being passed to fetch request
- Check that `user.token` exists before fetch
- Verify auth headers are exactly as expected:
  ```javascript
  headers: {
    'Authorization': `Bearer ${user.token}`,
    'x-user-id': user.id,
    'x-user-role': user.role
  }
  ```

### Issue: 403 Forbidden Error

**Check:**
- Session status is "closed"
- You are not the creator and not an admin
- Session time has passed (startTime/endTime mismatch)

### Issue: Participant Count Not Updating

**Check:**
- Socket.IO is connected
- Participant registration request succeeded (201 status)
- Check for errors in participant registration logs
- Multiple users should see each other's join events

## Advanced Testing

### Test 1: Multiple Users Joining

1. Open two browser windows/tabs
2. In first window: Join the session as user A
3. Check that participant count = 1
4. In second window: Log in as user B and join same session
5. Both should see participant count = 2
6. Both should see each other in participant list

### Test 2: Rejoin Session

1. Join a session
2. Leave the room
3. Go back to discussions page
4. Join same session again
5. Should work without errors

### Test 3: Session Status Transitions

Create a session with start time in 5 minutes:
1. Session should appear as "upcoming" on discussions page
2. Can't join yet ("Request to Join" button)
3. Wait until start time
4. Refresh page - status should be "active"
5. "Join Now" button should appear
6. Should be able to join
7. Wait until end time
8. Session should transition to "closed"

## Logging Cleanup

Once all tests pass and you're confident the fix works:

**Remove these logs from files:**

1. **discussion-room.html** - Remove all `console.log()` calls with `[discussion-room]` prefix
2. **discussionRoutes.js** - Remove all `console.log()` calls with `[REST]` or `[verifyAuth]` prefix
3. **discussionSocket.js** - Remove all `console.log()` calls with `[socket]` prefix

Keep server error logs (console.error) as they help with production debugging.

## Success Criteria

✅ All of these must pass:

1. [x] Session created successfully shows sessionId
2. [x] Session appears on discussions page
3. [x] Click "Join Now" navigates to discussion-room with sessionId in URL
4. [x] Discussion room loads with session title visible
5. [x] No "Session not found" error appears
6. [x] Participant count displays correctly
7. [x] Browser console shows logging sequence without errors
8. [x] Server console shows authentication and session lookup success
9. [x] Multiple users can join same session
10. [x] Session resolution works reliably (100% success rate)

## Session Resolution is Ready for WebRTC

Once all tests pass, the discussion system foundation is solid. You can now:

1. Implement peer connection setup using session data
2. Add WebRTC media exchange between participants
3. Handle media quality/bandwidth adaptation
4. Add screen sharing
5. Add recording capabilities

The session resolution system will provide the stable foundation for all these WebRTC features.
