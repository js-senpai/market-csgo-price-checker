import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { PRODUCT_STATUS } from '../constants/mongo.constants';
import { HydratedDocument } from 'mongoose';

export type TmOnSaleDocument = HydratedDocument<TmOnSale>;

@Schema({
  collection: 'tmOnSale',
  versionKey: false,
  timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
})
export class TmOnSale {
  @Prop({ unique: true, required: true, type: Number })
  tmId: number;

  @Prop({ required: true, type: Number })
  asset: number;

  @Prop({ required: true, type: Number })
  classId: number;

  @Prop({ required: true, type: Number })
  instanceId: number;

  @Prop({ required: true, type: Number })
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

export const TmOnSaleSchema = SchemaFactory.createForClass(TmOnSale);
