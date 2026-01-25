// Test script to verify edit course functionality
const BASE_URL = 'http://localhost:8787';

async function testEditCourse() {
  try {
    console.log('🔍 Testing Edit Course functionality...\n');

    // Step 1: Fetch existing courses
    console.log('Step 1: Fetching existing courses...');
    const coursesRes = await fetch(`${BASE_URL}/api/admin/courses`);
    if (!coursesRes.ok) throw new Error(`Failed to fetch courses: ${coursesRes.status}`);
    const courses = await coursesRes.json();
    
    if (!courses || courses.length === 0) {
      console.log('❌ No courses found. Please create a course first.');
      return;
    }
    
    console.log(`✅ Found ${courses.length} course(s)`);
    const courseToEdit = courses[0];
    console.log(`   Selected course: ${courseToEdit.title} (ID: ${courseToEdit.id})\n`);

    // Step 2: Edit the course
    console.log('Step 2: Editing course...');
    const updateData = {
      title: courseToEdit.title + ' (Updated)',
      slug: courseToEdit.slug + '-updated',
      description: 'Updated description: ' + (courseToEdit.description || ''),
      image: courseToEdit.image || '',
      category: courseToEdit.category || ''
    };

    const editRes = await fetch(`${BASE_URL}/api/admin/courses/${courseToEdit.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updateData)
    });

    if (!editRes.ok) {
      const errorText = await editRes.text();
      throw new Error(`Failed to edit course: ${editRes.status} - ${errorText}`);
    }

    const updatedCourse = await editRes.json();
    console.log('✅ Course updated successfully!');
    console.log(`   New title: ${updatedCourse.title}`);
    console.log(`   New slug: ${updatedCourse.slug}\n`);

    // Step 3: Verify the update
    console.log('Step 3: Verifying update by fetching courses again...');
    const verifyRes = await fetch(`${BASE_URL}/api/admin/courses`);
    const updatedCourses = await verifyRes.json();
    const verified = updatedCourses.find(c => c.id === courseToEdit.id);

    if (verified && verified.title === updateData.title) {
      console.log('✅ Verification successful! Course has been updated in the database.');
      console.log(`   Verified title: ${verified.title}`);
    } else {
      console.log('❌ Verification failed! Course update was not persisted.');
    }
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

testEditCourse();
