import { RouterProvider } from 'react-router/dom';

import { Provider } from './Provider';
import { router } from './router/router';

export const App = () => (
  <Provider>
    <RouterProvider router={router} />
  </Provider>
);
