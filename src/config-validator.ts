import Ajv, { ValidateFunction } from 'ajv'
import addFormats from 'ajv-formats'
import { IANAZone } from 'luxon'
import { ApiHandler } from './data-handlers/api-handler.js'
import { Config } from './interfaces/config.interface.js'

class ConfigValidator {
  private config: Config
  private apiHandler: ApiHandler
  private schema: object
  private validate: ValidateFunction

  constructor(config: Config) {
    this.config = config
    this.apiHandler = ApiHandler.getInstance(config)

    const ajv = new Ajv.default({ allErrors: true, useDefaults: true })
    addFormats.default(ajv)

    ajv.addFormat('timezone', {
      validate: (timezone: string) => IANAZone.isValidZone(timezone)
    })

    // Define the JSON schema for the configuration
    this.schema = {
      type: 'object',
      properties: {
        channels: {
          type: 'object',
          properties: {
            help: { type: 'string', pattern: '^[0-9]+', nullable: true }
          },
          additionalProperties: false
        },
        guildId: { type: 'string', pattern: '^[0-9]+' },
        setVerifiedRole: { type: 'boolean' },
        enableVerification: { type: 'boolean' },
        enableTierUpdateMessages: { type: 'boolean' },
        discordToken: { type: 'string' },
        riotToken: { type: 'string' },
        status: { type: 'string' },
        embedColor: { type: 'string', pattern: '^[0-9a-fA-F]{6}$' },
        ranks: {
          type: 'array',
          items: { type: 'string' },
          minItems: 1
        },
        rankIconNames: {
          type: 'object',
          additionalProperties: { type: 'string' }
        },
        region: { type: 'string' },
        timeZone: { type: 'string', format: 'timezone' },
        language: { type: 'string' },
        eloRoleLanguage: { type: 'string' },
        verifiedRoleLanguage: { type: 'string' },
        enableCronJob: { type: 'boolean' },
        cronTab: {
          type: 'string'
        },
        concurrentRequests: { type: 'integer', minimum: 1 },
        requestTime: { type: 'integer', minimum: 1 }
      },
      required: [
        'guildId',
        'setVerifiedRole',
        'enableVerification',
        'enableTierUpdateMessages',
        'discordToken',
        'riotToken',
        'status',
        'embedColor',
        'ranks',
        'rankIconNames',
        'region',
        'timeZone',
        'language',
        'eloRoleLanguage',
        'verifiedRoleLanguage',
        'enableCronJob',
        'cronTab',
        'concurrentRequests',
        'requestTime'
      ],
      additionalProperties: false
    }

    // Compile the schema
    this.validate = ajv.compile(this.schema)
  }

  async validateDiscordResources(config: Config) {
    // Validate the guild ID
    await this.apiHandler.validateGuildId(config.guildId)

    // Validate the channel IDs
    if (config.channels)
      for (const channelId of Object.values(config.channels)) {
        await this.apiHandler.validateChannelId(channelId!, config.guildId)
      }
  }

  async validateConfig() {
    const valid = this.validate(this.config)
    if (!valid) {
      const errors =
        this.validate.errors
          ?.map((error: any) => {
            return `Message: ${error.message}`
          })
          .join('\n') || ''
      throw new Error(`Configuration validation failed with errors:\n${errors}`)
    }

    // Perform actual validation against the Discord API
    await this.validateDiscordResources(this.config)
    // Validate Riot API key
    await this.apiHandler.validateRiotToken()
  }
}

export default ConfigValidator
