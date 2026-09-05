import { GenerateSpaceVPCConfigs } from "./SpaceVPC.js"

export async function ValidateDevice(payload, socket, dbConnection) {
    const [deviceInfo] = await dbConnection.query("SELECT srn, service, localip FROM assets WHERE machineId = ? AND isActive = 1", [payload.machineId]);
    
    switch (deviceInfo[0].service) {
        case "spacevpc":
            await GenerateSpaceVPCConfigs(dbConnection, socket, deviceInfo[0].srn, deviceInfo[0].localip);
            break;
        default:
            console.log("Invalid Device Type");
            break;
    }
}