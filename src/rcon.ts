// Credits to M4GNV5 for this library to reduce dependencies

import net = require('net')

export class Rcon {
    debug: boolean
    timeout: number
    nextId: number
    addr: string
    port: number
    connected: boolean
    authed: boolean
    packages: any
    socket: net.Socket

    constructor(addr: string, port: number, debug: boolean) {
        this.addr = addr
        this.port = port
        this.debug = debug

        this.timeout = 5000
        this.nextId = 0
        this.connected = false
        this.authed = false
        this.packages = []
        this.socket = net.connect(this.port, this.addr, () => {
            this.connected = true
            console.log('[INFO] Connected to RCON on ' + this.addr + ':' + this.port)
        })
    }

    connect() {
        this.socket.on('data', (data) => {
            const length = data.readInt32LE(0)
            const id = data.readInt32LE(4)
            const type = data.readInt32LE(8)
            const response = data.toString('ascii', 12, data.length - 2)

            if (this.packages[id]) {
                this.packages[id](type, response)
            } else {
                console.log('unexpected rcon response', id, type, response)
            }
        }).on('end', () => {
            if (this.debug) {
                console.log('[DEBUG] Rcon closed!')
            }
        })
    }

    close() {
        this.connected = false
        this.socket.end()
    }

    auth(pass: string, callback: Function) {
        if (this.authed) {
            throw new Error('already authed')
        }

        if (this.connected) {
            this.sendPackage(3, pass, callback)
        } else {
            this.socket.on('connect', () => {
                this.sendPackage(3, pass, callback)
            })
        }
    }

    sendCommand(cmd: string, callback: Function) {
        this.sendPackage(2, cmd, callback)
    }

    private sendPackage(type: number, payload: string, callback: Function) {
        const id = this.nextId
        this.nextId++

        if (!this.connected) {
            throw new Error('Cannot send package while not connected')
        }

        const length = 14 + payload.length
        const buff = Buffer.alloc(length)
        buff.writeInt32LE(length - 4, 0)
        buff.writeInt32LE(id, 4)
        buff.writeInt32LE(type, 8)

        buff.write(payload, 12)
        buff.writeInt8(0, length - 2)
        buff.writeInt8(0, length - 1)

        this.socket.write(buff)

        const timeout = setTimeout(() => {
            delete this.packages[id]
            callback('Server sent no request in ' + this.timeout / 1000 + ' seconds')
        }, this.timeout)

        this.packages[id] = (type: number, response: Express.Response) => {
            clearTimeout(timeout)
            const err = type >= 0 ? false : 'Server sent package code ' + type
            if (this.debug) {
                console.log('[DEBUG] Recieved response: ' + response)
            }
            callback(err, response, type)
        }
    }
}
