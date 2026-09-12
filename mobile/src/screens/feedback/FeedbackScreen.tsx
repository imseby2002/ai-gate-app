import React, { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
  Image,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import * as Device from 'expo-device'
import * as ImagePicker from 'expo-image-picker'
import { apiFetch, supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { CONFIG } from '../../lib/config'

export default function FeedbackScreen() {
  const { user } = useAuth()
  const [type, setType] = useState<'bug' | 'feature' | 'other'>('bug')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [screenshotUri, setScreenshotUri] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('權限不足', '請允許存取相簿以選擇問題截圖')
      return
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.7,
    })

    if (!result.canceled && result.assets[0]) {
      setScreenshotUri(result.assets[0].uri)
    }
  }

  const handleSubmit = async () => {
    if (!title.trim() || !description.trim()) {
      Alert.alert('提示', '請填寫問題標題與描述')
      return
    }

    setSubmitting(true)
    try {
      // 自動組裝除錯環境資訊
      const deviceInfo = `
------------------------
[APP 端環境資訊]
來源: 手機 APP
系統: ${Platform.OS.toUpperCase()} ${Platform.Version}
裝置型號: ${Device.modelName || Device.deviceName || '未知'}
APP 版本: v${CONFIG.APP_VERSION}
回報帳號: ${user?.email || '未知'}
回報時間: ${new Date().toLocaleString()}
------------------------`

      let finalDescription = `${description.trim()}\n${deviceInfo}`

      // 若有選擇圖片，上傳至 Supabase Storage 或附帶連結
      if (screenshotUri) {
        try {
          const fileExt = screenshotUri.split('.').pop() || 'jpg'
          const fileName = `feedback_${Date.now()}.${fileExt}`
          const response = await fetch(screenshotUri)
          const blob = await response.blob()

          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('feedback')
            .upload(fileName, blob, {
              contentType: `image/${fileExt}`,
            })

          if (!uploadError && uploadData) {
            const { data: publicUrlData } = supabase.storage
              .from('feedback')
              .getPublicUrl(fileName)
            if (publicUrlData?.publicUrl) {
              finalDescription += `\n附圖截圖: ${publicUrlData.publicUrl}`
            }
          }
        } catch (uploadErr) {
          console.log('圖片上傳略過或失敗:', uploadErr)
        }
      }

      // 呼叫現有 API /api/feedback，直接存入 user_feedback 表格
      const res = await apiFetch('/api/feedback', {
        method: 'POST',
        body: JSON.stringify({
          title: `[APP] ${title.trim()}`,
          description: finalDescription,
          type,
          source: 'mobile',
        }),
      })

      if (res.ok) {
        Alert.alert(
          '回報成功',
          '感謝您的回饋！問題已直接送達總管理端後台（/admin/feedback），我們將儘速確認與處理。',
          [
            {
              text: '確定',
              onPress: () => {
                setTitle('')
                setDescription('')
                setScreenshotUri(null)
              },
            },
          ]
        )
      } else {
        const errJson = await res.json().catch(() => ({}))
        Alert.alert('傳送失敗', errJson.error || '無法提交問題，請稍候重試')
      }
    } catch {
      Alert.alert('網路錯誤', '無法連線至後端伺服器')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.infoBanner}>
        <Ionicons name="information-circle" size={20} color="#2563EB" />
        <Text style={styles.infoBannerText}>
          遇到使用問題或有新功能建議？在此填寫後將直接送達總管理端後台審閱。
        </Text>
      </View>

      {/* 類型選擇 */}
      <Text style={styles.sectionLabel}>回饋類型</Text>
      <View style={styles.typeRow}>
        {[
          { key: 'bug', label: '🐛 程式錯誤 (Bug)' },
          { key: 'feature', label: '💡 功能建議' },
          { key: 'other', label: '💬 其他問題' },
        ].map((t) => (
          <TouchableOpacity
            key={t.key}
            style={[styles.typeBtn, type === t.key && styles.typeBtnActive]}
            onPress={() => setType(t.key as any)}
          >
            <Text style={[styles.typeBtnText, type === t.key && styles.typeBtnTextActive]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* 問題標題 */}
      <Text style={styles.sectionLabel}>問題標題 *</Text>
      <TextInput
        style={styles.input}
        placeholder="例如: 點擊客人對話無法正常傳送圖片"
        placeholderTextColor="#94A3B8"
        value={title}
        onChangeText={setTitle}
      />

      {/* 詳細說明 */}
      <Text style={styles.sectionLabel}>詳細說明 *</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        placeholder="請儘量詳述發生步驟或畫面現象..."
        placeholderTextColor="#94A3B8"
        value={description}
        onChangeText={setDescription}
        multiline
        numberOfLines={5}
      />

      {/* 附加截圖 */}
      <Text style={styles.sectionLabel}>附帶螢幕截圖 (選填)</Text>
      {screenshotUri ? (
        <View style={styles.imagePreviewWrapper}>
          <Image source={{ uri: screenshotUri }} style={styles.imagePreview} />
          <TouchableOpacity
            style={styles.removeImageBtn}
            onPress={() => setScreenshotUri(null)}
          >
            <Ionicons name="close-circle" size={24} color="#DC2626" />
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity style={styles.uploadBox} onPress={pickImage}>
          <Ionicons name="image-outline" size={28} color="#64748B" />
          <Text style={styles.uploadBoxText}>點選從手機相簿選取截圖</Text>
        </TouchableOpacity>
      )}

      {/* 自動帶入的系統資訊預覽 */}
      <View style={styles.deviceMetaBox}>
        <Text style={styles.deviceMetaTitle}>📱 系統將自動帶入您的設備資訊：</Text>
        <Text style={styles.deviceMetaText}>
          • 機型：{Device.modelName || '本裝置'} ({Platform.OS.toUpperCase()} {Platform.Version})
        </Text>
        <Text style={styles.deviceMetaText}>• APP 版本：v{CONFIG.APP_VERSION}</Text>
        <Text style={styles.deviceMetaText}>• 帳號：{user?.email}</Text>
      </View>

      {/* 送出按鈕 */}
      <TouchableOpacity
        style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
        onPress={handleSubmit}
        disabled={submitting}
      >
        {submitting ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.submitBtnText}>提交回饋至總管理端</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
    gap: 8,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  infoBannerText: {
    flex: 1,
    fontSize: 13,
    color: '#1E40AF',
    lineHeight: 18,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 8,
    marginTop: 14,
  },
  typeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  typeBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
  },
  typeBtnActive: {
    borderColor: '#2563EB',
    backgroundColor: '#EFF6FF',
  },
  typeBtnText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  typeBtnTextActive: {
    color: '#2563EB',
    fontWeight: '600',
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: '#0F172A',
  },
  textArea: {
    height: 110,
    textAlignVertical: 'top',
  },
  uploadBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderStyle: 'dashed',
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadBoxText: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 4,
  },
  imagePreviewWrapper: {
    position: 'relative',
    width: 120,
    height: 120,
  },
  imagePreview: {
    width: 120,
    height: 120,
    borderRadius: 12,
  },
  removeImageBtn: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
  },
  deviceMetaBox: {
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    padding: 14,
    marginTop: 20,
  },
  deviceMetaTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 6,
  },
  deviceMetaText: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 18,
  },
  submitBtn: {
    backgroundColor: '#2563EB',
    borderRadius: 12,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  submitBtnDisabled: {
    opacity: 0.7,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
})
