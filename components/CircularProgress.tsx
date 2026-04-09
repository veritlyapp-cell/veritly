import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { Clock } from 'lucide-react-native';

interface CircularProgressProps {
    percentage?: number | null;
    size?: number;
    strokeWidth?: number;
}

export default function CircularProgress({ percentage, size = 100, strokeWidth = 8 }: CircularProgressProps) {
    const isPending = percentage === undefined || percentage === null;
    const actualPercentage = isPending ? 0 : percentage!;
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const progress = circumference - (actualPercentage / 100) * circumference;

    const getColorByScore = (score: number) => {
        if (isPending) return '#64748b'; // Gris para pendiente
        if (score >= 80) return '#10b981'; // Verde
        if (score >= 60) return '#f59e0b'; // Amarillo/Naranja
        return '#ef4444'; // Rojo
    };

    const color = getColorByScore(actualPercentage);

    return (
        <View style={[styles.container, { width: size, height: size }]}>
            <Svg width={size} height={size}>
                {/* Background Circle */}
                <Circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    stroke="rgba(100, 116, 139, 0.2)"
                    strokeWidth={strokeWidth}
                    fill="none"
                />
                {/* Progress Circle */}
                {!isPending && (
                    <Circle
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        stroke={color}
                        strokeWidth={strokeWidth}
                        fill="none"
                        strokeDasharray={circumference}
                        strokeDashoffset={progress}
                        strokeLinecap="round"
                        transform={`rotate(-90 ${size / 2} ${size / 2})`}
                    />
                )}
            </Svg>
            <View style={styles.textContainer}>
                {isPending ? (
                    <Clock size={size * 0.4} color="#64748b" />
                ) : (
                    <>
                        <Text style={[styles.percentage, { color, fontSize: size * 0.3, lineHeight: size * 0.35 }]}>{actualPercentage}</Text>
                        <Text style={[styles.label, { fontSize: size * 0.12 }]}>%</Text>
                    </>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'relative',
        justifyContent: 'center',
        alignItems: 'center'
    },
    textContainer: {
        position: 'absolute',
        justifyContent: 'center',
        alignItems: 'center'
    },
    percentage: {
        fontSize: 28,
        fontWeight: '900',
        lineHeight: 32
    },
    label: {
        fontSize: 12,
        color: '#94a3b8',
        fontWeight: '600'
    }
});
