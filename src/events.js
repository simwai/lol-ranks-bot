const fs = require('fs')
const path = require('path')
const i18n = require('i18n')
const { SlashCommands } = require('./slash-commands')
const { LoLRanks } = require('./lol-ranks')
const { Roles } = require('./roles')
const { DbHandler } = require('./data-handlers/db-handler')
const { ApiHandler } = require('./data-handlers/api-handler')

class Events {
  constructor(client, db, limiter, config) {
    this.config = config
    this.db = db
    this.limiter = limiter
    this.client = client
    this.apiHandler = ApiHandler.getInstance(this.config)
    this.dbHandler = DbHandler.getInstance(this.db)
    this.commands = new Map()

    this.init()
  }

  async init() {
    this.client.once('ready', async () => {
      console.log('Ready!')
      this.client.user.setActivity(this.config.status, { type: 'PLAYING' })

      // Initialize roles and lolRanks before loading commands
      const roles = new Roles(this.client, this.config)
      await roles.init()
      this.lolRanks = new LoLRanks(
        this.client,
        this.config,
        this.db,
        this.limiter,
        roles
      )

      // Load commands after dependencies are initialized
      this.loadCommands()

      const slashCommands = new SlashCommands(
        this.config,
        this.client.application.id,
        this.commands
      )
      await slashCommands.init()
    })

    // Handling command interaction
    this.client.on('interactionCreate', async (interaction) => {
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

        const args = {
          value: player.summonerID,
          type: 'summonerID'
        }

        this.executeCommand('rank', interaction, args)
      }

      else if (interaction.isCommand() && interaction.commandName === 'rank') {
        const args = {
          type: 'summonerName',
          value: interaction.options.data[0].value.trim()
        }
        this.executeCommand('rank', interaction, args)
      }
    })
  }

  loadCommands() {
    const commandsPath = path.join(__dirname, 'commands')
    const commandFiles = fs
      .readdirSync(commandsPath)
      .filter(
        (file) => file.endsWith('.js') && !file.includes('command-interface')
      )

    for (const file of commandFiles) {
      const Command = require(path.join(commandsPath, file))
      if (Command) {
        const commandInstance = new Command(this.lolRanks, this.config, this.limiter, i18n)
        if (commandInstance.name) {
          this.commands.set(commandInstance.name, commandInstance)
        }
      }
    }
  }

  async executeCommand(name, message, args) {
    const command = this.commands.get(name)
    if (!command) {
      console.error(`No command found for name: ${name}`)
      return
    }

    try {
      await command.execute(message, args)
    } catch (error) {
      console.error(`Error executing command ${name}:`, error)
    }
  }
}

module.exports = {
  Events
}
