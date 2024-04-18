export interface Config {
  channels?: {
    help?: string | null
  }
  guildId: string
  setVerifiedRole: boolean
  enableVerification: boolean
  enableTierUpdateMessages: boolean
  discordToken: string
  riotToken: string
  status: string
  embedColor: string
  ranks: string[]
  rankIconNames: { [key: string]: string }
  region: string
  timeZone: string
  language: string
  eloRoleLanguage: string
  verifiedRoleLanguage: string
  enableCronJob: boolean
  cronTab: string
  concurrentRequests: number
  requestTime: number
}
