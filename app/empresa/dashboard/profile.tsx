import { DrawerActions } from '@react-navigation/native';
import { useNavigation, useRouter } from 'expo-router';
import { Briefcase, Building, Building2, ChevronDown, Mail, Map, Menu, Phone, Save, User, UserCheck, XCircle } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Modal, Platform, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { auth } from '../../../config/firebase';
import { getUserProfileFromCloud, saveUserProfileToCloud } from '../../../services/storage';

const DATA_PERU: any = {
    "Amazonas": { "Chachapoyas": ["Chachapoyas"], "Bagua": ["Bagua"] },
    "Áncash": { "Huaraz": ["Huaraz"], "Santa": ["Chimbote", "Nuevo Chimbote"] },
    "Apurímac": { "Abancay": ["Abancay"], "Andahuaylas": ["Andahuaylas"] },
    "Arequipa": { "Arequipa": ["Arequipa", "Yanahuara", "Cayma", "Cerro Colorado"], "Caylloma": ["Chivay"], "Islay": ["Mollendo"] },
    "Ayacucho": { "Huamanga": ["Ayacucho"] },
    "Cajamarca": { "Cajamarca": ["Cajamarca", "Los Baños del Inca"], "Jaén": ["Jaén"] },
    "Callao": { "Callao": ["Callao", "Bellavista", "Carmen de La Legua-Reynoso", "La Perla", "La Punta", "Ventanilla", "Mi Perú"] },
    "Cusco": { "Cusco": ["Cusco", "Wanchaq", "San Sebastian", "Santiago"], "Urubamba": ["Urubamba"] },
    "Huancavelica": { "Huancavelica": ["Huancavelica"] },
    "Huánuco": { "Huánuco": ["Huánuco"] },
    "Ica": { "Ica": ["Ica"], "Chincha": ["Chincha Alta"], "Pisco": ["Pisco"] },
    "Junín": { "Huancayo": ["Huancayo", "El Tambo"] },
    "La Libertad": { "Trujillo": ["Trujillo", "Victor Larco Herrera"] },
    "Lambayeque": { "Chiclayo": ["Chiclayo", "La Victoria"] },
    "Lima": {
        "Lima": [
            "Cercado de Lima", "Ancón", "Ate", "Barranco", "Breña", "Carabayllo", "Chaclacayo", "Chorrillos",
            "Cieneguilla", "Comas", "El Agustino", "Independencia", "Jesús María", "La Molina", "La Victoria",
            "Lince", "Los Olivos", "Lurigancho-Chosica", "Lurín", "Magdalena del Mar", "Miraflores", "Pachacámac",
            "Pucusana", "Pueblo Libre", "Puente Piedra", "Punta Hermosa", "Punta Negra", "Rímac", "San Bartolo",
            "San Borja", "San Isidro", "San Juan de Lurigancho", "San Juan de Miraflores", "San Luis",
            "San Martín de Porres", "San Miguel", "Santa Anita", "Santa María del Mar", "Santa Rosa",
            "Santiago de Surco", "Surquillo", "Villa El Salvador", "Villa María del Triunfo"
        ],
        "Cañete": ["San Vicente de Cañete", "Asia"],
        "Huaral": ["Huaral"],
        "Huaura": ["Huacho"]
    },
    "Loreto": { "Maynas": ["Iquitos"] },
    "Madre de Dios": { "Tambopata": ["Puerto Maldonado"] },
    "Moquegua": { "Mariscal Nieto": ["Moquegua"] },
    "Pasco": { "Pasco": ["Cerro de Pasco"] },
    "Piura": { "Piura": ["Piura", "Castilla"], "Sullana": ["Sullana"], "Talara": ["Pariñas"] },
    "Puno": { "Puno": ["Puno"], "San Román": ["Juliaca"] },
    "San Martín": { "Moyobamba": ["Moyobamba"], "San Martín": ["Tarapoto"] },
    "Tacna": { "Tacna": ["Tacna"] },
    "Tumbes": { "Tumbes": ["Tumbes"] },
    "Ucayali": { "Coronel Portillo": ["Pucallpa"] }
};

const DEPARTAMENTOS = Object.keys(DATA_PERU).sort();

export default function CompanyProfileScreen() {
    const router = useRouter();
    const navigation = useNavigation();
    const [loading, setLoading] = useState(false);
    const [initialLoad, setInitialLoad] = useState(true);

    // DATOS DE EMPRESA
    const [ruc, setRuc] = useState('');
    const [razonSocial, setRazonSocial] = useState('');
    const [nombreComercial, setNombreComercial] = useState('');

    // UBICACIÓN
    const [department, setDepartment] = useState('');
    const [province, setProvince] = useState('');
    const [district, setDistrict] = useState('');

    // DATOS DEL RESPONSABLE
    const [respName, setRespName] = useState('');
    const [respDni, setRespDni] = useState('');
    const [respPosition, setRespPosition] = useState('');
    const [respEmail, setRespEmail] = useState('');
    const [respPhone, setRespPhone] = useState('');

    const [modalType, setModalType] = useState<'none' | 'dept' | 'prov' | 'dist'>('none');

    useEffect(() => {
        loadProfile();
    }, []);

    const loadProfile = async () => {
        const user = auth.currentUser;
        if (!user) return;
        setRespEmail(user.email || '');

        try {
            const data = await getUserProfileFromCloud(user.uid);
            if (data) {
                setRuc(data.ruc || '');
                setRazonSocial(data.razonSocial || '');
                setNombreComercial(data.nombreComercial || '');
                setDepartment(data.department || '');
                setProvince(data.province || '');
                setDistrict(data.district || '');
                setRespName(data.respName || '');
                setRespDni(data.respDni || '');
                setRespPosition(data.respPosition || '');
                setRespPhone(data.respPhone || '');
            }
        } catch (e) {
            console.error(e);
        } finally {
            setInitialLoad(false);
        }
    };

    const validateAndSave = async () => {
        if (!ruc || !razonSocial || !respName || !respPhone || !respPosition || !department || !province || !district) {
            return Alert.alert("Campos Incompletos", "Por favor completa todos los campos obligatorios (*).");
        }
        if (ruc.length !== 11) {
            return Alert.alert("RUC Inválido", "El RUC debe tener 11 dígitos.");
        }

        setLoading(true);
        console.log("Iniciando guardado...");

        try {
            const user = auth.currentUser;
            if (!user) return Alert.alert("Error", "No hay sesión activa.");

            const locationString = `${district}, ${province}, ${department}`;

            const savePromise = saveUserProfileToCloud(user.uid, {
                ruc, razonSocial, nombreComercial,
                department, province, district, location: locationString,
                respName, respDni, respEmail, respPhone, respPosition,
                role: 'company',
                isProfileComplete: true
            });

            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error("Tiempo de espera agotado. Verifica tu conexión.")), 15000)
            );

            await Promise.race([savePromise, timeoutPromise]);
            console.log("Guardado OK");

            Alert.alert("¡Éxito!", "Perfil actualizado.", [
                { text: "Continuar", onPress: () => router.replace('/empresa/dashboard') }
            ]);

            if (Platform.OS === 'web') router.replace('/empresa/dashboard');

        } catch (error: any) {
            console.error(error);
            Alert.alert("Error", error.message || "Error desconocido");
        } finally {
            setLoading(false);
        }
    };

    const handleSelectDepartment = (d: string) => { setDepartment(d); setProvince(''); setDistrict(''); setModalType('none'); };
    const handleSelectProvince = (p: string) => { setProvince(p); setDistrict(''); setModalType('none'); };
    const handleSelectDistrict = (d: string) => { setDistrict(d); setModalType('none'); };

    if (initialLoad) {
        return <View style={styles.loadingContainer}><ActivityIndicator size="large" color="#3b82f6" /></View>;
    }

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 5 }}>
                    <TouchableOpacity onPress={() => navigation.dispatch(DrawerActions.openDrawer())} style={{ marginRight: 15 }}>
                        <Menu size={28} color="white" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Perfil de Empresa</Text>
                </View>
                <Text style={styles.headerSubtitle}>Completa tus datos para publicar perfiles</Text>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <Text style={styles.sectionTitle}>DATOS LEGALES & COMERCIALES</Text>
                <View style={styles.card}>
                    <InputGroup icon={<Building2 size={20} color="#64748b" />} placeholder="RUC (11 dígitos) *" value={ruc} onChange={setRuc} numeric maxLength={11} />
                    <InputGroup icon={<Building size={20} color="#64748b" />} placeholder="Razón Social *" value={razonSocial} onChange={setRazonSocial} />
                    <InputGroup icon={<Building size={20} color="#64748b" />} placeholder="Nombre Comercial" value={nombreComercial} onChange={setNombreComercial} />

                    <Text style={[styles.sectionTitle, { marginTop: 10, marginBottom: 10, fontSize: 10 }]}>UBICACIÓN *</Text>

                    <TouchableOpacity style={styles.dropdownButton} onPress={() => setModalType('dept')}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Map size={20} color="#64748b" style={{ marginRight: 15 }} />
                            <Text style={[styles.input, !department && { color: '#64748b' }]}>{department || "Departamento"}</Text>
                        </View>
                        <ChevronDown size={20} color="#64748b" />
                    </TouchableOpacity>

                    <View style={styles.row}>
                        <TouchableOpacity style={[styles.dropdownButton, { flex: 1, marginRight: 10 }, !department && { opacity: 0.5 }]} disabled={!department} onPress={() => setModalType('prov')}>
                            <Text style={[styles.inputText, !province && { color: '#64748b' }]}>{province || "Provincia"}</Text>
                            <ChevronDown size={16} color="#64748b" />
                        </TouchableOpacity>

                        <TouchableOpacity style={[styles.dropdownButton, { flex: 1 }, !province && { opacity: 0.5 }]} disabled={!province} onPress={() => setModalType('dist')}>
                            <Text style={[styles.inputText, !district && { color: '#64748b' }]}>{district || "Distrito"}</Text>
                            <ChevronDown size={16} color="#64748b" />
                        </TouchableOpacity>
                    </View>
                </View>

                <Text style={styles.sectionTitle}>DATOS DEL RESPONSABLE</Text>
                <View style={styles.card}>
                    <InputGroup icon={<User size={20} color="#64748b" />} placeholder="Nombre Completo *" value={respName} onChange={setRespName} />
                    <InputGroup icon={<Briefcase size={20} color="#64748b" />} placeholder="Cargo / Posición *" value={respPosition} onChange={setRespPosition} />
                    <InputGroup icon={<UserCheck size={20} color="#64748b" />} placeholder="DNI" value={respDni} onChange={setRespDni} numeric />
                    <View style={styles.inputGroup}>
                        <Mail size={20} color="#64748b" style={{ marginRight: 15 }} />
                        <TextInput style={[styles.input, { opacity: 0.7 }]} placeholder="Correo" placeholderTextColor="#64748b" value={respEmail} editable={false} />
                    </View>
                    <InputGroup icon={<Phone size={20} color="#64748b" />} placeholder="Celular / WhatsApp *" value={respPhone} onChange={setRespPhone} pad />
                </View>

                <TouchableOpacity style={styles.saveButton} onPress={validateAndSave} disabled={loading}>
                    {loading ? <ActivityIndicator color="white" /> : (
                        <>
                            <Save size={20} color="white" />
                            <Text style={styles.saveText}>GUARDAR Y CONTINUAR</Text>
                        </>
                    )}
                </TouchableOpacity>
            </ScrollView>

            <Modal visible={modalType !== 'none'} animationType="fade" transparent={true} onRequestClose={() => setModalType('none')}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Select</Text>
                            <TouchableOpacity onPress={() => setModalType('none')}><XCircle size={24} color="#ef4444" /></TouchableOpacity>
                        </View>
                        <FlatList
                            data={modalType === 'dept' ? DEPARTAMENTOS : modalType === 'prov' ? (DATA_PERU[department] ? Object.keys(DATA_PERU[department]) : []) : (DATA_PERU[department]?.[province] || [])}
                            renderItem={({ item }) => (
                                <TouchableOpacity style={styles.modalItem} onPress={() => {
                                    if (modalType === 'dept') handleSelectDepartment(item);
                                    if (modalType === 'prov') handleSelectProvince(item);
                                    if (modalType === 'dist') handleSelectDistrict(item);
                                }}>
                                    <Text style={styles.modalItemText}>{item}</Text>
                                    <ChevronDown size={16} color="#cbd5e1" style={{ transform: [{ rotate: '-90deg' }] }} />
                                </TouchableOpacity>
                            )}
                            keyExtractor={item => item}
                        />
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const InputGroup = ({ icon, placeholder, value, onChange, numeric, pad, maxLength }: any) => (
    <View style={styles.inputGroup}>
        <View style={{ marginRight: 15 }}>{icon}</View>
        <TextInput
            style={styles.input}
            placeholder={placeholder}
            placeholderTextColor="#64748b"
            value={value}
            onChangeText={onChange}
            keyboardType={numeric ? 'numeric' : pad ? 'phone-pad' : 'default'}
            maxLength={maxLength}
        />
    </View>
);

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0f172a' },
    loadingContainer: { flex: 1, backgroundColor: '#0f172a', justifyContent: 'center', alignItems: 'center' },
    header: { padding: 20, paddingTop: 40, borderBottomWidth: 1, borderBottomColor: '#1e293b' },
    headerTitle: { fontSize: 24, fontWeight: 'bold', color: 'white' },
    headerSubtitle: { fontSize: 14, color: '#94a3b8', marginTop: 5 },
    content: { padding: 20 },
    sectionTitle: { color: '#38bdf8', fontSize: 12, fontWeight: 'bold', marginBottom: 10, marginTop: 10, letterSpacing: 1 },
    card: { backgroundColor: '#1e293b', borderRadius: 16, padding: 15, marginBottom: 20, borderWidth: 1, borderColor: '#334155' },
    inputGroup: { flexDirection: 'row', alignItems: 'center', marginBottom: 15, borderBottomWidth: 1, borderBottomColor: '#334155', paddingBottom: 5 },
    input: { flex: 1, color: 'white', fontSize: 16, height: 40 },
    inputText: { color: 'white', fontSize: 14 },
    row: { flexDirection: 'row', justifyContent: 'space-between' },
    dropdownButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#1e293b', borderRadius: 12, borderWidth: 1, borderColor: '#334155', marginBottom: 10, height: 50, paddingHorizontal: 15 },
    saveButton: { backgroundColor: '#3b82f6', flexDirection: 'row', height: 55, borderRadius: 12, alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 10, marginBottom: 40 },
    saveText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', padding: 20 },
    modalContent: { backgroundColor: 'white', borderRadius: 20, padding: 20, maxHeight: '70%', minHeight: 300 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', paddingBottom: 10 },
    modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#0f172a' },
    modalItem: { paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    modalItemText: { fontSize: 16, color: '#334155' }
});
