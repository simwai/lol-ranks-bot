const i18n = require('i18n');

class Roles {
  constructor(client, config) {
    this.client = client;
    this.config = config;
  }

  async init() {
    const roles = Object.values(i18n.__('ranks')).reverse();
    if (this.config.setVerifiedRole) {
    roles.push(i18n.__('verified'));
    }
    
    // WARNING: THIS COMMAND DELETE ALL RANK DISCORD ROLES
    // IT IS BEING USED FOR TESTING PURPOSES ONLY
    /*const guild = await this.client.guilds.fetch(this.config.guildId);
    const botRole = await guild.me.roles.botRole.name;
    guild.roles.cache.forEach(roles => {
      if (roles.name !== '@everyone' && roles.name !== botRole)
        roles.delete()
        .then(deleted => console.log(`Deleted role ${deleted.name}`))
        .catch(console.error);
    });*/

    for (const role of roles) {
      const guild = await this.client.guilds.fetch(this.config.guildId);
      const findRole = guild.roles.cache.find(r => r.name === role);
      if (!findRole) {
        await guild.roles.create({name: role, hoist: true});
        console.log('Created role ' + role);
      }
    }
  }
}

module.exports = {
  Roles,
};