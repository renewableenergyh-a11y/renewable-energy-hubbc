# Quick Start: Local Video Upload

## 🚀 Immediate Usage

### Option 1: Use the Video Manager UI (Easiest)
1. Start your server: `cd server && npm start`
2. Open your browser: `http://localhost:8787/video-manager.html`
3. Drag and drop your video file
4. Copy the returned URL
5. Use the URL in your module content

### Option 2: Upload via JavaScript
```javascript
// In any HTML page with VideoUploadManager loaded
<script src="/js/videoUploadManager.js"></script>

<script>
  const uploader = new VideoUploadManager({
    apiBase: '/api',
    onSuccess: (result) => {
      console.log('Video ready:', result.videoUrl);
      // Use result.videoUrl in your module
    },
    onError: (error) => console.error('Failed:', error)
  });

  // When user selects file
  document.getElementById('fileInput').addEventListener('change', (e) => {
    uploader.upload(e.target.files[0]);
  });
</script>
```

### Option 3: Simple HTML Form
```html
<form id="videoForm" enctype="multipart/form-data">
  <input type="file" name="video" accept="video/*" required>
  <button type="submit">Upload</button>
</form>

<script>
  document.getElementById('videoForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const res = await fetch('/api/upload-local-video', {
      method: 'POST',
      body: formData
    });
    const data = await res.json();
    console.log('Video URL:', data.videoUrl);
  });
</script>
```

## 🎥 Using the Video URL

### In Module HTML
```html
<h2>Watch This Video</h2>
<video width="100%" height="auto" controls>
  <source src="/videos/my-video-1704067800000.mp4" type="video/mp4">
  Your browser does not support the video tag.
</video>
```

### In Module Metadata (JavaScript)
```javascript
const module = {
  title: "Solar Installation",
  video: "/videos/solar-install-1704067800000.mp4",
  content: "Module content here..."
};
```

## 📋 File Requirements

| Requirement | Details |
|-------------|---------|
| Format | MP4, MPEG, MOV, WebM, or AVI |
| Max Size | 500MB |
| Video Codec | H.264, H.265, VP8, VP9 |
| Audio Codec | AAC, MP3, Vorbis |

## 🔧 Server Details

- **Endpoint:** `POST /api/upload-local-video`
- **Port:** 8787 (default)
- **Storage:** `server/videos/` directory
- **Access:** `http://localhost:8787/videos/{filename}`

## ❓ Troubleshooting

**Issue:** "Cannot POST /api/upload-local-video"  
**Solution:** Make sure server is running (`npm start`)

**Issue:** File upload fails  
**Solution:** Check file size (max 500MB) and format (MP4, WebM, etc.)

**Issue:** Video won't play  
**Solution:** Verify browser supports video format, try MP4

**Issue:** Cannot access uploaded video  
**Solution:** Use correct path `/videos/filename.mp4`, check port 8787

## 📚 Full Documentation

For detailed information, see:
- [`LOCAL_VIDEO_UPLOAD.md`](LOCAL_VIDEO_UPLOAD.md) - Complete guide
- [`VIDEO_UPLOAD_IMPLEMENTATION.md`](VIDEO_UPLOAD_IMPLEMENTATION.md) - Technical details
- Run test: `node server/test-video-upload.js`

## ✅ Verification

Test the setup:
```bash
cd server
node test-video-upload.js
```

You should see:
```
✅ Test 1: Endpoint Existence
   ✓ Endpoint is responding
✅ Test 2: Videos Directory
✅ Test 3: Available Endpoints
✅ All tests completed successfully!
```

---

**Ready to upload videos!** 🎬
