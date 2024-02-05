const Discord = require('discord.js')
const low = require('lowdb')
const Bottleneck = require('bottleneck')
const FileSync = require('lowdb/adapters/FileSync')
const i18n = require('i18n')
const path = require('path')
const fs = require('fs')
const config = require('../config.json')
const { Events } = require('./events')
const { DbUpgrader } = require('./db-upgrader')
const ConfigValidator = require('./config-validator')

// Configure internationalization
i18n.configure({
  defaultLocale: config.language,
  locales: ['en', 'de', 'pt', 'es', 'ru'],
  directory: path.join(__dirname, '../locales'),
  register: global
})

// Setup API rate limiter
const limiter = new Bottleneck({
  maxConcurrent: config.concurrentRequests,
  minTime: config.requestTime
})

// Setup Discord client with necessary intents
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

// Create empty players.json if it doesn't exist and write {}
if (!fs.existsSync('./players.json')) {
  fs.writeFileSync('./players.json', '{}')
}

// Initialize local JSON database
const adapter = new FileSync('players.json')
const db = low(adapter)
db.defaults({ players: [] }).write()

// Start main routine
;(async () => {
  // Upgrade database if necessary
  const dbUpgrader = new DbUpgrader()
  await dbUpgrader.upgrade()

  // Validate configuration
  try {
    const validator = new ConfigValidator(config)
    await validator.validateConfig()
    console.log('Configuration is valid!')
  } catch (error) {
    console.trace('Configuration is invalid!', error)
    return
  }

  // Initialize event handlers
  new Events(client, db, limiter, config)
})()
