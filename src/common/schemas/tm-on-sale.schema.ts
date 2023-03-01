import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { MarketHashName } from './market-hash-name.schema';

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

  @Prop({ type: Types.ObjectId, ref: 'MarketHashName', required: true })
  parent: MarketHashName;
}

export const TmOnSaleSchema = SchemaFactory.createForClass(TmOnSale);
