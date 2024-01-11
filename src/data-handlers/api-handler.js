const got = require('got')
const { URL } = require('url')
const i18n = require('i18n')

class ApiHandler {
  constructor(config) {
    this.config = config
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
}

module.exports = {
  ApiHandler
}
