import React, { useCallback, useMemo, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    ActivityIndicator,
    SafeAreaView,
    StatusBar,
    Platform,
    RefreshControl,
    TouchableOpacity,
    Alert,
    TextInput
} from 'react-native';
import {
    Users,
    TrendingUp,
    Clock,
    CheckCircle,
    Briefcase,
    Target,
    BarChart3,
    ArrowUpRight,
    Zap,
    UserCheck,
    UserX,
    Linkedin,
    Filter,
    Calendar,
    X,
    ChevronDown,
    DollarSign
} from 'lucide-react-native';
import { collection, doc, getDocs, query, updateDoc, where } from 'firebase/firestore';
import { auth, db } from '../../../config/firebase';
import { useFocusEffect } from 'expo-router';

// ============ TYPES ============
interface RawCandidate {
    id: string;
    jobId: string;
    jobTitle: string;
    jobStatus: string;
    jobSalaryBudget: number;
    name: string;
    matchScore: number;
    salaryExpectation: number;
    recruitmentStatus: string;
    source: string;
    analyzedAt: string;
    createdAt: string;
}

interface DashboardMetrics {
    totalJobs: number;
    totalCandidates: number;
    avgMatchScore: number;
    globalStatusCounts: Record<string, number>;
    conversionRate: number;
    linkedinSourced: number;
    cvUploaded: number;
    excelImported: number;
    externalApplicants: number;
    jobMetrics: { jobId: string; jobTitle: string; jobStatus: string; totalCandidates: number; avgMatchScore: number; topScore: number; hiredCount: number; rejectedCount: number; }[];
    topCandidateName: string;
    topCandidateScore: number;
}

const STATUS_LABELS: Record<string, string> = {
    new: 'Nuevo',
    sourcing_pending: 'Importado LI',
    pending_ai: 'Pendiente IA',
    screening: 'Screening',
    interview: 'Entrevista',
    offer: 'Oferta',
    hired: 'Contratado',
    rejected: 'Descartado',
    rejected_salary: 'Desc. Salarial',
    stored: 'Archivado',
};

const STATUS_COLORS: Record<string, string> = {
    new: '#38bdf8',
    sourcing_pending: '#4245c2',
    pending_ai: '#8b5cf6',
    screening: '#94a3b8',
    interview: '#f59e0b',
    offer: '#3b82f6',
    hired: '#10b981',
    rejected: '#ef4444',
    rejected_salary: '#f97316',
    stored: '#64748b',
};

const PIPELINE_STATUSES = ['new', 'sourcing_pending', 'screening', 'interview', 'offer', 'hired', 'rejected', 'rejected_salary'];

// ============ DATE HELPERS ============
function formatDateInput(d: Date) {
    return d.toISOString().split('T')[0]; // YYYY-MM-DD
}
function parseDate(s: string): Date | null {
    if (!s) return null;
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
}

// ============ COMPONENT ============
export default function IndicadoresDashboard() {
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [updatingDates, setUpdatingDates] = useState(false);

    // Raw data
    const [allCandidates, setAllCandidates] = useState<RawCandidate[]>([]);
    const [allJobs, setAllJobs] = useState<{ id: string; jobTitle: string; status: string }[]>([]);

    // ===== FILTERS =====
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [selectedJobId, setSelectedJobId] = useState<string>('all');
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
    const [showFilters, setShowFilters] = useState(true);

    // ===== FETCH RAW DATA =====
    const fetchData = async () => {
        if (!auth.currentUser) return;
        try {
            setLoading(true);
            const jobsQuery = query(collection(db, 'jobs'), where('companyId', '==', auth.currentUser.uid));
            const jobsSnapshot = await getDocs(jobsQuery);
            const jobs = jobsSnapshot.docs.map(d => {
                const jd = d.data() as any;
                return { id: d.id, jobTitle: jd.jobTitle || 'Sin título', status: jd.status || 'Open', salaryBudget: Number(jd.salaryBudget) || 0 };
            });
            setAllJobs(jobs);

            const candidates: RawCandidate[] = [];
            for (const job of jobs) {
                const candSnap = await getDocs(collection(db, 'jobs', job.id, 'candidates'));
                candSnap.forEach(docSnap => {
                    const data = docSnap.data();
                    const raw = data as any;
                    let dateStr = '';
                    if (raw.analyzedAt) {
                        dateStr = typeof raw.analyzedAt === 'string' ? raw.analyzedAt : (raw.analyzedAt.toDate?.().toISOString?.() || '');
                    } else if (raw.createdAt) {
                        dateStr = typeof raw.createdAt === 'string' ? raw.createdAt : (raw.createdAt.toDate?.().toISOString?.() || '');
                    } else if (raw.appliedAt) {
                        dateStr = raw.appliedAt.toDate?.().toISOString?.() || '';
                    }

                    candidates.push({
                        id: docSnap.id,
                        jobId: job.id,
                        jobTitle: job.jobTitle,
                        jobStatus: job.status,
                        jobSalaryBudget: (job as any).salaryBudget || 0,
                        name: raw.name || raw.fullName || 'Anónimo',
                        matchScore: raw.matchScore || 0,
                        salaryExpectation: Number(raw.salaryExpectation) || 0,
                        recruitmentStatus: raw.recruitmentStatus || raw.status || 'new',
                        source: raw.source || 'cv_upload',
                        analyzedAt: dateStr,
                        createdAt: raw.createdAt || dateStr,
                    });
                });
            }
            setAllCandidates(candidates);
        } catch (err) {
            console.error('Error fetching data:', err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useFocusEffect(useCallback(() => { fetchData(); }, []));

    // ===== FILTERED CANDIDATES (memoized) =====
    const filteredCandidates = useMemo(() => {
        let result = [...allCandidates];

        // Filter by job
        if (selectedJobId !== 'all') {
            result = result.filter(c => c.jobId === selectedJobId);
        }

        // Filter by job active/inactive
        if (statusFilter === 'active') {
            result = result.filter(c => c.jobStatus !== 'Closed');
        } else if (statusFilter === 'inactive') {
            result = result.filter(c => c.jobStatus === 'Closed');
        }

        // Filter by date range
        if (dateFrom) {
            const from = new Date(dateFrom);
            from.setHours(0, 0, 0, 0);
            result = result.filter(c => {
                const d = parseDate(c.analyzedAt);
                return d ? d >= from : true;
            });
        }
        if (dateTo) {
            const to = new Date(dateTo);
            to.setHours(23, 59, 59, 999);
            result = result.filter(c => {
                const d = parseDate(c.analyzedAt);
                return d ? d <= to : true;
            });
        }

        return result;
    }, [allCandidates, selectedJobId, statusFilter, dateFrom, dateTo]);

    // ===== COMPUTE METRICS from filtered data =====
    const metrics: DashboardMetrics = useMemo(() => {
        const candidates = filteredCandidates;
        const jobIds = new Set(candidates.map(c => c.jobId));

        let totalMatchScore = 0;
        let scoredCount = 0;
        const globalStatusCounts: Record<string, number> = {};
        let linkedinSourced = 0, cvUploaded = 0, excelImported = 0, externalApplicants = 0;
        let topName = '', topScore = 0;

        // Job-level metrics
        const jobMap: Record<string, { total: number; scoreSum: number; scoredCount: number; top: number; hired: number; rejected: number; title: string; status: string; salaryBudget: number; salaryExpSum: number; salaryExpCount: number; salaryExpMin: number; salaryExpMax: number }> = {};

        for (const c of candidates) {
            // Status
            const st = c.recruitmentStatus;
            globalStatusCounts[st] = (globalStatusCounts[st] || 0) + 1;

            // Source
            if (c.source === 'veritly_sourcing') linkedinSourced++;
            else if (c.source === 'external_link') externalApplicants++;
            else if (c.source === 'excel_import') excelImported++;
            else cvUploaded++;

            // Score
            if (c.matchScore > 0) {
                totalMatchScore += c.matchScore;
                scoredCount++;
                if (c.matchScore > topScore) { topScore = c.matchScore; topName = c.name; }
            }

            // Per-job
            if (!jobMap[c.jobId]) {
                jobMap[c.jobId] = { total: 0, scoreSum: 0, scoredCount: 0, top: 0, hired: 0, rejected: 0, title: c.jobTitle, status: c.jobStatus, salaryBudget: c.jobSalaryBudget, salaryExpSum: 0, salaryExpCount: 0, salaryExpMin: Infinity, salaryExpMax: 0 };
            }
            const jm = jobMap[c.jobId];
            jm.total++;
            if (c.matchScore > 0) { jm.scoreSum += c.matchScore; jm.scoredCount++; if (c.matchScore > jm.top) jm.top = c.matchScore; }
            if (st === 'hired') jm.hired++;
            if (st === 'rejected' || st === 'rejected_salary') jm.rejected++;
            if (c.salaryExpectation > 0) {
                jm.salaryExpSum += c.salaryExpectation;
                jm.salaryExpCount++;
                if (c.salaryExpectation < jm.salaryExpMin) jm.salaryExpMin = c.salaryExpectation;
                if (c.salaryExpectation > jm.salaryExpMax) jm.salaryExpMax = c.salaryExpectation;
            }
        }

        const jobMetrics = Object.entries(jobMap).map(([id, jm]) => ({
            jobId: id,
            jobTitle: jm.title,
            jobStatus: jm.status,
            totalCandidates: jm.total,
            avgMatchScore: jm.scoredCount > 0 ? Math.round(jm.scoreSum / jm.scoredCount) : 0,
            topScore: jm.top,
            hiredCount: jm.hired,
            rejectedCount: jm.rejected,
            salaryBudget: jm.salaryBudget,
            avgSalaryExpectation: jm.salaryExpCount > 0 ? Math.round(jm.salaryExpSum / jm.salaryExpCount) : 0,
            minSalaryExpectation: jm.salaryExpMin === Infinity ? 0 : jm.salaryExpMin,
            maxSalaryExpectation: jm.salaryExpMax,
        })).sort((a, b) => b.totalCandidates - a.totalCandidates);

        const hiredTotal = globalStatusCounts['hired'] || 0;

        return {
            totalJobs: jobIds.size,
            totalCandidates: candidates.length,
            avgMatchScore: scoredCount > 0 ? Math.round(totalMatchScore / scoredCount) : 0,
            globalStatusCounts,
            conversionRate: candidates.length > 0 ? Math.round((hiredTotal / candidates.length) * 100) : 0,
            linkedinSourced,
            cvUploaded,
            excelImported,
            externalApplicants,
            jobMetrics,
            topCandidateName: topName,
            topCandidateScore: topScore,
            globalAvgSalaryExpectation: scoredCount > 0 ? Math.round(totalMatchScore / scoredCount) : 0, // Placeholder for actual calc below
        };
    }, [filteredCandidates]);

    const globalMetrics = useMemo(() => {
        const candidatesWithSalary = filteredCandidates.filter(c => c.salaryExpectation > 0);
        const avg = candidatesWithSalary.length > 0 
            ? Math.round(candidatesWithSalary.reduce((acc, c) => acc + c.salaryExpectation, 0) / candidatesWithSalary.length)
            : 0;
        return { avgSalary: avg };
    }, [filteredCandidates]);

    // ===== SYNC DATES =====
    const handleSyncDates = async () => {
        if (!auth.currentUser) return;
        const confirmMsg = '¿Actualizar la fecha de todos los candidatos existentes a hoy?';
        const proceed = Platform.OS === 'web' ? window.confirm(confirmMsg) : await new Promise<boolean>((resolve) => {
            Alert.alert('Sincronizar Fechas', confirmMsg, [
                { text: 'Cancelar', onPress: () => resolve(false), style: 'cancel' },
                { text: 'Sí', onPress: () => resolve(true) }
            ]);
        });
        if (!proceed) return;

        setUpdatingDates(true);
        try {
            const today = new Date().toISOString();
            let count = 0;
            for (const job of allJobs) {
                const snap = await getDocs(collection(db, 'jobs', job.id, 'candidates'));
                for (const candDoc of snap.docs) {
                    await updateDoc(doc(db, 'jobs', job.id, 'candidates', candDoc.id), { analyzedAt: today, createdAt: today });
                    count++;
                }
            }
            const msg = `✅ ${count} candidatos actualizados.`;
            Platform.OS === 'web' ? alert(msg) : Alert.alert('Éxito', msg);
            fetchData();
        } catch (err: any) {
            const msg = 'Error: ' + err.message;
            Platform.OS === 'web' ? alert(msg) : Alert.alert('Error', msg);
        } finally {
            setUpdatingDates(false);
        }
    };

    const clearFilters = () => {
        setDateFrom('');
        setDateTo('');
        setSelectedJobId('all');
        setStatusFilter('all');
    };

    const hasActiveFilters = dateFrom || dateTo || selectedJobId !== 'all' || statusFilter !== 'all';

    // ===== LOADING =====
    if (loading && !refreshing) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large" color="#3b82f6" />
                <Text style={styles.loadingText}>Calculando indicadores...</Text>
            </View>
        );
    }

    // ===== RENDER =====
    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
            <ScrollView
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} tintColor="#3b82f6" />}
                contentContainerStyle={[
                    styles.scrollContent,
                    Platform.OS === 'web' && { maxWidth: 1100, alignSelf: 'center' as any, width: '100%' }
                ]}
            >
                {/* Header */}
                <View style={styles.header}>
                    <View>
                        <Text style={styles.title}>Indicadores</Text>
                        <Text style={styles.subtitle}>Métricas de tu proceso de reclutamiento</Text>
                    </View>
                    <TouchableOpacity
                        style={[styles.filterToggle, hasActiveFilters && styles.filterToggleActive]}
                        onPress={() => setShowFilters(!showFilters)}
                    >
                        <Filter color={hasActiveFilters ? '#38bdf8' : '#94a3b8'} size={16} />
                        <Text style={[styles.filterToggleText, hasActiveFilters && { color: '#38bdf8' }]}>
                            Filtros{hasActiveFilters ? ' ●' : ''}
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* ===== FILTERS PANEL ===== */}
                {showFilters && (
                    <View style={styles.filtersPanel}>
                        <View style={styles.filtersPanelHeader}>
                            <Text style={styles.filtersPanelTitle}>Filtros</Text>
                            {hasActiveFilters && (
                                <TouchableOpacity onPress={clearFilters} style={styles.clearFiltersBtn}>
                                    <X color="#ef4444" size={14} />
                                    <Text style={styles.clearFiltersText}>Limpiar</Text>
                                </TouchableOpacity>
                            )}
                        </View>

                        {/* Date Range */}
                        <View style={styles.filterRow}>
                            <Calendar color="#94a3b8" size={16} />
                            <Text style={styles.filterLabel}>Rango de Fechas</Text>
                        </View>
                        <View style={styles.dateRow}>
                            <View style={styles.dateInputWrap}>
                                <Text style={styles.dateInputLabel}>Desde</Text>
                                <TextInput
                                    style={styles.dateInput}
                                    value={dateFrom}
                                    onChangeText={setDateFrom}
                                    placeholder="YYYY-MM-DD"
                                    placeholderTextColor="#475569"
                                    maxLength={10}
                                />
                            </View>
                            <View style={styles.dateInputWrap}>
                                <Text style={styles.dateInputLabel}>Hasta</Text>
                                <TextInput
                                    style={styles.dateInput}
                                    value={dateTo}
                                    onChangeText={setDateTo}
                                    placeholder="YYYY-MM-DD"
                                    placeholderTextColor="#475569"
                                    maxLength={10}
                                />
                            </View>
                        </View>

                        {/* Quick date buttons */}
                        <View style={styles.quickDatesRow}>
                            <TouchableOpacity style={styles.quickDateBtn} onPress={() => {
                                const now = new Date();
                                setDateFrom(formatDateInput(new Date(now.getFullYear(), now.getMonth(), 1)));
                                setDateTo(formatDateInput(now));
                            }}>
                                <Text style={styles.quickDateText}>Este Mes</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.quickDateBtn} onPress={() => {
                                const now = new Date();
                                const start = new Date(now);
                                start.setDate(start.getDate() - 7);
                                setDateFrom(formatDateInput(start));
                                setDateTo(formatDateInput(now));
                            }}>
                                <Text style={styles.quickDateText}>Última Semana</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.quickDateBtn} onPress={() => {
                                const now = new Date();
                                const start = new Date(now);
                                start.setDate(start.getDate() - 30);
                                setDateFrom(formatDateInput(start));
                                setDateTo(formatDateInput(now));
                            }}>
                                <Text style={styles.quickDateText}>30 Días</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Job Filter */}
                        <View style={styles.filterRow}>
                            <Briefcase color="#94a3b8" size={16} />
                            <Text style={styles.filterLabel}>Vacante</Text>
                        </View>
                        <View style={styles.jobFilterScroll}>
                            <TouchableOpacity
                                style={[styles.jobFilterChip, selectedJobId === 'all' && styles.jobFilterChipActive]}
                                onPress={() => setSelectedJobId('all')}
                            >
                                <Text style={[styles.jobFilterChipText, selectedJobId === 'all' && styles.jobFilterChipTextActive]}>Todas</Text>
                            </TouchableOpacity>
                            {allJobs.map(job => (
                                <TouchableOpacity
                                    key={job.id}
                                    style={[styles.jobFilterChip, selectedJobId === job.id && styles.jobFilterChipActive]}
                                    onPress={() => setSelectedJobId(job.id)}
                                >
                                    <Text style={[styles.jobFilterChipText, selectedJobId === job.id && styles.jobFilterChipTextActive]} numberOfLines={1}>
                                        {job.jobTitle}
                                    </Text>
                                    <View style={[styles.jobStatusDot, { backgroundColor: job.status === 'Closed' ? '#64748b' : '#10b981' }]} />
                                </TouchableOpacity>
                            ))}
                        </View>

                        {/* Active / Inactive */}
                        <View style={styles.filterRow}>
                            <Target color="#94a3b8" size={16} />
                            <Text style={styles.filterLabel}>Estado de Vacante</Text>
                        </View>
                        <View style={styles.statusFilterRow}>
                            {(['all', 'active', 'inactive'] as const).map(opt => (
                                <TouchableOpacity
                                    key={opt}
                                    style={[styles.statusFilterBtn, statusFilter === opt && styles.statusFilterBtnActive]}
                                    onPress={() => setStatusFilter(opt)}
                                >
                                    <Text style={[styles.statusFilterText, statusFilter === opt && styles.statusFilterTextActive]}>
                                        {opt === 'all' ? 'Todas' : opt === 'active' ? 'Activas' : 'Inactivas'}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                )}

                {/* Active filter summary */}
                {hasActiveFilters && !showFilters && (
                    <View style={styles.activeFiltersSummary}>
                        <Text style={styles.activeFiltersText}>
                            Filtros activos: {selectedJobId !== 'all' ? allJobs.find(j => j.id === selectedJobId)?.jobTitle + ' • ' : ''}
                            {statusFilter !== 'all' ? (statusFilter === 'active' ? 'Solo activas • ' : 'Solo inactivas • ') : ''}
                            {dateFrom ? `Desde ${dateFrom} ` : ''}{dateTo ? `Hasta ${dateTo}` : ''}
                        </Text>
                        <TouchableOpacity onPress={clearFilters}>
                            <X color="#ef4444" size={14} />
                        </TouchableOpacity>
                    </View>
                )}

                {/* ===== KPI CARDS ===== */}
                <View style={styles.kpiRow}>
                    <View style={[styles.kpiCard, { borderLeftColor: '#3b82f6' }]}>
                        <Briefcase color="#3b82f6" size={22} />
                        <Text style={styles.kpiValue}>{metrics.totalJobs}</Text>
                        <Text style={styles.kpiLabel}>Vacantes</Text>
                    </View>
                    <View style={[styles.kpiCard, { borderLeftColor: '#10b981' }]}>
                        <Users color="#10b981" size={22} />
                        <Text style={styles.kpiValue}>{metrics.totalCandidates}</Text>
                        <Text style={styles.kpiLabel}>Candidatos</Text>
                    </View>
                </View>
                <View style={styles.kpiRow}>
                    <View style={[styles.kpiCard, { borderLeftColor: '#f59e0b' }]}>
                        <Target color="#f59e0b" size={22} />
                        <Text style={styles.kpiValue}>{metrics.avgMatchScore}%</Text>
                        <Text style={styles.kpiLabel}>Match Promedio</Text>
                    </View>
                    <View style={[styles.kpiCard, { borderLeftColor: '#10b981' }]}>
                        <DollarSign color="#10b981" size={22} />
                        <Text style={styles.kpiValue}>S/ {globalMetrics.avgSalary.toLocaleString()}</Text>
                        <Text style={styles.kpiLabel}>Pretensión Prom.</Text>
                    </View>
                </View>

                {/* Conversion and other metrics */}
                <View style={[styles.kpiCard, { borderLeftColor: '#8b5cf6', width: '100%', flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 25, marginBottom: 12 }]}>
                    <View style={{flexDirection: 'row', alignItems: 'center', gap: 10}}>
                        <TrendingUp color="#8b5cf6" size={22} />
                        <Text style={styles.kpiLabel}>Tasa de Conversión</Text>
                    </View>
                    <Text style={styles.kpiValue}>{metrics.conversionRate}%</Text>
                </View>

                {/* ===== PIPELINE FUNNEL ===== */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <BarChart3 color="#38bdf8" size={20} />
                        <Text style={styles.sectionTitle}>Embudo de Pipeline</Text>
                    </View>
                    {PIPELINE_STATUSES.map(status => {
                        const count = metrics.globalStatusCounts[status] || 0;
                        const pct = metrics.totalCandidates > 0 ? (count / metrics.totalCandidates) * 100 : 0;
                        return (
                            <View key={status} style={styles.funnelRow}>
                                <View style={styles.funnelLabelRow}>
                                    <View style={[styles.funnelDot, { backgroundColor: STATUS_COLORS[status] || '#64748b' }]} />
                                    <Text style={styles.funnelLabel}>{STATUS_LABELS[status] || status}</Text>
                                    <Text style={styles.funnelCount}>{count}</Text>
                                </View>
                                <View style={styles.funnelBarBg}>
                                    <View style={[styles.funnelBarFill, { width: `${Math.max(pct, 1)}%`, backgroundColor: STATUS_COLORS[status] || '#64748b' }]} />
                                </View>
                            </View>
                        );
                    })}
                </View>

                {/* ===== SOURCES ===== */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Zap color="#f59e0b" size={20} />
                        <Text style={styles.sectionTitle}>Fuentes de Candidatos</Text>
                    </View>
                    <View style={styles.sourceGrid}>
                        <View style={styles.sourceCard}>
                            <Linkedin color="#0077B5" size={24} />
                            <Text style={styles.sourceValue}>{metrics.linkedinSourced}</Text>
                            <Text style={styles.sourceLabel}>LinkedIn Sourcing</Text>
                        </View>
                        <View style={styles.sourceCard}>
                            <Users color="#3b82f6" size={24} />
                            <Text style={styles.sourceValue}>{metrics.cvUploaded}</Text>
                            <Text style={styles.sourceLabel}>CVs Subidos</Text>
                        </View>
                        <View style={styles.sourceCard}>
                            <ArrowUpRight color="#10b981" size={24} />
                            <Text style={styles.sourceValue}>{metrics.externalApplicants}</Text>
                            <Text style={styles.sourceLabel}>Portal Externo</Text>
                        </View>
                        <View style={styles.sourceCard}>
                            <BarChart3 color="#8b5cf6" size={24} />
                            <Text style={styles.sourceValue}>{metrics.excelImported}</Text>
                            <Text style={styles.sourceLabel}>Excel Import</Text>
                        </View>
                    </View>
                </View>

                {/* ===== HIGHLIGHTS ===== */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <TrendingUp color="#10b981" size={20} />
                        <Text style={styles.sectionTitle}>Highlights</Text>
                    </View>
                    <View style={styles.highlightRow}>
                        <View style={styles.highlightCard}>
                            <UserCheck color="#10b981" size={20} />
                            <View style={{ flex: 1, marginLeft: 12 }}>
                                <Text style={styles.highlightValue}>{metrics.globalStatusCounts['hired'] || 0}</Text>
                                <Text style={styles.highlightLabel}>Contratados</Text>
                            </View>
                        </View>
                        <View style={styles.highlightCard}>
                            <UserX color="#ef4444" size={20} />
                            <View style={{ flex: 1, marginLeft: 12 }}>
                                <Text style={styles.highlightValue}>{(metrics.globalStatusCounts['rejected'] || 0) + (metrics.globalStatusCounts['rejected_salary'] || 0)}</Text>
                                <Text style={styles.highlightLabel}>Descartados</Text>
                            </View>
                        </View>
                    </View>
                    <View style={styles.highlightRow}>
                        <View style={styles.highlightCard}>
                            <Clock color="#f59e0b" size={20} />
                            <View style={{ flex: 1, marginLeft: 12 }}>
                                <Text style={styles.highlightValue}>{metrics.globalStatusCounts['interview'] || 0}</Text>
                                <Text style={styles.highlightLabel}>En Entrevista</Text>
                            </View>
                        </View>
                        <View style={styles.highlightCard}>
                            <CheckCircle color="#3b82f6" size={20} />
                            <View style={{ flex: 1, marginLeft: 12 }}>
                                <Text style={styles.highlightValue}>{metrics.globalStatusCounts['offer'] || 0}</Text>
                                <Text style={styles.highlightLabel}>Con Oferta</Text>
                            </View>
                        </View>
                    </View>
                    {metrics.topCandidateName ? (
                        <View style={styles.topCandidateCard}>
                            <Text style={styles.topCandidateLabel}>🏆 Mejor Candidato</Text>
                            <Text style={styles.topCandidateName}>{metrics.topCandidateName}</Text>
                            <Text style={styles.topCandidateScore}>Match Score: {metrics.topCandidateScore}%</Text>
                        </View>
                    ) : null}
                </View>

                {/* ===== PER-JOB BREAKDOWN ===== */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Briefcase color="#38bdf8" size={20} />
                        <Text style={styles.sectionTitle}>Detalle por Vacante</Text>
                    </View>
                    {metrics.jobMetrics.map(job => (
                        <View key={job.jobId} style={[styles.jobBreakdownCard, job.jobStatus === 'Closed' && { opacity: 0.6, borderLeftWidth: 3, borderLeftColor: '#64748b' }]}>
                            <View style={styles.jobBreakdownHeader}>
                                <Text style={styles.jobBreakdownTitle} numberOfLines={1}>{job.jobTitle}</Text>
                                <View style={styles.jobBreakdownBadges}>
                                    <View style={[styles.jobBreakdownBadge, job.jobStatus === 'Closed' && { backgroundColor: 'rgba(100,116,139,0.15)' }]}>
                                        <Text style={[styles.jobBreakdownBadgeText, job.jobStatus === 'Closed' && { color: '#64748b' }]}>{job.totalCandidates} cand.</Text>
                                    </View>
                                    <View style={[styles.jobStatusBadge, { backgroundColor: job.jobStatus === 'Closed' ? 'rgba(100,116,139,0.15)' : 'rgba(16,185,129,0.15)' }]}>
                                        <Text style={{ color: job.jobStatus === 'Closed' ? '#64748b' : '#10b981', fontSize: 9, fontWeight: '800' }}>
                                            {job.jobStatus === 'Closed' ? 'INACTIVA' : 'ACTIVA'}
                                        </Text>
                                    </View>
                                </View>
                            </View>
                            <View style={styles.jobBreakdownStats}>
                                <View style={styles.jobStat}>
                                    <Text style={styles.jobStatValue}>{job.avgMatchScore}%</Text>
                                    <Text style={styles.jobStatLabel}>Avg. Match</Text>
                                </View>
                                <View style={styles.jobStat}>
                                    <Text style={[styles.jobStatValue, { color: '#10b981' }]}>{job.topScore}%</Text>
                                    <Text style={styles.jobStatLabel}>Top Score</Text>
                                </View>
                                <View style={styles.jobStat}>
                                    <Text style={[styles.jobStatValue, { color: '#10b981' }]}>{job.hiredCount}</Text>
                                    <Text style={styles.jobStatLabel}>Contratados</Text>
                                </View>
                                <View style={styles.jobStat}>
                                    <Text style={[styles.jobStatValue, { color: '#ef4444' }]}>{job.rejectedCount}</Text>
                                    <Text style={styles.jobStatLabel}>Rechazados</Text>
                                </View>
                            </View>
                            {/* Salary Range */}
                            {(job.salaryBudget > 0 || job.avgSalaryExpectation > 0) && (
                                <View style={styles.salaryRangeRow}>
                                    {job.salaryBudget > 0 && (
                                        <View style={styles.salaryChip}>
                                            <Text style={styles.salaryChipLabel}>💼 Presupuesto</Text>
                                            <Text style={styles.salaryChipValue}>S/ {job.salaryBudget.toLocaleString()}</Text>
                                        </View>
                                    )}
                                    {job.avgSalaryExpectation > 0 && (
                                        <View style={styles.salaryChip}>
                                            <Text style={styles.salaryChipLabel}>👤 Pretensión Prom.</Text>
                                            <Text style={[styles.salaryChipValue, { color: job.avgSalaryExpectation > job.salaryBudget && job.salaryBudget > 0 ? '#f97316' : '#10b981' }]}>
                                                S/ {job.avgSalaryExpectation.toLocaleString()}
                                            </Text>
                                            {job.minSalaryExpectation > 0 && (
                                                <Text style={styles.salaryChipRange}>
                                                    Rango: S/ {job.minSalaryExpectation.toLocaleString()} - S/ {job.maxSalaryExpectation.toLocaleString()}
                                                </Text>
                                            )}
                                        </View>
                                    )}
                                </View>
                            )}
                        </View>
                    ))}
                    {metrics.jobMetrics.length === 0 && (
                        <Text style={{ color: '#64748b', textAlign: 'center', padding: 20 }}>
                            {hasActiveFilters ? 'No hay resultados con los filtros seleccionados.' : 'No hay vacantes activas.'}
                        </Text>
                    )}
                </View>




                <View style={styles.footer}>
                    <Text style={styles.footerText}>Veritly ATS • Indicadores en tiempo real</Text>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

// ============ STYLES ============
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0f172a' },
    centered: { flex: 1, backgroundColor: '#0f172a', justifyContent: 'center', alignItems: 'center' },
    loadingText: { color: '#38bdf8', marginTop: 15, fontWeight: 'bold' },
    scrollContent: { padding: 20, paddingBottom: 50 },

    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, marginTop: 10 },
    title: { color: 'white', fontSize: 26, fontWeight: '900' },
    subtitle: { color: '#94a3b8', fontSize: 13, marginTop: 2 },

    // Filter toggle button
    filterToggle: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#1e293b', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: '#334155' },
    filterToggleActive: { borderColor: '#38bdf8', backgroundColor: 'rgba(56, 189, 248, 0.08)' },
    filterToggleText: { color: '#94a3b8', fontSize: 13, fontWeight: '600' },

    // Filters Panel
    filtersPanel: { backgroundColor: '#1e293b', borderRadius: 16, padding: 18, marginBottom: 16, borderWidth: 2, borderColor: '#3b82f6', shadowColor: '#3b82f6', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 5 },
    filtersPanelHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
    filtersPanelTitle: { color: 'white', fontSize: 16, fontWeight: '800' },
    clearFiltersBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, backgroundColor: 'rgba(239, 68, 68, 0.1)' },
    clearFiltersText: { color: '#ef4444', fontSize: 12, fontWeight: '600' },

    filterRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8, marginTop: 6 },
    filterLabel: { color: '#cbd5e1', fontSize: 13, fontWeight: '600' },

    dateRow: { flexDirection: 'row', gap: 10, marginBottom: 8 },
    dateInputWrap: { flex: 1 },
    dateInputLabel: { color: '#64748b', fontSize: 10, fontWeight: '600', marginBottom: 4 },
    dateInput: { backgroundColor: '#0f172a', color: 'white', padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#334155', fontSize: 13 },

    quickDatesRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
    quickDateBtn: { backgroundColor: 'rgba(56, 189, 248, 0.08)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(56, 189, 248, 0.2)' },
    quickDateText: { color: '#38bdf8', fontSize: 11, fontWeight: '600' },

    jobFilterScroll: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
    jobFilterChip: { backgroundColor: '#0f172a', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: '#334155', flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: 200 },
    jobFilterChipActive: { borderColor: '#38bdf8', backgroundColor: 'rgba(56, 189, 248, 0.1)' },
    jobFilterChipText: { color: '#94a3b8', fontSize: 12, fontWeight: '500' },
    jobFilterChipTextActive: { color: '#38bdf8' },
    jobStatusDot: { width: 6, height: 6, borderRadius: 3 },

    statusFilterRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
    statusFilterBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8, backgroundColor: '#0f172a', borderWidth: 1, borderColor: '#334155' },
    statusFilterBtnActive: { borderColor: '#38bdf8', backgroundColor: 'rgba(56, 189, 248, 0.1)' },
    statusFilterText: { color: '#94a3b8', fontSize: 12, fontWeight: '600' },
    statusFilterTextActive: { color: '#38bdf8' },

    activeFiltersSummary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(56, 189, 248, 0.06)', padding: 10, borderRadius: 10, marginBottom: 14, borderWidth: 1, borderColor: 'rgba(56, 189, 248, 0.15)' },
    activeFiltersText: { color: '#38bdf8', fontSize: 11, fontWeight: '500', flex: 1 },

    // KPI Cards
    kpiRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
    kpiCard: { flex: 1, backgroundColor: '#1e293b', borderRadius: 16, padding: 18, borderLeftWidth: 4, borderWidth: 1, borderColor: '#334155', alignItems: 'center' },
    kpiValue: { color: 'white', fontSize: 28, fontWeight: '900', marginVertical: 6 },
    kpiLabel: { color: '#94a3b8', fontSize: 11, fontWeight: '600', textAlign: 'center', textTransform: 'uppercase' },

    // Sections
    section: { backgroundColor: '#1e293b', borderRadius: 20, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: '#334155' },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 18 },
    sectionTitle: { color: 'white', fontSize: 16, fontWeight: '800' },

    // Funnel
    funnelRow: { marginBottom: 12 },
    funnelLabelRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
    funnelDot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
    funnelLabel: { color: '#cbd5e1', fontSize: 13, flex: 1, fontWeight: '500' },
    funnelCount: { color: 'white', fontWeight: '800', fontSize: 14, minWidth: 30, textAlign: 'right' },
    funnelBarBg: { height: 8, backgroundColor: '#0f172a', borderRadius: 4, overflow: 'hidden' },
    funnelBarFill: { height: '100%', borderRadius: 4 },

    // Sources
    sourceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    sourceCard: { width: '47%' as any, backgroundColor: '#0f172a', borderRadius: 14, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: '#334155' },
    sourceValue: { color: 'white', fontSize: 24, fontWeight: '900', marginTop: 8, marginBottom: 4 },
    sourceLabel: { color: '#94a3b8', fontSize: 11, fontWeight: '600', textAlign: 'center' },

    // Highlights
    highlightRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
    highlightCard: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#0f172a', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#334155' },
    highlightValue: { color: 'white', fontSize: 20, fontWeight: '900' },
    highlightLabel: { color: '#94a3b8', fontSize: 11, fontWeight: '600' },
    topCandidateCard: { backgroundColor: 'rgba(245, 158, 11, 0.08)', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: 'rgba(245, 158, 11, 0.2)', marginTop: 10, alignItems: 'center' },
    topCandidateLabel: { color: '#fcd34d', fontSize: 12, fontWeight: '700', marginBottom: 6 },
    topCandidateName: { color: 'white', fontSize: 16, fontWeight: '800' },
    topCandidateScore: { color: '#f59e0b', fontSize: 14, fontWeight: '700', marginTop: 4 },

    // Job Breakdown
    jobBreakdownCard: { backgroundColor: '#0f172a', borderRadius: 14, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: '#334155' },
    jobBreakdownHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    jobBreakdownTitle: { color: 'white', fontSize: 14, fontWeight: '700', flex: 1, marginRight: 10 },
    jobBreakdownBadges: { flexDirection: 'row', gap: 6 },
    jobBreakdownBadge: { backgroundColor: 'rgba(59, 130, 246, 0.15)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
    jobBreakdownBadgeText: { color: '#3b82f6', fontSize: 11, fontWeight: '700' },
    jobStatusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20 },
    jobBreakdownStats: { flexDirection: 'row', justifyContent: 'space-around' },
    jobStat: { alignItems: 'center' },
    jobStatValue: { color: 'white', fontSize: 16, fontWeight: '800' },
    jobStatLabel: { color: '#64748b', fontSize: 10, fontWeight: '600', marginTop: 2 },

    // Salary Range
    salaryRangeRow: { flexDirection: 'row', gap: 8, marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#1e293b' },
    salaryChip: { flex: 1, backgroundColor: '#1e293b', borderRadius: 10, padding: 10, alignItems: 'center' },
    salaryChipLabel: { color: '#94a3b8', fontSize: 10, fontWeight: '600', marginBottom: 4 },
    salaryChipValue: { color: '#10b981', fontSize: 15, fontWeight: '800' },
    salaryChipRange: { color: '#64748b', fontSize: 9, marginTop: 3 },

    // Sync
    syncButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#f59e0b', padding: 14, borderRadius: 12 },
    syncButtonText: { color: 'white', fontWeight: '800', fontSize: 14 },
    syncHint: { color: '#64748b', fontSize: 11, textAlign: 'center', marginTop: 8 },

    footer: { marginTop: 10, alignItems: 'center' },
    footerText: { color: '#475569', fontSize: 11, fontWeight: '600' },
});
