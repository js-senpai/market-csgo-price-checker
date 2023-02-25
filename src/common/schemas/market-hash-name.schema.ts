import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { TmHistory } from './tm-history.schema';
import { TmOnSale } from './tm-on-sale.schema';
import * as paginate from 'mongoose-paginate-v2';
export type MarketHashNameDocument = HydratedDocument<MarketHashName>;

@Schema({
  collection: 'marketHashNames',
  versionKey: false,
  timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
})
export class MarketHashName {
  @Prop({ unique: true, required: true, type: String })
  name: string;

  @Prop({ required: true, type: Number, default: 1 })
  value: number;

  @Prop({ type: Types.ObjectId, ref: 'TmHistory', default: null })
  priceHistory: TmHistory;

  @Prop({ type: Types.ObjectId, ref: 'TmOnSale', default: null })
  priceInfo: TmOnSale;
}

export const MarketHashNameSchema =
  SchemaFactory.createForClass(MarketHashName);

MarketHashNameSchema.plugin(paginate);
