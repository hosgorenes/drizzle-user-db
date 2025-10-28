import { config } from "dotenv";
config();
import Fastify from "fastify";
import routes from "./routes";
import logger from "./utils/logger";


const app = Fastify();

app.register(routes);

app.listen({ port: 3000 }, (err, address) => {
    if (err) {
        logger.error(`Server failed to start: ${err.message}`);
        process.exit(1);
    }
    logger.info(`🚀 Server running at ${address}`);
});
