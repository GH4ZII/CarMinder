import Layout from '@/components/layout/Layout';
import ProtectedRoute from '@/components/layout/ProtectedRoute';
import { AuthProvider } from '@/contexts/AuthContext';
import AddCar from '@/pages/AddCar';
import AddEvent from '@/pages/AddEvent';
import Calendar from '@/pages/Calendar';
import CarDetail from '@/pages/CarDetail';
import Home from '@/pages/Home';
import Login from '@/pages/Login';
import Profile from '@/pages/Profile';
import Signup from '@/pages/Signup';
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom';

const router = createBrowserRouter([
  {
    path: '/login',
    element: <Login />,
  },
  {
    path: '/signup',
    element: <Signup />,
  },
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <Layout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <Home /> },
      { path: 'calendar', element: <Calendar /> },
      { path: 'profile', element: <Profile /> },
      { path: 'add-car', element: <AddCar /> },
      { path: 'car/:id', element: <CarDetail /> },
      { path: 'car/:id/add-event', element: <AddEvent /> },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
]);

export default function AppRouter() {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  );
}
