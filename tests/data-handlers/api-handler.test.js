const test = require('ava');
const nock = require('nock');
const { ApiHandler } = require('../../src/data-handlers/api-handler');

// Setup configuration for ApiHandler
const config = {
  riotToken: 'dummyRiotToken',
  region: 'dummyRegion',
  discordToken: 'dummyDiscordToken'
};

// Instantiate ApiHandler with mock config
const apiHandler = new ApiHandler(config);

test.beforeEach(() => {
  // Clean all nocks before each test
  nock.cleanAll();
});

test('getData - success', async t => {
  const testUrl = 'https://example.com/data';
  const mockResponse = { success: true };

  nock('https://example.com')
    .get('/data')
    .reply(200, mockResponse);

  const result = await apiHandler.getData(testUrl);
  t.deepEqual(result, mockResponse);
});

test('getData - network error', async t => {
  const testUrl = 'https://example.com/fail';

  nock('https://example.com')
    .get('/fail')
    .replyWithError('Network error');

  const error = await t.throwsAsync(apiHandler.getData(testUrl));
  t.is(error.message, 'Network error');
});

test('getSummonerDataByNameOrId - summonerName', async t => {
  const summonerName = 'testSummoner';
  const mockResponse = { id: '123', name: summonerName };

  nock(`https://${config.region}.api.riotgames.com`)
    .get(`/lol/summoner/v4/summoners/by-name/${summonerName}`)
    .reply(200, mockResponse);

  const result = await apiHandler.getSummonerDataByNameOrId({ type: 'summonerName', value: summonerName });
  t.deepEqual(result, mockResponse);
});

test('getRankedDataById - success', async t => {
  const summonerID = 'validSummonerId';
  const mockRankedData = [{ tier: 'Gold', rank: 'I' }];

  nock(`https://${config.region}.api.riotgames.com`)
    .get(`/lol/league/v4/entries/by-summoner/${summonerID}`)
    .reply(200, mockRankedData);

  const result = await apiHandler.getRankedDataById('helpChannel', summonerID);
  t.deepEqual(result, mockRankedData);
});

test('validateGuildId - success', async t => {
  const guildId = 'validGuildId';

  nock(apiHandler.discordBaseURL)
    .get(`/guilds/${guildId}`)
    .reply(200);

  const result = await apiHandler.validateGuildId(guildId);
  t.true(result);
});

test('validateChannelId - success', async t => {
  const channelId = 'validChannelId';
  const guildId = 'guildIdForChannel';
  const mockChannels = [{ id: channelId }];

  nock(apiHandler.discordBaseURL)
    .get(`/guilds/${guildId}/channels`)
    .reply(200, mockChannels);

  const result = await apiHandler.validateChannelId(channelId, guildId);
  t.true(result);
});

test('validateChannelId - channel does not exist', async t => {
  const channelId = 'nonExistentChannelId';
  const guildId = 'guildIdWithNoSuchChannel';
  const mockChannels = [{ id: 'someOtherChannelId' }];

  nock(apiHandler.discordBaseURL)
    .get(`/guilds/${guildId}/channels`)
    .reply(200, mockChannels);

  const error = await t.throwsAsync(() => apiHandler.validateChannelId(channelId, guildId));
  t.is(error.message, `Invalid channel ID: ${channelId}. Channel ID ${channelId} does not exist in guild ${guildId}.`);
});

test('validateRiotToken - success', async t => {
  nock(`https://${config.region}.api.riotgames.com`)
    .get(`/lol/platform/v3/champion-rotations`)
    .reply(200); // Simulating a successful response

  const result = await apiHandler.validateRiotToken();
  t.true(result);
});

test('validateRiotToken - invalid token', async t => {
  nock(`https://${config.region}.api.riotgames.com`)
    .get(`/lol/platform/v3/champion-rotations`)
    .reply(401); // Unauthorized, simulating an invalid token

  const error = await t.throwsAsync(apiHandler.validateRiotToken());
  t.is(error.message, 'Invalid Riot token.');
});

// Ensure nock does not interfere with other tests
test.after.always('cleanup', () => {
  nock.cleanAll();
  nock.restore();
});
