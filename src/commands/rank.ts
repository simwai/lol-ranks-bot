import Bottleneck from 'bottleneck'
import { I18n } from 'i18n'
import {
  ButtonInteraction,
  ColorResolvable,
  CommandInteraction,
  MessageActionRow,
  MessageButton,
  MessageEmbed
} from 'discord.js'
import { Config } from '../interfaces/config.interface.js'
import { CommandInterface } from '../interfaces/command.interface.js'
import { LoLRanks } from '../lol-ranks.js'
import { SummonerDataArgs } from '../types/summoner-data.type.js'

// Must be default export!!!
export default class RankCommand<
  T extends CommandInteraction | ButtonInteraction
> extends CommandInterface<T> {
  i18n: I18n
  config: Config
  lolRanks: LoLRanks
  limiter: Bottleneck
  buttonText: string

  constructor(
    config: Config,
    lolRanks: LoLRanks,
    limiter: Bottleneck,
    i18n: I18n
  ) {
    super('rank')
    this.config = config
    this.lolRanks = lolRanks
    this.limiter = limiter
    this.i18n = i18n
    this.buttonText = this.i18n.__('confirm')
  }

  async execute(
    message: CommandInteraction | ButtonInteraction,
    args: SummonerDataArgs
  ) {
    this.limiter
      .schedule(async () => {
        const reply = await this.lolRanks.setRoleByRank(message, {
          value: args.value,
          type: args.type
        })

        if (!reply) return { reply: null }

        const embed = new MessageEmbed().setColor(
          this.config.embedColor as ColorResolvable
        )
        embed.setDescription(reply)

        return {
          embed,
          isButton:
            reply !== this.i18n.__('reply8') &&
            !reply.includes(this.i18n.__('reply4_1')) &&
            !reply.includes(this.i18n.__('reply5_1'))
        }
      })
      .then(({ embed, isButton }): void => {
        if (!embed) return

        const row = new MessageActionRow()
        if (isButton && this.buttonText) {
          row.addComponents(
            new MessageButton()
              .setCustomId('primary')
              .setLabel(this.buttonText)
              .setStyle('PRIMARY')
          )
        }

        try {
          message.reply(
            isButton && this.buttonText
              ? { embeds: [embed], components: [row] }
              : { embeds: [embed] }
          )
        } catch (error) {
          console.trace('Failed to reply in rank command', error)
        }
      })
      .catch((warning: Error) => console.warn(warning))
  }

  getSlashCommandData() {
    return {
      name: 'rank',
      type: 1,
      description: this.i18n.__('rankCommandDescription'),
      options: [
        {
          name: this.i18n.__('rankCommandOptionName'),
          description: this.i18n.__('rankCommandOptionDescription'),
          type: 3,
          required: true
        }
      ]
    }
  }
}
