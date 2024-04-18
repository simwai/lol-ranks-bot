class DbHandler {
  private db: any
  static instance: any

  constructor(db: any) {
    this.db = db
  }

  static getInstance(db: any = null): DbHandler {
    if (!this.instance && db) {
      this.instance = new DbHandler(db)
    }

    return this.instance
  }

  getPlayerByDiscordId(id: string): any {
    const player = this.db.get('players').filter({ discordID: id }).value()

    return player[0]
  }

  getPlayerBySummonerId(id: string): any {
    const player = this.db.get('players').filter({ summonerID: id }).value()

    return player[0]
  }

  updatePlayer(id: string, args: any): void {
    this.db.get('players').find({ discordID: id }).assign(args).write()
  }

  deletePlayer(id: string, isSummonerID: boolean = true): void {
    this.db
      .get('players')
      .remove(isSummonerID ? { summonerID: id } : { discordID: id })
      .write()

    console.log('Deleted player with summoner ID ' + id)
  }

  initPlayer(discordID: string, summonerID: string): any {
    if (!this.getPlayerByDiscordId(discordID)) {
      this.db
        .get('players')
        .push({
          discordID,
          summonerID,
          authCode: null,
          auth: false,
          rank: null
        })
        .write()
    }

    return this.getPlayerByDiscordId(discordID)
  }
}

export { DbHandler }
