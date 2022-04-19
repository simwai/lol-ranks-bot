class Events {
  constructor(discord, lolRanks, slashCommands, db, limiter) {
    this.db = db;
    this.limiter = limiter;
    this.lolRanks = lolRanks;
    this.discord = discord;
    this.slashCommands = slashCommands;
    this.init();
  }

  init() {
    this.discord.once('ready', () => {
      console.clear();
      console.log('Ready!');

      this.discord.user.setActivity('@DGT Verifizierung Bot rank [ign]', { type: 'PLAYING' });

      this.slashCommands.init();
    });

    this.discord.on('messageCreate', async (message) => {
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

    this.discord.on('interactionCreate', async (interaction) => {
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

      this.limiter.schedule(() => this.lolRanks.setRoleByRank(message, args)
        .then((reply) => {
          message.reply(reply);
        }));
      break;
    default:
      break;
    }
  }
}

module.exports = {
  Events,
};