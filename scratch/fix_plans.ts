import { db } from './config/firebase';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';

async function checkAndFixPlans() {
    console.log("🔍 Consultando planes en Firestore...");
    const snap = await getDocs(collection(db, 'config_plans'));
    
    snap.forEach(async (planDoc) => {
        const data = planDoc.data();
        console.log(`ID: ${planDoc.id}`, data);
        
        // Si el usuario quiere "desplegar" el nuevo pricing, 
        // probablemente debamos quitar el isComingSoon del plan Pro.
        if (data.name === 'Pro' && data.isComingSoon) {
            console.log(`✅ Actualizando plan Pro para quitar 'isComingSoon'...`);
            await updateDoc(doc(db, 'config_plans', planDoc.id), {
                isComingSoon: false,
                priceMonthly: 180, // S/ 180 según la lógica de Culqi en el código
                priceAnnual: 1800,
                aiAnalysisLimit: 500, // Ajustar según lo hablado antes o dejar el que tiene
                internalVacanciesLimit: 50,
                publicVacanciesLimit: 20
            });
            console.log("🚀 Plan Pro actualizado.");
        }
    });
}

checkAndFixPlans();
