import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { MarketHashName } from './market-hash-name.schema';

export type TmHistoryDocument = HydratedDocument<TmHistory>;

@Schema({
  collection: 'tmHistory',
  versionKey: false,
  timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
})
export class TmHistory {
  @Prop({ required: true, type: Number })
  price: number;

  @Prop({ unique: true, required: true, type: Number })
  id: number;

  @Prop({ required: true, type: Number })
  tmId: number;

  @Prop({ required: false, type: Number })
  asset: number;

  @Prop({ required: false, type: Number })
  classId: number;

  @Prop({ required: false, type: Number })
  instanceId: number;

  @Prop({ type: Types.ObjectId, ref: 'MarketHashName', required: true })
  parent: MarketHashName;
}

export const TmHistorySchema = SchemaFactory.createForClass(TmHistory);
