import { Schema, model } from 'mongoose';

const addressSchema = new Schema({
  street: { type: String, required: true },
  city: { type: String, required: true },
  postalCode: { type: String, required: true },
  country: { type: String, required: true },
});

// Create the Address model
const Address = model('Address', addressSchema);

export default Address;