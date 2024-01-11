const fs = require('node:fs/promises')
const path = require('node:path')
const db = require('../players.json')

// Repairs old db files with deprecated db schema
class DbUpgrader {
  constructor() {
    this.dbPath = path.join(__dirname, '../players.json')
  }

  async upgrade() {
    const dbRaw = await fs.readFile(this.dbPath)
    const dbJson = JSON.parse(dbRaw)
    let didSomething = false

    for (const player of dbJson.players) {
      if (db.players.find((player) => player.authenticated)) {
        player.auth = player.authenticated
        delete player.authenticated
        didSomething = true
      }

      if (
        !db.players.find((player) =>
          player.authCode?.toString().match(/^\d{1,5}$/g)
        )
      ) {
        player.authCode = null
        didSomething = true
      }

      if (!db.players.find((player) => player.tier)) {
        player.tier = null
        didSomething = true
      }

      if (!db.players.find((player) => player.totalValue)) {
        player.totalValue = null
        didSomething = true
      }
    }

    const dbString = JSON.stringify(dbJson)
    await fs.writeFile(this.dbPath, dbString)

    if (didSomething) console.log('Upgraded config')
  }
}

module.exports = {
  DbUpgrader
}
