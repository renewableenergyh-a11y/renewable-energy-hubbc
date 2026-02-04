# Text Highlighting System - Quick Reference Guide

## For Users

### Creating a Highlight
1. Select any text in the module
2. A toolbar appears above your selection with 6 colors
3. Click a color to highlight the text
4. Your highlight is saved automatically

### Changing a Highlight Color
1. Click on an already-highlighted word
2. The toolbar reappears
3. Click a different color to change it
4. The change saves automatically

### Removing a Highlight
1. Click on highlighted text
2. Click the trash icon in the toolbar
3. The highlight disappears

### Mobile/Touch
- Text selection works with touch
- Long-press text to select
- Toolbar appears above your selection
- Tap color buttons as usual

---

## For Developers

### Architecture Overview

```
Frontend                          Backend
├─ modulePage.js                 ├─ server/index.js
│  ├─ initializeHighlighting()   ├─ routes/highlightRoutes.js
│  ├─ setupSelectionListeners()  └─ db.js (models.Highlight)
│  └─ handleColorSelect()
├─ highlightService.js           MongoDB
│  ├─ fetchHighlights()          └─ highlights collection
│  ├─ saveHighlight()
│  ├─ updateHighlight()
│  └─ deleteHighlight()
└─ highlightToolbar.js
   └─ HighlightToolbar class
```

### Adding Highlights to New Content Types

1. **Import the service** in your page file:
```javascript
import { fetchHighlights, ... } from "../core/highlightService.js";
import { HighlightToolbar } from "../components/highlightToolbar.js";
```

2. **Call initialization** after content renders:
```javascript
await initializeHighlighting(contentContainer, contentId, 'course');
// Instead of 'module', use 'course' for course content
```

3. **Ensure container has correct ID**:
```html
<div id="module-content"><!-- Your content here --></div>
```

### API Endpoints

All require `Authorization: Bearer {token}` header

```
GET    /api/highlights/:contentType/:contentId
       Returns: { highlights: [...] }

POST   /api/highlights
       Body: { contentId, contentType, text, startOffset, endOffset, color }
       Returns: { highlight: {...}, message: "..." }

PUT    /api/highlights/:highlightId
       Body: { color: "#FFFFFF" }
       Returns: { message: "...", highlight: {...} }

DELETE /api/highlights/:highlightId
       Returns: { message: "..." }
```

### Customizing Colors

Edit `js/components/highlightToolbar.js`, `HIGHLIGHT_COLORS` object:

```javascript
const HIGHLIGHT_COLORS = {
  orange: '#FFB84D',
  yellow: '#FFEB3B',
  green: '#81C784',
  blue: '#64B5F6',
  purple: '#BA68C8',
  pink: '#F48FB1'
};
```

Add or modify color objects. Update the CSS in `style.css` for sizing.

### Styling Customization

Key CSS classes in `style.css`:

```css
.text-highlight           /* Applied to each highlighted span */
.highlight-toolbar       /* The floating toolbar */
.highlight-toolbar-colors /* Container for color buttons */
.highlight-color-btn     /* Individual color button */
.highlight-delete-btn    /* Delete button */
```

### Error Handling

All errors are caught and logged to console:

```javascript
// Client errors
console.error('Error fetching highlights:', err);
console.error('Error saving highlight:', err);

// Server errors
res.status(500).json({ error: 'Failed to fetch highlights' });
```

For production, implement proper error tracking (Sentry, etc).

### Performance Notes

- **Single fetch per page load** - Highlights fetched once when module loads
- **Background saves** - Server operations don't block UI
- **Rollback on error** - Failed saves are reverted in DOM
- **No polling** - Uses native browser selection events
- **Efficient DOM** - Text nodes properly split/joined

### Testing

#### Manual Testing
1. Select text → Verify toolbar appears
2. Click color → Verify highlight applies immediately
3. Refresh page → Verify highlight persists
4. Click highlight → Verify toolbar reappears
5. Delete → Verify removal and no broken DOM

#### Browser DevTools
```javascript
// Check highlights in memory
window.currentTextSelection

// Check toolbar
window.highlightToolbar

// Check highlighted spans map
window.highlightedSpans
```

### Debugging

Enable console logging to track highlights:

```javascript
// In modulePage.js, add to initializeHighlighting():
console.log('Highlights fetched:', serverHighlights);
console.log('Toolbar created:', highlightToolbar);
```

Check for these in console:
- "✅ Highlight routes registered" - Server routes loaded
- "Error fetching highlights" - Database error
- DOM inspection - Check for `.text-highlight` spans

### Database Queries

View highlights in MongoDB:

```javascript
db.highlights.find({ userEmail: "user@example.com" })
db.highlights.deleteOne({ id: "highlight_id" })
```

### Known Limitations

1. **Text node splitting** - Complex HTML structures with nested elements may have issues
2. **Dynamic content** - If content changes after highlights load, highlights may move
3. **Large documents** - Reapplication may be slow with thousands of highlights
4. **Copy/paste** - Highlights don't copy with text

### Future Enhancements

- [ ] Highlight notes/annotations
- [ ] Shareable highlights
- [ ] Highlight search/filter
- [ ] Export highlights as PDF
- [ ] Highlight collaboration
- [ ] Undo/redo functionality

---

## Troubleshooting

### Toolbar Not Appearing
- Check if text selection is detected: `window.currentTextSelection`
- Verify content container has correct ID
- Check browser console for errors

### Highlights Not Persisting
- Verify token is being sent: Check Network tab → Authorization header
- Check database connection: Server logs should show "Connected to MongoDB"
- Verify user email is correct in token

### Colors Not Showing
- Check if Font Awesome icons load (trash icon)
- Verify CSS file is loaded: Check `css/style.css`
- Check for CSS conflicts: Inspect element in DevTools

### Mobile Touch Not Working
- Verify `touchend` listener is active
- Long-press may require explicit selection
- Check if iOS requires additional permissions

---

## Code Quality

- ESLint: No errors detected
- Syntax validation: All files pass Node.js `-c` check
- No new dependencies added
- Follows existing code style
- Comprehensive comments and JSDoc

