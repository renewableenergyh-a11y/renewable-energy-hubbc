# Bidirectional Storage: Database ↔ localStorage

## Current Implementation Status

✅ **YES** - Both the database AND localStorage accept and persist changes/edits

## Data Flow for Edits/Changes

### When Admin Creates/Edits a Course:

```
1. Admin clicks "Create Course" or "Save Changes"
   ↓
2. Data sent to `/api/pending-courses` (POST)
   ↓
3. Server saves to:
   - MongoDB Course collection
   - data/courses.json file
   ↓
4. Frontend immediately syncs to localStorage:
   - Fetches updated courses from `/api/admin/courses`
   - Calls StorageSync.saveCourses(courses)
   - Saves to localStorage['courses_cache']
   ↓
5. UI reloads from both sources:
   - Database (via API)
   - localStorage cache
```

### When Admin Creates/Edits a Module (content/quiz/objectives/etc):

```
1. Admin clicks "Save" on module editor
   ↓
2. Data sent to `/api/modules/{courseId}` (POST)
   ↓
3. Server saves to:
   - MongoDB Module collection
   - data/modules/{courseId}/index.json file
   ↓
4. Frontend immediately syncs to localStorage:
   - Fetches updated modules from `/api/modules/{courseId}`
   - Calls StorageSync.saveModules(courseId, modules)
   - Saves to localStorage['modules_{courseId}']
   ↓
5. Module content displays from cache or server
```

## Operations That Trigger Sync

### Course Operations:
- ✅ Add new course → syncs to localStorage
- ✅ Edit existing course → syncs to localStorage
- ✅ Load course list (admin) → syncs to localStorage
- ✅ Load featured courses (homepage) → syncs to localStorage
- ✅ Load all courses (courses page) → syncs to localStorage

### Module Operations:
- ✅ Save learning objectives → syncs to localStorage
- ✅ Save quiz questions → syncs to localStorage
- ✅ Save projects → syncs to localStorage
- ✅ Save resources → syncs to localStorage
- ✅ Load modules for display → syncs to localStorage
- ✅ Load modules for tagging → syncs to localStorage

## Three-Layer Persistence

Every piece of data is now stored in THREE places simultaneously:

### Layer 1: MongoDB Database
- Primary data store
- Survives server restarts
- Queryable and indexed
- Backup source of truth

### Layer 2: JSON Files
- `data/courses.json`
- `data/modules/{courseId}/index.json`
- File-system backup
- Human-readable fallback

### Layer 3: Browser localStorage
- Client-side cache
- ~5-10MB available per domain
- Instant access without network
- Survives page reloads

## Sync Strategy

### Writing Data (Server → Client):
```
Admin edits → POST to /api/pending-courses
Server saves to DB + Files
Server responds with success
Frontend fetches latest data
Frontend caches to localStorage
```

### Reading Data (Client):
```
Frontend requests data
StorageSync.loadAndSync*():
  ├─ Try to fetch from server
  ├─ If success: save to localStorage + return
  └─ If fail: return from localStorage cache
```

## Offline Support

If the server becomes unavailable:
- Users can still access cached courses and modules
- Admin dashboard will still display last-synced data
- Cannot create new changes, but can view existing content
- When server returns: data re-syncs automatically

## localStorage Keys Used

```
courses_cache              → JSON array of all courses
courses_cache_timestamp    → ISO timestamp of last sync

modules_{courseId}         → JSON array of modules for course
modules_{courseId}_timestamp → ISO timestamp of last sync
```

## Example: Admin Edits a Course

```javascript
// 1. Admin clicks Edit on "Solar Energy" course
editCourseId.value = "solar-energy"

// 2. Admin changes title and clicks Save
POST /api/pending-courses {
  courseId: "solar-energy",
  title: "Solar Power Systems",
  slug: "solar-power",
  description: "...",
  accessType: "free",
  isNew: false
}

// 3. Server processes:
db.Course.updateOne({ _id: "solar-energy" }, { ...newData })  // MongoDB
fs.writeFileSync("data/courses.json", JSON.stringify([...]))   // File

// 4. Server responds: 200 OK

// 5. Frontend IMMEDIATELY:
const courses = await fetch('/api/admin/courses').json()
await StorageSync.saveCourses(courses)
localStorage['courses_cache'] = JSON.stringify(courses)
localStorage['courses_cache_timestamp'] = "2026-01-15T14:30:00Z"

// 6. Next page load (users):
const courses = await StorageSync.loadAndSyncCourses()
// Fetches from server, saves to localStorage, returns data
// Course "Solar Power Systems" title is already cached
```

## Data Consistency Guarantee

The three-layer approach ensures:

✅ **No data loss**: Even if one layer fails, other two have the data
✅ **Always in sync**: Each edit updates all three layers
✅ **Fast access**: localStorage hits are instant
✅ **Offline capable**: Can read from cache without server
✅ **Real-time**: Server is primary, cache is secondary

## Verification

To verify both storage layers have the data:

### Check Database:
```bash
# MongoDB
db.Course.find().pretty()  # Should show all courses
db.Module.find({ courseId: "solar-energy" }).pretty()  # Should show modules
```

### Check Files:
```bash
data/courses.json                    # Contains all courses
data/modules/solar-energy/index.json # Contains modules
```

### Check localStorage:
```javascript
// In browser console:
JSON.parse(localStorage.getItem('courses_cache'))
JSON.parse(localStorage.getItem('modules_solar-energy'))
localStorage.getItem('courses_cache_timestamp')
localStorage.getItem('modules_solar-energy_timestamp')
```

## Summary

✅ **Database**: Accepts edits via API endpoints
✅ **localStorage**: Syncs immediately after edits
✅ **Files**: Backed up on disk via server
✅ **Real-time**: All three stay synchronized
✅ **Failover**: Any layer can serve as fallback
