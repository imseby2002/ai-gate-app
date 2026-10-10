// 任務處理：同步設定檔、開啟瀏覽器。copilot_post（帶入文案）於下一版加入。
import { createFields, updateFields } from './adspower.mjs'

async function ensureGroupId(ads, cfg) {
  if (cfg.adspowerGroupId) return cfg.adspowerGroupId
  const groups = await ads.listGroups()
  const found = (groups?.list ?? []).find(g => g.group_name === cfg.adspowerGroupName)
  const id = found ? String(found.group_id) : String((await ads.createGroup(cfg.adspowerGroupName)).group_id)
  cfg.adspowerGroupId = id
  return id
}

/** 依 AI-GATE 帳號＋代理建立或更新 AdsPower 設定檔，回寫設定檔 ID */
export async function syncProfiles({ ads, aigate, cfg, log }) {
  const { profiles } = await aigate.profiles()
  const groupId = await ensureGroupId(ads, cfg)
  const summary = { created: 0, updated: 0, failed: 0, errors: [] }

  for (const acc of profiles) {
    try {
      if (acc.adspower_profile_id) {
        await ads.updateProfile({ profile_id: acc.adspower_profile_id, ...updateFields(acc) })
        summary.updated++
      } else {
        const created = await ads.createProfile({ group_id: groupId, ...createFields(acc) })
        const profileId = created?.profile_id ?? created?.id
        if (!profileId) throw new Error('AdsPower 未回傳設定檔 ID')
        await aigate.saveProfileId(acc.id, String(profileId))
        summary.created++
      }
    } catch (e) {
      summary.failed++
      summary.errors.push(`${acc.account_name}：${e.message}`)
      log(`同步失敗 ${acc.account_name}：${e.message}`)
    }
  }
  log(`同步完成：新增 ${summary.created}、更新 ${summary.updated}、失敗 ${summary.failed}`)
  return summary
}

export async function handleTask(task, ctx) {
  switch (task.type) {
    case 'sync_profiles':
      return syncProfiles(ctx)
    case 'open_profile': {
      const profileId = task.account?.adspower_profile_id
      if (!profileId) throw new Error('此帳號尚未建立 AdsPower 設定檔')
      await ctx.ads.startProfile(profileId)
      ctx.log(`已開啟 ${task.account.account_name} 的瀏覽器`)
      return { opened: profileId }
    }
    case 'copilot_post':
      throw new Error('此版本連接器尚未支援 Copilot 帶入文案，請更新連接器')
    default:
      throw new Error(`不支援的任務類型：${task.type}`)
  }
}
