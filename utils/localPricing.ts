import { useEffect, useState } from 'react';

// Precios de los planes en la moneda del visitante.
//
// Los precios base en config_plans estan en soles (PEN). Se detecta el pais
// del visitante por IP y se convierte con el tipo de cambio del dia. Mismos 16
// paises que aceptan las vacantes (LATAM_COUNTRIES en vacante/[id].tsx y
// dashboard/job/create.tsx); cualquier otro pais ve el precio en dolares.

type CurrencyInfo = { currency: string; symbol: string };

export const PRICING_CURRENCIES: Record<string, CurrencyInfo> = {
    PE: { currency: 'PEN', symbol: 'S/' },
    CO: { currency: 'COP', symbol: '$' },
    MX: { currency: 'MXN', symbol: '$' },
    CL: { currency: 'CLP', symbol: '$' },
    AR: { currency: 'ARS', symbol: '$' },
    EC: { currency: 'USD', symbol: '$' },
    BO: { currency: 'BOB', symbol: 'Bs' },
    UY: { currency: 'UYU', symbol: '$' },
    PY: { currency: 'PYG', symbol: '₲' },
    PA: { currency: 'USD', symbol: '$' },
    CR: { currency: 'CRC', symbol: '₡' },
    DO: { currency: 'DOP', symbol: 'RD$' },
    SV: { currency: 'USD', symbol: '$' },
    GT: { currency: 'GTQ', symbol: 'Q' },
    HN: { currency: 'HNL', symbol: 'L' },
    NI: { currency: 'NIO', symbol: 'C$' },
};

const DEFAULT_LOCATION = { country: 'PE', currency: 'PEN', symbol: 'S/' };
const OTHER_COUNTRY: CurrencyInfo = { currency: 'USD', symbol: '$' };

// Cuantas unidades de cada moneda vale 1 sol. Solo se usan si falla la
// consulta del tipo de cambio (valores del 03/10/2026, redondeados); sin
// respaldo se mostraria el monto en soles con el simbolo de otra moneda.
const FALLBACK_RATES: Record<string, number> = {
    PEN: 1, USD: 0.29, COP: 960, MXN: 5.3, CLP: 282, ARS: 442, BOB: 3.5,
    UYU: 11.7, PYG: 1694, CRC: 132.5, DOP: 17.3, GTQ: 2.2, HNL: 7.8, NIO: 10.7,
};

export function formatCurrencyValue(val: number, currency: string): string {
    if (currency === 'PEN') return val.toString();
    if (currency === 'USD') return val % 1 === 0 ? val.toFixed(0) : val.toFixed(2);
    const rounded = Math.round(val);
    try {
        return rounded.toLocaleString('es-ES');
    } catch {
        return rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    }
}

export function useLocalPricing() {
    const [location, setLocation] = useState(DEFAULT_LOCATION);
    const [locationReady, setLocationReady] = useState(false);
    const [rates, setRates] = useState<Record<string, number>>(FALLBACK_RATES);

    useEffect(() => {
        fetch('https://ipapi.co/json/')
            .then((r) => r.json())
            .then((data) => {
                const country = data.country_code || 'PE';
                const info = PRICING_CURRENCIES[country] || OTHER_COUNTRY;
                setLocation({ country, ...info });
            })
            .catch((e) => console.error('Error detectando ubicación:', e))
            .finally(() => setLocationReady(true));

        fetch('https://open.er-api.com/v6/latest/PEN')
            .then((r) => r.json())
            .then((data) => {
                if (data?.result === 'success' && data.rates) setRates((prev) => ({ ...prev, ...data.rates }));
            })
            .catch((e) => console.error('Error fetching exchange rates:', e));
    }, []);

    // Monto convertido, sin simbolo (ej. "25,90"). FALLBACK_RATES cubre todas
    // las monedas de PRICING_CURRENCIES, asi que siempre hay tasa.
    const formatAmount = (priceInSoles: number) =>
        formatCurrencyValue(priceInSoles * (location.currency === 'PEN' ? 1 : rates[location.currency]), location.currency);

    // Precio listo para mostrar (ej. "Q 197")
    const formatPrice = (priceInSoles: number) => `${location.symbol} ${formatAmount(priceInSoles)}`;

    return { location, locationReady, formatAmount, formatPrice };
}
