import TmOnSaleQueueService from './tm-on-sale.queue-service';
import { TmOnSaleLWCachedContext } from '../tm-on-sale-lightweight/tm-on-sale-lightweight.context';

const TmOnSaleProcessorFunctional = async (job): Promise<{ ok: string }> => {
  const context = await TmOnSaleLWCachedContext();
  const service = context.get(TmOnSaleQueueService);
  return await service.start(job);
};
export default TmOnSaleProcessorFunctional;
