import React, { Component, ErrorInfo, ReactNode } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import { AuthProvider } from './src/context/AuthContext'
import RootNavigator from './src/navigation/RootNavigator'

interface ErrorBoundaryProps {
  children: ReactNode
}
interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.log('App ErrorBoundary caught error:', error, errorInfo)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.errorContainer}>
          <ScrollView contentContainerStyle={styles.errorContent}>
            <Text style={styles.errorTitle}>⚠️ 應用程式執行異常</Text>
            <Text style={styles.errorMessage}>
              {this.state.error?.message || '未知錯誤'}
            </Text>
            {this.state.error?.stack && (
              <Text style={styles.errorStack}>
                {this.state.error.stack}
              </Text>
            )}
            <TouchableOpacity style={styles.retryBtn} onPress={this.handleReset}>
              <Text style={styles.retryBtnText}>重新嘗試載入</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      )
    }
    return this.props.children
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <AuthProvider>
          <RootNavigator />
          <StatusBar style="auto" />
        </AuthProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  )
}

const styles = StyleSheet.create({
  errorContainer: {
    flex: 1,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    padding: 20,
  },
  errorContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#EF4444',
    marginBottom: 12,
  },
  errorMessage: {
    fontSize: 15,
    color: '#F8FAFC',
    marginBottom: 16,
    lineHeight: 22,
  },
  errorStack: {
    fontSize: 12,
    color: '#94A3B8',
    backgroundColor: '#1E293B',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
    fontFamily: 'monospace',
  },
  retryBtn: {
    backgroundColor: '#2563EB',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  retryBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
})
