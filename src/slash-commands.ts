import { REST } from '@discordjs/rest'
import { Routes } from 'discord-api-types/v9'

interface Config {
  discordToken: string
  guildId: string
}

interface Command {
  getSlashCommandData: () => object
}

class SlashCommands {
  private config: Config
  private clientId: string
  private commands: Map<string, Command>

  constructor(
    config: Config,
    clientId: string,
    commands: Map<string, Command>
  ) {
    this.config = config
    this.clientId = clientId
    this.commands = commands
  }

  async init(): Promise<void> {
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

export { SlashCommands }
