/**
 * Migration script to copy existing module data from files to MongoDB.
 * Run: node migrate_modules_to_db.js
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const db = require('./db');
const storage = require('./storage');

async function run() {
  await db.init();
  if (!db.isConnected()) {
    console.error('MongoDB not connected. Set MONGODB_URI and try again.');
    process.exit(1);
  }

  const models = db.models;
  const modulesDir = path.join(__dirname, '..', 'data', 'modules');

  if (!fs.existsSync(modulesDir)) {
    console.log('No modules directory found, nothing to migrate.');
    return;
  }

  const courses = fs.readdirSync(modulesDir).filter(f => fs.statSync(path.join(modulesDir, f)).isDirectory());

  for (const courseId of courses) {
    const idxPath = path.join(modulesDir, courseId, 'index.json');
    if (fs.existsSync(idxPath)) {
      try {
        const data = JSON.parse(fs.readFileSync(idxPath, 'utf8')) || [];
        // For each module, read the content if it's a file reference
        for (const module of data) {
          // Get the actual markdown file reference
          const mdFileName = module.content || module.file;
          if (mdFileName && typeof mdFileName === 'string') {
            const mdPath = path.join(modulesDir, courseId, mdFileName);
            if (fs.existsSync(mdPath)) {
              // Read the markdown content and store it directly in the module
              module.markdownContent = fs.readFileSync(mdPath, 'utf8');
            }
          }
          // Read quiz, projects, objectives if they are file references
          if (module.quiz && typeof module.quiz === 'string' && module.quiz.endsWith('.json')) {
            const quizPath = path.join(modulesDir, courseId, module.quiz);
            if (fs.existsSync(quizPath)) {
              module.quizData = JSON.parse(fs.readFileSync(quizPath, 'utf8'));
            }
          }
          if (module.projects && typeof module.projects === 'string' && module.projects.endsWith('.json')) {
            const projPath = path.join(modulesDir, courseId, module.projects);
            if (fs.existsSync(projPath)) {
              module.projectsData = JSON.parse(fs.readFileSync(projPath, 'utf8'));
            }
          }
          if (module.objectives && typeof module.objectives === 'string' && module.objectives.endsWith('.json')) {
            const objPath = path.join(modulesDir, courseId, module.objectives);
            if (fs.existsSync(objPath)) {
              module.objectivesData = JSON.parse(fs.readFileSync(objPath, 'utf8'));
            }
          }
        }
        await models.Module.updateOne({ courseId }, { $set: { courseId, data } }, { upsert: true });
        console.log(`Migrated modules for course: ${courseId} (${data.length} modules)`);
      } catch (e) {
        console.error(`Error migrating course ${courseId}:`, e);
      }
    }
  }

  console.log('Module migration completed.');
  process.exit(0);
}

run().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});