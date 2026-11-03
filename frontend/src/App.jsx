import React, { useEffect, useState } from 'react'
import {
  BrowserRouter,
  Link,
  NavLink,
  Navigate,
  Route,
  Routes,
  useNavigate,
} from 'react-router-dom'

import authStore, { homePathForRole, useAuth } from './store/authStore'

import Login from './pages/auth/Login'
import Signup from './pages/auth/Signup'
import Unauthorized from './pages/auth/Unauthorized'
import NotFound from './pages/NotFound'
import ChangePassword from './pages/change-password/ChangePassword'
import AdminDashboard from './pages/admin/Dashboard'
import AdminUsersTable from './pages/admin/UsersTable'
import AdminCreateUser from './pages/admin/CreateUser'
import AdminUserDetails from './pages/admin/UserDetails'
import AdminStoresTable from './pages/admin/StoresTable'
import AdminCreateStore from './pages/admin/CreateStore'
import NormalUserStoreListing from './pages/user/StoreListing'
import RateStore from './pages/user/RateStore'
import StoreOwnerDashboard from './pages/owner/Dashboard'
import StoreOwnerRaters from './pages/owner/Raters'

const ROLE_LABELS = {
  SYSTEM_ADMIN: 'System Admin',
  NORMAL_USER: 'Normal User',
  STORE_OWNER: 'Store Owner',
}

const NAV_LINKS = {
  SYSTEM_ADMIN: [
    { to: '/admin/dashboard', label: 'Dashboard' },
    { to: '/admin/users', label: 'Users' },
    { to: '/admin/stores', label: 'Stores' },
    { to: '/admin/create-user', label: 'Add user' },
    { to: '/admin/create-store', label: 'Add store' },
  ],
  NORMAL_USER: [{ to: '/user/stores', label: 'Stores' }],
  STORE_OWNER: [
    { to: '/owner/dashboard', label: 'Dashboard' },
    { to: '/owner/raters', label: 'Ratings' },
  ],
}

function RequireAuth({ children }) {
  const user = useAuth()
  if (!user) return <Navigate to="/login" replace />
  return children
}

function RequireRole({ roles, children }) {
  const user = useAuth()
  if (!user) return <Navigate to="/login" replace />
  if (!roles.includes(user.role)) return <Unauthorized />
  return children
}

function HomeRedirect() {
  const user = useAuth()
  return <Navigate to={user ? homePathForRole(user.role) : '/login'} replace />
}

function Layout({ children }) {
  const user = useAuth()
  const navigate = useNavigate()
  const links = user ? NAV_LINKS[user.role] || [] : []

  const handleLogout = () => {
    authStore.logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-4 py-3">
          <Link to="/" className="text-lg font-semibold tracking-tight text-gray-900">
            Store Rating
          </Link>

          <nav className="flex flex-wrap items-center gap-1">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  `rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            {user ? (
              <>
                <span className="hidden text-sm text-gray-700 sm:inline">{user.name}</span>
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                  {ROLE_LABELS[user.role] || user.role}
                </span>
                <NavLink
                  to="/change-password"
                  className="text-sm text-gray-600 hover:text-blue-700"
                >
                  Password
                </NavLink>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100"
                >
                  Log out
                </button>
              </>
            ) : (
              <>
                <NavLink to="/login" className="text-sm text-gray-600 hover:text-blue-700">
                  Login
                </NavLink>
                <NavLink
                  to="/signup"
                  className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
                >
                  Sign up
                </NavLink>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  )
}

function AppShell() {
  const [ready, setReady] = useState(authStore.isInitialised())

  useEffect(() => {
    let cancelled = false
    authStore.init().finally(() => {
      if (!cancelled) setReady(true)
    })
    return () => {
      cancelled = true
    }
  }, [])

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center text-gray-500">
        Loading…
      </div>
    )
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<HomeRedirect />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/unauthorized" element={<Unauthorized />} />

        <Route
          path="/change-password"
          element={
            <RequireAuth>
              <ChangePassword />
            </RequireAuth>
          }
        />

        <Route
          path="/admin/dashboard"
          element={
            <RequireRole roles={['SYSTEM_ADMIN']}>
              <AdminDashboard />
            </RequireRole>
          }
        />
        <Route
          path="/admin/users"
          element={
            <RequireRole roles={['SYSTEM_ADMIN']}>
              <AdminUsersTable />
            </RequireRole>
          }
        />
        <Route
          path="/admin/users/:id"
          element={
            <RequireRole roles={['SYSTEM_ADMIN']}>
              <AdminUserDetails />
            </RequireRole>
          }
        />
        <Route
          path="/admin/create-user"
          element={
            <RequireRole roles={['SYSTEM_ADMIN']}>
              <AdminCreateUser />
            </RequireRole>
          }
        />
        <Route
          path="/admin/stores"
          element={
            <RequireRole roles={['SYSTEM_ADMIN']}>
              <AdminStoresTable />
            </RequireRole>
          }
        />
        <Route
          path="/admin/create-store"
          element={
            <RequireRole roles={['SYSTEM_ADMIN']}>
              <AdminCreateStore />
            </RequireRole>
          }
        />

        <Route
          path="/user/stores"
          element={
            <RequireRole roles={['NORMAL_USER']}>
              <NormalUserStoreListing />
            </RequireRole>
          }
        />
        <Route
          path="/user/store/:storeId"
          element={
            <RequireRole roles={['NORMAL_USER']}>
              <RateStore />
            </RequireRole>
          }
        />

        <Route
          path="/owner/dashboard"
          element={
            <RequireRole roles={['STORE_OWNER']}>
              <StoreOwnerDashboard />
            </RequireRole>
          }
        />
        <Route
          path="/owner/raters"
          element={
            <RequireRole roles={['STORE_OWNER']}>
              <StoreOwnerRaters />
            </RequireRole>
          }
        />

        <Route path="*" element={<NotFound />} />
      </Routes>
    </Layout>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  )
}
