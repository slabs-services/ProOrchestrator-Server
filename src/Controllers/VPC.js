import { generateValidSrn, isSubnetConflict } from "../Util";

export async function CreateVPC(request, reply) {
    const { name, ip } = request.body;
    if(!name || !ip){
        return reply.code(400).send({
            message: "Missing name or ip"
        });
    }

    const nameClear = name.trim();
    const [assetToConfigure] = await request.db.query("SELECT assetSrn, COUNT(srn) AS ServicesCount FROM spacevpcs GROUP BY assetSrn ORDER BY ServicesCount ASC LIMIT 1");
    const [machineIdQuery] = await request.db.query("SELECT machineId, localip FROM assets WHERE service = 'spacevpc' AND machineId = ?", [assetToConfigure[0].assetSrn]);
    const socket = request.devices.get(machineIdQuery[0].machineId);

    if (!socket) {
        return reply.code(404).send({
            message: "Device offline"
        });
    }

    if (socket.readyState !== 1) {
        request.devices.delete(machineIdQuery[0].machineId);

        return reply.code(404).send({
            message: "Device offline"
        });
    }

    const vpcSrn = await generateValidSrn(request, "spacevpc", "spacevpcs");
    await request.db.query("INSERT INTO spacevpcs (srn, name, ip, assetSrn) VALUES (?,?,?,?)", [vpcSrn, nameClear, ip, assetToConfigure[0].assetSrn]);
    const [getNetworkCode] = await request.db.query("SELECT networkCode FROM spacevpcs WHERE srn = ?", [vpcSrn]);

    socket.send(JSON.stringify({
        path: "create-vpc",
        data: {
            localip: machineIdQuery[0].localip,
            spaceVpcs: [
                {
                    ip,
                    networkCode: getNetworkCode[0].networkCode,
                    routes: []
                }
            ]
        }
    }));

    reply.status(200).send({
        message: "VPC created with success."
    });
}

export async function CreateRoute(request, reply) {
    const { name, network, cidr, nextHop, vpcSrn } = request.body;
    const nameClear = name.trim();
    const [spaceVpcConfig] = await request.db.query("SELECT spacevps.networkcode, assets.machineId FROM spacevps INNER JOIN assets ON spacevps.assetSrn = assets.srn WHERE spacevps.srn = ?", [vpcSrn]);
    if(spaceVpcConfig.length === 0){
        return reply.code(404).send({
            message: "VPC not found"
        });
    }

    const [spaceRouteConfig] = await request.db.query("SELECT network, cidr FROM vpcroutes WHERE vpcSrn = ?", [vpcSrn]);

    if (isSubnetConflict(network, cidr, spaceRouteConfig)) {
        return reply.code(409).send({
            message: "Network conflicts with an existing route"
        });
    }

    const socket = request.devices.get(spaceVpcConfig[0].machineId);

    if (!socket) {
        return reply.code(404).send({
            message: "Device offline"
        });
    }

    if (socket.readyState !== 1) {
        request.devices.delete(spaceVpcConfig[0].machineId);

        return reply.code(404).send({
            message: "Device offline"
        });
    }

    const routeSrn = await generateValidSrn(request, "vpc:route", "vpcroutes");
    await request.db.query(
        "INSERT INTO vpcroutes (srn, name, network, cidr, nextHop, vpcSrn) VALUES (?,?,?,?,?,?)",
        [routeSrn, nameClear, network, cidr, nextHop, spaceVpcConfig[0].networkCode]
    );

    socket.send(JSON.stringify({
        path: "create-route",
        data: {
            networkCode: spaceVpcConfig[0].networkCode,
            routes: [
                {
                    network,
                    cidr,
                    nextHop
                }
            ]
        }
    }));

    reply.status(200).send({
        message: "Route created with success."
    });
}

export async function DeleteVPC(request, reply) {
    const { vpcSrn } = request.body;
    const [dataToDeleteQuery] = await request.db.query("SELECT assets.machineId, spacevpcs.networkCode FROM spacevpcs INNER JOIN assets ON spacevpcs.assetSrn = assets.srn WHERE assets.service = 'spacevpc' AND spacevpcs.srn = ?", [vpcSrn]);
    const socket = request.devices.get(dataToDeleteQuery[0].machineId);

    if (!socket) {
        return reply.code(404).send({
            message: "Device offline"
        });
    }

    if (socket.readyState !== 1) {
        request.devices.delete(dataToDeleteQuery[0].machineId);

        return reply.code(404).send({
            message: "Device offline"
        });
    }

    await request.db.query("DELETE FROM spacevpcs WHERE srn = ?", [vpcSrn]);

    socket.send(JSON.stringify({
        path: "delete-vpc",
        data:  
            [
                {
                    networkCode: dataToDeleteQuery[0].networkCode
                }
            ]
    }));

    reply.status(200).send({
        message: "VPC deleted with success."
    });
}

export async function DeleteRoute(request, reply) {
    const { vpcRouteSrn } = request.body;
    const [spaceVpcConfig] = await request.db.query("SELECT vpcroutes.network, vpcroutes.cidr, vpcroutes.nextHop, assets.machineId, spacevpcs.networkCode FROM vpcroutes INNER JOIN spacevpcs ON vpcroutes.vpcSrn = spacevpcs.srn INNER JOIN assets ON spacevpcs.assetSrn = assets.srn WHERE vpcroutes.srn = ?", [vpcRouteSrn]);
    if(spaceVpcConfig.length === 0){
        return reply.code(404).send({
            message: "Route not found"
        });
    }

    const socket = request.devices.get(spaceVpcConfig[0].machineId);

    if (!socket) {
        return reply.code(404).send({
            message: "Device offline"
        });
    }

    if (socket.readyState !== 1) {
        request.devices.delete(spaceVpcConfig[0].machineId);

        return reply.code(404).send({
            message: "Device offline"
        });
    }

    await request.db.query("DELETE FROM vpcroutes WHERE srn = ?", [vpcRouteSrn]);

    socket.send(JSON.stringify({
        path: "delete-route",
        data: {
            networkCode: spaceVpcConfig[0].networkCode,
            routes: [
                {
                    network: spaceVpcConfig[0].network,
                    cidr: spaceVpcConfig[0].cidr,
                    nextHop: spaceVpcConfig[0].nextHop
                }
            ]
        }
    }));

    reply.status(200).send({
        message: "Route created with success."
    });
}