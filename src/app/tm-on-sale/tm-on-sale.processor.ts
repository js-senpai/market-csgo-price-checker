import { TmOnSaleService } from './tm-on-sale.service';
import { ApplicationContext } from '../../app.context';

const TmOnSaleProcessor = async (job): Promise<{ ok: string }> => {
  const context = await ApplicationContext();
  const service = context.get(TmOnSaleService);
  return await service.startParser(job);
};
export default TmOnSaleProcessor;
