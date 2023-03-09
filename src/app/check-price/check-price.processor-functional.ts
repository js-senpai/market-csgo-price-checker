import { CheckPriceLWCachedContext } from '../check-price-lightweight/check-price-lightweight.context';
import CheckPriceQueueService from './check-price.queue-service';

const CheckPriceProcessorFunctional = async (job): Promise<{ ok: string }> => {
  const context = await CheckPriceLWCachedContext();
  const service = context.get(CheckPriceQueueService);
  return await service.start(job);
};
export default CheckPriceProcessorFunctional;
