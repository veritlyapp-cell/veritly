import { Handler } from '@netlify/functions';
import { adminDb } from './_firebaseAdmin';
import { verifyIdToken } from './_verifyAuth';
import { getCorsHeaders, checkRateLimit } from './_security';
import { formatJobLocation } from '../../utils/jobLocation';

// Pagina de empleos publica: TODAS las cuentas tienen una (veritlyapp.com/e/{slug},
// luego vjobs.app/{slug}) armada con su logo y datos de Configuracion. Los
// colores y el banner son del plan Gold (planAllowsLandingPage).

// 3-30 caracteres: minusculas, numeros y guiones (sin tildes, ñ ni espacios)
const SLUG_REGEX = /^[a-z0-9](?:[a-z0-9-]{1,28})[a-z0-9]$/;

// No se pueden usar como link de empresa (rutas o palabras del producto)
const RESERVED_SLUGS = new Set([
    'admin', 'administrador', 'login', 'signin', 'signup', 'registro', 'registrarse', 'ingresar', 'salir',
    'precios', 'planes', 'pricing', 'empleos', 'empleo', 'trabajos', 'jobs', 'vacantes', 'vacante', 'postular',
    'api', 'app', 'apps', 'soporte', 'ayuda', 'help', 'contacto', 'privacidad', 'privacy', 'terminos', 'terms',
    'empresa', 'empresas', 'candidato', 'candidatos', 'dashboard', 'panel', 'perfil', 'profile', 'config',
    'configuracion', 'veritly', 'vjobs', 'racso', 'blog', 'www', 'mail', 'static', 'assets', 'encuesta', 'e', 'v', 'c',
    // Rutas en la raiz de la app (tienen prioridad sobre vjobs.app/{slug})
    'explore', 'analytics', 'landing', 'modal', 'index', 'not-found',
]);

// Los nombres de la marca solo los puede usar la cuenta de Veritly (mismo
// correo que isAdmin() en firestore.rules)
const BRAND_SLUGS = new Set(['veritly', 'vjobs']);
const VERITLY_ADMIN_EMAIL = 'oscar@veritlyapp.com';

const isValidSlug = (slug: string, isVeritly = false) =>
    SLUG_REGEX.test(slug) && !slug.includes('--') && (!RESERVED_SLUGS.has(slug) || (isVeritly && BRAND_SLUGS.has(slug)));

function slugifyName(text: string): string {
    return text
        .toLowerCase()
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/ñ/g, 'n')
        .replace(/\b(s\.?a\.?c?|s\.?r\.?l|e\.?i\.?r\.?l|inc|ltda|sas)\.?\b/g, '') // sufijos societarios
        .replace(/[^a-z0-9\s-]/g, ' ')
        .trim()
        .split(/[\s-]+/)
        .filter(Boolean)
        .join('-')
        .slice(0, 30)
        .replace(/-+$/, '');
}

async function isSlugAvailable(slug: string, companyId: string, isVeritly = false): Promise<boolean> {
    if (!isValidSlug(slug, isVeritly)) return false;
    const snap = await adminDb.collection('company_slugs').doc(slug).get();
    return !snap.exists || snap.data()?.companyId === companyId;
}

// Sugerencia legible a partir del nombre ("Brenda Soto" -> brenda-soto) y,
// si esta tomada, variantes con sentido (brenda-soto-rrhh, -empleos, -pe...),
// nunca numeros al azar.
async function suggestSlugs(name: string, companyId: string, country?: string): Promise<string[]> {
    const base = slugifyName(name) || 'empresa';
    const suffixes = ['', 'rrhh', 'empleos', 'talento', 'careers', country ? slugifyName(country).slice(0, 3) : 'latam', 'trabaja'];
    const options: string[] = [];
    for (const s of suffixes) {
        const candidate = s ? `${base.slice(0, 29 - s.length)}-${s}`.replace(/-+/g, '-') : base;
        if (!options.includes(candidate) && (await isSlugAvailable(candidate, companyId))) options.push(candidate);
        if (options.length >= 3) break;
    }
    return options;
}

async function planAllowsLandingPage(companyId: string): Promise<boolean> {
    try {
        const companySnap = await adminDb.collection('users_empresas').doc(companyId).get();
        const planId = companySnap.exists ? companySnap.data()?.subscription?.planId : null;
        if (!planId) return false;
        const planSnap = await adminDb.collection('config_plans').doc(planId).get();
        if (!planSnap.exists) return false;
        const features: string[] = planSnap.data()?.features || [];
        return features.includes('Landing Page') || features.includes('Landing Page Personalizada');
    } catch {
        return false;
    }
}

export const handler: Handler = async (event) => {
    const origin = event.headers.origin || event.headers.Origin || '';
    const headers = getCorsHeaders(origin);

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, headers, body: 'Method Not Allowed' };
    }

    const clientIp = event.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown';
    if (!checkRateLimit(clientIp)) {
        return { statusCode: 429, headers, body: JSON.stringify({ error: 'Demasiadas solicitudes. Intenta en 1 minuto.' }) };
    }

    try {
        const body = JSON.parse(event.body || '{}');
        const { action } = body;

        // ── Publico: resolver un slug a los datos de la empresa + sus vacantes ──
        if (action === 'get_by_slug') {
            const { slug } = body;
            if (!slug) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Falta el slug' }) };

            const slugSnap = await adminDb.collection('company_slugs').doc(slug).get();
            if (!slugSnap.exists) {
                return { statusCode: 404, headers, body: JSON.stringify({ error: 'Página no encontrada' }) };
            }
            const { companyId } = slugSnap.data()!;

            const companySnap = await adminDb.collection('users_empresas').doc(companyId).get();
            if (!companySnap.exists) {
                return { statusCode: 404, headers, body: JSON.stringify({ error: 'Empresa no encontrada' }) };
            }
            const companyData = companySnap.data()!;
            // Activa por defecto; solo una cuenta Gold puede apagarla
            if (companyData.landingPage?.enabled === false) {
                return { statusCode: 404, headers, body: JSON.stringify({ error: 'Esta página no está activa' }) };
            }

            const customizable = await planAllowsLandingPage(companyId);

            // Todas las vacantes publicas activas de la empresa (nunca las
            // confidenciales). Solo Gold puede esconder alguna (hideOnJobsPage).
            const jobsSnap = await adminDb.collection('jobs').where('companyId', '==', companyId).get();
            // Solo datos publicos: antes devolvia el documento completo de cada
            // vacante (respuestas de preguntas filtro, presupuesto, etc.)
            const jobs = jobsSnap.docs
                .map(d => ({ id: d.id, ...d.data() }) as any)
                .filter((j: any) => j.isExternal && j.isActive !== false && j.status !== 'Closed' && !j.isConfidential && !(customizable && j.hideOnJobsPage))
                .sort((a: any, b: any) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
                .map((j: any) => ({
                    id: j.id,
                    jobTitle: j.jobTitle,
                    // "Presencial · Trujillo, Perú" (o el texto de vacantes anteriores)
                    location: formatJobLocation(j) || null,
                    employmentType: j.employmentType || null,
                    createdAt: typeof j.createdAt === 'string' ? j.createdAt : j.createdAt?.toDate?.().toISOString?.() || null,
                }));

            // Que se muestra de Veritly en la pagina: Freemium = firma + "unete a
            // Veritly" + banner de Racso; planes de pago = solo la firma; Gold = nada
            const planId = companyData.subscription?.planId || '';
            const tier = customizable ? 'gold' : (planId && planId !== 'beta_free' ? 'paid' : 'free');
            return {
                statusCode: 200, headers,
                body: JSON.stringify({
                    companyName: companyData.company?.name || companyData.nombreComercial || 'Empresa',
                    companyType: companyData.company?.type || 'empresa',
                    logoUrl: companyData.company?.logoUrl || companyData.logoUrl || null,
                    rubro: companyData.aiContext?.rubro || null,
                    // Personalizacion solo con plan Gold
                    bannerUrl: customizable ? companyData.landingPage?.bannerUrl || null : null,
                    brandColor: customizable ? companyData.landingPage?.brandColor || '#4F46E5' : '#4F46E5',
                    tier,
                    jobs
                })
            };
        }

        // ── El resto requiere autenticacion (dueño de la cuenta) ──
        const { idToken, companyId } = body;
        const verified = await verifyIdToken(idToken);
        if (!verified) return { statusCode: 401, headers, body: JSON.stringify({ error: 'Sesión inválida' }) };
        if (!companyId || verified.uid !== companyId) {
            return { statusCode: 403, headers, body: JSON.stringify({ error: 'No autorizado' }) };
        }
        const isVeritly = verified.email?.toLowerCase() === VERITLY_ADMIN_EMAIL;

        if (action === 'get_config') {
            const companySnap = await adminDb.collection('users_empresas').doc(companyId).get();
            const data = companySnap.exists ? companySnap.data()! : {};
            const allowed = await planAllowsLandingPage(companyId);
            const landingPage = data.landingPage || null;
            // Sin link todavia: sugerencias a partir del nombre de la empresa
            const suggestions = landingPage?.slug ? [] : await suggestSlugs(data.company?.name || data.nombreComercial || '', companyId, data.company?.country);
            return {
                statusCode: 200, headers,
                body: JSON.stringify({ allowed, landingPage, suggestions })
            };
        }

        if (action === 'check_slug') {
            const slug = String(body.slug || '').trim().toLowerCase();
            if (!isValidSlug(slug, isVeritly)) {
                return { statusCode: 200, headers, body: JSON.stringify({ available: false, reason: RESERVED_SLUGS.has(slug) ? 'reservado' : 'formato' }) };
            }
            const available = await isSlugAvailable(slug, companyId, isVeritly);
            const companySnap = await adminDb.collection('users_empresas').doc(companyId).get();
            const name = companySnap.data()?.company?.name || slug;
            return { statusCode: 200, headers, body: JSON.stringify({ available, reason: available ? null : 'tomado', suggestions: available ? [] : await suggestSlugs(name, companyId) }) };
        }

        if (action === 'set_slug') {
            const slug = String(body.slug || '').trim().toLowerCase();
            if (!isValidSlug(slug, isVeritly)) {
                return { statusCode: 400, headers, body: JSON.stringify({ error: RESERVED_SLUGS.has(slug) ? 'Ese nombre está reservado. Elige otro.' : 'Usa entre 3 y 30 caracteres: minúsculas, números y guiones (sin tildes, ñ ni espacios).' }) };
            }

            const companyRef = adminDb.collection('users_empresas').doc(companyId);
            const slugRef = adminDb.collection('company_slugs').doc(slug);
            const taken = await adminDb.runTransaction(async (tx) => {
                const [companySnap, slugSnap] = await Promise.all([tx.get(companyRef), tx.get(slugRef)]);
                if (slugSnap.exists && slugSnap.data()?.companyId !== companyId) return true;
                const previousSlug = companySnap.data()?.landingPage?.slug;
                if (previousSlug && previousSlug !== slug) tx.delete(adminDb.collection('company_slugs').doc(previousSlug));
                tx.set(slugRef, { companyId });
                tx.set(companyRef, { landingPage: { slug } }, { merge: true });
                return false;
            });
            if (taken) return { statusCode: 409, headers, body: JSON.stringify({ error: 'Ese link ya lo usa otra cuenta. Prueba otro.' }) };

            return { statusCode: 200, headers, body: JSON.stringify({ success: true, slug }) };
        }

        if (action === 'update_branding') {
            const { bannerUrl, brandColor, enabled } = body;
            if (!(await planAllowsLandingPage(companyId))) {
                return { statusCode: 403, headers, body: JSON.stringify({ error: 'Tu plan no incluye Landing Page.' }) };
            }
            const update: any = {};
            if (bannerUrl !== undefined) update.bannerUrl = bannerUrl;
            if (brandColor !== undefined) update.brandColor = brandColor;
            if (enabled !== undefined) update.enabled = enabled;

            await adminDb.collection('users_empresas').doc(companyId).set({
                landingPage: update
            }, { merge: true });

            return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
        }

        return { statusCode: 400, headers, body: JSON.stringify({ error: `Acción no reconocida: ${action}` }) };

    } catch (error: any) {
        console.error("❌ Error en landing-page.ts:", error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message || 'Internal Server Error' }) };
    }
};
