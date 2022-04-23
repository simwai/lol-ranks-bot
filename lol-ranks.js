const fetch = require('node-fetch');
const { URL } = require('url');
const { CronJob } = require('cron');
const i18n = require('i18n');

class LoLRanks {
  constructor(client, config, db, limiter) {
    this.client = client;
    this.discord = client;
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
    const authURL = `https://euw1.api.riotgames.com/lol/platform/v4/third-party-code/by-summoner/${summonerID}`;

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

      const result = await this.limiter.schedule(() => {
        console.log('Scheduler in lol-ranks.js triggered');
        return this.setRoleByRank(message, null, player.summonerID, player.discordID, player);
      });

      const logText = `${discordUser.user.tag}: ${result}`;

      if (message) {
        await message.reply(logText);
      }
    }
  }

  async getSummonerData(args) {
    const summonerName = Array.isArray(args) ? args.join('') : args;

    console.log(`Getting data for ${summonerName}`);

    const summonerDataURL = `https://euw1.api.riotgames.com/lol/summoner/v4/summoners/by-name/${summonerName}`;

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
      if (!summonerID) {
        try {
          const summonerData = await this.getSummonerData(args);

          summonerID = summonerData.id;
        } catch (error) {
          console.error(`Error trying to get summoner data: ${error}`);
          return 'Ich konnte diesen Beschwörernamen nicht finden.';
        }
      }

      const role = message.guild.roles.cache.find((r) => r.name === i18n.__('verified'));
      const member = message.guild.members.cache.find((m) => m.user.username === (message.author?.username ?? message.user.username));

      await member?.roles.add(role);

      if (!discordID) {
        discordID = message.author?.id ?? message.user.id;
      }

      if (!player) {
        player = this.getPlayer(discordID);
      }

      this.reply = '';
      let authenticated = false;

      if (player) {
        authenticated = player.authenticated;
      } else {
        const authCode = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        this.db.get('players')
          .push({
            discordID, summonerID, authCode, authenticated: false, rank: null,
          })
          .write();
        player = this.getPlayer(discordID);
      }

      if (summonerID !== player.summonerID) {
        this.reply += i18n.__('reply1') + '\n\n';

        authenticated = false;
        this.updatePlayer(discordID, { authenticated: false, summonerID });
        player = this.getPlayer(discordID);

        await this.removeAllEloRolesFromUser(discordID);
      }

      if (!authenticated) {
        try {
          const authData = await this.checkAuth(summonerID);

          if (authData === player.authCode) {
            this.reply += i18n.__('reply2') + '\n\n';
            authenticated = true;
            this.updatePlayer(discordID, { authenticated: true });
          } else {
            throw new Error('Invalid auth');
          }
        } catch (error) {
          this.reply += i18n.__('reply3_1') + '\n'
          + i18n.__('reply3_2') + '\n'
          + i18n.__('reply3_3') + ` \`\`${player.authCode}\`\`\n`
          + i18n.__('reply3_4') + '\n'
          + i18n.__('reply3_5') + `\`\`<@${this.config.clientId}> rank\`\`` + i18n.__('reply3_6') + '\n\n'
          + i18n.__('reply3_7') + `${message.guild.channels.cache.get(this.config.channels.help).toString()}!`;
        }
      }

      if (authenticated) {
        const rankDataURL = `https://euw1.api.riotgames.com/lol/league/v4/entries/by-summoner/${summonerID}`;

        let rankData;

        try {
          rankData = await this.getData(rankDataURL);

          let dataReply = '';
          let soloQueueRankData = null;
          let formattedTier = '';

          if (rankData.length == 0) {
            formattedTier = 'Unranked';
          } else {
            for (const data of rankData) {
              if (data.queueType === 'RANKED_SOLO_5x5') {
                soloQueueRankData = data;
                break;
              }
            }
          }

          if (soloQueueRankData) {
            formattedTier = soloQueueRankData.tier.charAt(0) + soloQueueRankData.tier.slice(1).toLowerCase();
          }

          if (formattedTier) {
            const role = message.guild.roles.cache.find((r) => r.name === formattedTier);
            const member = message.guild.members.cache.find((m) => m.id === discordID);

            this.updatePlayer(discordID, { rank: formattedTier });
            player = this.getPlayer(discordID);

            if (member.roles.cache.find(r => r.id === role.id)) {
              this.reply += i18n.__('reply4_1') + `${formattedTier} ${soloQueueRankData ? soloQueueRankData.rank : ''}` + i18n.__('reply4_2');
            } else {
              await this.removeAllRolesFromUser(discordID);
              await member.roles.add(role);

              this.reply += i18n.__('reply5_1') + `${formattedTier} ${soloQueueRankData ? soloQueueRankData.rank : ''}` + i18n.__('reply5_2');
            }
          } else {
            this.reply += i18n.__('reply6') + `${message.guild.channels.cache.get(this.config.channels.help).toString()}!`;

            this.updatePlayer(discordID, { rank: null });

            player = this.getPlayer(discordID);
          }

          return dataReply;
        } catch(error) {
          const dataReply = i18n.__('reply7') + `${message.guild.channels.cache.get(this.config.channels.help).toString()}!`;
          console.error('Error getting ranked data: \n');
          console.trace(error);

          return dataReply;
        }
      }

      return this.reply;
    }
  }

  async removeAllEloRolesFromUser(discordID) {
    for (const elo of this.config.ranks) {
      const fetchUser = await this.client.users.fetch(discordID);

      if (fetchUser?.roles.cache.find(r => r.name === elo)) {
        await fetchUser.roles.remove(elo);
      }
    }
  }
}

module.exports = {
  LoLRanks,
};