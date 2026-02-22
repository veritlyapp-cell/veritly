/**
 * Utilidades para conexión con APIs de SUNAT / RENIEC
 * y validación de formatos.
 */

// Token de prueba o configurar en .env
// Para apis.net.pe se requiere token.
const API_TOKEN = process.env.EXPO_PUBLIC_SUNAT_API_TOKEN || ""; // Dejar vacío para usar endpoint gratuito si existe, o pedir al usuario.
const BASE_URL = "https://api.apis.net.pe/v2/sunat/ruc";
const BASE_URL_DNI = "https://api.apis.net.pe/v2/reniec/dni";

export interface CompanyData {
    razonSocial: string;
    direccion: string;
    estado: string;
    condicion: string;
    departamento?: string;
    provincia?: string;
    distrito?: string;
}

export interface PersonData {
    nombres: string;
    apellidoPaterno: string;
    apellidoMaterno: string;
}

export const validateRucFormat = (ruc: string) => {
    return /^(10|20)\d{9}$/.test(ruc);
};

export const validateDniFormat = (dni: string) => {
    return /^\d{8}$/.test(dni);
};


export const fetchRucData = async (ruc: string): Promise<CompanyData | null> => {
    if (!validateRucFormat(ruc)) return null;

    // --- MOCK FOR TESTING ---
    if (ruc === '20000000001') {
        return {
            razonSocial: "EMPRESA DE PRUEBA S.A.C.",
            direccion: "AV. TEST 123",
            estado: "ACTIVO",
            condicion: "HABIDO",
            departamento: "LIMA",
            provincia: "LIMA",
            distrito: "MIRAFLORES"
        };
    }
    // ------------------------

    try {
        if (!API_TOKEN) {
            console.warn("⚠️ NO API TOKEN: Use RUC '20000000001' to test without token.");
        }

        const response = await fetch(`${BASE_URL}?numero=${ruc}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${API_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            console.warn(`API SUNAT Error: Status ${response.status} - ${response.statusText}`);
            // If 404, it really doesn't exist. If 401/422, it's an API issue.
            // For MVP, we return null, but logging helps debugging.
            return null;
        }

        const data = await response.json();
        return {
            razonSocial: data.razonSocial,
            direccion: data.direccion,
            estado: data.estado,
            condicion: data.condicion,
            departamento: data.departamento,
            provincia: data.provincia,
            distrito: data.distrito
        };

    } catch (error) {
        console.error("Error fetching RUC:", error);
        return null;
    }
};

export const fetchDniData = async (dni: string): Promise<PersonData | null> => {
    if (!validateDniFormat(dni)) return null;

    // --- MOCK FOR TESTING ---
    if (dni === '10000000') {
        return {
            nombres: "JUAN",
            apellidoPaterno: "PEREZ",
            apellidoMaterno: "TEST"
        };
    }
    // ------------------------

    try {
        const response = await fetch(`${BASE_URL_DNI}?numero=${dni}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${API_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            console.warn(`API DNI Error: Status ${response.status}`);
            return null;
        }

        const data = await response.json();
        return {
            nombres: data.nombres,
            apellidoPaterno: data.apellidoPaterno,
            apellidoMaterno: data.apellidoMaterno
        };
    } catch (error) {
        console.error("Error fetching DNI:", error);
        return null;
    }
};
