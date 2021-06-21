MRP_CLIENT = null;

emit('mrp:vehicle:getSharedObject', obj => MRP_CLIENT = obj);

while (MRP_CLIENT == null) {
    print('Waiting for shared object....');
}

configFile = LoadResourceFile(GetCurrentResourceName(), 'config/client.json');

eval(LoadResourceFile('mrp_core', 'client/helpers.js'));

config = JSON.parse(configFile);

let blips = config.blips;
for (let info of blips) {
    info.blip = AddBlipForCoord(info.x, info.y, info.z);
    SetBlipSprite(info.blip, info.blipId);
    SetBlipDisplay(info.blip, 4);
    SetBlipScale(info.blip, 1.0);
    SetBlipColour(info.blip, info.color);
    SetBlipAsShortRange(info.blip, true);
    BeginTextCommandSetBlipName("STRING");
    AddTextComponentString(info.title);
    EndTextCommandSetBlipName(info.blip);
}

let currentlyAtBlip = null;

let buildMenu = (blip) => {
    emit('mrp:radial_menu:removeMenuItem', {
        id: 'park'
    });
    let char = MRP_CLIENT.GetPlayerData();
    MRP_CLIENT.TriggerServerCallback('mrp:parking:getCarsAtLocation', [blip.id, char._id], (cars) => {
        let submenu;
        if (cars && cars.length > 0) {
            submenu = [];
            submenu.push({
                id: 'PARK_VEHICLE',
                text: "Park current vehicle",
                action: 'https://mrp_parking/park'
            });
            for (let car of cars) {
                let displayName = GetDisplayNameFromVehicleModel(car.model);
                displayName = GetLabelText(displayName);
                submenu.push({
                    id: car.plate.replaceAll(" ", "_"), //replace spaces for underscore
                    text: displayName + " [" + car.plate + "]",
                    action: 'https://mrp_parking/takeOut'
                });
            }
        }
        emit('mrp:radial_menu:addMenuItem', {
            id: 'park',
            text: config.locale.park,
            submenu: submenu,
            action: 'https://mrp_parking/park'
        });
    });
};

setInterval(() => {
    let ped = PlayerPedId();
    if (!ped)
        return;

    let [pX, pY, pZ] = GetEntityCoords(ped);
    let foundBlip = null;
    for (let info of blips) {
        if (!info.blip)
            continue;

        let [blipX, blipY, blipZ] = GetBlipCoords(info.blip);
        let distanceFromBlip = Vdist(pX, pY, pZ, blipX, blipY, blipZ);
        let valetCfg = config[info.id];
        valetCfg.id = info.id;
        RequestModel(valetCfg.model);
        if (valetCfg.area >= distanceFromBlip) {
            foundBlip = valetCfg;
        }
    }

    if (currentlyAtBlip == null && foundBlip != null) {
        //entered blip add menu
        buildMenu(foundBlip);
    } else if (currentlyAtBlip != null && foundBlip == null) {
        //leaving blip remove menu
        emit('mrp:radial_menu:removeMenuItem', {
            id: 'park'
        });
    }
    currentlyAtBlip = foundBlip;
}, 500);

let getNearestVehicle = (ped, area) => {
    return new Promise((resolve) => {
        MRP_CLIENT.findNearestAccessibleVehicle(ped, 30, false, (veh) => {
            resolve(veh);
        });
    });
};

onNet('mrp:vehicle:saved', () => {
    if (currentlyAtBlip) {
        console.log("updating radial menu");
        buildMenu(currentlyAtBlip);
    }
});

on('mrp:parking:takeOut', (data) => {
    //TODO take out vehicle
    MRP_CLIENT.TriggerServerCallback('mrp:parking:takeoutVehicle', [data.id], (vehicle) => {
        if (!vehicle)
            return;

        if (!currentlyAtBlip)
            return;

        let exec = async () => {
            RequestModel(vehicle.model);
            while (currentlyAtBlip && !HasModelLoaded(vehicle.model)) {
                await utils.sleep(100);
            }

            let spawnedVehicle = CreateVehicle(vehicle.model,
                currentlyAtBlip.parkAt.x,
                currentlyAtBlip.parkAt.y,
                currentlyAtBlip.parkAt.z,
                currentlyAtBlip.parkAt.heading,
                true,
                true);

            //apply modification and look
            MRP_CLIENT.setVehicleProperties(spawnedVehicle, vehicle);
            //apply damage
            emit('mrp:vehicle:applyVehicleDamage', spawnedVehicle, vehicle);

            buildMenu(currentlyAtBlip);
        };
        exec();
    });
});

RegisterNuiCallbackType('park');
on('__cfx_nui:park', (data, cb) => {
    if (currentlyAtBlip == null)
        return;

    console.log("parking...");
    let exec = async () => {
        let ped = PlayerPedId();
        let nearestVehicle = await getNearestVehicle(ped, config.nearestVehicleArea);
        if (!nearestVehicle || !nearestVehicle.vehicle)
            return;

        console.log(`parking [${GetVehicleNumberPlateText(nearestVehicle.vehicle).trim()}]`);

        let vehicleProperties = MRP_CLIENT.getVehicleProperties(nearestVehicle.vehicle);
        console.log(`parking livery = ${vehicleProperties.modLivery}`);
        let char = MRP_CLIENT.GetPlayerData();
        vehicleProperties.owner = char._id;
        vehicleProperties.location = currentlyAtBlip.id;
        let source = GetPlayerServerId(PlayerId());
        console.log("saving...");
        emitNet('mrp:vehicle:save', source, vehicleProperties);
        DeleteEntity(nearestVehicle.vehicle);
    };

    exec();

    cb({});
});

RegisterNuiCallbackType('takeOut');
on('__cfx_nui:takeOut', (data, cb) => {
    if (currentlyAtBlip == null)
        return;

    data.id = data.id.replaceAll("_", " "); // replace underscores for spaces back

    emit("mrp:parking:takeOut", data);

    cb({});
});