interface UserInfo {
  uid: string
  name?: string
  email?: string
  picture?: string
  phone?: string
}

type AudioWork = {
  id: string
  title: string
  description: string
  script: string
  audioUrl: string
  createdAt: Date
  updatedAt: Date
  user: {
    id: string
    name: string
  }
}

type GetAudioWorkDetailReq = {
  userId: string
  audioWorkId: string
}

type GetAudioWorkDetailResp = {
  audioWork: AudioWork
}

type GetAudioWorkFeedReq = {
  userId: string
  limit: number
  offset: number
}

type AudioWorkCard = {
  id: string
  title: string
  audioUrl: string
  createdAt: Date
}

type GetAudioWorkFeedResp = {
  audioWorkCards: AudioWorkCard[]
}

type DeleteAudioWorkReq = {
  userId: string
  audioWorkId: string
}

type SoloConfig = {
  speaker: string // voiceId
}

type DialogueConfig = {
  host: string // voiceId
  guest: string // voiceId
}
type Role = 'user' | 'system' | 'assistant'

type AudioWorkStyle = 'SOLO' | 'DIALOGUE'

type AsyncGenerateAudioFileReq = {
  userId: string
  title: string
  script: string
  audioStyle: AudioWorkStyle
  voiceConfigString: string
}

type AsyncGenerateAudioFileResp = {
  audioWorkId: string
  generateSuccess: boolean
  taskId: string
}

type GetAsyncAudioFileStatusReq = {
  userId: string
  taskId: string
}

type GetAsyncAudioFileStatusResp = {
  audioWorkId: string
  generated: boolean
  audioUrl: string
}
type Message = {
  role: Role
  content: string
}

type VoiceMapResp = {
  voiceMap: { [key: string]: string }
}

type GenerateScriptReq = {
  userId: string
  contentFormat: 'TEXT' | 'URL'
  content: string
  audioWorkStyle: AudioWorkStyle
}

type AudioReq = {
  title: string
  contentFormat: string
  content: string
  audioWorkStyle: string
  voiceConfig: string
}

type GetProfileReq = {
  userId: string
  offset: number
  limit: number
}

type AudioWorkCard = {
  id: string
  title: string
  audioUrl: string
  createdAt: Date
}

type GetProfileResp = {
  name: string
  audioWorkNum: number
  audioWorks: AudioWorkCard[]
}
type WebTextScrapResp = {
  chunk_list: string[]
}