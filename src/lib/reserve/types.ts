export type StoreCategory = 'beauty' | 'hair' | 'clinic' | 'spa' | 'fitness' | 'pet' | 'consulting' | 'auto' | 'other'

export interface DaySchedule {
  open: string  // '10:00'
  close: string // '20:00'
  closed: boolean
}

export type BusinessHours = {
  mon: DaySchedule
  tue: DaySchedule
  wed: DaySchedule
  thu: DaySchedule
  fri: DaySchedule
  sat: DaySchedule
  sun: DaySchedule
}

export interface ReserveStore {
  id: string
  user_id: string
  company_id?: string | null
  slug: string
  name: string
  category: StoreCategory
  description?: string | null
  phone?: string | null
  email?: string | null
  address?: string | null
  cover_url?: string | null
  logo_url?: string | null
  business_hours: BusinessHours
  slot_interval_minutes: number
  advance_booking_days: number
  min_booking_hours: number
  allow_any_staff: boolean
  deposit_required: boolean
  deposit_amount: number
  currency: string
  notice?: string | null
  is_active: boolean
  sms_reminder_enabled?: boolean
  sms_reminder_hours?: number
  sms_reminder_template?: string | null
  created_at?: string
  updated_at?: string
}

export interface ReserveService {
  id: string
  store_id: string
  category_name: string
  name: string
  description?: string | null
  duration_minutes: number
  buffer_minutes: number
  price: number
  sale_price?: number | null
  is_active: boolean
  sort_order: number
  image_url?: string | null
  created_at?: string
  updated_at?: string
}

export interface StaffDayShift {
  work: boolean
  start?: string
  end?: string
}

export type StaffWeeklySchedule = {
  mon: StaffDayShift
  tue: StaffDayShift
  wed: StaffDayShift
  thu: StaffDayShift
  fri: StaffDayShift
  sat: StaffDayShift
  sun: StaffDayShift
}

export interface ReserveStaff {
  id: string
  store_id: string
  name: string
  title: string
  avatar_url?: string | null
  bio?: string | null
  service_ids?: string[]
  weekly_schedule: StaffWeeklySchedule
  is_active: boolean
  sort_order: number
  created_at?: string
  updated_at?: string
}

export type AppointmentStatus =
  | 'pending'
  | 'confirmed'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'no_show'

export type PaymentStatus =
  | 'unpaid'
  | 'deposit_paid'
  | 'paid'
  | 'refunded'

export interface ReserveAppointment {
  id: string
  appointment_no: string
  store_id: string
  service_id: string | null
  staff_id: string | null
  customer_name: string
  customer_phone: string
  customer_email?: string | null
  customer_notes?: string | null
  internal_notes?: string | null
  start_time: string // ISO string
  end_time: string   // ISO string
  status: AppointmentStatus
  total_price: number
  payment_status: PaymentStatus
  cancel_reason?: string | null
  created_at?: string
  updated_at?: string
  // Joins
  service?: ReserveService | null
  staff?: ReserveStaff | null
}

export interface ReserveCustomer {
  id: string
  store_id: string
  name: string
  phone: string
  email?: string | null
  tags: string[]
  preferences?: string | null
  total_visits: number
  total_spent: number
  last_visit_at?: string | null
  created_at?: string
  updated_at?: string
}

export interface AvailableSlot {
  time: string // '14:30'
  dateTime: string // ISO string
  available: boolean
  staffId?: string
  staffName?: string
  reason?: string
}
