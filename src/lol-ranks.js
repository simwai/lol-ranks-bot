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
        const fetchedChannel = await this.client.channels.fetch(this.config.channels.log);

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
          console.log('Scheduler in lol-ranks.js triggered');
          return this.setRoleByRank(message, null, player);
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

  async getSummonerDataByNameOrId(args, isID = false) {
    const summonerNameOrID = (Array.isArray(args) && !isID) ? args.join('') : args;
    console.log(`Getting data for ${summonerNameOrID}`);

    const summonerDataURL = `https://${this.config.region}.api.riotgames.com/lol/summoner/v4/summoners/${isID ? '' : 'by-name/'}${summonerNameOrID}`;
    const summonerData = await this.getData(summonerDataURL);
    return summonerData;
  }

  async getRankedDataById(message, summonerID) {
    const rankDataURL = `https://${this.config.region}.api.riotgames.com/lol/league/v4/entries/by-summoner/${summonerID}`;

    let rankData = '';

    try {
      rankData = await this.getData(rankDataURL);
    } catch(error) {
      console.error('Error getting ranked data: \n');
      console.trace(error);

      return i18n.__('reply7') + `${message.guild.channels.cache.get(this.config.channels.help).toString()}!`;
    }

    return rankData;
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

  async setRoleByRank(message, args, player = null) {
    const channels = Object.values(this.config.channels);

    if (!channels.some(channelID => message.channel.id === channelID)) {
      return;
    }

    let summonerData;

    try {
      summonerData = await this.getSummonerDataByNameOrId(args ?? player.summonerID, args ? false : true);
    } catch (error) {
      console.error('Error trying to get summoner data for ' + (args ?? player.summonerID));
      return i18n.__('reply8');
    }

    let summonerID = summonerData.id;
    let discordID = message.author?.id ?? message.user.id;

    // Init player in db
    if (!player && !this.getPlayer(discordID)) {
      this.db.get('players')
        .push({
          discordID, summonerID, authCode: null, auth: false, rank: null,
        })
        .write();

      player = this.getPlayer(discordID);
    } else if (!player) {
      player = this.getPlayer(discordID);
    }

    const member = message.guild.members.cache.find((m) => m.user.id === discordID);
    const serverOwner = await message.guild.fetchOwner();
    const roleChannel = await this.client.channels.fetch(this.config.channels.role);

    let reply = '';
    let auth = this.config.enableVerification ? player?.auth : false;

    await this.removeUnusedEloRolesFromUser(player, member);

    if (summonerID !== player.summonerID) {
      reply += i18n.__('reply1') + '\n\n';

      auth = false;
      this.updatePlayer(discordID, { auth: false, summonerID });
      player = this.getPlayer(discordID);

      await this.removeAllEloRolesFromUser(member);
    }

    if (!auth && this.config.enableVerification) {
      try {
        if (!player.authCode) {
          const authCode = summonerData.profileIconId;
          this.updatePlayer(discordID, { authCode: authCode });
          // TODO refactor this
          throw new Error('Set auth code');
        }

        if (summonerData.profileIconId !== player.authCode) {
          reply += i18n.__('reply2') + '\n\n';
          auth = true;
          this.updatePlayer(discordID, { authCode: null, auth: true });
        } else {
          throw new Error('Invalid auth');
        }
      } catch (error) {
        // TODO change translations to profile picture method
        // TODO add Done button
        // TODO check whitespaces of translations used in replies
        reply += i18n.__('reply3_1') + '\n'
          + i18n.__('reply3_2') + '\n'
          + i18n.__('reply3_3') + ` \`\`${player.authCode}\`\`\n`
          + i18n.__('reply3_4') + '\n'
          + i18n.__('reply3_5') + '``<@ + this.client.application.id + > rank``' + i18n.__('reply3_6') + '\n\n'
          + i18n.__('reply3_7') + (!this.config.channels.help ? message.guild.channels.cache.get(this.config.channels.help).toString() : serverOwner) + '!';
      }
    }

    if ((auth && this.config.enableVerification) || !this.config.enableVerification) {
      const rankData = await this.getRankedDataById(message, summonerID);

      let soloQueueRankData = null;
      let tier = '';

      if (rankData.length == 0) {
        tier = 'Unranked';
      } else {
        for (const data of rankData) {
          if (data.queueType === 'RANKED_SOLO_5x5') {
            soloQueueRankData = data;
            tier = soloQueueRankData.tier.charAt(0) + soloQueueRankData.tier.slice(1).toLowerCase();
            break;
          }
        }
      }

      let checkValue = '';
      let tierValue = {
        'Unranked': '0',
        'Iron': '1',
        'Bronze': '2',
        'Silver': '3',
        'Gold': '4',
        'Platinum': '5',
        'Diamond': '6',
        'Master': '7',
        'Grandmaster': '8',
        'Challenger': '9',
      };
      let rankValue = {
        'IV': '0',
        'III': '1',
        'II': '2',
        'I': '4',
      };

      if (tier) {
        if (tier === 'Unranked') {
          checkValue = tierValue[tier];
        } else if (tier) {
          checkValue = tierValue[tier] + rankValue[tier];
        }

        // Translate the tier value
        let tierLocale = i18n.__('ranks');
        let translatedTier = tierLocale[tier];

        const role = message.guild.roles.cache.find((r) => r.name === translatedTier);
        const tierIcon = this.client.emojis.cache.find(emoji => emoji.name === tier);

        // Compare checkValue with player.totalValue
        if (player.totalValue !== null) {
          if (player.totalValue > checkValue) {
            await roleChannel.send(member.user + i18n.__('levelDown') + tierIcon ?? '' + '**' + translatedTier + ' ' + soloQueueRankData?.rank ?? '' + '**!');
          } else if (player.totalValue !== null && player.totalValue < checkValue) {
            await roleChannel.send(member.user + i18n.__('levelUp') + tierIcon ?? '' + '**' + translatedTier + ' ' + soloQueueRankData?.rank ?? '' + '**!');
          }
        }

        // Updates player tier, rank and totalValue
        this.updatePlayer(discordID, {
          rank: tier,
          totalValue: checkValue,
        });
        player = this.getPlayer(discordID);

        if (member.roles.cache.find(r => r.id === role.id)) {
          reply += i18n.__('reply4_1') + (tierIcon ?? '') + '**' + translatedTier + ' ' + (soloQueueRankData?.rank ?? '') + ' ' + i18n.__('reply4_2');
        } else {
          await this.removeAllEloRolesFromUser(member);
          await member.roles.add(role);

          reply += i18n.__('reply5_1') + (tierIcon ?? '') + '**' + translatedTier + ' ' + (soloQueueRankData?.rank ?? '') + ' ' + i18n.__('reply5_2');
        }

        // Set verified role
        const verifiedRole = message.guild.roles.cache.find((r) => r.name === i18n.__('verified'));

        if (this.config.setVerifiedRole) {
          await member?.roles.add(verifiedRole);
        }
      } else {
        reply += i18n.__('reply6') + (this.config.channels.help ? message.guild.channels.cache.get(this.config.channels.help).toString() : serverOwner) + '!';

        this.updatePlayer(discordID, {
          tier: null,
          rank: null,
        });
        player = this.getPlayer(discordID);
      }
    }

    return reply;
  }

  async removeUnusedEloRolesFromUser(player, member) {
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