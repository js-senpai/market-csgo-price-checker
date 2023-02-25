import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { PRODUCT_STATUS } from '../enums/mongo.enum';

export type TmHistoryDocument = HydratedDocument<TmHistory>;

@Schema({
  collection: 'tmHistory',
  versionKey: false,
  timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
})
export class TmHistory {
  @Prop({ required: true, type: Number })
  price: number;

  @Prop({
    required: true,
    type: String,
    validate: {
      validator: (value) => Object.values(PRODUCT_STATUS).includes(value),
      message: 'Status validation failed',
    },
    default: 'on_sale',
  })
  status: string;

  @Prop({ unique: true, required: true, type: Number })
  tmId: number;

  @Prop({ required: false, type: Number })
  asset: number;

  @Prop({ required: false, type: Number })
  classId: number;

  @Prop({ required: false, type: Number })
  instanceId: number;
}

export const TmHistorySchema = SchemaFactory.createForClass(TmHistory);
