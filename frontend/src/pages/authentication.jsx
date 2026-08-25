import * as React from 'react';
import { Button, Snackbar, TextField } from '@mui/material';
import { AuthContext } from '../contexts/AuthContext';
import { useNavigate, useSearchParams } from 'react-router-dom';
import '../App.css';

export default function Authentication() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { handleRegister, handleLogin } = React.useContext(AuthContext);
  const [mode, setMode] = React.useState(searchParams.get('mode') === 'signup' ? 'signup' : 'login');
  const [name, setName] = React.useState('');
  const [username, setUsername] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState('');
  const [message, setMessage] = React.useState('');
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    setMode(searchParams.get('mode') === 'signup' ? 'signup' : 'login');
    setError('');
  }, [searchParams]);

  const changeMode = (nextMode) => setSearchParams({ mode: nextMode });
  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    try {
      if (mode === 'signup') {
        const result = await handleRegister(name, username, password);
        setMessage(result || 'Account created. Please sign in.');
        setOpen(true);
        setPassword('');
        changeMode('login');
      } else {
        await handleLogin(username, password);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to continue. Please try again.');
    }
  };

  return (
    <div className="authPage">
      <section className="authVisual">
        <div className="authBrand" onClick={() => navigate('/')} role="button" tabIndex={0}>Webcrat Call</div>
        <div className="authPitch"><p>VIDEO CALLS, MADE WARMER</p><h1>Every conversation feels closer.</h1><span>Meet, laugh, collaborate and stay connected from anywhere.</span></div>
      </section>
      <section className="authPanel">
        <div className="authCard">
          <button className="backButton" onClick={() => navigate('/')}>? Back home</button>
          <p className="authKicker">WELCOME TO WEBCRAT</p>
          <h2>{mode === 'login' ? 'Welcome back' : 'Create your account'}</h2>
          <p className="authSubtext">{mode === 'login' ? 'Sign in to continue to your calls.' : 'Start meeting the people who matter.'}</p>
          <div className="authTabs">
            <button className={mode === 'login' ? 'active' : ''} onClick={() => changeMode('login')}>Sign in</button>
            <button className={mode === 'signup' ? 'active' : ''} onClick={() => changeMode('signup')}>Sign up</button>
          </div>
          <form onSubmit={handleSubmit} className="authForm">
            {mode === 'signup' && <TextField required fullWidth label="Full name" value={name} onChange={(e) => setName(e.target.value)} />}
            <TextField required fullWidth label="Username" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" />
            <TextField required fullWidth label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
            {error && <p className="authError">{error}</p>}
            <Button type="submit" fullWidth variant="contained" className="authSubmit">{mode === 'login' ? 'Sign in' : 'Create account'}</Button>
          </form>
          <p className="authSwitch">{mode === 'login' ? 'New here?' : 'Already have an account?'} <button onClick={() => changeMode(mode === 'login' ? 'signup' : 'login')}>{mode === 'login' ? 'Create an account' : 'Sign in'}</button></p>
        </div>
      </section>
      <Snackbar open={open} autoHideDuration={4000} onClose={() => setOpen(false)} message={message} />
    </div>
  );
}