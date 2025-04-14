import test from 'ava'
import nock from 'nock'
import { ApiHandler } from '../../data-handlers/api-handler.js'
import { Config } from '../../interfaces/config.interface.js'
import { SummonerDataArgs } from '../../types/summoner-data.type.js'

const config: Config = {
  riotToken: 'dummyRiotToken',
  region: 'dummyRegion',
  discordToken: 'dummyDiscordToken',
  guildId: '',
  setVerifiedRole: false,
  enableVerification: false,
  enableTierUpdateMessages: false,
  status: '',
  embedColor: '',
  ranks: [],
  rankIconNames: {},
  timeZone: '',
  language: '',
  eloRoleLanguage: '',
  verifiedRoleLanguage: '',
  enableCronJob: false,
  cronTab: '',
  concurrentRequests: 0,
  requestTime: 0
}

const apiHandler = ApiHandler.getInstance(config)

test('getData - success', async (t) => {
  const testUrl = 'https://example.com/data'
  const mockResponse = { success: true }

  nock('https://example.com').get('/data').reply(200, mockResponse)

  const result = await apiHandler.getData(testUrl)
  t.deepEqual(result, mockResponse)
})

test('getData - network error', async (t) => {
  const testUrl = 'https://example.com/fail'

  nock('https://example.com').get('/fail').replyWithError('Network error')

  const error = await t.throwsAsync(apiHandler.getData(testUrl))
  t.is(error.message, 'Network error')
})

test('getSummonerDataByNameOrId - summonerName', async (t) => {
  const summonerName = 'testSummoner'
  const mockResponse = { id: '123', name: summonerName }
  const args: SummonerDataArgs = {
    type: 'summonerName',
    value: summonerName
  }

  nock(`https://${config.region}.api.riotgames.com`)
    .get(`/lol/summoner/v4/summoners/by-name/${summonerName}`)
    .reply(200, mockResponse)

  const result = await apiHandler.getSummonerDataByNameOrId(args)
  t.deepEqual(result, mockResponse)
})

test('getSummonerDataByNameOrId - summonerID', async (t) => {
  const summonerId = 'test123id'
  const mockResponse = { id: summonerId, name: 'SummonerWithID' }
  const args: SummonerDataArgs = {
    type: 'summonerID',
    value: summonerId
  }

  nock(`https://${config.region}.api.riotgames.com`)
    .get(`/lol/summoner/v4/summoners/${summonerId}`)
    .reply(200, mockResponse)

  const result = await apiHandler.getSummonerDataByNameOrId(args)
  t.deepEqual(result, mockResponse)
})

test('getRankedDataById - success', async (t) => {
  const summonerID = 'validSummonerId'
  const mockRankedData = [{ tier: 'Gold', rank: 'I' }]

  nock(`https://${config.region}.api.riotgames.com`)
    .get(`/lol/league/v4/entries/by-summoner/${summonerID}`)
    .reply(200, mockRankedData)

  const result = await apiHandler.getRankedDataById('helpChannel', summonerID)
  t.deepEqual(result, mockRankedData)
})

test('validateGuildId - success', async (t) => {
  const guildId = 'validGuildId'

  nock('https://discord.com/api/v9')
    .get(`/guilds/${guildId}`)
    .matchHeader('Authorization', `Bot ${config.discordToken}`)
    .reply(200, { id: guildId })

  const result = await apiHandler.validateGuildId(guildId)
  t.true(result)
})

test('validateChannelId - success', async (t) => {
  const channelId = 'validChannelId'
  const guildId = 'guildIdForChannel'
  const mockChannels = [{ id: channelId }]

  nock('https://discord.com/api/v9')
    .get(`/guilds/${guildId}/channels`)
    .matchHeader('Authorization', `Bot ${config.discordToken}`)
    .reply(200, mockChannels)

  const result = await apiHandler.validateChannelId(channelId, guildId)
  t.true(result)
})

test('validateChannelId - channel does not exist', async (t) => {
  const channelId = 'nonExistentChannelId'
  const guildId = 'guildIdWithNoSuchChannel'
  const mockChannels = [{ id: 'someOtherChannelId' }]

  nock('https://discord.com/api/v9')
    .get(`/guilds/${guildId}/channels`)
    .matchHeader('Authorization', `Bot ${config.discordToken}`)
    .reply(200, mockChannels)

  const error = await t.throwsAsync(() =>
    apiHandler.validateChannelId(channelId, guildId)
  )
  t.is(
    error.message,
    `Invalid channel ID: ${channelId}. Channel ID ${channelId} does not exist in guild ${guildId}.`
  )
})

test('validateRiotToken - success', async (t) => {
  nock(`https://${config.region}.api.riotgames.com`)
    .get('/lol/platform/v3/champion-rotations')
    .matchHeader('X-Riot-Token', config.riotToken)
    .reply(200, { freeChampionIds: [1, 2, 3] })

  const result = await apiHandler.validateRiotToken()
  t.true(result)
})

test('validateRiotToken - invalid token', async (t) => {
  nock(`https://${config.region}.api.riotgames.com`)
    .get('/lol/platform/v3/champion-rotations')
    .matchHeader('X-Riot-Token', config.riotToken)
    .reply(401, { status: { message: 'Unauthorized' } })

  const error = await t.throwsAsync(apiHandler.validateRiotToken())
  t.is(error.message, 'Invalid Riot token.')
})
