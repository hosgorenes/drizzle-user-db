import Fastify from "fastify";
import routes from "./routes";

const app = Fastify();

// tüm route’ları kaydet
app.register(routes);

app.listen({ port: 3000 }, (err, address) => {
    if (err) throw err;
    console.log(`Server ${address} adresinde çalışıyor`);
});
