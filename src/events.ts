import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'
import lowdb from 'lowdb'
import Bottleneck from 'bottleneck'
import { I18n } from 'i18n'
import { Client, Interaction } from 'discord.js'
import { SlashCommands } from './slash-commands.js'
import { LoLRanks } from './lol-ranks.js'
import { Roles } from './roles.js'
import { DbHandler } from './data-handlers/db-handler.js'
import { ApiHandler } from './data-handlers/api-handler.js'
import { Config } from './interfaces/config.interface.js'
import { SummonerDataArgs } from './types/summoner-data.type.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export class Events {
  // TODO: Optimize accessors
  db: lowdb.LowdbSync<any>
  limiter: Bottleneck
  client: Client
  i18n: I18n
  lolRanks: LoLRanks | undefined
  config: Config

  apiHandler: ApiHandler
  dbHandler: DbHandler

  commands: Map<any, any>

  constructor(
    client: Client,
    db: lowdb.LowdbSync<any>,
    limiter: Bottleneck,
    i18n: I18n,
    config: Config
  ) {
    this.db = db
    this.limiter = limiter
    this.client = client
    this.i18n = i18n
    this.config = config

    this.apiHandler = ApiHandler.getInstance(this.config)
    this.dbHandler = DbHandler.getInstance(this.db)

    this.commands = new Map()

    this.init()
  }

  async init() {
    this.client.once('ready', async () => {
      console.log('Ready!')
      this.client.user!.setActivity(this.config.status, { type: 'PLAYING' })

      // Initialize roles and lolRanks before loading commands
      const roles = new Roles(this.client, this.config)
      await roles.init()
      this.lolRanks = new LoLRanks(
        this.client,
        this.config,
        this.db,
        this.limiter,
        this.i18n,
        roles
      )

      // Load commands after dependencies are initialized
      await this.loadCommands()

      const slashCommands = new SlashCommands(
        this.config,
        this.client.application!.id,
        this.commands
      )
      await slashCommands.init()
    })

    // Handling command interaction
    this.client.on('interactionCreate', async (interaction: Interaction) => {
      if (!interaction || !this.client.isReady()) return

      if (
        interaction.isButton() &&
        interaction.component.label === i18n.__('confirm')
      ) {
        const player = this.dbHandler.getPlayerByDiscordId(interaction.user.id)
        if (!player) {
          console.error('Player not found.')
          return
        }

        if (!player?.summonerID) {
          console.error('Player not found.')
          return
        }

        const args: SummonerDataArgs = {
          value: player.summonerID,
          type: 'summonerID'
        }

        this.executeCommand('rank', interaction, args)
      } else if (interaction.isCommand()) {
        const value = interaction.options.data[0].value as string
        const args: SummonerDataArgs = {
          type: 'summonerName',
          value: value.trim()
        }

        this.executeCommand(interaction.commandName, interaction, args)
      }
    })
  }

  async loadCommands() {
    const commandsPath = path.join(__dirname, 'commands')
    const commandFiles = fs
      .readdirSync(commandsPath, { withFileTypes: true })
      .filter(
        (file: fs.Dirent) =>
          file.isFile() && !file.name.includes('command-interface')
      )

    for (const file of commandFiles) {
      const Command = (
        await import(pathToFileURL(path.join(commandsPath, file.name)).href)
      ).default
      if (Command) {
        const commandInstance = new Command(
          this.config,
          this.lolRanks,
          this.limiter,
          this.i18n
        )
        if (commandInstance.name) {
          this.commands.set(commandInstance.name, commandInstance)
        }
      }
    }
  }

  async executeCommand<T extends Interaction>(
    name: string,
    message: T,
    args: SummonerDataArgs
  ) {
    const command = this.commands.get(name)
    if (!command) {
      console.trace(`No command found for name: ${name}`)
      return
    }

    try {
      await command.execute(message, args)
    } catch (error) {
      console.trace(`Error executing command ${name}:`, error)
    }
  }
}
