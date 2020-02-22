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

async function checkAuth(message, summonerID) {
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

async function getSummonerData(message, args) {
	const summonerName = args.join('');

	console.log('Getting data for ' + summonerName);

	const summonerDataURL = `https://euw1.api.riotgames.com/lol/summoner/v4/summoners/by-name/${summonerName}`;

	const summonerData = await getData(summonerDataURL);

	return summonerData;
}

async function setRoleByRank(message, args, summonerData = null) {
	if (message.channel.id === config.channels.role || message.channel.id === config.channels.debug) {
		if (!summonerData) {
			summonerData = await getSummonerData(message, args);
		}

		let reply = '';

		let discordID = message.author.id;
		let authenticated = false;
		let player = db.get('players').filter({ discordID: discordID }).value();

		if (player.length > 0) {
			let playerData = player[0];

			if(playerData.authenticated) {
				authenticated = true;
			}
		} else {
			let authCode = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
			db.get('players')
				.push({ discordID: discordID, summonerID: summonerData.id, authCode: authCode, authenticated: false, rank: null })
				.write();
			player = db.read().get('players').filter({ discordID: discordID }).value();
		}

		if (summonerData.id !== player[0].summonerID) {
			reply += 'Summoner name has been changed! Resetting account authentication... \n\n';

			authenticated = false;
			db.get('players')
				.find({ discordID: discordID })
				.assign({ authenticated: false, summonerID: summonerData.id })
				.write();
			player = db.read().get('players').filter({ discordID: discordID }).value();
		}

		if (!authenticated) {
			try {
				let playerData = player[0];
				let authData = await checkAuth(message, summonerData.id);

				if(authData === playerData.authCode) {
					reply += 'Onwership verified! Grabbing your rank now... \n\n';
					authenticated = true;
					db.get('players')
						.find({ discordID: discordID })
						.assign({ authenticated: true })
						.write();
				} else {
					throw new Error('Invalid auth');
				}
			} catch (error) {
				let playerData = player[0];
				reply += 'I was unable to authenticate ownership of this account! \n' +
					'Please authenticate your account: \n' +
					'1.  Click the Settings Icon from the League of Legends client. \n' +
					`2. Navigate to Verification, then enter the following code: \`${playerData.authCode}\` \n` +
					'3. Press save \n' +
					'4. Wait a few minutes, then try to get your role again! \n \n' +
					`if you've already done this, try again in a few minutes, or contact an admin via ${message.guild.channels.get(config.channels.help).toString()} if the issue persists!`;
			}
		}

		if (authenticated) {
			const rankDataURL = `https://euw1.api.riotgames.com/lol/league/v4/entries/by-summoner/${summonerData.id}`;

			getData(rankDataURL)
				.then(rankData => {
					let soloQueueRankData = null;

					for (let key in rankData) {
						let currData = rankData[key];
						if (currData.queueType === 'RANKED_SOLO_5x5') {
							soloQueueRankData = currData;
						}
					}

					if (soloQueueRankData) {
						const formattedTier = soloQueueRankData.tier.charAt(0) + soloQueueRankData.tier.slice(1).toLowerCase();

						const role = message.guild.roles.find(r => r.name === formattedTier);
						const member = message.member;

						db.get('players')
							.find({ discordID: discordID })
							.assign({ rank: formattedTier })
							.write();
						player = db.read().get('players').filter({ discordID: discordID }).value();

						if(message.member.roles.has(role.id)) {
							reply += 'You are currently ' + formattedTier + ' ' + soloQueueRankData.rank + '. You already have that role!';
						} else {
							for (let key in ranks) {
								let rank = ranks[key];
								let currRank = message.guild.roles.find(r => r.name === rank);
								if(message.member.roles.has(currRank.id)) {
									member.removeRole(currRank).catch(console.error);
								}
							}

							member.addRole(role).catch(console.error);
							reply += 'You are currently ' + formattedTier + ' ' + soloQueueRankData.rank + '. Assigning role!';
						}
					} else {
						reply += `Can't find a Solo Queue rank for that summoner name! Please try again in a few minutes, or contact an admin via ${message.guild.channels.get(config.channels.help).toString()} if the issue persists!`;
						db.get('players')
							.find({ discordID: discordID })
							.assign({ rank: null })
							.write();
						player = db.read().get('players').filter({ discordID: discordID }).value();
					}
					message.reply(reply);
				})
				.catch(error => {
					reply += `There was an error processing the request! Please try again in a few minutes, or contact an admin via ${message.guild.channels.get(config.channels.help).toString()} if the issue persists!`;
					console.error(error);
					message.reply(reply);
				});
		} else {
			message.reply(reply);
		}
	}
}