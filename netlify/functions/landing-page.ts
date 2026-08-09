import { Handler } from '@netlify/functions';
import { adminDb } from './_firebaseAdmin';
import { verifyIdToken } from './_verifyAuth';
import { getCorsHeaders, checkRateLimit } from './_security';

const SLUG_REGEX = /^[a-z0-9](?:[a-z0-9-]{1,48}[a-z0-9])?$/;

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
            if (!companyData.landingPage?.enabled) {
                return { statusCode: 404, headers, body: JSON.stringify({ error: 'Esta página no está activa' }) };
            }

            const jobsSnap = await adminDb.collection('jobs')
                .where('companyId', '==', companyId)
                .where('showOnLandingPage', '==', true)
                .get();
            const jobs = jobsSnap.docs
                .map(d => ({ id: d.id, ...d.data() }))
                .filter((j: any) => j.isActive !== false && j.status !== 'Closed');

            return {
                statusCode: 200, headers,
                body: JSON.stringify({
                    companyName: companyData.company?.name || companyData.nombreComercial || 'Empresa',
                    logoUrl: companyData.company?.logoUrl || companyData.logoUrl || null,
                    bannerUrl: companyData.landingPage?.bannerUrl || null,
                    brandColor: companyData.landingPage?.brandColor || '#4F46E5',
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

        if (action === 'get_config') {
            const companySnap = await adminDb.collection('users_empresas').doc(companyId).get();
            const allowed = await planAllowsLandingPage(companyId);
            return {
                statusCode: 200, headers,
                body: JSON.stringify({ allowed, landingPage: companySnap.exists ? (companySnap.data()?.landingPage || null) : null })
            };
        }

        if (action === 'set_slug') {
            const { slug } = body;
            if (!slug || !SLUG_REGEX.test(slug)) {
                return { statusCode: 400, headers, body: JSON.stringify({ error: 'Slug inválido. Usa solo minúsculas, números y guiones (3-50 caracteres).' }) };
            }
            if (!(await planAllowsLandingPage(companyId))) {
                return { statusCode: 403, headers, body: JSON.stringify({ error: 'Tu plan no incluye Landing Page.' }) };
            }

            const companySnap = await adminDb.collection('users_empresas').doc(companyId).get();
            const previousSlug = companySnap.exists ? companySnap.data()?.landingPage?.slug : null;

            if (previousSlug !== slug) {
                const slugSnap = await adminDb.collection('company_slugs').doc(slug).get();
                if (slugSnap.exists && slugSnap.data()?.companyId !== companyId) {
                    return { statusCode: 409, headers, body: JSON.stringify({ error: 'Ese slug ya está en uso. Elige otro.' }) };
                }
                await adminDb.collection('company_slugs').doc(slug).set({ companyId });
                if (previousSlug) {
                    await adminDb.collection('company_slugs').doc(previousSlug).delete().catch(() => {});
                }
            }

            await adminDb.collection('users_empresas').doc(companyId).set({
                landingPage: { slug, enabled: true }
            }, { merge: true });

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
