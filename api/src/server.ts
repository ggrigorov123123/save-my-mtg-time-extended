import app from "./app";
import logging from "./utils/logger";

const PORT = 8888;

app.listen(PORT, () => {
  logging.info(`

  -----------------------------------------------------------

  Save My MTG Time started listening on port ${PORT}

  -----------------------------------------------------------
  
  `);
});