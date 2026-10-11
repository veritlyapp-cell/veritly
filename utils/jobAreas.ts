// Area de cada vacante, para comparar sueldos y demanda entre empresas
// ("Ejecutivo de Ventas B2B", "Asesor Comercial" y "Vendedor" son Ventas).
// La IA la sugiere al crear la vacante; el reclutador puede cambiarla.

export const JOB_AREAS = [
    'Ventas y Comercial',
    'Atención al Cliente',
    'Tecnología',
    'Administración y Finanzas',
    'Recursos Humanos',
    'Marketing y Comunicación',
    'Operaciones y Logística',
    'Producción y Manufactura',
    'Ingeniería',
    'Salud',
    'Educación',
    'Legal',
    'Construcción',
    'Gastronomía y Hotelería',
    'Diseño y Creatividad',
    'Otros',
];

const fold = (s?: string | null) =>
    String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

export function matchArea(text?: string | null): string | null {
    const t = fold(text);
    if (!t) return null;
    return JOB_AREAS.find((a) => fold(a) === t) || JOB_AREAS.find((a) => t.includes(fold(a).split(' ')[0])) || null;
}
