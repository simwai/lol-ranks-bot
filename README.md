# lol-ranks-bot

A Discord bot to assign roles based on League of Legends Rank!

Forked from [lol-ranks-bot](https://github.com/AlthalusAvan/lol-ranks-bot#readme)

## Installation

- Install [NPM](https://nodejs.org/en/download/);
- Clone the repo (in VS Code press CTRL + P and type `>git:clone` ([Tutorial](https://docs.microsoft.com/pt-br/azure/developer/javascript/how-to/with-visual-studio-code/clone-github-repository?tabs=create-repo-command-palette%2Cinitialize-repo-activity-bar%2Ccreate-branch-command-palette%2Ccommit-changes-command-palette%2Cpush-command-palette#clone-repository)));
- Open the terminal on project folder and type `npm install`;
- Rename the `config.json.example` file to `config.json`;
- Adjust your settings (tutorial below) and run `npm run-script debug`.

## Settings

- `channels` = Set the ID of the channels that will be used for the Bot to send the messages
- `guildID` = ID of your server ([Tutorial](https://support.discord.com/hc/en-us/articles/206346498-Where-can-I-find-my-User-Server-Message-ID-))
- `discordToken` = Tokens of your bot, used to authorize API requests and carry all of your bot user’s permissions ([Tutorial](https://discord.com/developers/docs/getting-started#configuring-a-bot))
- `riotToken` = Riot development API key ([Tutorial](https://developer.riotgames.com/docs/lol#:~:text=Before%20you%20start%20reading%20this%20documentation%20you%20need%20to%20first%20login%20with%20your%20Riot%20Games%20account.%20Once%20you%20do,%20a%20Developer%20Portal%20account%20is%20created%20for%20you!%20This%20action%20also%20generates%20a%20basic%20development%20API%20key%20that%20is%20associated%20with%20your%20account.))
- `timeZone` = Your timezone, you can find all timezones [here](https://en.wikipedia.org/wiki/List_of_tz_database_time_zones#List)
- `language` = Select your language according to the filename inside the `locales` folder (name only, no extension)
- `enableCronJob` = Enables automatic update of ranks every `X` time, defined in `cronTab`
- `cronTab` = Defines how often the ranks will be updated if `enableCronJob` is `true`
- `concurrentRequests` = Defines the number of concurrent requests to the API (See [Rate Limits](https://developer.riotgames.com/#:~:text=RATE%20LIMITS) after login)
- `requestTime` = Set the request time in milliseconds
- `setVerifiedRole` = Sets the verified role, when somebody has got an elo role
- `enableVerified` = Enables summoner name verification
- `enableMessages` = Enable bot to send messages on configured channel
- `enableRankIconsOnMessage` = Enable rank icons on messages (like this <img alt="Challenger Icon" style="width:18px" src="https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-static-assets/global/default/images/ranked-mini-crests/challenger.png"/> (You need to add custom emojis on your server ([Tutorial](https://support.discord.com/hc/en-us/articles/360036479811-Custom-Emojis)) and the name of each rank icon must be the same as the name of the rank in English, in this example the Emoji name is `Challenger`)). The icons are inside the `assets/img` folder

## LICENSE
This work is licensed under a <a rel="license" href="http://creativecommons.org/licenses/by-nc-sa/4.0/">Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International License</a>.<br/><br/><a rel="license" href="http://creativecommons.org/licenses/by-nc-sa/4.0/"><img alt="Creative Commons License" style="border-width:0" src="https://i.creativecommons.org/l/by-nc-sa/4.0/88x31.png" /></a>
