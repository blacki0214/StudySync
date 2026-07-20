/**
 * testAccounts.js
 * ----------------------------------------------------------------------------
 * Local-only accounts that bypass Supabase Auth so the three roles
 * (student / teacher / admin) can be explored without a live backend or a
 * confirmed email.
 *
 * SAFETY: these only work when `isTestLoginEnabled` is true — i.e. during
 * `npm run dev` (import.meta.env.DEV), or when VITE_ALLOW_TEST_LOGIN=true is
 * set explicitly. A production build ignores them entirely.
 */

/** True only in a dev server run, or when explicitly opted in via .env. */
export const isTestLoginEnabled =
  import.meta.env.DEV || import.meta.env.VITE_ALLOW_TEST_LOGIN === 'true'

/** Same password for all three — easy to type while testing. */
export const TEST_PASSWORD = 'test1234'

export const TEST_ACCOUNTS = [
  {
    id: 'test-student',
    auth_id: 'test-student',
    email: 'student@test.local',
    password: TEST_PASSWORD,
    role: 'student',
    full_name: 'Test Student',
    first_name: 'Test',
    last_name: 'Student',
    handle: 'teststudent',
    program: 'SWE · RMIT Vietnam',
    school: 'RMIT Vietnam',
    avatar_url: '',
    reputation: 1200,
    purpose: 'study'
  },
  {
    id: 'test-teacher',
    auth_id: 'test-teacher',
    email: 'teacher@test.local',
    password: TEST_PASSWORD,
    role: 'teacher',
    full_name: 'Test Teacher',
    first_name: 'Test',
    last_name: 'Teacher',
    handle: 'testteacher',
    program: 'Lecturer · RMIT Vietnam',
    school: 'RMIT Vietnam',
    avatar_url: '',
    reputation: 0,
    purpose: 'teach'
  },
  {
    id: 'test-admin',
    auth_id: 'test-admin',
    email: 'admin@test.local',
    password: TEST_PASSWORD,
    role: 'admin',
    full_name: 'Test Admin',
    first_name: 'Test',
    last_name: 'Admin',
    handle: 'testadmin',
    program: 'School Admin',
    school: 'RMIT Vietnam',
    avatar_url: '',
    reputation: 0,
    purpose: 'manage'
  }
]

/**
 * Match an email/password pair against the test accounts.
 * @returns the user object (without the password) or null.
 */
export function findTestAccount(email, password) {
  if (!isTestLoginEnabled) return null
  const clean = (email || '').trim().toLowerCase()
  const account = TEST_ACCOUNTS.find(
    (a) => a.email === clean && a.password === password
  )
  if (!account) return null
  const { password: _pw, ...user } = account
  return { ...user, __test: true }
}
