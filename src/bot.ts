import Discord, { Client } from 'discord.js'
import low from 'lowdb'
import Bottleneck from 'bottleneck'
import FileSync from 'lowdb/adapters/FileSync.js'
import i18n from 'i18n'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import config from '../config.json'
import { Events } from './events.js'
import { DbUpgrader } from './db-upgrader.js'
import ConfigValidator from './config-validator.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

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
const options: Discord.ClientOptions = {
  intents: [
    Discord.Intents.FLAGS.GUILDS,
    Discord.Intents.FLAGS.GUILD_MESSAGES,
    Discord.Intents.FLAGS.GUILD_MESSAGE_REACTIONS,
    Discord.Intents.FLAGS.GUILD_MEMBERS
  ]
}

const client: Client = new Discord.Client(options)
client.login(config.discordToken)

// Create empty players.json if it doesn't exist and write {}
if (!fs.existsSync('./players.json')) {
  fs.writeFileSync('./players.json', '{}')
}

// Initialize local JSON database
const adapter = new FileSync('players.json')
const db = low(adapter)
db.defaults({ players: [] }).write()

async function main() {
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
  new Events(client, db, limiter, i18n, config)
}

// Start main routine
await main()
