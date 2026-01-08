// Script para importar datos históricos a los analytics
// Este script debe ejecutarse UNA SOLA VEZ desde la consola del navegador
// cuando estés logueado como admin en la aplicación

import { collection, doc, getDocs, setDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

/**
 * Importa usuarios históricos a los contadores de analytics
 * Ejecutar desde la consola del navegador o como una Cloud Function
 */
export const importHistoricalData = async () => {
    console.log("🔄 Iniciando importación de datos históricos...");

    const statsRef = doc(db, 'stats', 'global_counters');

    // Contadores
    let totalCandidatos = 0;
    let totalEmpresas = 0;
    const dailyNewUsers: { [key: string]: number } = {};

    try {
        // 1. Contar usuarios candidatos
        console.log("📊 Leyendo users_candidatos...");
        const candidatosSnapshot = await getDocs(collection(db, 'users_candidatos'));
        totalCandidatos = candidatosSnapshot.size;

        candidatosSnapshot.forEach(docSnap => {
            const data = docSnap.data();
            if (data.createdAt) {
                const date = new Date(data.createdAt).toISOString().split('T')[0];
                dailyNewUsers[date] = (dailyNewUsers[date] || 0) + 1;
            }
        });
        console.log(`✅ Encontrados ${totalCandidatos} candidatos`);

        // 2. Contar usuarios empresas
        console.log("📊 Leyendo users_empresas...");
        const empresasSnapshot = await getDocs(collection(db, 'users_empresas'));
        totalEmpresas = empresasSnapshot.size;

        empresasSnapshot.forEach(docSnap => {
            const data = docSnap.data();
            if (data.createdAt) {
                const date = new Date(data.createdAt).toISOString().split('T')[0];
                dailyNewUsers[date] = (dailyNewUsers[date] || 0) + 1;
            }
        });
        console.log(`✅ Encontradas ${totalEmpresas} empresas`);

        // 3. Contar análisis (scans) históricos
        console.log("📊 Leyendo análisis históricos...");
        let totalScans = 0;
        const dailyScans: { [key: string]: number } = {};

        // Revisar historial de cada candidato
        const userCreditsSnapshot = await getDocs(collection(db, 'user_credits'));
        userCreditsSnapshot.forEach(docSnap => {
            const data = docSnap.data();
            if (data.totalCreditsUsed) {
                totalScans += data.totalCreditsUsed;
            }
        });
        console.log(`✅ Encontrados ${totalScans} scans aproximados`);

        // 4. Preparar el update
        const totalUsers = totalCandidatos + totalEmpresas;

        const updateData: any = {
            totalUsers: totalUsers,
            totalScans: totalScans,
            lastUpdated: new Date().toISOString(),
            importedAt: new Date().toISOString()
        };

        // Agregar conteos diarios
        Object.keys(dailyNewUsers).forEach(date => {
            updateData[`dailyNewUsers.${date}`] = dailyNewUsers[date];
        });

        // 5. Guardar en Firestore
        console.log("💾 Guardando en stats/global_counters...");
        await setDoc(statsRef, updateData, { merge: true });

        console.log("✅ ¡Importación completada!");
        console.log(`   - Total usuarios: ${totalUsers} (${totalCandidatos} candidatos + ${totalEmpresas} empresas)`);
        console.log(`   - Total scans: ${totalScans}`);
        console.log(`   - Días con datos: ${Object.keys(dailyNewUsers).length}`);

        return {
            success: true,
            totalUsers,
            totalCandidatos,
            totalEmpresas,
            totalScans,
            daysWithData: Object.keys(dailyNewUsers).length
        };

    } catch (error) {
        console.error("❌ Error en importación:", error);
        throw error;
    }
};

// Función para ejecutar desde la consola
// Copia y pega esto en la consola del navegador:
/*
(async () => {
    const { importHistoricalData } = await import('/path/to/this/file');
    await importHistoricalData();
})();
*/
