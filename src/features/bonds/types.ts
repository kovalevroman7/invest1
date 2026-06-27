export interface Bond {
  secid: string;
  shortName: string;
  isin: string;
  /** Тип облигации: ОФЗ-ПД, ОФЗ-ПК, Корпоративная, Биржевая и т.д. */
  type: string;
  faceValue: number | null;
  /** Цена в рублях = цена в % от номинала × номинал / 100. */
  priceRub: number | null;
  couponPercent: number | null;
  couponValue: number | null;
  matDate: string;
  /** Лет до погашения (может быть отрицательным/`null` для бессрочных и без даты). */
  yearsToMaturity: number | null;
  currency: string;
}

type MoexBlock = {
  columns: string[];
  data: (string | number | null)[][];
};

/** Сырой колоночный ответ MOEX ISS: блоки `securities` и `marketdata`. */
export interface MoexSecuritiesResponse {
  securities: MoexBlock;
  marketdata: MoexBlock;
}
