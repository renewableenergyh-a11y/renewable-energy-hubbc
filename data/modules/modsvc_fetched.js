export async function getModulesForCourse(courseId) {
  const res = await fetch(`data/modules/${courseId}/index.json`);
  const data = await res.json();
return data;

}

export async function getModuleContent(courseId, file) {
  const res = await fetch(`data/modules/${courseId}/${file}`);
  return res.text();
}
