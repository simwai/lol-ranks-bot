const i18n = require('i18n')

class Roles {
  constructor(client, config) {
    this.client = client
    this.config = config
  }

  async init() {
    const roles = Object.values(
      i18n.__({ phrase: 'ranks', locale: this.config.eloRoleLanguage })
    ).reverse()
    if (this.config.setVerifiedRole) {
      roles.push(
        i18n.__('verified', { locale: this.config.verifiedRoleLanguage })
      )
    }

    for (const role of roles) {
      const guild = await this.client.guilds.fetch(this.config.guildId)
      const findRole = guild.roles.cache.find((r) => r.name === role)
      if (!findRole) {
        await guild.roles.create({ name: role, hoist: true })
        console.log('Created role ' + role)
      }
    }
  }

  async removeAllEloRolesFromUser(member) {
    const elos = Object.values(
      i18n.__({ phrase: 'ranks', locale: this.config.eloRoleLanguage })
    )
    for (const elo of elos) {
      const role = member.roles.cache.find((r) => r.name === elo)
      if (role) {
        await member.roles.remove(role.id)
      }
    }
  }

  async removeUnusedEloRolesFromUser(player, member) {
    if (player.tier !== null) {
      const elos = Object.values(
        i18n.__({ phrase: 'ranks', locale: this.config.eloRoleLanguage })
      )
      for (const elo of elos) {
        if (elo !== player.tier) {
          const role = member.roles.cache.find((r) => r.name === elo)
          if (role) {
            await member.roles.remove(role.id)
          }
        }
      }
    }
  }

  async removeAllDiscordRoles() {
    // WARNING: THIS COMMAND DELETE ALL RANK DISCORD ROLES
    // IT IS BEING USED FOR TESTING PURPOSES ONLY
    const guild = this.client.guilds.fetch(this.config.guildId)
    const botRole = guild.me.roles.botRole.name

    for (const roles of guild.roles.cache) {
      if (roles.name !== '@everyone' && roles.name !== botRole) {
        try {
          const deleted = await roles.delete()
          console.log(`Deleted role ${deleted.name}`)
        } catch (error) {
          console.trace(error)
        }
      }
    }
  }
}

module.exports = {
  Roles
}
