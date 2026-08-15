/**
 * _emailTemplates.ts — Plantillas HTML de correo con marca Veritly.
 * Prefijo _ para que Netlify no lo exponga como endpoint público.
 */

const FEATURE_LABELS: Record<string, string> = {
    landing_page: 'Página de empleos personalizada',
    team: 'Gestión de equipo (varios usuarios)',
    ai_priority: 'Análisis de IA prioritario',
    custom_branding: 'Marca personalizada',
};

export function buildPlanActivatedEmail(params: {
    companyName: string;
    planName: string;
    aiAnalysisLimit?: number;
    internalVacanciesLimit?: number;
    killerQuestionsLimit?: number;
    features?: string[];
}) {
    const { companyName, planName, aiAnalysisLimit, internalVacanciesLimit, killerQuestionsLimit, features } = params;

    const benefits: string[] = [];
    if (aiAnalysisLimit) benefits.push(`${aiAnalysisLimit} análisis de IA por mes`);
    if (internalVacanciesLimit) benefits.push(`${internalVacanciesLimit} vacantes activas`);
    if (killerQuestionsLimit) benefits.push(`${killerQuestionsLimit} preguntas eliminatorias por vacante`);
    (features || []).forEach((f) => {
        if (FEATURE_LABELS[f]) benefits.push(FEATURE_LABELS[f]);
    });

    const benefitsHtml = benefits
        .map((b) => `<li style="margin-bottom:8px;color:#334155;font-size:14px;">${b}</li>`)
        .join('');

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${planName} activado</title>
</head>
<body style="margin:0;padding:0;background-color:#0f172a;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#0f172a" style="background-color:#0f172a;">
  <tr>
    <td align="center" style="padding:32px 16px;">
      <table role="presentation" width="480" cellpadding="0" cellspacing="0" bgcolor="#ffffff" style="background-color:#ffffff;border-radius:16px;overflow:hidden;max-width:480px;width:100%;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
        <tr>
          <td align="center" bgcolor="#0f172a" style="background-color:#0f172a;padding:24px;">
            <img src="https://www.veritlyapp.com/veritly-logo-email.png?v=2" alt="Veritly" width="120" style="display:block;max-width:120px;height:auto;">
          </td>
        </tr>
        <tr>
          <td bgcolor="#ffffff" style="background-color:#ffffff;padding:28px 24px;">
            <h1 style="font-size:19px;color:#0f172a;margin:0 0 8px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">¡Tu plan ${planName} está activo!</h1>
            <p style="font-size:14px;color:#475569;line-height:1.5;margin:0 0 20px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
              Hola ${companyName}, confirmamos que tu suscripción al plan <strong>${planName}</strong> se activó correctamente. Estos son tus beneficios:
            </p>
            ${benefits.length > 0 ? `<ul style="padding-left:18px;margin:0 0 20px;">${benefitsHtml}</ul>` : ''}
            <a href="https://www.veritlyapp.com/empresa/dashboard"
               style="display:inline-block;background-color:#38bdf8;color:#0f172a;font-weight:700;font-size:14px;text-decoration:none;padding:12px 22px;border-radius:10px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
              Ir a mi dashboard
            </a>
          </td>
        </tr>
        <tr>
          <td bgcolor="#ffffff" style="background-color:#ffffff;padding:16px 24px;border-top:1px solid #e2e8f0;">
            <p style="font-size:11px;color:#94a3b8;margin:0;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">Veritly · Reclutamiento potenciado por IA</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;

    return { subject: `Tu plan ${planName} está activo en Veritly`, html };
}
