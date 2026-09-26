// Rango salarial aceptado de una vacante. Un solo calculo compartido entre el
// formulario de la empresa, la pagina publica y el filtro automatico, para que
// lo que se muestra sea siempre lo que se aplica.
//
// salaryToleranceMode: 'percent' (default, como siempre fue) o 'amount' (monto fijo).
// salaryToleranceDown = cuanto se acepta POR DEBAJO del presupuesto,
// salaryTolerance     = cuanto se acepta POR ENCIMA.

export type SalaryToleranceMode = 'percent' | 'amount';

// Tope mensual "razonable" por moneda, solo para detectar errores de tipeo
// (ceros de mas). Es equivalente a ~USD 150,000 al cambio aproximado de cada
// moneda: no se puede usar el mismo numero para todas (COP, CLP, ARS, PYG
// manejan millones de forma normal). Se deja holgado a proposito.
const MAX_MONTHLY_SALARY: Record<string, number> = {
    'S/': 500000,
    'USD$': 150000,
    '€': 150000,
    'COP$': 600000000,
    'MXN$': 2700000,
    'CLP$': 140000000,
    'ARS$': 250000000,
    'Bs': 1500000,
    'UYU$': 6000000,
    'Gs': 1125000000,
    '₡': 76500000,
    'DOP$': 9000000,
    'Q': 1155000,
    'L': 3750000,
    'C$': 5550000,
};

export function getMaxReasonableSalary(currency?: string): number {
    return MAX_MONTHLY_SALARY[currency || 'S/'] ?? 150000;
}

export function getSalaryRange(job: any): { min: number; max: number } | null {
    const budget = Number(job?.salaryBudget) || 0;
    if (budget <= 0) return null;

    const up = Number(job?.salaryTolerance);
    const down = Number(job?.salaryToleranceDown);

    if (job?.salaryToleranceMode === 'amount') {
        return {
            min: Math.max(budget - (down || 0), 0),
            max: budget + (up || 0),
        };
    }

    // Porcentaje: se mantiene el comportamiento historico (vacio o 0 => 10%)
    const upPct = up || 10;
    const downPct = down || 10;
    return {
        min: budget * (1 - downPct / 100),
        max: budget * (1 + upPct / 100),
    };
}
