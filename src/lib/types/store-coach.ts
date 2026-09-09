// FEELING TEA 門市營運教練 AI (Store Management Coach AI) 核心型別定義

export interface StoreLayout {
  id: string
  store_id: string
  store_code?: string
  layout_version: string
  floor_plan_url?: string
  image_urls?: string[]
  three_d_model_url?: string
  counter_position?: Record<string, any>
  cashier_position?: Record<string, any>
  tea_position?: Record<string, any>
  ice_position?: Record<string, any>
  topping_position?: Record<string, any>
  sealing_position?: Record<string, any>
  pickup_position?: Record<string, any>
  washing_position?: Record<string, any>
  storage_position?: Record<string, any>
  refrigerator_position?: Record<string, any>
  freezer_position?: Record<string, any>
  waste_position?: Record<string, any>
  customer_flow?: Record<string, any>
  staff_flow?: Record<string, any>
  created_at?: string
}

export interface Workstation {
  id: string
  store_id: string
  store_code?: string
  name: string
  type: 'tea_station' | 'topping_station' | 'cashier' | 'prep' | 'washing' | 'packing'
  location: string
  purpose?: string
  equipment: string[]
  tools: string[]
  ingredients: string[]
  standard_position?: Record<string, any>
  frequency_of_use: 'continuous' | 'high_peak' | 'hourly' | 'shift_change'
  ergonomic_score: number
  efficiency_score: number
  hygiene_score: number
  safety_score: number
  notes?: string
}

export interface StaffMovement {
  id: string
  store_id: string
  workstation_id?: string
  task: string
  start_position: string
  end_position: string
  distance_meters: number
  estimated_seconds: number
  frequency_per_hour: number
  cross_traffic: boolean
  bottleneck?: string
  recommended_route?: string
  notes?: string
}

export interface StoreBestPractice {
  id: string
  category: 'layout' | 'speed' | 'rush_hour' | 'cleaning' | 'prep' | 'equipment'
  title: string
  problem: string
  recommended_method: string
  why: string
  expected_benefit?: string
  time_saved_seconds: number
  quality_improvement?: string
  hygiene_improvement?: string
  cost_impact?: string
  source: string
  evidence_level: 'verified_in_field' | 'expert_theory' | 'trial'
  applicable_store_type: string[]
}

export interface HygieneStandard {
  id: string
  category: 'counter' | 'tea_bucket' | 'ice_maker' | 'drainage' | 'fridge' | 'personal'
  area: string
  standard: string
  acceptable_condition: string[]
  unacceptable_condition: string[]
  critical_limit?: string
  inspection_method: string
  frequency: string
  responsible_role: string
  source: string
  risk_level: 'low' | 'medium' | 'high' | 'critical'
}

export interface CleaningBestPractice {
  id: string
  area: string
  problem?: string
  cleaning_method: string
  tools: string[]
  chemical?: string
  sequence: Array<{ step: number; action: string; duration_seconds: number; tip?: string }>
  estimated_time_seconds: number
  frequency: string
  quality_score: number
  hygiene_score: number
  labor_score: number
  best_practice_tips?: string
  source?: string
}

export interface ServiceBehavior {
  id: string
  category: 'greeting' | 'order_taking' | 'drink_handover' | 'complaint' | 'farewell'
  behavior: string
  definition: string
  good_example: string
  bad_example: string
  customer_effect: string
  manager_coaching: string
  training_method: string
  evaluation_method: string
}

export interface CoachingMethod {
  id: string
  skill: string
  employee_level: 'novice_day1_7' | 'junior_month1' | 'senior' | 'all'
  situation: string
  coaching_method: string
  example_dialogue: string
  demonstration_guide?: string
  practice_exercise?: string
  feedback_framework?: string
  follow_up_period?: string
  common_mistakes?: string
}

export interface EmployeeCompetency {
  id: string
  role: string
  competency: string
  level_1: string
  level_2: string
  level_3: string
  level_4: string
  level_5: string
  definition?: string
  training_modules?: string[]
}

export interface StoreProblem {
  id: string
  store_id: string
  store_code?: string
  problem_category: 'product' | 'process' | 'people' | 'equipment' | 'environment' | 'customer' | 'marketing' | 'management' | 'supplier' | 'regulation'
  problem: string
  symptom: string
  frequency: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  root_cause: string
  solution: string
  solution_result?: string
  verified: boolean
  time_saved_percent?: number
  related_product_id?: string
  related_shift?: string
  created_at?: string
}

export interface StoreProblemMemory {
  id: string
  similarity_tags: string[]
  problem_pattern: string
  root_cause_pattern: string
  proven_solution: string
  success_metrics: string
  applied_count: number
  source_store_name: string
}

export interface StoreZaloAccount {
  id: string
  store_id: string
  store_code?: string
  account_type: 'zalo_oa' | 'zalo_group' | 'zalo_zns'
  account_name: string
  account_id?: string
  url?: string
  admin_name?: string
  followers_or_members: number
  active_members: number
  monthly_growth_rate: number
  last_activity_date?: string
}

export interface MarketingCampaign {
  id: string
  store_id: string
  store_code?: string
  channel: 'zalo_group' | 'zalo_oa' | 'facebook_local' | 'offline_qr'
  campaign_name: string
  content_type: 'product' | 'lifestyle' | 'store_story' | 'poll' | 'exclusive_offer'
  objective?: string
  content_copy: string
  image_guidelines?: string
  start_date?: string
  cost_vnd?: number
  new_members_acquired?: number
  engagement_rate?: number
  redemption_count?: number
  roi_score?: number
  lesson_learned?: string
  created_at?: string
}

export interface CompanyPrinciple {
  id: string
  category: 'quality' | 'hygiene' | 'integrity' | 'customer_first'
  principle: string
  meaning: string
  why: string
  good_example: string
  bad_example: string
  manager_action?: string
  employee_action?: string
  version?: string
}

export interface DiagnosisLayer {
  layer: number | string
  name: string
  category?: string
  status: 'clean' | 'normal' | 'suspect' | 'root_cause' | 'not_applicable'
  findings?: string
  finding?: string
  evidence: string
  remedy?: string
}

export interface DiagnosisOutput {
  summary?: string
  problem_analysis?: string
  primary_category?: string
  root_cause?: string
  root_cause_summary?: string
  layers: DiagnosisLayer[]
  immediate_actions: string[]
  preventive_actions?: string[]
  similar_store_case?: {
    store_name: string
    similarity: string
    adopted_solution: string
    result: string
  }
  similar_past_cases?: any[]
  manager_script?: string
  coaching_dialogue?: {
    step_1_empathy: string
    step_2_factual_observation: string
    step_3_guiding_question: string
    step_4_action_agreement: string
    step_5_empowerment: string
  }
  rd_verification_needed?: boolean
  rd_recipe_standard?: string
  related_rd_recipe?: {
    name: string
    target_brix?: string
    standard_syrup?: string
    brewing_temp?: string
    link?: string
  }
}

export interface VisionAnalysisResult {
  scene_type?: string
  detected_zone?: string
  cleanliness_score?: number
  ergonomic_score?: number
  safety_score?: number
  score_5s?: {
    total: number
    seiri: number
    seiton: number
    seiso: number
    seiketsu: number
    shitsuke: number
  }
  hygiene_compliance?: {
    score: number
    critical_issues?: string[]
    good_practices?: string[]
  }
  ergonomic_risk?: 'low' | 'medium' | 'high'
  defects?: Array<{
    severity: 'high' | 'medium' | 'low' | string
    location: string
    issue: string
    corrective_action: string
  }>
  layout_bottlenecks?: string[]
  hygiene_observations?: Array<{ item: string; status: 'good' | 'bad' | 'warning'; note: string }>
  top3_improvements?: Array<{
    priority: number
    title: string
    action: string
    estimated_impact: string
  }>
  praise_points?: string[]
  immediate_coaching_tip?: string
}

export interface StoreLearningMaterial {
  id: string
  store_code?: string
  title: string
  source_type: 'sop_manual' | 'audit_report' | 'complaint_case' | 'supervisor_guide' | 'external_benchmark' | 'video_url' | 'owner_memo' | string
  source_url?: string
  raw_content: string
  ai_summary?: string
  dimension: 'sop' | 'workflow' | 'workstation' | 'layout' | 'movement' | 'hygiene' | 'coaching' | 'problem_memory' | string
  key_takeaways?: string[]
  actionable_rules?: string[]
  evidence_level?: 'A' | 'B' | 'C' | 'D' | string
  status?: 'active' | 'archived' | 'reviewing' | string
  author_role?: string
  created_at?: string
  updated_at?: string
}

