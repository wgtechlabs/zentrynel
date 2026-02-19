import { LogEngine } from '@wgtechlabs/log-engine';

/**
 * Application logger powered by @wgtechlabs/log-engine.
 *
 * Log mode is auto-configured based on NODE_ENV:
 *   development → DEBUG | production → INFO | test → ERROR
 */
export const logger = {
	info(msg: string, ...args: unknown[]): void {
		LogEngine.info(msg, args.length === 1 ? args[0] : args.length > 1 ? args : undefined);
	},

	warn(msg: string, ...args: unknown[]): void {
		LogEngine.warn(msg, args.length === 1 ? args[0] : args.length > 1 ? args : undefined);
	},

	error(msg: string, ...args: unknown[]): void {
		LogEngine.error(msg, args.length === 1 ? args[0] : args.length > 1 ? args : undefined);
	},

	debug(msg: string, ...args: unknown[]): void {
		LogEngine.debug(msg, args.length === 1 ? args[0] : args.length > 1 ? args : undefined);
	},
};
