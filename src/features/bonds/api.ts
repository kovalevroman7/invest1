import { moexApi } from '@/shared/api/moexApi';

import type { Bond, MoexSecuritiesResponse } from './types';

const BOND_COLUMNS = 'SECID,SHORTNAME,ISIN,SECTYPE,FACEVALUE,ACCRUEDINT,COUPONPERCENT,COUPONVALUE,MATDATE,CURRENCYID';

// Ответ исторического эндпоинта MOEX (закрытия за дату).
interface HistoryResponse {
  history: { columns: string[]; data: (string | number | null)[][] };
  'history.cursor'?: { columns: string[]; data: number[][] };
}

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

// Ручной (приблизительный) справочник кредитных рейтингов по нац. шкале:
// MOEX ISS рейтинги не отдаёт. Сопоставление по фрагменту короткого имени бумаги.
// Требует периодической актуализации; покрытие ограничено крупными эмитентами.
const ISSUER_RATINGS: [pattern: string, rating: string][] = [
  ['СБЕР', 'AAA'],
  ['ВТБ', 'AAA'],
  ['ГАЗПН', 'AAA'],
  ['ГАЗПР', 'AAA'],
  ['РЖД', 'AAA'],
  ['ДОМ.РФ', 'AAA'],
  ['ДОМРФ', 'AAA'],
  ['РОСНЕФ', 'AAA'],
  ['ЛУКОЙЛ', 'AAA'],
  ['НОВАТЭК', 'AAA'],
  ['ТРАНСНЕФ', 'AAA'],
  ['РУСГИДРО', 'AAA'],
  ['РОССЕТИ', 'AAA'],
  ['ФСК', 'AAA'],
  ['ГМКНОР', 'AAA'],
  ['МАГНИТ', 'AAA'],
  ['МТС', 'AAA'],
  ['ВЭБ', 'AAA'],
  ['РОСАТОМ', 'AAA'],
  ['АТОМЭНЕРГО', 'AAA'],
  ['РСХБ', 'AA+'],
  ['АЛЬФА', 'AA+'],
  ['ГПБ', 'AA+'],
  ['СИСТЕМА', 'AA-'],
  ['ГТЛК', 'AA-'],
  ['САМОЛЕТ', 'A+'],
];

/** Кредитный рейтинг эмитента: ОФЗ — суверенный AAA, иначе ручной справочник. */
const getCreditRating = (shortName: string, type: string): string | null => {
  if (type.startsWith('ОФЗ')) {
    return 'AAA';
  }
  const upperName = shortName.toUpperCase();
  for (const [pattern, rating] of ISSUER_RATINGS) {
    if (upperName.includes(pattern)) {
      return rating;
    }
  }
  return null;
};

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

/**
 * Количество купонов в год.
 *
 * MOEX не отдаёт COUPONFREQUENCY в общем списке, поэтому вычисляем как
 * годовой купон (номинал × ставка%) ÷ выплата за один купон (COUPONVALUE).
 */
const getCouponsPerYear = (
  faceValue: number | null,
  couponPercent: number | null,
  couponValue: number | null,
): number | null => {
  if (
    faceValue === null ||
    couponPercent === null ||
    couponPercent === 0 ||
    couponValue === null ||
    couponValue === 0
  ) {
    return null;
  }
  const frequency = Math.round((faceValue * couponPercent) / 100 / couponValue);
  return frequency >= 1 && frequency <= 12 ? frequency : null;
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
          'marketdata.columns': 'SECID,LAST,MARKETPRICE,LCLOSEPRICE,LASTTOPREVPRICE,YIELD',
        },
      }),
      transformResponse: (response: MoexSecuritiesResponse): Bond[] => {
        // Карта SECID → рыночные данные (цена в % от номинала и изменение за день в %).
        const md = response.marketdata;
        const mdIdxSecid = md.columns.indexOf('SECID');
        const mdIdxLast = md.columns.indexOf('LAST');
        const mdIdxMarket = md.columns.indexOf('MARKETPRICE');
        const mdIdxClose = md.columns.indexOf('LCLOSEPRICE');
        const mdIdxDayChange = md.columns.indexOf('LASTTOPREVPRICE');
        const mdIdxYield = md.columns.indexOf('YIELD');

        // У бумаги несколько досок; нужна основная (с реальной сделкой LAST и
        // корректным YIELD), а не служебные вроде SPOB (LAST пустой, мусорный YIELD).
        const marketBySecid = new Map<
          string,
          {
            hasLast: boolean;
            pricePercent: number | null;
            dayChangePercent: number | null;
            effectiveYield: number | null;
          }
        >();
        for (const row of md.data) {
          const secid = toString(row[mdIdxSecid]);
          if (!secid) {
            continue;
          }
          const existing = marketBySecid.get(secid);
          if (existing?.hasLast) {
            continue;
          }
          const last = toNumber(row[mdIdxLast]);
          // Заменяем накопленную строку, только если у новой есть LAST (основная доска).
          if (!existing || last !== null) {
            marketBySecid.set(secid, {
              hasLast: last !== null,
              pricePercent: last ?? toNumber(row[mdIdxMarket]) ?? toNumber(row[mdIdxClose]),
              dayChangePercent: toNumber(row[mdIdxDayChange]),
              effectiveYield: toNumber(row[mdIdxYield]),
            });
          }
        }

        const { columns, data } = response.securities;
        const index = (name: string): number => columns.indexOf(name);

        const idxSecid = index('SECID');
        const idxShortName = index('SHORTNAME');
        const idxIsin = index('ISIN');
        const idxSecType = index('SECTYPE');
        const idxFaceValue = index('FACEVALUE');
        const idxAccruedInt = index('ACCRUEDINT');
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
          const market = marketBySecid.get(secid);
          const pricePercent = market?.pricePercent ?? null;
          const shortName = toString(row[idxShortName]);
          const type = getBondType(secid, toString(row[idxSecType]));
          const couponPercent = toNumber(row[idxCouponPercent]);
          const couponValue = toNumber(row[idxCouponValue]);
          const priceRub = pricePercent !== null && faceValue !== null ? (pricePercent / 100) * faceValue : null;

          bonds.push({
            secid,
            shortName,
            isin: toString(row[idxIsin]),
            type,
            creditRating: getCreditRating(shortName, type),
            faceValue,
            pricePercent,
            priceRub,
            accruedInt: toNumber(row[idxAccruedInt]),
            dayChangePercent: market?.dayChangePercent ?? null,
            couponPercent,
            couponValue,
            couponsPerYear: getCouponsPerYear(faceValue, couponPercent, couponValue),
            matDate,
            yearsToMaturity: getYearsToMaturity(matDate),
            effectiveYield: market?.effectiveYield ?? null,
            currency: toString(row[idxCurrency]),
          });
        }

        return bonds;
      },
    }),

    /**
     * Цены закрытия (% от номинала) на ближайшую торговую дату ~неделю назад.
     *
     * MOEX не отдаёт недельное изменение готовым полем, поэтому грузим исторические
     * закрытия постранично (history endpoint, по 100 бумаг) и собираем карту
     * SECID → цена. Используется для расчёта изменения за неделю на стороне UI.
     */
    getWeekAgoCloses: builder.query<{ date: string; closes: Record<string, number> }, void>({
      queryFn: async (_arg, _api, _extra, fetchWithBQ) => {
        const HISTORY_URL = 'history/engines/stock/markets/bonds/securities.json';
        const PAGE = 100;

        const fetchPage = async (date: string, start: number) =>
          fetchWithBQ({
            url: HISTORY_URL,
            params: {
              date,
              start,
              limit: PAGE,
              'iss.meta': 'off',
              'iss.only': 'history,history.cursor',
              'history.columns': 'SECID,LEGALCLOSEPRICE,CLOSE',
            },
          });

        const toIsoDate = (date: Date): string => date.toISOString().slice(0, 10);

        // Подбираем ближайшую торговую дату ~неделю назад (пропускаем выходные/праздники).
        let referenceDate = '';
        let total = 0;
        let firstPage: HistoryResponse | null = null;
        for (let back = 7; back <= 14; back += 1) {
          const date = new Date();
          date.setDate(date.getDate() - back);
          const iso = toIsoDate(date);
          const res = await fetchPage(iso, 0);
          if (res.error) {
            return { error: res.error };
          }
          const payload = res.data as HistoryResponse;
          const cursor = payload['history.cursor'];
          const found = cursor ? Number(cursor.data[0]?.[cursor.columns.indexOf('TOTAL')] ?? 0) : 0;
          if (found > 0) {
            referenceDate = iso;
            total = found;
            firstPage = payload;
            break;
          }
        }

        if (!firstPage) {
          return { data: { date: '', closes: {} } };
        }

        const restStarts: number[] = [];
        for (let start = PAGE; start < total; start += PAGE) {
          restStarts.push(start);
        }
        const restResults = await Promise.all(restStarts.map((start) => fetchPage(referenceDate, start)));

        const closes: Record<string, number> = {};
        const addRows = (payload: HistoryResponse) => {
          const { columns, data } = payload.history;
          const iSecid = columns.indexOf('SECID');
          const iLegal = columns.indexOf('LEGALCLOSEPRICE');
          const iClose = columns.indexOf('CLOSE');
          for (const row of data) {
            const secid = typeof row[iSecid] === 'string' ? row[iSecid] : '';
            if (!secid || secid in closes) {
              continue;
            }
            const legal = row[iLegal];
            const close = row[iClose];
            const price = typeof legal === 'number' ? legal : typeof close === 'number' ? close : null;
            if (price !== null) {
              closes[secid] = price;
            }
          }
        };

        addRows(firstPage);
        for (const res of restResults) {
          if (res.error) {
            return { error: res.error };
          }
          addRows(res.data as HistoryResponse);
        }

        return { data: { date: referenceDate, closes } };
      },
    }),
  }),
});

export const { useGetBondsQuery, useGetWeekAgoClosesQuery } = bondsApi;
