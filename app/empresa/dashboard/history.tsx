import React from 'react';
import { Text, View } from 'react-native';

// Placeholder for History Screen
export default function HistoryScreen() {
    return (
        <View style={{ flex: 1, backgroundColor: '#0f172a', justifyContent: 'center', alignItems: 'center' }}>
            <Text style={{ color: 'white', fontSize: 18, fontWeight: 'bold' }}>Historial de Análisis</Text>
            <Text style={{ color: '#94a3b8', marginTop: 10 }}>Próximamente verás aquí tus búsquedas guardadas.</Text>
        </View>
    );
}
