const required = ['DISCORD_TOKEN', 'CLIENT_ID'];

for (const key of required) {
	if (!process.env[key]) {
		throw new Error(`Missing required environment variable: ${key}`);
	}
}

export const env = Object.freeze({
	DISCORD_TOKEN: process.env.DISCORD_TOKEN,
	CLIENT_ID: process.env.CLIENT_ID,
	DEV_GUILD_ID: process.env.DEV_GUILD_ID || null,
	NODE_ENV: process.env.NODE_ENV || 'development',
	DB_PATH: process.env.DB_PATH || '/app/data/zentrynel.db',
});
