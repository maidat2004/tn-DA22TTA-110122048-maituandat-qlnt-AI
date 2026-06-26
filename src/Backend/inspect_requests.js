import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Request from './models/Request.js';
import Tenant from './models/Tenant.js';
import Room from './models/Room.js';
import connectDB from './config/database.js';

dotenv.config();

const inspect = async () => {
  try {
    await connectDB();
    console.log('--- REQUESTS ---');
    const requests = await Request.find({}).populate('tenant').populate('room');
    requests.forEach(r => {
      console.log(`Request ID: ${r._id}`);
      console.log(`Title: ${r.title}`);
      console.log(`Type: ${r.type} | Status: ${r.status}`);
      console.log(`Tenant: ${r.tenant?.fullName || 'N/A'} (ID: ${r.tenant?._id})`);
      console.log(`Room: ${r.room?.roomNumber || 'N/A'} (ID: ${r.room?._id})`);
      console.log(`Description: ${r.description}`);
      console.log('------------------------------------');
    });

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
};

inspect();
