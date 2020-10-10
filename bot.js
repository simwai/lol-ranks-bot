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
  const job = new CronJob(config.cronTab, (() => {
    client.channels.get(config.channels.debug).send('Updating values for all users')
      .then((message) => {
        checkRanks(message);
      });
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

function checkRanks(message) {
  console.log('Checking ranks for all players: ');
  const players = db.get('players').value();

  for (const player of players) {
    const discordUser = message.guild.members.find((m) => m.id === player.discordID);
    const { displayName } = discordUser;

    limiter.schedule(() => setRoleByRank(message, null, player.summonerID, player.discordID, player)
      .then((result) => {
        message.reply(`${displayName}: ${result}`);
      }));
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
        return 'I couldn\'t find a summoner with that name!';
      }
    }

    const role = message.guild.roles.find((r) => r.name === 'Verifiziert');
    const member = message.guild.members.find((m) => m.user.username === message.author.username);

    await member.addRole(role);

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
      reply += 'your Summoner Name has been changed! Resetting account authentication... \n\n';

      authenticated = false;
      updatePlayer(discordID, { authenticated: false, summonerID });
      player = getPlayer(discordID);
    }

    if (!authenticated) {
      try {
        const authData = await checkAuth(summonerID);

        if (authData === player.authCode) {
          reply += 'I\'ve verified the ownership on that account! Grabbing your rank now... \n\n';
          authenticated = true;
          updatePlayer(discordID, { authenticated: true });
        } else {
          throw new Error('Invalid auth');
        }
      } catch (error) {
        reply += 'I was unable to authenticate ownership of this account! \n'
					+ 'Please authenticate your account: \n'
					+ '1.  Click the Settings Icon from the League of Legends client. \n'
					+ `2. Navigate to Verification, then enter the following code: \`${player.authCode}\`\n`
					+ '3. Press save \n'
					+ '4. Wait a few minutes, then try to get your role again! \n \n'
					+ 'if you\'ve already done this, try again in a few minutes, or contact an admin '
					+ `${message.guild.channels.get(config.channels.help).toString()} if the issue persists!`;
      }
    }

    if (authenticated) {
      const rankDataURL = `https://euw1.api.riotgames.com/lol/league/v4/entries/by-summoner/${summonerID}`;

      const addToReply = await getData(rankDataURL)
        .then((rankData) => {
          let dataReply = '';
          let soloQueueRankData = null;

          for (const data of rankData) {
            if (data.queueType === 'RANKED_SOLO_5x5') {
              soloQueueRankData = data;
            }
          }

          if (soloQueueRankData) {
            const formattedTier = soloQueueRankData.tier.charAt(0) + soloQueueRankData.tier.slice(1).toLowerCase();

            const role = message.guild.roles.find((r) => r.name === formattedTier);
            const member = message.guild.members.find((m) => m.id === discordID);
            console.log(role);
            console.log(member);

            updatePlayer(discordID, { rank: formattedTier });
            player = getPlayer(discordID);

            if (member.roles.has(role.id)) {
              dataReply += `You are currently ${formattedTier} ${soloQueueRankData.rank}. You already have that role!`;
            } else {
              for (const rank of ranks) {
                const currRank = message.guild.roles.find((r) => r.name === rank);

                if (message.member.roles.has(currRank.id)) {
                  member.removeRole(currRank).catch(console.error);
                }
              }

              member.addRole(role).catch(console.error);
              dataReply += `You are currently ${formattedTier} ${soloQueueRankData.rank}. Assigning role!`;
            }
          } else {
            dataReply += 'I can\'t find a Solo Queue rank for that summoner name! Please try again in a few minutes, '
							+ `or contact an admin via ${message.guild.channels.get(config.channels.help).toString()} if the issue persists!`;

            updatePlayer(discordID, { rank: null });

            player = getPlayer(discordID);
          }
          return dataReply;
        })
        .catch((error) => {
          const dataReply = 'There was an error processing the request! Please try again in a few minutes, '
						+ `or contact an admin via ${message.guild.channels.get(config.channels.help).toString()} if the issue persists!`;

          console.error('Error getting ranked data: \n');
          console.trace(error);

          return dataReply;
        });

      reply += addToReply;
      return reply;
    }
    return reply;
  }
}
