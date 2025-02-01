import { Schema, model } from 'mongoose';
import genericSchema from './generic.js';

const holidaySchema = new Schema({
  name: {
    type: String,
    required: [true, 'Event name is required.'],
  },
  date: {
    type: Date,
    required: [true, 'Event\'s date is required.'],
  },
  holidayType: {
    type: String,
    enum: ['Public', 'Festival', 'Government'],
    required: [true, 'Event type is required.'],
  },
  orgId: {
    type: String,
    default: '',
  }
});

holidaySchema.add(genericSchema);
const Holiday = model('holiday', holidaySchema);
export {Holiday, holidaySchema};
