MRP_SERVER = null;

emit('mrp:getSharedObject', obj => MRP_SERVER = obj);

while (MRP_SERVER == null) {
    print('Waiting for shared object....');
}

on('onResourceStart', (resource) => {
    let resName = GetCurrentResourceName();
    if (resName != resource)
        return;

    //update all OUT locations to impound
    MRP_SERVER.update('vehicle', {
        location: "impound_1"
    }, {
        location: "OUT"
    }, {
        multi: true
    }, () => {
        console.log('Vehicles impounded!');
    });
});

onNet('mrp:parking:getCarsAtLocation', (source, locationId, ownerId, uuid) => {
    let query = {
        location: locationId,
        owner: ownerId
    };

    let options = {
        sort: {
            plate: -1
        },
        projection: {
            _id: 0,
            plate: 1,
            location: 1,
            model: 1
        }
    };

    MRP_SERVER.find('vehicle', query, options, undefined, (result) => {
        emitNet('mrp:parking:getCarsAtLocation:response', source, result, uuid);
    });
});

onNet('mrp:parking:takeoutVehicle', (source, plate, uuid) => {
    plate = plate.trim();
    let query = {
        plate: plate
    };

    MRP_SERVER.read('vehicle', query, (vehicle) => {
        MRP_SERVER.update('vehicle', {
            location: "OUT"
        }, {
            plate: plate
        }, () => {
            console.log('Vehicle updated!');
        });
        emitNet('mrp:parking:takeoutVehicle:response', source, vehicle, uuid);
    });
});