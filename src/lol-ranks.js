const fetch = require('node-fetch');
const { URL } = require('url');
const { CronJob } = require('cron');
const i18n = require('i18n');

class LoLRanks {
  constructor(client, config, db, limiter) {
    this.client = client;
    this.config = config;
    this.db = db;
    this.limiter = limiter;

    this.startCronJob();
  }

  startCronJob() {
    if (this.config.enableCronJob) {
      const job = new CronJob(this.config.cronTab, (async () => {
        const fetchedChannel = await this.client.channels.fetch(this.config.channels.debug);

        if (fetchedChannel) {

          const message = await fetchedChannel.send('Updating values for all users');
          await this.checkRanks(message);
          return;
        }

        await this.checkRanks();
      }), null, true, this.config.timeZone);
      job.start();
    }
  }

  // TODO change to rso or profile picture change method, this api endpoint is deprecateed
  async checkAuth(summonerID) {
    const authURL = `https://${this.config.region}.api.riotgames.com/lol/platform/v4/third-party-code/by-summoner/${summonerID}`;
    const authData = await this.getData(authURL);
    return authData;
  }

  async getData(url) {
    try {
      const response = await fetch(new URL(url), {
        headers: {
          'X-Riot-Token': this.config.riotToken,
        },
      });

      if (response.ok) {
        const json = await response.json();
        return json;
      }

      throw new Error(response.statusText);
    } catch (error) {
      throw new Error(error);
    }
  }

  async checkRanks(message) {
    const players = this.db.get('players').value();
    const fetchedMembers = await message?.guild.members.fetch();

    for (const player of players) {
      const discordUser = fetchedMembers?.find((m) => m.id === player.discordID);

      if (!discordUser) continue;

      let result = '';

      try {
        result = await this.limiter.schedule(() => {
          // console.log('Scheduler in lol-ranks.js triggered');
          return this.setRoleByRank(message, null, player.summonerID, player.discordID, player);
        });
      } catch (error) {
        console.error('Error checking ranks: \n');
        console.trace(error);
      }
      if (!player.tier) {
        const logText = `${discordUser}: ${result}`;

        if (message) {
          const roleChannel = await this.client.channels.fetch(this.config.channels.role);
          await roleChannel.send(logText);
        }
      }
    }
  }

  async getSummonerData(args) {
    const summonerName = Array.isArray(args) ? args.join('') : args;
    console.log(`Getting data for ${summonerName}`);

    const summonerDataURL = `https://${this.config.region}.api.riotgames.com/lol/summoner/v4/summoners/by-name/${summonerName}`;
    const summonerData = await this.getData(summonerDataURL);
    return summonerData;
  }

  getPlayer(id) {
    const player = this.db.get('players').filter({ discordID: id }).value();

    return player[0];
  }

  updatePlayer(id, args) {
    this.db.get('players')
      .find({ discordID: id })
      .assign(args)
      .write();
  }

  async setRoleByRank(message, args, summonerID = null, discordID = null, player = null) {
    if (message.channel.id === this.config.channels.role || message.channel.id === this.config.channels.debug) {
      if (!discordID) {
        discordID = message.author?.id ?? message.user.id;
      }

      if (!player) {
        player = this.getPlayer(discordID);
      }

      if (!summonerID) {
        try {
          const summonerData = await this.getSummonerData(args);
          summonerID = summonerData.id;
        } catch (error) {
          console.error('Error trying to get summoner data for ' + args);
          return i18n.__('reply8');
        }
      }

      const member = message.guild.members.cache.find((m) => m.user.id === discordID);
      const serverOwner = await message.guild.fetchOwner();
      const roleChannel = await this.client.channels.fetch(this.config.channels.role);

      // Set verified role
      if (this.config.setVerifiedRole) {
        const role = message.guild.roles.cache.find((r) => r.name === i18n.__('verified'));
        if (role) {
          await member?.roles.add(role);
        }
      }

      let reply = '';
      let auth = false;

      if (this.config.enableVerification) {
        auth = player?.auth;
      }

      if (!player) {
        const authCode = this.config.enableVerification ? Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15) : null;

        this.db.get('players')
          .push({
            discordID, summonerID, authCode, auth: false, tier: null, rank: null, totalValue: null,
          })
          .write();

        player = this.getPlayer(discordID);
      }

      if (summonerID !== null && summonerID !== player.summonerID) {
        await message.reply(i18n.__('reply1') + '\n\n');

        auth = false;
        this.updatePlayer(discordID, { auth: false, summonerID });
        player = this.getPlayer(discordID);

        await this.removeAllEloRolesFromUser(member);
      }

      if (player.tier !== null) {
        const elos = Object.values(i18n.__('ranks'));
        for (const elo of elos) {
          if (elo !== player.tier) {
            const role = member.roles.cache.find(r => r.name === elo);
            if (role) {
              await member.roles.remove(role.id);
            }
          }
        }
      }

      if (!auth && this.config.enableVerification) {
        try {
          const authData = await this.checkAuth(summonerID);

          if (authData === player.authCode) {
            reply += i18n.__('reply2') + '\n\n';
            auth = true;
            this.updatePlayer(discordID, { auth: true });
          } else {
            throw new Error('Invalid auth');
          }
        } catch (error) {
          reply += i18n.__('reply3_1') + '\n'
          + i18n.__('reply3_2') + '\n'
          + i18n.__('reply3_3') + ` \`\`${player.authCode}\`\`\n`
          + i18n.__('reply3_4') + '\n'
          + i18n.__('reply3_5') + `\`\`<@${this.client.application.id}> rank\`\` ` + i18n.__('reply3_6') + '\n\n';
          if (this.config.channels.help) {
            +i18n.__('reply3_7') + message.guild.channels.cache.get(this.config.channels.help).toString() + '!';
          } else {
            +i18n.__('reply3_7') + serverOwner + '!';
          }
        }
      }

      if ((auth && this.config.enableVerification) || !this.config.enableVerification) {
        const rankDataURL = `https://${this.config.region}.api.riotgames.com/lol/league/v4/entries/by-summoner/${summonerID}`;

        let rankData = '';

        try {
          rankData = await this.getData(rankDataURL);
        } catch(error) {
          console.error('Error getting ranked data: \n');
          console.trace(error);
          if (this.config.channels.help) {
            await roleChannel.send(i18n.__('reply7') + message.guild.channels.cache.get(this.config.channels.help).toString() + '!');
          } else {
            await roleChannel.send(i18n.__('reply7') + serverOwner + '!');
          }
          return reply;
        }

        let soloQueueRankData = null;
        let tier = '';

        if (rankData.length == 0) {
          tier = 'Unranked';
        } else {
          for (const data of rankData) {
            if (data.queueType === 'RANKED_SOLO_5x5') {
              soloQueueRankData = data;
              break;
            }
          }
        }

        if (soloQueueRankData) {
          tier = soloQueueRankData.tier.charAt(0) + soloQueueRankData.tier.slice(1).toLowerCase();
        }

        let checkValue = '';
        let tierValue = { 'Unranked':'0', 'Iron':'1', 'Bronze':'2', 'Silver':'3', 'Gold':'4', 'Platinum':'5', 'Diamond':'6', 'Master':'7', 'Grandmaster':'8', 'Challenger':'9' };
        let rankValue = { 'IV':'0', 'III':'1', 'II':'2', 'I':'4' };

        if (tier === 'Unranked') {
          checkValue = tierValue[tier];
        } else {
          tier = soloQueueRankData.tier.charAt(0) + soloQueueRankData.tier.slice(1).toLowerCase();
          checkValue = tierValue[tier] + rankValue[soloQueueRankData?.rank];
        }
        // Translate the tier value
        let tierLocale = i18n.__('ranks');
        let translatedTier = tierLocale[tier];

        if (translatedTier) {
          const role = message.guild.roles.cache.find((r) => r.name === translatedTier);
          const tierIcon = this.client.emojis.cache.find(emoji => emoji.name === tier);
          // Compare checkValue with player.totalValue

          if (player.totalValue !== null && player.totalValue > checkValue) {
            await roleChannel.send(member.user + i18n.__('levelDown') + tierIcon ?? '' + '**' + translatedTier + ' ' + soloQueueRankData?.rank ?? '' + '**!');

          }
          if (player.totalValue !== null && player.totalValue < checkValue) {
            await roleChannel.send(member.user + i18n.__('levelUp') + tierIcon ?? '' + '**' + translatedTier + ' ' + soloQueueRankData?.rank ?? '' + '**!');
          }


          // Updates player tier, rank and totalValue
          this.updatePlayer(discordID, { tier: translatedTier, rank: soloQueueRankData?.rank, totalValue: checkValue });
          player = this.getPlayer(discordID);

          if (member.roles.cache.find(r => r.id === role.id)) {
            reply += i18n.__('reply4_1') + tierIcon ?? '' + '**' + translatedTier + ' ' + soloQueueRankData?.rank ?? '' + ' ' + i18n.__('reply4_2');
          } else {
            await this.removeAllEloRolesFromUser(member);
            await member.roles.add(role);
            reply += i18n.__('reply5_1') + tierIcon ?? '' + '**' + translatedTier + ' ' + soloQueueRankData?.rank ?? '' + ' ' + i18n.__('reply5_2');
          }
        } else {
          if (this.config.channels.help) {
            reply += i18n.__('reply6') + message.guild.channels.cache.get(this.config.channels.help).toString() + '!';
          } else {
            reply += i18n.__('reply6') + serverOwner + '!';
          }

          this.updatePlayer(discordID, { tier: null, rank: null });
          player = this.getPlayer(discordID);
        }
      }

      return reply;
    }
  }

  async removeAllEloRolesFromUser(member) {
    const elos = Object.values(i18n.__('ranks'));
    for (const elo of elos) {
      const role = member.roles.cache.find(r => r.name === elo);
      if (role) {
        await member.roles.remove(role.id);
      }
    }
  }
}

module.exports = {
  LoLRanks,
};