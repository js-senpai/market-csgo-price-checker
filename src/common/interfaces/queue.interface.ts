export interface IResponseCompletedJob {
  totalOnSale: number;
  totalNotFound: number;
  listName: string;
}

export interface IResponseErrorJob {
  error: any;
  listName: string;
}
