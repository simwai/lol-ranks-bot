const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');

class SlashCommands {
  constructor(config, clientId) {
    this.config = config;
    this.clientId = clientId;
    this.commands = [ { name: 'rank', description: 'Get your Solo Q elo assigned as a role.', optionName: 'ign', optionDescription: 'LoL-In-Game-Name', isRequired: true },
    ];
  }

  async init() {
    const rest = new REST({ version: '9' }).setToken(this.config.discordToken);

    for (const command of this.commands) {
      try {
        await rest.post(
          Routes.applicationGuildCommands(this.clientId, this.config.guildId),
          { body: {
            name: command.name,
            type: 1,
            description: command.description,
            options: [
              {
                name: command.optionName,
                type: 3,
                description: command.optionDescription,
                required: command.isRequired,
              },
            ],
          },
          },
        );
      } catch (error) {
        console.error('Error creating slash commands:');
        console.trace(error);
      }
    }
  }
}

module.exports = {
  SlashCommands,
};
