import React from 'react';
import { Route, Routes } from 'react-router-dom';

import Layout from './components/Layout';
import NotFound from './pages/NotFound/NotFound';
import DashboardPage from './pages/Dashboard/DashboardPage';
import FarmsPage from './pages/Farms/FarmsPage';
import DecisionPage from './pages/Decision/DecisionPage';
import HistoryPage from './pages/History/HistoryPage';

const RoutesComponent = () => {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<DashboardPage />} />
        <Route path="farms" element={<FarmsPage />} />
        <Route path="decision" element={<DecisionPage />} />
        <Route path="history" element={<HistoryPage />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

export default RoutesComponent;
