import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { PRODUCT_STATUS } from '../constants/mongo.constants';
import { HydratedDocument } from 'mongoose';

export type TmHistoryDocument = HydratedDocument<TmHistory>;

@Schema({
  collection: 'tmHistory',
  versionKey: false,
  timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
})
export class TmHistory {
  price: number;

  @Prop({
    required: true,
    type: String,
    validate: {
      validator: (value) => PRODUCT_STATUS.includes(value),
      message: 'Status validation failed',
    },
    default: 'on_sale',
  })
  status: string;
}

export const TmHistorySchema = SchemaFactory.createForClass(TmHistory);
