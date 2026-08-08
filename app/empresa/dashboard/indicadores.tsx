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
    DollarSign,
    RotateCw
} from 'lucide-react-native';
import { collection, doc, getDocs, query, updateDoc, where } from 'firebase/firestore';
import { auth, db } from '../../../config/firebase';
import { useFocusEffect } from 'expo-router';

const TooltipWrapper = Platform.OS === 'web' 
  ? ({ title, children, style }: any) => <div title={title} style={{ display: 'flex', flexDirection: 'column', ...style }}>{children}</div>
  : ({ children, style }: any) => <View style={style}>{children}</View>;

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
    failureReason: string;
    source: string;
    analyzedAt: string;
    createdAt: string;
}

interface DashboardMetrics {
    totalJobs: number;
    totalCandidates: number;
    avgMatchScore: number;
    globalStatusCounts: Record<string, number>;
    rejectionReasons: { reason: string; count: number }[];
    conversionRate: number;
    linkedinSourced: number;
    cvUploaded: number;
    excelImported: number;
    externalApplicants: number;
    jobMetrics: {
        jobId: string; jobTitle: string; jobStatus: string; totalCandidates: number;
        avgMatchScore: number; topScore: number; hiredCount: number; rejectedCount: number;
        salaryBudget: number; avgSalaryExpectation: number; minSalaryExpectation: number; maxSalaryExpectation: number;
    }[];
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

    // Gesture state for Web pull-to-refresh
    const [pullDistance, setPullDistance] = useState(0);
    const [isPulling, setIsPulling] = useState(false);
    const [startY, setStartY] = useState(0);
    const [isAtTop, setIsAtTop] = useState(true);

    const handleTouchStart = (e: any) => {
        if (Platform.OS !== 'web') return;
        if (isAtTop) {
            setStartY(e.touches[0].clientY);
            setIsPulling(true);
        }
    };

    const handleTouchMove = (e: any) => {
        if (Platform.OS !== 'web' || !isPulling) return;
        const currentY = e.touches[0].clientY;
        const diff = currentY - startY;
        if (diff > 0) {
            const distance = Math.min(diff * 0.4, 100);
            setPullDistance(distance);
            if (e.cancelable) e.preventDefault();
        }
    };

    const handleTouchEnd = () => {
        if (Platform.OS !== 'web') return;
        if (isPulling) {
            if (pullDistance > 50 && !refreshing) {
                setRefreshing(true);
                fetchData();
            }
            setPullDistance(0);
            setIsPulling(false);
            setStartY(0);
        }
    };

    const handleScroll = (e: any) => {
        const yOffset = e.nativeEvent.contentOffset.y;
        setIsAtTop(yOffset <= 0);
    };

    const renderWebRefreshIndicator = () => {
        if (Platform.OS !== 'web') return null;
        if (pullDistance === 0 && !refreshing) return null;
        
        return (
            <View style={{
                alignItems: 'center',
                justifyContent: 'center',
                height: refreshing ? 60 : pullDistance,
                overflow: 'hidden',
                opacity: refreshing ? 1 : Math.min(pullDistance / 50, 1),
                backgroundColor: 'transparent',
                paddingVertical: 10
            }}>
                <ActivityIndicator size="small" color="#4F46E5" />
                <Text style={{ fontSize: 10, color: '#4B5563', marginTop: 4 }}>
                    {refreshing ? "Actualizando..." : (pullDistance > 45 ? "Suelta para actualizar" : "Desliza para actualizar")}
                </Text>
            </View>
        );
    };

    // Raw data
    const [allCandidates, setAllCandidates] = useState<RawCandidate[]>([]);
    const [allJobs, setAllJobs] = useState<{ id: string; jobTitle: string; status: string }[]>([]);

    // ===== FILTERS =====
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [selectedJobId, setSelectedJobId] = useState<string>('all');
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
    const [showFilters, setShowFilters] = useState(true);
    const [jobDetailSearch, setJobDetailSearch] = useState('');
    const [showAllJobDetails, setShowAllJobDetails] = useState(false);
    const JOB_DETAIL_PREVIEW_COUNT = 5;

    // ===== FETCH RAW DATA =====
    const fetchData = async () => {
        if (!auth.currentUser) return;
        try {
            if (allJobs.length === 0) {
                setLoading(true);
            }
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
                        failureReason: raw.failureReason || '',
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
        const rejectionReasonCounts: Record<string, number> = {};
        let linkedinSourced = 0, cvUploaded = 0, excelImported = 0, externalApplicants = 0;
        let topName = '', topScore = 0;

        // Job-level metrics
        const jobMap: Record<string, { total: number; scoreSum: number; scoredCount: number; top: number; hired: number; rejected: number; title: string; status: string; salaryBudget: number; salaryExpSum: number; salaryExpCount: number; salaryExpMin: number; salaryExpMax: number }> = {};

        for (const c of candidates) {
            // Status
            const st = c.recruitmentStatus;
            globalStatusCounts[st] = (globalStatusCounts[st] || 0) + 1;

            // Motivo de rechazo
            if (st === 'rejected' || st === 'rejected_salary') {
                const reason = c.failureReason || 'Rechazado manualmente por la empresa';
                rejectionReasonCounts[reason] = (rejectionReasonCounts[reason] || 0) + 1;
            }

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
            // Ignoramos valores fuera de rango razonable (datos mal ingresados) para
            // que un outlier no distorsione el promedio mostrado.
            if (c.salaryExpectation > 0 && c.salaryExpectation <= 500000) {
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

        const rejectionReasons = Object.entries(rejectionReasonCounts)
            .map(([reason, count]) => ({ reason, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 6);

        return {
            totalJobs: jobIds.size,
            totalCandidates: candidates.length,
            avgMatchScore: scoredCount > 0 ? Math.round(totalMatchScore / scoredCount) : 0,
            globalStatusCounts,
            rejectionReasons,
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

    // ===== JOB DETAIL LIST: buscador + "ver todas" para no listar cientos de vacantes de golpe =====
    const visibleJobDetails = useMemo(() => {
        const term = jobDetailSearch.trim().toLowerCase();
        const filtered = term
            ? metrics.jobMetrics.filter(j => j.jobTitle.toLowerCase().includes(term))
            : metrics.jobMetrics;
        return showAllJobDetails || term ? filtered : filtered.slice(0, JOB_DETAIL_PREVIEW_COUNT);
    }, [metrics.jobMetrics, jobDetailSearch, showAllJobDetails]);

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
                <ActivityIndicator size="large" color="#4F46E5" />
                <Text style={styles.loadingText}>Calculando indicadores...</Text>
            </View>
        );
    }

    // ===== RENDER =====
    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="#F9FAFB" />
            <ScrollView
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} tintColor="#3b82f6" />}
                contentContainerStyle={[
                    styles.scrollContent,
                    Platform.OS === 'web' && { maxWidth: 1100, alignSelf: 'center' as any, width: '100%' }
                ]}
                onScroll={handleScroll}
                scrollEventThrottle={16}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
            >
                {renderWebRefreshIndicator()}
                {/* Header */}
                <View style={styles.header}>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.title}>Indicadores</Text>
                        <Text style={styles.subtitle}>Métricas de tu proceso de reclutamiento</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <TooltipWrapper title="Actualizar Datos">
                            <TouchableOpacity 
                                style={styles.headerRefreshBtn} 
                                onPress={() => { setRefreshing(true); fetchData(); }}
                                disabled={refreshing}
                            >
                                {refreshing ? (
                                    <ActivityIndicator size="small" color="#4F46E5" />
                                ) : (
                                    <RotateCw color="#4F46E5" size={16} />
                                )}
                            </TouchableOpacity>
                        </TooltipWrapper>
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

                {/* ===== PRINCIPALES MOTIVOS DE RECHAZO ===== */}
                {metrics.rejectionReasons.length > 0 && (
                    <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <UserX color="#ef4444" size={20} />
                            <Text style={styles.sectionTitle}>Principales Motivos de Rechazo</Text>
                        </View>
                        {(() => {
                            const totalRejected = metrics.rejectionReasons.reduce((sum, r) => sum + r.count, 0);
                            return metrics.rejectionReasons.map(({ reason, count }) => {
                                const pct = totalRejected > 0 ? (count / totalRejected) * 100 : 0;
                                return (
                                    <View key={reason} style={styles.funnelRow}>
                                        <View style={styles.funnelLabelRow}>
                                            <View style={[styles.funnelDot, { backgroundColor: '#ef4444' }]} />
                                            <Text style={styles.funnelLabel} numberOfLines={1}>{reason}</Text>
                                            <Text style={styles.funnelCount}>{count}</Text>
                                        </View>
                                        <View style={styles.funnelBarBg}>
                                            <View style={[styles.funnelBarFill, { width: `${Math.max(pct, 1)}%`, backgroundColor: '#ef4444' }]} />
                                        </View>
                                    </View>
                                );
                            });
                        })()}
                    </View>
                )}

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
                        <Text style={styles.sectionTitle}>Detalle por Vacante ({metrics.jobMetrics.length})</Text>
                    </View>
                    {metrics.jobMetrics.length > JOB_DETAIL_PREVIEW_COUNT && (
                        <TextInput
                            style={styles.jobDetailSearchInput}
                            placeholder="Buscar posición por nombre..."
                            placeholderTextColor="#9CA3AF"
                            value={jobDetailSearch}
                            onChangeText={setJobDetailSearch}
                        />
                    )}
                    {visibleJobDetails.map(job => (
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
                    {!jobDetailSearch && !showAllJobDetails && metrics.jobMetrics.length > JOB_DETAIL_PREVIEW_COUNT && (
                        <TouchableOpacity style={styles.showMoreBtn} onPress={() => setShowAllJobDetails(true)}>
                            <Text style={styles.showMoreBtnText}>Ver todas las vacantes ({metrics.jobMetrics.length})</Text>
                        </TouchableOpacity>
                    )}
                    {jobDetailSearch && visibleJobDetails.length === 0 && (
                        <Text style={{ color: '#64748b', textAlign: 'center', padding: 20 }}>
                            Ninguna posición coincide con "{jobDetailSearch}".
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
    container: { flex: 1, backgroundColor: '#F9FAFB' },
    centered: { flex: 1, backgroundColor: '#F9FAFB', justifyContent: 'center', alignItems: 'center' },
    loadingText: { color: '#4F46E5', marginTop: 15, fontWeight: 'bold' },
    scrollContent: { padding: 20, paddingBottom: 50 },

    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, marginTop: 10 },
    headerRefreshBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#E5E7EB',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#D1D5DB'
    },
    title: { color: '#111827', fontSize: 26, fontWeight: '900' },
    subtitle: { color: '#6B7280', fontSize: 13, marginTop: 2 },

    filterToggle: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FFFFFF', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB' },
    filterToggleActive: { borderColor: '#4F46E5', backgroundColor: 'rgba(79, 70, 229, 0.06)' },
    filterToggleText: { color: '#6B7280', fontSize: 13, fontWeight: '600' },

    filtersPanel: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 18, marginBottom: 16, borderWidth: 2, borderColor: '#4F46E5', shadowColor: '#4F46E5', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 3 },
    filtersPanelHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
    filtersPanelTitle: { color: '#111827', fontSize: 16, fontWeight: '800' },
    clearFiltersBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, backgroundColor: 'rgba(220, 38, 38, 0.08)' },
    clearFiltersText: { color: '#DC2626', fontSize: 12, fontWeight: '600' },

    filterRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8, marginTop: 6 },
    filterLabel: { color: '#374151', fontSize: 13, fontWeight: '600' },

    dateRow: { flexDirection: 'row', gap: 10, marginBottom: 8 },
    dateInputWrap: { flex: 1 },
    dateInputLabel: { color: '#9CA3AF', fontSize: 10, fontWeight: '600', marginBottom: 4 },
    dateInput: { backgroundColor: '#F9FAFB', color: '#111827', padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB', fontSize: 13 },

    quickDatesRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
    quickDateBtn: { backgroundColor: 'rgba(79, 70, 229, 0.06)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(79, 70, 229, 0.15)' },
    quickDateText: { color: '#4F46E5', fontSize: 11, fontWeight: '600' },

    jobFilterScroll: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
    jobFilterChip: { backgroundColor: '#F9FAFB', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: '#E5E7EB', flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: 200 },
    jobFilterChipActive: { borderColor: '#4F46E5', backgroundColor: 'rgba(79, 70, 229, 0.08)' },
    jobFilterChipText: { color: '#6B7280', fontSize: 12, fontWeight: '500' },
    jobFilterChipTextActive: { color: '#4F46E5' },
    jobStatusDot: { width: 6, height: 6, borderRadius: 3 },

    statusFilterRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
    statusFilterBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8, backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB' },
    statusFilterBtnActive: { borderColor: '#4F46E5', backgroundColor: 'rgba(79, 70, 229, 0.08)' },
    statusFilterText: { color: '#6B7280', fontSize: 12, fontWeight: '600' },
    statusFilterTextActive: { color: '#4F46E5' },

    activeFiltersSummary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(79, 70, 229, 0.05)', padding: 10, borderRadius: 10, marginBottom: 14, borderWidth: 1, borderColor: 'rgba(79, 70, 229, 0.12)' },
    activeFiltersText: { color: '#4F46E5', fontSize: 11, fontWeight: '500', flex: 1 },

    // KPI Cards
    kpiRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
    kpiCard: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 16, padding: 18, borderLeftWidth: 4, borderWidth: 1, borderColor: '#E5E7EB', alignItems: 'center', shadowColor: '#111827', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
    kpiValue: { color: '#111827', fontSize: 28, fontWeight: '900', marginVertical: 6 },
    kpiLabel: { color: '#6B7280', fontSize: 11, fontWeight: '600', textAlign: 'center', textTransform: 'uppercase' },

    // Sections
    section: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: '#E5E7EB', shadowColor: '#111827', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 6, elevation: 1 },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 18 },
    sectionTitle: { color: '#111827', fontSize: 16, fontWeight: '800' },

    // Funnel
    funnelRow: { marginBottom: 12 },
    funnelLabelRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
    funnelDot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
    funnelLabel: { color: '#374151', fontSize: 13, flex: 1, fontWeight: '500' },
    funnelCount: { color: '#111827', fontWeight: '800', fontSize: 14, minWidth: 30, textAlign: 'right' },
    funnelBarBg: { height: 8, backgroundColor: '#F3F4F6', borderRadius: 4, overflow: 'hidden' },
    funnelBarFill: { height: '100%', borderRadius: 4 },

    // Sources
    sourceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    sourceCard: { width: '47%' as any, backgroundColor: '#F9FAFB', borderRadius: 14, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB' },
    sourceValue: { color: '#111827', fontSize: 24, fontWeight: '900', marginTop: 8, marginBottom: 4 },
    sourceLabel: { color: '#6B7280', fontSize: 11, fontWeight: '600', textAlign: 'center' },

    // Highlights
    highlightRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
    highlightCard: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9FAFB', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#E5E7EB' },
    highlightValue: { color: '#111827', fontSize: 20, fontWeight: '900' },
    highlightLabel: { color: '#6B7280', fontSize: 11, fontWeight: '600' },
    topCandidateCard: { backgroundColor: 'rgba(245, 158, 11, 0.06)', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: 'rgba(245, 158, 11, 0.2)', marginTop: 10, alignItems: 'center' },
    topCandidateLabel: { color: '#B45309', fontSize: 12, fontWeight: '700', marginBottom: 6 },
    topCandidateName: { color: '#111827', fontSize: 16, fontWeight: '800' },
    topCandidateScore: { color: '#D97706', fontSize: 14, fontWeight: '700', marginTop: 4 },

    // Job Breakdown
    jobDetailSearchInput: { backgroundColor: '#F9FAFB', color: '#111827', padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB', fontSize: 13, marginBottom: 12 },
    showMoreBtn: { alignItems: 'center', paddingVertical: 10, marginTop: 4 },
    showMoreBtnText: { color: '#4F46E5', fontSize: 13, fontWeight: '700' },
    jobBreakdownCard: { backgroundColor: '#F9FAFB', borderRadius: 14, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: '#E5E7EB' },
    jobBreakdownHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    jobBreakdownTitle: { color: '#111827', fontSize: 14, fontWeight: '700', flex: 1, marginRight: 10 },
    jobBreakdownBadges: { flexDirection: 'row', gap: 6 },
    jobBreakdownBadge: { backgroundColor: 'rgba(79, 70, 229, 0.1)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
    jobBreakdownBadgeText: { color: '#4F46E5', fontSize: 11, fontWeight: '700' },
    jobStatusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20 },
    jobBreakdownStats: { flexDirection: 'row', justifyContent: 'space-around' },
    jobStat: { alignItems: 'center' },
    jobStatValue: { color: '#111827', fontSize: 16, fontWeight: '800' },
    jobStatLabel: { color: '#9CA3AF', fontSize: 10, fontWeight: '600', marginTop: 2 },

    // Salary Range
    salaryRangeRow: { flexDirection: 'row', gap: 8, marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#E5E7EB' },
    salaryChip: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 10, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB' },
    salaryChipLabel: { color: '#6B7280', fontSize: 10, fontWeight: '600', marginBottom: 4 },
    salaryChipValue: { color: '#059669', fontSize: 15, fontWeight: '800' },
    salaryChipRange: { color: '#9CA3AF', fontSize: 9, marginTop: 3 },

    // Sync
    syncButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#D97706', padding: 14, borderRadius: 12 },
    syncButtonText: { color: 'white', fontWeight: '800', fontSize: 14 },
    syncHint: { color: '#9CA3AF', fontSize: 11, textAlign: 'center', marginTop: 8 },

    footer: { marginTop: 10, alignItems: 'center' },
    footerText: { color: '#9CA3AF', fontSize: 11, fontWeight: '600' },
});
