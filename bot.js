const Discord = require('discord.js');
const client = new Discord.Client();
const { prefix, token, riotToken } = require('./config.json');
const fetch = require('node-fetch');


client.once('ready', () => {
	console.log('Ready!');
});

client.login(token);

client.on('message', async message => {
	if (!message.content.startsWith(prefix) || message.author.bot)	return;

	const ranks = ['Iron', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Master', 'Grand Master', 'Challenger'];

	const args = message.content.slice(prefix.length).split(/ +/);
	const command = args.shift().toLowerCase();

	if (command === 'rank') {
		const summonerName = args.join('');
		const summonerDataURL = 'https://euw1.api.riotgames.com/lol/summoner/v4/summoners/by-name/' + summonerName;


		const getData = async url => {
			try {
				const response = await fetch(url, {
					headers: {
						'X-Riot-Token': riotToken,
					},
				});
				const json = await response.json();
				return json;
			} catch (error) {
				console.log(error);
				message.channel.send('There was an error processing the request! Please try again in a few minutes, or contact an admin via #ask-admins if the issue persists!');
			}
		};

		const summonerData = await getData(summonerDataURL);

		const rankDataURL = 'https://euw1.api.riotgames.com/lol/league/v4/entries/by-summoner/' + summonerData.id;

		getData(rankDataURL).then(rankData => {
			let soloQueueRankData = null;

			// eslint-disable-next-line prefer-const
			for (let key in rankData) {
				// eslint-disable-next-line prefer-const
				let currData = rankData[key];
				if (currData.queueType === 'RANKED_SOLO_5x5') {
					soloQueueRankData = currData;
				}
			}

			if (soloQueueRankData) {
				const formattedTier = soloQueueRankData.tier.charAt(0) + soloQueueRankData.tier.slice(1).toLowerCase();

				const role = message.guild.roles.find(r => r.name === formattedTier);
				const member = message.member;

				if(message.member.roles.has(role.id)) {
					message.channel.send(message.member.toString() + ' - You are currently ' + formattedTier + ' ' + rankData[0].rank + '. You already have that role!');
				} else {
					for (let key in ranks) {
						let rank = ranks[key];
						let currRank = message.guild.roles.find(r => r.name === rank);
						console.log(rank, currRank);
						if(message.member.roles.has(currRank.id)) {
							member.removeRole(currRank).catch(console.error);
						}
					}

					member.addRole(role).catch(console.error);
					message.channel.send(message.member.toString() + ' - you are currently ' + formattedTier + ' ' + rankData[0].rank + '. Assigning role!');
				}
			} else {
				message.channel.send(message.member.toString() + ' - can\'t find a Solo Queue rank for that summoner name! Please check your summoner name, or try again later');
			}
		});
	}
});
