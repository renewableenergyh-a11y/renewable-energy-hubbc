const fetch = require('node-fetch');
const BASE = 'http://127.0.0.1:8787';
(async ()=>{
  const courseId = '7759ab1660d3';
  try {
    const body = {
      title: 'Admin Quiz Module',
      file: 'module-quiz-admin.md',
      tag: 'Test',
      isPremium: false,
      quiz: [
        { question: 'What is 2+2?', options: ['3','4','5'], answer: 1 },
        { question: 'Select water state', options: ['Solid','Liquid','Gas'], answer: 1 }
      ],
      projects: [ { title: 'Project A', description: 'Do something' } ],
      content: '# Admin Quiz Module\n\nContent here.'
    };
    const res = await fetch(`${BASE}/api/modules/${courseId}`, { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify(body) });
    console.log('status', res.status);
    console.log(await res.text());

    const modules = await (await fetch(`${BASE}/api/modules/${courseId}`)).json();
    console.log('modules:', modules);
  } catch (e) { console.error(e); }
})();