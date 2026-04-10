import { useRouter } from 'expo-router';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { Building2, ChevronDown, MapPin, Save, Sparkles, User, UserCheck, X } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Modal, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { auth, db } from '../../../config/firebase';
import { getDepartamentos, getDistritos, getProvincias } from '../../../utils/geo-peru';

export default function CompanyProfile() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [initialLoading, setInitialLoading] = useState(true);

    // DATOS COMPAÑÍA
    const [ruc, setRuc] = useState('');
    const [razonSocial, setRazonSocial] = useState('');
    const [nombreComercial, setNombreComercial] = useState('');

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

                    // [FIX] Read from nested 'company' object
                    if (data.company) {
                        setRuc(data.company.ruc || '');
                        setRazonSocial(data.company.razonSocial || '');
                        setNombreComercial(data.company.name || ''); // 'name' is Commercial Name
                    } else {
                        // Fallback for legacy data (if any was created at root)
                        setRuc(data.ruc || '');
                        setRazonSocial(data.razonSocial || '');
                        setNombreComercial(data.nombreComercial || '');
                    }

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
        if (!ruc) missing.push("RUC");
        if (!razonSocial) missing.push("Razón Social");
        // Nombre Comercial can be optional if created empty
        // if (!nombreComercial) missing.push("Nombre Comercial");
        if (!departamento || !provincia || !distrito) missing.push("Ubicación Completa");
        if (!nombreResponsable) missing.push("Nombre Responsable");
        if (!emailResponsable) missing.push("Email Responsable");

        if (missing.length > 0) {
            return Alert.alert("Faltan Datos", "Por favor completa: \n- " + missing.join("\n- "));
        }

        setLoading(true);
        try {
            const user = auth.currentUser;
            if (!user) return;

            // [FIX] Update specific fields in nested objects using dot notation
            // This preserves other fields in 'company', 'location', 'responsible', etc.
            // AND fixes the schema mismatch.
            const updateData = {
                'company.ruc': ruc,
                'company.razonSocial': razonSocial,
                'company.name': nombreComercial,

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

                updatedAt: new Date().toISOString()
            };

            // [FIX] Use updateDoc to correctly handle dot notation for nested fields.
            // setDoc with { merge: true } and dot notation creates fields with dots in keys.
            // updateDoc parses "company.ruc" as nested field update.
            await updateDoc(doc(db, 'users_empresas', user.uid), updateData);
            console.log("✅ Perfil guardado en users_empresas");
            Alert.alert("¡Actualizado!", "Tus datos han sido guardados correctamente.");

        } catch (e: any) {
            Alert.alert("Error al Guardar", e.message);
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

    const getListData = () => {
        if (modalType === 'dep') return departamentosList;
        if (modalType === 'prov') return provinciasList;
        if (modalType === 'dist') return distritosList;
        return RUBROS_PERU;
    };

    if (initialLoading) {
        return (
            <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color="#3b82f6" />
                <Text style={{ color: 'white', marginTop: 10 }}>Cargando perfil...</Text>
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="#0f172a" />

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

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>RUC</Text>
                    <TextInput style={styles.input} value={ruc} onChangeText={setRuc} keyboardType="numeric" maxLength={11} editable={false} selectTextOnFocus={false} />
                    <Text style={{ color: '#64748b', fontSize: 10, marginTop: 2 }}>El RUC no se puede editar.</Text>
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Razón Social</Text>
                    <TextInput style={styles.input} value={razonSocial} onChangeText={setRazonSocial} />
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Nombre Comercial</Text>
                    <TextInput style={styles.input} value={nombreComercial} onChangeText={setNombreComercial} />
                </View>

                {/* SECCIÓN 2: UBICACIÓN */}
                <View style={[styles.sectionHeader, { marginTop: 25 }]}>
                    <MapPin color="#38bdf8" size={24} />
                    <Text style={styles.sectionTitle}>Ubicación</Text>
                </View>

                <Text style={styles.label}>Departamento</Text>
                <TouchableOpacity style={styles.selectButton} onPress={() => openModal('dep')}>
                    <Text style={{ color: 'white' }}>{departamento || "Seleccionar..."}</Text>
                    <ChevronDown color="#94a3b8" size={20} />
                </TouchableOpacity>

                <View style={{ flexDirection: 'row', gap: 10 }}>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.label}>Provincia</Text>
                        <TouchableOpacity style={styles.selectButton} onPress={() => openModal('prov')}>
                            <Text style={{ color: provincia ? 'white' : '#64748b' }}>{provincia || "Seleccionar..."}</Text>
                            <ChevronDown color="#94a3b8" size={20} />
                        </TouchableOpacity>
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.label}>Distrito</Text>
                        <TouchableOpacity style={styles.selectButton} onPress={() => openModal('dist')}>
                            <Text style={{ color: distrito ? 'white' : '#64748b' }}>{distrito || "Seleccionar..."}</Text>
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
                <View style={{ backgroundColor: '#1e293b', padding: 15, borderRadius: 10, borderWidth: 1, borderColor: '#334155' }}>
                    <Text style={{ color: 'white', fontWeight: 'bold' }}>Administrador Principal</Text>
                    <Text style={{ color: '#94a3b8', fontSize: 13 }}>{emailResponsable || "No definido"}</Text>
                    <View style={{ backgroundColor: '#3b82f6', alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, marginTop: 5 }}>
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
                    <Text style={{ color: rubro ? 'white' : '#64748b' }}>{rubro || "Seleccionar rubro..."}</Text>
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
                            <TouchableOpacity onPress={() => setModalVisible(false)}><X color="white" size={24} /></TouchableOpacity>
                        </View>
                        <FlatList
                            data={getListData()}
                            keyExtractor={(item) => item}
                            renderItem={({ item }) => (
                                <TouchableOpacity style={styles.optionItem} onPress={() => handleSelect(item)}>
                                    <Text style={{ color: 'white', fontSize: 16 }}>{item}</Text>
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
    container: { flex: 1, backgroundColor: '#0f172a' },
    form: { padding: 25 },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 15, borderBottomWidth: 1, borderBottomColor: '#334155', paddingBottom: 10 },
    sectionTitle: { color: '#38bdf8', fontSize: 18, fontWeight: 'bold', marginLeft: 10 },
    inputGroup: { marginBottom: 5 },
    label: { color: '#cbd5e1', fontSize: 12, fontWeight: 'bold', marginBottom: 8, marginTop: 10 },
    input: { backgroundColor: '#1e293b', color: 'white', padding: 15, borderRadius: 10, borderWidth: 1, borderColor: '#334155', fontSize: 15 },
    selectButton: { backgroundColor: '#1e293b', padding: 15, borderRadius: 10, borderWidth: 1, borderColor: '#334155', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    saveButton: { backgroundColor: '#3b82f6', padding: 18, borderRadius: 12, alignItems: 'center', marginTop: 30, flexDirection: 'row', justifyContent: 'center' },
    buttonText: { color: 'white', fontWeight: 'bold', fontSize: 16 },

    // Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: '#0f172a', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '70%', padding: 20 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#334155', paddingBottom: 15 },
    modalTitle: { color: 'white', fontSize: 18, fontWeight: 'bold' },
    optionItem: { paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#1e293b', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    selectedDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#3b82f6' }
});
