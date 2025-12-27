// Datos Jerárquicos para Perú (MVP extendido)
// Estructura: Departamento -> [Provincias] -> { Provincia: [Distritos] }

export interface LocationData {
    departamento: string;
    provincias: {
        nombre: string;
        distritos: string[];
    }[];
}

export const PERU_HIERARCHY: LocationData[] = [
    {
        departamento: "Lima",
        provincias: [
            {
                nombre: "Lima",
                distritos: ["Cercado de Lima", "Ate", "Barranco", "Breña", "Chorrillos", "Comas", "El Agustino", "Independencia", "Jesus Maria", "La Molina", "La Victoria", "Lince", "Los Olivos", "Lurigancho", "Lurin", "Magdalena del Mar", "Miraflores", "Pachacamac", "Pucusana", "Pueblo Libre", "Puente Piedra", "Punta Hermosa", "Punta Negra", "Rimac", "San Bartolo", "San Borja", "San Isidro", "San Juan de Lurigancho", "San Juan de Miraflores", "San Luis", "San Martin de Porres", "San Miguel", "Santa Anita", "Santa Maria del Mar", "Santa Rosa", "Santiago de Surco", "Surquillo", "Villa El Salvador", "Villa Maria del Triunfo"]
            },
            { nombre: "Barranca", distritos: ["Barranca", "Paramonga", "Pativilca", "Supe", "Supe Puerto"] },
            { nombre: "Callao", distritos: ["Callao", "Bellavista", "Carmen de la Legua", "La Perla", "La Punta", "Mi Perú", "Ventanilla"] } // Callao técnicamente es Prov. Const. pero UX lo suele buscar cerca de Lima
        ]
    },
    {
        departamento: "Callao", // Separado para corrección política, aunque UX a veces lo une
        provincias: [
            {
                nombre: "Callao",
                distritos: ["Callao", "Bellavista", "Carmen de la Legua", "La Perla", "La Punta", "Mi Perú", "Ventanilla"]
            }
        ]
    },
    {
        departamento: "Arequipa",
        provincias: [
            {
                nombre: "Arequipa",
                distritos: ["Arequipa", "Alto Selva Alegre", "Cayma", "Cerro Colorado", "Characato", "Chiguata", "Jacobo Hunter", "La Joya", "Mariano Melgar", "Miraflores", "Mollebaya", "Paucarpata", "Pocsi", "Polobaya", "Quequeña", "Sabandia", "Sachaca", "San Juan de Siguas", "San Juan de Tarucani", "Santa Isabel de Siguas", "Santa Rita de Siguas", "Socabaya", "Tiabaya", "Uchumayo", "Vitor", "Yanahuara", "Yarabamba", "Yura"]
            },
            { nombre: "Caylloma", distritos: ["Chivay", "Majes"] },
            { nombre: "Camaná", distritos: ["Camaná", "José María Quimper"] }
        ]
    },
    {
        departamento: "Cusco",
        provincias: [
            {
                nombre: "Cusco",
                distritos: ["Cusco", "Ccorca", "Poroy", "San Jerónimo", "San Sebastián", "Santiago", "Saylla", "Wanchaq"]
            },
            { nombre: "Urubamba", distritos: ["Urubamba", "Chinchero", "Machupicchu", "Ollantaytambo"] }
        ]
    },
    {
        departamento: "La Libertad",
        provincias: [
            { nombre: "Trujillo", distritos: ["Trujillo", "El Porvenir", "Florencia de Mora", "Huanchaco", "La Esperanza", "Laredo", "Moche", "Poroto", "Salaverry", "Simbal", "Victor Larco Herrera"] }
        ]
    },
    // ... Se pueden agregar más departamentos bajo demanda
    {
        departamento: "Otros",
        provincias: [
            { nombre: "Otra Provincia", distritos: ["Otro Distrito"] }
        ]
    }
];

export const getDepartamentos = () => PERU_HIERARCHY.map(d => d.departamento);

export const getProvincias = (depName: string) => {
    const dep = PERU_HIERARCHY.find(d => d.departamento === depName);
    return dep ? dep.provincias.map(p => p.nombre) : [];
};

export const getDistritos = (depName: string, provName: string) => {
    const dep = PERU_HIERARCHY.find(d => d.departamento === depName);
    if (!dep) return [];
    const prov = dep.provincias.find(p => p.nombre === provName);
    return prov ? prov.distritos : [];
};
