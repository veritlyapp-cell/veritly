import { useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import React from 'react';
import { SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function PrivacyScreen() {
    const router = useRouter();

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="#0f172a" />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <ArrowLeft color="white" size={24} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Legales</Text>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <Text style={styles.title}>Política de Privacidad - Veritly</Text>
                <Text style={styles.date}>Última actualización: 27 de diciembre de 2025</Text>

                <View style={styles.section}>
                    <Text style={styles.text}>
                        Veritly, un producto de Relié Labs SAC (en adelante, "Veritly"), se compromete a proteger la privacidad de los usuarios que utilizan nuestra tecnología de emparejamiento inteligente (matching). Esta política explica cómo tratamos la información para conectar el talento con las vacantes ideales.
                    </Text>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>1. La Naturaleza de Veritly: Procesamiento de IA</Text>
                    <Text style={styles.text}>
                        Veritly es una plataforma basada en Inteligencia Artificial diseñada para analizar perfiles profesionales y compararlos con requisitos de publicaciones de empleo. Al utilizar nuestro servicio, usted comprende que sus datos serán sometidos a procesos automatizados de análisis para determinar un Índice de Compatibilidad (Matching Score).
                    </Text>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>2. Datos Recopilados para el Matching</Text>
                    <Text style={styles.text}>
                        Para que nuestro motor de IA funcione con precisión, recopilamos:
                        {'\n\n'}• <Text style={{ fontWeight: 'bold' }}>Información del Candidato:</Text> Datos de CV, formación, experiencia, habilidades técnicas y blandas, y pretensiones laborales.
                        {'\n'}• <Text style={{ fontWeight: 'bold' }}>Datos de la Publicación:</Text> Requisitos del puesto, descripción de tareas, ubicación y beneficios ofrecidos por el empleador.
                        {'\n'}• <Text style={{ fontWeight: 'bold' }}>Metadatos de Interacción:</Text> Cómo y cuándo se postula a una vacante para optimizar futuras recomendaciones.
                    </Text>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>3. Finalidad Específica del Tratamiento</Text>
                    <Text style={styles.text}>
                        Sus datos no solo se almacenan, sino que se transforman para:
                        {'\n\n'}• <Text style={{ fontWeight: 'bold' }}>Cálculo de Afinidad:</Text> Comparar semánticamente el perfil del candidato con el perfil del puesto.
                        {'\n'}• <Text style={{ fontWeight: 'bold' }}>Ranking de Candidatos:</Text> Clasificar las postulaciones según su ajuste técnico para facilitar la revisión del reclutador.
                        {'\n'}• <Text style={{ fontWeight: 'bold' }}>Detección de Brechas (Gap Analysis):</Text> Identificar qué habilidades le faltan a un candidato para cumplir con una publicación específica.
                    </Text>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>4. Transparencia en Decisiones Automatizadas</Text>
                    <Text style={styles.text}>
                        En Veritly creemos en la IA ética:
                        {'\n\n'}• El Matching Score es una herramienta de apoyo para el reclutador humano.
                        {'\n'}• Veritly no toma decisiones finales de contratación de forma autónoma; los resultados son recomendaciones basadas en datos objetivos.
                        {'\n'}• El usuario puede solicitar una revisión humana de su perfil si considera que el procesamiento automatizado no refleja su idoneidad.
                    </Text>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>5. Uso de Tecnologías de Terceros</Text>
                    <Text style={styles.text}>
                        Para realizar el análisis avanzado, Veritly utiliza servicios de procesamiento de lenguaje natural (NLP) de proveedores líderes como OpenAI, Anthropic o Google Cloud. Estos proveedores procesan la información de manera anonimizada o bajo estrictos acuerdos de confidencialidad y no utilizan sus datos para entrenar modelos públicos de IA.
                    </Text>
                </View>

                <View style={{ height: 1, backgroundColor: '#334155', marginVertical: 30 }} />

                <Text style={styles.title}>Términos y Condiciones de Uso - Veritly</Text>
                <Text style={styles.date}>Última actualización: 27 de diciembre de 2025</Text>

                <View style={styles.section}>
                    <Text style={styles.text}>
                        Los presentes Términos y Condiciones regulan el acceso y uso de la plataforma Veritly (en adelante, "la Plataforma"), propiedad de Relié Labs SAC (en adelante, "Relié"). Al utilizar la Plataforma, el usuario (en adelante, "el Usuario") acepta plenamente estos términos.
                    </Text>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>1. Descripción del Servicio</Text>
                    <Text style={styles.text}>
                        Veritly es una herramienta tecnológica basada en Inteligencia Artificial que facilita el emparejamiento (matching) entre perfiles profesionales de candidatos y requerimientos de puestos de trabajo publicados por empresas empleadoras.
                    </Text>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>2. Naturaleza del "Matching Score"</Text>
                    <Text style={styles.text}>
                        El Usuario reconoce y acepta que:
                        {'\n\n'}• El Matching Score es un indicador estadístico y referencial generado por algoritmos de procesamiento de lenguaje natural.
                        {'\n'}• Dicho puntaje representa una estimación de compatibilidad técnica y no constituye una calificación definitiva sobre la capacidad humana, ética o profesional del candidato.
                        {'\n'}• Un puntaje alto no garantiza una entrevista ni una contratación, así como un puntaje bajo no impide que una empresa decida contactar al candidato por otros criterios.
                    </Text>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>3. Exclusión de Responsabilidad</Text>
                    <Text style={styles.text}>
                        Relié, a través de Veritly, actúa únicamente como un intermediario tecnológico. En consecuencia:
                        {'\n\n'}• <Text style={{ fontWeight: 'bold' }}>No garantizamos resultados:</Text> Relié no garantiza la obtención de empleo para los candidatos ni la cobertura de vacantes para los empleadores.
                        {'\n'}• <Text style={{ fontWeight: 'bold' }}>Decisiones de terceros:</Text> La decisión final de entrevistar, contratar o rechazar a un candidato es responsabilidad exclusiva del empleador. Relié no interviene en las negociaciones ni en los procesos de decisión humana.
                        {'\n'}• <Text style={{ fontWeight: 'bold' }}>Veracidad de la información:</Text> El Usuario es el único responsable de la veracidad y exactitud de los datos subidos (CV, descripciones de puesto, etc.). Veritly no verifica la veracidad de la información proporcionada por los Usuarios.
                    </Text>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>4. Uso Correcto de la Plataforma</Text>
                    <Text style={styles.text}>
                        El Usuario se compromete a:
                        {'\n\n'}• No utilizar identidades falsas o suplantar a terceros.
                        {'\n'}• No intentar vulnerar la seguridad de los algoritmos de Veritly.
                        {'\n'}• No utilizar la Plataforma para fines ilícitos o que atenten contra la Ley de Protección de Datos Personales (Ley N° 29733).
                    </Text>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>5. Propiedad Intelectual</Text>
                    <Text style={styles.text}>
                        Todo el software, algoritmos, marcas (Relié, Liah, Veritly), logotipos y diseños asociados a la Plataforma son propiedad exclusiva de Relié Labs SAC. Queda prohibida su reproducción, ingeniería inversa o distribución sin autorización expresa por escrito.
                    </Text>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>6. Modificaciones del Servicio</Text>
                    <Text style={styles.text}>
                        Relié se reserva el derecho de actualizar, modificar o suspender temporalmente funciones de la Plataforma (incluyendo el algoritmo de matching) para mejorar la precisión del servicio o realizar mantenimientos técnicos.
                    </Text>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>7. Ley Aplicable y Jurisdicción</Text>
                    <Text style={styles.text}>
                        Estos términos se rigen por las leyes de la República del Perú. Cualquier controversia será resuelta ante los jueces y tribunales del distrito judicial de Lima, Perú.
                    </Text>
                </View>

                <View style={{ height: 50 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0f172a' },
    header: { flexDirection: 'row', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#334155' },
    backButton: { padding: 8, marginRight: 10 },
    headerTitle: { color: 'white', fontSize: 20, fontWeight: 'bold' },
    content: { padding: 20 },
    title: { fontSize: 24, fontWeight: '900', color: 'white', marginBottom: 10 },
    date: { color: '#94a3b8', fontSize: 14, marginBottom: 30, fontStyle: 'italic' },
    section: { marginBottom: 25 },
    sectionTitle: { color: '#38bdf8', fontSize: 18, fontWeight: 'bold', marginBottom: 10 },
    text: { color: '#cbd5e1', fontSize: 15, lineHeight: 24, textAlign: 'justify' }
});
