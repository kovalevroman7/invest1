import { createBrowserRouter } from 'react-router';

import { About } from '@/pages/About';
import { Home } from '@/pages/Home';
import { Posts } from '@/pages/Posts';
import { MainLayout } from '@/shared/layouts/MainLayout';

export const router = createBrowserRouter([
  {
    path: '/',
    Component: MainLayout,
    children: [
      { index: true, Component: Home },
      { path: 'posts', Component: Posts },
      { path: 'about', Component: About },
    ],
  },
]);
