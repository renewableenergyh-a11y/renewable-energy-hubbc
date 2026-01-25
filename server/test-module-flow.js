const fetch = require('node-fetch');

const BASE_URL = 'http://127.0.0.1:8787';

async function test() {
  try {
    console.log('🔄 Testing full course → module → content flow...\n');

    // Step 1: Create a test course
    console.log('📝 Step 1: Creating test course...');
    const courseRes = await fetch(`${BASE_URL}/api/admin/courses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Wave Energy Test Course',
        slug: 'wave-test',
        description: 'Test course for modules',
        category: 'wave',
        image: 'https://via.placeholder.com/300x200?text=Wave'
      })
    });

    if (!courseRes.ok) {
      throw new Error(`Create course failed: ${courseRes.status} ${await courseRes.text()}`);
    }

    const course = await courseRes.json();
    const courseId = course.id;
    console.log(`✅ Course created: ${courseId}\n`);

    // Step 2: Create a module in the course
    console.log('📝 Step 2: Creating module in course...');
    const moduleRes = await fetch(`${BASE_URL}/api/modules/${courseId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Wave Fundamentals',
        file: 'module-1-wave-fundamentals.md',
        tag: 'Beginner',
        isPremium: false,
        content: '# Wave Fundamentals\n\n## Introduction\nWave energy is renewable energy from ocean waves.\n\n## Key Points\n- Waves are caused by wind\n- Energy density is high\n- Predictable patterns'
      })
    });

    if (!moduleRes.ok) {
      throw new Error(`Create module failed: ${moduleRes.status} ${await moduleRes.text()}`);
    }

    const module = await moduleRes.json();
    console.log(`✅ Module created: ${module.id}\n`);

    // Step 3: Fetch modules for the course
    console.log('📝 Step 3: Fetching modules for the course...');
    const getModulesRes = await fetch(`${BASE_URL}/api/modules/${courseId}`);

    if (!getModulesRes.ok) {
      throw new Error(`Get modules failed: ${getModulesRes.status}`);
    }

    const modules = await getModulesRes.json();
    console.log(`✅ Modules returned: ${modules.length}`);
    console.log(JSON.stringify(modules, null, 2));

    if (modules.length === 0) {
      console.error('\n❌ ERROR: No modules returned! Check the index.json file.');
      process.exit(1);
    }

    const foundModule = modules.find(m => m.id === module.id);
    if (!foundModule) {
      console.error(`\n❌ ERROR: Created module ${module.id} not found in returned list!`);
      process.exit(1);
    }

    console.log(`\n✅ SUCCESS: Module ${foundModule.id} found in API response!`);

    // Step 4: Fetch module content
    console.log('\n📝 Step 4: Fetching module content...');
    const contentRes = await fetch(`${BASE_URL}/api/module-content/${courseId}/${foundModule.content}`);

    if (!contentRes.ok) {
      throw new Error(`Get content failed: ${contentRes.status}`);
    }

    const content = await contentRes.text();
    console.log(`✅ Content fetched (${content.length} bytes):`);
    console.log(content.substring(0, 100) + '...\n');

    console.log('🎉 All tests passed! The module flow is working correctly.');
    process.exit(0);

  } catch (err) {
    console.error('❌ Test failed:', err.message);
    process.exit(1);
  }
}

test();
