import React, { createContext, useContext, useEffect, useState } from 'react'
import { Session, User } from '@supabase/supabase-js'
import * as WebBrowser from 'expo-web-browser'
import { makeRedirectUri } from 'expo-auth-session'
import { supabase } from '../lib/supabase'
import { registerForPushNotificationsAsync } from '../lib/notifications'

WebBrowser.maybeCompleteAuthSession()

interface UserProfile {
  id: string
  email: string | null
  user_type: string | null
  full_name?: string | null
  roles?: string[]
  has_booking_access?: boolean
}

interface AuthContextType {
  session: Session | null
  user: User | null
  profile: UserProfile | null
  isLoading: boolean
  hasBookingAccess: boolean
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>
  signInWithGoogle: () => Promise<{ error: Error | null }>
  signInWithOtp: (email: string) => Promise<{ error: Error | null }>
  verifyOtp: (email: string, token: string) => Promise<{ error: Error | null }>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, user_type, full_name')
        .eq('id', userId)
        .single()

      if (error) {
        console.log('獲取使用者 profile 錯誤:', error.message)
        return
      }

      // 檢查是否具有訂房/每日入住權限（Admin 或 具備 bnb/booking 關聯的用戶）
      let hasBooking = data?.user_type === 'admin'
      if (!hasBooking) {
        // 嘗試查詢是否有關聯的民宿或物業
        const { data: props } = await supabase
          .from('properties')
          .select('id')
          .limit(1)
        if (props && props.length > 0) {
          hasBooking = true
        }
      }

      setProfile({
        ...data,
        has_booking_access: hasBooking,
      })
    } catch (e) {
      console.log('fetchProfile 失敗:', e)
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchProfile(session.user.id)
        registerForPushNotificationsAsync()
      }
      setIsLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        await fetchProfile(session.user.id)
        registerForPushNotificationsAsync()
      } else {
        setProfile(null)
      }
      setIsLoading(false)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const signIn = async (email: string, password: string) => {
    setIsLoading(true)
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })
    if (error) {
      setIsLoading(false)
      return { error }
    }
    setSession(data.session)
    setUser(data.user)
    if (data.user) {
      await fetchProfile(data.user.id)
      await registerForPushNotificationsAsync()
    }
    setIsLoading(false)
    return { error: null }
  }

  const signInWithGoogle = async () => {
    setIsLoading(true)
    try {
      const redirectUri = makeRedirectUri({
        scheme: 'aigate',
        path: 'auth/callback',
      })

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUri,
          skipBrowserRedirect: true,
        },
      })

      if (error) {
        setIsLoading(false)
        return { error }
      }

      if (data?.url) {
        const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUri)
        if (result.type === 'success' && result.url) {
          // 支援從 URL hash 或 query 萃取 Token
          const cleanUrl = result.url.replace('#', '?')
          const parsed = new URL(cleanUrl)
          const accessToken = parsed.searchParams.get('access_token')
          const refreshToken = parsed.searchParams.get('refresh_token')
          const code = parsed.searchParams.get('code')

          if (accessToken && refreshToken) {
            const { data: sessData, error: sessErr } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            })
            if (sessErr) {
              setIsLoading(false)
              return { error: sessErr }
            }
            setSession(sessData.session)
            setUser(sessData.user)
            if (sessData.user) await fetchProfile(sessData.user.id)
          } else if (code) {
            const { data: codeData, error: codeErr } = await supabase.auth.exchangeCodeForSession(code)
            if (codeErr) {
              setIsLoading(false)
              return { error: codeErr }
            }
            setSession(codeData.session)
            setUser(codeData.user)
            if (codeData.user) await fetchProfile(codeData.user.id)
          }
        }
      }

      setIsLoading(false)
      return { error: null }
    } catch (e: any) {
      setIsLoading(false)
      return { error: e }
    }
  }

  const signInWithOtp = async (email: string) => {
    setIsLoading(true)
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
    })
    setIsLoading(false)
    return { error }
  }

  const verifyOtp = async (email: string, token: string) => {
    setIsLoading(true)
    const { data, error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: token.trim(),
      type: 'email',
    })
    if (error) {
      setIsLoading(false)
      return { error }
    }
    setSession(data.session)
    setUser(data.user)
    if (data.user) {
      await fetchProfile(data.user.id)
      await registerForPushNotificationsAsync()
    }
    setIsLoading(false)
    return { error: null }
  }

  const signOut = async () => {
    setIsLoading(true)
    await supabase.auth.signOut()
    setSession(null)
    setUser(null)
    setProfile(null)
    setIsLoading(false)
  }

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.id)
    }
  }

  const hasBookingAccess = profile?.has_booking_access ?? (profile?.user_type === 'admin')

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        profile,
        isLoading,
        hasBookingAccess,
        signIn,
        signInWithGoogle,
        signInWithOtp,
        verifyOtp,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
