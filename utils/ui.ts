import { Alert, Platform } from 'react-native';

/**
 * Muestra una alerta compatible con Web y Native.
 */
export const showAlert = (title: string, message: string) => {
    if (Platform.OS === 'web') {
        if (typeof window !== 'undefined') {
            window.alert(`${title}: ${message}`);
        } else {
            console.log(`[ALERT] ${title}: ${message}`);
        }
    } else {
        Alert.alert(title, message);
    }
};
