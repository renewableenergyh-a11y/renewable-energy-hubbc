// Simple test for edit course functionality
(async () => {
  try {
    const BASE_URL = 'http://localhost:8787';
    
    console.log('🧪 Testing Edit Course API\n');
    
    // Test 1: GET courses
    console.log('Test 1: Fetching courses...');
    let res = await fetch(`${BASE_URL}/api/admin/courses`);
    let courses = await res.json();
    console.log(`✅ Found ${courses.length} courses`);
    
    if (courses.length === 0) {
      console.log('❌ No courses to edit');
      return;
    }
    
    const course = courses[0];
    console.log(`   Course ID: ${course.id}, Title: ${course.title}\n`);
    
    // Test 2: PUT (edit) course
    console.log('Test 2: Editing course...');
    const updatedData = {
      title: course.title + ' (TEST EDIT)',
      slug: course.slug + '-test',
      description: 'Test edit - ' + (course.description || ''),
      image: course.image || '',
      category: course.category || ''
    };
    
    res = await fetch(`${BASE_URL}/api/admin/courses/${course.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedData)
    });
    
    if (!res.ok) {
      console.log(`❌ Failed with status ${res.status}`);
      console.log(await res.text());
      return;
    }
    
    const updated = await res.json();
    console.log('✅ Course updated');
    console.log(`   New title: ${updated.title}\n`);
    
    // Test 3: Verify the change persisted
    console.log('Test 3: Verifying persistence...');
    res = await fetch(`${BASE_URL}/api/admin/courses`);
    courses = await res.json();
    const verified = courses.find(c => c.id === course.id);
    
    if (verified && verified.title === updatedData.title) {
      console.log(`✅ Edit successfully persisted!`);
      console.log(`   Verified: "${verified.title}"`);
    } else {
      console.log(`❌ Edit did not persist`);
    }
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
})();
