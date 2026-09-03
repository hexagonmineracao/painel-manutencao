import { HashRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import { Layout } from './components/Layout'
import { Login } from './pages/Login'
import { Dashboard } from './pages/Dashboard'
import { Machines } from './pages/Machines'
import { MachineDetail } from './pages/MachineDetail'
import { NewMaintenance } from './pages/NewMaintenance'
import { NewFuelRecord } from './pages/NewFuelRecord'
import { FuelDeliveries } from './pages/FuelDeliveries'
import { Materials } from './pages/Materials'
import { Reports } from './pages/Reports'
import { Metrics } from './pages/Metrics'
import { Users } from './pages/Users'
import { Account } from './pages/Account'

export default function App() {
  return (
    <HashRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route path="/" element={<Dashboard />} />
            <Route path="/machines" element={<Machines />} />
            <Route path="/machines/:id" element={<MachineDetail />} />
            <Route path="/machines/:id/maintenance/new" element={<NewMaintenance />} />
            <Route path="/machines/:id/fuel/new" element={<NewFuelRecord />} />
            <Route path="/fuel-deliveries" element={<FuelDeliveries />} />
            <Route path="/materials" element={<Materials />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/metrics" element={<Metrics />} />
            <Route path="/account" element={<Account />} />
            <Route
              path="/users"
              element={
                <ProtectedRoute adminOnly>
                  <Users />
                </ProtectedRoute>
              }
            />
          </Route>
        </Routes>
      </AuthProvider>
    </HashRouter>
  )
}
