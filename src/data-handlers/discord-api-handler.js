const got = require('got')
const { URL } = require('url')
const i18n = require('i18n')

class ApiHandler {
  constructor(config) {
    this.config = config
    this.discordBaseURL = 'https://discord.com/api/v9'
  }

  static getInstance(config = null) {
    if (!this.instance) {
      this.instance = new ApiHandler(config)
    }

    return this.instance
  }

  async getData(url) {
    let response

    try {
      url = new URL(url)
      response = await got(url, {
        method: 'GET',
        headers: {
          'X-Riot-Token': this.config.riotToken,
          Host: url.host
        }
      }).json()

      return response
    } catch (error) {
      throw new Error(error + ' ' + error.response.statusCode)
    }
  }

  async getSummonerDataByNameOrId(args) {
    let summonerDataUrl = `https://${this.config.region}.api.riotgames.com/lol/summoner/v4/summoners/`

    switch (args.type) {
    case 'summonerName':
      summonerDataUrl += 'by-name/' + args.value
      break
    case 'summonerID':
      summonerDataUrl += args.value
      break
    case 'player':
      summonerDataUrl += args.value.summonerID
      break
    default:
      break
    }

    return this.getData(summonerDataUrl)
  }

  async getRankedDataById(helpChannel, summonerID) {
    const rankDataURL = `https://${this.config.region}.api.riotgames.com/lol/league/v4/entries/by-summoner/${summonerID}`

    let rankData = ''

    try {
      rankData = await this.getData(rankDataURL)
    } catch (error) {
      console.trace('Failed to get ranked data', error)

      return i18n.__('reply7') + helpChannel + '!'
    }

    return rankData
  }

  async validateGuildId(guildId) {
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
    } catch (error) {
      throw new Error(
        `Invalid guild ID: ${guildId}. ${error.response?.body || error.message}`
      )
    }
  }

  async validateChannelId(channelId, guildId) {
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
      const channelExists = channels.some((channel) => channel.id === channelId)

      if (!channelExists) {
        throw new Error(
          `Channel ID ${channelId} does not exist in guild ${guildId}.`
        )
      }

      console.log(`Channel ID ${channelId} is valid.`)
      return true
    } catch (error) {
      throw new Error(
        `Invalid channel ID: ${channelId}. ${
          error.response?.body || error.message
        }`
      )
    }
  }
}

module.exports = {
  ApiHandler
}
