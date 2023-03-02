import { TmHistoryService } from './tm-history.service';
import { ApplicationContext } from '../../app.context';

const TmHistoryProcessor = async (job): Promise<{ ok: string }> => {
  const context = await ApplicationContext();
  const service = context.get(TmHistoryService);
  return await service.startParser(job);
};
export default TmHistoryProcessor;
