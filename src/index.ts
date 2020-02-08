import { Bot } from './bot'
import { Config } from './config'
import { Client } from 'discord.js'
import { MinecraftMessage } from './types'
import { Watcher } from './minecraft-watcher'
import { createLogger, format, transports } from 'winston'

// Initialize our config file
const configFile = (process.argv.length > 2) ? process.argv[2] : '../config.json'
const c: Config = require(configFile)
// Initialize our logger
export const logger = createLogger({
    level: c.loggingLevel,
    format: format.combine(
        format.timestamp({
            format: 'YYYY-MM-DD HH:mm:ss'
        }),
        format.errors({ stack: true }),
        format.colorize(),
        format.prettyPrint(),
        format.splat(),
        format.printf(info => `[${info.timestamp}] ${info.level}: ${info.message}`)
    ),
    transports: [
        new transports.File({ filename: 'shulker-error.log', level: 'error' }),
        new transports.Console()
    ]
})
// Create our Discord bot
const client = new Client()
const bot = new Bot(c, client, c.DISCORD_TOKEN)
// Create our Minecraft watcher
const watcher = new Watcher(c)
// Watch for messages to send to Discord when the bot is ready
client.on('ready', () => {
    watcher.watch((msg: MinecraftMessage) => {
        logger.debug(`Recieved a line from Minecraft: Username: '${msg.username}', Text: '${msg.message}'`)
        // TODO: Implement banned words
        // Send the message to Discord
        bot.sendChannelMessage(msg)
    })
})
// Log in to Discord
bot.listen().then(() => {
    logger.info('Logged in to Discord')
}).catch((error: Error) => {
    logger.error('Error logging in to Discord: ', error.stack)
})
