import { moexApi } from '@/shared/api/moexApi';

import type { Bond, MoexSecuritiesResponse } from './types';

const BOND_COLUMNS = 'SECID,SHORTNAME,ISIN,SECTYPE,FACEVALUE,COUPONPERCENT,COUPONVALUE,MATDATE,CURRENCYID';

const MS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000;

// Метки типов по коду MOEX SECTYPE (кроме гособлигаций — см. getBondType).
const SECTYPE_LABELS: Record<string, string> = {
  '4': 'Субфедеральная',
  '6': 'Корпоративная',
  '8': 'Биржевая',
  C: 'Муниципальная',
};

// Подтип ОФЗ определяется серией в SECID (SU<серия>...).
const OFZ_SERIES_LABELS: Record<string, string> = {
  '24': 'ОФЗ-ПК',
  '26': 'ОФЗ-ПД',
  '29': 'ОФЗ-ПК',
  '46': 'ОФЗ-АД',
  '48': 'ОФЗ-АД',
  '52': 'ОФЗ-ИН',
  '53': 'ОФЗ-н',
};

const toNumber = (value: string | number | null): number | null => (typeof value === 'number' ? value : null);

const toString = (value: string | number | null): string => (value === null ? '' : String(value));

/** Определить тип облигации по SECTYPE из MOEX и серии SECID (для ОФЗ). */
const getBondType = (secid: string, sectype: string): string => {
  if (sectype === '3') {
    if (secid.startsWith('SU')) {
      return OFZ_SERIES_LABELS[secid.slice(2, 4)] ?? 'ОФЗ';
    }
    return 'ОФЗ';
  }
  return SECTYPE_LABELS[sectype] ?? 'Прочая';
};

/** Количество лет до погашения; `null`, если дата не задана (бессрочные и т.п.). */
const getYearsToMaturity = (matDate: string): number | null => {
  const ms = Date.parse(matDate);
  if (Number.isNaN(ms)) {
    return null;
  }
  return Math.round(((ms - Date.now()) / MS_PER_YEAR) * 10) / 10;
};

const bondsApi = moexApi.injectEndpoints({
  endpoints: (builder) => ({
    /**
     * Получить список облигаций фондового рынка MOEX (все доски).
     *
     * Ответ MOEX приходит в колоночном виде (`columns` + `data`); приводим его к
     * массиву объектов `Bond` и убираем дубли `secid` (одна бумага торгуется на
     * нескольких досках).
     */
    getBonds: builder.query<Bond[], void>({
      query: () => ({
        url: 'engines/stock/markets/bonds/securities.json',
        method: 'GET',
        params: {
          'iss.meta': 'off',
          'iss.only': 'securities,marketdata',
          'securities.columns': BOND_COLUMNS,
          'marketdata.columns': 'SECID,LAST,MARKETPRICE,LCLOSEPRICE',
        },
      }),
      transformResponse: (response: MoexSecuritiesResponse): Bond[] => {
        // Карта SECID → цена в % от номинала (из marketdata): LAST, иначе MARKETPRICE/LCLOSEPRICE.
        const md = response.marketdata;
        const mdIdxSecid = md.columns.indexOf('SECID');
        const mdIdxLast = md.columns.indexOf('LAST');
        const mdIdxMarket = md.columns.indexOf('MARKETPRICE');
        const mdIdxClose = md.columns.indexOf('LCLOSEPRICE');

        const pricePercentBySecid = new Map<string, number>();
        for (const row of md.data) {
          const secid = toString(row[mdIdxSecid]);
          if (!secid || pricePercentBySecid.has(secid)) {
            continue;
          }
          const price = toNumber(row[mdIdxLast]) ?? toNumber(row[mdIdxMarket]) ?? toNumber(row[mdIdxClose]);
          if (price !== null) {
            pricePercentBySecid.set(secid, price);
          }
        }

        const { columns, data } = response.securities;
        const index = (name: string): number => columns.indexOf(name);

        const idxSecid = index('SECID');
        const idxShortName = index('SHORTNAME');
        const idxIsin = index('ISIN');
        const idxSecType = index('SECTYPE');
        const idxFaceValue = index('FACEVALUE');
        const idxCouponPercent = index('COUPONPERCENT');
        const idxCouponValue = index('COUPONVALUE');
        const idxMatDate = index('MATDATE');
        const idxCurrency = index('CURRENCYID');

        const seen = new Set<string>();
        const bonds: Bond[] = [];

        for (const row of data) {
          const secid = toString(row[idxSecid]);
          if (!secid || seen.has(secid)) {
            continue;
          }
          seen.add(secid);

          const matDate = toString(row[idxMatDate]);
          const faceValue = toNumber(row[idxFaceValue]);
          const pricePercent = pricePercentBySecid.get(secid) ?? null;

          bonds.push({
            secid,
            shortName: toString(row[idxShortName]),
            isin: toString(row[idxIsin]),
            type: getBondType(secid, toString(row[idxSecType])),
            faceValue,
            priceRub: pricePercent !== null && faceValue !== null ? (pricePercent / 100) * faceValue : null,
            couponPercent: toNumber(row[idxCouponPercent]),
            couponValue: toNumber(row[idxCouponValue]),
            matDate,
            yearsToMaturity: getYearsToMaturity(matDate),
            currency: toString(row[idxCurrency]),
          });
        }

        return bonds;
      },
    }),
  }),
});

export const { useGetBondsQuery } = bondsApi;
