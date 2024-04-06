import { Context } from "elysia"
import { createClient } from "redis"
import { Source } from "../models/Source";
import { cleanUserProgress, initUserProgress } from "../utils/progressTracker";
import logging from "../utils/logger";

const redisClient = await createClient({ password: "supersafepass!"})
  .on("error", err => logging.error("Redis Client Error", err));

export const postSourceHandler = async (ctx: Context) => {
	const payload = ctx.body as Source;
	
	try {
		logging.info(`[REDIS] Saving data sources for owner ${payload.owner}`);
		redisClient.connect();
		redisClient.sAdd(payload.owner, payload.urls);
		await redisClient.quit();
	} catch (err) {
		logging.error('[REDIS] Error while persisting data sources!', err);
	}
	
	ctx.set.status = 200;
	return payload;
}

export const getOwnerUrls = async (ctx: Context) => {
	const ownerName = ctx.query.name as string;
	let urls: string[] = [];

	try {
		logging.info(`[REDIS] Fetching all owners`);
		redisClient.connect();
		const result = await redisClient.sMembers(ownerName);
		// console.log(result);
		urls = result;
		await redisClient.quit();
	} catch (err) {
		logging.error('[REDIS] Error while fetching data sources!', err);
	}
	
	ctx.set.status = 200;
	return urls;
}

