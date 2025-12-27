import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { auth } from '../../config/firebase'; 
import { getCompanyJobs } from '../../services/storage';
import { JobPosting } from '../../types'; // Importamos el tipo correcto

export default function CompanyDashboard() {
  const router = useRouter();
  const [jobs, setJobs] = useState<JobPosting[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Cargar datos al entrar a la pantalla
  useFocusEffect(
    useCallback(() => {
      fetchJobs();
    }, [])
  );

  const fetchJobs = async () => {
    if (!auth.currentUser) return;
    // No mostramos loading si es un "pull to refresh"
    if (!refreshing) setLoading(true);
    
    try {
      const myJobs = await getCompanyJobs(auth.currentUser.uid);
      setJobs(myJobs);
    } catch (error) {
      console.error("Error cargando vacantes:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchJobs();
  };

  const handleLogout = async () => {
    try {
      await auth.signOut();
      router.replace('/');
    } catch (e) {
      console.error(e);
    }
  };

  // Renderizado de cada tarjeta de vacante
  const renderJobItem = ({ item }: { item: JobPosting }) => (
    <TouchableOpacity 
      style={styles.card} 
      onPress={() => router.push({
        pathname: `/(company)/job/${item.id}`,
        params: { title: item.title, description: item.description } // Pasamos datos básicos para carga rápida
      })}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.jobTitle} numberOfLines={1}>{item.title}</Text>
        {/* Indicador de estado */}
        <View style={[styles.statusDot, { backgroundColor: item.isActive ? '#4CAF50' : '#ccc' }]} />
      </View>
      
      <Text style={styles.jobLocation}>📍 {item.location}</Text>
      
      <View style={styles.footer}>
         <View style={styles.badge}>
            <Ionicons name="time-outline" size={12} color="#ccc" />
            <Text style={styles.badgeText}> {new Date(item.createdAt).toLocaleDateString()}</Text>
         </View>
         <Text style={styles.arrow}>Ver Postulantes →</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Header Superior */}
      <View style={styles.headerContainer}>
        <View>
          <Text style={styles.welcomeText}>Hola,</Text>
          <Text style={styles.headerTitle}>Panel de Reclutamiento</Text>
        </View>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
            <Ionicons name="log-out-outline" size={24} color="#FF5252" />
        </TouchableOpacity>
      </View>

      {/* Lista de Vacantes */}
      {loading ? (
        <ActivityIndicator size="large" color="#007AFF" style={{marginTop: 50}} />
      ) : (
        <FlatList
          data={jobs}
          keyExtractor={(item) => item.id}
          renderItem={renderJobItem}
          contentContainerStyle={{ paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <View style={styles.emptyState}>
                <Ionicons name="briefcase-outline" size={60} color="#ccc" />
                <Text style={styles.emptyText}>No tienes vacantes activas.</Text>
                <Text style={styles.emptySubText}>Crea una nueva para empezar a recibir candidatos.</Text>
            </View>
          }
        />
      )}

      {/* Botón Flotante (FAB) para crear */}
      <TouchableOpacity 
        style={styles.fab} 
        onPress={() => router.push('/(company)/create')}
      >
        <Ionicons name="add" size={32} color="white" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA', padding: 20, paddingTop: 60 },
  headerContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25 },
  welcomeText: { fontSize: 16, color: '#666' },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#1A1A1A' },
  logoutBtn: { padding: 5 },
  
  card: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    marginBottom: 15,
    // Sombra suave
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#F0F0F0'
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 },
  jobTitle: { fontSize: 18, fontWeight: 'bold', color: '#333', flex: 1, marginRight: 10 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  jobLocation: { fontSize: 14, color: '#666', marginBottom: 15 },
  
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#F5F5F5', paddingTop: 10 },
  badge: { flexDirection: 'row', alignItems: 'center' },
  badgeText: { color: '#999', fontSize: 12, marginLeft: 4 },
  arrow: { color: '#007AFF', fontWeight: '600', fontSize: 14 },

  fab: {
    position: 'absolute',
    right: 20,
    bottom: 30,
    backgroundColor: '#007AFF', // Azul principal
    width: 65,
    height: 65,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 10,
    shadowColor: "#007AFF",
    shadowOpacity: 0.4,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 }
  },
  emptyState: { alignItems: 'center', marginTop: 80 },
  emptyText: { color: '#333', fontSize: 18, fontWeight: 'bold', marginTop: 10 },
  emptySubText: { color: '#999', fontSize: 14, textAlign: 'center', marginTop: 5, maxWidth: '80%' }
});