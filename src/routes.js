import { CreateVPC, DeleteVPC } from "./Controllers/VPC.js";
import { ValidateDevice } from "./WebSockets/Device.js";

export async function RoutesHTTP(server) {
    server.post("/createVPC", CreateVPC);
    server.delete("/deleteVPC", DeleteVPC);
}

export async function RoutesWS(data, socket, dbConnection, devices) {
    const payload = JSON.parse(data.toString());

    switch (payload.path) {
        case "init-config":
            if (!payload.machineId) {
                socket.send(JSON.stringify({
                    path: "error-config",
                    error: "Missing MachineId"
                }));
                return;
            }

            const [deviceInfo] = await dbConnection.query("SELECT srn FROM assets WHERE machineId = ? AND isActive = 1", [payload.machineId]);
            
            if(deviceInfo.length === 0){
                socket.send(JSON.stringify({
                    path: "error-config",
                    error: "MachineId not found"
                }));
            }
            devices.set(payload.machineId, socket);
            await ValidateDevice(payload, socket, dbConnection);
            break;
        default:
            socket.send(JSON.stringify({
                type: "error",
                data: "Route Not Found"
            }));
            break;
    }
}