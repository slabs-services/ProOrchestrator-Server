import fastify from "fastify";
import mysql from "mysql2/promise";
import "dotenv/config";
import { RoutesHTTP, RoutesWS } from "./routes.js";
import WebSocket from "ws";

const wss = new WebSocket.Server({
    port: 8083
});

const connection = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

const server = fastify();
const devices = new Map();

server.decorate("db", connection);
server.decorate("devices", devices);
server.addHook("onClose", async () => {
    await connection.end();
    wss.close();
});

wss.on("connection", (socket, request) => {
    socket.on("message", (data) => {
        try {
            RoutesWS(data, socket, connection, devices);
        } catch (error) {
            socket.send(JSON.stringify({
                type: "error",
                error: "Invalid JSON"
            }));
        }
    });

    socket.on("close", () => {
        for (const [machineId, registeredSocket] of devices) {
            if (registeredSocket === socket) {
                devices.delete(machineId);
                break;
            }
        }
    });
});

server.register(RoutesHTTP);
server.listen({ host: '10.0.0.5', port: 8082 });