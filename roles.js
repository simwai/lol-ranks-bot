const i18n = require('i18n');

class Roles {
  constructor(client, config) {
    this.client = client;
    this.config = config;
  }

  async init() {
    const roles = this.config.ranks;
    roles.push(i18n.__('verified'));

    for (const role of this.config.ranks) {
      const guild = await this.client.guilds.fetch(this.config.guildId);
      const findRole = guild.roles.cache.find(r => r.name === role);

      if (!findRole) {
        await this.client.roles.add(role);
        console.log('Created role ' + role);
      }
    }
  }
}

module.exports = {
  Roles,
};