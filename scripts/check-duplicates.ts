
import * as dotenv from 'dotenv';
import { initializeApp } from 'firebase/app';
import { collection, getDocs, getFirestore } from 'firebase/firestore';
dotenv.config();

// Initialize Firebase (using env vars or default config from project)
// Note: For a script, we might need to manually load config or use the admin SDK.
// But let's try to reuse the client SDK logic if possible, or mocked for now if we can't context switch easily.
// Actually, `config/firebase.js` might be usable if we shim the environment.

// Simpler approach: Create a standalone script using Admin SDK if user has service account, 
// OR just use client SDK with the project config.

const firebaseConfig = {
    apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function checkDuplicates() {
    console.log('🔍 Checking for duplicates in users_empresas...');
    const companiesRef = collection(db, 'users_empresas');
    const snapshot = await getDocs(companiesRef);

    const rucMap = new Map<string, string[]>();
    const dniMap = new Map<string, string[]>();

    snapshot.forEach(doc => {
        const data = doc.data();
        const id = doc.id;

        // Check RUC
        if (data.company?.ruc) {
            const ruc = data.company.ruc;
            if (!rucMap.has(ruc)) rucMap.set(ruc, []);
            rucMap.get(ruc)?.push(id);
        }

        // Check DNI
        if (data.company?.dni) {
            const dni = data.company.dni;
            if (!dniMap.has(dni)) dniMap.set(dni, []);
            dniMap.get(dni)?.push(id);
        }
    });

    let duplicatesFound = false;

    console.log('\n--- Duplicate RUCs ---');
    rucMap.forEach((ids, ruc) => {
        if (ids.length > 1) {
            console.log(`RUC ${ruc} appears in ${ids.length} documents: ${ids.join(', ')}`);
            duplicatesFound = true;
        }
    });

    console.log('\n--- Duplicate DNIs ---');
    dniMap.forEach((ids, dni) => {
        if (ids.length > 1) {
            console.log(`DNI ${dni} appears in ${ids.length} documents: ${ids.join(', ')}`);
            duplicatesFound = true;
        }
    });

    if (!duplicatesFound) {
        console.log('✅ No duplicates found.');
    } else {
        console.log('⚠️ Duplicates found! Please review and manually delete/merge if necessary.');
    }
}

checkDuplicates().catch(console.error);
