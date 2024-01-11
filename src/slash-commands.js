const { REST } = require('@discordjs/rest')
const { Routes } = require('discord-api-types/v9')
const i18n = require('i18n')

class SlashCommands {
  constructor(config, clientId) {
    this.config = config
    this.clientId = clientId
    this.commands = [
      {
        name: 'rank',
        description: i18n.__('rankCommandDescription'),
        optionName: i18n.__('rankCommandOptionName'),
        optionDescription: i18n.__('rankCommandOptionDescription'),
        isRequired: true
      }
    ]
  }

  async init() {
    const rest = new REST({ version: '9' }).setToken(this.config.discordToken)

    for (const command of this.commands) {
      try {
        await rest.post(
          Routes.applicationGuildCommands(this.clientId, this.config.guildId),
          {
            body: {
              name: command.name,
              type: 1,
              description: command.description,
              options: [
                {
                  name: command.optionName,
                  type: 3,
                  description: command.optionDescription,
                  required: command.isRequired
                }
              ]
            }
          }
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
