import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { MarketHashName } from './market-hash-name.schema';
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

  @Prop({ required: true, type: Number, index: true })
  id: number;

  @Prop({ required: false, type: Number })
  tmId: number;

  @Prop({ required: false, type: Number })
  asset: number;

  @Prop({ required: false, type: Number })
  classId: number;

  @Prop({ required: false, type: Number })
  instanceId: number;

  @Prop({
    type: Types.ObjectId,
    ref: 'MarketHashName',
    required: true,
    index: true,
  })
  parent: MarketHashName;

  @Prop({
    index: true,
    required: true,
    type: String,
    validate: {
      validator: (value) => Object.values(PRODUCT_STATUS).includes(value),
      message: 'Status validation failed',
    },
    default: 'on_sale',
  })
  status: string;
}

export const TmHistorySchema = SchemaFactory.createForClass(TmHistory);
