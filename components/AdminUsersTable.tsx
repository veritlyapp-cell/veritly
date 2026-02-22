
import { Building2, Download, Users } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { getAllCandidates, getAllCompanies } from '../services/admin-service';
import { CandidateProfile, CompanyProfile } from '../services/auth-service';

type UserTab = 'candidates' | 'companies';

export default function AdminUsersTable() {
    const [activeTab, setActiveTab] = useState<UserTab>('candidates');
    const [candidates, setCandidates] = useState<CandidateProfile[]>([]);
    const [companies, setCompanies] = useState<CompanyProfile[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        const [cands, comps] = await Promise.all([
            getAllCandidates(),
            getAllCompanies()
        ]);
        setCandidates(cands);
        setCompanies(comps);
        setLoading(false);
    };

    const formatDate = (date: any) => {
        if (!date) return '-';
        // Handle Firestore Timestamp or Date object or ISO string
        const d = date.toDate ? date.toDate() : new Date(date);
        return d.toLocaleDateString();
    };

    const handleExportCSV = () => {
        if (Platform.OS !== 'web') {
            alert("Export only available on Web for now.");
            return;
        }

        let csvContent = "data:text/csv;charset=utf-8,";

        if (activeTab === 'candidates') {
            // Headers
            csvContent += "Nombre Completo,Correo,Teléfono,Nacimiento,Ubicación,Exp. Salariales,Fecha Creación,Logins,Último Login\n";

            // Rows
            candidates.forEach(c => {
                const loc = c.profile.location || '-'; // Simplification if object
                const row = [
                    c.profile.fullName || 'N/A',
                    c.email,
                    c.profile.phone || '-',
                    '-', // Birthdate not fully implemented in profile yet
                    loc,
                    '-', // Salary Exp
                    formatDate(c.createdAt),
                    (c as any).loginCount || 0,
                    formatDate((c as any).lastLoginAt)
                ].map(item => `"${item}"`).join(",");
                csvContent += row + "\n";
            });

        } else {
            // Headers
            csvContent += "RUC,Empresa,Rubro,Contacto,Correo Contacto,Teléfono Contacto,Fecha Creación,Logins,Último Login\n";

            // Rows
            companies.forEach(c => {
                const row = [
                    c.company.ruc || '-',
                    c.company.name || '-',
                    c.company.industry || '-',
                    '-', // Contact Name
                    '-', // Contact Email
                    '-', // Contact Phone (Usually matches c.company details or user email)
                    formatDate(c.createdAt),
                    (c as any).loginCount || 0,
                    formatDate((c as any).lastLoginAt)
                ].map(item => `"${item}"`).join(",");
                csvContent += row + "\n";
            });
        }

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `veritly_${activeTab}_report.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const renderCandidateRow = ({ item }: { item: CandidateProfile }) => (
        <View style={styles.row}>
            <Text style={[styles.cell, { flex: 2 }]} numberOfLines={1}>{item.profile.fullName || 'Sin Nombre'}</Text>
            <Text style={[styles.cell, { flex: 2 }]} numberOfLines={1}>{item.email}</Text>
            <Text style={styles.cell}>{item.profile.phone || '-'}</Text>
            <Text style={styles.cell}>{formatDate(item.createdAt)}</Text>
            <Text style={[styles.cell, styles.centerText]}>{(item as any).loginCount || 0}</Text>
            <Text style={styles.cell}>{formatDate((item as any).lastLoginAt)}</Text>
        </View>
    );

    const renderCompanyRow = ({ item }: { item: CompanyProfile }) => (
        <View style={styles.row}>
            <Text style={[styles.cell, { flex: 1.5 }]} numberOfLines={1}>{item.company.ruc || '-'}</Text>
            <Text style={[styles.cell, { flex: 2 }]} numberOfLines={1}>{item.company.name || 'Sin Nombre'}</Text>
            <Text style={[styles.cell, { flex: 2 }]} numberOfLines={1}>{item.email}</Text>
            <Text style={styles.cell}>{formatDate(item.createdAt)}</Text>
            <Text style={[styles.cell, styles.centerText]}>{(item as any).loginCount || 0}</Text>
            <Text style={styles.cell}>{formatDate((item as any).lastLoginAt)}</Text>
        </View>
    );

    if (loading) return <ActivityIndicator color="#3b82f6" style={{ margin: 20 }} />;

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <View style={styles.tabs}>
                    <TouchableOpacity
                        style={[styles.tab, activeTab === 'candidates' && styles.activeTab]}
                        onPress={() => setActiveTab('candidates')}
                    >
                        <Users size={18} color={activeTab === 'candidates' ? 'white' : '#94a3b8'} />
                        <Text style={[styles.tabText, activeTab === 'candidates' && styles.activeTabText]}>Candidatos ({candidates.length})</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.tab, activeTab === 'companies' && styles.activeTab]}
                        onPress={() => setActiveTab('companies')}
                    >
                        <Building2 size={18} color={activeTab === 'companies' ? 'white' : '#94a3b8'} />
                        <Text style={[styles.tabText, activeTab === 'companies' && styles.activeTabText]}>Empresas ({companies.length})</Text>
                    </TouchableOpacity>
                </View>

                <TouchableOpacity style={styles.exportBtn} onPress={handleExportCSV}>
                    <Download size={18} color="white" />
                    <Text style={styles.exportText}>Exportar CVS</Text>
                </TouchableOpacity>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={true}>
                <View style={{ minWidth: 800 }}>
                    {/* Header Row */}
                    <View style={styles.headerRow}>
                        {activeTab === 'candidates' ? (
                            <>
                                <Text style={[styles.headerCell, { flex: 2 }]}>Nombre</Text>
                                <Text style={[styles.headerCell, { flex: 2 }]}>Correo</Text>
                                <Text style={styles.headerCell}>Teléfono</Text>
                                <Text style={styles.headerCell}>Registro</Text>
                                <Text style={[styles.headerCell, styles.centerText]}>Logins</Text>
                                <Text style={styles.headerCell}>Último Login</Text>
                            </>
                        ) : (
                            <>
                                <Text style={[styles.headerCell, { flex: 1.5 }]}>RUC</Text>
                                <Text style={[styles.headerCell, { flex: 2 }]}>Empresa</Text>
                                <Text style={[styles.headerCell, { flex: 2 }]}>Correo</Text>
                                <Text style={styles.headerCell}>Registro</Text>
                                <Text style={[styles.headerCell, styles.centerText]}>Logins</Text>
                                <Text style={styles.headerCell}>Último Login</Text>
                            </>
                        )}
                    </View>

                    <FlatList
                        data={(activeTab === 'candidates' ? candidates : companies) as any[]}
                        keyExtractor={(item) => item.uid}
                        renderItem={activeTab === 'candidates' ? renderCandidateRow as any : renderCompanyRow as any}
                        contentContainerStyle={{ paddingBottom: 20 }}
                        scrollEnabled={false} // Since we are inside a ScrollView logic handle
                    />
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#1e293b',
        borderRadius: 16,
        padding: 16,
        marginTop: 20,
        borderWidth: 1,
        borderColor: '#334155'
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
        flexWrap: 'wrap',
        gap: 10
    },
    tabs: {
        flexDirection: 'row',
        backgroundColor: '#0f172a',
        borderRadius: 8,
        padding: 4,
    },
    tab: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 6,
        gap: 8
    },
    activeTab: {
        backgroundColor: '#3b82f6'
    },
    tabText: {
        color: '#94a3b8',
        fontWeight: '500',
        fontSize: 14
    },
    activeTabText: {
        color: 'white',
        fontWeight: 'bold'
    },
    exportBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#10b981',
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 8,
        gap: 8
    },
    exportText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 14
    },

    // Table
    headerRow: {
        flexDirection: 'row',
        backgroundColor: '#0f172a',
        padding: 12,
        borderRadius: 8,
        marginBottom: 8,
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: '#334155'
    },
    headerCell: {
        flex: 1,
        color: '#94a3b8',
        fontSize: 12,
        fontWeight: 'bold',
    },
    row: {
        flexDirection: 'row',
        padding: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#334155',
        alignItems: 'center'
    },
    cell: {
        flex: 1,
        color: 'white',
        fontSize: 13,
    },
    centerText: {
        textAlign: 'center'
    }
});
