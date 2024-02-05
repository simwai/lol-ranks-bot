const { CronJob } = require('cron')
const i18n = require('i18n')
const { DbHandler } = require('./data-handlers/db-handler')
const { ApiHandler } = require('./data-handlers/api-handler')

class LoLRanks {
  constructor(client, config, db, limiter, roles) {
    this.client = client
    this.config = config
    this.db = db
    this.limiter = limiter
    this.roles = roles
    this.dbHandler = DbHandler.getInstance(this.db)
    this.apiHandler = ApiHandler.getInstance(this.config)

    this.startCronJob()
  }

  startCronJob() {
    if (this.config.enableCronJob) {
      new CronJob(
        this.config.cronTab,
        async () => {
          await this.checkRanks()
        },
        null,
        true,
        this.config.timeZone,
        null,
        true
      )
    }
  }

  async checkRanks() {
    console.log('Checking ranks')
    const players = this.db.get('players').value()

    for (const player of players) {
      try {
        await this.limiter.schedule(() =>
          this.setRoleByRank(null, { value: player, type: 'player' })
        )
      } catch (error) {
        console.trace('Error checking ranks', error)
      }
    }
  }

  async setRoleByRank(message, args) {
    console.log('Set role by rank for ', args)
    const channels = Object.values(this.config.channels)

    if (
      (message &&
        !channels.some((channelID) => message.channel.id === channelID)) ||
      !args
    ) {
      return
    }

    let summonerData

    try {
      summonerData = await this.apiHandler.getSummonerDataByNameOrId(args)
    } catch (error) {
      console.trace('Failed to get summoner data for ', args, error)
      return i18n.__('reply8')
    }

    const summonerID = summonerData.id

    const discordID =
      message?.author?.id ??
      message?.user.id ??
      this.dbHandler.getPlayerBySummonerId(summonerID).discordID

    this.dbHandler.initPlayer(discordID, summonerID)

    let guild = ''
    let member = ''

    guild = await this.client.guilds.fetch(this.config.guildId)

    try {
      member = await guild.members.fetch(discordID)
    } catch (error) {
      console.log('Discord ID ' + discordID + ' not found!')
      this.dbHandler.deletePlayer(discordID, false)
      return
    }

    const serverOwner = await guild.fetchOwner()

    let player = this.dbHandler.getPlayerByDiscordId(discordID)

    let reply = ''
    let auth = this.config.enableVerification ? player.auth : false

    if (summonerID !== player.summonerID) {
      reply += i18n.__('reply1') + '\n\n'

      auth = false
      this.dbHandler.updatePlayer(discordID, { auth: false, summonerID })
      player = this.dbHandler.getPlayerByDiscordId(discordID)

      await this.roles.removeAllEloRolesFromUser(member)
    }

    const findHelpChannel = guild.channels.cache.find(
      (c) => c.id === this.config.channels.help
    )
    const helpChannel = findHelpChannel
      ? '<#' + findHelpChannel.id + '>'
      : '<@' + serverOwner.id + '>'

    ;({ auth, reply } = this.lolAuth(
      auth,
      player,
      summonerData,
      discordID,
      reply,
      helpChannel
    ))

    if (
      (auth && this.config.enableVerification) ||
      !this.config.enableVerification
    ) {
      await this.setVerifiedRole(guild, member)

      const rankData = await this.apiHandler.getRankedDataById(
        helpChannel,
        summonerID
      )

      let soloQueueRankData = null
      let tier = ''
      let rank = ''

      if (rankData.length === 0) {
        tier = 'Unranked'
      } else {
        for (const data of rankData) {
          if (data.queueType === 'RANKED_SOLO_5x5') {
            soloQueueRankData = data
            tier =
              soloQueueRankData.tier.charAt(0) +
              soloQueueRankData.tier.slice(1).toLowerCase()
            rank = soloQueueRankData.rank
            break
          }
        }
      }

      const tierValue = {
        Unranked: 0,
        Iron: 1,
        Bronze: 2,
        Silver: 3,
        Gold: 4,
        Platinum: 5,
        Emerald: 6,
        Diamond: 7,
        Master: 8,
        Grandmaster: 9,
        Challenger: 10
      }

      const rankValue = {
        IV: 0,
        III: 1,
        II: 2,
        I: 3
      }

      if ((tier && rank) || tier === 'Unranked') {
        const checkValue =
          tier === 'Unranked'
            ? tierValue[tier]
            : tierValue[tier] + rankValue[rank]

        // Translate the tier value
        const tierLocale = i18n.__({ phrase: 'ranks', locale: 'en' })
        const translatedTier = tierLocale[tier]

        const role = guild.roles.cache.find((r) => r.name === translatedTier)
        const tierIcon =
          this.client.emojis.cache
            .find((emoji) => emoji.name === this.config.rankIconNames[tier])
            ?.toString() ?? ''

        if (this.config.enableTierUpdateMessages) {
          if (player.totalValue > checkValue) {
            return (
              member.user +
              i18n.__('levelDown') +
              tierIcon +
              '**' +
              translatedTier +
              ' ' +
              (soloQueueRankData?.rank ?? '') +
              '**!'
            )
          } else if (player.totalValue < checkValue) {
            return (
              member.user +
              i18n.__('levelUp') +
              tierIcon +
              '**' +
              translatedTier +
              ' ' +
              (soloQueueRankData?.rank ?? '') +
              '**!'
            )
          }
        }

        // Updates player tier, rank and totalValue
        this.dbHandler.updatePlayer(discordID, {
          tier,
          rank,
          totalValue: checkValue
        })
        player = this.dbHandler.getPlayerByDiscordId(discordID)

        if (member.roles.cache.find((r) => r.id === role.id)) {
          reply +=
            i18n.__('reply4_1') +
            tierIcon +
            '**' +
            translatedTier +
            ' ' +
            (soloQueueRankData?.rank ?? '') +
            '** ' +
            i18n.__('reply4_2')
        } else {
          await this.roles.removeAllEloRolesFromUser(member)
          await member.roles.add(role)

          reply +=
            i18n.__('reply5_1') +
            tierIcon +
            '**' +
            translatedTier +
            ' ' +
            (soloQueueRankData?.rank ?? '') +
            '** ' +
            i18n.__('reply5_2')
        }
      } else {
        reply +=
          i18n.__('reply6') +
          (this.config.channels.help ? helpChannel : serverOwner) +
          '!'

        this.dbHandler.updatePlayer(discordID, {
          tier: null,
          rank: null,
          auth: false
        })
        player = this.dbHandler.getPlayerByDiscordId(discordID)
      }
    }

    await this.roles.removeUnusedEloRolesFromUser(player, member)

    return reply
  }

  async setVerifiedRole(guild, member) {
    if (this.config.setVerifiedRole) {
      const verifiedRole = guild.roles.cache.find(
        (r) => r.name === i18n.__('verified')
      )

      await member?.roles.add(verifiedRole)
    }
  }

  lolAuth(auth, player, summonerData, discordID, reply, helpChannel) {
    if (!auth && this.config.enableVerification) {
      try {
        if (!player.authCode) {
          const authCode = summonerData.profileIconId
          this.dbHandler.updatePlayer(discordID, { authCode })
          throw new Error('Set auth code')
        }

        if (summonerData.profileIconId !== player.authCode) {
          reply += i18n.__('reply2') + '\n\n'
          auth = true
          this.dbHandler.updatePlayer(discordID, {
            authCode: null,
            auth: true
          })
        } else {
          throw new Error('Invalid auth')
        }
      } catch (error) {
        // TODO check whitespaces of translations used in replies
        reply +=
          i18n.__('reply3_1') +
          '\n' +
          i18n.__('reply3_2') +
          '\n' +
          i18n.__('reply3_3') +
          '\n' +
          i18n.__('reply3_5') +
          '\n\n' +
          i18n.__('reply3_7') +
          helpChannel +
          '!'
      }
    }
    return { auth, reply }
  }
}

module.exports = {
  LoLRanks
}
