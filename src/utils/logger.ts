function timestamp(): string {
	return new Date().toISOString().replace('T', ' ').replace('Z', '');
}

export const logger = {
	info(msg: string, ...args: unknown[]): void {
		console.log(`[${timestamp()}] [INFO] ${msg}`, ...args);
	},

	warn(msg: string, ...args: unknown[]): void {
		console.warn(`[${timestamp()}] [WARN] ${msg}`, ...args);
	},

	error(msg: string, ...args: unknown[]): void {
		console.error(`[${timestamp()}] [ERROR] ${msg}`, ...args);
	},

	debug(msg: string, ...args: unknown[]): void {
		if (process.env.NODE_ENV !== 'production') {
			console.log(`[${timestamp()}] [DEBUG] ${msg}`, ...args);
		}
	},
};
