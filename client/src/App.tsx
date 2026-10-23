import { Route, Routes } from 'react-router'
import Layout from './components/Layout'
import RequireRole from './components/RequireRole'
import Home from './pages/Home'
import Clubs from './pages/Clubs'
import ClubDetail from './pages/ClubDetail'
import Events from './pages/Events'
import EventDetail from './pages/EventDetail'
import EventForm from './pages/EventForm'
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
        <Route path="clubs/:slug" element={<ClubDetail />} />
        <Route path="events" element={<Events />} />
        <Route path="events/:id" element={<EventDetail />} />
        <Route
          path="events/new"
          element={
            <RequireRole roles={['club_admin', 'college_admin']}>
              <EventForm />
            </RequireRole>
          }
        />
        <Route
          path="events/:id/edit"
          element={
            <RequireRole roles={['club_admin', 'college_admin']}>
              <EventForm />
            </RequireRole>
          }
        />
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
