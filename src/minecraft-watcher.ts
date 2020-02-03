import { Config } from './config'
import { Tail } from 'tail'
import express = require('express')
import fs = require('fs')

export class Watcher {
    private config: Config

    constructor(config: Config) {
        this.config = config
    }

    convertToServerMessage(data: string) {
        // Get username of player
        var username = this.getWordAt(data, 33)
        // Change the "Username" field to the server's name and place the player's usename in the message body.
        data = data.replace(username, "<" + this.config.SERVER_NAME + " - Server> " + username)
        return data
    }

    getWordAt(str: string, pos: number): string {
        // Perform type conversions.
        str = String(str);
        pos = Number(pos) >>> 0;
        // Search for the word's beginning and end.
        var left = str.slice(0, pos + 1).search(/\S+$/),
            right = str.slice(pos).search(/\s/);
        // The last word in the string is a special case.
        if (right < 0) {
            return str.slice(left);
        }
        // Return the word, using the located bounds to extract it from the string.
        return str.slice(left, right + pos);
    }

    /**
    * Parse a line from the Minecraft log file.
    * @param line The line to parse.
    * @returns The line if it is a message to send to Discord.
    */
    parseLogLine(line: string): string {
        // Check if the line is a chat message
        if (line.indexOf(': <') !== -1) {
            if (this.config.DEBUG) {
                console.log('[Debug]: A player sent a chat message')
            }
            return (line)
        }

        // Check if the line is a player joining or leaving (if enabled)
        else if (this.config.SHOW_PLAYER_CONN_STAT && (line.indexOf('left the game') !== -1 || line.indexOf('joined the game') !== -1)) {
            if (this.config.DEBUG) {
                console.log('[Debug]: A player\'s connection status changed')
            }
            line = this.convertToServerMessage(line)
            return (line)
        }

        // Check if the line is a player earning an achievement (if enabled)
        else if (this.config.SHOW_PLAYER_ADVANCEMENT && line.indexOf('has made the achievement') !== -1) {
            if (this.config.DEBUG) {
                console.log('[Debug] A player has earned an advancement')
            }
            line = this.convertToServerMessage(line)
            return (line)
        }

        // Check if the line is a player death (if enabled)
        else if (this.config.SHOW_PLAYER_DEATH) {
            // Check for a match of any DEATH_KEY_WORDS
            for (var index = 0; index < this.config.DEATH_KEY_WORDS.length; index++) {
                if (line.indexOf(this.config.DEATH_KEY_WORDS[index]) !== -1) {
                    if (this.config.DEBUG) {
                        console.log('[DEBUG] A player died. Matched key word \"' + this.config.DEATH_KEY_WORDS[index] + "\"");
                    }
                    line = this.convertToServerMessage(line)
                    return (line)
                }
            }
        }

        // Otherwise return blank
        line = ''
        return (line)
    }

    /**
    * Watch for incoming data from the log file or Discord webhook.
    * @param callback Function to call when data is received.
    */
    watch(callback: Function) {
        if (this.config.IS_LOCAL_FILE) {
            // Check that the server log file exists
            let tail: Tail
            if (fs.existsSync(this.config.LOCAL_FILE_PATH)) {
                console.log('[INFO] Using configuration for Minecraft server log at "' + this.config.LOCAL_FILE_PATH + '"')
                tail = new Tail(this.config.LOCAL_FILE_PATH)
            } else {
                throw new Error('[ERROR] Minecraft server log not found at "' + this.config.LOCAL_FILE_PATH + '"')
            }
            // Get the last line in the log file
            tail.on('line', (data: string) => {
                // Parse the line to see if we care about it
                data = this.parseLogLine(data)
                if (data != '') {
                    // Call the callback if we care about this message
                    callback(data)
                }
            })
        } else {
            const app = express()
            const http = require('http').Server(app)
            // Set up a server if we're not using the Minecraft log file
            app.use((request: express.Request, response: express.Response, next: Function) => {
                request.body = ''
                request.setEncoding('utf8')

                request.on('data', (chunk: any) => {
                    request.body += chunk
                })

                request.on('end', () => {
                    next()
                })
            })
            // Get the port to listen on
            const serverport = process.env.PORT || this.config.PORT
            // Listen on our server port
            http.listen(serverport, () => {
                console.log('[INFO] Bot listening on *:' + serverport)
            })
            app.post(this.config.WEBHOOK, (request: express.Request, response: express.Response) => {
                callback(request.body)
                response.send('')
            })
        }
    }
}
