const Discord = require('discord.js');
const client = new Discord.Client();
const config = require('./config.json');
const fetch = require('node-fetch');
const { URL } = require('url');
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');

const adapter = new FileSync('players.json');
const db = low(adapter);

const prefix = config.prefix;
const ranks = config.ranks;

db.defaults({ players: [] })
	.write();

client.once('ready', () => {
	console.log('Ready!');
});

client.login(config.discordToken);

client.on('message', async message => {
	if (!message.content.startsWith(prefix) || message.author.bot)	return;

	const args = message.content.slice(prefix.length).split(/ +/);
	const command = args.shift().toLowerCase();

	switch (command) {
	case 'rank':
		setRoleByRank(message, args);
		break;
	default:
		break;
	}
});

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
		} else {
			throw new Error(response.statusText);
		}
	} catch (error) {
		throw new Error(error);
	}
}

async function getSummonerData(args) {
	const summonerName = args.join('');

	console.log('Getting data for ' + summonerName);

	const summonerDataURL = `https://euw1.api.riotgames.com/lol/summoner/v4/summoners/by-name/${summonerName}`;

	const summonerData = await getData(summonerDataURL);

	return summonerData;
}

function getPlayer(id) {
	let player = db.get('players').filter({ discordID: id }).value();

	return player[0];
}

function updatePlayer(id, args) {
	db.get('players')
		.find({ discordID: id })
		.assign(args)
		.write();
}

async function setRoleByRank(message, args) {
	if (message.channel.id === config.channels.role || message.channel.id === config.channels.debug) {
		let summonerData = await getSummonerData(args);

		let reply = '';

		let authenticated = false;
		let player = getPlayer(message.author.id);

		if (player) {
			authenticated = player.authenticated;
		} else {
			let authCode = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
			db.get('players')
				.push({ discordID: message.author.id, summonerID: summonerData.id, authCode: authCode, authenticated: false, rank: null })
				.write();
		}

		if (summonerData.id !== player.summonerID) {
			reply += 'your Summoner Name has been changed! Resetting account authentication... \n\n';

			authenticated = false;
			updatePlayer(message.author.id, { authenticated: false, summonerID: summonerData.id });
			player = getPlayer(message.author.id);
		}

		if (!authenticated) {
			try {
				let authData = await checkAuth(summonerData.id);

				if(authData === player.authCode) {
					reply += 'I\'ve verified the ownership on that account! Grabbing your rank now... \n\n';
					authenticated = true;
					updatePlayer(message.author.id, { authenticated: true });
				} else {
					throw new Error('Invalid auth');
				}
			} catch (error) {
				reply += 'I was unable to authenticate ownership of this account! \n' +
					'Please authenticate your account: \n' +
					'1.  Click the Settings Icon from the League of Legends client. \n' +
					`2. Navigate to Verification, then enter the following code: \`${player.authCode}\` \n` +
					'3. Press save \n' +
					'4. Wait a few minutes, then try to get your role again! \n \n' +
					'if you\'ve already done this, try again in a few minutes, or contact an admin via' +
					`${message.guild.channels.get(config.channels.help).toString()} if the issue persists!`;

			}
		}

		if (authenticated) {
			const rankDataURL = `https://euw1.api.riotgames.com/lol/league/v4/entries/by-summoner/${summonerData.id}`;

			getData(rankDataURL)
				.then(rankData => {
					let soloQueueRankData = null;

					for (let data of rankData) {
						if (data.queueType === 'RANKED_SOLO_5x5') {
							soloQueueRankData = data;
						}
					}

					if (soloQueueRankData) {
						const formattedTier = soloQueueRankData.tier.charAt(0) + soloQueueRankData.tier.slice(1).toLowerCase();

						const role = message.guild.roles.find(r => r.name === formattedTier);
						const member = message.member;

						updatePlayer(message.author.id, { rank: formattedTier });
						player = getPlayer(message.author.id);

						if(message.member.roles.has(role.id)) {
							reply += 'You are currently ' + formattedTier + ' ' + soloQueueRankData.rank + '. You already have that role!';
						} else {
							for (let rank of ranks) {
								let currRank = message.guild.roles.find(r => r.name === rank);

								if(message.member.roles.has(currRank.id)) {
									member.removeRole(currRank).catch(console.error);
								}
							}

							member.addRole(role).catch(console.error);
							reply += 'You are currently ' + formattedTier + ' ' + soloQueueRankData.rank + '. Assigning role!';
						}
					} else {
						reply += 'I can\'t find a Solo Queue rank for that summoner name! Please try again in a few minutes, ' +
							`or contact an admin via ${message.guild.channels.get(config.channels.help).toString()} if the issue persists!`;

						updatePlayer(message.author.id, { rank: null });

						player = getPlayer(message.author.id);
					}
					message.reply(reply);
				})
				.catch(error => {
					reply += 'There was an error processing the request! Please try again in a few minutes, ' +
						`or contact an admin via ${message.guild.channels.get(config.channels.help).toString()} if the issue persists!`;

					console.error(error);

					message.reply(reply);
				});
		} else {
			message.reply(reply);
		}
	}
}