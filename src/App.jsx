import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import LeadList from './pages/LeadList';
import LeadForm from './pages/LeadForm';
import { useLeads } from './hooks/useLeads';

export default function App() {
  const { leads, addOrUpdate, remove, refresh } = useLeads();

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout onRefresh={refresh} />}>
          <Route index element={<Dashboard leads={leads} />} />
          <Route path="leads" element={<LeadList leads={leads} />} />
          <Route path="leads/new" element={<LeadForm onSave={addOrUpdate} onDelete={remove} />} />
          <Route path="leads/:id" element={<LeadForm onSave={addOrUpdate} onDelete={remove} />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
