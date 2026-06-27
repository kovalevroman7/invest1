export interface Bond {
  secid: string;
  shortName: string;
  isin: string;
  /** Тип облигации: ОФЗ-ПД, ОФЗ-ПК, Корпоративная, Биржевая и т.д. */
  type: string;
  /** Кредитный рейтинг эмитента (нац. шкала, ручной справочник) или `null`. */
  creditRating: string | null;
  faceValue: number | null;
  /** Цена в рублях = цена в % от номинала × номинал / 100. */
  priceRub: number | null;
  /** Изменение цены за день в % (последняя сделка к закрытию предыдущего дня). */
  dayChangePercent: number | null;
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
