import "reflect-metadata";
import { DataSource } from "typeorm";
import { State } from "./entities";

export const AppDataSource = new DataSource({
    type: "postgres",
    host: "localhost",
    port: 5432,
    username: "postgres",
    password: "postgres",
    database: "workshop",
    synchronize: true,
    logging: false,
    entities: [State],
    migrations: [],
    subscribers: [],
});
