import { setStringAsync } from 'expo-clipboard';
import { useRouter } from 'expo-router';
import { Copy, ExternalLink, Globe, Palette } from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { auth } from '../config/firebase';
import { getEffectiveCompanyId } from '../services/auth-service';
import PaidBadge from './PaidBadge';

// "Tu pagina de empleos" en Configuracion: todas las cuentas tienen una pagina
// publica armada con su logo y datos; aca eligen su link (unico, sin repetir).
// Personalizar colores y banner es del plan Gold. Usa landing-page.ts.

const BASE = 'veritlyapp.com/e/';

async function callLanding(action: string, extra: Record<string, any> = {}) {
    const idToken = await auth.currentUser!.getIdToken();
    const companyId = await getEffectiveCompanyId(auth.currentUser!.uid);
    const res = await fetch('/.netlify/functions/landing-page', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, idToken, companyId, ...extra }),
    });
    return { ok: res.ok, status: res.status, data: await res.json().catch(() => ({})) };
}

export default function JobsPageLinkCard() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [hidden, setHidden] = useState(false); // miembros del equipo: solo el dueño edita
    const [gold, setGold] = useState(false);
    const [saved, setSaved] = useState('');
    const [draft, setDraft] = useState('');
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [check, setCheck] = useState<{ available: boolean; reason?: string } | null>(null);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
    const checkTimer = useRef<any>(null);

    useEffect(() => {
        if (!auth.currentUser) return;
        callLanding('get_config')
            .then(({ ok, status, data }) => {
                if (!ok) { if (status === 403) setHidden(true); return; }
                setGold(!!data.allowed);
                const current = data.landingPage?.slug || '';
                setSaved(current);
                setDraft(current || data.suggestions?.[0] || '');
                setSuggestions(data.suggestions || []);
            })
            .catch(() => setHidden(true))
            .finally(() => setLoading(false));
    }, []);

    // Disponibilidad mientras escribe (con una pausa para no consultar en cada tecla)
    const onChange = (text: string) => {
        const clean = text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ñ/g, 'n').replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').slice(0, 30);
        setDraft(clean);
        setMessage(null);
        setCheck(null);
        clearTimeout(checkTimer.current);
        if (clean === saved || clean.length < 3) return;
        checkTimer.current = setTimeout(async () => {
            const { ok, data } = await callLanding('check_slug', { slug: clean });
            if (ok) {
                setCheck({ available: data.available, reason: data.reason });
                if (data.suggestions?.length) setSuggestions(data.suggestions);
            }
        }, 500);
    };

    const save = async () => {
        setSaving(true);
        setMessage(null);
        const { ok, data } = await callLanding('set_slug', { slug: draft });
        if (ok) {
            setSaved(data.slug);
            setCheck(null);
            setMessage({ ok: true, text: saved ? 'Link actualizado. El anterior dejó de funcionar.' : 'Tu página de empleos está lista.' });
        } else {
            setMessage({ ok: false, text: data.error || 'No se pudo guardar el link.' });
        }
        setSaving(false);
    };

    if (loading) return <View style={styles.card}><ActivityIndicator color="#4F46E5" /></View>;
    if (hidden) return null;

    const publicUrl = saved ? `https://www.${BASE}${saved}` : '';
    const reasonText = check && !check.available
        ? check.reason === 'reservado' ? 'Ese nombre está reservado.' : check.reason === 'formato' ? 'Usa 3 a 30 caracteres: minúsculas, números y guiones.' : 'Ese link ya lo usa otra cuenta.'
        : null;
    const canSave = !saving && draft.length >= 3 && draft !== saved && check?.available !== false;

    return (
        <View style={styles.card}>
            <View style={styles.header}>
                <Globe size={20} color="#4F46E5" />
                <Text style={styles.title}>Tu página de empleos</Text>
            </View>
            <Text style={styles.hint}>
                Una página pública con tu logo, tus datos y tus vacantes activas, armada con la información de esta Configuración. Las vacantes confidenciales nunca aparecen.
            </Text>

            {saved ? (
                <View style={styles.linkBox}>
                    <Text style={styles.linkText} numberOfLines={1}>{BASE}{saved}</Text>
                    <TouchableOpacity style={styles.iconBtn} onPress={async () => { await setStringAsync(publicUrl); setMessage({ ok: true, text: 'Link copiado.' }); }}>
                        <Copy size={16} color="#4F46E5" />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.iconBtn} onPress={() => (Platform.OS === 'web' ? window.open(publicUrl, '_blank') : Linking.openURL(publicUrl))}>
                        <ExternalLink size={16} color="#4F46E5" />
                    </TouchableOpacity>
                </View>
            ) : null}

            <Text style={styles.label}>{saved ? 'Cambiar link' : 'Elige tu link'}</Text>
            <View style={[styles.slugRow, reasonText && { borderColor: '#DC2626' }]}>
                <Text style={styles.prefix}>{BASE}</Text>
                <TextInput style={styles.input} value={draft} onChangeText={onChange} autoCapitalize="none" placeholder="tu-empresa" placeholderTextColor="#9CA3AF" maxLength={30} />
                <TouchableOpacity style={[styles.saveBtn, !canSave && { opacity: 0.5 }]} onPress={save} disabled={!canSave}>
                    {saving ? <ActivityIndicator color="white" size="small" /> : <Text style={styles.saveText}>Guardar</Text>}
                </TouchableOpacity>
            </View>
            {reasonText && <Text style={styles.error}>{reasonText}</Text>}
            {check?.available && draft !== saved && <Text style={styles.ok}>Disponible.</Text>}
            {(reasonText || !saved) && suggestions.length > 0 && (
                <View style={styles.suggestions}>
                    <Text style={styles.hintSmall}>Sugerencias:</Text>
                    {suggestions.map((s) => (
                        <TouchableOpacity key={s} style={styles.chip} onPress={() => { setDraft(s); setCheck({ available: true }); setMessage(null); }}>
                            <Text style={styles.chipText}>{s}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            )}
            {message && <Text style={message.ok ? styles.ok : styles.error}>{message.text}</Text>}

            <TouchableOpacity
                style={styles.customizeBtn}
                onPress={() => router.push(gold ? '/empresa/dashboard/landing' : '/empresa/dashboard/pricing')}
            >
                <Palette size={16} color="#4F46E5" />
                <Text style={styles.customizeText}>{gold ? 'Personalizar colores y banner' : 'Personaliza colores, banner e imágenes'}</Text>
                {!gold && <PaidBadge label="Gold" />}
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    card: { backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: '#E5E7EB', padding: 20, marginBottom: 24, gap: 10 },
    header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    title: { fontSize: 17, fontWeight: '800', color: '#111827' },
    hint: { fontSize: 13, color: '#6B7280', lineHeight: 19 },
    hintSmall: { fontSize: 12, color: '#6B7280' },
    linkBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#EEF2FF', borderRadius: 10, padding: 10 },
    linkText: { flex: 1, color: '#3730A3', fontWeight: '700', fontSize: 15 },
    iconBtn: { padding: 6, borderRadius: 8, backgroundColor: '#FFFFFF' },
    label: { fontSize: 12, fontWeight: '600', color: '#6B7280', marginTop: 4 },
    slugRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, backgroundColor: '#F9FAFB', paddingLeft: 12, overflow: 'hidden' },
    prefix: { color: '#6B7280', fontSize: 14 },
    input: { flex: 1, paddingVertical: 12, paddingHorizontal: 2, fontSize: 14, color: '#111827', minWidth: 60 },
    saveBtn: { backgroundColor: '#4F46E5', paddingVertical: 12, paddingHorizontal: 16 },
    saveText: { color: 'white', fontWeight: '700', fontSize: 13 },
    error: { color: '#DC2626', fontSize: 12, fontWeight: '600' },
    ok: { color: '#059669', fontSize: 12, fontWeight: '600' },
    suggestions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
    chip: { borderWidth: 1, borderColor: '#C7D2FE', backgroundColor: '#EEF2FF', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
    chipText: { color: '#4338CA', fontSize: 12, fontWeight: '600' },
    customizeBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB', alignSelf: 'flex-start' },
    customizeText: { color: '#4F46E5', fontWeight: '700', fontSize: 13 },
});
