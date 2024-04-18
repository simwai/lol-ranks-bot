import got, { CancelableRequest } from 'got'
import { URL } from 'url'
import i18n from 'i18n'
import { SummonerDataArgs } from '../types/summoner-data.type.js'
import { Config } from '../interfaces/config.interface.js'

class ApiHandler {
  private static instance: ApiHandler | null = null
  private config: Config
  private discordBaseURL: string = 'https://discord.com/api/v9'

  private constructor(config: Config) {
    this.config = config
  }

  public static getInstance(config: Config | null = null): ApiHandler {
    if (!this.instance) {
      if (config === null) {
        throw new Error('Config must be provided for the first instantiation.')
      }
      this.instance = new ApiHandler(config)
    }

    return this.instance
  }

  public async getData(url: string | URL): Promise<CancelableRequest<any>> {
    try {
      url = new URL(url.toString())
      const response = await got(url, {
        method: 'GET',
        headers: {
          'X-Riot-Token': this.config.riotToken,
          Host: url.host
        }
      }).json()

      return response
    } catch (error: any) {
      if (error.response && error.response.statusCode) {
        throw new Error(`${error.message} ${error.response.statusCode}`)
      } else {
        throw new Error('Network error')
      }
    }
  }

  public async getSummonerDataByNameOrId(
    args: SummonerDataArgs
  ): Promise<CancelableRequest<any>> {
    let summonerDataUrl = `https://${this.config.region}.api.riotgames.com/lol/summoner/v4/summoners/`

    switch (args.type) {
    case 'summonerName':
      summonerDataUrl += 'by-name/' + args.value
      break
    case 'summonerID':
      summonerDataUrl += args.value
      break
    case 'player':
      if (typeof args.value === 'object' && args.value.summonerID) {
        summonerDataUrl += args.value.summonerID
      } else {
        throw new Error('Invalid argument for type "player"')
      }
      break
    default:
      break
    }

    return this.getData(summonerDataUrl)
  }

  public async getRankedDataById(
    helpChannel: string,
    summonerID: string
  ): Promise<CancelableRequest<any>> {
    const rankDataURL = `https://${this.config.region}.api.riotgames.com/lol/league/v4/entries/by-summoner/${summonerID}`

    try {
      const rankData = await this.getData(rankDataURL)
      return rankData
    } catch (error) {
      console.trace('Failed to get ranked data', error)
      return i18n.__('reply7') + helpChannel + '!'
    }
  }

  public async validateGuildId(guildId: string): Promise<boolean> {
    try {
      const response = await got(`${this.discordBaseURL}/guilds/${guildId}`, {
        headers: {
          Authorization: `Bot ${this.config.discordToken}`
        }
      })

      if (response.statusCode === 200) {
        console.log(`Guild ID ${guildId} is valid.`)
        return true
      }
      return false
    } catch (error: any) {
      throw new Error(
        `Invalid guild ID: ${guildId}. ${error.response?.body || error.message}`
      )
    }
  }

  public async validateChannelId(
    channelId: string,
    guildId: string
  ): Promise<boolean> {
    try {
      const response = await got(
        `${this.discordBaseURL}/guilds/${guildId}/channels`,
        {
          headers: {
            Authorization: `Bot ${this.config.discordToken}`
          }
        }
      )

      const channels = JSON.parse(response.body)
      const channelExists = channels.some(
        (channel: { id: string }) => channel.id === channelId
      )

      if (!channelExists) {
        throw new Error(
          `Channel ID ${channelId} does not exist in guild ${guildId}.`
        )
      }

      console.log(`Channel ID ${channelId} is valid.`)
      return true
    } catch (error: any) {
      throw new Error(
        `Invalid channel ID: ${channelId}. ${error.response?.body || error.message}`
      )
    }
  }

  public async validateRiotToken(): Promise<boolean> {
    try {
      const response = await got(
        `https://${this.config.region}.api.riotgames.com/lol/platform/v3/champion-rotations`,
        {
          headers: {
            'X-Riot-Token': this.config.riotToken
          }
        }
      )

      if (response.statusCode === 200) {
        console.log('Riot token is valid.')
        return true
      }
      return false
    } catch (error: any) {
      if (error.response?.statusCode === 401) {
        throw new Error('Invalid Riot token.')
      }
      throw error
    }
  }
}

export { ApiHandler }
