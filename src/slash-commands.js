const { REST } = require('@discordjs/rest')
const { Routes } = require('discord-api-types/v9')

class SlashCommands {
  constructor(config, clientId, commands) {
    this.config = config
    this.clientId = clientId
    this.commands = commands
  }

  async init() {
    const rest = new REST({ version: '9' }).setToken(this.config.discordToken)

    for (const commandInstance of this.commands) {
      const commandData = commandInstance[1].getSlashCommandData()
      try {
        await rest.post(
          Routes.applicationGuildCommands(this.clientId, this.config.guildId),
          { body: commandData }
        )
      } catch (error) {
        console.trace('Error creating slash commands', error)
      }
    }
  }
}

module.exports = {
  SlashCommands
}
