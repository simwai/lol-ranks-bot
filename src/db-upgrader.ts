import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Repairs old db files with deprecated db schema
class DbUpgrader {
  private dbPath: string

  constructor() {
    this.dbPath = path.join(__dirname, '../players.json')
  }

  async upgrade(): Promise<void> {
    const dbRaw = await fs.readFile(this.dbPath)
    const dbJson = JSON.parse(dbRaw.toString())
    let didSomething = false

    for (const player of dbJson.players) {
      if ('authenticated' in player) {
        player.auth = player.authenticated
        delete player.authenticated
        didSomething = true
      }

      if (!player.authCode?.toString().match(/^\d{1,5}$/g)) {
        player.authCode = null
        didSomething = true
      }

      if (!('tier' in player)) {
        player.tier = null
        didSomething = true
      }

      if (!('totalValue' in player)) {
        player.totalValue = null
        didSomething = true
      }
    }

    const dbString = JSON.stringify(dbJson)
    await fs.writeFile(this.dbPath, dbString)

    if (didSomething) console.log('Upgraded config')
  }
}

export { DbUpgrader }
