# lol-ranks-bot
A Discord bot that allows users to verify their League of Legends summoner name and assigns roles based on their rank/elo in the game. Users must initiate the verification process themselves, and upon successful verification, the bot will grant them the appropriate rank role within the Discord server.

[![VS Code](https://img.shields.io/badge/IDE-VS%20Code-6A0DAD.svg)](https://code.visualstudio.com/)
[![ESLint](https://img.shields.io/badge/ESLint-%E2%9C%A8%20violet.svg?style=flat&logo=eslint&logoColor=white&color=8A2BE2&labelColor=454545)](https://eslint.org/)
[![Prettier](https://img.shields.io/badge/Prettier-%E2%9C%A8%20violet.svg?style=flat&logo=prettier&logoColor=white&color=8A2BE2&labelColor=454545)](https://prettier.io/)
[![License: CC BY-NC 4.0](https://img.shields.io/badge/License-CC%20BY--NC%204.0-9370DB.svg?style=flat&labelColor=454545&color=9370DB)](https://creativecommons.org/licenses/by-nc/4.0/)

## Prerequisites
Before you begin, ensure you have met the following requirements:
- For local development:
  - Node.js (v16.0 or higher)
  - NPM (usually comes with Node.js)
- For server deployment:
  - Node.js (v16.0 or higher)
  - Docker and Docker Compose (for Docker deployment)
  - PM2 (for PM2 deployment)

## Local Development Setup
Follow these steps to set up the bot for development purposes on your local machine:

1. Install Node.js (v16.0 or higher) and NPM from [Node.js official website](https://nodejs.org/en/download/).
2. Clone the repository:
   - Open your terminal.
   - Navigate to the directory where you want to clone the repository.
   - Run `git clone https://github.com/simwai/lol-ranks-bot.git`.
   - Navigate to the cloned directory by running `cd lol-ranks-bot`.
3. Install dependencies by running `npm install`.
4. Adjust the config values by editing `config.json`.
5. Start the bot by running `npm run-script start`.

## Server Deployment

### Docker Deployment
To deploy the bot on a server using Docker, follow these steps:

1. Install Docker and Docker Compose on your server. Follow the [official Docker guide](https://docs.docker.com/get-docker/) for installation instructions.
2. Clone the repository (see Local Development Setup step 2).
3. Adjust the config values by editing `config.json`.
4. Run `docker compose up -d` to build the Docker image and start the bot in detached mode.
5. To stop the bot, run `docker compose down`.

### PM2 Deployment
To deploy the bot on a server using PM2, follow these steps:

1. Install Node.js (v16.0 or higher) and NPM on your server.
2. Install PM2 globally by running `npm install pm2 -g`.
3. Clone the repository (see Local Development Setup step 2).
4. Install dependencies by running `npm install`.
5. Adjust the config values by editing `config.json`.
6. Start the bot using PM2 by running `pm2 start index.js --name lol-ranks-bot`.
7. To ensure PM2 restarts the bot after reboots, run `pm2 save`

## How the Bot Works
- Users trigger the verification process by a command in Discord.
- The bot verifies the user's League of Legends summoner name.
- Once verified, the bot checks the user's rank/elo in League of Legends.
- The bot assigns a corresponding rank role and verified role to the user in the Discord server based on their League of Legends rank/elo.
- The bot keeps the lol ranks of the verified users up-to-date by running periodically.
- The bot does not automatically assign roles to all users; each user must initiate the verification process.

## Settings
- `channels` = Set the ID of the channels that will be used for the Bot to send the messages
  - `help` - Default channel to help members with bot-related issues (optional)
- `guildID` = ID of your server ([Tutorial](https://support.discord.com/hc/en-us/articles/206346498-Where-can-I-find-my-User-Server-Message-ID-))
- `discordToken` = Tokens of your bot, used to authorize API requests and carry all of your bot user’s permissions ([Tutorial](https://discord.com/developers/docs/getting-started#configuring-a-bot))
- `riotToken` = Riot development API key ([Tutorial](https://developer.riotgames.com/docs/lol#:~:text=Before%20you%20start%20reading%20this%20documentation%20you%20need%20to%20first%20login%20with%20your%20Riot%20Games%20account.%20Once%20you%20do,%20a%20Developer%20Portal%20account%20is%20created%20for%20you!%20This%20action%20also%20generates%20a%20basic%20development%20API%20key%20that%20is%20associated%20with%20your%20account.))
- `status` = The Discord bot status
- `ranks` = The names of your rank roles on your Discord server
- `rankIconNames` = The names of you rank icons on your Discord server
- `region` = The LoL API endpoint region
- `timeZone` = Your timezone, you can find all timezones [here](https://en.wikipedia.org/wiki/List_of_tz_database_time_zones#List)
- `language` = Select your general language according to the filename inside the `locales` folder (name only, no extension)
- `eloRoleLanguage` = Select your rank role language
- `verifiedRoleLanguage` = Select your verified role language
- `enableCronJob` = Enables automatic update of ranks every `X` time, defined in `cronTab`
- `cronTab` = Defines how often the ranks will be updated if `enableCronJob` is `true`
- `concurrentRequests` = Defines the number of concurrent requests to the API (See [Rate Limits](https://developer.riotgames.com/#:~:text=RATE%20LIMITS) after login)
- `requestTime` = Set the request time in milliseconds
- `setVerifiedRole` = Sets the verified role, when somebody has got an elo role
- `enableVerification` = Enables summoner name verification
- `enableTierUpdateMessages` = Enable bot to send messages on configured channel for rank up/down

- To enable rank icons on messages (like this <img alt="Challenger Icon" style="width:18px" src="https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-static-assets/global/default/images/ranked-mini-crests/challenger.png"/>) you need to add custom emojis on your server ([Tutorial](https://support.discord.com/hc/en-us/articles/360036479811-Custom-Emojis))). The icons are inside the `assets/img` folder (Please do not change the name of the icons or the bot will not be able to identify them)

## LICENSE
This work is licensed under a <a rel="license" href="http://creativecommons.org/licenses/by-nc-sa/4.0/">Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International License</a>.<br/><br/><a rel="license" href="http://creativecommons.org/licenses/by-nc-sa/4.0/"><img alt="Creative Commons License" style="border-width:0" src="https://i.creativecommons.org/l/by-nc-sa/4.0/88x31.png" /></a>
