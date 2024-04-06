import Elysia from "elysia";
import { configureCardsRoutes } from "./routes/cardsRoute";
import logging from "./utils/logger";
import cors from "@elysiajs/cors";

const app = new Elysia({ prefix: "/api" })
  .use(cors())
  .use(logging.into())
  .get("/status", () => `Server is live!`)
  .group("/cards", configureCardsRoutes);

export default app;
