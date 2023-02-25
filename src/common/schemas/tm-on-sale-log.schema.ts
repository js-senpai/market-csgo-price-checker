import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type TmOnSaleLogDocument = HydratedDocument<TmOnSaleLog>;

@Schema({
  collection: 'tmOnSaleLog',
  versionKey: false,
  timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
})
export class TmOnSaleLog {
  @Prop({ unique: true, required: true, type: String })
  jobId: string;

  @Prop({ required: true, type: String })
  name: string;

  @Prop({ required: true, type: String })
  status: string;

  @Prop({ required: false, type: String })
  message: string;

  @Prop({ type: Boolean, default: true })
  available: boolean;

  @Prop({ required: false, type: Number, default: 0 })
  progress: number;
}

export const TmOnSaleLogSchema = SchemaFactory.createForClass(TmOnSaleLog);
