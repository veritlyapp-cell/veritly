// Rango salarial aceptado de una vacante. Un solo calculo compartido entre el
// formulario de la empresa, la pagina publica y el filtro automatico, para que
// lo que se muestra sea siempre lo que se aplica.
//
// salaryToleranceMode: 'percent' (default, como siempre fue) o 'amount' (monto fijo).
// salaryToleranceDown = cuanto se acepta POR DEBAJO del presupuesto,
// salaryTolerance     = cuanto se acepta POR ENCIMA.

export type SalaryToleranceMode = 'percent' | 'amount';

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
