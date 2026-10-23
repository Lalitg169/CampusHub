import { Route, Routes } from 'react-router'
import Layout from './components/Layout'
import RequireRole from './components/RequireRole'
import Home from './pages/Home'
import Clubs from './pages/Clubs'
import Events from './pages/Events'
import Login from './pages/Login'
import Register from './pages/Register'
import NotFound from './pages/NotFound'
import Admin from './pages/Admin'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="clubs" element={<Clubs />} />
        <Route path="events" element={<Events />} />
        <Route path="login" element={<Login />} />
        <Route path="register" element={<Register />} />
        <Route
          path="admin"
          element={
            <RequireRole roles={['college_admin']}>
              <Admin />
            </RequireRole>
          }
        />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
