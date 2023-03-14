import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { TmHistory } from './tm-history.schema';
import { TmOnSale } from './tm-on-sale.schema';
import * as paginate from 'mongoose-paginate-v2';
import { ItemValue } from './item-value.schema';

export type MarketHashNameDocument = HydratedDocument<MarketHashName>;

@Schema({
  collection: 'marketHashNames',
  versionKey: false,
  timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
})
export class MarketHashName {
  @Prop({ unique: true, required: true, type: String, index: true })
  name: string;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'ItemValue' }], default: [] })
  priceValues: ItemValue[];

  @Prop({ type: [{ type: Types.ObjectId, ref: 'TmHistory' }], default: [] })
  priceHistory: TmHistory[];

  @Prop({ type: [{ type: Types.ObjectId, ref: 'TmOnSale' }], default: [] })
  priceInfo: TmOnSale[];
}

export const MarketHashNameSchema =
  SchemaFactory.createForClass(MarketHashName);

MarketHashNameSchema.plugin(paginate);
