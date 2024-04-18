import { Interaction } from 'discord.js'
import { SummonerDataArgs } from '../types/summoner-data.type.js'

/**
 * Abstract class representing the interface for a command within a Discord bot.
 * This class defines the structure and required methods for commands, ensuring
 * consistency and facilitating ease of command handling and registration.
 */
export abstract class CommandInterface<T extends Interaction> {
  name: string

  /**
   * Constructs a new instance of a command with the specified name.
   *
   * @param name The name of the command, used for command identification and execution.
   */
  constructor(name: string) {
    this.name = name
  }

  /**
   * Abstract method to execute the command. Subclasses must implement this method
   * to define specific command behavior. This method supports handling both text-based
   * commands and slash command interactions, accommodating a wide range of use cases.
   *
   * Implementing this method in subclasses involves processing the command based on
   * the provided message and arguments, performing the necessary actions or responses
   * as defined by the command's purpose.
   *
   * @param message The interaction object from Discord.js or a custom object for text commands,
   *                providing the context needed for command execution.
   * @param args An object containing command arguments, structured as defined by the command's needs.
   *             For example, { type: 'summonerName', value: summonerName } for a command requiring
   *             a summoner name as input.
   * @returns A Promise resolved when the command execution is complete. May be asynchronous.
   */
  abstract execute(message: T, args: SummonerDataArgs): Promise<void>

  /**
   * Abstract method to provide the data necessary for registering the command as a slash command.
   * Subclasses must implement this method if the command is intended to be used as a slash command,
   * returning the necessary command data for registration with the Discord API.
   *
   * Implementing this method in subclasses involves returning an object that defines the slash command,
   * including its name, description, and any options it requires. Returning null indicates that the
   * command is not intended to be registered as a slash command.
   *
   * @returns The command data for slash command registration as an object, or null if the command
   *          is not applicable as a slash command.
   */
  abstract getSlashCommandData(): Object | null
}
