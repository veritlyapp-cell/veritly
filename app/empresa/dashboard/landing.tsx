import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as Clipboard from 'expo-clipboard';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { ArrowLeft, Copy, ExternalLink, Image as ImageIcon, Lock } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Platform, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { auth, storage } from '../../../config/firebase';

const BRAND_COLORS = ['#4F46E5', '#0EA5E9', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#111827'];

export default function LandingPageConfig() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [allowed, setAllowed] = useState(false);

    const [slug, setSlug] = useState('');
    const [savedSlug, setSavedSlug] = useState('');
    const [bannerUrl, setBannerUrl] = useState('');
    const [brandColor, setBrandColor] = useState('#4F46E5');
    const [enabled, setEnabled] = useState(true);
    const [uploadingBanner, setUploadingBanner] = useState(false);

    const showAlert = (title: string, msg: string) => {
        if (Platform.OS === 'web') window.alert(`${title}\n${msg}`);
        else Alert.alert(title, msg);
    };

    useEffect(() => {
        const load = async () => {
            if (!auth.currentUser) return;
            try {
                const idToken = await auth.currentUser.getIdToken();
                const res = await fetch('/.netlify/functions/landing-page', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'get_config', idToken, companyId: auth.currentUser.uid })
                });
                const data = await res.json();
                if (res.ok) {
                    setAllowed(data.allowed);
                    if (data.landingPage) {
                        setSlug(data.landingPage.slug || '');
                        setSavedSlug(data.landingPage.slug || '');
                        setBannerUrl(data.landingPage.bannerUrl || '');
                        setBrandColor(data.landingPage.brandColor || '#4F46E5');
                        setEnabled(data.landingPage.enabled ?? true);
                    }
                }
            } catch (e) {
                console.error("Error cargando config de landing page:", e);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    const handleSaveSlug = async () => {
        if (!auth.currentUser) return;
        setSaving(true);
        try {
            const idToken = await auth.currentUser.getIdToken();
            const res = await fetch('/.netlify/functions/landing-page', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'set_slug', idToken, companyId: auth.currentUser.uid, slug: slug.trim().toLowerCase() })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'No se pudo guardar');
            setSavedSlug(slug.trim().toLowerCase());
            showAlert("Listo", "Tu página de empleos está activa.");
        } catch (e: any) {
            showAlert("Error", e.message);
        } finally {
            setSaving(false);
        }
    };

    const handlePickBanner = async () => {
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images'],
                allowsEditing: true,
                aspect: [3, 1],
                quality: 0.6,
            });
            if (result.canceled) return;

            setUploadingBanner(true);
            const { uri } = result.assets[0];
            const response = await fetch(uri);
            const blob = await response.blob();
            if (blob.size > 3 * 1024 * 1024) throw new Error("La imagen es demasiado grande. Máximo 3MB.");

            const storageRef = ref(storage, `landing_banners/${auth.currentUser?.uid}_${Date.now()}`);
            await uploadBytes(storageRef, blob);
            const url = await getDownloadURL(storageRef);
            setBannerUrl(url);
            await handleUpdateBranding(url, brandColor, enabled);
        } catch (e: any) {
            showAlert("Error", e.message || "No se pudo subir la imagen.");
        } finally {
            setUploadingBanner(false);
        }
    };

    const handleUpdateBranding = async (newBanner?: string, newColor?: string, newEnabled?: boolean) => {
        if (!auth.currentUser) return;
        try {
            const idToken = await auth.currentUser.getIdToken();
            await fetch('/.netlify/functions/landing-page', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'update_branding', idToken, companyId: auth.currentUser.uid,
                    bannerUrl: newBanner ?? bannerUrl,
                    brandColor: newColor ?? brandColor,
                    enabled: newEnabled ?? enabled
                })
            });
        } catch (e) {
            console.error("Error actualizando branding:", e);
        }
    };

    const publicUrl = savedSlug ? `https://www.veritlyapp.com/e/${savedSlug}` : '';

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <ActivityIndicator color="#4F46E5" size="large" />
            </SafeAreaView>
        );
    }

    if (!allowed) {
        return (
            <SafeAreaView style={styles.container}>
                <StatusBar barStyle="dark-content" backgroundColor="#F9FAFB" />
                <View style={styles.lockedBox}>
                    <Lock color="#9CA3AF" size={40} />
                    <Text style={styles.lockedTitle}>Landing Page no disponible</Text>
                    <Text style={styles.lockedText}>Esta función es exclusiva de los planes Gold y Enterprise.</Text>
                    <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
                        <Text style={styles.backBtnText}>Volver</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="#F9FAFB" />
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backIconBtn}>
                    <ArrowLeft size={22} color="#111827" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Página de Empleos</Text>
            </View>

            <ScrollView contentContainerStyle={{ padding: 20 }}>
                <Text style={styles.sectionLabel}>Tu link público</Text>
                <View style={styles.slugRow}>
                    <Text style={styles.slugPrefix}>veritlyapp.com/e/</Text>
                    <TextInput
                        style={styles.slugInput}
                        value={slug}
                        onChangeText={t => setSlug(t.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                        placeholder="tu-empresa"
                        placeholderTextColor="#9CA3AF"
                        autoCapitalize="none"
                    />
                </View>
                <TouchableOpacity style={styles.saveSlugBtn} onPress={handleSaveSlug} disabled={saving || !slug.trim()}>
                    {saving ? <ActivityIndicator color="white" /> : <Text style={styles.saveSlugBtnText}>Guardar link</Text>}
                </TouchableOpacity>

                {savedSlug ? (
                    <View style={styles.publicUrlRow}>
                        <Text style={styles.publicUrlText} numberOfLines={1}>{publicUrl}</Text>
                        <TouchableOpacity onPress={async () => { await Clipboard.setStringAsync(publicUrl); showAlert("Copiado", "Link copiado al portapapeles."); }}>
                            <Copy size={18} color="#4F46E5" />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => Platform.OS === 'web' ? window.open(publicUrl, '_blank') : null}>
                            <ExternalLink size={18} color="#4F46E5" />
                        </TouchableOpacity>
                    </View>
                ) : (
                    <Text style={styles.helperText}>Elige un link y guárdalo para activar tu página.</Text>
                )}

                <Text style={[styles.sectionLabel, { marginTop: 30 }]}>Banner (opcional)</Text>
                <TouchableOpacity style={styles.bannerUpload} onPress={handlePickBanner}>
                    {uploadingBanner ? (
                        <ActivityIndicator color="#4F46E5" />
                    ) : bannerUrl ? (
                        <Image source={{ uri: bannerUrl }} style={styles.bannerPreview} resizeMode="cover" />
                    ) : (
                        <>
                            <ImageIcon size={24} color="#9CA3AF" />
                            <Text style={styles.bannerUploadText}>Subir imagen (recomendado 1200x400)</Text>
                        </>
                    )}
                </TouchableOpacity>

                <Text style={[styles.sectionLabel, { marginTop: 30 }]}>Color de marca</Text>
                <View style={styles.colorRow}>
                    {BRAND_COLORS.map(c => (
                        <TouchableOpacity
                            key={c}
                            onPress={() => { setBrandColor(c); handleUpdateBranding(undefined, c, undefined); }}
                            style={[styles.colorDot, { backgroundColor: c }, brandColor === c && styles.colorDotActive]}
                        />
                    ))}
                </View>

                <Text style={styles.footerNote}>
                    Las vacantes aparecen aquí solo si marcaste "Publicar en Página de Empleos" al crearlas o editarlas.
                </Text>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F9FAFB' },
    header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
    backIconBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
    headerTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
    lockedBox: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 30 },
    lockedTitle: { fontSize: 17, fontWeight: '700', color: '#111827', marginTop: 8 },
    lockedText: { fontSize: 13, color: '#6B7280', textAlign: 'center' },
    backBtn: { marginTop: 16, backgroundColor: '#4F46E5', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
    backBtnText: { color: 'white', fontWeight: '700' },
    sectionLabel: { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 10 },
    slugRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB', paddingHorizontal: 12 },
    slugPrefix: { color: '#9CA3AF', fontSize: 13 },
    slugInput: { flex: 1, paddingVertical: 12, fontSize: 14, color: '#111827' },
    saveSlugBtn: { backgroundColor: '#4F46E5', paddingVertical: 12, borderRadius: 10, alignItems: 'center', marginTop: 10 },
    saveSlugBtnText: { color: 'white', fontWeight: '700' },
    publicUrlRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12, backgroundColor: '#EEF2FF', borderRadius: 10, padding: 10 },
    publicUrlText: { flex: 1, color: '#4F46E5', fontSize: 12, fontWeight: '600' },
    helperText: { color: '#9CA3AF', fontSize: 12, marginTop: 8 },
    bannerUpload: { height: 110, borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', borderStyle: 'dashed', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
    bannerPreview: { width: '100%', height: '100%' },
    bannerUploadText: { color: '#9CA3AF', fontSize: 12, marginTop: 8 },
    colorRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
    colorDot: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: 'transparent' },
    colorDotActive: { borderColor: '#111827' },
    footerNote: { fontSize: 12, color: '#9CA3AF', marginTop: 30, lineHeight: 18 },
});
