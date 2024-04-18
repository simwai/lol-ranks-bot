import Bottleneck from 'bottleneck'
import {
  ButtonInteraction,
  Client,
  CommandInteraction,
  Guild,
  GuildMember,
  Role
} from 'discord.js'
import { I18n } from 'i18n'
import lowdb from 'lowdb'
import cron from 'cron'
import { Rank } from './types/rank.type.js'
import { Tier } from './types/tier.type.js'
import { Config } from './interfaces/config.interface.js'
import { DbHandler } from './data-handlers/db-handler.js'
import { ApiHandler } from './data-handlers/api-handler.js'
import { SummonerDataArgs } from './types/summoner-data.type.js'

export class LoLRanks {
  client: Client
  config: Config
  db: lowdb.LowdbSync<any>
  limiter: Bottleneck
  i18n: I18n
  roles: any

  dbHandler: DbHandler
  apiHandler: ApiHandler

  constructor(
    client: Client,
    config: Config,
    db: lowdb.LowdbSync<any>,
    limiter: Bottleneck,
    i18n: I18n,
    roles: any
  ) {
    this.client = client
    this.config = config
    this.db = db
    this.limiter = limiter
    this.i18n = i18n
    this.roles = roles

    this.dbHandler = DbHandler.getInstance(this.db)
    this.apiHandler = ApiHandler.getInstance(this.config)

    this.startCronJob()
  }

  startCronJob() {
    if (this.config.enableCronJob) {
      new cron.CronJob(
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
    console.log('Checking ranks...')
    const players = this.db.get('players').value()

    if (players?.length > 0) {
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
  }

  public async setRoleByRank(
    message: CommandInteraction | ButtonInteraction | null,
    args: SummonerDataArgs
  ) {
    console.log('Set role by rank for ', args)

    if (this.config.channels) {
      const channels = Object.values(this.config.channels)

      if (
        (message &&
          message.channel &&
          !channels.some((channelID) => message!.channel!.id === channelID)) ||
        !args
      ) {
        console.log('Command was triggered in wrong channel')
        return
      }
    }

    let summonerData

    try {
      summonerData = await this.apiHandler.getSummonerDataByNameOrId(args)
    } catch (error) {
      console.trace('Failed to get summoner data for ', args, error)
      return this.i18n.__('reply8')
    }

    const summonerID = summonerData.id

    const discordID =
      message?.user.id ??
      this.dbHandler.getPlayerBySummonerId(summonerID).discordID

    this.dbHandler.initPlayer(discordID, summonerID)

    let guild: Guild
    try {
      guild = await this.client.guilds.fetch(this.config.guildId)
    } catch (error) {
      console.log('Failed to fetch guild!')
      return
    }

    let member: GuildMember
    try {
      member = await guild.members.fetch(discordID)
    } catch (error) {
      console.log('Discord ID ' + discordID + ' not found!')
      this.dbHandler.deletePlayer(discordID, false)
      return
    }

    let serverOwner: GuildMember
    try {
      serverOwner = await guild.fetchOwner()
    } catch (error) {
      console.log('Failed to fetch server owner!')
      return
    }

    let player = this.dbHandler.getPlayerByDiscordId(discordID)

    let reply = ''
    let auth = this.config.enableVerification ? player.auth : false

    if (summonerID !== player.summonerID) {
      reply += this.i18n.__('reply1') + '\n\n'

      auth = false
      this.dbHandler.updatePlayer(discordID, { auth: false, summonerID })
      player = this.dbHandler.getPlayerByDiscordId(discordID)

      await this.roles.removeAllEloRolesFromUser(member)
    }

    const findHelpChannel = guild.channels.cache.find(
      (c: { id: any }) => c.id === this.config.channels?.help
    )
    const helpChannel = findHelpChannel
      ? '<#' + findHelpChannel.id + '>'
      : '<@' + serverOwner!.id + '>'

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
      let tier: Tier | undefined
      let rank: Rank | undefined

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

      const tierValue: { [K in Tier]: number } = {
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

      const rankValue: { [K in Rank]: number } = {
        IV: 0,
        III: 1,
        II: 2,
        I: 3
      }

      if ((tier && rank) || tier === 'Unranked') {
        const checkValue = rank
          ? tier === 'Unranked'
            ? tierValue[tier]
            : tierValue[tier] + rankValue[rank]
          : undefined

        // Translate the tier value
        const tierLocale: { [K in Tier]: K } = this.i18n.__({
          phrase: 'ranks',
          locale: this.config.eloRoleLanguage
        }) as unknown as { [K in Tier]: K }
        const translatedTier = tierLocale[tier]

        const role = guild.roles.cache.find(
          (r: { name: any }) => r.name === translatedTier
        )

        if (!role) {
          console.warn(
            'Role' +
              translatedTier +
              'not found! Interrupting rank assignment process...'
          )
          return
        }

        const tierIcon =
          this.client.emojis.cache
            .find(
              (emoji: { name: any }) =>
                emoji.name === this.config.rankIconNames[tier]
            )
            ?.toString() ?? ''

        if (this.config.enableTierUpdateMessages && checkValue) {
          if (player.totalValue > checkValue) {
            return (
              member.user +
              this.i18n.__('levelDown') +
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
              this.i18n.__('levelUp') +
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

        if (member.roles.cache.find((r: { id: any }) => r.id === role.id)) {
          reply +=
            this.i18n.__('reply4_1') +
            tierIcon +
            '**' +
            translatedTier +
            ' ' +
            (soloQueueRankData?.rank ?? '') +
            '** ' +
            this.i18n.__('reply4_2')
        } else {
          await this.roles.removeAllEloRolesFromUser(member)
          await member.roles.add(role)

          reply +=
            this.i18n.__('reply5_1') +
            tierIcon +
            '**' +
            translatedTier +
            ' ' +
            (soloQueueRankData?.rank ?? '') +
            '** ' +
            this.i18n.__('reply5_2')
        }
      } else {
        reply +=
          this.i18n.__('reply6') +
          (this.config.channels?.help ? helpChannel : serverOwner) +
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

  async setVerifiedRole(guild: Guild, member: GuildMember) {
    if (this.config.setVerifiedRole) {
      const verifiedRole: Role | undefined = guild.roles.cache.find(
        (r: { name: any }) => r.name === this.i18n.__('verified')
      )

      if (!verifiedRole) {
        console.warn(
          'The verified role could not be found. Please check your config.json file.'
        )
        return
      }

      await member?.roles.add(verifiedRole)
    }
  }

  lolAuth(
    auth: boolean,
    player: { authCode: any },
    summonerData: { profileIconId: any },
    discordID: any,
    reply: string,
    helpChannel: string
  ) {
    if (!auth && this.config.enableVerification) {
      try {
        if (!player.authCode) {
          const authCode = summonerData.profileIconId
          this.dbHandler.updatePlayer(discordID, { authCode })
          throw new Error('Set auth code')
        }

        if (summonerData.profileIconId !== player.authCode) {
          reply += this.i18n.__('reply2') + '\n\n'
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
          this.i18n.__('reply3_1') +
          '\n' +
          this.i18n.__('reply3_2') +
          '\n' +
          this.i18n.__('reply3_3') +
          '\n' +
          this.i18n.__('reply3_5') +
          '\n\n' +
          this.i18n.__('reply3_7') +
          helpChannel +
          '!'
      }
    }
    return { auth, reply }
  }
}
