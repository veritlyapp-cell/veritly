import { Copy, Mail, X } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { Linking, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { auth } from '../config/firebase';
import { showAlert } from '../utils/ui';

// Prepara un correo a varios candidatos en copia oculta (BCC) y lo abre en el
// correo del propio reclutador (Gmail web o su app de correo). Veritly no
// envia nada: sale de la cuenta del reclutador, sin costo ni cuota de envio.
// Como es un solo mensaje para todos, el texto no se personaliza por nombre.

type Props = {
    visible: boolean;
    onClose: () => void;
    jobTitle: string;
    emails: string[];
    missingEmail: number; // seleccionados sin email
};

const templates = (puesto: string) => [
    {
        key: 'gracias',
        label: 'Agradecimiento',
        subject: `Gracias por postular a ${puesto}`,
        body: `Hola:\n\nGracias por tu interés en el puesto de ${puesto} y por el tiempo que dedicaste a postular.\n\nDespués de revisar los perfiles, decidimos avanzar con otros candidatos cuya experiencia se ajusta más a lo que buscamos en esta oportunidad. Guardaremos tu perfil para futuras vacantes.\n\nTe deseamos mucho éxito.\n\nSaludos,`,
    },
    {
        key: 'entrevista',
        label: 'Invitar a entrevista',
        subject: `Siguiente paso: entrevista para ${puesto}`,
        body: `Hola:\n\nGracias por postular al puesto de ${puesto}. Nos gustó tu perfil y queremos conocerte en una entrevista.\n\nResponde a este correo con tu disponibilidad para los próximos días y coordinamos.\n\nSaludos,`,
    },
    {
        key: 'recibido',
        label: 'Postulación recibida',
        subject: `Recibimos tu postulación a ${puesto}`,
        body: `Hola:\n\nGracias por postular al puesto de ${puesto}. Recibimos tu postulación y la estamos revisando. Te escribiremos si tu perfil avanza a la siguiente etapa.\n\nSaludos,`,
    },
    { key: 'libre', label: 'Mensaje libre', subject: '', body: 'Hola:\n\n\n\nSaludos,' },
];

// Clientes de correo de escritorio (ej. Outlook) cortan los mailto: largos
const MAX_MAILTO_LENGTH = 1900;

export default function BccEmailComposer({ visible, onClose, jobTitle, emails, missingEmail }: Props) {
    const options = templates(jobTitle || 'la vacante');
    const [templateKey, setTemplateKey] = useState('gracias');
    const [subject, setSubject] = useState(options[0].subject);
    const [body, setBody] = useState(options[0].body);
    const self = auth.currentUser?.email || '';

    const applyTemplate = (key: string) => {
        const t = options.find((o) => o.key === key) || options[0];
        setTemplateKey(t.key);
        setSubject(t.subject);
        setBody(t.body);
    };

    useEffect(() => {
        if (visible) applyTemplate('gracias');
    }, [visible]);

    const bcc = emails.map(encodeURIComponent).join(',');
    // "Para" = el propio reclutador, asi nadie ve a los demas destinatarios
    const mailtoUrl = `mailto:${encodeURIComponent(self)}?bcc=${bcc}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(self)}&bcc=${bcc}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    const mailtoTooLong = mailtoUrl.length > MAX_MAILTO_LENGTH;

    const openGmail = () => {
        if (Platform.OS === 'web') window.open(gmailUrl, '_blank');
        else Linking.openURL(gmailUrl);
    };

    const openMailApp = () => {
        if (mailtoTooLong) {
            return showAlert('Demasiados destinatarios', 'Son demasiados para abrirlos directo en tu app de correo. Usa "Abrir en Gmail" o copia los emails y pégalos en CCO.');
        }
        Linking.openURL(mailtoUrl);
    };

    const copy = async (text: string, what: string) => {
        try {
            await navigator.clipboard.writeText(text);
            showAlert('Copiado', `${what} copiados al portapapeles.`);
        } catch {
            showAlert('No se pudo copiar', 'Tu navegador no permitió copiar al portapapeles.');
        }
    };

    const ready = emails.length > 0 && subject.trim().length > 0 && body.trim().length > 0;

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <View style={styles.backdrop}>
                <View style={styles.card}>
                    <View style={styles.header}>
                        <Mail size={20} color="#3b82f6" />
                        <Text style={styles.title}>Correo a {emails.length} candidato{emails.length === 1 ? '' : 's'} (copia oculta)</Text>
                        <TouchableOpacity onPress={onClose}>
                            <X size={22} color="#64748b" />
                        </TouchableOpacity>
                    </View>

                    <ScrollView contentContainerStyle={{ gap: 14 }}>
                        <View style={styles.chips}>
                            {options.map((t) => (
                                <TouchableOpacity key={t.key} style={[styles.chip, templateKey === t.key && styles.chipActive]} onPress={() => applyTemplate(t.key)}>
                                    <Text style={[styles.chipText, templateKey === t.key && styles.chipTextActive]}>{t.label}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <View>
                            <Text style={styles.label}>Asunto</Text>
                            <TextInput style={styles.input} value={subject} onChangeText={setSubject} placeholder="Asunto del correo" />
                        </View>

                        <View>
                            <Text style={styles.label}>Mensaje</Text>
                            <TextInput style={[styles.input, styles.textarea]} value={body} onChangeText={setBody} multiline />
                        </View>

                        <Text style={styles.hint}>
                            Se abre en tu correo{self ? ` (${self})` : ''}, con los candidatos en copia oculta: ninguno ve a los demás. Revisa y envía desde ahí; Veritly no envía nada.
                            {missingEmail > 0 ? ` ${missingEmail} seleccionado${missingEmail === 1 ? ' no tiene' : 's no tienen'} email y no se incluye${missingEmail === 1 ? '' : 'n'}.` : ''}
                        </Text>
                    </ScrollView>

                    <View style={styles.footer}>
                        <TouchableOpacity style={styles.linkBtn} onPress={() => copy(emails.join(', '), 'Emails')} disabled={!emails.length}>
                            <Copy size={14} color="#3b82f6" />
                            <Text style={styles.linkText}>Copiar emails</Text>
                        </TouchableOpacity>
                        <View style={{ flex: 1 }} />
                        <TouchableOpacity style={[styles.secondaryBtn, !ready && { opacity: 0.5 }]} onPress={openMailApp} disabled={!ready}>
                            <Text style={styles.secondaryText}>Abrir en mi app de correo</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.primaryBtn, !ready && { opacity: 0.5 }]} onPress={openGmail} disabled={!ready}>
                            <Text style={styles.primaryText}>Abrir en Gmail</Text>
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
    hint: { fontSize: 12, color: '#64748b', lineHeight: 18 },
    footer: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10 },
    linkBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8 },
    linkText: { color: '#3b82f6', fontWeight: '600', fontSize: 13 },
    secondaryBtn: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor: '#cbd5e1' },
    secondaryText: { color: '#334155', fontWeight: '600', fontSize: 13 },
    primaryBtn: { backgroundColor: '#3b82f6', paddingVertical: 10, paddingHorizontal: 18, borderRadius: 10 },
    primaryText: { color: 'white', fontWeight: '700', fontSize: 13 },
});
