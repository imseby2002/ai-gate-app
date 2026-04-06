export type UserType = 'employee' | 'external' | 'admin'
export type PlanId = 'free' | 'starter' | 'pro' | 'enterprise'
export type ModelProvider = 'deepseek' | 'google' | 'anthropic' | 'perplexity' | 'fal' | 'kling' | 'veo'
export type Modality = 'text' | 'image' | 'video' | 'multimodal'
export type MessageRole = 'user' | 'assistant' | 'system'
export type FileType = 'pdf' | 'docx' | 'xlsx' | 'jpg' | 'jpeg' | 'png' | 'json' | 'txt'
export type ProcessingStatus = 'pending' | 'processing' | 'done' | 'failed'

export interface Profile {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  user_type: UserType
  is_active: boolean
  department: string | null
  monthly_budget: number | null
  credit_balance: number
  created_at: string
  updated_at: string
}

export interface Subscription {
  id: string
  user_id: string
  stripe_customer_id: string | null
  stripe_sub_id: string | null
  plan_id: PlanId
  status: 'active' | 'canceled' | 'past_due' | 'trialing'
  current_period_start: string | null
  current_period_end: string | null
  cancel_at_period_end: boolean
  created_at: string
  updated_at: string
}

export interface AIModel {
  id: string
  display_name: string
  provider: ModelProvider
  modality: Modality
  input_cost_per_1k: number
  output_cost_per_1k: number
  image_cost_per_unit: number
  video_cost_per_sec: number
  context_window: number | null
  supports_vision: boolean
  supports_files: boolean
  is_enabled: boolean
  routing_tags: string[] | null
  sort_order: number
  created_at: string
}

export interface Assistant {
  id: string
  user_id: string
  name: string
  description: string | null
  system_prompt: string
  default_model: string | null
  avatar_emoji: string
  is_public: boolean
  created_at: string
  updated_at: string
}

export interface AssistantFile {
  id: string
  assistant_id: string
  user_id: string
  file_name: string
  file_type: FileType
  storage_path: string
  file_size_bytes: number | null
  extracted_text: string | null
  chunk_count: number
  processing_status: ProcessingStatus
  created_at: string
}

export interface Conversation {
  id: string
  user_id: string
  assistant_id: string | null
  title: string
  model_id: string | null
  pinned: boolean
  created_at: string
  updated_at: string
}

export interface Message {
  id: string
  conversation_id: string
  user_id: string
  role: MessageRole
  content: string
  model_id: string | null
  input_tokens: number
  output_tokens: number
  cost_usd: number
  image_urls: string[] | null
  video_url: string | null
  file_refs: string[] | null
  latency_ms: number | null
  finish_reason: string | null
  created_at: string
}

export interface UsageDaily {
  id: string
  user_id: string
  model_id: string
  date: string
  message_count: number
  input_tokens: number
  output_tokens: number
  image_count: number
  video_seconds: number
  total_cost_usd: number
}

export interface CreditTransaction {
  id: string
  user_id: string
  amount_usd: number
  type: 'purchase' | 'usage' | 'refund' | 'admin_grant'
  message_id: string | null
  description: string | null
  balance_after: number | null
  created_at: string
}
