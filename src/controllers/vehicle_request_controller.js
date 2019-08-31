import VehicleRequest from '../models/vehicle_request_model';
import Vehicle from '../models/vehicle_model';
import Assignment from '../models/assignment_model';

export const makeVehicleRequest = (req, res) => {
  const vehicleRequest = new VehicleRequest();
  vehicleRequest.requester = req.body.requester;
  vehicleRequest.requestDetails = req.body.requestDetails;
  vehicleRequest.mileage = req.body.mileage;
  vehicleRequest.noOfPeople = req.body.noOfPeople;
  vehicleRequest.requestType = req.body.requestType;
  vehicleRequest.requestedVehicles = req.body.requestedVehicles;
  vehicleRequest.save()
    .then((savedRequest) => {
      res.json(savedRequest);
      return;
    })
    .catch((error) => {
      res.status(500).send(error);
      console.log(error);
    });
};

export const getVehicleRequest = (req, res) => {
  VehicleRequest.findById(req.params.id).populate('requester').populate('associatedTrip').populate('assignments').populate({
    path: 'requester',
    populate: {
      path: 'leader_for',
      model: 'Club',
    },
  }).populate({
    path: 'assignments',
    populate: {
      path: 'assigned_vehicle',
      model: 'Vehicle',
    },
  }).exec()
    .then((vehicleRequest) => {
      res.json(vehicleRequest);
    })
    .catch((error) => {
      res.status(500).send(error);
      console.log(error);
    });
}

export const getVehicleRequests = (req, res) => {
  VehicleRequest.find().populate('requester').populate('associatedTrip')
    .then((vehicleRequests) => {
      res.json(vehicleRequests);
    })
    .catch((error) => {
      res.status(500).send(error);
      console.log(error);
    });
}

export const updateVehicleRequest = (req, res) => {
  VehicleRequest.findById(req.params.id).populate('requester').populate('associatedTrip')
    .then((vehicleRequest) => {
      if (vehicleRequest.status !== 'pending') {
        res.status(400).send('Only pending requests can be updated');
        return;
      } else {
        vehicleRequest.requester = req.body.requester;
        vehicleRequest.requestDetails = req.body.requestDetails;
        vehicleRequest.requestType = req.body.requestType;
        vehicleRequest.requestedVehicles = req.body.requestedVehicles;
        vehicleRequest.save()
          .then((savedRequest) => {
            return res.json(savedRequest);
          })
          .catch((error) => {
            res.status(500).send(error);
            console.log(error);
          });
      }
    });
}

export const respondToVehicleRequest = async (req, res) => {
  try {
    const vehicleRequest = await VehicleRequest.findById(req.params.id).exec();
    const proposedAssignments = req.body.assignments;
    const processedAssignments = await getArrayofProcessedAssignments(proposedAssignments, vehicleRequest);

    const validAssignments = processedAssignments.filter((assignment) => {
      return !assignment.error;
    });
    const invalidAssignments = processedAssignments.filter((assignment) => {
      return assignment.error;
    });
    vehicleRequest.assignments = validAssignments;
    vehicleRequest.status = 'approved';
    await vehicleRequest.save();
    const updatedVehicleRequest = await VehicleRequest.findById(req.params.id).populate('requester').populate('associatedTrip').populate('assignments').populate({
      path: 'requester',
      populate: {
        path: 'leader_for',
        model: 'Club',
      },
    }).populate({
      path: 'assignments',
      populate: {
        path: 'assigned_vehicle',
        model: 'Vehicle',
      },
    }).exec();
    const output = (invalidAssignments.length === 0) ? { updatedVehicleRequest } : { updatedVehicleRequest, invalidAssignments };
    return res.json(output);
  } catch (error) {
    console.log(error);
    return res.status(500).send(error);
  }
}

const getArrayofProcessedAssignments = async (proposedAssignments, vehicleRequest) => {
  return await Promise.all(proposedAssignments.map(async (assignment) => {
    return await processAssignment(vehicleRequest, assignment);
  }));
}

const processAssignment = async (vehicleRequest, assignment) => {
  try {
    const pickupDate = new Date(assignment.pickupDate);
    const pickupTime = assignment.pickupTime.split(':');
    pickupDate.setHours(pickupTime[0], pickupTime[1]);
    const returnDate = new Date(assignment.returnDate);
    const returnTime = assignment.returnTime.split(':');
    returnDate.setHours(returnTime[0], returnTime[1]);
    if (returnDate < pickupDate) {
      return {
        error: 'Pickup date must be earlier than return date',
        assignment,
      };
    }
    const vehicleInArray = await Vehicle.find({ name: assignment.assignedVehicle }).populate('bookings').exec();
    const vehicle = vehicleInArray[0];
    let selectedVehicleBookings;
    let existingAssignment;

    if (assignment.existingAssignment) {
      existingAssignment = await Assignment.findById(assignment.id).populate('assigned_vehicle').exec();
      if (existingAssignment.assigned_vehicle.name === assignment.assignedVehicle) { // vehicle was not changed
        selectedVehicleBookings = vehicle.bookings.filter((booking) => { // remove modified assignment to avoid conflicting with self when checking for validity
          return booking.id !== assignment.id;
        });
      } else { // vehicle was changed
        selectedVehicleBookings = vehicle.bookings; // no need to remove because assignment does not exist in new assigned vehicle
      }
    } else { // is new response
      selectedVehicleBookings = vehicle.bookings;
    }
  
    const conflictingEvents = selectedVehicleBookings.filter(booking => {
      return isConflicting(booking, assignment);
    });

    if (conflictingEvents.length > 0) {
      return {
        error: 'Proposed assignment conflicts with already existing one',
        conflictingEvents,
        assignment,
      };
    } else {
      if (assignment.existingAssignment) {
        existingAssignment.assigned_pickupDate = assignment.pickupDate;
        existingAssignment.assigned_pickupTime = assignment.pickupTime;
        existingAssignment.assigned_returnDate = assignment.returnDate;
        existingAssignment.assigned_returnTime = assignment.returnTime;
        existingAssignment.assigned_key = assignment.assignedKey;
        existingAssignment.pickedUp = assignment.pickedUp;
        existingAssignment.returned = assignment.returned
        existingAssignment.assigned_vehicle = vehicle;
        const updatedAssignment = await existingAssignment.save();
        if (existingAssignment.assigned_vehicle.name !== assignment.assignedVehicle) {
          vehicle.bookings.push(updatedAssignment);
          await vehicle.save();
          await Vehicle.updateOne({ _id: existingAssignment.assigned_vehicle._id }, { $pull: { bookings:  existingAssignment._id} }); // remove assignment from previously assigned vehicle          
        }
        return updatedAssignment;
      } else {
        const newAssignment = new Assignment();
        newAssignment.request = vehicleRequest;
        newAssignment.requester = vehicleRequest.requester;
        newAssignment.responseIndex = assignment.responseIndex;
        newAssignment.assigned_pickupDate = assignment.pickupDate;
        newAssignment.assigned_pickupTime = assignment.pickupTime;
        newAssignment.assigned_returnDate = assignment.returnDate;
        newAssignment.assigned_returnTime = assignment.returnTime;
        newAssignment.assigned_key = assignment.assignedKey;
        newAssignment.assigned_vehicle = vehicle;
        const savedAssignment = await newAssignment.save();
        vehicle.bookings.push(savedAssignment);
        await vehicle.save();
        return savedAssignment;
      }   
    }
  } catch (error) {
    console.log(error);
    res.status(500).send(error);
  }
}

const isConflicting = (booking, assignment) => {
  const existingPickupDateAndTime = createDateObject(booking.assigned_pickupDate, booking.assigned_pickupTime);
  const existingReturnDateAndTime = createDateObject(booking.assigned_returnDate, booking.assigned_returnTime);

  const proposedPickupDateAndTime = createDateObject(assignment.pickupDate, assignment.pickupTime);
  const proposedReturnDateAndTime = createDateObject(assignment.returnDate, assignment.returnTime);

  return (proposedReturnDateAndTime >= existingPickupDateAndTime) || (proposedPickupDateAndTime <= existingReturnDateAndTime);
}

const createDateObject = (date, time) => {
  const dateObject = new Date(date);
  const splitTime = time.split(':');
  dateObject.setHours(splitTime[0], splitTime[1]);
  return dateObject;
}
