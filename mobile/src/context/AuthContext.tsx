import React, { createContext, useContext, useEffect, useState } from 'react'
import { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { registerForPushNotificationsAsync } from '../lib/notifications'

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

  // 判定是否顯示「日曆訂房」與「每日入住」：
  // 1. 如果 profile.has_booking_access 為 true
  // 2. 如果是 admin
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
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
