const db = require('../players.json');

/** Repairs old db files with deprecated db schema */
class DbUpgrader {
  constructor() {
    this.checkDb();
  }

  async checkDb() {
    const dbKeys = Object.keys(db.players);

    if (dbKeys.find(key => key === 'auth')) {
      dbKeys['auth'] = dbKeys['authenticated'];
      delete dbKeys['auth'];
    }
  }
}

module.exports = {
  DbUpgrader,
};