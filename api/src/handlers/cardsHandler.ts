// import { Context } from "elysia/dist/context";

import { Context } from "elysia";
import { extractMoxfield } from "../utils/extractMoxfield";
import { ReqBody } from "../models/ReqBody";
import { Card } from "../models/Card";
import { extractDeckbox } from "../utils/extractDeckbox";
import { CardsResp } from "../models/CardsResp";
import { Stream } from "@elysiajs/stream";
import {
  cleanUserProgress,
  getUserProgress,
  initUserProgress,
} from "../utils/progressTracker";

// TS - type the body?
export const postCardsHandler = async (ctx: Context) => {
  const payload = JSON.parse(ctx.body as unknown as string) as ReqBody;
    const userId = ctx.query.userId;
  if (!userId) {
    // This should be added to a middleware validator!!!
    ctx.set.status = 400;
    return "Missing unique user id!";
  }
  initUserProgress(userId);
  const promises: Promise<{ source: string; cards: Map<string, Card> }>[] = [];

  payload.sources.forEach((sourceUrl) => {
    if (sourceUrl.includes("moxfield.com")) {
      promises.push(extractMoxfield(sourceUrl, userId));
    } else if (sourceUrl.includes("deckbox.org")) {
      promises.push(extractDeckbox(sourceUrl, userId));
    }
  });

  const decksCards = await Promise.allSettled(promises);
  const result: CardsResp = {};

  payload.cards.forEach((cardName) => {
    decksCards.forEach((promise) => {
      if (promise.status === "fulfilled") {
        const existing = promise.value.cards.get(cardName);
        if (existing) {
          if (!result[promise.value.source]) {
            result[promise.value.source] = [];
          }
          result[promise.value.source].push(existing);
        }
      }
    });
  });
  cleanUserProgress(userId);
  ctx.set.status = 200;
  return result;
};

export const sseCardsHandler = (ctx: Context) => {
  const userId = ctx.query.userId;
  if (!userId) {
    // This should be added to a middleware validator!!!
    ctx.set.status = 400;
    return "Missing unique user id!";
  }

  return new Stream((stream) => {
    const interval = setInterval(() => {
      const progress = getUserProgress(userId);
      if (progress) {
        stream.send(JSON.stringify(progress));
      } else {
        clearInterval(interval);
        stream.close();
      }
    }, 500);
  });
};
