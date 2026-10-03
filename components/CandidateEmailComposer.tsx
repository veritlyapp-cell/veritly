import { Mail, X } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { auth } from '../config/firebase';
import { showAlert } from '../utils/ui';

// Editor para enviar un correo a uno o varios candidatos de una vacante, con
// plantillas y variables {nombre} {puesto} {empresa}. El envio y el reemplazo
// de variables los hace netlify/functions/candidate-email.ts, que tambien
// verifica que la vacante sea de la empresa del reclutador.

type Recipient = { id: string; name: string; email?: string | null };

type Props = {
    visible: boolean;
    onClose: () => void;
    jobId: string;
    jobTitle: string;
    companyLabel?: string; // para la vista previa; el servidor usa el nombre real (o el alias si es confidencial)
    recipients: Recipient[];
    onSent: (sentIds: string[]) => void;
};

const TEMPLATES = [
    {
        key: 'gracias',
        label: 'Agradecimiento',
        subject: 'Gracias por postular a {puesto}',
        body: 'Hola {nombre}:\n\nGracias por tu interés en el puesto de {puesto} y por el tiempo que dedicaste a postular.\n\nDespués de revisar los perfiles, decidimos avanzar con otros candidatos cuya experiencia se ajusta más a lo que buscamos en esta oportunidad. Guardaremos tu perfil para futuras vacantes.\n\nTe deseamos mucho éxito.\n\nSaludos,\n{empresa}',
    },
    {
        key: 'entrevista',
        label: 'Invitar a entrevista',
        subject: 'Siguiente paso: entrevista para {puesto}',
        body: 'Hola {nombre}:\n\nGracias por postular al puesto de {puesto}. Nos gustó tu perfil y queremos conocerte en una entrevista.\n\nResponde a este correo con tu disponibilidad para los próximos días y coordinamos.\n\nSaludos,\n{empresa}',
    },
    {
        key: 'recibido',
        label: 'Postulación recibida',
        subject: 'Recibimos tu postulación a {puesto}',
        body: 'Hola {nombre}:\n\nGracias por postular al puesto de {puesto}. Recibimos tu postulación y la estamos revisando. Te escribiremos si tu perfil avanza a la siguiente etapa.\n\nSaludos,\n{empresa}',
    },
    {
        key: 'libre',
        label: 'Mensaje libre',
        subject: '',
        body: 'Hola {nombre}:\n\n\n\nSaludos,\n{empresa}',
    },
];

const BATCH = 25; // maximo por llamada en candidate-email.ts

const fill = (text: string, vars: Record<string, string>) =>
    text.replace(/\{(nombre|puesto|empresa)\}/gi, (_, k) => vars[k.toLowerCase()] ?? '');

export default function CandidateEmailComposer({ visible, onClose, jobId, jobTitle, companyLabel, recipients, onSent }: Props) {
    const [templateKey, setTemplateKey] = useState('gracias');
    const [subject, setSubject] = useState(TEMPLATES[0].subject);
    const [body, setBody] = useState(TEMPLATES[0].body);
    const [sending, setSending] = useState(false);
    const [progress, setProgress] = useState('');

    useEffect(() => {
        if (visible) applyTemplate('gracias');
    }, [visible]);

    const applyTemplate = (key: string) => {
        const t = TEMPLATES.find((x) => x.key === key) || TEMPLATES[0];
        setTemplateKey(t.key);
        setSubject(t.subject);
        setBody(t.body);
    };

    const withEmail = recipients.filter((r) => r.email);
    const withoutEmail = recipients.length - withEmail.length;
    const sample = withEmail[0];
    const previewVars = {
        nombre: (sample?.name || 'Ana').split(/\s+/)[0],
        puesto: jobTitle || 'la vacante',
        empresa: companyLabel || 'tu empresa',
    };
    const recruiterEmail = auth.currentUser?.email;

    const confirmSend = () => {
        const msg = `Se enviará el correo a ${withEmail.length} candidato${withEmail.length === 1 ? '' : 's'}. No se puede deshacer.`;
        if (Platform.OS === 'web') {
            if (window.confirm(msg)) send();
        } else {
            Alert.alert('¿Enviar correo?', msg, [{ text: 'Cancelar', style: 'cancel' }, { text: 'Enviar', onPress: send }]);
        }
    };

    const send = async () => {
        if (!auth.currentUser) return showAlert('Sesión', 'Vuelve a iniciar sesión para enviar correos.');
        setSending(true);
        const sent: string[] = [];
        let skipped = 0;
        let failed = 0;
        try {
            const idToken = await auth.currentUser.getIdToken();
            const ids = withEmail.map((r) => r.id);
            for (let i = 0; i < ids.length; i += BATCH) {
                setProgress(`Enviando ${Math.min(i + BATCH, ids.length)} de ${ids.length}...`);
                const res = await fetch('/.netlify/functions/candidate-email', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ idToken, jobId, candidateIds: ids.slice(i, i + BATCH), subject, body }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'No se pudo enviar');
                sent.push(...data.sent);
                skipped += data.skipped.length;
                failed += data.failed.length;
            }
            onSent(sent);
            const extra = [
                skipped + withoutEmail ? `${skipped + withoutEmail} sin email válido` : '',
                failed ? `${failed} no se pudieron enviar` : '',
            ].filter(Boolean).join(', ');
            showAlert('Correo enviado', `Se envió a ${sent.length} candidato${sent.length === 1 ? '' : 's'}.${extra ? ` (${extra})` : ''}`);
            onClose();
        } catch (e: any) {
            if (sent.length) onSent(sent);
            showAlert('Error', `${e.message}${sent.length ? ` Ya se habían enviado ${sent.length}.` : ''}`);
        } finally {
            setSending(false);
            setProgress('');
        }
    };

    const canSend = !sending && withEmail.length > 0 && subject.trim().length > 0 && body.trim().length > 0;

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <View style={styles.backdrop}>
                <View style={styles.card}>
                    <View style={styles.header}>
                        <Mail size={20} color="#3b82f6" />
                        <Text style={styles.title}>
                            Enviar correo a {recipients.length} candidato{recipients.length === 1 ? '' : 's'}
                        </Text>
                        <TouchableOpacity onPress={onClose} disabled={sending}>
                            <X size={22} color="#64748b" />
                        </TouchableOpacity>
                    </View>

                    <ScrollView contentContainerStyle={{ gap: 14 }}>
                        <View style={styles.chips}>
                            {TEMPLATES.map((t) => (
                                <TouchableOpacity
                                    key={t.key}
                                    style={[styles.chip, templateKey === t.key && styles.chipActive]}
                                    onPress={() => applyTemplate(t.key)}
                                    disabled={sending}
                                >
                                    <Text style={[styles.chipText, templateKey === t.key && styles.chipTextActive]}>{t.label}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <View>
                            <Text style={styles.label}>Asunto</Text>
                            <TextInput style={styles.input} value={subject} onChangeText={setSubject} maxLength={200} editable={!sending} placeholder="Asunto del correo" />
                        </View>

                        <View>
                            <Text style={styles.label}>Mensaje</Text>
                            <TextInput style={[styles.input, styles.textarea]} value={body} onChangeText={setBody} multiline maxLength={5000} editable={!sending} />
                            <Text style={styles.hint}>
                                {'{nombre}'}, {'{puesto}'} y {'{empresa}'} se reemplazan por los datos de cada candidato.
                            </Text>
                        </View>

                        {sample && (
                            <View style={styles.preview}>
                                <Text style={styles.previewLabel}>Vista previa para {previewVars.nombre}</Text>
                                <Text style={styles.previewSubject}>{fill(subject, previewVars)}</Text>
                                <Text style={styles.previewBody}>{fill(body, previewVars)}</Text>
                            </View>
                        )}

                        <Text style={styles.hint}>
                            Sale de notificaciones@veritlyapp.com con el nombre de tu empresa
                            {recruiterEmail ? `; las respuestas llegarán a ${recruiterEmail}` : ''}.
                            {withoutEmail > 0 ? ` ${withoutEmail} candidato${withoutEmail === 1 ? ' no tiene' : 's no tienen'} email y se omitirá${withoutEmail === 1 ? '' : 'n'}.` : ''}
                        </Text>
                    </ScrollView>

                    <View style={styles.footer}>
                        {sending && <Text style={styles.progress}>{progress}</Text>}
                        <TouchableOpacity style={styles.cancelBtn} onPress={onClose} disabled={sending}>
                            <Text style={styles.cancelText}>Cancelar</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.sendBtn, !canSend && { opacity: 0.5 }]} onPress={confirmSend} disabled={!canSend}>
                            {sending ? <ActivityIndicator color="white" /> : <Text style={styles.sendText}>Enviar a {withEmail.length}</Text>}
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.55)', justifyContent: 'center', alignItems: 'center', padding: 16 },
    card: { width: '100%', maxWidth: 640, maxHeight: '92%', backgroundColor: 'white', borderRadius: 16, padding: 20, gap: 14 },
    header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    title: { flex: 1, fontSize: 18, fontWeight: '700', color: '#0f172a' },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: { paddingVertical: 7, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: '#cbd5e1', backgroundColor: '#f8fafc' },
    chipActive: { backgroundColor: '#3b82f6', borderColor: '#3b82f6' },
    chipText: { fontSize: 13, color: '#334155', fontWeight: '600' },
    chipTextActive: { color: 'white' },
    label: { fontSize: 13, fontWeight: '600', color: '#475569', marginBottom: 6 },
    input: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, padding: 12, fontSize: 14, color: '#0f172a', backgroundColor: '#f8fafc' },
    textarea: { minHeight: 200, textAlignVertical: 'top' },
    hint: { fontSize: 12, color: '#64748b', marginTop: 6, lineHeight: 18 },
    preview: { backgroundColor: '#f1f5f9', borderRadius: 10, padding: 14, gap: 6 },
    previewLabel: { fontSize: 11, fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 },
    previewSubject: { fontSize: 14, fontWeight: '700', color: '#0f172a' },
    previewBody: { fontSize: 13, color: '#334155', lineHeight: 20 },
    footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 10 },
    progress: { flex: 1, fontSize: 12, color: '#64748b' },
    cancelBtn: { paddingVertical: 10, paddingHorizontal: 16 },
    cancelText: { color: '#64748b', fontWeight: '600' },
    sendBtn: { backgroundColor: '#3b82f6', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 10, minWidth: 120, alignItems: 'center' },
    sendText: { color: 'white', fontWeight: '700' },
});
