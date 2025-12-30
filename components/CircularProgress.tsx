import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

interface CircularProgressProps {
    percentage: number;
    size?: number;
    strokeWidth?: number;
}

export default function CircularProgress({ percentage, size = 100, strokeWidth = 8 }: CircularProgressProps) {
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const progress = circumference - (percentage / 100) * circumference;

    const getColorByScore = (score: number) => {
        if (score >= 80) return '#10b981'; // Verde
        if (score >= 60) return '#f59e0b'; // Amarillo/Naranja
        return '#ef4444'; // Rojo
    };

    const color = getColorByScore(percentage);

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
            </Svg>
            <View style={styles.textContainer}>
                <Text style={[styles.percentage, { color }]}>{percentage}</Text>
                <Text style={styles.label}>%</Text>
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
