// types/index.ts

// --- ROLES Y USUARIOS ---
export type UserRole = 'candidate' | 'company';

export interface UserProfile {
  uid: string;
  email: string;
  role: UserRole;
  createdAt: string;
  // Campos opcionales según el rol
  name?: string;           // Para candidato
  companyName?: string;    // Para empresa
  industry?: string;       // Para empresa
}

// --- ESTADOS DEL PROCESO (ATS) ---
// Semáforo de coincidencia (IA)
export type MatchStatus = 'green' | 'yellow' | 'red';

// Estado del proceso de selección (Gestión humana)
export type RecruitmentStatus = 'new' | 'screening' | 'interview' | 'offer' | 'hired' | 'rejected' | 'stored';

// --- EMPLEOS (VACANTES) ---
export interface JobPosting {
  id: string;
  companyId: string;
  title: string;
  description: string;       // Perfil estructurado (Markdown)
  rawDescription?: string;   // Lo que pegó el usuario originalmente
  jobPostDraft?: string;     // El texto para LinkedIn generado por IA
  location: string;
  createdAt: number;         // Timestamp
  isActive: boolean;
}

// --- CANDIDATOS ANALIZADOS ---
export interface CandidateAnalysis {
  id: string;             // ID único del análisis
  jobId: string;          // A qué vacante pertenece
  name: string;           // Nombre detectado por IA
  email: string | null;   // Email detectado (Vital para el historial)
  phoneNumber?: string;   // Teléfono para WhatsApp
  
  // Análisis IA
  matchScore: number;     // 0 - 100
  matchStatus: MatchStatus; 
  summary: string;        // Resumen corto
  pros: string[];
  cons: string[];
  reasoning?: string;     // Explicación técnica extra

  // Archivo
  originalFileUrl?: string; // URL en Storage o Local URI
  
  // Gestión
  recruitmentStatus: RecruitmentStatus;
  analyzedAt: string;     // Fecha ISO
  
  // Datos para historial
  originalJobTitle?: string; // Para saber a qué puesto aplicó antes
}
