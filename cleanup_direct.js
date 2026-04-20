const { initializeApp } = require("firebase/app");
const { getFirestore, collection, getDocs, deleteDoc, writeBatch } = require("firebase/firestore");

const firebaseConfig = {
    apiKey: "AIzaSyBbQwiklf0kWnz5V2_l6PgPeL679NyGEJ8",
    authDomain: "auth.veritlyapp.com",
    projectId: "vinku-3a3af",
    storageBucket: "vinku-3a3af.firebasestorage.app",
    messagingSenderId: "1052083063406",
    appId: "1:1052083063406:web:20b981e0bf896caa7ab47f"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function cleanup() {
    try {
        console.log("Listing jobs...");
        const jobsSnap = await getDocs(collection(db, 'jobs'));
        
        for (const jobDoc of jobsSnap.docs) {
            const jobData = jobDoc.data();
            console.log(`Checking job: ${jobData.title || 'Untitled'} (${jobDoc.id})`);
            
            const candidatesRef = collection(db, 'jobs', jobDoc.id, 'candidates');
            const candSnap = await getDocs(candidatesRef);
            
            console.log(`Found ${candSnap.size} candidates.`);
            if (candSnap.size > 0) {
                const batch = writeBatch(db);
                candSnap.docs.forEach(c => batch.delete(c.ref));
                await batch.commit();
                console.log(`CLEANED: ${jobDoc.id}`);
            }
        }
    } catch (e) {
        console.error("Error:", e);
    }
}

cleanup().then(() => process.exit(0));
