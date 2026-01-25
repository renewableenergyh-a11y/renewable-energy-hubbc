# Edit Course Feature - User Guide

## Overview
The Edit Course feature allows administrators to modify existing courses in the RET Hub system. This includes updating titles, descriptions, categories, and course images.

## Access the Feature

### Step 1: Open Admin Dashboard
- Navigate to `http://localhost:8787/admin-dashboard.html`
- You will see the login screen
- Log in with admin credentials (or it will auto-login in demo mode)

### Step 2: Navigate to Courses Tab
- In the main dashboard, click the **"Courses"** tab
- You will see two sections:
  - **Left:** List of existing courses
  - **Right:** "Add Course" form (initially visible)

## How to Edit a Course

### Step 1: View Available Courses
The left panel displays all existing courses with:
- Course title
- Course slug (URL identifier)
- Two action buttons: **Edit** and **Delete**

### Step 2: Click Edit Button
- Click the blue **"Edit"** button next to the course you want to modify
- The interface will:
  - Hide the "Add Course" form
  - Show the "Edit Course" form
  - Scroll to the top
  - Pre-fill all fields with current course data

### Step 3: Modify Course Information
Update any of these fields:
- **Title:** The display name of the course
- **Slug:** The URL-friendly identifier (used in course URLs)
- **Image URL:** Link to the course thumbnail image
- **Category:** The course category (e.g., "solar", "wind", "biomass")
- **Description:** Detailed description of the course

### Step 4: Save Changes
- Click **"Save Changes"** button
- The system will:
  - Validate that Title and Slug are filled
  - Send update to server
  - Refresh the course list
  - Show success confirmation

### Step 5: Verify Changes
- The course list updates immediately
- Check that your changes appear in the course list
- All changes are persisted to the database

## Cancel Editing

If you want to exit the edit mode without saving:
1. Click the **"Cancel"** button in the Edit Course form
2. The form will:
   - Hide the Edit Course form
   - Show the Add Course form again
   - Discard any unsaved changes

## Field Requirements

| Field | Required | Notes |
|-------|----------|-------|
| Title | Yes | Must not be empty |
| Slug | Yes | Must not be empty, used in URLs |
| Image URL | No | Leave blank or provide valid image URL |
| Category | No | Optional, helps organize courses |
| Description | No | Can be empty or contain course overview |

## Error Messages

### "Title and slug required"
- **Cause:** You left either Title or Slug field empty
- **Solution:** Fill in both fields before clicking Save

### "Failed to update course"
- **Cause:** Server error when saving
- **Solution:** Check server logs and try again

## Tips & Best Practices

1. **Slug Format:**
   - Use lowercase letters, numbers, and hyphens only
   - Example: "solar-fundamentals", "wind-energy-systems"
   - Avoid spaces and special characters

2. **Image URLs:**
   - Use HTTPS URLs for better security
   - Test that the URL works before saving
   - Keep image files small for faster loading

3. **Descriptions:**
   - Keep descriptions concise (under 200 characters recommended)
   - Use clear, student-friendly language
   - Include key topics covered in the course

4. **Categories:**
   - Use consistent category names across courses
   - Examples: "solar", "wind", "biomass", "geothermal", "hydro"

## Example Workflow

### Before Edit:
```
Course: Solar Energy
Slug: solar
Category: solar
Description: Learn solar power systems and technologies.
```

### Edit Steps:
1. Click "Edit" button next to Solar Energy
2. Update Title to "Advanced Solar Energy Systems"
3. Update Slug to "solar-advanced"
4. Update Description to "Learn advanced solar photovoltaic and thermal systems"
5. Click "Save Changes"

### After Edit:
```
Course: Advanced Solar Energy Systems
Slug: solar-advanced
Category: solar
Description: Learn advanced solar photovoltaic and thermal systems
```

## Keyboard Shortcuts

- **Tab:** Move between form fields
- **Enter:** Submit form (when in the form)
- **Escape:** (Future feature) Cancel editing

## Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| Changes not appearing | Refresh the page or click another tab and back |
| Image not loading | Verify the URL is correct and publicly accessible |
| Can't see Edit button | Make sure you're on the Courses tab |
| Form fields not pre-filling | Try editing a different course |

## Related Features

- **Add Course:** Create new courses using the "Add Course" form
- **Delete Course:** Remove courses using the "Delete" button (with confirmation)
- **Module Management:** Manage modules within courses (separate tab)
- **Content Management:** Edit module content and files

## Technical Notes

### API Used:
- **Endpoint:** `PUT /api/admin/courses/:id`
- **Method:** HTTP PUT
- **Content-Type:** application/json

### Fields Updated:
- `title`
- `slug`
- `description`
- `image`
- `category`
- `updatedAt` (automatically set to current timestamp)

### Fields Not Editable:
- `id` (course ID - cannot be changed)
- `createdAt` (creation timestamp - cannot be changed)

## Support

For issues or questions:
1. Check the error message displayed
2. Review this guide's troubleshooting section
3. Check the browser console for error details (F12)
4. Review server logs at `server/` directory
