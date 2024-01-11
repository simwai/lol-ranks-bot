class DbHandler {
  constructor(db) {
    this.db = db
  }

  static getInstance(db = null) {
    if (!this.instance && db) {
      this.instance = new DbHandler(db)
    }

    return this.instance
  }

  getPlayerByDiscordId(id) {
    const player = this.db.get('players').filter({ discordID: id }).value()

    return player[0]
  }

  getPlayerBySummonerId(id) {
    const player = this.db.get('players').filter({ summonerID: id }).value()

    return player[0]
  }

  updatePlayer(id, args) {
    this.db.get('players').find({ discordID: id }).assign(args).write()
  }

  deletePlayer(id, isSummonerID = true) {
    this.db
      .get('players')
      .remove(isSummonerID ? { summonerID: id } : { discordID: id })
      .write()

    console.log('Deleted player with summoner ID ' + id)
  }

  initPlayer(discordID, summonerID) {
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

module.exports = {
  DbHandler
}
