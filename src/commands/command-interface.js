class CommandInterface {
  constructor(name) {
    this.name = name
  }

  /**
   * Executes the command. This method must be overridden by subclasses to provide
   * specific functionality for each command. It supports handling both text-based commands
   * and slash command interactions, accommodating a wide range of use cases.
   *
   * @param {CommandInteraction|Object} message - The interaction object from Discord.js
   *                                              or a custom object for text commands, providing
   *                                              the context needed for command execution.
   * @param {Object} args - An object with the structure { type: 'summonerName', value: summonerName },
   *                        allowing for flexible command processing.
   */
  async execute(message, args) {
    throw new Error('execute method must be implemented by subclass')
  }

  /**
   * Provides the data necessary for registering the command as a slash command.
   * This method should be overridden by subclasses that wish to be used as slash commands.
   *
   * @returns {Object|null} The command data for slash command registration, or null if not applicable.
   */
  getSlashCommandData() {
    // Returning null indicates that by default, commands do not have slash command data.
    // Subclasses should override this method to return their specific command data.
    throw new Error(
      'getSlashCommandData method must be implemented by subclass'
    )
  }
}

module.exports = CommandInterface
