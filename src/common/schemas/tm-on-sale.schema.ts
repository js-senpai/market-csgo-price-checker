import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { MarketHashName } from './market-hash-name.schema';
import { PRODUCT_STATUS } from '../enums/mongo.enum';

export type TmOnSaleDocument = HydratedDocument<TmOnSale>;

@Schema({
  collection: 'tmOnSale',
  versionKey: false,
  timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
})
export class TmOnSale {
  @Prop({ required: true, type: Number, index: true })
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
    type: Types.ObjectId,
    ref: 'MarketHashName',
    required: true,
    index: true,
  })
  parent: MarketHashName;

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
}

export const TmOnSaleSchema = SchemaFactory.createForClass(TmOnSale);
