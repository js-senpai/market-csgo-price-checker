import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { TmHistory } from './tm-history.schema';
import { TmOnSale } from './tm-on-sale.schema';
import * as paginate from 'mongoose-paginate-v2';
import { PRODUCT_STATUS } from '../enums/mongo.enum';
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

  @Prop({ type: [{ type: Types.ObjectId, ref: 'TmHistory' }], default: [] })
  priceHistory: TmHistory[];

  @Prop({ type: [{ type: Types.ObjectId, ref: 'TmOnSale' }], default: [] })
  priceInfo: TmOnSale[];

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

export const MarketHashNameSchema =
  SchemaFactory.createForClass(MarketHashName);

MarketHashNameSchema.plugin(paginate);
