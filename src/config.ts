export interface Config {
    PORT: number

    USE_WEBHOOKS: boolean
    WEBHOOK_URL: string
    DISCORD_TOKEN: string
    DISCORD_CHANNEL_ID: string
    DISCORD_MESSAGE_TEMPLATE: string

    MINECRAFT_SERVER_RCON_IP: string
    MINECRAFT_SERVER_RCON_PORT: number
    MINECRAFT_SERVER_RCON_PASSWORD: string
    MINECRAFT_TELLRAW_TEMPLATE: string

    IS_LOCAL_FILE: boolean
    LOCAL_FILE_PATH: string

    ALLOW_USER_MENTIONS: boolean

    WEBHOOK: string
    REGEX_MATCH_CHAT_MC: string
    REGEX_IGNORED_CHAT: string
    RCON_RECONNECT_DELAY: number
    DEBUG: boolean

    SERVER_NAME: string
    SHOW_PLAYER_CONN_STAT: boolean
    SHOW_PLAYER_ADVANCEMENT: boolean
    SHOW_PLAYER_DEATH: boolean
    DEATH_KEY_WORDS: string[]
}
