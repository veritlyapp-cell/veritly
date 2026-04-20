import { db } from './config/firebase.ts';
import { collection, getDocs, deleteDoc, doc, writeBatch, query } from 'firebase/firestore';

async function cleanup() {
    try {
        console.log("Listing jobs...");
        const jobsSnap = await getDocs(collection(db, 'jobs'));
        
        for (const jobDoc of jobsSnap.docs) {
            const jobData = jobDoc.data();
            if (jobData.title === 'Vendedor de Campo') { // Target specific job from screenshots
                console.log(`Cleaning up job: ${jobData.title} (${jobDoc.id})`);
                const candidatesRef = collection(db, 'jobs', jobDoc.id, 'candidates');
                const candSnap = await getDocs(candidatesRef);
                
                console.log(`Found ${candSnap.size} candidates to delete.`);
                const batch = writeBatch(db);
                candSnap.docs.forEach(c => batch.delete(c.ref));
                await batch.commit();
                console.log("CLEANUP DONE for Vendedor de Campo");
            }
        }
    } catch (e) {
        console.error("Error during cleanup:", e);
    }
}

cleanup().then(() => process.exit(0));
