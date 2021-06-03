MRP_SERVER = null;

emit('mrp:getSharedObject', obj => MRP_SERVER = obj);

while (MRP_SERVER == null) {
    print('Waiting for shared object....');
}

onNet('mrp:parking:getCarsAtLocation', (source, locationId, ownerId) => {
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

    MRP_SERVER.find('vehicle', query, options, (result) => {
        emitNet('mrp:parking:getCarsAtLocation:response', source, result);
    });
});

onNet('mrp:parking:takeoutVehicle', (source, plate) => {
    plate = plate.trim();
    let query = {
        plate: plate
    };

    MRP_SERVER.read('vehicle', query, (vehicle) => {
        MRP_SERVER.update('vehicle', {
            location: "OUT"
        }, () => {
            exports["mrp_core"].log('Vehicle updated!');
        }, {
            plate: plate
        });
        emitNet('mrp:parking:takeoutVehicle:response', source, vehicle);
    });
});