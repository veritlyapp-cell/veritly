import { Handler } from '@netlify/functions';
import crypto from 'crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from './_firebaseAdmin';
import { verifyIdToken } from './_verifyAuth';
import { getCorsHeaders, checkRateLimit } from './_security';

const INVITE_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 días

type TeamMember = {
    companyId: string;
    role: 'admin' | 'reclutador';
    name: string;
    email: string;
    status: 'active';
    joinedAt: string;
};

async function isCompanyAdmin(uid: string, companyId: string): Promise<boolean> {
    if (uid === companyId) return true; // dueño original de la cuenta
    const snap = await adminDb.collection('team_members').doc(uid).get();
    if (!snap.exists) return false;
    const d = snap.data() as TeamMember;
    return d.companyId === companyId && d.role === 'admin';
}

async function isCompanyMember(uid: string, companyId: string): Promise<boolean> {
    if (uid === companyId) return true;
    const snap = await adminDb.collection('team_members').doc(uid).get();
    if (!snap.exists) return false;
    return (snap.data() as TeamMember).companyId === companyId;
}

async function getSeatLimits(companyId: string): Promise<{ maxAdmins: number; maxRecruiters: number }> {
    try {
        const companySnap = await adminDb.collection('users_empresas').doc(companyId).get();
        const planId = companySnap.exists ? companySnap.data()?.subscription?.planId : null;
        if (planId) {
            const planSnap = await adminDb.collection('config_plans').doc(planId).get();
            if (planSnap.exists) {
                const p = planSnap.data()!;
                return { maxAdmins: p.maxAdmins || 1, maxRecruiters: p.maxRecruiters || 0 };
            }
        }
    } catch { /* usa el fallback de abajo */ }
    return { maxAdmins: 1, maxRecruiters: 0 };
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

        // ── PREVIEW: publico, sin auth (para la pagina de aceptar invitacion) ──
        if (action === 'preview_invite') {
            const { code } = body;
            if (!code) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Falta el código de invitación' }) };

            const inviteSnap = await adminDb.collection('team_invites').doc(code).get();
            if (!inviteSnap.exists) {
                return { statusCode: 404, headers, body: JSON.stringify({ error: 'Invitación no encontrada' }) };
            }
            const invite = inviteSnap.data()!;
            if (invite.used) {
                return { statusCode: 410, headers, body: JSON.stringify({ error: 'Esta invitación ya fue utilizada' }) };
            }
            if (Date.now() > invite.expiresAt) {
                return { statusCode: 410, headers, body: JSON.stringify({ error: 'Esta invitación expiró. Pide una nueva.' }) };
            }

            const companySnap = await adminDb.collection('users_empresas').doc(invite.companyId).get();
            const companyName = companySnap.exists
                ? (companySnap.data()?.company?.name || companySnap.data()?.nombreComercial || 'la empresa')
                : 'la empresa';

            return {
                statusCode: 200, headers,
                body: JSON.stringify({ companyName, role: invite.role, email: invite.email || null })
            };
        }

        // ── ACCEPT: el propio invitado (ya con su cuenta de Firebase Auth creada) ──
        if (action === 'accept_invite') {
            const { code, idToken, name } = body;
            const verified = await verifyIdToken(idToken);
            if (!verified) return { statusCode: 401, headers, body: JSON.stringify({ error: 'Sesión inválida' }) };

            const inviteRef = adminDb.collection('team_invites').doc(code || '');
            const inviteSnap = await inviteRef.get();
            if (!inviteSnap.exists) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Invitación no encontrada' }) };
            const invite = inviteSnap.data()!;
            if (invite.used) return { statusCode: 410, headers, body: JSON.stringify({ error: 'Esta invitación ya fue utilizada' }) };
            if (Date.now() > invite.expiresAt) return { statusCode: 410, headers, body: JSON.stringify({ error: 'Esta invitación expiró' }) };

            const existingMember = await adminDb.collection('team_members').doc(verified.uid).get();
            if (existingMember.exists) {
                return { statusCode: 409, headers, body: JSON.stringify({ error: 'Esta cuenta ya pertenece a un equipo' }) };
            }

            const member: TeamMember = {
                companyId: invite.companyId,
                role: invite.role,
                name: name || verified.email || 'Reclutador',
                email: verified.email || '',
                status: 'active',
                joinedAt: new Date().toISOString()
            };
            await adminDb.collection('team_members').doc(verified.uid).set(member);
            await inviteRef.update({ used: true, usedByUid: verified.uid, usedAt: new Date().toISOString() });

            return { statusCode: 200, headers, body: JSON.stringify({ success: true, companyId: invite.companyId, role: invite.role }) };
        }

        // ── El resto de acciones requieren autenticacion ──
        const { idToken } = body;
        const verified = await verifyIdToken(idToken);
        if (!verified) return { statusCode: 401, headers, body: JSON.stringify({ error: 'Sesión inválida' }) };

        if (action === 'create_invite') {
            const { companyId, role, email } = body;
            if (!companyId || !role) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Faltan datos (companyId, role)' }) };
            if (role !== 'admin' && role !== 'reclutador') return { statusCode: 400, headers, body: JSON.stringify({ error: 'Rol inválido' }) };

            if (!(await isCompanyAdmin(verified.uid, companyId))) {
                return { statusCode: 403, headers, body: JSON.stringify({ error: 'Solo un Admin de la empresa puede invitar' }) };
            }

            const limits = await getSeatLimits(companyId);
            const membersSnap = await adminDb.collection('team_members').where('companyId', '==', companyId).get();
            const currentAdmins = membersSnap.docs.filter(d => d.data().role === 'admin').length + 1; // +1 por el dueño original
            const currentRecruiters = membersSnap.docs.filter(d => d.data().role === 'reclutador').length;

            if (role === 'admin' && currentAdmins >= limits.maxAdmins) {
                return { statusCode: 400, headers, body: JSON.stringify({ error: `Tu plan permite hasta ${limits.maxAdmins} Admin(s). Ya alcanzaste el límite.` }) };
            }
            if (role === 'reclutador' && currentRecruiters >= limits.maxRecruiters) {
                return { statusCode: 400, headers, body: JSON.stringify({ error: `Tu plan permite hasta ${limits.maxRecruiters} reclutador(es). Ya alcanzaste el límite.` }) };
            }

            const code = crypto.randomBytes(16).toString('hex');
            await adminDb.collection('team_invites').doc(code).set({
                companyId, role, email: email || null,
                createdBy: verified.uid,
                createdAt: new Date().toISOString(),
                expiresAt: Date.now() + INVITE_EXPIRY_MS,
                used: false
            });

            return { statusCode: 200, headers, body: JSON.stringify({ code }) };
        }

        if (action === 'list_team') {
            const { companyId } = body;
            if (!companyId) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Falta companyId' }) };
            if (!(await isCompanyMember(verified.uid, companyId))) {
                return { statusCode: 403, headers, body: JSON.stringify({ error: 'No perteneces a esta empresa' }) };
            }

            const companySnap = await adminDb.collection('users_empresas').doc(companyId).get();
            const ownerEmail = companySnap.exists ? companySnap.data()?.email : null;

            const membersSnap = await adminDb.collection('team_members').where('companyId', '==', companyId).get();
            const members = membersSnap.docs.map(d => ({ uid: d.id, ...d.data() }));

            const limits = await getSeatLimits(companyId);

            return {
                statusCode: 200, headers,
                body: JSON.stringify({
                    owner: { uid: companyId, email: ownerEmail, role: 'admin', isOwner: true },
                    members,
                    limits
                })
            };
        }

        if (action === 'remove_member') {
            const { companyId, targetUid } = body;
            if (!companyId || !targetUid) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Faltan datos' }) };
            if (!(await isCompanyAdmin(verified.uid, companyId))) {
                return { statusCode: 403, headers, body: JSON.stringify({ error: 'Solo un Admin puede quitar miembros' }) };
            }
            if (targetUid === companyId) {
                return { statusCode: 400, headers, body: JSON.stringify({ error: 'No se puede quitar al Administrador Principal (dueño de la cuenta)' }) };
            }
            await adminDb.collection('team_members').doc(targetUid).delete();
            return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
        }

        if (action === 'promote_member') {
            const { companyId, targetUid } = body;
            if (!companyId || !targetUid) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Faltan datos' }) };
            if (!(await isCompanyAdmin(verified.uid, companyId))) {
                return { statusCode: 403, headers, body: JSON.stringify({ error: 'Solo un Admin puede ascender a otro miembro' }) };
            }

            const limits = await getSeatLimits(companyId);
            const membersSnap = await adminDb.collection('team_members').where('companyId', '==', companyId).get();
            const currentAdmins = membersSnap.docs.filter(d => d.data().role === 'admin').length + 1;
            if (currentAdmins >= limits.maxAdmins) {
                return { statusCode: 400, headers, body: JSON.stringify({ error: `Tu plan permite hasta ${limits.maxAdmins} Admin(s). Ya alcanzaste el límite.` }) };
            }

            await adminDb.collection('team_members').doc(targetUid).update({ role: 'admin' });
            return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
        }

        return { statusCode: 400, headers, body: JSON.stringify({ error: `Acción no reconocida: ${action}` }) };

    } catch (error: any) {
        console.error("❌ Error en team.ts:", error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message || 'Internal Server Error' }) };
    }
};
