import React from 'react'
import { View, ActivityIndicator, StyleSheet } from 'react-native'
import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { useAuth } from '../context/AuthContext'

import LoginScreen from '../screens/auth/LoginScreen'
import MainTabs from './MainTabs'
import ChatDetailScreen from '../screens/chat/ChatDetailScreen'
import FeedbackScreen from '../screens/feedback/FeedbackScreen'

const Stack = createNativeStackNavigator()

export default function RootNavigator() {
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    )
  }

  return (
    <NavigationContainer>
      <Stack.Navigator>
        {!user ? (
          <Stack.Screen
            name="Login"
            component={LoginScreen}
            options={{ headerShown: false }}
          />
        ) : (
          <>
            <Stack.Screen
              name="Main"
              component={MainTabs}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="ChatDetail"
              component={ChatDetailScreen}
              options={{
                headerBackTitle: '返回',
                headerTintColor: '#2563EB',
                headerTitleStyle: { color: '#0F172A', fontWeight: '700' },
              }}
            />
            <Stack.Screen
              name="Feedback"
              component={FeedbackScreen}
              options={{
                title: '問題回饋',
                headerBackTitle: '返回',
                headerTintColor: '#2563EB',
                headerTitleStyle: { color: '#0F172A', fontWeight: '700' },
              }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  )
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
  },
})
