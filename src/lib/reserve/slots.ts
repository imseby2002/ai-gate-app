import { ReserveStore, ReserveService, ReserveStaff, ReserveAppointment, AvailableSlot } from './types'

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const
type DayKey = typeof DAY_KEYS[number]

function parseTimeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

function minutesToTimeString(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function computeAvailableSlots({
  dateStr, // 'YYYY-MM-DD'
  store,
  service,
  staffList,
  appointments,
  selectedStaffId,
}: {
  dateStr: string
  store: ReserveStore
  service: ReserveService
  staffList: ReserveStaff[]
  appointments: ReserveAppointment[]
  selectedStaffId?: string | null
}): AvailableSlot[] {
  const dateObj = new Date(dateStr)
  const dayIndex = dateObj.getDay()
  const dayKey: DayKey = DAY_KEYS[dayIndex]

  // Check store business hours
  const storeHours = store.business_hours?.[dayKey]
  if (!storeHours || storeHours.closed) {
    return []
  }

  const storeOpenMins = parseTimeToMinutes(storeHours.open)
  const storeCloseMins = parseTimeToMinutes(storeHours.close)
  const interval = store.slot_interval_minutes || 30
  const serviceDuration = service.duration_minutes
  const bufferDuration = service.buffer_minutes || 0
  const totalOccupiedDuration = serviceDuration + bufferDuration

  // Filter staff who can perform this service
  const qualifiedStaff = staffList.filter(s => {
    if (!s.is_active) return false
    if (!s.service_ids || s.service_ids.length === 0) return true
    return s.service_ids.includes(service.id)
  })

  // Relevant active appointments for this date
  const activeAppts = appointments.filter(a => {
    if (a.status === 'cancelled') return false
    const apptDate = a.start_time.slice(0, 10)
    return apptDate === dateStr
  })

  const slots: AvailableSlot[] = []
  const maxStartMins = storeCloseMins - serviceDuration

  // Current time check if booking for today
  const now = new Date()
  const todayDateStr = now.toISOString().slice(0, 10)
  const isToday = dateStr === todayDateStr
  const currentTotalMins = now.getHours() * 60 + now.getMinutes()
  const minBookingHours = store.min_booking_hours || 0

  for (let startMins = storeOpenMins; startMins <= maxStartMins; startMins += interval) {
    const endMins = startMins + totalOccupiedDuration
    const timeStr = minutesToTimeString(startMins)
    const dateTimeStr = `${dateStr}T${timeStr}:00`

    // Exclude past times or times earlier than min_booking_hours
    if (isToday) {
      if (startMins < currentTotalMins + minBookingHours * 60) {
        continue
      }
    }

    if (selectedStaffId) {
      // Specified staff
      const staff = staffList.find(s => s.id === selectedStaffId)
      if (!staff || !staff.is_active) {
        slots.push({
          time: timeStr,
          dateTime: dateTimeStr,
          available: false,
          reason: '服務人員不可預約',
        })
        continue
      }

      // Check staff roster for this day
      const staffShift = staff.weekly_schedule?.[dayKey]
      if (!staffShift || !staffShift.work || !staffShift.start || !staffShift.end) {
        slots.push({
          time: timeStr,
          dateTime: dateTimeStr,
          available: false,
          staffId: staff.id,
          staffName: staff.name,
          reason: '人員今日公休',
        })
        continue
      }

      const staffStart = parseTimeToMinutes(staffShift.start)
      const staffEnd = parseTimeToMinutes(staffShift.end)
      if (startMins < staffStart || startMins + serviceDuration > staffEnd) {
        slots.push({
          time: timeStr,
          dateTime: dateTimeStr,
          available: false,
          staffId: staff.id,
          staffName: staff.name,
          reason: '非工作時段',
        })
        continue
      }

      // Check overlapping appointments for this staff
      const isOverlap = activeAppts.some(a => {
        if (a.staff_id !== staff.id) return false
        const aStart = new Date(a.start_time).getHours() * 60 + new Date(a.start_time).getMinutes()
        const aEnd = new Date(a.end_time).getHours() * 60 + new Date(a.end_time).getMinutes()
        return startMins < aEnd && endMins > aStart
      })

      slots.push({
        time: timeStr,
        dateTime: dateTimeStr,
        available: !isOverlap,
        staffId: staff.id,
        staffName: staff.name,
        reason: isOverlap ? '該時段已約滿' : undefined,
      })
    } else {
      // Any staff: find at least one free staff
      const availableStaff = qualifiedStaff.find(staff => {
        const shift = staff.weekly_schedule?.[dayKey]
        if (!shift || !shift.work || !shift.start || !shift.end) return false
        const shiftStart = parseTimeToMinutes(shift.start)
        const shiftEnd = parseTimeToMinutes(shift.end)
        if (startMins < shiftStart || startMins + serviceDuration > shiftEnd) return false

        const hasConflict = activeAppts.some(a => {
          if (a.staff_id !== staff.id) return false
          const aStart = new Date(a.start_time).getHours() * 60 + new Date(a.start_time).getMinutes()
          const aEnd = new Date(a.end_time).getHours() * 60 + new Date(a.end_time).getMinutes()
          return startMins < aEnd && endMins > aStart
        })

        return !hasConflict
      })

      if (availableStaff) {
        slots.push({
          time: timeStr,
          dateTime: dateTimeStr,
          available: true,
          staffId: availableStaff.id,
          staffName: availableStaff.name,
        })
      } else {
        slots.push({
          time: timeStr,
          dateTime: dateTimeStr,
          available: false,
          reason: '時段已約滿',
        })
      }
    }
  }

  return slots
}
