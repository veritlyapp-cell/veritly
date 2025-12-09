import { initializeApp } from "firebase/app";
// Importamos Auth de manera compatible con React Native
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getAuth, getReactNativePersistence, initializeAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { Platform } from "react-native";

// ✅ CREDENCIALES EXACTAS (Copiadas de tu texto)
const firebaseConfig = {
    apiKey: "AIzaSyBbQwiklf0kWnz5V2_l6PgPeL679NyGEJ8",
    authDomain: "vinku-3a3af.firebaseapp.com",
    projectId: "vinku-3a3af",
    storageBucket: "vinku-3a3af.firebasestorage.app",
    messagingSenderId: "1052083063406",
    appId: "1:1052083063406:web:20b981e0bf896caa7ab47f"
};

// 1. Inicializar App
const app = initializeApp(firebaseConfig);

// 2. Inicializar Auth con Persistencia
let auth;
if (Platform.OS === 'web') {
    auth = getAuth(app);
} else {
    // En móvil usamos AsyncStorage para recordar al usuario
    auth = initializeAuth(app, {
        persistence: getReactNativePersistence(AsyncStorage)
    });
}

// 3. Inicializar Servicios
const db = getFirestore(app);
const storage = getStorage(app);

export { auth, db, storage };
