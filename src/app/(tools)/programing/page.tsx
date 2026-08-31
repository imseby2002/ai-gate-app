'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import {
  Folder, File, ChevronRight, ChevronDown, Plus, Trash2, Save,
  Github, Settings, Send, Terminal, Check, Loader2, Sparkles, X,
  Search, Menu, Code2, Undo2, ArrowLeft, RefreshCw, CheckCircle2,
  FileCode, Play, HelpCircle, FileJson, FileText, Settings2, Info
} from 'lucide-react'
import Editor, { Monaco } from '@monaco-editor/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

// Models available for coding
const AI_MODELS = [
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro (Copilot)', provider: 'cli-proxy', desc: 'Copilot 免費額度，適合長代碼與邏輯推理' },
  { id: 'gpt-5.5', name: 'GPT 5.5 (Copilot)', provider: 'cli-proxy', desc: 'Copilot 免費額度，適合一般代碼生成與重構' },
  { id: 'kimi-k2.5', name: 'Kimi K2.5 (Kiro / Q)', provider: 'cli-proxy', desc: 'Kiro 免費額度，數理推理與算法能力強' },
  { id: 'grok-3-mini', name: 'Grok 3 Mini (Grok Free)', provider: 'cli-proxy', desc: 'Grok 免費額度，速度快，邏輯清晰' },
  { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6 (Proxy)', provider: 'cli-proxy', desc: '官方 Claude Sonnet 4.6，代碼精確度最高' },
  { id: 'deepseek-chat', name: 'DeepSeek Chat (Proxy)', provider: 'cli-proxy', desc: 'DeepSeek 官網 Key，高性價比程式模型' },
  { id: 'auto', name: 'Free LLM (Auto)', provider: 'free-llm', desc: 'FreeLLMAPI 自動路由（多平台備援備用）' },
]

interface RepoFile {
  path: string
  type: 'file' | 'dir'
  sha?: string
  size?: number
}

interface OpenFile {
  path: string
  content: string
  originalContent: string
  sha: string
  isDirty: boolean
}

interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
  id: string
}

export default function ProgramingPage() {
  // GitHub States
  const [token, setToken] = useState('')
  const [showTokenInput, setShowTokenInput] = useState(false)
  const [hasSavedToken, setHasSavedToken] = useState(false)
  const [repos, setRepos] = useState<any[]>([])
  const [selectedRepo, setSelectedRepo] = useState('') // format: owner/repo
  const [branches, setBranches] = useState<string[]>([])
  const [selectedBranch, setSelectedBranch] = useState('main')
  const [flatFiles, setFlatFiles] = useState<RepoFile[]>([])
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({})
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoadingRepos, setIsLoadingRepos] = useState(false)
  const [isLoadingTree, setIsLoadingTree] = useState(false)

  // File & Editor States
  const [openFiles, setOpenFiles] = useState<OpenFile[]>([])
  const [activePath, setActivePath] = useState('')
  const [isLoadingFile, setIsLoadingFile] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [commitMessage, setCommitMessage] = useState('')
  const [showCommitModal, setShowCommitModal] = useState(false)
  const [showNewFileModal, setShowNewFileModal] = useState(false)
  const [newFileName, setNewFileName] = useState('')
  const [newFileType, setNewFileType] = useState<'file' | 'dir'>('file')

  // AI Panel States
  const [selectedModel, setSelectedModel] = useState(AI_MODELS[0])
  const [aiMode, setAiMode] = useState<'chat' | 'inline' | 'quick'>('chat')
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [inlinePrompt, setInlinePrompt] = useState('')
  const [isStreamingAI, setIsStreamingAI] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')

  // Panels width & Collapse States
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [aiPanelCollapsed, setAiPanelCollapsed] = useState(false)

  // References
  const editorRef = useRef<any>(null)
  const monacoRef = useRef<Monaco | null>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)

  // Load token from localStorage on mount
  useEffect(() => {
    const savedToken = localStorage.getItem('git_pat')
    if (savedToken) {
      setToken(savedToken)
      setHasSavedToken(true)
      fetchRepos(savedToken)
    } else {
      setShowTokenInput(true)
    }
  }, [])

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatHistory, streamingContent])

  // GitHub base headers
  const getGitHeaders = (pat: string) => ({
    'Authorization': `token ${pat}`,
    'Accept': 'application/vnd.github.v3+json',
  })

  // Decode base64 to UTF-8 properly (avoiding escape/unescape issues)
  const decodeBase64 = (base64: string): string => {
    const binary = atob(base64.replace(/\s/g, ''))
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i)
    }
    return new TextDecoder('utf-8').decode(bytes)
  }

  // Encode UTF-8 to base64 properly
  const encodeBase64 = (str: string): string => {
    const bytes = new TextEncoder().encode(str)
    let binary = ''
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i])
    }
    return btoa(binary)
  }

  // Fetch repositories
  const fetchRepos = async (pat: string) => {
    if (!pat) return
    setIsLoadingRepos(true)
    try {
      const res = await fetch('https://api.github.com/user/repos?per_page=100&sort=updated', {
        headers: getGitHeaders(pat)
      })
      if (!res.ok) throw new Error('無法獲取儲存庫，請檢查 Token 權限')
      const data = await res.json()
      setRepos(data)
      if (data.length > 0) {
        setSelectedRepo(data[0].full_name)
      }
    } catch (err: any) {
      alert(err.message || '連線至 GitHub 發生錯誤')
    } finally {
      setIsLoadingRepos(false)
    }
  }

  // Fetch branches and tree when selected repo changes
  useEffect(() => {
    if (!selectedRepo || !token) return
    const fetchRepoDetails = async () => {
      setIsLoadingTree(true)
      try {
        // Fetch branches
        const branchRes = await fetch(`https://api.github.com/repos/${selectedRepo}/branches`, {
          headers: getGitHeaders(token)
        })
        if (branchRes.ok) {
          const branchData = await branchRes.json()
          const branchNames = branchData.map((b: any) => b.name)
          setBranches(branchNames)
          const defaultBranch = branchNames.includes('main') ? 'main' : branchNames.includes('master') ? 'master' : branchNames[0] || 'main'
          setSelectedBranch(defaultBranch)
          // Fetch tree for that branch
          await fetchFileTree(selectedRepo, defaultBranch, token)
        }
      } catch (err) {
        console.error('Fetch repo details error:', err)
      } finally {
        setIsLoadingTree(false)
      }
    }
    fetchRepoDetails()
  }, [selectedRepo])

  // Fetch file tree
  const fetchFileTree = async (repo: string, branch: string, pat: string) => {
    setIsLoadingTree(true)
    try {
      const res = await fetch(`https://api.github.com/repos/${repo}/git/trees/${branch}?recursive=1`, {
        headers: getGitHeaders(pat)
      })
      if (!res.ok) throw new Error('讀取專案樹狀圖失敗')
      const data = await res.json()
      const files: RepoFile[] = (data.tree || []).map((item: any) => ({
        path: item.path,
        type: item.type === 'tree' ? 'dir' : 'file',
        sha: item.sha,
        size: item.size
      }))
      // Sort directories first, then alphabetically
      files.sort((a, b) => {
        if (a.type !== b.type) return a.type === 'dir' ? -1 : 1
        return a.path.localeCompare(b.path)
      })
      setFlatFiles(files)

      // Auto expand top level folders
      const initialExpanded: Record<string, boolean> = {}
      files.forEach(f => {
        if (f.type === 'dir' && !f.path.includes('/')) {
          initialExpanded[f.path] = true
        }
      })
      setExpandedFolders(initialExpanded)
    } catch (err: any) {
      alert(err.message || '讀取專案樹狀圖失敗')
    } finally {
      setIsLoadingTree(false)
    }
  }

  // Handle manual reload tree
  const handleReloadTree = () => {
    if (selectedRepo && selectedBranch && token) {
      fetchFileTree(selectedRepo, selectedBranch, token)
    }
  }

  // Handle Token submit
  const handleSaveToken = () => {
    if (!token.trim()) return
    localStorage.setItem('git_pat', token.trim())
    setHasSavedToken(true)
    setShowTokenInput(false)
    fetchRepos(token.trim())
  }

  // Disconnect GitHub
  const handleDisconnect = () => {
    if (confirm('確定要中斷與 GitHub 的連線並清除本機 Token 嗎？')) {
      localStorage.removeItem('git_pat')
      setHasSavedToken(false)
      setToken('')
      setRepos([])
      setFlatFiles([])
      setOpenFiles([])
      setActivePath('')
      setShowTokenInput(true)
    }
  }

  // Select a branch
  const handleBranchChange = (branch: string) => {
    setSelectedBranch(branch)
    fetchFileTree(selectedRepo, branch, token)
  }

  // File tree rendering logic
  const treeNodes = useMemo(() => {
    // Return flat list if searching
    if (searchQuery.trim()) {
      return flatFiles.filter(f => f.path.toLowerCase().includes(searchQuery.toLowerCase()))
    }

    // Build hierarchical tree
    const root: any[] = []
    const pathsMap: Record<string, any> = {}

    flatFiles.forEach(file => {
      const parts = file.path.split('/')
      const parentPath = parts.slice(0, -1).join('/')
      const name = parts[parts.length - 1]

      const node = {
        name,
        path: file.path,
        type: file.type,
        sha: file.sha,
        children: [] as any[]
      }

      pathsMap[file.path] = node

      if (!parentPath) {
        root.push(node)
      } else {
        const parent = pathsMap[parentPath]
        if (parent) {
          parent.children.push(node)
        } else {
          // Fallback if parent not loaded yet
          root.push(node)
        }
      }
    })

    return root
  }, [flatFiles, searchQuery])

  // Open file
  const handleOpenFile = async (path: string, sha: string) => {
    // Check if already open
    const existing = openFiles.find(f => f.path === path)
    if (existing) {
      setActivePath(path)
      return
    }

    setIsLoadingFile(true)
    try {
      const res = await fetch(`https://api.github.com/repos/${selectedRepo}/contents/${path}?ref=${selectedBranch}`, {
        headers: getGitHeaders(token)
      })
      if (!res.ok) throw new Error('讀取檔案內容失敗')
      const data = await res.json()
      const content = decodeBase64(data.content)
      const newOpenFile: OpenFile = {
        path,
        content,
        originalContent: content,
        sha: data.sha || sha,
        isDirty: false
      }
      setOpenFiles(prev => [...prev, newOpenFile])
      setActivePath(path)
    } catch (err: any) {
      alert(err.message || '讀取檔案失敗')
    } finally {
      setIsLoadingFile(false)
    }
  }

  // Editor content change
  const handleEditorChange = (value: string | undefined) => {
    if (value === undefined || !activePath) return
    setOpenFiles(prev => prev.map(f => {
      if (f.path === activePath) {
        return {
          ...f,
          content: value,
          isDirty: value !== f.originalContent
        }
      }
      return f
    }))
  }

  // Close tab
  const handleCloseTab = (path: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const file = openFiles.find(f => f.path === path)
    if (file?.isDirty) {
      if (!confirm(`檔案「${path.split('/').pop()}」已修改，確定要關閉而不存檔嗎？`)) {
        return
      }
    }

    const nextOpen = openFiles.filter(f => f.path !== path)
    setOpenFiles(nextOpen)

    if (activePath === path) {
      if (nextOpen.length > 0) {
        setActivePath(nextOpen[nextOpen.length - 1].path)
      } else {
        setActivePath('')
      }
    }
  }

  // Active open file object
  const activeFile = useMemo(() => {
    return openFiles.find(f => f.path === activePath)
  }, [openFiles, activePath])

  // Get file icon based on extension
  const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase() || ''
    switch (ext) {
      case 'js':
      case 'ts':
      case 'tsx':
      case 'jsx':
        return <FileCode className="h-4 w-4 text-amber-500 shrink-0" />
      case 'json':
        return <FileJson className="h-4 w-4 text-emerald-500 shrink-0" />
      case 'html':
      case 'css':
        return <Code2 className="h-4 w-4 text-blue-500 shrink-0" />
      case 'md':
        return <FileText className="h-4 w-4 text-sky-500 shrink-0" />
      default:
        return <File className="h-4 w-4 text-slate-400 shrink-0" />
    }
  }

  // Commit changes to GitHub
  const handleCommit = async () => {
    if (!activeFile || !commitMessage.trim() || !token) return
    setIsSaving(true)
    try {
      const base64Content = encodeBase64(activeFile.content)
      const res = await fetch(`https://api.github.com/repos/${selectedRepo}/contents/${activeFile.path}`, {
        method: 'PUT',
        headers: {
          ...getGitHeaders(token),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: commitMessage.trim(),
          content: base64Content,
          sha: activeFile.sha,
          branch: selectedBranch
        })
      })

      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.message || '更新檔案至 GitHub 失敗')
      }

      const resData = await res.json()
      // Update open file info
      setOpenFiles(prev => prev.map(f => {
        if (f.path === activeFile.path) {
          return {
            ...f,
            originalContent: f.content,
            sha: resData.content.sha,
            isDirty: false
          }
        }
        return f
      }))

      // Update flat files list sha
      setFlatFiles(prev => prev.map(f => {
        if (f.path === activeFile.path) {
          return { ...f, sha: resData.content.sha }
        }
        return f
      }))

      setShowCommitModal(false)
      setCommitMessage('')
      alert('已成功將變更提交並推送至 GitHub！')
    } catch (err: any) {
      alert(err.message || '提交變更時發生錯誤')
    } finally {
      setIsSaving(false)
    }
  }

  // Create new file / directory
  const handleCreateNode = async () => {
    if (!newFileName.trim() || !token || !selectedRepo) return
    setIsSaving(true)

    // Figure out the path. If active file is open, place it in the same directory, otherwise root
    let basePath = ''
    if (activePath && activePath.includes('/')) {
      basePath = activePath.split('/').slice(0, -1).join('/') + '/'
    }
    const fullPath = basePath + newFileName.trim()

    try {
      if (newFileType === 'file') {
        // GitHub creates files by putting an empty or base64 file
        const res = await fetch(`https://api.github.com/repos/${selectedRepo}/contents/${fullPath}`, {
          method: 'PUT',
          headers: {
            ...getGitHeaders(token),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: `Create ${fullPath}`,
            content: '', // empty file
            branch: selectedBranch
          })
        })
        if (!res.ok) throw new Error('建立檔案失敗')
        const data = await res.json()
        
        // Add to flat list
        const newNode: RepoFile = {
          path: fullPath,
          type: 'file',
          sha: data.content.sha,
          size: 0
        }
        setFlatFiles(prev => {
          const list = [...prev, newNode]
          return list.sort((a, b) => {
            if (a.type !== b.type) return a.type === 'dir' ? -1 : 1
            return a.path.localeCompare(b.path)
          })
        })

        // Open newly created file
        handleOpenFile(fullPath, data.content.sha)
      } else {
        // GitHub doesn't support empty directories directly in git (directories only exist if they contain files).
        // So we create a placeholder .gitkeep inside the directory.
        const keepPath = `${fullPath}/.gitkeep`
        const res = await fetch(`https://api.github.com/repos/${selectedRepo}/contents/${keepPath}`, {
          method: 'PUT',
          headers: {
            ...getGitHeaders(token),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: `Create directory ${fullPath}`,
            content: '', // empty file
            branch: selectedBranch
          })
        })
        if (!res.ok) throw new Error('建立資料夾失敗')
        const data = await res.json()
        
        // Add both directory and .gitkeep to list
        const newDirNode: RepoFile = { path: fullPath, type: 'dir' }
        const newKeepNode: RepoFile = { path: keepPath, type: 'file', sha: data.content.sha, size: 0 }
        
        setFlatFiles(prev => {
          const list = [...prev, newDirNode, newKeepNode]
          return list.sort((a, b) => {
            if (a.type !== b.type) return a.type === 'dir' ? -1 : 1
            return a.path.localeCompare(b.path)
          })
        })

        // Expand new folder
        setExpandedFolders(prev => ({ ...prev, [fullPath]: true }))
      }

      setShowNewFileModal(false)
      setNewFileName('')
    } catch (err: any) {
      alert(err.message || '建立項目失敗')
    } finally {
      setIsSaving(false)
    }
  }

  // Delete file
  const handleDeleteFile = async (path: string, sha: string) => {
    if (!confirm(`確定要刪除「${path.split('/').pop()}」嗎？此操作將在 GitHub 直接產生一個刪除提交！`)) {
      return
    }
    setIsSaving(true)
    try {
      const res = await fetch(`https://api.github.com/repos/${selectedRepo}/contents/${path}`, {
        method: 'DELETE',
        headers: {
          ...getGitHeaders(token),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: `Delete ${path}`,
          sha,
          branch: selectedBranch
        })
      })
      if (!res.ok) throw new Error('刪除檔案失敗')

      // Remove from flat files list
      setFlatFiles(prev => prev.filter(f => f.path !== path))
      // Remove from open tabs
      setOpenFiles(prev => prev.filter(f => f.path !== path))
      if (activePath === path) {
        setActivePath('')
      }
    } catch (err: any) {
      alert(err.message || '刪除失敗')
    } finally {
      setIsSaving(false)
    }
  }

  // Send message to AI Coding Assistant
  const handleSendAIChat = async () => {
    if (!chatInput.trim() || isStreamingAI) return

    const userMsg: ChatMessage = {
      role: 'user',
      content: chatInput,
      id: crypto.randomUUID()
    }
    setChatHistory(prev => [...prev, userMsg])
    setChatInput('')
    setIsStreamingAI(true)
    setStreamingContent('')

    // Prepare context
    let contextPrompt = ''
    if (activeFile) {
      contextPrompt = `目前編輯的檔案是「${activeFile.path}」，內容如下：\n\`\`\`\n${activeFile.content}\n\`\`\`\n`
      // Get selection if any
      if (editorRef.current) {
        const selection = editorRef.current.getSelection()
        const selectedText = editorRef.current.getModel().getValueInRange(selection)
        if (selectedText) {
          contextPrompt += `使用者在編輯器中選取了以下代碼片段：\n\`\`\`\n${selectedText}\n\`\`\`\n`
        }
      }
    }

    const messagesToSend = [
      ...(activeFile ? [{ role: 'system' as const, content: `使用者的程式碼脈絡資訊：\n${contextPrompt}` }] : []),
      ...chatHistory.map(m => ({ role: m.role, content: m.content })),
      { role: 'user' as const, content: chatInput }
    ]

    try {
      const res = await fetch('/api/programing/completion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: selectedModel.provider,
          modelId: selectedModel.id,
          messages: messagesToSend,
          systemPrompt: '你是一個全方位的專業 AI 軟體工程師與架構師。請用繁體中文回答使用者的問題，若要提供程式碼，請直接給出易於理解、高品質、無 Bug 的完整範例，並配合簡潔的架構說明。',
        })
      })

      if (!res.ok) throw new Error('AI 串流服務發生錯誤')

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let accumContent = ''
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const dataStr = line.slice(6)
          if (dataStr === '[DONE]') continue

          try {
            const data = JSON.parse(dataStr)
            if (data.type === 'delta') {
              accumContent += data.content
              setStreamingContent(accumContent)
            } else if (data.type === 'done') {
              break
            } else if (data.type === 'error') {
              throw new Error(data.error)
            }
          } catch {}
        }
      }

      // Complete message
      const assistantMsg: ChatMessage = {
        role: 'assistant',
        content: accumContent,
        id: crypto.randomUUID()
      }
      setChatHistory(prev => [...prev, assistantMsg])
    } catch (err: any) {
      setChatHistory(prev => [...prev, {
        role: 'assistant',
        content: `❌ AI 服務錯誤：${err.message || String(err)}`,
        id: crypto.randomUUID()
      }])
    } finally {
      setIsStreamingAI(false)
      setStreamingContent('')
    }
  }

  // AI Inline Edit
  const handleInlineEdit = async () => {
    if (!editorRef.current || !inlinePrompt.trim() || isStreamingAI) return

    const selection = editorRef.current.getSelection()
    const selectedText = editorRef.current.getModel().getValueInRange(selection)
    
    if (!selectedText) {
      alert('請先在編輯器中選取一段您想要修改的程式碼！')
      return
    }

    setIsStreamingAI(true)
    setStreamingContent('正在產生修改後代碼...')

    const systemPrompt = `你是一個程式代碼重構助手。使用者的任務是將提供的代碼，根據修改指令進行改寫。
請注意：
1. 僅返回修改後的代碼，不要包含 Markdown 的三個反單引號 (\`\`\`) 包裹，不要帶有任何解釋或說明。
2. 保持原有的代碼語法與格式風格。
3. 嚴格只針對使用者所要求的事項修改。`

    const messages = [
      {
        role: 'user' as const,
        content: `【原始代碼】：\n${selectedText}\n\n【修改指令】：\n${inlinePrompt}`
      }
    ]

    try {
      const res = await fetch('/api/programing/completion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: selectedModel.provider,
          modelId: selectedModel.id,
          messages,
          systemPrompt,
          maxTokens: 2048,
        })
      })

      if (!res.ok) throw new Error('AI 串流服務發生錯誤')

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let accumContent = ''
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const dataStr = line.slice(6)
          if (dataStr === '[DONE]') continue

          try {
            const data = JSON.parse(dataStr)
            if (data.type === 'delta') {
              accumContent += data.content
            }
          } catch {}
        }
      }

      // Replace selection with AI code
      // Clean up markdown block if AI accidentally outputs it
      let cleanContent = accumContent.trim()
      if (cleanContent.startsWith('```')) {
        const lines = cleanContent.split('\n')
        if (lines[0].startsWith('```')) lines.shift()
        if (lines[lines.length - 1].startsWith('```')) lines.pop()
        cleanContent = lines.join('\n')
      }

      const range = new monacoRef.current!.Range(
        selection.startLineNumber,
        selection.startColumn,
        selection.endLineNumber,
        selection.endColumn
      )
      
      const op = {
        identifier: { major: 1, minor: 1 },
        range: range,
        text: cleanContent,
        forceMoveMarkers: true
      }
      editorRef.current.executeEdits("ai-inline-edit", [op])
      
      // Update isDirty
      handleEditorChange(editorRef.current.getValue())
      setInlinePrompt('')
    } catch (err: any) {
      alert(`AI 修改代碼失敗：${err.message || String(err)}`)
    } finally {
      setIsStreamingAI(false)
      setStreamingContent('')
    }
  }

  // Trigger quick actions (Explain, Fix, JSDoc)
  const handleQuickAction = async (actionType: 'explain' | 'fix' | 'doc') => {
    if (!editorRef.current || isStreamingAI) return

    const selection = editorRef.current.getSelection()
    const selectedText = editorRef.current.getModel().getValueInRange(selection)
    const textToAnalyze = selectedText || editorRef.current.getValue()

    if (!textToAnalyze) {
      alert('請先打開檔案或選取一段代碼！')
      return
    }

    setAiMode('chat')
    setIsStreamingAI(true)
    setStreamingContent('AI 正在分析中...')

    let systemPrompt = '你是一個專業的代碼審查與分析助手。請用繁體中文回答。'
    let prompt = ''

    if (actionType === 'explain') {
      prompt = `請詳細解釋以下程式碼的功能、執行流程與核心原理：\n\`\`\`\n${textToAnalyze}\n\`\`\``
    } else if (actionType === 'fix') {
      prompt = `請分析以下程式碼，檢查是否有潛在的 Bug、錯誤、記憶體洩漏或效能瓶頸，並提供最佳化的修改方案與完整的修改後程式碼：\n\`\`\`\n${textToAnalyze}\n\`\`\``
    } else if (actionType === 'doc') {
      systemPrompt = '你是一個代碼註解大師。請在維持原代碼邏輯不變的情況下，為其加入合適的 JSDoc/TSDoc 註解與關鍵行說明，並「只」回傳修改後的完整代碼，不要有 markdown 包裹或額外解釋。'
      prompt = `幫以下代碼加上詳細的註解：\n${textToAnalyze}`
    }

    // Append user side of question
    const userMsg: ChatMessage = {
      role: 'user',
      content: `[執行快速指令：${actionType === 'explain' ? '解釋代碼' : actionType === 'fix' ? '代碼健檢與修復' : '加入詳細註解'}]`,
      id: crypto.randomUUID()
    }
    setChatHistory(prev => [...prev, userMsg])

    try {
      const res = await fetch('/api/programing/completion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: selectedModel.provider,
          modelId: selectedModel.id,
          messages: [{ role: 'user', content: prompt }],
          systemPrompt,
        })
      })

      if (!res.ok) throw new Error('AI 服務發生錯誤')

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let accumContent = ''
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const dataStr = line.slice(6)
          if (dataStr === '[DONE]') continue

          try {
            const data = JSON.parse(dataStr)
            if (data.type === 'delta') {
              accumContent += data.content
              setStreamingContent(accumContent)
            }
          } catch {}
        }
      }

      if (actionType === 'doc') {
        // For comments action, optionally paste code directly if user wants, but for safety, output to chat first
        // clean up markdown tags
        let cleanContent = accumContent.trim()
        if (cleanContent.startsWith('```')) {
          const lines = cleanContent.split('\n')
          if (lines[0].startsWith('```')) lines.shift()
          if (lines[lines.length - 1].startsWith('```')) lines.pop()
          cleanContent = lines.join('\n')
        }
        
        // Show in chat, and offer to replace
        setChatHistory(prev => [...prev, {
          role: 'assistant',
          content: `已經自動生成代碼註解。您可以複製以下代碼：\n\n\`\`\`\n${cleanContent}\n\`\`\``,
          id: crypto.randomUUID()
        }])
      } else {
        setChatHistory(prev => [...prev, {
          role: 'assistant',
          content: accumContent,
          id: crypto.randomUUID()
        }])
      }
    } catch (err: any) {
      setChatHistory(prev => [...prev, {
        role: 'assistant',
        content: `❌ 快速指令執行失敗：${err.message || String(err)}`,
        id: crypto.randomUUID()
      }])
    } finally {
      setIsStreamingAI(false)
      setStreamingContent('')
    }
  }

  // Folder toggle
  const toggleFolder = (folderPath: string) => {
    setExpandedFolders(prev => ({
      ...prev,
      [folderPath]: !prev[folderPath]
    }))
  }

  // Recursive Tree Node renderer
  const renderTreeNode = (nodes: any[], depth = 0) => {
    return nodes.map(node => {
      const isExpanded = expandedFolders[node.path]
      const hasChildren = node.children && node.children.length > 0
      const isDir = node.type === 'dir'
      
      // Calculate padding left
      const paddingLeft = `${depth * 12 + 6}px`

      if (isDir) {
        return (
          <div key={node.path} className="select-none">
            <div
              style={{ paddingLeft }}
              onClick={() => toggleFolder(node.path)}
              className="flex items-center gap-1.5 py-1 px-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded cursor-pointer text-slate-700 dark:text-slate-300 text-xs font-medium group transition-colors"
            >
              {isExpanded ? (
                <ChevronDown className="h-3.5 w-3.5 text-slate-400 group-hover:text-slate-600 shrink-0" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-slate-600 shrink-0" />
              )}
              <Folder className="h-4 w-4 text-sky-500 fill-sky-100 shrink-0" />
              <span className="truncate">{node.name}</span>
            </div>
            {isExpanded && node.children && (
              <div className="border-l border-slate-200 dark:border-slate-800 ml-3">
                {renderTreeNode(node.children, depth + 1)}
              </div>
            )}
          </div>
        )
      } else {
        const isActive = activePath === node.path
        const isDirty = openFiles.find(f => f.path === node.path)?.isDirty
        return (
          <div
            key={node.path}
            style={{ paddingLeft }}
            onClick={() => handleOpenFile(node.path, node.sha)}
            className={`flex items-center gap-1.5 py-1 px-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded cursor-pointer text-xs group transition-colors ${
              isActive
                ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400 font-semibold'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            {getFileIcon(node.name)}
            <span className="truncate flex-1">{node.name}</span>
            {isDirty && (
              <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 shrink-0" />
            )}
            <button
              onClick={(e) => {
                e.stopPropagation()
                handleDeleteFile(node.path, node.sha)
              }}
              className="opacity-0 group-hover:opacity-100 hover:text-red-500 p-0.5 shrink-0 transition-opacity"
              title="刪除檔案"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        )
      }
    })
  }

  return (
    <div className="flex h-full w-full overflow-hidden bg-slate-900 text-slate-100">
      
      {/* ── Setup / GitHub Connection Form ── */}
      {showTokenInput && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <Card className="w-full max-w-md bg-white dark:bg-slate-900 border shadow-2xl p-6 space-y-4 text-slate-800 dark:text-slate-100">
            <div className="flex items-center gap-3 border-b pb-3">
              <div className="h-9 w-9 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center shrink-0">
                <Github className="h-5 w-5 text-slate-700 dark:text-slate-300" />
              </div>
              <div>
                <h3 className="font-bold text-base">串接 GitHub 儲存庫</h3>
                <p className="text-xs text-muted-foreground">在網頁上直接讀寫與提交程式碼</p>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">GitHub Personal Access Token (PAT)</label>
              <Input
                type="password"
                placeholder="ghp_xxxxxxxxxxxx"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                className="font-mono text-sm bg-slate-50 border-slate-200"
              />
              <p className="text-[11px] text-muted-foreground leading-normal flex items-start gap-1">
                <Info className="h-3.5 w-3.5 text-indigo-500 shrink-0 mt-0.5" />
                <span>請前往 GitHub Settings &gt; Developer settings &gt; Personal access tokens 產生一個具備 <code>repo</code> 權限的 Token。此 Token 將僅儲存在您本機的網頁快取中，完全不經由第三方伺服器。</span>
              </p>
            </div>

            <div className="flex gap-2 justify-end pt-2">
              {hasSavedToken && (
                <Button variant="ghost" onClick={() => setShowTokenInput(false)} size="sm">
                  取消
                </Button>
              )}
              <Button onClick={handleSaveToken} size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white shrink-0">
                儲存並連線
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* ── Left Sidebar (Files & Repos) ── */}
      <div
        className={`${
          sidebarCollapsed ? 'w-0' : 'w-72'
        } shrink-0 border-r border-slate-800 bg-slate-950 flex flex-col h-full transition-all duration-200 overflow-hidden`}
      >
        {/* Repo Header */}
        <div className="p-3 border-b border-slate-800 space-y-2 shrink-0">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Github className="h-3.5 w-3.5" /> GitHub 專案庫
            </span>
            <div className="flex gap-1.5">
              <button
                onClick={() => setShowTokenInput(true)}
                className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-slate-200 transition-colors"
                title="金鑰設定"
              >
                <Settings className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={handleDisconnect}
                className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-red-400 transition-colors"
                title="中斷連線"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            {isLoadingRepos ? (
              <div className="flex items-center gap-2 text-xs text-slate-500 py-1.5">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-500" />
                讀取中...
              </div>
            ) : repos.length > 0 ? (
              <select
                value={selectedRepo}
                onChange={(e) => setSelectedRepo(e.target.value)}
                className="w-full text-xs font-semibold bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-indigo-500 cursor-pointer"
              >
                {repos.map(r => (
                  <option key={r.full_name} value={r.full_name}>
                    {r.full_name}
                  </option>
                ))}
              </select>
            ) : (
              <div className="text-xs text-slate-500 py-1 text-center bg-slate-900 border border-dashed border-slate-800 rounded">
                尚未串接任何專案
              </div>
            )}

            {branches.length > 0 && (
              <div className="flex items-center gap-1.5">
                <select
                  value={selectedBranch}
                  onChange={(e) => handleBranchChange(e.target.value)}
                  className="flex-1 text-[11px] bg-slate-900 border border-slate-800 rounded px-2 py-1 text-slate-400 focus:outline-none focus:border-indigo-500 cursor-pointer"
                >
                  {branches.map(b => (
                    <option key={b} value={b}>
                      🌿 {b}
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleReloadTree}
                  className="p-1 hover:bg-slate-800 border border-slate-800 rounded text-slate-400 hover:text-slate-200 transition-colors"
                  title="重新整理目錄"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Tree Search & Actions */}
        {selectedRepo && (
          <div className="px-3 py-2 border-b border-slate-800 flex gap-2 shrink-0">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-slate-500" />
              <input
                type="text"
                placeholder="搜尋檔案..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs pl-7 pr-2.5 py-1 bg-slate-900 border border-slate-800 rounded text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <button
              onClick={() => {
                setNewFileType('file')
                setShowNewFileModal(true)
              }}
              className="p-1 bg-slate-900 border border-slate-800 hover:border-slate-700 hover:bg-slate-800 rounded text-slate-300 transition-colors"
              title="新增檔案/資料夾"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* File Tree */}
        <div className="flex-1 overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-slate-800">
          {isLoadingTree ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-500 gap-2">
              <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
              <span className="text-xs">正在載入專案樹狀圖...</span>
            </div>
          ) : flatFiles.length > 0 ? (
            <div className="space-y-0.5">
              {renderTreeNode(treeNodes)}
            </div>
          ) : (
            <div className="text-xs text-slate-500 text-center py-12">
              儲存庫內沒有檔案或尚未載入
            </div>
          )}
        </div>
      </div>

      {/* ── Center Editor Area ── */}
      <div className="flex-1 flex flex-col min-w-0 bg-slate-950">
        
        {/* Editor Tabs & Toolbar */}
        <div className="h-10 shrink-0 border-b border-slate-800 bg-slate-950 flex items-center justify-between select-none">
          <div className="flex items-center overflow-x-auto max-w-[70%] scrollbar-none h-full">
            {/* Sidebar toggle */}
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="h-full px-3 hover:bg-slate-900 border-r border-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
            >
              <Menu className="h-4 w-4" />
            </button>

            {openFiles.map(file => {
              const isActive = activePath === file.path
              const fileName = file.path.split('/').pop() || ''
              return (
                <div
                  key={file.path}
                  onClick={() => setActivePath(file.path)}
                  className={`h-full px-3.5 flex items-center gap-2 border-r border-slate-850 cursor-pointer text-xs font-medium transition-colors ${
                    isActive
                      ? 'bg-slate-900 text-indigo-400 border-t-2 border-t-indigo-500 font-semibold'
                      : 'text-slate-400 hover:bg-slate-900/60 hover:text-slate-200'
                  }`}
                >
                  {getFileIcon(fileName)}
                  <span className="max-w-[120px] truncate">{fileName}</span>
                  {file.isDirty && (
                    <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 shrink-0" />
                  )}
                  <button
                    onClick={(e) => handleCloseTab(file.path, e)}
                    className="p-0.5 hover:bg-slate-800 rounded-full text-slate-500 hover:text-slate-200 transition-colors"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )
            })}
          </div>

          <div className="flex items-center gap-2 px-3">
            {activeFile && (
              <Badge variant={activeFile.isDirty ? 'warning' : 'outline'} className="text-[10px] py-0.5 font-mono bg-slate-900 border-slate-800 text-slate-400">
                {activeFile.isDirty ? '● 未儲存變更' : '✓ 與雲端同步'}
              </Badge>
            )}

            {activeFile && (
              <Button
                onClick={() => setShowCommitModal(true)}
                disabled={!activeFile.isDirty || isSaving}
                size="sm"
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium flex items-center gap-1 px-3 py-1 rounded text-xs shrink-0"
              >
                {isSaving ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Save className="h-3.5 w-3.5" />
                )}
                Commit & Push
              </Button>
            )}

            <button
              onClick={() => setAiPanelCollapsed(!aiPanelCollapsed)}
              className="p-1.5 hover:bg-slate-900 border border-slate-800 rounded text-indigo-400 hover:text-indigo-300 transition-colors"
              title="切換 AI 側邊欄"
            >
              <Sparkles className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Monaco Editor Container */}
        <div className="flex-1 relative min-h-0 bg-slate-950">
          {isLoadingFile ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/70 z-10 text-slate-400 gap-2">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
              <span className="text-sm">載入代碼中...</span>
            </div>
          ) : activeFile ? (
            <Editor
              height="100%"
              path={activeFile.path}
              defaultLanguage={activeFile.path.split('.').pop() === 'ts' ? 'typescript' : undefined}
              defaultValue={activeFile.content}
              value={activeFile.content}
              onChange={handleEditorChange}
              theme="vs-dark"
              onMount={(editor: any, monaco: Monaco) => {
                editorRef.current = editor
                monacoRef.current = monaco
              }}
              options={{
                fontSize: 13,
                fontFamily: "'Fira Code', 'Courier New', monospace",
                minimap: { enabled: true },
                automaticLayout: true,
                padding: { top: 12, bottom: 12 },
                cursorBlinking: 'smooth',
                cursorSmoothCaretAnimation: 'on',
                formatOnPaste: true,
                formatOnType: true,
              }}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-slate-500 space-y-4 p-8">
              <div className="h-16 w-16 bg-slate-900 border border-slate-800 rounded-3xl flex items-center justify-center text-slate-400 select-none">
                <Code2 className="h-8 w-8" />
              </div>
              <div className="text-center max-w-sm">
                <h4 className="font-semibold text-slate-300 mb-1">開啟或建立檔案</h4>
                <p className="text-xs text-slate-500 leading-normal">
                  點擊左側目錄樹中的檔案進行編輯，或使用「新增檔案」建立新代碼。修改後可一鍵提交 Commit 至您的 GitHub。
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Right AI Coding Assistant Panel ── */}
      <div
        className={`${
          aiPanelCollapsed ? 'w-0' : 'w-[420px]'
        } shrink-0 border-l border-slate-800 bg-slate-950 flex flex-col h-full transition-all duration-200 overflow-hidden`}
      >
        {/* AI Panel Header */}
        <div className="p-3 border-b border-slate-800 shrink-0 space-y-2 bg-slate-950">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5 select-none">
              <Sparkles className="h-4 w-4" /> AI 程式編譯助理
            </span>
            <button
              onClick={() => setAiPanelCollapsed(true)}
              className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-slate-200 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-1.5">
            <select
              value={selectedModel.id}
              onChange={(e) => {
                const model = AI_MODELS.find(m => m.id === e.target.value)
                if (model) setSelectedModel(model)
              }}
              className="w-full text-xs font-semibold bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-indigo-500 cursor-pointer"
            >
              {AI_MODELS.map(m => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
            <div className="text-[10px] text-slate-400 px-1 py-0.5 leading-normal flex items-start gap-1">
              <Info className="h-3 w-3 text-slate-500 shrink-0 mt-0.5" />
              <span>{selectedModel.desc}</span>
            </div>
          </div>
        </div>

        {/* AI Modes Tabs */}
        <div className="h-9 border-b border-slate-800 flex shrink-0 bg-slate-950/80">
          {(['chat', 'inline', 'quick'] as const).map(mode => (
            <button
              key={mode}
              onClick={() => setAiMode(mode)}
              className={`flex-1 text-xs font-medium border-b-2 transition-colors ${
                aiMode === mode
                  ? 'border-indigo-500 text-indigo-400 font-semibold bg-slate-900/40'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/10'
              }`}
            >
              {mode === 'chat' ? '智能問答 (Chat)' : mode === 'inline' ? '行內編輯 (Edit)' : '快速工具'}
            </button>
          ))}
        </div>

        {/* AI Mode Body Container */}
        <div className="flex-1 flex flex-col min-h-0 bg-slate-950">
          
          {/* Mode 1: Chat interface */}
          {aiMode === 'chat' && (
            <div className="flex-1 flex flex-col min-h-0">
              {/* Chat history */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-slate-800">
                {chatHistory.length === 0 && (
                  <div className="text-center py-12 text-slate-500 space-y-3">
                    <Sparkles className="h-10 w-10 mx-auto text-indigo-500/30 animate-pulse" />
                    <p className="text-xs max-w-[260px] mx-auto leading-normal">
                      我是您的專屬 AI 程式助理。您可以詢問關於當前代碼的任何問題，或者叫我為您編寫新的模組。
                    </p>
                  </div>
                )}

                {chatHistory.map(msg => (
                  <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                    <div className="text-[10px] text-slate-500 mb-1 select-none font-medium">
                      {msg.role === 'user' ? '您' : selectedModel.name}
                    </div>
                    <div
                      className={`max-w-[90%] rounded-xl px-3.5 py-2 text-xs leading-relaxed whitespace-pre-wrap font-sans ${
                        msg.role === 'user'
                          ? 'bg-indigo-600 text-white rounded-tr-none font-medium'
                          : 'bg-slate-900 border border-slate-800 text-slate-200 rounded-tl-none markdown-container'
                      }`}
                    >
                      {msg.content}
                    </div>
                  </div>
                ))}

                {isStreamingAI && streamingContent && (
                  <div className="flex flex-col items-start">
                    <div className="text-[10px] text-slate-500 mb-1 select-none font-medium">
                      {selectedModel.name} (輸入中...)
                    </div>
                    <div className="max-w-[90%] rounded-xl px-3.5 py-2 text-xs leading-relaxed whitespace-pre-wrap bg-slate-900 border border-slate-800 text-slate-300 rounded-tl-none font-sans">
                      {streamingContent}
                    </div>
                  </div>
                )}

                <div ref={chatEndRef} />
              </div>

              {/* Chat inputs */}
              <div className="p-3 border-t border-slate-800 flex gap-2 shrink-0 bg-slate-950">
                <input
                  type="text"
                  placeholder={activePath ? `詢問此檔案或選取段落...` : `輸入問題...`}
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendAIChat()}
                  disabled={isStreamingAI}
                  className="flex-1 text-xs px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500"
                />
                <Button
                  onClick={handleSendAIChat}
                  disabled={isStreamingAI || !chatInput.trim()}
                  size="sm"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white p-2.5 shrink-0 rounded-lg"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Mode 2: Inline Edit (Ctrl+I) */}
          {aiMode === 'inline' && (
            <div className="p-4 space-y-4 flex flex-col justify-between h-full">
              <div className="space-y-3">
                <div className="bg-slate-900/60 border border-slate-850 rounded-xl p-3 text-[11px] text-slate-400 space-y-2 leading-relaxed">
                  <div className="flex items-center gap-1.5 font-bold text-slate-300">
                    <Code2 className="h-4 w-4 text-indigo-400" />
                    <span>行內程式碼重構 (Inline Edit)</span>
                  </div>
                  <p>1. 在左側編輯器選取一段您想修改的代碼範圍。</p>
                  <p>2. 在下方輸入您的修改需求（如：將此函式改寫為非同步、優化效能、增加例外處理等）。</p>
                  <p>3. 點擊生成，AI 會直接改寫該選取範圍，無需手動複製貼上！</p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">修改代碼指令</label>
                  <Textarea
                    placeholder="請輸入您的改寫要求... (例如：將這段 React component 改為使用 hooks 寫法，並加入錯誤邊界)"
                    value={inlinePrompt}
                    onChange={(e) => setInlinePrompt(e.target.value)}
                    disabled={isStreamingAI}
                    rows={4}
                    className="text-xs bg-slate-900 border-slate-800 text-slate-200 placeholder-slate-500 focus:border-indigo-500 resize-none font-sans"
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-slate-800 flex flex-col gap-2 shrink-0">
                {isStreamingAI && (
                  <div className="text-[11px] text-indigo-400 flex items-center justify-center gap-1.5 py-1">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> {streamingContent}
                  </div>
                )}
                <Button
                  onClick={handleInlineEdit}
                  disabled={isStreamingAI || !inlinePrompt.trim()}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold py-2.5 rounded-lg flex items-center justify-center gap-1.5"
                >
                  <Sparkles className="h-4 w-4" /> 執行程式改寫
                </Button>
              </div>
            </div>
          )}

          {/* Mode 3: Quick actions */}
          {aiMode === 'quick' && (
            <div className="p-4 space-y-4 h-full flex flex-col justify-between">
              <div className="space-y-3">
                <div className="bg-slate-900/60 border border-slate-850 rounded-xl p-3 text-[11px] text-slate-400 space-y-1 leading-normal select-none">
                  <span className="font-bold text-slate-300 block mb-1">提示：</span>
                  選取程式碼片段可僅針對選取範圍執行指令。若無選取，將預設對「整份檔案」進行分析。
                </div>

                <div className="grid grid-cols-1 gap-2.5">
                  <button
                    onClick={() => handleQuickAction('explain')}
                    disabled={isStreamingAI}
                    className="flex items-center gap-3 p-3 bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl text-left hover:bg-slate-800/50 transition-all group"
                  >
                    <div className="h-8 w-8 bg-indigo-500/10 rounded-lg flex items-center justify-center shrink-0 text-indigo-400 group-hover:scale-105 transition-transform">
                      <HelpCircle className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-200">解釋代碼原理</div>
                      <div className="text-[10px] text-slate-500">深入說明選取代碼的架構與執行細節</div>
                    </div>
                  </button>

                  <button
                    onClick={() => handleQuickAction('fix')}
                    disabled={isStreamingAI}
                    className="flex items-center gap-3 p-3 bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl text-left hover:bg-slate-800/50 transition-all group"
                  >
                    <div className="h-8 w-8 bg-red-500/10 rounded-lg flex items-center justify-center shrink-0 text-red-400 group-hover:scale-105 transition-transform">
                      <Terminal className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-200">代碼健檢與修復</div>
                      <div className="text-[10px] text-slate-500">掃描並修復代碼中的 Bug、提升效能</div>
                    </div>
                  </button>

                  <button
                    onClick={() => handleQuickAction('doc')}
                    disabled={isStreamingAI}
                    className="flex items-center gap-3 p-3 bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl text-left hover:bg-slate-800/50 transition-all group"
                  >
                    <div className="h-8 w-8 bg-emerald-500/10 rounded-lg flex items-center justify-center shrink-0 text-emerald-400 group-hover:scale-105 transition-transform">
                      <FileCode className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-200">自動生成註解</div>
                      <div className="text-[10px] text-slate-500">為代碼加上標準的 JSDoc/TSDoc 文件註解</div>
                    </div>
                  </button>
                </div>
              </div>

              {isStreamingAI && (
                <div className="text-[11px] text-indigo-400 flex items-center justify-center gap-1.5 border-t border-slate-800 pt-3">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> {streamingContent}
                </div>
              )}
            </div>
          )}

        </div>
      </div>

      {/* ── Modal: Commit Confirmation ── */}
      {showCommitModal && activeFile && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <Card className="w-full max-w-md bg-white dark:bg-slate-900 border shadow-2xl p-6 space-y-4 text-slate-800 dark:text-slate-100 select-none">
            <div className="flex items-center gap-3 border-b pb-3">
              <div className="h-9 w-9 bg-indigo-50 dark:bg-indigo-950 rounded-xl flex items-center justify-center shrink-0">
                <CheckCircle2 className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <h3 className="font-bold text-base">提交變更回 GitHub</h3>
                <p className="text-xs text-slate-500">這將在 🌿 {selectedBranch} 分支產生一筆新的 Git 提交</p>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="text-xs font-bold text-slate-400">變更檔案</div>
              <div className="font-mono text-xs p-2 bg-slate-50 dark:bg-slate-800 border rounded flex items-center gap-2 text-slate-700 dark:text-slate-300">
                {getFileIcon(activeFile.path.split('/').pop() || '')}
                <span>{activeFile.path}</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Commit Message (提交說明)</label>
              <Input
                type="text"
                placeholder="例如: feat: 調整登入驗證流程 與 修正 Token 刷新問題"
                value={commitMessage}
                onChange={(e) => setCommitMessage(e.target.value)}
                disabled={isSaving}
                className="text-xs"
              />
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <Button variant="ghost" onClick={() => setShowCommitModal(false)} disabled={isSaving} size="sm">
                取消
              </Button>
              <Button
                onClick={handleCommit}
                disabled={isSaving || !commitMessage.trim()}
                size="sm"
                className="bg-indigo-600 hover:bg-indigo-700 text-white shrink-0 font-medium"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                    正在提交...
                  </>
                ) : (
                  '確認並提交 (Push)'
                )}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* ── Modal: New File/Dir ── */}
      {showNewFileModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <Card className="w-full max-w-md bg-white dark:bg-slate-900 border shadow-2xl p-6 space-y-4 text-slate-800 dark:text-slate-100 select-none">
            <div className="flex items-center gap-3 border-b pb-3">
              <div className="h-9 w-9 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center shrink-0">
                <Plus className="h-5 w-5 text-slate-700 dark:text-slate-300" />
              </div>
              <div>
                <h3 className="font-bold text-base">新增項目</h3>
                <p className="text-xs text-slate-500">在當前目錄下建立新的檔案或資料夾</p>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">項目類型</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setNewFileType('file')}
                  className={`flex-1 py-2 text-xs font-semibold rounded-lg border transition-all flex items-center justify-center gap-1.5 ${
                    newFileType === 'file'
                      ? 'bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-950/40 dark:border-indigo-800 dark:text-indigo-400'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <File className="h-3.5 w-3.5" /> 建立檔案 (File)
                </button>
                <button
                  type="button"
                  onClick={() => setNewFileType('dir')}
                  className={`flex-1 py-2 text-xs font-semibold rounded-lg border transition-all flex items-center justify-center gap-1.5 ${
                    newFileType === 'dir'
                      ? 'bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-950/40 dark:border-indigo-800 dark:text-indigo-400'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Folder className="h-3.5 w-3.5" /> 建立資料夾 (Directory)
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">名稱</label>
              <Input
                type="text"
                placeholder={newFileType === 'file' ? 'index.js 或 style.css' : 'src 或 components'}
                value={newFileName}
                onChange={(e) => setNewFileName(e.target.value)}
                disabled={isSaving}
                className="text-xs font-mono"
              />
              <p className="text-[10px] text-slate-400">
                {newFileType === 'dir' ? '資料夾將自動包含一個 .gitkeep 隱藏檔以完成 GitHub 目錄提交。' : '請包含副檔名。'}
              </p>
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <Button variant="ghost" onClick={() => setShowNewFileModal(false)} disabled={isSaving} size="sm">
                取消
              </Button>
              <Button
                onClick={handleCreateNode}
                disabled={isSaving || !newFileName.trim()}
                size="sm"
                className="bg-indigo-600 hover:bg-indigo-700 text-white shrink-0 font-medium"
              >
                {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : '確認新增'}
              </Button>
            </div>
          </Card>
        </div>
      )}

    </div>
  )
}
