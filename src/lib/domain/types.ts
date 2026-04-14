export type PriceRecordWithRelations = {
  id: number;
  productId: number;
  marketId: number;
  price: number;
  freight: number;
  totalPrice: number;
  collectedAt: Date;
  productName: string;
  category: string;
  unit: string;
  marketName: string;
  city: string;
  state: string;
  channel: string;
};

export type MarketFactorItem = {
  id: number;
  productId: number;
  marketId: number;
  title: string;
  description: string;
  direction: string;
  intensity: number;
  collectedAt: Date;
  marketName: string;
  city: string;
};
