import * as DocumentPicker from 'expo-document-picker';
import { Briefcase, Calendar, CheckCircle2, ChevronDown, DollarSign, Globe, Mail, Map, Phone, Trash2, UploadCloud, User, XCircle } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Modal, Platform, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import AppHeader from '../../components/AppHeader';
import { auth } from '../../config/firebase';
import { getUserProfileFromCloud, saveUserProfileToCloud } from '../../services/storage';
import { extractTextFromPDF, generateProfileOptimization } from '../../utils/gemini';

// DATOS DE PERÚ (Abreviados para el ejemplo, usa tu lista completa si la tienes a mano)
const DATA_PERU: any = {
    "Amazonas": {
        "Chachapoyas": ["Chachapoyas", "Asipulo", "Conila", "Huancas", "La Jalca", "Leimebamba", "Levanto", "Magdalena", "Mariscal Castilla", "Molinopampa", "Montevideo"],
        "Bagua": ["Bagua", "Aramango", "Copallin", "El Parco", "Imaza", "La Peca"]
    },
    "Áncash": {
        "Huaraz": ["Huaraz", "Cochabamba", "Colcabamba", "Huanchay", "Independencia", "Jangas", "La Libertad", "Olleros", "Pampas", "Pariacoto", "Pira", "Tarica"],
        "Santa": ["Chimbote", "Caceres del Peru", "Coishco", "Macate", "Moro", "Nepeña", "Nuevo Chimbote", "Samanco", "Santa"]
    },
    "Apurímac": {
        "Abancay": ["Abancay", "Chacoche", "Circa", "Curahuasi", "Huanipaca", "Lambrama", "Pichirhua", "San Pedro de Cachora", "Tamburco"],
        "Andahuaylas": ["Andahuaylas", "Andarapa", "Chiara", "Huancarama", "Huancaray", "Pacucha", "San Jeronimo", "Santa Maria de Chicmo", "Talavera"]
    },
    "Arequipa": {
        "Arequipa": ["Arequipa", "Alto Selva Alegre", "Cayma", "Cerro Colorado", "Characato", "Chiguata", "Jacobo Hunter", "Jose Luis Bustamante Y Rivero", "La Joya", "Mariano Melgar", "Miraflores", "Mollebaya", "Paucarpata", "Pocsi", "Polobaya", "Quequeña", "Sabandia", "Sachaca", "San Juan de Siguas", "San Juan de Tarucani", "Santa Isabel de Siguas", "Santa Rita de Siguas", "Socabaya", "Tiabaya", "Uchumayo", "Vitor", "Yanahuara", "Yarabamba", "Yura"],
        "Caylloma": ["Chivay", "Achoma", "Cabanaconde", "Callalli", "Caylloma", "Coporaque", "Huambo", "Huanca", "Ichupampa", "Lari", "Lluta", "Maca", "Madrigal", "Majes", "San Antonio de Chuca", "Sibayo", "Tapay", "Tisco", "Tuti", "Yanque"],
        "Islay": ["Mollendo", "Cocachacra", "Dean Valdivia", "Islay", "Mejia", "Punta de Bombon"]
    },
    "Ayacucho": {
        "Huamanga": ["Ayacucho", "Acocro", "Acos Vinchos", "Carmen Alto", "Chiara", "Jesus Nazareno", "Ocros", "Pacaycasa", "Quinua", "San Jose de Ticllas", "San Juan Bautista", "Santiago de Pischa", "Socos", "Tambillo", "Vinchos", "Andrés Avelino Cáceres Dorregaray"]
    },
    "Cajamarca": {
        "Cajamarca": ["Cajamarca", "Asuncion", "Chetilla", "Cospan", "Encañada", "Jesus", "Llacanora", "Los Baños del Inca", "Magdalena", "Matara", "Namora", "San Juan"],
        "Jaén": ["Jaén", "Bellavista", "Chontali", "Colasay", "Huabal", "Las Pirias", "Pomahuaca", "Pucara", "Sallique", "San Felipe", "San Jose del Alto", "Santa Rosa"]
    },
    "Callao": {
        "Callao": ["Callao", "Bellavista", "Carmen de La Legua-Reynoso", "La Perla", "La Punta", "Ventanilla", "Mi Perú"]
    },
    "Cusco": {
        "Cusco": ["Cusco", "Ccorca", "Poroy", "San Jeronimo", "San Sebastian", "Santiago", "Saylla", "Wanchaq"],
        "Urubamba": ["Urubamba", "Chinchero", "Huayllabamba", "Machupicchu", "Maras", "Ollantaytambo", "Yucay"]
    },
    "Huancavelica": {
        "Huancavelica": ["Huancavelica", "Acobambilla", "Acoria", "Conayca", "Cuenca", "Huachocolpa", "Huayllahuara", "Izcuchaca", "Laria", "Manta", "Mariscal Caceres", "Moya", "Nuevo Occoro", "Palca", "Pilchaca", "Vilca", "Yauli", "Ascensión"]
    },
    "Huánuco": {
        "Huánuco": ["Huánuco", "Amarilis", "Chinchao", "Churubamba", "Margos", "Pillco Marca", "Quisqui", "San Francisco de Cayran", "San Pedro de Chaulan", "Santa Maria del Valle", "Yarumayo"]
    },
    "Ica": {
        "Ica": ["Ica", "La Tinguiña", "Los Aquijes", "Ocucaje", "Pachacutec", "Parcona", "Pueblo Nuevo", "Salas", "San Jose de Los Molinos", "San Juan Bautista", "Santiago", "Subtanjalla", "Tate", "Yauca del Rosario"],
        "Chincha": ["Chincha Alta", "Alto Laran", "Chavin", "Chincha Baja", "El Carmen", "Grocio Prado", "Pueblo Nuevo", "San Juan de Yanac", "San Pedro de Huacarpana", "Sunampe", "Tambo de Mora"],
        "Pisco": ["Pisco", "Huancano", "Humay", "Independencia", "Paracas", "San Andres", "San Clemente", "Tupac Amaru Inca"]
    },
    "Junín": {
        "Huancayo": ["Huancayo", "Carhuacallanga", "Chacapampa", "Chicche", "Chilca", "Chongos Alto", "Chupuro", "Colca", "Cullhuas", "El Tambo", "Huacrapuquio", "Hualhuas", "Huancan", "Huasicancha", "Huayucachi", "Ingenio", "Pariahuanca", "Pilcomayo", "Pucara", "Quichuay", "Quilcas", "San Agustin", "San Jeronimo de Tunan", "Saño", "Sapallanga", "Sicaya", "Santo Domingo de Acobamba", "Viques"]
    },
    "La Libertad": {
        "Trujillo": ["Trujillo", "El Porvenir", "Florencia de Mora", "Huanchaco", "La Esperanza", "Laredo", "Moche", "Poroto", "Salaverry", "Simbal", "Victor Larco Herrera"]
    },
    "Lambayeque": {
        "Chiclayo": ["Chiclayo", "Chongoyape", "Eten", "Eten Puerto", "Jose Leonardo Ortiz", "La Victoria", "Lagunas", "Monsefu", "Nueva Arica", "Oyotun", "Picsi", "Pimentel", "Pomalca", "Pucala", "Reque", "Santa Rosa", "Saña", "Tumán"]
    },
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
        "Barranca": ["Barranca", "Paramonga", "Pativilca", "Supe", "Supe Puerto"],
        "Cajatambo": ["Cajatambo", "Copa", "Gorgor", "Huancapon", "Manas"],
        "Canta": ["Canta", "Arahuay", "Huamantanga", "Huaros", "Lachaqui", "San Buenaventura", "Santa Rosa de Quives"],
        "Cañete": ["San Vicente de Cañete", "Asia", "Calango", "Cerro Azul", "Chilca", "Coayllo", "Imperial", "Lunahuaná", "Mala", "Nuevo Imperial", "Pacarán", "Quilmaná", "San Antonio", "San Luis", "Santa Cruz de Flores", "Zúñiga"],
        "Huaral": ["Huaral", "Atavillos Alto", "Atavillos Bajo", "Aucallama", "Chancay", "Ihuari", "Lampian", "Pacaraos", "San Miguel de Acos", "Santa Cruz de Andamarca", "Sumbilca", "Veintisiete de Noviembre"],
        "Huarochirí": ["Matucana", "Antioquia", "Callahuanca", "Carampoma", "Chicla", "Cuenca", "Huachupampa", "Huanza", "Huarochiri", "Lahuaytambo", "Langa", "Laraos", "Mariatana", "Ricardo Palma", "San Andres de Tupicocha", "San Antonio", "San Bartolome", "San Damian", "San Juan de Iris", "San Juan de Tantaranche", "San Lorenzo de Quinti", "San Mateo", "San Mateo de Otao", "San Pedro de Casta", "San Pedro de Huancayre", "Sangallaya", "Santa Cruz de Cocachacra", "Santa Eulalia", "Santiago de Anchucaya", "Santiago de Tuna", "Santo Domingo de Los Olleros", "Surco"],
        "Huaura": ["Huacho", "Ambar", "Caleta de Carquin", "Checras", "Hualmay", "Huaura", "Leoncio Prado", "Paccho", "Santa Leonor", "Santa Maria", "Sayan", "Vegueta"],
        "Oyón": ["Oyón", "Andajes", "Caujul", "Cochamarca", "Navan", "Pachangara"],
        "Yauyos": ["Yauyos", "Alis", "Ayauca", "Ayaviri", "Azángaro", "Cacra", "Carania", "Catahuasi", "Chocos", "Cochas", "Colonia", "Hongos", "Huampara", "Huancaya", "Huangascar", "Huantan", "Huañec", "Laraos", "Lincha", "Madean", "Miraflores", "Omas", "Putinza", "Quinches", "Quinocay", "San Joaquin", "San Pedro de Pilas", "Tanta", "Tauripampa", "Tomas", "Tupe", "Viñac", "Vitis"]
    },
    "Loreto": {
        "Maynas": ["Iquitos", "Alto Nanay", "Fernando Lores", "Indiana", "Las Amazonas", "Mazan", "Napo", "Punchana", "Putumayo", "Torres Causana", "Belen", "San Juan Bautista"]
    },
    "Madre de Dios": {
        "Tambopata": ["Tambopata", "Inambari", "Las Piedras", "Laberinto"]
    },
    "Moquegua": {
        "Mariscal Nieto": ["Moquegua", "Carumas", "Cuchumbaya", "Samegua", "San Cristobal", "Torata"]
    },
    "Pasco": {
        "Pasco": ["Chaupimarca", "Huachon", "Huariaca", "Huayllay", "Ninacaca", "Pallanchacra", "Paucartambo", "San Francisco de Asis de Yarusyacan", "Simon Bolivar", "Ticlacayán", "Tinyahuarco", "Vicco", "Yanacancha"]
    },
    "Piura": {
        "Piura": ["Piura", "Castilla", "Catacaos", "Cura Mori", "El Tallan", "La Arena", "La Union", "Las Lomas", "Tambo Grande", "Veintiseis de Octubre"],
        "Sullana": ["Sullana", "Bellavista", "Ignacio Escudero", "Lancones", "Marcavelica", "Miguel Checa", "Querecotillo", "Salitral"],
        "Talara": ["Pariñas", "El Alto", "La Brea", "Lobitos", "Los Organos", "Mancora"]
    },
    "Puno": {
        "Puno": ["Puno", "Acora", "Amantani", "Atuncolla", "Capachica", "Chucuito", "Coata", "Huata", "Mañazo", "Paucarcolla", "Pichacani", "Plateria", "San Antonio", "Tiquillaca", "Vilque"]
    },
    "San Martín": {
        "Moyobamba": ["Moyobamba", "Calzada", "Habana", "Jepelacio", "Soritor", "Yantalo"],
        "San Martín": ["Tarapoto", "Alberto Leveau", "Cacatachi", "Chazuta", "Chipurana", "El Porvenir", "Huimbayoc", "Juan Guerra", "La Banda de Shilcayo", "Morales", "Papaplaya", "San Antonio", "Sauce", "Shapaja"]
    },
    "Tacna": {
        "Tacna": ["Tacna", "Alto de La Alianza", "Calana", "Ciudad Nueva", "Inclan", "Pachia", "Palca", "Pocollay", "Sama", "Coronel Gregorio Albarracin Lanchipa", "La Yarada Los Palos"]
    },
    "Tumbes": {
        "Tumbes": ["Tumbes", "Corrales", "La Cruz", "Pampas de Hospital", "San Jacinto", "San Juan de La Virgen"]
    },
    "Ucayali": {
        "Coronel Portillo": ["Calleria", "Campoverde", "Iparia", "Masisea", "Yarinacocha", "Nueva Requena", "Manantay"]
    }

    // ... Puedes pegar tu lista completa aquí
};
const DEPARTAMENTOS = Object.keys(DATA_PERU).sort();
const DAYS = Array.from({ length: 31 }, (_, i) => (i + 1).toString().padStart(2, '0'));
const MONTHS = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const YEARS = Array.from({ length: 60 }, (_, i) => (new Date().getFullYear() - 18 - i).toString());

export default function ProfileScreen() {
    const [fullName, setFullName] = useState('');
    const [birthDate, setBirthDate] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [country] = useState('Perú');
    const [department, setDepartment] = useState('');
    const [province, setProvince] = useState('');
    const [district, setDistrict] = useState('');
    const [salary, setSalary] = useState('');
    const [modality, setModality] = useState('Indistinto');
    const [interests, setInterests] = useState('');
    const [bio, setBio] = useState('');
    const [fileName, setFileName] = useState('');
    const [hasFile, setHasFile] = useState(false);
    const [extracting, setExtracting] = useState(false);
    const [saving, setSaving] = useState(false); // Estado de guardado

    // Estados para optimización de perfil
    const [optimizingSuggestions, setOptimizingSuggestions] = useState(false);
    const [profileSuggestions, setProfileSuggestions] = useState<any>(null);

    const [modalType, setModalType] = useState<'none' | 'dept' | 'prov' | 'dist' | 'date' | 'suggestions'>('none');
    const [tempDay, setTempDay] = useState(DAYS[0]);
    const [tempMonth, setTempMonth] = useState(MONTHS[0]);
    const [tempYear, setTempYear] = useState(YEARS[10]);

    useEffect(() => { loadProfile(); }, []);

    const loadProfile = async () => {
        const user = auth.currentUser;
        if (!user) return;
        if (!email) setEmail(user.email || '');

        try {
            const data = await getUserProfileFromCloud(user.uid);
            if (data) {
                setFullName(data.fullName || '');
                setBirthDate(data.birthDate || '');
                setEmail(data.email || user.email || '');
                setPhone(data.phone || '');
                setDepartment(data.department || '');
                setProvince(data.province || '');
                setDistrict(data.district || '');
                setSalary(data.salary || '');
                setModality(data.modality || 'Remoto');
                setInterests(data.interests || '');
                setBio(data.bio || '');
                if (data.fileName) { setFileName(data.fileName); setHasFile(true); }
            }
        } catch (e) { console.error(e); }
    };

    const showAlert = (title: string, msg: string) => {
        if (Platform.OS === 'web') window.alert(`${title}\n${msg}`);
        else Alert.alert(title, msg);
    };

    const saveProfile = async () => {
        if (!fullName) return showAlert("Falta Nombre", "Por favor ingresa tu nombre.");

        const user = auth.currentUser;
        if (!user) return showAlert("Error", "No hay sesión activa.");

        setSaving(true);

        try {
            // Timeout de seguridad: Si en 10s no guarda, lanzamos error
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error("Tiempo de espera agotado. Revisa tu conexión o las reglas de Firebase.")), 10000)
            );

            const savePromise = async () => {
                const contextForAI = `CANDIDATO: ${fullName}\nEDAD: ${birthDate}\nUBICACIÓN: ${district}, ${department}\nMODALIDAD: ${modality}\nSALARIO: ${salary}\nINTERESES: ${interests}\nEXPERIENCIA: ${bio}`;

                await saveUserProfileToCloud(user.uid, {
                    fullName, birthDate, email, phone, country, department, province, district,
                    salary, modality, interests, bio, fileName, contextForAI
                });
            };

            // Corremos el guardado contra el reloj
            await Promise.race([savePromise(), timeoutPromise]);

            showAlert("✅ Guardado", "Perfil actualizado en la nube.");
        } catch (e: any) {
            showAlert("Error al Guardar", e.message);
        } finally {
            setSaving(false);
        }
    };

    const pickDocument = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true });
            if (result.canceled) return;
            const file = result.assets[0];
            setFileName(file.name);
            setHasFile(true);
            setExtracting(true);
            try {
                const webFile = Platform.OS === 'web' ? (file as any).file : undefined;
                const text = await extractTextFromPDF(file.uri, webFile);
                setBio(text);
                showAlert("✨ Éxito", "CV leído correctamente.");
            } catch (e: any) { showAlert("Error IA", e.message); }
            finally { setExtracting(false); }
        } catch (err: any) { showAlert("Error", err.message); setExtracting(false); }
    };

    const optimizeProfile = async () => {
        if (!bio || bio.length < 50) {
            return showAlert("Falta CV", "Primero debes subir y extraer tu CV para optimizar tu perfil.");
        }

        setOptimizingSuggestions(true);
        try {
            const userInfo = `Nombre: ${fullName}, Ubicación: ${district}, ${department}, Intereses: ${interests}`;
            const suggestions = await generateProfileOptimization(bio, userInfo);
            setProfileSuggestions(suggestions);
            setModalType('suggestions');
        } catch (e: any) {
            showAlert("Error", "No se pudieron generar sugerencias: " + e.message);
        } finally {
            setOptimizingSuggestions(false);
        }
    };

    const handleSelectDepartment = (d: string) => { setDepartment(d); setProvince(''); setDistrict(''); setModalType('none'); };
    const handleSelectProvince = (p: string) => { setProvince(p); setDistrict(''); setModalType('none'); };
    const handleSelectDistrict = (d: string) => { setDistrict(d); setModalType('none'); };
    const confirmDate = () => { setBirthDate(`${tempDay} de ${tempMonth} de ${tempYear}`); setModalType('none'); };

    return (
        <SafeAreaView style={styles.container}>
            <AppHeader title="MI PERFIL" />
            <ScrollView contentContainerStyle={styles.scroll}>
                <View style={styles.headerRow}>
                    <Text style={styles.header}>Mi Perfil</Text>
                    <TouchableOpacity onPress={() => { setBio(''); setFileName(''); }} style={styles.trashButton}>
                        <Trash2 color="#ef4444" size={20} />
                    </TouchableOpacity>
                </View>

                {/* 1. PERSONAL (UI ARREGLADA) */}
                <Text style={styles.sectionTitle}>INFORMACIÓN PERSONAL</Text>
                <View style={styles.formSection}>
                    <View style={styles.inputGroup}>
                        <User size={18} color="#64748b" style={styles.inputIcon} />
                        <TextInput style={styles.inputField} placeholder="Nombre Completo" placeholderTextColor="#64748b" value={fullName} onChangeText={setFullName} />
                    </View>

                    {/* BOTÓN FECHA (Sin styles.input para evitar superposición) */}
                    <TouchableOpacity style={styles.dropdownButton} onPress={() => setModalType('date')}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Calendar size={18} color="#64748b" style={styles.inputIcon} />
                            <Text style={[styles.inputText, !birthDate && { color: '#64748b' }]}>
                                {birthDate || "Fecha de Nacimiento"}
                            </Text>
                        </View>
                        <ChevronDown size={20} color="#64748b" />
                    </TouchableOpacity>

                    <View style={styles.row}>
                        <View style={[styles.inputGroup, { flex: 1, marginRight: 10 }]}>
                            <Mail size={18} color="#64748b" style={styles.inputIcon} />
                            <TextInput style={styles.inputField} placeholder="Correo" placeholderTextColor="#64748b" value={email} editable={false} />
                        </View>
                        <View style={[styles.inputGroup, { flex: 1 }]}>
                            <Phone size={18} color="#64748b" style={styles.inputIcon} />
                            <TextInput style={styles.inputField} placeholder="Celular" placeholderTextColor="#64748b" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
                        </View>
                    </View>
                </View>

                {/* 2. UBICACIÓN (UI ARREGLADA) */}
                <Text style={styles.sectionTitle}>UBICACIÓN</Text>
                <View style={styles.formSection}>
                    <View style={[styles.inputGroup, { backgroundColor: '#1e293b', opacity: 0.7 }]}>
                        <Globe size={18} color="#38bdf8" style={styles.inputIcon} />
                        <Text style={[styles.inputText, { paddingVertical: 12 }]}>{country}</Text>
                        <CheckCircle2 size={16} color="#10b981" style={{ marginLeft: 'auto' }} />
                    </View>

                    <TouchableOpacity style={styles.dropdownButton} onPress={() => setModalType('dept')}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Map size={18} color="#64748b" style={styles.inputIcon} />
                            <Text style={[styles.inputText, !department && { color: '#64748b' }]}>
                                {department || "Departamento"}
                            </Text>
                        </View>
                        <ChevronDown size={20} color="#64748b" />
                    </TouchableOpacity>

                    <View style={styles.row}>
                        <TouchableOpacity
                            style={[styles.dropdownButton, { flex: 1, marginRight: 10 }, !department && { opacity: 0.5 }]}
                            onPress={() => department && setModalType('prov')}
                            disabled={!department}
                        >
                            <Text style={[styles.inputText, !province && { color: '#64748b' }]}>{province || "Provincia"}</Text>
                            <ChevronDown size={16} color="#64748b" />
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.dropdownButton, { flex: 1 }, !province && { opacity: 0.5 }]}
                            onPress={() => province && setModalType('dist')}
                            disabled={!province}
                        >
                            <Text style={[styles.inputText, !district && { color: '#64748b' }]}>{district || "Distrito"}</Text>
                            <ChevronDown size={16} color="#64748b" />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* 3. EXPECTATIVAS */}
                <Text style={styles.sectionTitle}>EXPECTATIVAS</Text>
                <View style={styles.formSection}>
                    <View style={styles.inputGroup}>
                        <DollarSign size={18} color="#10b981" style={styles.inputIcon} />
                        <TextInput style={styles.inputField} placeholder="Salario Mensual (S/.)" placeholderTextColor="#64748b" value={salary} onChangeText={setSalary} keyboardType="numeric" />
                    </View>
                    <Text style={styles.sectionTitle}>MODALIDAD DE TRABAJO</Text>
                    <View style={styles.modalityContainer}>
                        {['Indistinto', 'Presencial', 'Híbrido', 'Remoto'].map(m => (
                            <TouchableOpacity key={m} style={[styles.modalityButton, modality === m && { backgroundColor: '#3b82f6' }]} onPress={() => setModality(m)}>
                                <Text style={{ color: 'white', fontSize: 12, fontWeight: 'bold' }}>{m}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                    <Text style={styles.sectionTitle}>¿QUÉ TIPO DE TRABAJO BUSCAS? (opcional)</Text>
                    <View style={styles.inputGroupArea}>
                        <TextInput style={[styles.inputField, { height: 80, textAlignVertical: 'top' }]} multiline value={interests} onChangeText={setInterests} placeholder="Intereses..." placeholderTextColor="#64748b" />
                    </View>
                </View>

                {/* 4. CV */}
                <Text style={styles.sectionTitle}>HOJA DE VIDA</Text>
                <TouchableOpacity style={[styles.uploadCard, hasFile && { borderColor: '#10b981' }]} onPress={extracting ? null : pickDocument}>
                    {extracting ? <ActivityIndicator color="#3b82f6" /> : <UploadCloud size={24} color={hasFile ? "#10b981" : "#3b82f6"} />}
                    <View style={{ marginLeft: 15 }}>
                        <Text style={styles.uploadTitle}>{extracting ? "Procesando..." : hasFile ? "CV Cargado" : "Subir PDF"}</Text>
                    </View>
                </TouchableOpacity>
                <View style={styles.inputGroupArea}>
                    <Briefcase size={18} color="#64748b" style={[styles.inputIcon, { marginTop: 12 }]} />
                    <TextInput style={[styles.inputField, { height: 120, textAlignVertical: 'top' }]} multiline value={bio} onChangeText={setBio} placeholder="Resumen..." placeholderTextColor="#64748b" />
                </View>

                <TouchableOpacity
                    style={styles.saveButton}
                    onPress={saveProfile} // Assuming saveProfile is the correct handler, as handleSave is not defined in the original code.
                >
                    {saving ? <ActivityIndicator color="white" /> : <Text style={styles.saveText}>Guardar Cambios</Text>}
                </TouchableOpacity>

                {/* --- SUPPORT SECTION --- */}
                <View style={{ alignItems: 'center', marginBottom: 40, gap: 5 }}>
                    <Text style={{ color: '#64748b', fontSize: 13 }}>¿Necesitas ayuda o tienes dudas?</Text>
                    <TouchableOpacity
                        onPress={() => {
                            if (Platform.OS === 'web') {
                                window.open('mailto:hola@veritlyapp.com');
                            }

                            // SECRET DOOR LOGIC 🕵️‍♂️
                            setSecretCount(prev => {
                                const newCount = prev + 1;
                                if (newCount >= 5) {
                                    if (auth.currentUser?.email === 'test+1@gmail.com' || auth.currentUser?.email === 'oscar@veritlyapp.com') {
                                        router.push('/admin/dashboard');
                                        return 0;
                                    } else {
                                        Alert.alert("Acceso Denegado", "No tienes permisos de Super Admin.");
                                        return 0;
                                    }
                                }
                                return newCount;
                            });
                        }}
                        activeOpacity={0.7}
                    >
                        <Text style={{ color: '#3b82f6', fontWeight: '600' }}>Consultas: hola@veritlyapp.com</Text>
                    </TouchableOpacity>
                </View>
                <View style={{ height: 40 }} />
            </ScrollView>

            {/* MODALES (Simplificados) */}
            <Modal visible={modalType !== 'none'} animationType="fade" transparent={true}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Seleccionar</Text>
                            <TouchableOpacity onPress={() => setModalType('none')}><XCircle size={24} color="#ef4444" /></TouchableOpacity>
                        </View>
                        {modalType === 'date' ? (
                            <View style={{ alignItems: 'center' }}>
                                {/* (Lógica de fecha igual que antes, funcional) */}
                                <View style={{ flexDirection: 'row', gap: 5, marginBottom: 20 }}>
                                    <View style={styles.dateColumn}><Text style={styles.dateLabel}>Día</Text><ScrollView>{DAYS.map(d => <TouchableOpacity key={d} onPress={() => setTempDay(d)} style={[styles.dateItem, tempDay === d && { backgroundColor: '#3b82f6' }]}><Text style={{ color: tempDay === d ? 'white' : '#333' }}>{d}</Text></TouchableOpacity>)}</ScrollView></View>
                                    <View style={[styles.dateColumn, { flex: 2 }]}><Text style={styles.dateLabel}>Mes</Text><ScrollView>{MONTHS.map(m => <TouchableOpacity key={m} onPress={() => setTempMonth(m)} style={[styles.dateItem, tempMonth === m && { backgroundColor: '#3b82f6' }]}><Text style={{ color: tempMonth === m ? 'white' : '#333' }}>{m}</Text></TouchableOpacity>)}</ScrollView></View>
                                    <View style={[styles.dateColumn, { flex: 1.5 }]}><Text style={styles.dateLabel}>Año</Text><ScrollView>{YEARS.map(y => <TouchableOpacity key={y} onPress={() => setTempYear(y)} style={[styles.dateItem, tempYear === y && { backgroundColor: '#3b82f6' }]}><Text style={{ color: tempYear === y ? 'white' : '#333' }}>{y}</Text></TouchableOpacity>)}</ScrollView></View>
                                </View>
                                <TouchableOpacity style={styles.modalConfirmButton} onPress={confirmDate}><Text style={{ color: 'white', fontWeight: 'bold' }}>Confirmar</Text></TouchableOpacity>
                            </View>
                        ) : (
                            <FlatList
                                data={
                                    modalType === 'dept' ? DEPARTAMENTOS :
                                        modalType === 'prov' ? (DATA_PERU[department] ? Object.keys(DATA_PERU[department]) : []) :
                                            modalType === 'dist' ? (DATA_PERU[department]?.[province] || []) : []
                                }
                                renderItem={({ item }) => (
                                    <TouchableOpacity style={styles.modalItem} onPress={() => {
                                        if (modalType === 'dept') handleSelectDepartment(item);
                                        if (modalType === 'prov') handleSelectProvince(item);
                                        if (modalType === 'dist') handleSelectDistrict(item);
                                    }}><Text style={styles.modalItemText}>{item}</Text></TouchableOpacity>
                                )}
                                keyExtractor={(item) => item}
                            />
                        )}
                    </View>
                </View>
            </Modal>
        </SafeAreaView >
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0f172a' },
    scroll: { padding: 20 },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
    header: { fontSize: 28, fontWeight: 'bold', color: 'white' },
    subHeader: { fontSize: 14, color: '#94a3b8' },
    trashButton: { padding: 10, backgroundColor: 'rgba(239, 68, 68, 0.1)', borderRadius: 12 },
    sectionTitle: { color: '#38bdf8', fontSize: 12, fontWeight: 'bold', marginBottom: 10, marginTop: 15 },
    formSection: { marginBottom: 10 },
    row: { flexDirection: 'row', justifyContent: 'space-between' },

    // ESTILOS DE INPUT CORREGIDOS (Sin superposición)
    inputGroup: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1e293b', borderRadius: 12, borderWidth: 1, borderColor: '#334155', marginBottom: 10, height: 50, paddingHorizontal: 10 },
    inputGroupArea: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: '#1e293b', borderRadius: 12, borderWidth: 1, borderColor: '#334155', marginBottom: 10, height: 120, paddingHorizontal: 10 },

    inputIcon: { marginRight: 10 },
    // Usamos inputField para TextInput y inputText para Text, con flex:1
    inputField: { flex: 1, color: 'white', fontSize: 14, height: '100%' },
    inputText: { flex: 1, color: 'white', fontSize: 14 },

    dropdownButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#1e293b', borderRadius: 12, borderWidth: 1, borderColor: '#334155', marginBottom: 10, height: 50, paddingHorizontal: 15 },

    modalityContainer: { flexDirection: 'row', backgroundColor: '#1e293b', borderRadius: 12, padding: 4, borderWidth: 1, borderColor: '#334155', marginBottom: 10 },
    modalityButton: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
    uploadCard: { backgroundColor: '#1e293b', borderRadius: 16, padding: 15, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#334155', marginBottom: 15, borderStyle: 'dashed' },
    uploadTitle: { color: 'white', fontWeight: 'bold', fontSize: 14 },
    uploadSubtitle: { color: '#64748b', fontSize: 12 },
    saveButton: { backgroundColor: '#3b82f6', padding: 18, borderRadius: 12, alignItems: 'center', marginTop: 10, marginBottom: 40 },
    saveText: { color: 'white', fontWeight: 'bold', fontSize: 16 },

    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', padding: 20 },
    modalContent: { backgroundColor: 'white', borderRadius: 20, padding: 20, maxHeight: '70%', minHeight: 300 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', paddingBottom: 10 },
    modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#0f172a' },
    modalItem: { paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    modalItemText: { fontSize: 16, color: '#334155' },
    dateColumn: { flex: 1, height: 200, backgroundColor: '#f8fafc', borderRadius: 8, overflow: 'hidden' },
    dateScroll: { flex: 1 },
    dateLabel: { textAlign: 'center', fontSize: 10, color: '#64748b', paddingVertical: 5, fontWeight: 'bold', backgroundColor: '#e2e8f0' },
    dateItem: { paddingVertical: 10, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
    dateItemSelected: { backgroundColor: '#3b82f6' },
    dateText: { fontSize: 14, color: '#334155' },
    modalConfirmButton: { backgroundColor: '#3b82f6', paddingVertical: 12, paddingHorizontal: 30, borderRadius: 25, marginTop: 20 }
});