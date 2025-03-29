import { Schema, model } from 'mongoose';

const addressSchema = new Schema({
  addressLine1: { type: String, default: null },
  addressLine2: { type: String, default: null },
  city: { type: String, default: null },
  state: { type: String, default: null },
  district: { type: String, default: null },
  pincode: { type: String, default: null },
});

// Create the Address model
const Address = model('Address', addressSchema);

export {Address, addressSchema};