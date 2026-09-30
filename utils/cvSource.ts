// Donde esta el CV de un candidato y como mostrarlo en web.
//
// Segun la antiguedad del registro, el CV puede venir como:
//   - URL de Firebase Storage en originalFileUrl / cvUrl / cv_url (lo normal)
//   - base64 en cvBase64 (formato viejo) o en el sub-documento privado
//   - base64 (a veces como data: URL) METIDO en cvUrl/originalFileUrl: pasaba
//     cuando el candidato postulaba con el CV guardado de un perfil antiguo,
//     donde el CV estaba en base64 y no como link. Ponerlo en un iframe o en
//     window.open como si fuera URL dejaba la vista previa en blanco.

const isHttpUrl = (v: unknown): v is string => typeof v === 'string' && /^https?:\/\//i.test(v);

export function getCandidateCvSource(candidate: any): { url?: string; base64?: string } {
    const fields = [candidate?.originalFileUrl, candidate?.cvUrl, candidate?.cv_url];
    const url = fields.find(isHttpUrl);
    const base64 = candidate?.cvBase64 || fields.find((v) => typeof v === 'string' && v.length > 100 && !isHttpUrl(v));
    return { url, base64: base64 || undefined };
}

// Todo en base64 puro, sin el prefijo "data:...;base64,".
export const rawBase64 = (b64: string) => (b64.startsWith('data:') ? b64.split(',')[1] || '' : b64);

const WORD_DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const WORD_DOC = 'application/msword';

// Tipo por la firma del archivo: PDF "%PDF" (JVBER), DOCX zip "PK" (UEsDB), DOC OLE (0M8R4KGx).
export function detectCvMimeType(b64: string, fallback?: string): string {
    const head = rawBase64(b64).slice(0, 16);
    if (head.startsWith('JVBER')) return 'application/pdf';
    if (head.startsWith('UEsDB')) return WORD_DOCX;
    if (head.startsWith('0M8R4KGx')) return WORD_DOC;
    return fallback && fallback !== 'application/octet-stream' ? fallback : 'application/pdf';
}

export const isWordMimeType = (mime: string) => mime === WORD_DOCX || mime === WORD_DOC || mime.includes('word');

export function base64ToBytes(b64: string): Uint8Array {
    const bin = atob(rawBase64(b64));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
}

// URL blob: para mostrar/abrir el archivo. Chrome bloquea abrir data: URLs en
// una pestaña nueva y falla con data: URLs grandes en iframes; blob: no tiene
// ese problema. Quien la crea debe liberarla con URL.revokeObjectURL.
export function base64ToBlobUrl(b64: string, mimeType: string): string {
    return URL.createObjectURL(new Blob([base64ToBytes(b64) as BlobPart], { type: mimeType }));
}

// Abre (PDF) o descarga (Word) un CV en base64 desde web.
export function openBase64Cv(b64: string, mimeType: string, fileBaseName: string) {
    const blobUrl = base64ToBlobUrl(b64, mimeType);
    if (isWordMimeType(mimeType)) {
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = `${fileBaseName}${mimeType === WORD_DOC ? '.doc' : '.docx'}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } else {
        window.open(blobUrl, '_blank');
    }
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
}
