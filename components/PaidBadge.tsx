import { Crown } from 'lucide-react-native';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

// Marca de funcion de pago: un mismo icono en todo el producto para que las
// cuentas gratuitas reconozcan que hay mas opciones en los planes de pago.
// <PaidBadge /> -> "Pro"; <PaidBadge label="Gold" /> para lo exclusivo de Gold.
export default function PaidBadge({ label = 'Pro', compact = false }: { label?: string; compact?: boolean }) {
    return (
        <View style={[styles.badge, compact && styles.compact]} accessibilityLabel={`Disponible en plan ${label}`}>
            <Crown size={compact ? 11 : 12} color="#92400E" />
            {!compact && <Text style={styles.text}>{label}</Text>}
        </View>
    );
}

const styles = StyleSheet.create({
    badge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FEF3C7', borderWidth: 1, borderColor: '#FCD34D', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, alignSelf: 'flex-start' },
    compact: { paddingHorizontal: 5 },
    text: { color: '#92400E', fontSize: 11, fontWeight: '700' },
});
