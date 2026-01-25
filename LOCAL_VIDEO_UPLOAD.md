# Local Video Upload Feature

## Overview
The RET Hub now supports uploading local video files for use in module content. This allows you to upload your own videos (MP4, WebM, MOV, AVI) directly to the server instead of relying only on external video URLs.

## Features
✅ **Local Video Upload** - Upload video files up to 500MB  
✅ **Progress Tracking** - Real-time upload progress display  
✅ **File Validation** - Automatic validation of video formats  
✅ **Easy Integration** - Simple URLs for embedding videos  
✅ **Video Management** - Upload and delete videos easily  

## Getting Started

### 1. Using the Video Manager UI
The easiest way to upload videos is through the Video Manager interface:

```
Open: http://localhost:8787/video-manager.html
```

Features:
- Drag and drop video files
- Click to select from browser
- Real-time upload progress
- Success/error notifications

### 2. Using VideoUploadManager (JavaScript)
For programmatic uploads, use the `VideoUploadManager` class:

```javascript
// Create a manager instance
const manager = new VideoUploadManager({
  apiBase: '/api',
  maxFileSize: 500 * 1024 * 1024,  // 500MB
  onProgress: (progress) => {
    console.log(`Upload: ${progress.percent.toFixed(0)}%`);
  },
  onSuccess: (response) => {
    console.log('✓ Video uploaded:', response.videoUrl);
    // Use response.videoUrl in your module content
  },
  onError: (error) => {
    console.error('✗ Upload error:', error);
  }
});

// Upload a file
const fileInput = document.getElementById('video-input');
manager.upload(fileInput.files[0]);
```

### 3. Using HTML Form
For traditional form-based uploads:

```html
<form id="upload-form" enctype="multipart/form-data">
  <input type="file" name="video" accept="video/*" required>
  <button type="submit">Upload Video</button>
</form>

<script>
  document.getElementById('upload-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const response = await fetch('/api/upload-local-video', {
      method: 'POST',
      body: formData
    });
    const result = await response.json();
    console.log('Video URL:', result.videoUrl);
    // Use result.videoUrl in module content
  });
</script>
```

## API Endpoints

### Upload Video
**Endpoint:** `POST /api/upload-local-video`

Upload a video file to the server.

**Request:**
```
Method: POST
Content-Type: multipart/form-data
Body: 
  - video: (File) The video file to upload
```

**Response (Success - 200):**
```json
{
  "success": true,
  "videoUrl": "/videos/video-name-1234567890.mp4",
  "fileName": "video-name-1234567890.mp4",
  "message": "Video uploaded successfully"
}
```

**Response (Error - 400/500):**
```json
{
  "error": "Error message describing the issue"
}
```

### Delete Video
**Endpoint:** `DELETE /api/delete-video`

Delete an uploaded video file.

**Request:**
```
Method: DELETE
Content-Type: application/json
Body:
{
  "fileName": "video-name-1234567890.mp4"
}
```

**Response (Success - 200):**
```json
{
  "success": true,
  "message": "Video deleted successfully"
}
```

### Serve Videos
**Endpoint:** `GET /videos/:fileName`

Retrieve an uploaded video file.

**Example:**
```
http://localhost:8787/videos/video-name-1234567890.mp4
```

## Using Uploaded Videos in Modules

Once you've uploaded a video, you can use the returned URL in your module content:

### In Module Metadata
When creating or editing a module, you can store the video URL:

```javascript
// Module data
{
  "title": "Solar Panel Installation",
  "video": "/videos/solar-installation-1234567890.mp4",
  "content": "..."
}
```

### In HTML Content
Embed videos directly in your HTML:

```html
<h2>Module Video</h2>
<video width="100%" height="auto" controls>
  <source src="/videos/solar-installation-1234567890.mp4" type="video/mp4">
  Your browser does not support the video tag.
</video>
```

### In Markdown Content
Reference videos in markdown:

```markdown
## Watch This Video

<video width="100%" height="auto" controls>
  <source src="/videos/solar-installation-1234567890.mp4" type="video/mp4">
</video>
```

## Constraints & Limits

| Constraint | Value |
|-----------|-------|
| **Max File Size** | 500MB |
| **Allowed Formats** | MP4, MPEG, MOV, WebM, AVI |
| **Storage Location** | `server/videos/` |
| **File Naming** | `{original-name}-{timestamp}.{ext}` |

## Storage Structure

```
server/
└── videos/
    ├── solar-installation-1704067800000.mp4
    ├── wind-turbine-1704067850000.mp4
    └── ...
```

## Security Features

✅ **File Type Validation** - Only video files are accepted  
✅ **File Size Limits** - Prevents massive uploads  
✅ **Path Traversal Protection** - Prevents directory escape attacks  
✅ **Unique Filenames** - Timestamp-based naming prevents conflicts  
✅ **Directory Isolation** - Videos stored in isolated directory  

## Troubleshooting

### Upload Fails with "Invalid File Type"
- Ensure your file is a valid video format (MP4, WebM, MOV, AVI)
- Check the file extension matches the content

### Upload Fails with "File Too Large"
- Your video exceeds 500MB
- Compress the video using tools like:
  - FFmpeg: `ffmpeg -i input.mp4 -crf 23 output.mp4`
  - Handbrake (GUI tool)
  - Online video compressors

### Cannot Access Uploaded Video
- Verify the server is running
- Check the returned URL is correct
- Ensure no firewalls are blocking the `/videos` directory

### Server Not Responding
- Start the server: `cd server && npm start`
- Check port 8787 is available
- Review server logs for errors

## Example: Complete Workflow

```javascript
// 1. Create upload manager
const videoUpload = new VideoUploadManager({
  apiBase: '/api'
});

// 2. Handle upload
document.getElementById('upload-btn').addEventListener('click', () => {
  const fileInput = document.getElementById('video-input');
  const file = fileInput.files[0];
  
  videoUpload.onProgress = (p) => {
    updateProgressBar(p.percent);
  };
  
  videoUpload.onSuccess = (response) => {
    // 3. Get the video URL
    const videoUrl = response.videoUrl;
    
    // 4. Save to module
    saveModuleWithVideo({
      title: 'My Course',
      video: videoUrl,
      content: 'Module content...'
    });
  };
  
  videoUpload.onError = (error) => {
    showError(error);
  };
  
  // 5. Upload!
  videoUpload.upload(file);
});

// 6. Use in HTML
function displayModule(module) {
  return `
    <video controls width="100%">
      <source src="${module.video}" type="video/mp4">
    </video>
    <p>${module.content}</p>
  `;
}
```

## Development Notes

### Adding to Admin Dashboard
To add video upload to the admin dashboard:

```javascript
// In adminDashboard.js
import VideoUploadManager from './js/videoUploadManager.js';

// Create a video upload section
const videoManager = new VideoUploadManager({
  apiBase: '/api',
  onSuccess: (response) => {
    // Update module with video URL
    console.log('Video ready:', response.videoUrl);
  }
});
```

### Serving Videos in Production
For production deployments, consider:
1. Using a CDN for video delivery
2. Compressing videos before upload
3. Generating thumbnails for videos
4. Implementing access controls

## License
This feature is part of the Aubie RET Hub platform.

---

**Last Updated:** January 2026  
**Version:** 1.0
