import Elysia from "elysia";
import { postCardsHandler, sseCardsHandler } from "../handlers/cardsHandler";
import { getOwnerUrls, postSourceHandler } from "../handlers/sourcesHandler";

export function configureCardsRoutes(app: Elysia) {
  return app
    .post("/source", postSourceHandler)
    .get("/source", getOwnerUrls)
    .post("/", postCardsHandler)
    .get('/sse', sseCardsHandler)
}
