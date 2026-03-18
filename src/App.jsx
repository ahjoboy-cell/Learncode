import { HashRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import LeadList from './pages/LeadList';
import LeadForm from './pages/LeadForm';
import SkuList from './pages/SkuList';
import { useLeads } from './hooks/useLeads';
import { useSkus } from './hooks/useSkus';

export default function App() {
  const { leads, addOrUpdate, remove, refresh } = useLeads();
  const { skus, bulkUpsert, remove: removeSku, refresh: refreshSkus } = useSkus();

  return (
    <HashRouter>
      <Routes>
        <Route element={<Layout onRefresh={() => { refresh(); refreshSkus(); }} />}>
          <Route index element={<Dashboard leads={leads} />} />
          <Route path="leads" element={<LeadList leads={leads} />} />
          <Route path="leads/new" element={<LeadForm onSave={addOrUpdate} onDelete={remove} />} />
          <Route path="leads/:id" element={<LeadForm onSave={addOrUpdate} onDelete={remove} />} />
          <Route path="skus" element={<SkuList skus={skus} onUpsert={bulkUpsert} onDelete={removeSku} />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
