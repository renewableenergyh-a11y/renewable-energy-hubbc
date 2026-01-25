# Deploy Panel Improvements - New Workflow

## Overview
The Deploy Panel has been significantly enhanced to allow managing pending courses with their modules and content before deployment. This eliminates the old workflow requirement of deploying courses first to add modules, and deploying modules first to add content.

## New Workflow

### 1. Create a Course (Pending)
- Go to **Courses** tab
- Add a new course (it's automatically saved as "Pending Deploy")
- The course is NOT yet deployed

### 2. Expand Course in Deploy Panel
- Go to **Deploy** tab
- Click on any pending course to expand it
- The expanded view shows:
  - **Pending Modules** - All modules added to this course (before deployment)
  - **Pending Content** - All markdown content for modules (before deployment)
  - Action buttons to **Deploy Course** or **Delete**

### 3. Add Modules to Pending Course
- Go to **Modules** tab
- In the course dropdown, you'll see:
  - Deployed Courses (first group)
  - **Pending Courses (Not Yet Deployed)** (second group)
- Select your pending course
- Add modules directly - no deployment needed!
- Modules are automatically saved to "Pending Modules"

### 4. Add Content to Pending Modules
- Go to **Content** tab
- In the course dropdown, you'll see both deployed and pending courses
- Select your pending course
- Choose a pending module and edit its content
- The content is saved to "Pending Content" automatically

### 5. Deploy Everything at Once
- Go to **Deploy** tab
- Expand your pending course
- Review all modules and content in the expanded view
- Click **"Deploy Course"** button
- All modules and content are deployed together

## Deploy Panel Sections

### Pending Courses
- **Shows:** All courses waiting to be deployed
- **Actions:**
  - Click to **expand/collapse** and see modules & content
  - **Deploy Course** - publishes everything
  - **Delete** - removes the pending course
- **Info shown when expanded:**
  - Pending Modules count
  - Pending Content count
  - Quick edit/delete buttons for each item

### Pending Modules (Standalone)
- **Shows:** Only modules for already-deployed courses that have pending changes
- **Note:** Modules for pending courses appear in the expanded course section above
- **Actions:**
  - **Deploy** - publishes the module metadata
  - **Delete** - removes the pending module

### Pending Content (Standalone)
- **Shows:** Only content for already-deployed courses that have pending changes
- **Note:** Content for pending courses appears in the expanded course section above
- **Actions:**
  - **Review** - preview the markdown
  - **Edit** - go to Content tab and edit
  - **Deploy** - publishes the content
  - **Delete** - removes the pending content

## Key Benefits

✅ **Better UX** - No forced deployment sequence
✅ **Safe Reviews** - Review everything before publishing
✅ **Batch Operations** - Deploy course with all modules & content together
✅ **Flexible Workflow** - Create complete courses before going live
✅ **Clear Organization** - Pending vs deployed modules clearly separated

## Technical Details

### New Features
- **Expandable Course Cards** - Click course header to show/hide modules & content
- **Grouped Dropdowns** - Deployed and Pending courses in separate optgroups
- **Course Filtering** - Standalone modules/content filtered to show only non-pending courses
- **Dual-Source Loading** - Modules & content loaded from both deployed and pending sources

### API Endpoints Used
- `GET /api/pending-courses` - List all pending courses
- `POST /api/pending-courses/:id/deploy` - Deploy a pending course
- `GET /api/pending-modules` - List all pending modules
- `GET /api/pending-content` - List all pending content
- Filtering by courseId done client-side for flexibility

### Storage
- Pending courses in: `data/pending_courses.json`
- Pending modules in: `data/pending_modules/:courseId/index.json`
- Pending content in: `data/pending_content/:courseId/:file.md`
