import { HydratedDocument } from 'mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

export type CheckPriceLogDocument = HydratedDocument<CheckPriceLog>;

@Schema({
  collection: 'checkPriceLog',
  versionKey: false,
  timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
})
export class CheckPriceLog {
  @Prop({ unique: true, required: true, type: String, index: true })
  jobId: string;

  @Prop({ required: true, type: String, default: 1 })
  queueNumber: number;

  @Prop({ required: false, type: String })
  name: string;

  @Prop({ required: true, type: String })
  status: string;

  @Prop({ required: false, type: String })
  message: string;

  @Prop({ type: Boolean, default: true, index: true })
  available: boolean;

  @Prop({ required: false, type: Number, default: 0 })
  progress: number;
}

export const CheckPriceLogSchema = SchemaFactory.createForClass(CheckPriceLog);
