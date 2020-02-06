import { Bot } from './bot'
import { Config } from './config'
import { Client } from 'discord.js'
import { Message } from './types'
import { Watcher } from './minecraft-watcher'

function fixUsername(username: string): string {
    return username.replace(/(§[A-Z-a-z0-9])/g, '')
}

// Initialize our config file
const configFile = (process.argv.length > 2) ? process.argv[2] : '../config.json'
console.log('[INFO] Using configuration file:', configFile)
const c: Config = require(configFile)
// Create our Discord bot
const client = new Client()
const bot = new Bot(c, client, c.DISCORD_TOKEN)
// Create our Minecraft watcher
const watcher = new Watcher(c)
// Watch for messages to send to Discord when the bot is ready
client.on('ready', () => {
    watcher.watch((msg: Message) => {
        console.log('[INFO] Recieved a line from Minecraft')
        // TODO: Implement banned words
        if (c.DEBUG) {
            console.log(`[DEBUG] Username: '${msg.username}', Text: '${msg.message}'`)
        }
        // Send the message to Discord
        bot.sendChannelMessage(msg.username, msg.message)
    })
})
// Log in to Discord
bot.listen().then(() => {
    console.log("[INFO] Logged in to Discord")
}).catch((error) => {
    console.error("[ERROR] Error logging in to Discord: ", error)
})
