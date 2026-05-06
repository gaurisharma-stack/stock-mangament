import { useState } from 'react';
import { auth } from '../api';
import { Database, LogIn, UserPlus, Users, Eye, EyeOff, Copy, CheckCircle, AlertTriangle, ArrowRight } from 'lucide-react';

export default function Login({ onLogin }) {
  const [mode, setMode] = useState('login'); // 'login' | 'register' | 'join'
  const [form, setForm] = useState({ companyName: '', name: '', email: '', password: '', inviteCode: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [successInfo, setSuccessInfo] = useState(null); // For showing invite code after registration
  const [copied, setCopied] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      let result;

      if (mode === 'login') {
        result = await auth.login({ email: form.email, password: form.password });
        auth.setToken(result.token);
        onLogin(result.user);
      } else if (mode === 'register') {
        result = await auth.register({
          companyName: form.companyName,
          name: form.name,
          email: form.email,
          password: form.password,
        });
        // Show invite code before proceeding
        setSuccessInfo({
          companyName: result.user.companyName,
          inviteCode: result.user.inviteCode,
          token: result.token,
          user: result.user,
        });
      } else if (mode === 'join') {
        result = await auth.join({
          inviteCode: form.inviteCode,
          name: form.name,
          email: form.email,
          password: form.password,
        });
        auth.setToken(result.token);
        onLogin(result.user);
      }
    } catch (err) {
      setError(err.message);
    }

    setLoading(false);
  };

  const handleContinueAfterRegister = () => {
    auth.setToken(successInfo.token);
    onLogin(successInfo.user);
  };

  const copyInviteCode = () => {
    navigator.clipboard.writeText(successInfo.inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const switchMode = (newMode) => {
    setMode(newMode);
    setError('');
    setSuccessInfo(null);
    setForm({ companyName: '', name: '', email: '', password: '', inviteCode: '' });
  };

  // Success screen after company registration
  if (successInfo) {
    return (
      <div className="login-page">
        <div className="login-container">
          <div className="login-card">
            <div className="login-brand">
              <div className="login-brand-icon"><Database size={24} /></div>
              <h1>StockFlow</h1>
              <p>Company Created Successfully!</p>
            </div>

            <div className="invite-success">
              <div className="invite-success-icon"><CheckCircle size={48} /></div>
              <h2>{successInfo.companyName}</h2>
              <p className="invite-label">Share this invite code with your team members:</p>
              <div className="invite-code-display">
                <span className="invite-code-text">{successInfo.inviteCode}</span>
                <button className="invite-copy-btn" onClick={copyInviteCode} title="Copy code">
                  {copied ? <CheckCircle size={18} /> : <Copy size={18} />}
                </button>
              </div>
              <p className="invite-hint">Team members can join using this code when they sign up.</p>
              <button className="btn btn-primary btn-lg" onClick={handleContinueAfterRegister}>
                Continue to Dashboard <ArrowRight size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-card">
          <div className="login-brand">
            <div className="login-brand-icon"><Database size={24} /></div>
            <h1>StockFlow</h1>
            <p>Inventory Management System</p>
          </div>

          {/* Mode Tabs */}
          <div className="login-tabs">
            <button
              className={`login-tab ${mode === 'login' ? 'active' : ''}`}
              onClick={() => switchMode('login')}
            >
              <LogIn size={16} /> Sign In
            </button>
            <button
              className={`login-tab ${mode === 'register' ? 'active' : ''}`}
              onClick={() => switchMode('register')}
            >
              <UserPlus size={16} /> Create Company
            </button>
            <button
              className={`login-tab ${mode === 'join' ? 'active' : ''}`}
              onClick={() => switchMode('join')}
            >
              <Users size={16} /> Join Company
            </button>
          </div>

          {error && (
            <div className="alert alert-error">
              <AlertTriangle size={16} />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {mode === 'register' && (
              <div className="form-group">
                <label className="form-label">Company Name</label>
                <input
                  className="form-input"
                  required
                  value={form.companyName}
                  onChange={e => setForm({ ...form, companyName: e.target.value })}
                  placeholder="e.g. Acme Industries"
                  autoFocus
                />
              </div>
            )}

            {mode === 'join' && (
              <div className="form-group">
                <label className="form-label">Invite Code</label>
                <input
                  className="form-input invite-code-input"
                  required
                  value={form.inviteCode}
                  onChange={e => setForm({ ...form, inviteCode: e.target.value.toUpperCase() })}
                  placeholder="e.g. X7KM2P"
                  maxLength={6}
                  autoFocus
                  style={{ letterSpacing: '4px', textAlign: 'center', fontSize: '18px', fontWeight: '700' }}
                />
              </div>
            )}

            {(mode === 'register' || mode === 'join') && (
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input
                  className="form-input"
                  required
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="Your full name"
                  autoFocus={mode === 'login'}
                />
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Email</label>
              <input
                className="form-input"
                type="email"
                required
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                placeholder="you@company.com"
                autoFocus={mode === 'login'}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  className="form-input"
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })}
                  placeholder={mode === 'login' ? 'Enter your password' : 'At least 6 characters'}
                  style={{ paddingRight: '44px' }}
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button type="submit" className="btn btn-primary btn-lg btn-full" disabled={loading}>
              {loading ? 'Please wait...' : (
                mode === 'login' ? 'Sign In' :
                mode === 'register' ? 'Create Company' :
                'Join Company'
              )}
            </button>
          </form>

          <div className="login-footer">
            {mode === 'login' ? (
              <p>Don't have an account? <button className="link-btn" onClick={() => switchMode('register')}>Create a company</button> or <button className="link-btn" onClick={() => switchMode('join')}>join one</button></p>
            ) : (
              <p>Already have an account? <button className="link-btn" onClick={() => switchMode('login')}>Sign in</button></p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
