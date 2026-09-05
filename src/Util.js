export async function generateValidSrn(request, prefix, table){
    const genericSRN = "srn:" + prefix + ":" + crypto.randomInt(0, 1e12).toString().padStart(12, "0");

    const [genericRows] = await request.server.db.query(
        "SELECT srn FROM " + table + " WHERE srn = ?",
        [genericSRN]
    );

    if(genericRows.length > 0){
        return generateValidSrn(request, prefix, table);
    }

    return genericSRN;
}

export function isSubnetConflict(network, cidr, existingRoutes) {
    const newNetwork = ipToInt(network);
    const newMask = cidrToMask(cidr);

    const newStart = newNetwork & newMask;
    const newEnd = newStart + (~newMask >>> 0);

    for (const route of existingRoutes) {
        const existingNetwork = ipToInt(route.network);
        const existingMask = cidrToMask(route.cidr);

        const existingStart = existingNetwork & existingMask;
        const existingEnd = existingStart + (~existingMask >>> 0);

        if (newStart <= existingEnd && newEnd >= existingStart) {
            return true;
        }
    }

    return false;
}

function ipToInt(ip) {
    const parts = ip.split(".").map(Number);

    if (parts.length !== 4 || parts.some(part => !Number.isInteger(part) || part < 0 || part > 255)) {
        throw new Error("Invalid IPv4 address");
    }

    return (
        ((parts[0] << 24) >>> 0) |
        ((parts[1] << 16) >>> 0) |
        ((parts[2] << 8) >>> 0) |
        (parts[3] >>> 0)
    ) >>> 0;
}

function cidrToMask(cidr) {
    if (!Number.isInteger(cidr) || cidr < 0 || cidr > 32) {
        throw new Error("Invalid CIDR");
    }

    if (cidr === 0) {
        return 0;
    }

    return (0xFFFFFFFF << (32 - cidr)) >>> 0;
}