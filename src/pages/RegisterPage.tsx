import { useState, FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'

export default function RegisterPage() {
  const signUp = useAuthStore((s) => s.signUp)
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!displayName.trim()) { setError('请输入显示名称'); return }
    if (displayName.trim().length < 2) { setError('显示名称至少2个字符'); return }
    if (!email.trim()) { setError('请输入邮箱'); return }
    if (password.length < 8) { setError('密码长度至少为8位'); return }
    if (password !== confirmPassword) { setError('两次密码输入不一致'); return }

    setLoading(true)
    const result = await signUp(email, password, displayName.trim())
    setLoading(false)

    if (result.error) {
      setError(result.error)
    } else {
      setSuccess('注册成功！请检查邮箱确认链接，完成后即可登录。')
    }
  }

  return (
    <div className="max-w-md mx-auto px-4 py-16">
      <h1 className="text-2xl font-bold text-center text-gray-900 mb-8">注册</h1>
      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        {error && (
          <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm">{error}</div>
        )}
        {success && (
          <div className="bg-green-50 text-green-600 px-4 py-3 rounded-lg text-sm">{success}</div>
        )}
        <div>
          <label htmlFor="displayName" className="block text-sm font-medium text-gray-700 mb-1">显示名称</label>
          <input
            id="displayName"
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="你的昵称（至少2个字符）"
            autoFocus
          />
        </div>
        <div>
          <label htmlFor="reg-email" className="block text-sm font-medium text-gray-700 mb-1">邮箱</label>
          <input
            id="reg-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="your@email.com"
            autoComplete="email"
          />
        </div>
        <div>
          <label htmlFor="reg-password" className="block text-sm font-medium text-gray-700 mb-1">密码</label>
          <input
            id="reg-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="至少8位"
            autoComplete="new-password"
          />
        </div>
        <div>
          <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">确认密码</label>
          <input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="再次输入密码"
            autoComplete="new-password"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? '注册中...' : '注册'}
        </button>
        <p className="text-center text-sm text-gray-500">
          已有账号？<Link to="/login" className="text-blue-600 hover:underline">登录</Link>
        </p>
      </form>
    </div>
  )
}
