export async function GenerateSpaceVPCConfigs(dbConnection, socket, deviceSrn, localip){
    const [spaceVpcs] = await dbConnection.query("SELECT srn, ip, networkCode FROM spacevpcs WHERE assetSrn = ?", [deviceSrn]);

    if(spaceVpcs.length === 0){
        return;
    }

    for (const spaceVpc of spaceVpcs) {
        const [vpcsRoutes] = await dbConnection.query("SELECT network, cidr, nextHop FROM vpcroutes WHERE vpcSrn = ?", [spaceVpc.srn]);
        spaceVpc['routes'] = vpcsRoutes;
    }

    socket.send(JSON.stringify({
        path: "create-vpc",
        data: {
            localip,
            spaceVpcs
        }
    }));
}