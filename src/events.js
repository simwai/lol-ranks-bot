const { SlashCommands } = require('./slash-commands');
const { LoLRanks } = require('./lol-ranks');
const { Roles } = require('./roles');

class Events {
  constructor(client, db, limiter, config) {
    this.config = config;
    this.db = db;
    this.limiter = limiter;
    this.client = client;

    this.init();
  }

  init() {
    this.client.once('ready', async () => {
      console.clear();
      console.log('Ready!');

      this.client.user.setActivity(this.config.status, { type: 'PLAYING' });

      // Init modules
      const roles = new Roles(this.client, this.config);
      await roles.init();
      this.lolRanks = new LoLRanks(this.client, this.config, this.db, this.limiter);
      const slashCommands = new SlashCommands(this.config, this.client.application.id);
      await slashCommands.init();
    });

    this.client.on('messageCreate', async (message) => {
      if (message.author.bot || !message.content.match(/<@(\d*)>/g))	return;

      const args = message.content.replace(/<@(\d*)>/g, '').split(' ');
      args.shift();
      const command = args[0] ? args[0].toLowerCase() : '';

      switch (command) {
      case 'rank':
        this.executeCommand('rank', args, message);
        break;
      default:
        break;
      }
    });

    this.client.on('interactionCreate', async (interaction) => {
      if (!interaction.isCommand()) return;

      if (interaction.commandName == 'rank') {
        this.executeCommand('rank', interaction.options.data[0].value, interaction);
      }
    });
  }

  executeCommand(name, args, message) {
    switch (name) {
    case 'rank':
      if (Array.isArray(args))
        args.shift();

      this.limiter.schedule(async () => {
        console.log('Scheduler in events.js triggered');
        return this.lolRanks.setRoleByRank(message, args);
      })
        .then((reply) => {
          if (reply) {
            message.reply(reply);
          }
        })
        .catch((warning) => console.warn(warning));
      break;
    default:
      break;
    }
  }
}

module.exports = {
  Events,
};