import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';

export default function OnboardingRedirect() {
    const router = useRouter();
    useEffect(() => {
        router.replace('/empresa/dashboard/profile');
    }, []);

    return (
        <View style={{ flex: 1, backgroundColor: '#F9FAFB', justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color="#4F46E5" />
        </View>
    );
}
