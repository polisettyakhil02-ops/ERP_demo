import { createContext, useContext, useState } from 'react'

const RoleContext = createContext(null)

export const ROLES = {
  finance: { label: 'Admin Officer', color: 'indigo' },
  teacher: { label: 'Teacher', color: 'teal' },
  principal: { label: 'Principal', color: 'purple' },
  consultant: { label: 'Accounts Manager', color: 'amber' },
  student: { label: 'Student', color: 'blue' },
}

export function RoleProvider({ children }) {
  const [activeRole, setActiveRoleState] = useState(
    () => localStorage.getItem('activeRole') || null
  )
  const [branch, setBranchState] = useState(
    () => localStorage.getItem('activeBranch') || 'Hyderabad'
  )

  const setActiveRole = (role) => {
    localStorage.setItem('activeRole', role)
    setActiveRoleState(role)
  }

  const setBranch = (b) => {
    localStorage.setItem('activeBranch', b)
    setBranchState(b)
  }

  const clearRole = () => {
    localStorage.removeItem('activeRole')
    setActiveRoleState(null)
  }

  return (
    <RoleContext.Provider value={{ activeRole, setActiveRole, clearRole, branch, setBranch }}>
      {children}
    </RoleContext.Provider>
  )
}

export const useRole = () => {
  const ctx = useContext(RoleContext)
  if (!ctx) throw new Error('useRole must be used within RoleProvider')
  return ctx
}
