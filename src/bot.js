// Load dependencies
const Discord = require('discord.js')
const low = require('lowdb')
const Bottleneck = require('bottleneck')
const FileSync = require('lowdb/adapters/FileSync')
const i18n = require('i18n')
const path = require('path')
const config = require('../config.json')
const { Events } = require('./events')
const { DbUpgrader } = require('./db-upgrader')

// Init locales
i18n.configure({
  defaultLocale: config.language,
  locales: ['en', 'de', 'pt', 'es', 'ru'],
  directory: path.join(__dirname, '../locales'),
  register: global
})

// Init limiter
const limiter = new Bottleneck({
  maxConcurrent: config.concurrentRequests,
  minTime: config.requestTime
})

// Init discord.js client
const options = {
  intents: [
    Discord.Intents.FLAGS.GUILDS,
    Discord.Intents.FLAGS.GUILD_MESSAGES,
    Discord.Intents.FLAGS.GUILD_MESSAGE_REACTIONS,
    Discord.Intents.FLAGS.GUILD_MEMBERS
  ]
}

const client = new Discord.Client(options)
client.login(config.discordToken)

// Init database
const adapter = new FileSync('players.json')
const db = low(adapter)

db.defaults({ players: [] })
  .write();

(async () => {
  // Init config validator
  const dbUpgrader = new DbUpgrader()
  await dbUpgrader.upgrade()

  // Init events and additional modules
  new Events(client, db, limiter, config)
})()
