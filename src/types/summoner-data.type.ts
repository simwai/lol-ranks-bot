export type SummonerDataArgs = {
  type: 'summonerName' | 'summonerID' | 'player'
  value: string | { summonerID: string }
}
