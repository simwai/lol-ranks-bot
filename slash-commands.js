const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');

class SlashCommands {
  constructor(discord, config) {
    this.clientId = config.clientId;
    this.guildId = config.guildId;
    this.discordToken = config.discordToken;
    this.discord = discord;
    this.commands = [ { name: 'rank', description: 'Bekomme deine Solo Q Elo als Rolle zugewiesen.', optionName: 'ign', optionDescription: 'LoL-In-Game-Name', isRequired: true } ];
  }

  async init() {
    const rest = new REST({ version: '9' }).setToken(this.discordToken);

    for (const command of this.commands) {
      await rest.post(
        Routes.applicationGuildCommands(this.clientId, this.guildId),
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
      ).catch(error => console.error(error));
    }
  }
}

module.exports = {
  SlashCommands,
};
