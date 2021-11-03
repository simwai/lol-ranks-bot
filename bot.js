const Discord = require('discord.js');

const client = new Discord.Client();
const fetch = require('node-fetch');
const { URL } = require('url');
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const { CronJob } = require('cron');
const Bottleneck = require('bottleneck');
const config = require('./config.json');

const adapter = new FileSync('players.json');
const db = low(adapter);

const { prefix } = config;
const { ranks } = config;

const limiter = new Bottleneck({
  maxConcurrent: config.concurrentRequests,
  minTime: config.requestTime,
});

db.defaults({ players: [] })
  .write();

client.once('ready', () => {
  console.clear();
  console.log('Ready!');

  client.user.setActivity(prefix + 'rank ign', { type: 'PLAYING' });
});

client.login(config.discordToken);

client.on('message', async (message) => {
  if (!message.content.startsWith(prefix) || message.author.bot)	return;

  const args = message.content.slice(prefix.length).split(/ +/);
  const command = args.shift().toLowerCase();

  switch (command) {
  case 'rank':
    limiter.schedule(() => setRoleByRank(message, args)
      .then((reply) => {
        message.reply(reply);
      }));
    break;
  default:
    break;
  }
});

if (config.enableCronJob) {
  const job = new CronJob(config.cronTab, (async () => {
    const fetchedChannel = await client.channels.fetch(config.channels.debug);

    if (fetchedChannel) {
      const message = await fetchedChannel.send('Updating values for all users');

      await checkRanks(message);
      return;
    }

    await checkRanks();
  }), null, true, config.timeZone);
  job.start();
}

async function checkAuth(summonerID) {
  const authURL = `https://euw1.api.riotgames.com/lol/platform/v4/third-party-code/by-summoner/${summonerID}`;

  const authData = await getData(authURL);

  return authData;
}

async function getData(url) {
  try {
    const response = await fetch(new URL(url), {
      headers: {
        'X-Riot-Token': config.riotToken,
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

async function checkRanks(message) {
  const players = db.get('players').value();
  const fetchedMembers = await message.guild.members.fetch();

  for (const player of players) {
    const discordUser = fetchedMembers.find((m) => m.id === player.discordID);

    if (!discordUser) continue;

    const result = await limiter.schedule(() => setRoleByRank(message, null, player.summonerID, player.discordID, player));
    const logText = `${discordUser.user.tag}: ${result}`;

    if (message) {
      await message.reply(logText);
    }
  }
}

async function getSummonerData(args) {
  const summonerName = args.join('');

  console.log(`Getting data for ${summonerName}`);

  const summonerDataURL = `https://euw1.api.riotgames.com/lol/summoner/v4/summoners/by-name/${summonerName}`;

  const summonerData = await getData(summonerDataURL);

  return summonerData;
}

function getPlayer(id) {
  const player = db.get('players').filter({ discordID: id }).value();

  return player[0];
}

function updatePlayer(id, args) {
  db.get('players')
    .find({ discordID: id })
    .assign(args)
    .write();
}

async function setRoleByRank(message, args, summonerID = null, discordID = null, player = null) {
  if (message.channel.id === config.channels.role || message.channel.id === config.channels.debug) {
    if (!summonerID) {
      try {
        const summonerData = await getSummonerData(args);

        summonerID = summonerData.id;
      } catch (error) {
        console.error(`Error trying to get summoner data: ${error}`);
        return 'Ich konnte diesen Beschwörernamen nicht finden.';
      }
    }

    const role = message.guild.roles.cache.find((r) => r.name === 'Verifiziert');
    const member = message.guild.members.cache.find((m) => m.user.username === message.author.username);

    await member.roles.add(role);

    if (!discordID) {
      discordID = message.author.id;
    }

    if (!player) {
      player = getPlayer(discordID);
    }

    let reply = '';
    let authenticated = false;

    if (player) {
      authenticated = player.authenticated;
    } else {
      const authCode = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      db.get('players')
        .push({
          discordID, summonerID, authCode, authenticated: false, rank: null,
        })
        .write();
      player = getPlayer(discordID);
    }

    if (summonerID !== player.summonerID) {
      reply += 'Dein Beschwörername wurde geändert. Ich resette jetzt deine Authentifizierung.\n\n';

      authenticated = false;
      updatePlayer(discordID, { authenticated: false, summonerID });
      player = getPlayer(discordID);

      await removeAllEloRolesFromUser(discordID);
    }

    if (!authenticated) {
      try {
        const authData = await checkAuth(summonerID);

        if (authData === player.authCode) {
          reply += 'Ich habe deinen Account verifiziert und hole jetzt deine Daten. \n\n';
          authenticated = true;
          updatePlayer(discordID, { authenticated: true });
        } else {
          throw new Error('Invalid auth');
        }
      } catch (error) {
        reply += 'Bitte authentifiziere deinen Account:\n'
					+ '1. Klick auf Einstellungen im Leauge of Legends Client.\n'
					+ `2. Gehe zu Verifizierung und gib folgenden Code ein: \`\`${player.authCode}\`\`\n`
					+ '3. Drücke auf Speichern.\n'
					+ `4. Warte ein paar Minuten und führe dann den Befehl \`\`${prefix}rank\`\` erneut aus.\n\n`
					+ `Wenn es Probleme gibt, versuche es später nochmals oder melde dich beim ${message.guild.channels.cache.get(config.channels.help).toString()}!`;
      }
    }

    if (authenticated) {
      const rankDataURL = `https://euw1.api.riotgames.com/lol/league/v4/entries/by-summoner/${summonerID}`;

      let rankData;

      try {
        rankData = await getData(rankDataURL);

        let dataReply = '';
        let soloQueueRankData = null;

        for (const data of rankData) {
          if (data.queueType === 'RANKED_SOLO_5x5') {
            soloQueueRankData = data;
          }
        }

        if (soloQueueRankData) {
          const formattedTier = soloQueueRankData.tier.charAt(0) + soloQueueRankData.tier.slice(1).toLowerCase();

          const role = message.guild.roles.cache.find((r) => r.name === formattedTier);
          const member = message.guild.members.cache.find((m) => m.id === discordID);

          updatePlayer(discordID, { rank: formattedTier });
          player = getPlayer(discordID);

          if (member.roles.cache.find(r => r.id === role.id)) {
            dataReply += `Du bist momentan ${formattedTier} ${soloQueueRankData.rank} und hast die Rolle bereits erhalten.`;
          } else {
            for (const rank of ranks) {
              const currRank = message.guild.roles.cache.find((r) => r.name === rank);

              if (member.roles.cache.find(r => r.id === currRank.id)) {
                await member.roles.remove(currRank);
              }
            }

            await member.roles.add(role);
            dataReply += `Du bist momentan ${formattedTier} ${soloQueueRankData.rank} und ich weiße dir jetzt die Rolle zu.`;
          }
        } else {
          dataReply += `Ich kann keinen Solo Queue Rang für diesen Beschwörernamen finden. Bitte versuche es später nochmals oder kontaktiere den ${message.guild.channels.cache.get(config.channels.help).toString()}!`;

          updatePlayer(discordID, { rank: null });

          player = getPlayer(discordID);
        }

        return dataReply;
      } catch(error) {
        const dataReply = `Es gab einen Fehler beim Verarbeiten der Anfrage. Bitte versuche es später nochmals oder kontaktiere den ${message.guild.channels.cache.get(config.channels.help).toString()}!`;
        console.error('Error getting ranked data: \n');
        console.trace(error);

        return dataReply;
      }
    }

    return reply;
  }
}

async function removeAllEloRolesFromUser(discordID) {
  const elos = [
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
    const fetchUser = client.users.fetch(discordID);

    if (fetchUser.roles.cache.find(r => r.name === elo)) {
      await fetchUser.roles.remove(elo);
    }
  }
}