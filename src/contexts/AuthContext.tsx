import React, { createContext, useContext, useEffect, useState } from 'react'
import pb from '@/lib/pocketbase/client'
import { UserModel, UserRole } from '@/types/database'

interface AuthContextType {
  user: UserModel | null
  token: string | null
  role: UserRole
  login: (email: string, pass: string) => Promise<void>
  logout: () => void
  switchRoleForTesting: (role: UserRole) => void
  isAuthenticated: boolean
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  role: 'admin',
  login: async () => {},
  logout: () => {},
  switchRoleForTesting: () => {},
  isAuthenticated: true,
})

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserModel | null>(() => {
    if (pb.authStore.isValid && pb.authStore.record) {
      return pb.authStore.record as unknown as UserModel
    }
    // Default fallback to Admin for seamless demo/ERP access
    return {
      id: 'admin_local',
      email: 'advmg.rodrigues@gmail.com',
      name: 'Administrador Geral',
      role: 'admin',
      phone: '(11) 98765-4321',
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
    }
  })

  const [simulatedRole, setSimulatedRole] = useState<UserRole>('admin')

  useEffect(() => {
    return pb.authStore.onChange(() => {
      if (pb.authStore.isValid && pb.authStore.record) {
        setUser(pb.authStore.record as unknown as UserModel)
      }
    })
  }, [])

  const login = async (email: string, pass: string) => {
    const authData = await pb.collection('users').authWithPassword(email, pass)
    setUser(authData.record as unknown as UserModel)
    setSimulatedRole((authData.record as unknown as UserModel).role || 'admin')
  }

  const logout = () => {
    pb.authStore.clear()
    setUser(null)
  }

  const switchRoleForTesting = (newRole: UserRole) => {
    setSimulatedRole(newRole)
  }

  const activeRole: UserRole = simulatedRole || user?.role || 'admin'

  return (
    <AuthContext.Provider
      value={{
        user,
        token: pb.authStore.token,
        role: activeRole,
        login,
        logout,
        switchRoleForTesting,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
