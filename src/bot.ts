import { Client, Message, TextChannel } from 'discord.js'
import { Config } from './config'
import { MinecraftMessage } from './types'
import emojiStrip = require('emoji-strip')
import { logger } from './index'
const Rcon = require('rcon')

const axios = require('axios')

export class Bot {
    private config: Config
    private client: Client
    private readonly token: string

    /**
     * Create a new Discord bot instance.
     * @param config The configuration object to pull settings from.
     * @param client The Discord client to use.
     * @param token The Discord bot token to authenticate with.
     * @constructor
     */
    constructor(config: Config, client: Client, token: string) {
        this.config = config
        this.client = client
        this.token = token
    }

    /**
     * Log in to Discord and listen for messages.
     */
    public listen(): Promise<string> {
        // On message received
        this.client.on('message', (message: Message) => {
            // Only look at messages from the configured channel
            if (message.channel.id !== this.config.DISCORD_CHANNEL_ID || message.channel.type !== 'text') {
                return
            }
            // Ignore webhooks if using a webhook
            if (this.config.USE_WEBHOOKS && message.webhookID) {
                return
            }
            // Ignore messages from bots
            if (message.author.bot) {
                return
            }
            // Ignore messages with attachments
            if (message.attachments.size > 0) {
                return
            }
            logger.debug("Received a message from Discord")
            // Set up the RCON conenction
            const host = this.config.MINECRAFT_SERVER_RCON_IP
            const port = this.config.MINECRAFT_SERVER_RCON_PORT
            const password = this.config.MINECRAFT_SERVER_RCON_PASSWORD
            const conn = new Rcon(host, port, password, { challenge: false })
            // Set up our handlers
            conn.on('auth', async () => {
                logger.info(`Authenticated with RCON at '${host}:${port}'`)
                // Send message through RCON conenction
                conn.send(`tellraw @a ${this.makeMinecraftTellraw(message)}`)
                conn.disconnect()
            }).on('end', () => {
                logger.info(`Connection with '${host}:${port}' closed`)
            }).on('error', (err: Error) => {
                logger.error(`${err.stack}`)
            })
            // Connect to the socket
            conn.connect()
        })
        // Log in to Discord
        logger.info('Logging in to Discord...')
        return this.client.login(this.token)
    }

    /**
     * Formats a message to send to Discord.
     * @param username The name of the user sending the message.
     * @param message The chat message from Minecraft.
     * @returns The final formatted message to send.
     */
    makeDiscordMessage(username: string, message: string): string {
        // Insert Discord mentions
        message = this.replaceDiscordMentions(message)
        return this.config.DISCORD_MESSAGE_TEMPLATE
            .replace('%username%', username)
            .replace('%message%', message)
    }

    /**
     * Make a message to send via the Discord webhook.
     * @param username The username of the sender.
     * @param message The message to send.
     */
    makeDiscordWebhook(username: string, message: string) {
        // Insert Discord mentions
        message = this.replaceDiscordMentions(message)
        // Get the avatar to use for this user
        var avatarURL = ''
        // Check if the message is from a player, or the server
        if (username === this.config.SERVER_NAME + ' - Server') {
            // Use avatar for the server
            avatarURL = `https://cdn6.aptoide.com/imgs/8/e/d/8ede957333544a11f75df4518b501bdb_icon.png?w=256`
        } else {
            // Use avatar for player
            avatarURL = `https://minotar.net/helm/${username}/256.png`
        }
        return {
            username: username,
            content: message,
            'avatar_url': avatarURL
        }
    }

    /**
     * Create a string to send to the Minecraft server as a chat message via the 'tellraw' command.
     * @param message The Discord chat message.
     * @returns A string to send to Minecraft.
     */
    makeMinecraftTellraw(message: Message): string {
        const username = emojiStrip(message.author.username)
        const discriminator = message.author.discriminator
        const text = emojiStrip(message.cleanContent)
        // hastily use JSON to encode the strings
        // TODO: Why?
        const variables = JSON.parse(JSON.stringify({ username, discriminator, text }))
        return this.config.MINECRAFT_TELLRAW_TEMPLATE
            .replace('%username%', variables.username)
            .replace('%discriminator%', variables.discriminator)
            .replace('%message%', variables.text)
    }

    /**
     * Replace any possible mentions in a chat message with actual Discord mentions.
     * @param message The message to insert mentions in.
     * @returns The message with mentions in it.
     */
    replaceDiscordMentions(message: string): string {
        if (this.config.ALLOW_USER_MENTIONS) {
            // Check the message for mentions
            const possibleMentions = message.match(/@(\S+)/gim)
            if (possibleMentions) {
                // Iterate over the possible mentions
                for (let mention of possibleMentions) {
                    // Split the mention into the username and number code
                    const mentionParts = mention.split('#')
                    // Get the username
                    let username = mentionParts[0].replace('@', '')
                    if (mentionParts.length > 1) {
                        // Attempt to get the user being mentioned
                        const user = this.client.users.find(user => user.username === username && user.discriminator === mentionParts[1])
                        if (user) {
                            // Turn it into an actual Discord mention
                            message = message.replace(mention, '<@' + user.id + '>')
                        }
                    }
                }
            }
        }
        return message
    }

    sendChannelMessage(msg: MinecraftMessage) {
        if (this.config.USE_WEBHOOKS) {
            // Create the webhook message
            const webhook = this.makeDiscordWebhook(msg.username, msg.message)
            // Send to the webhook URL
            axios.post(this.config.WEBHOOK_URL, {
                ...webhook
            }, {
                headers: {
                    'Content-Type': 'application/json'
                }
            })
        } else {
            // find the channel
            const channel = <TextChannel>this.client.channels.find((ch) => ch.id === this.config.DISCORD_CHANNEL_ID && ch.type === 'text')
            // Make sure we have a channel
            if (channel) {
                // Format the message
                const formatted = this.makeDiscordMessage(msg.username, msg.message)
                // Send the message
                channel.send(formatted)
            } else {
                logger.warn("Unable to find the Discord channel to send to!")
            }
        }
    }
}
