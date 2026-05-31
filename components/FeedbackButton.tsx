import { addDoc, collection } from 'firebase/firestore';
import { MessageSquare, Send, X } from 'lucide-react-native';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { auth, db } from '../config/firebase';

export default function FeedbackButton() {
    const [modalVisible, setModalVisible] = useState(false);
    const [feedback, setFeedback] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSend = async () => {
        if (!feedback.trim()) {
            return Alert.alert("Campo vacío", "Por favor escribe tu sugerencia o comentario.");
        }

        setLoading(true);
        try {
            const user = auth.currentUser;
            const userEmail = user?.email || 'Anónimo';
            const userRole = userEmail.includes('relielabs') ? 'Admin' : 'Usuario'; // Simplified role guess

            // 1. Guardar en Firestore
            await addDoc(collection(db, 'feedback'), {
                uid: user?.uid || 'anon',
                email: userEmail,
                message: feedback,
                createdAt: new Date().toISOString(),
                read: false
            });

            // 2. Enviar Correo a hola@relielabs.com
            try {
                await fetch('/.netlify/functions/send-email', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        to: 'hola@relielabs.com',
                        subject: `💡 Nuevo Feedback de ${userEmail}`,
                        html: `
                            <h2>Nuevo Comentario/Sugerencia</h2>
                            <p><strong>Usuario:</strong> ${userEmail}</p>
                            <p><strong>Mensaje:</strong></p>
                            <blockquote style="background: #f9f9f9; padding: 10px; border-left: 5px solid #3b82f6;">
                                ${feedback.replace(/\n/g, '<br>')}
                            </blockquote>
                            <p style="color: #666; font-size: 12px;">Enviado desde Veritly App</p>
                        `
                    })
                });
            } catch (emailError) {
                console.error("Error enviando email de feedback:", emailError);
                // No bloqueamos el éxito si falla el email, ya está en Firestore
            }

            Alert.alert("¡Gracias!", "Tu comentario ha sido enviado al equipo.");
            setFeedback('');
            setModalVisible(false);

        } catch (error: any) {
            Alert.alert("Error", "No se pudo enviar el feedback. Intenta de nuevo.");
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <TouchableOpacity
                style={styles.floatingButton}
                onPress={() => setModalVisible(true)}
            >
                <MessageSquare color="white" size={24} />
            </TouchableOpacity>

            <Modal
                animationType="slide"
                transparent={true}
                visible={modalVisible}
                onRequestClose={() => setModalVisible(false)}
            >
                <KeyboardAvoidingView
                    behavior={Platform.OS === "ios" ? "padding" : "height"}
                    style={styles.centeredView}
                >
                    <View style={styles.modalView}>
                        <View style={styles.header}>
                            <Text style={styles.modalTitle}>Sugerencias / Reportes</Text>
                            <TouchableOpacity onPress={() => setModalVisible(false)} style={{ padding: 5 }}>
                                <X color="#94a3b8" size={24} />
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.subtitle}>
                            ¿Encontraste un error o tienes una idea para mejorar Veritly? Te leemos.
                        </Text>

                        <TextInput
                            style={styles.input}
                            placeholder="Escribe tu comentario aquí..."
                            placeholderTextColor="#64748b"
                            multiline
                            numberOfLines={4}
                            value={feedback}
                            onChangeText={setFeedback}
                            textAlignVertical="top"
                        />

                        <TouchableOpacity
                            style={[styles.button, loading && { opacity: 0.7 }]}
                            onPress={handleSend}
                            disabled={loading}
                        >
                            {loading ? (
                                <ActivityIndicator color="white" />
                            ) : (
                                <>
                                    <Text style={styles.textStyle}>Enviar Comentario</Text>
                                    <Send color="white" size={16} style={{ marginLeft: 8 }} />
                                </>
                            )}
                        </TouchableOpacity>
                    </View>
                </KeyboardAvoidingView>
            </Modal>
        </>
    );
}

const styles = StyleSheet.create({
    floatingButton: {
        position: 'absolute',
        bottom: 30,
        left: 20,
        backgroundColor: '#3b82f6',
        width: 56,
        height: 56,
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 8,
        shadowColor: '#3b82f6',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        zIndex: 1000
    },
    centeredView: {
        flex: 1,
        justifyContent: "flex-end",
        backgroundColor: "rgba(0,0,0,0.5)"
    },
    modalView: {
        backgroundColor: "#1e293b",
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: 25,
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 2
        },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 5,
        width: '100%'
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: "bold",
        color: "white"
    },
    subtitle: {
        color: '#94a3b8',
        fontSize: 14,
        marginBottom: 15
    },
    input: {
        backgroundColor: '#0f172a',
        color: 'white',
        borderRadius: 10,
        padding: 15,
        height: 120,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: '#334155'
    },
    button: {
        borderRadius: 10,
        padding: 15,
        elevation: 2,
        backgroundColor: "#10b981",
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center'
    },
    textStyle: {
        color: "white",
        fontWeight: "bold",
        textAlign: "center",
        fontSize: 16
    }
});
