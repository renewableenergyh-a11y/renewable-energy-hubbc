# DashboardDefense Quick Reference

## Common Operations

### Get an Element
```javascript
// ❌ Direct - crashes if null
const btn = document.getElementById('submit');
btn.addEventListener('click', handler);

// ✅ Safe
const btn = DashboardDefense.safeGetElement('#submit', 'submit button');
```

### Get Multiple Elements  
```javascript
// ✅ Safe
const buttons = DashboardDefense.safeGetElements('.btn', 'action buttons');
buttons.forEach(btn => {
  DashboardDefense.safeAddEventListener(btn, 'click', handler, 'click');
});
```

### Add Event Listener
```javascript
// ✅ Safe - handler errors won't break other listeners
DashboardDefense.safeAddEventListener(
  element, 
  'click', 
  (e) => { /* your code */ },
  'descriptive name'
);
```

### Set Element Properties
```javascript
// ✅ Safe
DashboardDefense.safeSetProperty(
  element,
  'textContent',
  'New text',
  'updating label'
);
```

### Toggle CSS Class
```javascript
// ✅ Safe
DashboardDefense.safeToggleClass(
  element,
  'active',
  true, // true = add, false = remove, undefined = toggle
  'activating button'
);
```

### Make API Call
```javascript
// ✅ Safe - includes timeout, error handling, validation
const data = await DashboardDefense.safeApiFetch(
  '/api/modules/biomass',
  { method: 'GET' },
  'loading modules',
  5000 // 5 second timeout
);

if (data) {
  console.log('Success:', data);
} else {
  console.log('Failed to load');
}
```

### Validate Data Structure
```javascript
// ✅ Safe
const schema = {
  id: 'string',
  title: 'string',
  content: 'any'
};

if (DashboardDefense.validateData(apiResponse, schema, 'api response')) {
  // Safe to use apiResponse
}
```

### Execute Risky Code
```javascript
// ✅ Safe - errors are caught
const result = DashboardDefense.safeExecute(() => {
  // Any code that might throw
  return complexCalculation();
}, 'complex operation', null); // null = fallback value

if (result !== null) {
  // Success
} else {
  // Operation failed
}
```

### Create Modal
```javascript
// ✅ Safe
DashboardDefense.createSafeModal({
  title: 'Confirm Action',
  content: 'Are you sure?',
  buttons: [
    {
      text: 'Yes',
      onClick: () => { /* do something */ },
      primary: true
    },
    {
      text: 'No',
      onClick: () => { /* cancel */ },
      primary: false
    }
  ],
  onClose: () => { /* cleanup */ },
  context: 'confirmation modal'
});
```

## One-Liners

```javascript
// Safe element query with context
const el = DashboardDefense.safeGetElement('.selector', 'description');

// Multiple elements
const els = DashboardDefense.safeGetElements('.selector', 'description');

// Safe click handler
DashboardDefense.safeAddEventListener(el, 'click', handler, 'handler name');

// Toggle active class
DashboardDefense.safeToggleClass(el, 'active', true, 'activating');

// Safe API GET
const data = await DashboardDefense.safeApiFetch('/api/endpoint', {method: 'GET'}, 'operation', 5000);

// Safe API POST
const resp = await DashboardDefense.safeApiFetch('/api/endpoint', {method: 'POST', body: JSON.stringify({...})}, 'saving', 5000);

// Validate data
DashboardDefense.validateData(obj, {prop1: 'string', prop2: 'number'}, 'validation name');

// Execute safely
DashboardDefense.safeExecute(() => riskyCode(), 'operation name', fallbackValue);

// Check element health
const health = DashboardDefense.monitorElement(el, 'element description');

// Batch operations
const result = DashboardDefense.batchSafeOperations([
  {element: el1, property: 'disabled', value: true, context: 'disabling el1'},
  {element: el2, property: 'disabled', value: false, context: 'enabling el2'}
]);

// Enable debug logging
DashboardDefense.setDebugMode(true);
```

## Error Messages Explained

| Message | Means | Fix |
|---------|-------|-----|
| "Element not found" | Selector didn't match anything | Check selector has `#` for IDs, `.` for classes |
| "Element not in DOM" | Found element but it's not in the page | Element was removed or not created yet |
| "Invalid selector" | Selector is null/undefined | Check you passed a valid string |
| "handler is not a function" | Second param to listener isn't a function | Make sure you're passing a function |
| "Type mismatch" | Data validation failed | Check schema matches actual data |
| "API timeout" | Request exceeded time limit | Server is slow, increase timeout |
| "API error" | Server returned error status | Check endpoint, authentication, request format |

## Debugging

### Enable Debug Mode
```javascript
DashboardDefense.setDebugMode(true);
// Now all operations are logged to console
```

### Check Element Health
```javascript
const health = DashboardDefense.monitorElement(myElement, 'my element');
console.log(health);
// {inDOM: true, visible: true, hasContent: true, classNames: "...", context: "..."}
```

### Monitor Operation Success
```javascript
const btn = DashboardDefense.safeGetElement('#btn', 'submit button');
if (btn) {
  console.log('✅ Found button');
} else {
  console.warn('❌ Button not found');
}
```

## Protection Layers

### Automatic (Always Active)
- ✅ Global error boundary
- ✅ Unhandled promise rejection handler
- ✅ Critical element monitoring
- ✅ Protected core functions

### Manual (Use in Your Code)
- ✅ Safe element access
- ✅ Safe event listeners
- ✅ Safe API calls
- ✅ Data validation
- ✅ Error boundaries
- ✅ Safe operations

## Common Patterns

### Safe Form Handling
```javascript
const form = DashboardDefense.safeGetElement('#myForm', 'submit form');

DashboardDefense.safeAddEventListener(form, 'submit', async (e) => {
  e.preventDefault();
  
  const data = new FormData(form);
  const json = Object.fromEntries(data);
  
  const response = await DashboardDefense.safeApiFetch(
    form.action,
    {method: 'POST', body: JSON.stringify(json)},
    'form submission',
    8000
  );
  
  if (response) {
    console.log('✅ Submitted');
  } else {
    console.log('❌ Failed');
  }
}, 'form submit');
```

### Safe Tab Switching
```javascript
const tabName = 'modules';
const panel = DashboardDefense.safeGetElement(`#${tabName}-panel`, `${tabName} panel`);

DashboardDefense.safeGetElements('.tab-panel', 'all panels').forEach(p => {
  DashboardDefense.safeToggleClass(p, 'active', false, 'deactivating');
});

DashboardDefense.safeToggleClass(panel, 'active', true, `activating ${tabName}`);
```

### Safe Data Loading
```javascript
const data = await DashboardDefense.safeApiFetch('/api/data', {}, 'loading data', 5000);

if (!data) {
  console.warn('Failed to load');
  return;
}

if (!DashboardDefense.validateData(data, {id: 'string', items: 'any'}, 'response')) {
  console.warn('Invalid format');
  return;
}

// Safe to use data
console.log(data.id);
```

## Performance Notes

- Each safe operation: <1ms overhead
- Validation: <0.5ms overhead
- Element monitoring: Runs every 30s, negligible impact
- No memory leaks
- No DOM mutations unless you call functions

## Tips

✅ **DO:**
- Use descriptive context strings (helps debugging)
- Validate data from external sources
- Test with missing elements
- Enable debug mode during development
- Catch failures gracefully

❌ **DON'T:**
- Mix safe and unsafe DOM access
- Skip validation for "trusted" data
- Ignore warnings in console
- Have handlers that assume elements exist
- Use generic element IDs

## Cheat Sheet

```javascript
// GET element
DashboardDefense.safeGetElement(selector, context);

// GET elements  
DashboardDefense.safeGetElements(selector, context);

// ADD listener
DashboardDefense.safeAddEventListener(el, event, handler, context);

// REMOVE listener
DashboardDefense.safeRemoveEventListener(el, event, handler, context);

// SET property
DashboardDefense.safeSetProperty(el, prop, value, context);

// TOGGLE class
DashboardDefense.safeToggleClass(el, class, force, context);

// VALIDATE data
DashboardDefense.validateData(obj, schema, context);

// EXECUTE safely
DashboardDefense.safeExecute(fn, context, fallback);

// API call
DashboardDefense.safeApiFetch(url, options, context, timeout);

// CREATE modal
DashboardDefense.createSafeModal(config);

// MONITOR element
DashboardDefense.monitorElement(el, context);

// BATCH operations
DashboardDefense.batchSafeOperations(array);

// DEBUG mode
DashboardDefense.setDebugMode(enabled);
```

---

**Remember:** When in doubt, use the safe version. The protection system is there to make your dashboard stable and your life easier.
