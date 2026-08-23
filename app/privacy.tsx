import { useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import React from 'react';
import { SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function PrivacyScreen() {
    const router = useRouter();

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <ArrowLeft color="#111827" size={24} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Legales</Text>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <Text style={styles.title}>Política de Privacidad - Veritly</Text>
                <Text style={styles.date}>Última actualización: 23 de agosto de 2026</Text>

                <View style={styles.section}>
                    <Text style={styles.text}>
                        Veritly, un producto de Relié Labs LLC (en adelante, "Veritly", "nosotros"), conecta a empresas y reclutadores (en adelante, "Reclutadores") con personas que buscan empleo (en adelante, "Candidatos") a través de una plataforma que usa inteligencia artificial para filtrar y comparar perfiles contra vacantes. Esta política explica qué datos recopilamos, cómo los usamos, dónde se almacenan, y qué derechos tienes sobre ellos.
                    </Text>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>1. Qué datos recopilamos</Text>
                    <Text style={styles.text}>
                        {'\n'}• <Text style={{ fontWeight: 'bold' }}>Si eres Candidato:</Text> nombre, correo, teléfono, expectativa salarial, país, respuestas a preguntas filtro, y tu Currículum (CV) en PDF o Word que subes al postular.
                        {'\n'}• <Text style={{ fontWeight: 'bold' }}>Si eres Reclutador/Empresa:</Text> nombre, correo, teléfono, nombre de la empresa, RUC o DNI (cuando lo proporcionas), y datos de facturación de tu suscripción.
                        {'\n'}• <Text style={{ fontWeight: 'bold' }}>Datos de candidatos que un Reclutador carga a la plataforma:</Text> cuando un Reclutador sube CVs manualmente, importa una base de datos en Excel, o usa nuestra extensión de navegador para capturar perfiles públicos de LinkedIn, esa información (nombre, experiencia, habilidades, contacto) también queda registrada en Veritly bajo la cuenta de ese Reclutador.
                        {'\n'}• <Text style={{ fontWeight: 'bold' }}>Datos automáticos de navegación:</Text> usamos Google Analytics, Meta Pixel (para medir el resultado de nuestra publicidad en Facebook/Instagram), Microsoft Clarity (que puede grabar cómo interactúas con la página, sin capturar contraseñas ni campos sensibles) y Sentry (para detectar errores técnicos). Estas herramientas usan cookies o tecnologías similares.
                    </Text>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>2. Dónde se guarda tu CV y por cuánto tiempo</Text>
                    <Text style={styles.text}>
                        Tu CV se almacena en nuestra infraestructura (Google Cloud / Firebase) de forma indefinida, mientras tu cuenta o tu postulación estén activas, o hasta que solicites su eliminación. Esto significa que <Text style={{ fontWeight: 'bold' }}>tu CV queda guardado en nuestros registros</Text> incluso después de que el proceso de selección al que postulaste haya terminado, para que puedas reutilizarlo en futuras postulaciones sin volver a subirlo. Puedes pedir que lo eliminemos en cualquier momento (ver sección 7).
                    </Text>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>3. Cómo usamos tus datos</Text>
                    <Text style={styles.text}>
                        {'\n'}• Comparar tu perfil contra los requisitos de una vacante y calcular un Índice de Compatibilidad (Match Score), usando modelos de IA de Google (Gemini).
                        {'\n'}• Permitir que el Reclutador dueño de la vacante a la que postulaste vea tu perfil, tu CV y tu Match Score para decidir si te contacta.
                        {'\n'}• Enviarte notificaciones relacionadas con tu postulación o tu cuenta.
                        {'\n'}• Medir el uso de la plataforma y el rendimiento de nuestra publicidad, de forma agregada.
                        {'\n'}• Prevenir fraude y hacer cumplir nuestros Términos y Condiciones.
                    </Text>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>4. Con quién compartimos tus datos</Text>
                    <Text style={styles.text}>
                        No vendemos tus datos personales. Los compartimos únicamente con:
                        {'\n\n'}• <Text style={{ fontWeight: 'bold' }}>El Reclutador/Empresa</Text> de cada vacante a la que postulas (o cuyo CV subió a la plataforma) — es quien decide a quién contactar o contratar.
                        {'\n'}• <Text style={{ fontWeight: 'bold' }}>Proveedores de infraestructura y servicios</Text> que procesan datos en nuestro nombre: Google Cloud/Firebase (hosting, base de datos, almacenamiento de archivos, autenticación), Google Gemini (análisis de IA), Stripe (procesamiento de pagos — Veritly nunca ve ni almacena el número completo de tu tarjeta), nuestro proveedor de envío de correo, y las herramientas de analítica y monitoreo listadas en la sección 1.
                        {'\n'}• <Text style={{ fontWeight: 'bold' }}>Racso</Text>, nuestro partner de coaching de carrera: si decides usar Racso desde un enlace dentro de Veritly, tu interacción con ese enlace queda registrada, pero no le transferimos automáticamente tu CV ni tus datos — el registro en Racso es una decisión tuya, directamente con ellos, sujeta a sus propios términos.
                        {'\n'}• Autoridades, cuando la ley lo exija.
                    </Text>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>5. Responsabilidad del Reclutador sobre los datos que recibe</Text>
                    <Text style={styles.text}>
                        Una vez que un Reclutador accede al perfil o CV de un Candidato dentro de Veritly, ese Reclutador se convierte en responsable del tratamiento posterior de esos datos (por ejemplo, si los descarga, los contacta por fuera de la plataforma, o los usa en su propio proceso de selección). Veritly actúa como intermediario tecnológico y encargado del tratamiento mientras los datos están en la plataforma, pero <Text style={{ fontWeight: 'bold' }}>no controla ni se responsabiliza</Text> por lo que el Reclutador haga con esa información fuera de Veritly. Cada Reclutador es responsable de cumplir con la normativa de protección de datos de su país al usar la plataforma.
                    </Text>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>6. Terceros y enlaces externos</Text>
                    <Text style={styles.text}>
                        Veritly puede incluir enlaces o promociones de terceros (como Racso). No somos responsables del contenido, las prácticas de privacidad, ni de ningún daño o pérdida derivado del uso de sitios o servicios de terceros a los que accedas a través de nuestra plataforma. Tampoco somos responsables por interrupciones, fallas de seguridad o incidentes que ocurran en la infraestructura de nuestros proveedores (Google Cloud, Stripe, u otros), aunque exigimos que cumplan estándares razonables de seguridad.
                    </Text>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>7. Tus derechos</Text>
                    <Text style={styles.text}>
                        Puedes solicitar en cualquier momento: acceder a los datos que tenemos sobre ti, corregirlos, o pedir que los eliminemos de nuestros registros (incluyendo tu CV). Para ejercer estos derechos, escríbenos a <Text style={{ fontWeight: 'bold' }}>hola@veritlyapp.com</Text>. Responderemos en un plazo razonable conforme a la normativa aplicable.
                    </Text>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>8. Transparencia en Decisiones Automatizadas</Text>
                    <Text style={styles.text}>
                        {'\n'}• El Match Score es una herramienta de apoyo para el Reclutador, generada por IA.
                        {'\n'}• Veritly no toma decisiones finales de contratación de forma autónoma; los resultados son recomendaciones basadas en datos objetivos, y es el Reclutador quien decide.
                        {'\n'}• Puedes solicitar una revisión humana de tu perfil si consideras que el resultado automatizado no refleja tu idoneidad.
                    </Text>
                </View>

                <View style={{ height: 1, backgroundColor: '#E5E7EB', marginVertical: 30 }} />

                <Text style={styles.title}>Términos y Condiciones de Uso - Veritly</Text>
                <Text style={styles.date}>Última actualización: 23 de agosto de 2026</Text>

                <View style={styles.section}>
                    <Text style={styles.text}>
                        Los presentes Términos y Condiciones regulan el acceso y uso de la plataforma Veritly (en adelante, "la Plataforma"), propiedad de Relié Labs LLC (en adelante, "Relié"). Al utilizar la Plataforma, el usuario (en adelante, "el Usuario") acepta plenamente estos términos.
                    </Text>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>1. Descripción del Servicio</Text>
                    <Text style={styles.text}>
                        Veritly es una herramienta tecnológica basada en Inteligencia Artificial que facilita el emparejamiento (matching) entre perfiles profesionales de Candidatos y requerimientos de puestos de trabajo publicados por Reclutadores/Empresas. Veritly no es una bolsa de trabajo ni una agencia de empleo, y no participa en la relación laboral que eventualmente se genere entre Candidato y Reclutador.
                    </Text>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>2. Naturaleza del "Match Score"</Text>
                    <Text style={styles.text}>
                        El Usuario reconoce y acepta que:
                        {'\n\n'}• El Match Score es un indicador estadístico y referencial generado por algoritmos de procesamiento de lenguaje natural.
                        {'\n'}• Dicho puntaje representa una estimación de compatibilidad técnica y no constituye una calificación definitiva sobre la capacidad humana, ética o profesional del Candidato.
                        {'\n'}• Un puntaje alto no garantiza una entrevista ni una contratación, así como un puntaje bajo no impide que un Reclutador decida contactar al Candidato por otros criterios.
                    </Text>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>3. Exclusión de Responsabilidad</Text>
                    <Text style={styles.text}>
                        Relié, a través de Veritly, actúa únicamente como un intermediario tecnológico. En consecuencia:
                        {'\n\n'}• <Text style={{ fontWeight: 'bold' }}>No garantizamos resultados:</Text> Relié no garantiza la obtención de empleo para los Candidatos ni la cobertura de vacantes para los Reclutadores.
                        {'\n'}• <Text style={{ fontWeight: 'bold' }}>Decisiones y conducta de terceros:</Text> la decisión final de entrevistar, contratar o rechazar a un Candidato es responsabilidad exclusiva del Reclutador. Relié no interviene en las negociaciones, en los procesos de decisión humana, ni es responsable por el trato, las ofertas laborales, o cualquier comunicación que ocurra entre Candidatos y Reclutadores dentro o fuera de la Plataforma.
                        {'\n'}• <Text style={{ fontWeight: 'bold' }}>Veracidad de la información:</Text> cada Usuario es el único responsable de la veracidad y exactitud de los datos que sube (CV, descripciones de puesto, requisitos, información de la empresa, etc.). Veritly no verifica la veracidad de la información proporcionada por los Usuarios, ni la legitimidad de las vacantes publicadas por los Reclutadores.
                        {'\n'}• <Text style={{ fontWeight: 'bold' }}>Terceros y proveedores:</Text> Relié no es responsable por fallas, interrupciones o pérdidas de datos causadas por proveedores externos (Google Cloud, Stripe, servicios de correo, u otros) fuera de nuestro control razonable, ni por el contenido o las prácticas de sitios de terceros enlazados desde la Plataforma (incluyendo Racso).
                        {'\n'}• <Text style={{ fontWeight: 'bold' }}>Límite de responsabilidad:</Text> en la máxima medida permitida por la ley, la responsabilidad total de Relié frente a cualquier Usuario por el uso de la Plataforma se limita al monto efectivamente pagado por ese Usuario a Veritly en los últimos 12 meses, si lo hubiera.
                    </Text>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>4. Uso Correcto de la Plataforma</Text>
                    <Text style={styles.text}>
                        El Usuario se compromete a:
                        {'\n\n'}• No utilizar identidades falsas o suplantar a terceros.
                        {'\n'}• No publicar vacantes falsas, engañosas, discriminatorias o que soliciten pagos a los Candidatos.
                        {'\n'}• No intentar vulnerar la seguridad de los algoritmos o la infraestructura de Veritly.
                        {'\n'}• No usar los datos de Candidatos obtenidos en la Plataforma para fines distintos a un proceso de selección legítimo.
                        {'\n'}• No utilizar la Plataforma para fines ilícitos o que atenten contra la normativa de protección de datos personales de su país (en Perú, la Ley N° 29733).
                    </Text>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>5. Suscripciones y Pagos</Text>
                    <Text style={styles.text}>
                        Los planes pagos se facturan mensual o anualmente según el ciclo elegido, y se procesan a través de Stripe. Los límites de uso (vacantes activas, análisis de IA, etc.) de cada plan están descritos en la página de precios vigente al momento de la contratación. No se realizan reembolsos por periodos parciales de uso, salvo que la ley aplicable indique lo contrario.
                    </Text>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>6. Propiedad Intelectual</Text>
                    <Text style={styles.text}>
                        Todo el software, algoritmos, marcas (Relié, Veritly), logotipos y diseños asociados a la Plataforma son propiedad exclusiva de Relié Labs LLC. Queda prohibida su reproducción, ingeniería inversa o distribución sin autorización expresa por escrito.
                    </Text>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>7. Modificaciones del Servicio y de estos Términos</Text>
                    <Text style={styles.text}>
                        Relié se reserva el derecho de actualizar, modificar o suspender temporalmente funciones de la Plataforma (incluyendo el algoritmo de matching), así como de actualizar estos Términos y la Política de Privacidad. Los cambios relevantes se reflejarán con una nueva fecha de "Última actualización" en esta página.
                    </Text>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>8. Ley Aplicable y Contacto</Text>
                    <Text style={styles.text}>
                        Estos términos se rigen por las leyes de la República del Perú. Para dudas legales, de privacidad, o para ejercer tus derechos sobre tus datos, contáctanos en <Text style={{ fontWeight: 'bold' }}>hola@veritlyapp.com</Text>.
                    </Text>
                </View>

                <View style={{ height: 50 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFFFFF' },
    header: { flexDirection: 'row', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#E5E7EB', backgroundColor: '#FFFFFF' },
    backButton: { padding: 8, marginRight: 10 },
    headerTitle: { color: '#111827', fontSize: 20, fontWeight: 'bold' },
    content: { padding: 20 },
    title: { fontSize: 24, fontWeight: '900', color: '#111827', marginBottom: 10 },
    date: { color: '#6B7280', fontSize: 14, marginBottom: 30, fontStyle: 'italic' },
    section: { marginBottom: 25 },
    sectionTitle: { color: '#4F46E5', fontSize: 18, fontWeight: 'bold', marginBottom: 10 },
    text: { color: '#374151', fontSize: 15, lineHeight: 24, textAlign: 'justify' }
});
