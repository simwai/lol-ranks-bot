// Load dependencies
const Discord = require('discord.js');
const low = require('lowdb');
const Bottleneck = require('bottleneck');
const FileSync = require('lowdb/adapters/FileSync');
const config = require('./config.json');
const { LoLRanks } = require('./lol-ranks');
const { SlashCommands } = require('./slash-commands');
const { Events } = require('./events');

// Init limiter
const limiter = new Bottleneck({
  maxConcurrent: config.concurrentRequests,
  minTime: config.requestTime,
});

// Init discord.js client
const options = { intents: [
  Discord.Intents.FLAGS.GUILDS,
  Discord.Intents.FLAGS.GUILD_MESSAGES,
  Discord.Intents.FLAGS.GUILD_MESSAGE_REACTIONS,
  Discord.Intents.FLAGS.GUILD_MEMBERS,
],
};

const client = new Discord.Client(options);
client.login(config.discordToken);

// Init database
const adapter = new FileSync('players.json');
const db = low(adapter);

db.defaults({ players: [] })
  .write();

// Init modules
const lolRanks = new LoLRanks(client, config, db, limiter);
const slashCommands = new SlashCommands(client, config);
new Events(client, lolRanks, slashCommands, db, limiter, config);