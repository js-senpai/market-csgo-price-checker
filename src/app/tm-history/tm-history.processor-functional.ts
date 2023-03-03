import TmHistoryQueueService from './tm-history.queue-service';
import { TmHistoryLWCachedContext } from '../tm-history-lightweight/tm-history-lightweight.context';

const TmHistoryProcessorFunctional = async (job): Promise<{ ok: string }> => {
  const context = await TmHistoryLWCachedContext();
  const service = context.get(TmHistoryQueueService);
  return await service.start(job);
};
export default TmHistoryProcessorFunctional;
