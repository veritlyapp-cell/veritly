// Evaluacion de preguntas filtro. Compartida entre la postulacion (descarte
// automatico) y el panel de la empresa (mostrar si cada respuesta aprueba).

// Mismo orden que ve el candidato: las preguntas sin texto no se muestran,
// asi que los indices de killerAnswers corresponden a esta lista.
export function getActiveKillerQuestions(job: any): any[] {
    return (job?.killerQuestions || []).filter((q: any) => q?.question?.trim());
}

export function passesKillerQuestion(q: any, answer: string | undefined): boolean {
    if (q?.type === 'choice') {
        const acceptable = (q.options || []).filter((_: string, i: number) => (q.correctOptions || []).includes(i));
        return answer !== undefined && acceptable.includes(answer);
    }
    return (answer || 'no') === (q?.expectedAnswer || 'si');
}

export function formatKillerAnswer(q: any, answer: string | undefined): string {
    if (answer === undefined || answer === null || answer === '') return 'Sin respuesta';
    if (q?.type === 'choice') return answer;
    return answer === 'si' ? 'Sí' : answer === 'no' ? 'No' : answer;
}
