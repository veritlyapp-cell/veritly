// Escribe dist/version.json con el commit del build. La prueba de humo en
// GitHub Actions (scripts/smoke.mjs) lo usa para saber cuando el deploy ya
// esta publicado. Netlify define COMMIT_REF durante el build.
import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

let commit = process.env.COMMIT_REF || '';
if (!commit) {
    try { commit = execSync('git rev-parse HEAD').toString().trim(); } catch { commit = 'desconocido'; }
}
writeFileSync('dist/version.json', JSON.stringify({ commit, builtAt: new Date().toISOString() }) + '\n');
console.log(`dist/version.json -> ${commit}`);
