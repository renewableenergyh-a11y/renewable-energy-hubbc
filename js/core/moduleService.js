// Detect if running on file:// protocol (local file, no server)
const isLocalFile = window.location.protocol === 'file:';

export async function getModulesForCourse(courseId) {
  try {
    console.log(`🔄 Fetching modules for course: ${courseId}...`);

    // If running locally, try to load modules JSON from the data folder
    if (isLocalFile) {
      console.log(`📁 Attempting to load local modules: data/modules/${courseId}/index.json`);
      const res = await fetch(`data/modules/${courseId}/index.json`);
      if (!res.ok) throw new Error(`Local file not found: data/modules/${courseId}/index.json`);
      const data = await res.json();
      console.log(`✅ Local modules loaded for ${courseId}:`, data);
      return data;
    }

    // Try to fetch from API
    try {
      const res = await fetch(`/api/modules/${courseId}`);
      console.log(`📡 Response status: ${res.status} ${res.statusText}`);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      console.log(`✅ Modules loaded for ${courseId}:`, data);
      // Cache to localStorage
      try {
        localStorage.setItem(`modules_${courseId}`, JSON.stringify(data));
        localStorage.setItem(`modules_${courseId}_timestamp`, new Date().toISOString());
      } catch(e) {
        console.warn('Could not cache to localStorage:', e);
      }
      return data;
    } catch (err) {
      console.warn(`API fetch failed: ${err.message}, trying localStorage cache...`);
      // Try cached version if available
      try {
        const cached = localStorage.getItem(`modules_${courseId}`);
        if (cached) {
          const data = JSON.parse(cached);
          console.log(`✅ Using cached modules for ${courseId}`);
          return data;
        }
      } catch(e) {
        console.warn('Could not read from localStorage:', e);
      }
      throw err;
    }
  } catch (err) {
    console.error(`❌ Error fetching modules for ${courseId}:`, err);
    // If API failed, try local data as a fallback
    try {
      console.log(`↩️ Trying local fallback: data/modules/${courseId}/index.json`);
      const resLocal = await fetch(`data/modules/${courseId}/index.json`);
      if (resLocal.ok) {
        const dataLocal = await resLocal.json();
        console.log(`✅ Fallback local modules loaded for ${courseId}`);
        return dataLocal;
      }
    } catch (lf) {
      console.warn(`⚠️ Local fallback failed for ${courseId}:`, lf);
    }

    return [];
  }
}

export async function getModuleContent(courseId, file) {
  try {
    console.log(`🔄 Fetching module content: ${courseId}/${file}...`);

    // If running locally, try to fetch the markdown file from the data folder
    if (isLocalFile) {
      console.log(`📁 Attempting to load local content: data/modules/${courseId}/${file}`);
      const res = await fetch(`data/modules/${courseId}/${file}`);
      if (!res.ok) throw new Error(`Local file not found: data/modules/${courseId}/${file}`);
      const text = await res.text();
      console.log(`✅ Local module content loaded: ${courseId}/${file}`);
      return text;
    }

    // First, try to get the module object which contains the content directly
    try {
      const modulesRes = await fetch(`/api/modules/${courseId}`);
      if (modulesRes.ok) {
        const modules = await modulesRes.json();
        const module = modules.find(m => m.file === file || m.content === file);
        if (module && module.markdownContent) {
          console.log(`✅ Module content loaded from object: ${courseId}/${file}`);
          return module.markdownContent;
        }
      }
    } catch (e) {
      console.warn(`⚠️ Could not fetch module object:`, e);
    }

    // Fallback to the dedicated API endpoint
    const res = await fetch(`/api/module-content/${courseId}/${file}`);
    console.log(`📡 Response status: ${res.status} ${res.statusText}`);
    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(`HTTP ${res.status}: ${error.error}`);
    }
    const text = await res.text();
    console.log(`✅ Module content loaded: ${courseId}/${file}`);
    return text;
  } catch (err) {
    console.error(`❌ Error fetching module content:`, err);
    // Fallback to trying a local file fetch
    try {
      const resLocal = await fetch(`data/modules/${courseId}/${file}`);
      if (resLocal.ok) {
        const textLocal = await resLocal.text();
        console.log(`✅ Fallback local module content loaded: ${courseId}/${file}`);
        return textLocal;
      }
    } catch (lf) {
      console.warn(`⚠️ Local content fallback failed for ${courseId}/${file}:`, lf);
    }

    return `# Content unavailable\n\nUnable to load module content for ${courseId}/${file}.`;
  }
}
