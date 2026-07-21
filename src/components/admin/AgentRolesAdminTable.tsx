'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

interface AgentRoleRow {
  id: string
  label: string
  description: string
  category: string
  status: 'active' | 'disabled'
}

export function AgentRolesAdminTable({ roles }: { roles: AgentRoleRow[] }) {
  const [rows, setRows] = useState(roles)
  const [saving, setSaving] = useState<string | null>(null)

  const toggle = async (roleId: string, nextStatus: 'active' | 'disabled') => {
    setSaving(roleId)
    const res = await fetch('/api/admin/agents/roles', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roleId, status: nextStatus }),
    })
    if (res.ok) setRows(rs => rs.map(r => (r.id === roleId ? { ...r, status: nextStatus } : r)))
    setSaving(null)
  }

  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">尚未建立任何角色（見 supabase/migrations 種子資料）。</p>
  }

  return (
    <div className="space-y-2">
      {rows.map(role => (
        <div key={role.id} className="flex items-center justify-between border rounded-lg px-4 py-3">
          <div>
            <div className="font-medium text-sm flex items-center gap-2">
              {role.label}
              <Badge variant="secondary">{role.category}</Badge>
              <Badge variant={role.status === 'active' ? 'success' : 'destructive'}>
                {role.status === 'active' ? '全站啟用' : '全站停用'}
              </Badge>
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">{role.description}</div>
          </div>
          <Button
            size="sm"
            variant={role.status === 'active' ? 'destructive' : 'default'}
            disabled={saving === role.id}
            onClick={() => toggle(role.id, role.status === 'active' ? 'disabled' : 'active')}
          >
            {role.status === 'active' ? '停用此角色' : '啟用此角色'}
          </Button>
        </div>
      ))}
    </div>
  )
}
