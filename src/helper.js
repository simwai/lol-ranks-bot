class Helper {
  constructor(client, config) {
    this.client = client;
    this.config = config;
  }

  removeAllDiscordRoles() {
    // WARNING: THIS COMMAND DELETE ALL RANK DISCORD ROLES
    // IT IS BEING USED FOR TESTING PURPOSES ONLY
    const guild = this.client.guilds.fetch(this.config.guildId);
    const botRole = guild.me.roles.botRole.name;
    guild.roles.cache.forEach(roles => {
      if (roles.name !== '@everyone' && roles.name !== botRole)
        roles.delete().then(deleted => console.log(`Deleted role ${deleted.name}`)).catch(console.error);
    });
  }
}

module.exports = {
  Helper,
};