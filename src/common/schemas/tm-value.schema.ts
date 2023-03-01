import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { MarketHashName } from './market-hash-name.schema';

export type TmValueDocument = HydratedDocument<TmValue>;

@Schema({
  collection: 'tmValue',
  versionKey: false,
  timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
})
export class TmValue {
  @Prop({ required: true, type: Number, default: 1 })
  value: number;

  @Prop({ type: Types.ObjectId, ref: 'MarketHashName', required: true })
  parent: MarketHashName;
}

export const TmValueSchema = SchemaFactory.createForClass(TmValue);
