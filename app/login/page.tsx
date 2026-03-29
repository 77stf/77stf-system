import { Suspense } from 'react'
import { LoginForm } from './login-form'

export const metadata = {
  title: 'Logowanie — 77STF',
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
