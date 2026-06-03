import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { Building2, ChevronDown, MapPin, Save, Sparkles, User, UserCheck, X, Camera, Trash2 } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert as RNAlert, FlatList, Modal, Platform, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View, Image } from 'react-native';
import { auth, db, storage } from '../../../config/firebase';
import { getDepartamentos, getDistritos, getProvincias } from '../../../utils/geo-peru';

const Alert = {
    alert: (title: string, message?: string, buttons?: any) => {
        if (Platform.OS === 'web') {
            if (buttons && buttons.length > 1) {
                const confirmBtn = buttons.find((b: any) => b.style === 'destructive' || b.text === 'Eliminar' || b.text === 'Sincronizar');
                const cancelBtn = buttons.find((b: any) => b.style === 'cancel' || b.text === 'Cancelar');
                const confirmed = window.confirm(`${title}\n\n${message || ''}`);
                if (confirmed) {
                    if (confirmBtn && typeof confirmBtn.onPress === 'function') {
                        confirmBtn.onPress();
                    }
                } else {
                    if (cancelBtn && typeof cancelBtn.onPress === 'function') {
                        cancelBtn.onPress();
                    }
                }
            } else {
                window.alert(`${title}${message ? '\n\n' + message : ''}`);
                if (buttons && buttons.length === 1) {
                    if (typeof buttons[0].onPress === 'function') {
                        buttons[0].onPress();
                    }
                }
            }
        } else {
            RNAlert.alert(title, message, buttons);
        }
    }
};

export default function CompanyProfile() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [initialLoading, setInitialLoading] = useState(true);

    // DATOS COMPAÑÍA
    const [ruc, setRuc] = useState('');
    const [razonSocial, setRazonSocial] = useState('');
    const [nombreComercial, setNombreComercial] = useState('');
    const [logoUrl, setLogoUrl] = useState('');
    const [uploadingLogo, setUploadingLogo] = useState(false);
    const [isRucFromDb, setIsRucFromDb] = useState(false);
    const [userType, setUserType] = useState<'empresa' | 'independiente'>('empresa');
    const [dni, setDni] = useState('');

    // UBICACIÓN (Perú)
    const [departamento, setDepartamento] = useState('Lima');
    const [provincia, setProvincia] = useState('');
    const [distrito, setDistrito] = useState('');
    const [direccion, setDireccion] = useState('');

    // Listas dinámicas
    const [departamentosList] = useState(getDepartamentos());
    const [provinciasList, setProvinciasList] = useState<string[]>([]);
    const [distritosList, setDistritosList] = useState<string[]>([]);

    // Modal Control
    const [modalVisible, setModalVisible] = useState(false);
    const [modalType, setModalType] = useState<'dep' | 'prov' | 'dist' | 'rubro'>('dep');

    // RESPONSABLE
    const [nombreResponsable, setNombreResponsable] = useState('');
    const [cargoResponsable, setCargoResponsable] = useState('');
    const [celular, setCelular] = useState('');
    const [emailResponsable, setEmailResponsable] = useState('');

    // CONTEXTO IA
    const [rubro, setRubro] = useState('');
    const [beneficios, setBeneficios] = useState('');

    // Lista de rubros comunes en Perú
    const RUBROS_PERU = [
        'Retail / Comercio',
        'Banca y Finanzas',
        'Tecnología / TI',
        'Consultoría RR.HH.',
        'Manufactura / Industrial',
        'Logística y Transporte',
        'Salud / Farmacéutica',
        'Educación',
        'Construcción',
        'Minería y Energía',
        'Telecomunicaciones',
        'Servicios Profesionales',
        'Alimentos y Bebidas',
        'Hotelería y Turismo',
        'Seguros',
        'Automotriz',
        'Agroindustria',
        'Inmobiliaria',
        'Otro'
    ];

    useEffect(() => {
        const loadProfile = async () => {
            if (!auth.currentUser) return;
            try {
                // Intentar primero con la colección nueva
                let docRef = doc(db, 'users_empresas', auth.currentUser.uid);
                let docSnap = await getDoc(docRef);

                // Fallback a colección antigua
                if (!docSnap.exists()) {
                    console.log("📦 No encontrado en users_empresas, probando companies...");
                    docRef = doc(db, 'companies', auth.currentUser.uid);
                    docSnap = await getDoc(docRef);
                }

                if (docSnap.exists()) {
                    const data = docSnap.data();
                    console.log("✅ Perfil cargado:", data);

                    // [FIX] Búsqueda exhaustiva de datos (Nueva estructura -> Antigua -> Raíz)
                    const companyData = data.company || {};
                    const fetchedType = companyData.type || (companyData.dni ? 'independiente' : 'empresa');
                    setUserType(fetchedType);
                    
                    if (fetchedType === 'independiente') {
                        if (companyData.dni) setDni(companyData.dni);
                    }
                    
                    // Prioridad de búsqueda de RUC
                    const rucValue = companyData.ruc || data.ruc || data.taxId || '';
                    
                    // Prioridad de Razón Social
                    const razonSocialValue = companyData.razonSocial || data.razonSocial || data.companyName || '';
                    
                    // Prioridad de Nombre Comercial
                    const nameValue = companyData.name || data.nombreComercial || data.name || '';

                    if (rucValue && rucValue.trim() !== '') {
                        setRuc(rucValue.trim());
                        setIsRucFromDb(true);
                    }
                    setRazonSocial(razonSocialValue);
                    setNombreComercial(nameValue);

                    if (data.location) {
                        setDepartamento(data.location.departamento || 'Lima');
                        setProvincia(data.location.provincia || '');
                        setDistrito(data.location.distrito || '');
                        setDireccion(data.location.address || '');
                    }

                    if (data.responsible) {
                        setNombreResponsable(data.responsible.name || '');
                        setCargoResponsable(data.responsible.position || '');
                        setCelular(data.responsible.phone || '');
                        setEmailResponsable(data.responsible.email || '');
                    }

                    // Contexto IA
                    if (data.aiContext) {
                        setRubro(data.aiContext.rubro || '');
                        setBeneficios(data.aiContext.beneficios || '');
                    }

                    // Logo
                    setLogoUrl(data.company?.logoUrl || data.logoUrl || '');
                } else {
                    console.log("⚠️ No se encontró perfil en ninguna colección");
                }
            } catch (error) {
                console.error("Error loading profile:", error);
                Alert.alert("Error", "No se pudo cargar la información del perfil.");
            } finally {
                setInitialLoading(false);
            }
        };
        loadProfile();
    }, []);

    // Actualizar provincias cuando cambia departamento
    useEffect(() => {
        const provs = getProvincias(departamento);
        setProvinciasList(provs);
    }, [departamento]);

    // Actualizar distritos cuando cambia provincia
    useEffect(() => {
        if (provincia) {
            const dists = getDistritos(departamento, provincia);
            setDistritosList(dists);
        } else {
            setDistritosList([]);
        }
    }, [provincia]);

    const handleUpdate = async () => {
        const missing = [];
        if (userType === 'empresa') {
            if (!ruc) missing.push("RUC");
            if (!razonSocial) missing.push("Razón Social");
        } else {
            if (!dni) missing.push("DNI");
        }
        // Nombre Comercial can be optional if created empty
        // if (!nombreComercial) missing.push("Nombre Comercial");
        if (!departamento || !provincia || !distrito) missing.push("Ubicación Completa");
        if (!nombreResponsable) missing.push("Nombre Responsable");
        if (!emailResponsable) missing.push("Email Responsable");

        if (missing.length > 0) {
            return Alert.alert("Faltan Datos", "Por favor completa: \n- " + missing.join("\n- "));
        }

        if (userType === 'empresa') {
            // [SAFETY] Validación de formato RUC (Solo números y exactamente 11 dígitos)
            const cleanRuc = ruc.trim();
            if (cleanRuc.length !== 11 || !/^\d+$/.test(cleanRuc)) {
                return Alert.alert("RUC Inválido", "El RUC debe tener exactamente 11 números. Verifica que no tenga espacios ni letras.");
            }
        } else {
            // [SAFETY] Validación de formato DNI (Solo números y exactamente 8 dígitos)
            const cleanDni = dni.trim();
            if (cleanDni.length !== 8 || !/^\d+$/.test(cleanDni)) {
                return Alert.alert("DNI Inválido", "El DNI debe tener exactamente 8 números.");
            }
        }

        setLoading(true);
        try {
            const user = auth.currentUser;
            if (!user) return;

            // [FIX] Update specific fields in nested objects using dot notation
            // This preserves other fields in 'company', 'location', 'responsible', etc.
            // AND fixes the schema mismatch.
            const updateData = {
                ...(userType === 'empresa' ? {
                    'company.ruc': ruc,
                    'company.razonSocial': razonSocial,
                    'company.name': nombreComercial,
                } : {
                    'company.dni': dni,
                    'company.name': nombreComercial || nombreResponsable,
                }),
                'company.type': userType,

                'location.departamento': departamento,
                'location.provincia': provincia,
                'location.distrito': distrito,
                'location.address': direccion,

                'responsible.name': nombreResponsable,
                'responsible.position': cargoResponsable,
                'responsible.phone': celular,
                'responsible.email': emailResponsable,

                'aiContext.rubro': rubro,
                'aiContext.beneficios': beneficios,

                'company.logoUrl': logoUrl,
                logoUrl: logoUrl, // duplicamos para compatibilidad
                profileSkipped: false,

                updatedAt: new Date().toISOString()
            };

            // [FIX] Use updateDoc to correctly handle dot notation for nested fields.
            // setDoc with { merge: true } and dot notation creates fields with dots in keys.
            // updateDoc parses "company.ruc" as nested field update.
            await updateDoc(doc(db, 'users_empresas', user.uid), updateData);
            console.log("✅ Perfil guardado en users_empresas");
            Alert.alert("¡Éxito!", "Tus datos han sido guardados correctamente.");
            
            // Redirección automática después de 1.5 segundos
            setTimeout(() => {
                router.push('/empresa/dashboard/puestos');
            }, 1500);

        } catch (e: any) {
            console.error("❌ Error al guardar perfil:", e);
            Alert.alert("Error al Guardar", "No se pudo guardar la información. Puede ser un problema de permisos en Firestore. \n\nDetalle: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    const openModal = (type: 'dep' | 'prov' | 'dist' | 'rubro') => {
        if (type === 'prov' && !departamento) return Alert.alert("Atención", "Primero selecciona un Departamento");
        if (type === 'dist' && !provincia) return Alert.alert("Atención", "Primero selecciona una Provincia");
        setModalType(type);
        setModalVisible(true);
    };

    const handleSelect = (item: string) => {
        if (modalType === 'dep') { setDepartamento(item); setProvincia(''); setDistrito(''); }
        if (modalType === 'prov') { setProvincia(item); setDistrito(''); }
        if (modalType === 'dist') setDistrito(item);
        if (modalType === 'rubro') setRubro(item);
        setModalVisible(false);
    };

    const handlePickLogo = async () => {
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images'],
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.5,
            });

            if (result.canceled) return;

            setUploadingLogo(true);
            const { uri } = result.assets[0];
            console.log("📸 Imagen seleccionada URI:", uri);

            // [FIX] Mejor manejo de carga para evitar cuelgues
            let blob;
            try {
                console.log("⏳ Convirtiendo URI a Blob...");
                const response = await fetch(uri);
                blob = await response.blob();
                console.log("✅ Blob creado. Tamaño:", blob.size, "bytes");
            } catch (fetchErr) {
                console.error("❌ Error en fetch/blob:", fetchErr);
                throw new Error("No se pudo procesar la imagen seleccionada.");
            }

            // Validar tamaño (máx 2MB)
            if (blob.size > 2 * 1024 * 1024) {
                throw new Error("La imagen es demasiado grande. Máximo 2MB.");
            }

            console.log("🚀 Subiendo a Firebase Storage...");
            const storageRef = ref(storage, `logos/${auth.currentUser?.uid}_${Date.now()}`);
            
            await uploadBytes(storageRef, blob);
            console.log("✅ Subida completada a Storage");

            const url = await getDownloadURL(storageRef);
            console.log("🔗 URL obtenida:", url);
            setLogoUrl(url);
            
            Alert.alert("¡Éxito!", "Logo cargado. No olvides guardar los cambios al final.");
        } catch (e: any) {
            console.error("Error completo subida logo:", e);
            Alert.alert("Error de Carga", e.message || "No se pudo subir la imagen. Verifica tu conexión.");
        } finally {
            setUploadingLogo(false);
        }
    };

    const getListData = () => {
        if (modalType === 'dep') return departamentosList;
        if (modalType === 'prov') return provinciasList;
        if (modalType === 'dist') return distritosList;
        return RUBROS_PERU;
    };

    if (initialLoading) {
        return (
            <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color="#4F46E5" />
                <Text style={{ color: '#4B5563', marginTop: 10 }}>Cargando perfil...</Text>
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="#F9FAFB" />

            <ScrollView 
                contentContainerStyle={[
                    styles.form,
                    Platform.OS === 'web' && { maxWidth: 900, alignSelf: 'center', width: '100%' }
                ]}
            >


                {/* SECCIÓN 1: DATOS CORPORATIVOS */}
                <View style={styles.sectionHeader}>
                    <Building2 color="#38bdf8" size={24} />
                    <Text style={styles.sectionTitle}>Datos Corporativos</Text>
                </View>

                {/* LOGO UPLOAD */}
                <View style={styles.logoSection}>
                    <View style={styles.logoWrapper}>
                        {logoUrl ? (
                            <Image source={{ uri: logoUrl }} style={styles.logoImage} />
                        ) : (
                            <View style={styles.logoPlaceholder}>
                                <Building2 color="#94a3b8" size={30} />
                            </View>
                        )}
                        <TouchableOpacity 
                            style={styles.cameraBtn} 
                            onPress={handlePickLogo}
                            disabled={uploadingLogo}
                        >
                            {uploadingLogo ? <ActivityIndicator size="small" color="white" /> : <Camera color="white" size={16} />}
                        </TouchableOpacity>
                    </View>
                    <View style={{ flex: 1, marginLeft: 20 }}>
                        <Text style={styles.logoLabel}>Logo de Empresa</Text>
                        <Text style={styles.logoHint}>Recomendado: 512x512px (PNG/JPG). Este logo se verá en tus vacantes públicas.</Text>
                        {logoUrl && (
                            <TouchableOpacity onPress={() => setLogoUrl('')} style={{ marginTop: 8 }}>
                                <Text style={{ color: '#ef4444', fontSize: 12, fontWeight: 'bold' }}>Quitar logo</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>

                {userType === 'empresa' ? (
                    <>
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>RUC</Text>
                            <TextInput 
                                style={[styles.input, !isRucFromDb && { backgroundColor: '#FFFFFF', borderColor: '#4F46E5' }, isRucFromDb && { backgroundColor: '#F1F5F9', color: '#475569' }]} 
                                value={ruc} 
                                onChangeText={(text) => setRuc(text.replace(/[^0-9]/g, ''))} // Solo números
                                keyboardType="numeric" 
                                maxLength={11} 
                                editable={!isRucFromDb} 
                                selectTextOnFocus={!isRucFromDb} 
                            />
                            <Text style={{ color: '#64748b', fontSize: 10, marginTop: 2 }}>
                                {isRucFromDb ? "El RUC no se puede editar una vez registrado." : "Ingresa los 11 dígitos de tu RUC."}
                            </Text>
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Razón Social</Text>
                            <TextInput style={styles.input} value={razonSocial} onChangeText={setRazonSocial} />
                        </View>
                    </>
                ) : (
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>DNI</Text>
                        <TextInput 
                            style={[styles.input, { backgroundColor: '#F1F5F9', color: '#475569' }]} 
                            value={dni} 
                            onChangeText={setDni}
                            editable={!dni}
                            keyboardType="numeric"
                            maxLength={8}
                        />
                        <Text style={{ color: '#64748b', fontSize: 10, marginTop: 2 }}>
                            {dni ? "El DNI no se puede editar una vez registrado." : "Ingresa los 8 dígitos de tu DNI."}
                        </Text>
                    </View>
                )}

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>{userType === 'empresa' ? "Nombre Comercial" : "Nombre Comercial / Marca"}</Text>
                    <TextInput style={styles.input} value={nombreComercial} onChangeText={setNombreComercial} />
                </View>

                {/* SECCIÓN 2: UBICACIÓN */}
                <View style={[styles.sectionHeader, { marginTop: 25 }]}>
                    <MapPin color="#38bdf8" size={24} />
                    <Text style={styles.sectionTitle}>Ubicación</Text>
                </View>

                <Text style={styles.label}>Departamento</Text>
                <TouchableOpacity style={styles.selectButton} onPress={() => openModal('dep')}>
                    <Text style={{ color: departamento ? '#111827' : '#64748b', fontSize: 15 }}>{departamento || "Seleccionar..."}</Text>
                    <ChevronDown color="#94a3b8" size={20} />
                </TouchableOpacity>

                <View style={{ flexDirection: 'row', gap: 10 }}>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.label}>Provincia</Text>
                        <TouchableOpacity style={styles.selectButton} onPress={() => openModal('prov')}>
                            <Text style={{ color: provincia ? '#111827' : '#64748b', fontSize: 15 }}>{provincia || "Seleccionar..."}</Text>
                            <ChevronDown color="#94a3b8" size={20} />
                        </TouchableOpacity>
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.label}>Distrito</Text>
                        <TouchableOpacity style={styles.selectButton} onPress={() => openModal('dist')}>
                            <Text style={{ color: distrito ? '#111827' : '#64748b', fontSize: 15 }}>{distrito || "Seleccionar..."}</Text>
                            <ChevronDown color="#94a3b8" size={20} />
                        </TouchableOpacity>
                    </View>
                </View>

                <Text style={styles.label}>Dirección Fiscal</Text>
                <TextInput style={styles.input} value={direccion} onChangeText={setDireccion} />


                {/* SECCIÓN 3: RESPONSABLE */}
                <View style={[styles.sectionHeader, { marginTop: 25 }]}>
                    <User color="#38bdf8" size={24} />
                    <Text style={styles.sectionTitle}>Contacto Responsable</Text>
                </View>

                <Text style={styles.label}>Nombre Completo</Text>
                <TextInput style={styles.input} value={nombreResponsable} onChangeText={setNombreResponsable} />

                <Text style={styles.label}>Cargo</Text>
                <TextInput style={styles.input} value={cargoResponsable} onChangeText={setCargoResponsable} />

                <View style={{ flexDirection: 'row', gap: 10 }}>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.label}>Celular</Text>
                        <TextInput style={styles.input} value={celular} onChangeText={setCelular} keyboardType="phone-pad" />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.label}>Email (Contacto)</Text>
                        <TextInput style={styles.input} value={emailResponsable} onChangeText={setEmailResponsable} keyboardType="email-address" autoCapitalize="none" />
                    </View>
                </View>

                {/* SECCIÓN 4: USUARIOS Y ROLES */}
                <View style={[styles.sectionHeader, { marginTop: 35 }]}>
                    <UserCheck color="#38bdf8" size={24} />
                    <Text style={styles.sectionTitle}>Usuarios y Roles</Text>
                </View>
                <View style={{ backgroundColor: '#FFFFFF', padding: 15, borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB' }}>
                    <Text style={{ color: '#111827', fontWeight: 'bold' }}>Administrador Principal</Text>
                    <Text style={{ color: '#6B7280', fontSize: 13 }}>{emailResponsable || "No definido"}</Text>
                    <View style={{ backgroundColor: '#4F46E5', alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, marginTop: 5 }}>
                        <Text style={{ color: 'white', fontSize: 10, fontWeight: 'bold' }}>ADMIN</Text>
                    </View>
                </View>
                <Text style={{ color: '#64748b', fontSize: 12, marginTop: 10, fontStyle: 'italic' }}>
                    * La gestión de múltiples usuarios estará disponible próximamente.
                </Text>

                {/* SECCIÓN 5: CONTEXTO IA */}
                <View style={[styles.sectionHeader, { marginTop: 35 }]}>
                    <Sparkles color="#f59e0b" size={24} />
                    <Text style={[styles.sectionTitle, { color: '#f59e0b' }]}>Contexto para IA</Text>
                </View>
                <Text style={{ color: '#94a3b8', fontSize: 12, marginBottom: 15 }}>
                    Esta información la usará la IA para generar ofertas de trabajo personalizadas.
                </Text>

                <Text style={styles.label}>Rubro / Industria</Text>
                <TouchableOpacity
                    style={styles.selectButton}
                    onPress={() => openModal('rubro')}
                >
                    <Text style={{ color: rubro ? '#111827' : '#64748b', fontSize: 15 }}>{rubro || "Seleccionar rubro..."}</Text>
                    <ChevronDown color="#94a3b8" size={20} />
                </TouchableOpacity>

                <Text style={styles.label}>Beneficios de la Empresa</Text>
                <TextInput
                    style={[styles.input, { height: 100, textAlignVertical: 'top', paddingTop: 10 }]}
                    value={beneficios}
                    onChangeText={setBeneficios}
                    multiline
                    placeholder="Ej: Seguro de salud, bonos trimestrales, home office..."
                    placeholderTextColor="#64748b"
                />


                <TouchableOpacity style={styles.saveButton} onPress={handleUpdate} disabled={loading}>
                    {loading ? <ActivityIndicator color="white" /> : (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                            <Save color="white" size={20} />
                            <Text style={styles.buttonText}>GUARDAR CAMBIOS</Text>
                        </View>
                    )}
                </TouchableOpacity>

                <View style={{ height: 50 }} />

            </ScrollView>

            {/* MODAL SELECTOR */}
            <Modal visible={modalVisible} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Seleccionar</Text>
                            <TouchableOpacity onPress={() => setModalVisible(false)}><X color="#111827" size={24} /></TouchableOpacity>
                        </View>
                        <FlatList
                            data={getListData()}
                            keyExtractor={(item) => item}
                            renderItem={({ item }) => (
                                <TouchableOpacity style={styles.optionItem} onPress={() => handleSelect(item)}>
                                    <Text style={{ color: '#111827', fontSize: 16 }}>{item}</Text>
                                    {(modalType === 'dep' && departamento === item) || 
                                     (modalType === 'prov' && provincia === item) || 
                                     (modalType === 'dist' && distrito === item) ||
                                     (modalType === 'rubro' && rubro === item) ? <View style={styles.selectedDot} /> : null}
                                </TouchableOpacity>
                            )}
                        />
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F9FAFB' },
    form: { padding: 25 },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 15, borderBottomWidth: 1, borderBottomColor: '#E5E7EB', paddingBottom: 10 },
    sectionTitle: { color: '#4F46E5', fontSize: 18, fontWeight: 'bold', marginLeft: 10 },
    inputGroup: { marginBottom: 5 },
    label: { color: '#374151', fontSize: 12, fontWeight: '700', marginBottom: 8, marginTop: 10 },
    input: { backgroundColor: '#FFFFFF', color: '#111827', padding: 15, borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB', fontSize: 15 },
    selectButton: { backgroundColor: '#FFFFFF', padding: 15, borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    saveButton: { backgroundColor: '#4F46E5', padding: 18, borderRadius: 12, alignItems: 'center', marginTop: 30, flexDirection: 'row', justifyContent: 'center' },
    buttonText: { color: 'white', fontWeight: 'bold', fontSize: 16 },

    // Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '70%', padding: 20 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#E5E7EB', paddingBottom: 15 },
    modalTitle: { color: '#111827', fontSize: 18, fontWeight: 'bold' },
    optionItem: { paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#F3F4F6', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    selectedDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#4F46E5' },

    // Logo Styles
    logoSection: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 20,
        backgroundColor: '#FFFFFF',
        padding: 15,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#E5E7EB'
    },
    logoWrapper: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#F3F4F6',
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative'
    },
    logoImage: {
        width: 80,
        height: 80,
        borderRadius: 40
    },
    logoPlaceholder: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#F3F4F6',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#E5E7EB',
        borderStyle: 'dashed'
    },
    cameraBtn: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        backgroundColor: '#4F46E5',
        width: 28,
        height: 28,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: 'white'
    },
    logoLabel: {
        fontSize: 14,
        fontWeight: '700',
        color: '#111827'
    },
    logoHint: {
        fontSize: 11,
        color: '#6B7280',
        marginTop: 4
    }
});
