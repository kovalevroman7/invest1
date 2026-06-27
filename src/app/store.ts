import type { ThunkAction, UnknownAction } from '@reduxjs/toolkit';
import { combineSlices, configureStore } from '@reduxjs/toolkit';
import { setupListeners } from '@reduxjs/toolkit/query';

import { baseApi } from '@/shared/api/baseApi';

// `combineSlices` автоматически собирает редьюсеры по их `reducerPath`.
const rootReducer = combineSlices(baseApi);

// Тип `RootState` выводится из корневого редьюсера.
export type TRootState = ReturnType<typeof rootReducer>;

// Создание стора вынесено в `makeStore`, чтобы переиспользовать конфигурацию,
// например в тестах, которым нужен такой же стор.
export const makeStore = (preloadedState?: Partial<TRootState>) => {
  const store = configureStore({
    reducer: rootReducer,
    // Middleware RTK Query включает кэширование, инвалидацию, поллинг и т.п.
    // eslint-disable-next-line unicorn/prefer-spread
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(baseApi.middleware),
    preloadedState,
  });
  // Подключение слушателей для refetchOnFocus / refetchOnReconnect.
  setupListeners(store.dispatch);
  return store;
};

export const store = makeStore();

export type AppStore = typeof store;
export type TAppDispatch = AppStore['dispatch'];
export type TAppThunk<ReturnType = void> = ThunkAction<ReturnType, TRootState, unknown, UnknownAction>;
