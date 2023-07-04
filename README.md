# lol-ranks-bot
A Discord bot to assign roles based on League of Legends Rank!

[![CodeQL](https://github.com/simwai/lol-ranks-bot/actions/workflows/codeql.yml/badge.svg)](https://github.com/simwai/lol-ranks-bot/actions/workflows/codeql.yml)
[![Qodana](https://github.com/simwai/lol-ranks-bot/actions/workflows/qodana.yml/badge.svg)](https://github.com/simwai/lol-ranks-bot/actions/workflows/qodana.yml)
[![VS Code](https://img.shields.io/badge/IDE-VS%20Code-6A0DAD.svg)](https://code.visualstudio.com/)
[![ESLint](https://img.shields.io/badge/ESLint-%E2%9C%A8%20violet.svg?style=flat&logo=eslint&logoColor=white&color=8A2BE2&labelColor=454545)](https://eslint.org/)
[![Prettier](https://img.shields.io/badge/Prettier-%E2%9C%A8%20violet.svg?style=flat&logo=prettier&logoColor=white&color=8A2BE2&labelColor=454545)](https://prettier.io/)
[![License: CC BY-NC 4.0](https://img.shields.io/badge/License-CC%20BY--NC%204.0-9370DB.svg?style=flat&labelColor=454545&color=9370DB)](https://creativecommons.org/licenses/by-nc/4.0/)

## Requirements
- Node.js > v16.0
- VS Code

## Installation

- Install [NPM](https://nodejs.org/en/download/)
- Clone the repo (in VS Code press CTRL + P and type `>git:clone` ([Tutorial](https://code.visualstudio.com/docs/sourcecontrol/overview#_cloning-a-repository)))
- Open the terminal on project folder and type `npm install`
- Rename the `config.json.example` file to `config.json`
- Adjust the config
- Rename the `players.json.example` file to `players.json`
- Adjust your settings (tutorial below) and run `npm run-script debug`

## Settings

- `channels` = Set the ID of the channels that will be used for the Bot to send the messages
  - `role` - Default channel for bot messages (required)
  - `test` - Default channel for setting up/testing the bot (required)
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
- `verifiedLanguage` = Select your verified role language
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
