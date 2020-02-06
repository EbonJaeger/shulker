import { Config } from './config'
import { Message } from './types'
import { Tail } from 'tail'
import express = require('express')
import fs = require('fs')

export class Watcher {
    private config: Config

    constructor(config: Config) {
        this.config = config
    }

    /**
    * Parse a line from the Minecraft log file.
    * @param line The line to parse.
    * @returns A Message object containing the sender and message body.
    */
    parseLine(line: string): Message | undefined {
        // Trim the time and thread prefix
        line = line.substring(33).trim()
        // Check if the line is a chat message
        if (line.startsWith('<')) {
            if (this.config.DEBUG) {
                console.log('[DEBUG] A player sent a chat message')
            }
            // Split the message into parts
            const username = line.substring(1, line.indexOf('>'))
            const message = line.substring(line.indexOf(' ') + 1)
            return new Message(username, message)
        }

        // Check if the line is a player joining or leaving (if enabled)
        if (this.config.SHOW_PLAYER_CONN_STAT && (line.indexOf('joined the game') !== -1 || line.indexOf('left the game') !== -1)) {
            if (this.config.DEBUG) {
                console.log('[DEBUG] A player\'s connection status changed')
            }
            return new Message(this.config.SERVER_NAME, line)
        }

        // Check if the line is a player earning an advancement (if enabled)
        if (this.config.SHOW_PLAYER_ADVANCEMENT && (
            line.indexOf('has made the advancement') !== -1 ||
            line.indexOf('has completed the challenge') !== -1 ||
            line.indexOf('has reached the goal') !== -1)) {
            if (this.config.DEBUG) {
                console.log('[DEBUG] A player has earned an advancement')
            }
            return new Message(this.config.SERVER_NAME, ':partying_face' + line)
        }

        // Check if the line is a player death (if enabled)
        if (this.config.SHOW_PLAYER_DEATH) {
            // Check for a match of any DEATH_KEY_WORDS
            for (var i = 0; i < this.config.DEATH_KEY_WORDS.length; i++) {
                if (line.indexOf(this.config.DEATH_KEY_WORDS[i]) !== -1) {
                    if (this.config.DEBUG) {
                        console.log('[DEBUG] A player died. Matched key word \"' + this.config.DEATH_KEY_WORDS[i] + "\"");
                    }
                    return new Message(this.config.SERVER_NAME, ':skull: ' + line)
                }
            }
        }

        // Check if the server has finished starting
        if (line.indexOf('Done (') !== -1) {
            return new Message(this.config.SERVER_NAME, ':white_check_mark: Server has started')
        }
        // Check if the server is shutting down
        if (line.indexOf('Stopping the server') !== -1) {
            return new Message(this.config.SERVER_NAME, ':x: Server is shutting down')
        }
        return (undefined)
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
            tail.on('line', (raw: string) => {
                // Parse the line to see if we care about it
                const message = this.parseLine(raw)
                if (message) {
                    // Call the callback if we care about this message
                    callback(message)
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
            // POST the received line to our webhook
            app.post(this.config.WEBHOOK, (request: express.Request, response: express.Response) => {
                // Parse the line we received
                const message = this.parseLine(request.body)
                callback(message)
                response.send('')
            })
        }
    }
}
