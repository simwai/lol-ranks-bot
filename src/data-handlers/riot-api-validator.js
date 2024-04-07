const fetch = require('node-fetch');

class RiotApiValidator {
  constructor(config) {
    this.config = config;
    this.riotToken = this.config.riotToken;
  }

  async validateRiotToken() {   
    const response = await fetch(`https://${this.config.region}.api.riotgames.com/lol/status/v3/shard-data`, {
      headers: {
        "X-Riot-Token": this.riotToken,
      },
    });

    if (!response.ok && response.status === 401) {
      throw new Error('Invalid Riot token.');
    }

    console.log('Riot token is valid.');
  }
}

module.exports = RiotApiValidator;
