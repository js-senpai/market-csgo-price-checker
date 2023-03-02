import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { MarketHashName } from './market-hash-name.schema';

export type ItemValueDocument = HydratedDocument<ItemValue>;

@Schema({
  collection: 'itemValue',
  versionKey: false,
  timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
})
export class ItemValue {
  @Prop({ required: true, type: Number, default: 1 })
  value: number;

  @Prop({
    type: Types.ObjectId,
    ref: 'MarketHashName',
    required: true,
    index: true,
  })
  parent: MarketHashName;
}

export const ItemValueSchema = SchemaFactory.createForClass(ItemValue);
