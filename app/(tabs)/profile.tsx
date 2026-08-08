import { useRouter } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { Briefcase, Calendar, CheckCircle2, ChevronDown, DollarSign, Globe, Mail, Map, Phone, Trash2, UploadCloud, User, XCircle } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Modal, Platform, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import AppHeader from '../../components/AppHeader';
import { auth, db, storage } from '../../config/firebase';
import { getUserProfileFromCloud, saveUserProfileToCloud } from '../../services/storage';
import { extractTextFromPDF, generateProfileOptimization } from '../../utils/gemini';
import { ref, uploadString, getDownloadURL, uploadBytes } from 'firebase/storage';
import { doc, updateDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

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
    const [cvUrl, setCvUrl] = useState('');
    const [cvBase64, setCvBase64] = useState('');
    const [hasFile, setHasFile] = useState(false);
    const [cvLabel, setCvLabel] = useState('CV Principal');
    // Segundo CV opcional (ej. "CV Ventas" / "CV Marketing")
    const [fileName2, setFileName2] = useState('');
    const [cvUrl2, setCvUrl2] = useState('');
    const [cvBase64_2, setCvBase64_2] = useState('');
    const [hasFile2, setHasFile2] = useState(false);
    const [cvLabel2, setCvLabel2] = useState('');
    const [showSecondCv, setShowSecondCv] = useState(false);
    const [extracting, setExtracting] = useState(false);
    const [extracting2, setExtracting2] = useState(false);
    const [saving, setSaving] = useState(false); // Estado de guardado

    // Estados para optimización de perfil
    const [optimizingSuggestions, setOptimizingSuggestions] = useState(false);
    const [profileSuggestions, setProfileSuggestions] = useState<any>(null);
    const [secretCount, setSecretCount] = useState(0);
    const router = useRouter();

    const [modalType, setModalType] = useState<'none' | 'dept' | 'prov' | 'dist' | 'date' | 'suggestions'>('none');
    const [tempDay, setTempDay] = useState(DAYS[0]);
    const [tempMonth, setTempMonth] = useState(MONTHS[0]);
    const [tempYear, setTempYear] = useState(YEARS[10]);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user) {
                loadProfile(user);
            }
        });
        return unsubscribe;
    }, []);

    const loadProfile = async (user: any) => {
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
                if (data.fileName || data.cvName) {
                    setFileName(data.fileName || data.cvName);
                    setHasFile(true);
                }
                if (data.cvUrl || data.cv) setCvUrl(data.cvUrl || data.cv);
                if (data.cvBase64) setCvBase64(data.cvBase64);
                if (data.cvLabel) setCvLabel(data.cvLabel);

                // Segundo CV, si el candidato guardó uno
                if (data.cv2FileName) {
                    setFileName2(data.cv2FileName);
                    setHasFile2(true);
                    setShowSecondCv(true);
                }
                if (data.cv2Url) setCvUrl2(data.cv2Url);
                if (data.cv2Base64) setCvBase64_2(data.cv2Base64);
                if (data.cv2Label) setCvLabel2(data.cv2Label);
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
                    salary, modality, interests, bio, fileName, cvUrl, cvBase64, cvLabel, contextForAI,
                    cv2FileName: fileName2, cv2Url: cvUrl2, cv2Base64: cvBase64_2, cv2Label: cvLabel2
                });

                // También sincronizar con la nueva colección 'users_candidatos'
                try {
                    const candidRef = doc(db, 'users_candidatos', user.uid);
                    await updateDoc(candidRef, {
                        'profile.cv': cvUrl,
                        'profile.cvName': fileName,
                        'profile.cvLabel': cvLabel,
                        'profile.cv2Url': cvUrl2,
                        'profile.cv2FileName': fileName2,
                        'profile.cv2Label': cvLabel2,
                        'cvBase64': cvBase64, // Redundancia para fácil lectura
                        fullName,
                        phone
                    });
                } catch (ce) { /* Ignorar si no existe aún */ }
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

    const pickDocument = async (slot: 1 | 2 = 1) => {
        const setFileNameFn = slot === 1 ? setFileName : setFileName2;
        const setHasFileFn = slot === 1 ? setHasFile : setHasFile2;
        const setExtractingFn = slot === 1 ? setExtracting : setExtracting2;
        const setCvUrlFn = slot === 1 ? setCvUrl : setCvUrl2;
        const setCvBase64Fn = slot === 1 ? setCvBase64 : setCvBase64_2;
        const urlField = slot === 1 ? 'profile.cvUrl' : 'profile.cv2Url';
        const base64Field = slot === 1 ? 'profile.cvBase64' : 'profile.cv2Base64';
        const fileNameField = slot === 1 ? 'profile.fileName' : 'profile.cv2FileName';

        try {
            const result = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true });
            if (result.canceled) return;
            const file = result.assets[0];
            setFileNameFn(file.name);
            setHasFileFn(true);
            setExtractingFn(true);
            try {
                const webFile = Platform.OS === 'web' ? (file as any).file : undefined;

                // 1. Extraer Texto (Con Timeout de 20s). Solo el CV principal
                // sobrescribe el resumen general del perfil.
                if (slot === 1) {
                    const extractionPromise = extractTextFromPDF(file.uri, file.mimeType || 'application/pdf', webFile);
                    const timeoutExtract = new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout: La IA tardó demasiado en responder")), 20000));
                    const text: any = await Promise.race([extractionPromise, timeoutExtract]);
                    setBio(text);
                }

                // 2. Convertir a Base64 y Subir a Storage
                const storageRef = ref(storage, `candidates_cvs/${auth.currentUser?.uid}/${slot === 2 ? 'cv2_' : ''}${file.name}`);

                let rawBase64 = "";

                const uploadPromise = async () => {
                    if (Platform.OS === 'web' && webFile) {
                        const reader = new FileReader();
                        rawBase64 = await new Promise<string>((resolve) => {
                            reader.onload = () => resolve(reader.result as string);
                            reader.readAsDataURL(webFile);
                        });
                    } else {
                        const response = await fetch(file.uri);
                        const blob = await response.blob();
                        const reader = new FileReader();
                        rawBase64 = await new Promise<string>((resolve) => {
                            reader.onload = () => resolve(reader.result as string);
                            reader.readAsDataURL(blob);
                        });
                    }

                    const base64Data = rawBase64.split(',')[1] || rawBase64;
                    await uploadString(storageRef, base64Data, 'base64', { contentType: file.mimeType || 'application/pdf' });
                    return await getDownloadURL(storageRef);
                };

                const timeoutUpload = new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout_Upload")), 8000));

                try {
                    const downloadUrl = (await Promise.race([uploadPromise(), timeoutUpload])) as string;
                    setCvUrlFn(downloadUrl);

                    // Auto-guardado en base de datos al tener URL
                    const user = auth.currentUser;
                    if (user) {
                        const userRef = doc(db, 'users', user.uid);
                        await updateDoc(userRef, { [urlField]: downloadUrl, [fileNameField]: file.name }).catch(() => {});
                    }
                    showAlert("✨ Éxito", "CV vinculado a tu cuenta para postulaciones rápidas.");
                } catch (err) {
                    // Bypass si el servidor principal demora
                    if (rawBase64 && typeof file.size === 'number' && file.size < 750 * 1024) {
                        const base64Data = rawBase64.split(',')[1] || rawBase64;
                        setCvBase64Fn(base64Data);
                        const user = auth.currentUser;
                        if (user) {
                            const userRef = doc(db, 'users', user.uid);
                            await updateDoc(userRef, { [base64Field]: base64Data, [fileNameField]: file.name }).catch(() => {});
                        }
                        showAlert("✨ Éxito (Modo Rápido)", "Tu CV se guardó directamente en tu perfil para uso inmediato.");
                    } else {
                        throw new Error("El archivo es demasiado grande para carga rápida y el servidor principal no responde.");
                    }
                }

            } catch (e: any) {
                console.error("Upload error:", e);
                showAlert("Error IA/Storage", e.message);
            }
            finally { setExtractingFn(false); }
        } catch (err: any) { showAlert("Error", err.message); setExtractingFn(false); }
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
                {hasFile && (
                    <TextInput
                        style={styles.cvLabelInput}
                        value={cvLabel}
                        onChangeText={setCvLabel}
                        placeholder="Nombre de este CV (ej. CV Ventas)"
                        placeholderTextColor="#64748b"
                    />
                )}
                <TouchableOpacity style={[styles.uploadCard, hasFile && { borderColor: '#10b981' }]} onPress={() => extracting ? null : pickDocument(1)}>
                    {extracting ? <ActivityIndicator color="#3b82f6" /> : <UploadCloud size={24} color={hasFile ? "#10b981" : "#3b82f6"} />}
                    <View style={{ marginLeft: 15 }}>
                        <Text style={styles.uploadTitle}>{extracting ? "Procesando..." : hasFile ? (fileName || "CV Cargado") : "Subir PDF"}</Text>
                    </View>
                </TouchableOpacity>

                {!showSecondCv ? (
                    <TouchableOpacity style={styles.addSecondCvBtn} onPress={() => setShowSecondCv(true)}>
                        <Text style={styles.addSecondCvText}>+ Agregar un segundo CV (ej. para otro tipo de puesto)</Text>
                    </TouchableOpacity>
                ) : (
                    <>
                        {hasFile2 && (
                            <TextInput
                                style={styles.cvLabelInput}
                                value={cvLabel2}
                                onChangeText={setCvLabel2}
                                placeholder="Nombre de este CV (ej. CV Marketing)"
                                placeholderTextColor="#64748b"
                            />
                        )}
                        <TouchableOpacity style={[styles.uploadCard, hasFile2 && { borderColor: '#10b981' }]} onPress={() => extracting2 ? null : pickDocument(2)}>
                            {extracting2 ? <ActivityIndicator color="#3b82f6" /> : <UploadCloud size={24} color={hasFile2 ? "#10b981" : "#3b82f6"} />}
                            <View style={{ marginLeft: 15 }}>
                                <Text style={styles.uploadTitle}>{extracting2 ? "Procesando..." : hasFile2 ? (fileName2 || "CV Cargado") : "Subir segundo PDF"}</Text>
                            </View>
                        </TouchableOpacity>
                    </>
                )}

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
                                    if (auth.currentUser?.email === 'oscar@veritlyapp.com') {
                                        router.push('/(tabs)/admin_config');
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
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F9FAFB' },
    scroll: { padding: 20 },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
    header: { fontSize: 28, fontWeight: 'bold', color: '#111827' },
    subHeader: { fontSize: 14, color: '#6B7280' },
    trashButton: { padding: 10, backgroundColor: 'rgba(220, 38, 38, 0.08)', borderRadius: 12 },
    sectionTitle: { color: '#4F46E5', fontSize: 12, fontWeight: 'bold', marginBottom: 10, marginTop: 15 },
    formSection: { marginBottom: 10 },
    row: { flexDirection: 'row', justifyContent: 'space-between' },

    // ESTILOS DE INPUT CORREGIDOS (Sin superposición)
    inputGroup: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 10, height: 50, paddingHorizontal: 10 },
    inputGroupArea: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 10, height: 120, paddingHorizontal: 10 },

    inputIcon: { marginRight: 10 },
    inputField: { flex: 1, color: '#111827', fontSize: 14, height: '100%' },
    inputText: { flex: 1, color: '#111827', fontSize: 14 },

    dropdownButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 10, height: 50, paddingHorizontal: 15 },

    modalityContainer: { flexDirection: 'row', backgroundColor: '#FFFFFF', borderRadius: 12, padding: 4, borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 10 },
    modalityButton: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
    uploadCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 15, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 15, borderStyle: 'dashed' },
    uploadTitle: { color: '#111827', fontWeight: 'bold', fontSize: 14 },
    uploadSubtitle: { color: '#9CA3AF', fontSize: 12 },
    cvLabelInput: { backgroundColor: '#FFFFFF', borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB', paddingHorizontal: 12, paddingVertical: 10, color: '#111827', fontSize: 13, fontWeight: '600', marginBottom: 8 },
    addSecondCvBtn: { alignItems: 'center', paddingVertical: 10, marginBottom: 15 },
    addSecondCvText: { color: '#4F46E5', fontSize: 13, fontWeight: '600' },
    saveButton: { backgroundColor: '#4F46E5', padding: 18, borderRadius: 12, alignItems: 'center', marginTop: 10, marginBottom: 40 },
    saveText: { color: 'white', fontWeight: 'bold', fontSize: 16 },

    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 20 },
    modalContent: { backgroundColor: 'white', borderRadius: 20, padding: 20, maxHeight: '70%', minHeight: 300 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15, borderBottomWidth: 1, borderBottomColor: '#F3F4F6', paddingBottom: 10 },
    modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#111827' },
    modalItem: { paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
    modalItemText: { fontSize: 16, color: '#374151' },
    dateColumn: { flex: 1, height: 200, backgroundColor: '#F9FAFB', borderRadius: 8, overflow: 'hidden' },
    dateScroll: { flex: 1 },
    dateLabel: { textAlign: 'center', fontSize: 10, color: '#6B7280', paddingVertical: 5, fontWeight: 'bold', backgroundColor: '#F3F4F6' },
    dateItem: { paddingVertical: 10, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
    dateItemSelected: { backgroundColor: '#4F46E5' },
    dateText: { fontSize: 14, color: '#374151' },
    modalConfirmButton: { backgroundColor: '#4F46E5', paddingVertical: 12, paddingHorizontal: 30, borderRadius: 25, marginTop: 20 }
});