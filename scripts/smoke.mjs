#!/usr/bin/env node
// Prueba de humo del sitio publicado: revisa en pocos minutos que lo critico
// funcione despues de cada deploy. Sin dependencias (Node 22+ y Chrome/Edge).
//
//   npm run smoke                              -> contra https://www.veritlyapp.com
//   npm run smoke -- https://<deploy>--veritly.netlify.app
//
// Variables opcionales:
//   SMOKE_JOB_ID        vacante a abrir (por defecto una real publicada)
//   SMOKE_CV_URL        URL de un CV de prueba en Storage: prueba la descarga completa
//   SMOKE_EXPECT_COMMIT espera a que /version.json tenga este commit antes de probar
//   CHROME_PATH         ruta del navegador si no se encuentra solo
//   SMOKE_SKIP_BROWSER=1 / SMOKE_SKIP_GEMINI=1
//
// Que revisa (cada punto nacio de un error real):
//   1. Cada ruta sirve su propia pagina (no la landing) y con titulo "Veritly".
//   2. Todos los JS que pide la app existen y son JS (no el index.html de
//      respaldo), incluidos los chunks que se cargan al navegar, y el bundle no
//      tiene cache "immutable" (ver netlify.toml).
//   3. cv-file descarga desde Storage en el servidor (la lectura del CV).
//   4. gemini-proxy tiene la key y cada modelo que usa el codigo sigue vivo.
//   5. En un Chrome real: la pagina carga sin errores de consola, Sentry inicia,
//      la vacante muestra su contenido y no queda oculta por el hydration gate.

import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = (process.argv[2] || process.env.SMOKE_BASE_URL || 'https://www.veritlyapp.com').replace(/\/$/, '');
const JOB_ID = process.env.SMOKE_JOB_ID || 'SR801jiPHnuefS9aEHjr';
const BUCKET = 'vinku-3a3af.firebasestorage.app';

const failures = [];
const warnings = [];
const ok = (msg) => console.log(`  ✓ ${msg}`);
const fail = (msg) => { failures.push(msg); console.log(`  ✗ ${msg}`); };
const warn = (msg) => { warnings.push(msg); console.log(`  ! ${msg}`); };
const section = (t) => console.log(`\n${t}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(path, init) {
    const res = await fetch(path.startsWith('http') ? path : BASE + path, { redirect: 'follow', ...init });
    return { res, text: await res.text() };
}

// ─── 0. Esperar el deploy (solo en CI) ───────────────────────────────────────
async function waitForCommit(sha) {
    section(`Esperando que ${BASE} publique el commit ${sha.slice(0, 7)}...`);
    const deadline = Date.now() + 15 * 60_000;
    let last = '';
    while (Date.now() < deadline) {
        try {
            const { res, text } = await get(`/version.json?t=${Date.now()}`);
            if (res.ok) {
                last = JSON.parse(text).commit || '';
                if (last === sha) return ok(`deploy publicado (${sha.slice(0, 7)})`);
            }
        } catch { /* sigue esperando */ }
        await sleep(20_000);
    }
    fail(`a los 15 min el sitio sigue en ${last ? last.slice(0, 7) : '?'}: el build de Netlify fallo o no se publico`);
}

// ─── 1 y 2. Paginas y chunks JS ──────────────────────────────────────────────
const PAGES = [
    // [ruta, chunk de la ruta que debe traer su HTML (null = no se revisa), texto esperado]
    ['/', null, null],
    ['/signin', null, null],
    ['/empresa/signin', null, null],
    [`/vacante/${JOB_ID}`, '[id]-', 'Cargando oferta'],
    ['/e/smoke-test', '[slug]-', null],
    ['/v/smoke-test', '[slug]-', null],
    ['/empresa/job/smoke-test', '[id]-', null],
    ['/empresa/invite/smoke-test', '[code]-', null],
    ['/encuesta/b2b', '[tipo]-', null],
];

const scriptSrcs = (html) => [...html.matchAll(/<script[^>]+src="([^"]+\.js)"/g)].map((m) => m[1]);

async function checkPages() {
    section('1. Paginas');
    const allScripts = new Set();
    for (const [path, routeChunk, expected] of PAGES) {
        let r;
        try { r = await get(path); } catch (e) { fail(`${path}: ${e.message}`); continue; }
        const problems = [];
        if (r.res.status !== 200) problems.push(`HTTP ${r.res.status}`);
        if (!r.text.includes('<title data-rh="true">Veritly</title>')) problems.push('sin titulo "Veritly"');
        const srcs = scriptSrcs(r.text);
        srcs.forEach((s) => allScripts.add(s));
        if (srcs.length === 0) problems.push('no carga ningun JS');
        if (routeChunk && !srcs.some((s) => s.split('/').pop().startsWith(routeChunk))) {
            problems.push(`no es su pagina (falta el chunk ${routeChunk}*.js: probablemente sirve la landing)`);
        }
        if (expected && !r.text.includes(expected)) problems.push(`no contiene "${expected}"`);
        problems.length ? fail(`${path}: ${problems.join(', ')}`) : ok(path);
    }
    return allScripts;
}

async function checkChunks(initialScripts) {
    section('2. Archivos JS');
    // Los chunks que se cargan al navegar aparecen como rutas dentro de otros JS
    // (el mapa de rutas del entry). Se siguen hasta no encontrar nuevos.
    const pending = [...initialScripts];
    const seen = new Set();
    const bad = [];
    let immutable = null;
    while (pending.length) {
        const src = pending.shift();
        if (seen.has(src)) continue;
        seen.add(src);
        let r;
        try { r = await get(src); } catch (e) { bad.push(`${src} (${e.message})`); continue; }
        const type = r.res.headers.get('content-type') || '';
        if (r.res.status !== 200 || !type.includes('javascript') || r.text.trimStart().startsWith('<')) {
            bad.push(`${src} (HTTP ${r.res.status}, ${type || 'sin tipo'})`);
            continue;
        }
        if (!immutable && /immutable/.test(r.res.headers.get('cache-control') || '')) immutable = src;
        for (const m of r.text.matchAll(/["'](\/_expo\/static\/js\/web\/[^"']+\.js)["']/g)) {
            if (!seen.has(m[1])) pending.push(m[1]);
        }
    }
    bad.length ? bad.forEach((b) => fail(`chunk roto: ${b}`)) : ok(`${seen.size} archivos JS existen y son JS`);
    immutable
        ? fail(`${immutable} tiene cache "immutable": Expo reutiliza nombres entre deploys (ver netlify.toml)`)
        : ok('el bundle no usa cache "immutable"');
}

// ─── 3. Lectura de CV ────────────────────────────────────────────────────────
async function checkCvFile() {
    section('3. Descarga de CV (cv-file)');
    const call = (url) => get('/.netlify/functions/cv-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
    });
    try {
        const foreign = await call('https://example.com/cvs/x.pdf');
        foreign.res.status === 400 ? ok('rechaza URLs ajenas') : fail(`URL ajena devolvio HTTP ${foreign.res.status} (esperado 400)`);

        // Un objeto inexistente: si responde 502 es porque el servidor si llego a Storage.
        const missing = await call(`https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/cvs%2Fsmoke-test%2Fno-existe.pdf?alt=media`);
        missing.res.status === 502 ? ok('llega a Firebase Storage desde el servidor') : fail(`CV inexistente devolvio HTTP ${missing.res.status} (esperado 502): ${missing.text.slice(0, 120)}`);

        if (process.env.SMOKE_CV_URL) {
            const real = await call(process.env.SMOKE_CV_URL);
            const body = real.res.ok ? JSON.parse(real.text) : {};
            real.res.ok && body.base64?.length > 1000
                ? ok(`descarga el CV de prueba (${body.contentType}, ${Math.round(body.base64.length * 0.75 / 1024)} KB)`)
                : fail(`CV de prueba: HTTP ${real.res.status} ${real.text.slice(0, 120)}`);
        }
    } catch (e) {
        fail(`cv-file: ${e.message}`);
    }
}

// ─── 4. Gemini ───────────────────────────────────────────────────────────────
function modelsInCode() {
    const files = [
        join(ROOT, 'utils/gemini.ts'),
        join(ROOT, 'utils/gemini-company.ts'),
        ...readdirSync(join(ROOT, 'netlify/functions')).filter((f) => f.endsWith('.ts')).map((f) => join(ROOT, 'netlify/functions', f)),
    ].filter(existsSync);
    const models = new Set();
    for (const f of files) {
        for (const m of readFileSync(f, 'utf8').matchAll(/["'`/](gemini-\d[\w.-]*?)(?=["'`:])/g)) models.add(m[1]);
    }
    return [...models];
}

async function checkGemini() {
    section('4. Gemini (gemini-proxy)');
    const call = (body) => get('/.netlify/functions/gemini-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    try {
        const empty = await call({});
        if (empty.res.status === 500) return fail('gemini-proxy: falta GEMINI_API_KEY en Netlify');
        empty.res.status === 400 ? ok('gemini-proxy responde y tiene la key') : fail(`gemini-proxy devolvio HTTP ${empty.res.status}`);

        // Una llamada minima por modelo (fracciones de centavo): detecta modelos dados de baja.
        for (const model of modelsInCode()) {
            let r;
            for (let attempt = 0; attempt < 2; attempt++) {
                r = await call({ model, contents: [{ role: 'user', parts: [{ text: 'Responde solo: OK' }] }] });
                if (r.res.status !== 503 && r.res.status !== 429) break;
                await sleep(5000);
            }
            const s = r.res.status;
            if (s === 200) ok(`modelo ${model}`);
            else if (s === 503 || s === 429) warn(`modelo ${model}: saturado (HTTP ${s}), no se pudo confirmar`);
            else fail(`modelo ${model}: HTTP ${s} ${r.text.slice(0, 150)}`);
        }
    } catch (e) {
        fail(`gemini-proxy: ${e.message}`);
    }
}

// ─── 5. Navegador real (Chrome DevTools Protocol) ────────────────────────────
function findChrome() {
    const candidates = [
        process.env.CHROME_PATH,
        'C:/Program Files/Google/Chrome/Application/chrome.exe',
        'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
        process.env.LOCALAPPDATA && join(process.env.LOCALAPPDATA, 'Google/Chrome/Application/chrome.exe'),
        'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        '/usr/bin/google-chrome',
        '/usr/bin/google-chrome-stable',
        '/usr/bin/chromium',
        '/usr/bin/chromium-browser',
    ].filter(Boolean);
    return candidates.find((p) => existsSync(p));
}

async function openBrowser(chromePath) {
    const profile = mkdtempSync(join(tmpdir(), 'veritly-smoke-'));
    const proc = spawn(chromePath, [
        '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
        '--no-sandbox', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank',
    ], { stdio: 'ignore' });

    const portFile = join(profile, 'DevToolsActivePort');
    for (let i = 0; i < 100 && !existsSync(portFile); i++) await sleep(100);
    if (!existsSync(portFile)) throw new Error('Chrome no abrio el puerto de depuracion');
    await sleep(200);
    const port = readFileSync(portFile, 'utf8').split('\n')[0].trim();
    const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    const page = targets.find((t) => t.type === 'page');

    const ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
    let nextId = 1;
    const waiting = new Map();
    const listeners = [];
    ws.onmessage = (ev) => {
        const msg = JSON.parse(ev.data);
        if (msg.id && waiting.has(msg.id)) {
            const { resolve, reject } = waiting.get(msg.id);
            waiting.delete(msg.id);
            msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
        } else if (msg.method) {
            listeners.forEach((l) => l(msg));
        }
    };
    const send = (method, params = {}) => new Promise((resolve, reject) => {
        const id = nextId++;
        waiting.set(id, { resolve, reject });
        ws.send(JSON.stringify({ id, method, params }));
    });
    const close = () => {
        try { ws.close(); } catch { /* ya cerrado */ }
        proc.kill();
        setTimeout(() => { try { rmSync(profile, { recursive: true, force: true }); } catch { /* en uso */ } }, 1000);
    };
    return { send, onEvent: (l) => listeners.push(l), close };
}

const BROWSER_CHECKS = [
    { path: '/', width: 1280, label: 'landing (computadora)' },
    { path: '/', width: 390, label: 'landing (celular)' },
    { path: '/signin', width: 1280, label: 'login candidato' },
    { path: '/empresa/signin', width: 1280, label: 'login empresa' },
    { path: `/vacante/${JOB_ID}`, width: 1280, label: 'vacante', vacancy: true },
];

async function checkBrowser() {
    section('5. Navegador real');
    const chromePath = findChrome();
    if (!chromePath) return warn('no se encontro Chrome/Edge (usa CHROME_PATH): se omite');

    let browser;
    try {
        browser = await openBrowser(chromePath);
        const { send, onEvent } = browser;
        let errors = [];
        let sentryOk = false;
        onEvent(({ method, params }) => {
            if (method === 'Runtime.exceptionThrown') {
                const d = params.exceptionDetails;
                errors.push(d.exception?.description?.split('\n')[0] || d.text);
            } else if (method === 'Runtime.consoleAPICalled') {
                const text = params.args.map((a) => a.value ?? a.description ?? '').join(' ');
                if (text.includes('Sentry inicializado')) sentryOk = true;
                if (params.type === 'error' || (params.type === 'warning' && /No se pudo cargar/.test(text))) {
                    errors.push(text.split('\n')[0].slice(0, 200));
                }
            } else if (method === 'Log.entryAdded' && params.entry.level === 'error') {
                errors.push(`${params.entry.text} ${params.entry.url || ''}`.trim().slice(0, 200));
            }
        });
        await send('Runtime.enable');
        await send('Log.enable');
        await send('Page.enable');

        const evaluate = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true })).result.value;

        for (const c of BROWSER_CHECKS) {
            errors = [];
            sentryOk = false;
            await send('Emulation.setDeviceMetricsOverride', { width: c.width, height: 900, deviceScaleFactor: 1, mobile: c.width < 768 });
            await send('Page.navigate', { url: BASE + c.path });

            // Espera a que la app termine de cargar (Sentry inicia al montar el layout).
            let state = {};
            for (let i = 0; i < 40; i++) {
                await sleep(500);
                state = await evaluate(`({
                    ready: document.readyState,
                    gated: document.documentElement.classList.contains('pre-hydration-desktop'),
                    title: document.title,
                    text: document.body ? document.body.innerText.slice(0, 2000) : ''
                })`).catch(() => ({}));
                const vacancyDone = !c.vacancy || (state.text && !state.text.includes('Cargando oferta'));
                if (state.ready === 'complete' && sentryOk && !state.gated && vacancyDone) break;
            }
            await sleep(1000); // errores que llegan justo despues de montar

            const problems = [...new Set(errors)];
            if (!sentryOk) problems.push('Sentry no inicio (la app no termino de cargar)');
            if (state.gated) problems.push('la pagina sigue oculta por el hydration gate');
            if (state.title !== 'Veritly') problems.push(`titulo "${state.title}"`);
            if (c.vacancy && (!state.text || state.text.includes('Cargando oferta'))) problems.push('la vacante no termino de cargar');
            if (c.vacancy && /no encontrada|no existe/i.test(state.text || '')) warn(`la vacante ${JOB_ID} ya no existe: usa SMOKE_JOB_ID con una vigente`);
            problems.length ? fail(`${c.label}: ${problems.join(' | ')}`) : ok(c.label);
        }
    } catch (e) {
        fail(`navegador: ${e.message}`);
    } finally {
        browser?.close();
    }
}

// ─── Main ────────────────────────────────────────────────────────────────────
console.log(`Prueba de humo de ${BASE}`);
if (process.env.SMOKE_EXPECT_COMMIT) await waitForCommit(process.env.SMOKE_EXPECT_COMMIT);
if (failures.length === 0) {
    const scripts = await checkPages();
    await checkChunks(scripts);
    await checkCvFile();
    if (process.env.SMOKE_SKIP_GEMINI !== '1') await checkGemini();
    if (process.env.SMOKE_SKIP_BROWSER !== '1') await checkBrowser();
}

console.log('');
if (failures.length) {
    console.log(`✗ ${failures.length} problema(s):`);
    failures.forEach((f) => console.log(`  - ${f}`));
    process.exit(1);
}
console.log(`✓ Todo OK${warnings.length ? ` (${warnings.length} aviso(s))` : ''}`);
process.exit(0);
