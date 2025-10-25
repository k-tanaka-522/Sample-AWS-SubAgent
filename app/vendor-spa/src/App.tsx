import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthenticator } from './hooks/useAuthenticator';
import LoginPage from './pages/LoginPage';
import FacilityListPage from './pages/FacilityListPage';
import MaintenanceHistoryPage from './pages/MaintenanceHistoryPage';
import ReportFormPage from './pages/ReportFormPage';

function App() {
  const { isAuthenticated, isLoading } = useAuthenticator();

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/facilities"
          element={isAuthenticated ? <FacilityListPage /> : <Navigate to="/login" />}
        />
        <Route
          path="/facilities/:id/history"
          element={isAuthenticated ? <MaintenanceHistoryPage /> : <Navigate to="/login" />}
        />
        <Route
          path="/report"
          element={isAuthenticated ? <ReportFormPage /> : <Navigate to="/login" />}
        />
        <Route path="/" element={<Navigate to="/facilities" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
