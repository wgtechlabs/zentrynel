function timestamp() {
	return new Date().toISOString().replace('T', ' ').replace('Z', '');
}

export const logger = {
	info(msg, ...args) {
		console.log(`[${timestamp()}] [INFO] ${msg}`, ...args);
	},

	warn(msg, ...args) {
		console.warn(`[${timestamp()}] [WARN] ${msg}`, ...args);
	},

	error(msg, ...args) {
		console.error(`[${timestamp()}] [ERROR] ${msg}`, ...args);
	},

	debug(msg, ...args) {
		if (process.env.NODE_ENV !== 'production') {
			console.log(`[${timestamp()}] [DEBUG] ${msg}`, ...args);
		}
	},
};
