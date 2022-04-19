const fetch = require('node-fetch');
const { URL } = require('url');
const { CronJob } = require('cron');

class LoLRanks {
  constructor(discord, config, db, limiter) {
    this.client = discord;
    this.config = config;
    this.db = db;
    this.ranks = this.config.ranks;
    this.clientId = this.config.clientId;
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
    const fetchedMembers = await message.guild.members.fetch();

    for (const player of players) {
      const discordUser = fetchedMembers.find((m) => m.id === player.discordID);

      if (!discordUser) continue;

      const result = await this.limiter.schedule(() => this.setRoleByRank(message, null, player.summonerID, player.discordID, player));
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

      const role = message.guild.roles.cache.find((r) => r.name === 'Verifiziert');
      const member = message.guild.members.cache.find((m) => m.user.username === (message.author?.username ?? message.user.username));

      await member.roles.add(role);

      if (!discordID) {
        discordID = message.author?.id ?? message.user.id;
      }

      if (!player) {
        player = this.getPlayer(discordID);
      }

      let reply = '';
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
        reply += 'Dein Beschwörername wurde geändert. Ich resette jetzt deine Authentifizierung.\n\n';

        authenticated = false;
        this.updatePlayer(discordID, { authenticated: false, summonerID });
        player = this.getPlayer(discordID);

        await this.removeAllEloRolesFromUser(discordID);
      }

      if (!authenticated) {
        try {
          const authData = await this.checkAuth(summonerID);

          if (authData === player.authCode) {
            reply += 'Ich habe deinen Account verifiziert und hole jetzt deine Daten. \n\n';
            authenticated = true;
            this.updatePlayer(discordID, { authenticated: true });
          } else {
            throw new Error('Invalid auth');
          }
        } catch (error) {
          reply += 'Bitte authentifiziere deinen Account:\n'
            + '1. Klick auf Einstellungen im Leauge of Legends Client.\n'
            + `2. Gehe zu Verifizierung und gib folgenden Code ein: \`\`${player.authCode}\`\`\n`
            + '3. Drücke auf Speichern.\n'
            + `4. Warte ein paar Minuten und führe dann den Befehl \`\`<@${this.clientId}> rank\`\` oder den Slash-Befehl /rank erneut aus.\n\n`
            + `Wenn es Probleme gibt, versuche es später nochmals oder melde dich beim ${message.guild.channels.cache.get(this.config.channels.help).toString()}!`;
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
              dataReply += `Du bist momentan ${formattedTier} ${soloQueueRankData ? soloQueueRankData.rank : ''} und hast die Rolle bereits erhalten.`;
            } else {
              for (const rank of this.ranks) {
                const currRank = message.guild.roles.cache.find((r) => r.name === rank);

                if (member.roles.cache.find(r => r.id === currRank.id)) {
                  await member.roles.remove(currRank);
                }
              }

              await member.roles.add(role);
              dataReply += `Du bist momentan ${formattedTier} ${soloQueueRankData ? soloQueueRankData.rank : ''} und ich weiße dir jetzt die Rolle zu.`;
            }
          } else {
            dataReply += `Ich kann keinen Solo Queue Rang für diesen Beschwörernamen finden. Bitte versuche es später nochmals oder kontaktiere den ${message.guild.channels.cache.get(this.config.channels.help).toString()}!`;

            this.updatePlayer(discordID, { rank: null });

            player = this.getPlayer(discordID);
          }

          return dataReply;
        } catch(error) {
          const dataReply = `Es gab einen Fehler beim Verarbeiten der Anfrage. Bitte versuche es später nochmals oder kontaktiere den ${message.guild.channels.cache.get(this.config.channels.help).toString()}!`;
          console.error('Error getting ranked data: \n');
          console.trace(error);

          return dataReply;
        }
      }

      return reply;
    }
  }

  async removeAllEloRolesFromUser(discordID) {
    const elos = [
      'Unranked',
      'Iron',
      'Bronze',
      'Silver',
      'Gold',
      'Platinum',
      'Diamond',
      'Master',
      'Grandmaster',
      'Challenger',
    ];

    for (const elo of elos) {
      const fetchUser = this.client.users.fetch(discordID);

      if (fetchUser.roles.cache.find(r => r.name === elo)) {
        await fetchUser.roles.remove(elo);
      }
    }
  }
}

module.exports = {
  LoLRanks,
};