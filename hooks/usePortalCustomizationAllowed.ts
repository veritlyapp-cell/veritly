import { doc, getDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { auth, db } from '../config/firebase';
import { getEffectiveMembership } from '../services/auth-service';

// Plan Gold (feature "Landing Page" en config_plans): personaliza su pagina de
// empleos (menu "Pagina de Empleos") y elige que vacantes aparecen en ella.
// Los demas planes muestran ahi todas sus vacantes activas, menos las
// confidenciales. La regla real la aplica netlify/functions/landing-page.ts.
export function usePortalCustomizationAllowed(enabled = true) {
    const [allowed, setAllowed] = useState(false);
    useEffect(() => {
        if (!enabled || !auth.currentUser) return;
        if (auth.currentUser.email === 'oscar@veritlyapp.com') { setAllowed(true); return; }
        (async () => {
            try {
                const { companyId } = await getEffectiveMembership(auth.currentUser!.uid);
                const company = await getDoc(doc(db, 'users_empresas', companyId));
                const planId = company.data()?.subscription?.planId;
                if (!planId) return;
                const plan = await getDoc(doc(db, 'config_plans', planId));
                const features: string[] = plan.data()?.features || [];
                setAllowed(features.includes('Landing Page') || features.includes('Landing Page Personalizada'));
            } catch (e) {
                console.warn('No se pudo verificar el plan para la página de empleos:', e);
            }
        })();
    }, [enabled]);
    return allowed;
}
