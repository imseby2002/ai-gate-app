// 任務處理：同步設定檔、開啟瀏覽器、Copilot 帶入文案（發布由使用者自己按）。
import { createFields, updateFields } from './adspower.mjs'
import { openTab, copyToClipboard } from './copilot.mjs'

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
    case 'copilot_post': {
      const profileId = task.account?.adspower_profile_id
      if (!profileId) throw new Error('此帳號尚未建立 AdsPower 設定檔')
      const { group_url: url, group_name: groupName, text } = task.payload ?? {}
      if (!/^https:\/\//.test(url ?? '')) throw new Error('目標社團網址無效')
      const started = await ctx.ads.startProfile(profileId)
      const wsUrl = started?.ws?.puppeteer
      if (!wsUrl) throw new Error('AdsPower 未回傳瀏覽器連線位址（ws.puppeteer）')
      await openTab(wsUrl, url)
      const copied = text ? await copyToClipboard(text) : false
      ctx.log(`已在 ${task.account.account_name} 的瀏覽器開啟「${groupName || url}」` +
        (copied ? '，文案已複製：請在發文框貼上（Ctrl+V）並自行按「發布」' : '，文案複製失敗，請從 AI-GATE 網頁複製'))
      return { opened: true, copied, posted: false }
    }
    default:
      throw new Error(`不支援的任務類型：${task.type}`)
  }
}
