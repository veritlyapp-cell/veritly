import { Stack } from 'expo-router';

export default function CompanyLayout() {
    return (
        <Stack
            screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: '#0f172a' }
            }}
        >
            <Stack.Screen name="signin" />

            {/* 
               The 'dashboard' route is now a Drawer (directory with _layout.tsx). 
               We treat it as a screen here to navigate to it.
            */}
            <Stack.Screen name="dashboard" options={{ headerShown: false }} />


            <Stack.Screen name="create" options={{ presentation: 'modal' }} />
            <Stack.Screen name="job/[id]" options={{ presentation: 'modal' }} />
        </Stack>
    );
}
