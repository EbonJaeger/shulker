import { Bot } from './bot'
import { Config } from "./config"
import { Client } from "discord.js"
import { Watcher } from './minecraft-watcher'

function fixUsername(username: string): string {
    return username.replace(/(§[A-Z-a-z0-9])/g, '')
}

// Initialize our config file
const configFile = (process.argv.length > 2) ? process.argv[2] : '../config.json'
console.log('[INFO] Using configuration file:', configFile)
const c: Config = require(configFile)
// Create our Discord bot
let client = new Client()
let bot = new Bot(c, client, c.DISCORD_TOKEN)
// Create our Minecraft watcher
let watcher = new Watcher(c)
// Watch for messages to send to Discord when the bot is ready
client.on('ready', function () {
    watcher.watch((body: any) => {
        console.log('[INFO] Recieved ' + body)
        const re = new RegExp(c.REGEX_MATCH_CHAT_MC)
        const ignored = new RegExp(c.REGEX_IGNORED_CHAT)
        if (!ignored.test(body)) {
            const bodymatch = body.match(re)
            const username = fixUsername(bodymatch[1])
            const message = bodymatch[2]
            if (c.DEBUG) {
                console.log('[DEBUG] Username: ' + bodymatch[1])
                console.log('[DEBUG] Text: ' + bodymatch[2])
            }
            // Send the message to Discord
            bot.sendChannelMessage(username, message)
        }
    })
})
// Log in to Discord
bot.listen().then(() => {
    console.log("Logged in to Discord")
}).catch((error) => {
    console.error("Error logging in to Discord: ", error)
})
