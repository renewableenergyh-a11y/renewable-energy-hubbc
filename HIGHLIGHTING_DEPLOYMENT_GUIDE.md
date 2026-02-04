# Text Highlighting System - Deployment Guide

## Pre-Deployment Checklist

### Code Review
- [x] All files syntax-checked
- [x] No console errors
- [x] Error handling in place
- [x] Comments included
- [x] No debug code left

### Testing
- [x] Local development ready
- [x] No dependencies missing
- [x] Database model ready
- [x] API routes registered

### Documentation
- [x] Implementation guide written
- [x] Quick reference created
- [x] Changes documented
- [x] This deployment guide

---

## Local Deployment (Development)

### 1. Install Dependencies (if needed)
```bash
cd server
npm install
```

All required packages already installed:
- express
- mongoose
- socket.io
- cors

### 2. Start Server
```bash
npm start
# or
node index.js
```

Expected output:
```
✅ Highlight routes registered
✓ Server running on http://127.0.0.1:8787
```

### 3. Test Highlighting
1. Open browser: `http://localhost:8787`
2. Login as a user
3. Navigate to a module
4. Select text in the module content
5. Verify toolbar appears
6. Click a color to create a highlight
7. Refresh page - highlight should persist
8. Click highlight - toolbar should reappear
9. Change color or delete

### 4. Test API Directly (Optional)
```bash
# Get highlights for a module
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:8787/api/highlights/module/MODULE_ID

# Expected response:
# { "highlights": [...] }
```

---

## Staging Deployment

### Environment Setup
1. Set `MONGODB_URI` environment variable
2. Set other required env vars (CLOUDINARY, PAYCHANGU, etc.)
3. Ensure Node.js version ≥ 14.x

### Database Preparation
MongoDB will automatically create the `highlights` collection on first write.

To verify collection exists:
```javascript
db.highlights.find().limit(1)
```

### Deployment Steps
1. Pull latest code
2. Install dependencies: `npm install`
3. Start server: `npm start`
4. Verify routes in console output

### Monitoring
1. Check error logs for highlight-related errors
2. Monitor `/api/highlights/*` endpoint performance
3. Check database query times
4. Verify user authentication works

### Testing Checklist
- [ ] Text selection works
- [ ] Toolbar appears/disappears correctly
- [ ] All 6 colors apply correctly
- [ ] Highlights persist after refresh
- [ ] Highlights survive dark mode toggle
- [ ] Mobile touch selection works
- [ ] Delete function works
- [ ] Color updates work
- [ ] Error messages appear on failures

---

## Production Deployment (Render, etc.)

### Pre-Deployment
1. Test thoroughly in staging
2. Backup database
3. Create rollback plan
4. Notify support team

### Deployment
1. Merge to main branch
2. Deploy using your CI/CD pipeline
3. Verify all routes registered in logs
4. Monitor error logs for 24 hours

### Post-Deployment Verification
```bash
# Verify routes are registered
curl https://your-app.onrender.com/api/highlights/module/test
# Should return 401 (no token) not 404 (route exists)

# With valid token
curl -H "Authorization: Bearer TOKEN" \
  https://your-app.onrender.com/api/highlights/module/MODULE_ID
# Should return { "highlights": [...] }
```

### Rollback Plan
If issues occur:
1. Revert code to previous commit
2. Redeploy
3. Investigate in staging
4. Fix and retry

---

## Performance Tuning

### Database Indexes
Add indexes for better performance (MongoDB):
```javascript
db.highlights.createIndex({ userEmail: 1, contentId: 1 })
db.highlights.createIndex({ contentId: 1, contentType: 1 })
```

### Caching Strategy
Could cache highlights in-memory per session to reduce database queries:
- Cache highlights for current user
- Invalidate on create/update/delete
- Clear on logout

### API Response Times
Monitor these endpoints:
- GET /api/highlights/* - Should be <100ms
- POST /api/highlights - Should be <300ms
- PUT /api/highlights/* - Should be <300ms
- DELETE /api/highlights/* - Should be <300ms

If slower, check:
1. Database indexes created
2. Database connection pool size
3. Network latency

---

## Troubleshooting

### Highlights Not Loading
**Error:** "Error fetching highlights" in console

**Solutions:**
1. Check token is valid
2. Verify MongoDB connection
3. Check CORS headers
4. Verify `/api/highlights` route registered

### Toolbar Not Appearing
**Problem:** Toolbar doesn't show when selecting text

**Solutions:**
1. Check content container has id="module-content"
2. Verify selection is within container (not in header/footer)
3. Check highlight service loaded (search console for errors)
4. Verify Font Awesome CSS loaded (check icons appear elsewhere)

### Colors Not Saving
**Problem:** Highlights persist locally but disappear after refresh

**Solutions:**
1. Check user token is valid
2. Verify MongoDB saves data
3. Check network tab - POST requests succeed
4. Verify userEmail in token lookup

### Mobile Touch Not Working
**Problem:** Toolbar doesn't appear on touch devices

**Solutions:**
1. Long-press to ensure selection
2. Check touchend event handler runs
3. Verify touch coordinates correct
4. Check z-index of toolbar (should be 10000)

### Dark Mode Issues
**Problem:** Highlights invisible in dark mode

**Solutions:**
1. Verify dark mode CSS added
2. Check `.text-highlight` has proper background
3. Test background color contrast
4. Check toolbar dark styling applied

---

## Monitoring & Analytics

### Key Metrics to Track
1. **Highlight Creation Rate**
   - How often users create highlights
   - Baseline: Track for first week

2. **Error Rate**
   - Failed saves/deletes
   - Expected: <1% error rate

3. **API Response Time**
   - GET /api/highlights - Target: <100ms
   - POST /api/highlights - Target: <300ms
   - PUT /api/highlights - Target: <300ms
   - DELETE /api/highlights - Target: <300ms

4. **Database Growth**
   - Highlights per module
   - Average: 5-10 per active user

### Error Monitoring
Set up alerts for:
- Highlight API errors
- Database connection issues
- Authentication failures
- Rate limiting (if enabled)

### User Feedback
- Monitor support tickets about highlights
- Check feedback for UX issues
- Track feature requests

---

## Maintenance Tasks

### Weekly
- [ ] Check error logs for highlighting issues
- [ ] Verify API response times normal
- [ ] Monitor database size growth

### Monthly
- [ ] Review error trends
- [ ] Analyze usage patterns
- [ ] Plan performance optimizations

### Quarterly
- [ ] Database maintenance (cleanup old data if needed)
- [ ] Performance audit
- [ ] Security review

---

## Feature Flags (Optional)

To safely rollout highlights, consider feature flags:

```javascript
// In modulePage.js
if (featureFlags.highlighting) {
  await initializeHighlighting(container, moduleId, 'module');
}
```

This allows:
- Rolling out to subset of users
- Quick disable if issues found
- A/B testing usage impact

---

## User Communication

### Announcement Template
```
📝 New Feature: Text Highlighting

Highlight important passages in your courses!

How to use:
1. Select any text in a module
2. Choose a color from the toolbar
3. Your highlight is saved automatically
4. Highlights persist across sessions

Features:
✓ 6 highlight colors
✓ Change colors anytime
✓ Delete highlights
✓ Automatic saving
✓ Works on all devices

Questions? Contact support.
```

### Support Guide
Prepare support team with:
1. How to create highlights
2. How to delete highlights
3. Common issues and solutions
4. FAQ about persistence
5. How to report bugs

---

## Rollback Procedure

If highlighting needs to be disabled:

### Option 1: Disable in Frontend
Comment out highlight initialization:
```javascript
// await initializeHighlighting(container, moduleId, 'module');
```

### Option 2: Disable API
Return 503 from highlight routes:
```javascript
app.use('/api/highlights', (req, res) => {
  res.status(503).json({ error: 'Feature temporarily disabled' });
});
```

### Option 3: Complete Rollback
Revert code commit and redeploy.

---

## Support Escalation

### Level 1 - Basic Troubleshooting
- Check browser console for errors
- Verify text is within module content
- Confirm user is logged in
- Check Font Awesome loads

### Level 2 - Network Issues
- Verify API endpoint accessible
- Check token validity
- Confirm CORS headers correct
- Monitor request/response

### Level 3 - Database Issues
- Check MongoDB connection
- Verify highlights collection exists
- Check user data in database
- Verify indexes created

### Level 4 - Code Issues
- Review error logs
- Check server console output
- Verify route registration
- Debug with network inspector

---

## Success Criteria

Feature is successfully deployed when:
- ✅ Highlights can be created
- ✅ Highlights persist after refresh
- ✅ Highlights can be deleted
- ✅ Highlight colors can be changed
- ✅ Works on mobile/tablet/desktop
- ✅ Toolbar appears/disappears correctly
- ✅ No errors in console
- ✅ API response times <300ms
- ✅ <1% error rate
- ✅ Users can successfully use feature

---

## Support Contact

For deployment issues:
1. Check this guide first
2. Review error logs
3. Check deployment status
4. Contact development team

---

## Appendix: Configuration Variables

### Required Environment Variables
None specifically for highlights - uses existing:
- `MONGODB_URI` - Database connection
- `PORT` - Server port (default 8787)
- `NODE_ENV` - Environment (development/production)

### Optional Tuning
```javascript
// In server code
const HIGHLIGHT_FETCH_TIMEOUT = 5000; // ms
const HIGHLIGHT_SAVE_TIMEOUT = 10000; // ms
const MAX_HIGHLIGHTS_PER_USER = 1000; // limit
```

---

## Changelog

### Version 1.0 (Current)
- Initial release
- 6 highlight colors
- Delete functionality
- Persistent storage
- Mobile support
- Dark mode support

### Planned Features
- Multiple highlights per selection
- Highlight notes/annotations
- Share highlights
- Export highlights
- Search highlights
- Highlight statistics

