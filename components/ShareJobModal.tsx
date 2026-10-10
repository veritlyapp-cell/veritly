import { setStringAsync } from 'expo-clipboard';
import { Copy, Download, Link as LinkIcon, X } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { auth } from '../config/firebase';

// Compartir una vacante: link corto (veritlyapp.com/v/{slug}), opcion de elegir
// uno propio y codigo QR descargable, para piezas graficas donde un link largo
// no cabe o nadie lo va a tipear. Los links anteriores siguen funcionando.

const BASE = 'https://veritlyapp.com/v/';

type Props = {
    visible: boolean;
    onClose: () => void;
    job: { id: string; jobTitle?: string; shortSlug?: string } | null;
    ensureSlug: (job: any) => Promise<string>; // devuelve la URL corta (la crea si no existe)
    onSlugSaved: (jobId: string, slug: string) => void;
};

export default function ShareJobModal({ visible, onClose, job, ensureSlug, onSlugSaved }: Props) {
    const [slug, setSlug] = useState('');
    const [draft, setDraft] = useState('');
    const [qr, setQr] = useState('');
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

    useEffect(() => {
        if (!visible || !job) return;
        setMessage(null);
        setLoading(true);
        ensureSlug(job)
            .then((url) => {
                const s = url.startsWith(BASE) ? url.slice(BASE.length) : '';
                setSlug(s);
                setDraft(s);
            })
            .finally(() => setLoading(false));
    }, [visible, job?.id]);

    const url = slug ? BASE + slug : job ? `https://veritlyapp.com/vacante/${job.id}` : '';
    const displayUrl = url.replace('https://', '');

    useEffect(() => {
        if (!url) return;
        import('qrcode')
            .then((QR) => QR.toDataURL(url, { width: 640, margin: 2, color: { dark: '#111827', light: '#FFFFFF' } }))
            .then(setQr)
            .catch(() => setQr(''));
    }, [url]);

    const copy = async () => {
        await setStringAsync(url);
        setMessage({ ok: true, text: 'Link copiado.' });
    };

    const save = async () => {
        if (!job) return;
        const clean = draft.trim().toLowerCase();
        if (clean === slug) return;
        setSaving(true);
        setMessage(null);
        try {
            const idToken = await auth.currentUser!.getIdToken();
            const res = await fetch('/.netlify/functions/job-slug', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'set_custom', idToken, jobId: job.id, slug: clean }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || 'No se pudo guardar el link');
            setSlug(json.slug);
            onSlugSaved(job.id, json.slug);
            setMessage({ ok: true, text: 'Link guardado. El anterior sigue funcionando.' });
        } catch (e: any) {
            setMessage({ ok: false, text: e.message });
        } finally {
            setSaving(false);
        }
    };

    const downloadQr = () => {
        if (!qr || Platform.OS !== 'web') return;
        const a = document.createElement('a');
        a.href = qr;
        a.download = `qr-${slug || job?.id || 'vacante'}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <View style={styles.backdrop}>
                <View style={styles.card}>
                    <View style={styles.header}>
                        <LinkIcon size={20} color="#4F46E5" />
                        <Text style={styles.title} numberOfLines={1}>Compartir: {job?.jobTitle || 'Vacante'}</Text>
                        <TouchableOpacity onPress={onClose}><X size={22} color="#64748b" /></TouchableOpacity>
                    </View>

                    {loading ? (
                        <ActivityIndicator color="#4F46E5" style={{ marginVertical: 40 }} />
                    ) : (
                        <ScrollView contentContainerStyle={{ gap: 16 }}>
                            <View style={styles.linkBox}>
                                <Text style={styles.linkText} selectable>{displayUrl}</Text>
                                <TouchableOpacity style={styles.copyBtn} onPress={copy}>
                                    <Copy size={14} color="white" />
                                    <Text style={styles.copyText}>Copiar</Text>
                                </TouchableOpacity>
                            </View>

                            <View>
                                <Text style={styles.label}>Elige un link más corto o fácil de recordar</Text>
                                <View style={styles.slugRow}>
                                    <Text style={styles.slugPrefix}>veritlyapp.com/v/</Text>
                                    <TextInput
                                        style={styles.slugInput}
                                        value={draft}
                                        onChangeText={(t) => setDraft(t.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                                        placeholder="ventas-lima"
                                        placeholderTextColor="#9CA3AF"
                                        autoCapitalize="none"
                                        maxLength={30}
                                    />
                                    <TouchableOpacity style={[styles.saveBtn, (saving || draft === slug || draft.length < 3) && { opacity: 0.5 }]} onPress={save} disabled={saving || draft === slug || draft.length < 3}>
                                        {saving ? <ActivityIndicator color="white" size="small" /> : <Text style={styles.saveText}>Guardar</Text>}
                                    </TouchableOpacity>
                                </View>
                                <Text style={styles.hint}>Minúsculas, números y guiones. Los links que ya compartiste siguen funcionando.</Text>
                            </View>

                            {message && <Text style={[styles.message, { color: message.ok ? '#059669' : '#DC2626' }]}>{message.text}</Text>}

                            <View style={styles.qrBox}>
                                {qr ? <Image source={{ uri: qr }} style={styles.qr} /> : <ActivityIndicator color="#4F46E5" />}
                                <View style={{ flex: 1, gap: 8 }}>
                                    <Text style={styles.qrTitle}>Código QR para tu imagen</Text>
                                    <Text style={styles.hint}>Ponlo en tu post o flyer: el candidato lo escanea con la cámara y llega directo a postular, sin tipear el link.</Text>
                                    {Platform.OS === 'web' && (
                                        <TouchableOpacity style={styles.downloadBtn} onPress={downloadQr} disabled={!qr}>
                                            <Download size={14} color="#4F46E5" />
                                            <Text style={styles.downloadText}>Descargar QR (PNG)</Text>
                                        </TouchableOpacity>
                                    )}
                                </View>
                            </View>
                        </ScrollView>
                    )}
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.55)', justifyContent: 'center', alignItems: 'center', padding: 16 },
    card: { width: '100%', maxWidth: 560, maxHeight: '92%', backgroundColor: 'white', borderRadius: 16, padding: 20, gap: 16 },
    header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    title: { flex: 1, fontSize: 17, fontWeight: '700', color: '#0f172a' },
    linkBox: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#EEF2FF', borderRadius: 12, padding: 12 },
    linkText: { flex: 1, fontSize: 16, fontWeight: '700', color: '#3730A3' },
    copyBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#4F46E5', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 },
    copyText: { color: 'white', fontWeight: '700', fontSize: 13 },
    label: { fontSize: 13, fontWeight: '600', color: '#475569', marginBottom: 6 },
    slugRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, backgroundColor: '#F9FAFB', paddingLeft: 12, overflow: 'hidden' },
    slugPrefix: { color: '#64748b', fontSize: 14 },
    slugInput: { flex: 1, paddingVertical: 12, paddingHorizontal: 4, fontSize: 14, color: '#0f172a', minWidth: 60 },
    saveBtn: { backgroundColor: '#4F46E5', paddingVertical: 12, paddingHorizontal: 14 },
    saveText: { color: 'white', fontWeight: '700', fontSize: 13 },
    hint: { fontSize: 12, color: '#64748b', lineHeight: 17, marginTop: 4 },
    message: { fontSize: 13, fontWeight: '600' },
    qrBox: { flexDirection: 'row', alignItems: 'center', gap: 16, borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, padding: 14 },
    qr: { width: 128, height: 128 },
    qrTitle: { fontSize: 14, fontWeight: '700', color: '#0f172a' },
    downloadBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', borderWidth: 1, borderColor: '#C7D2FE', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12 },
    downloadText: { color: '#4F46E5', fontWeight: '700', fontSize: 13 },
});
