import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import '../App.css';

export default function LandingPage() {
  const navigate = useNavigate();
  const [guestCode, setGuestCode] = useState('');
  const [guestOpen, setGuestOpen] = useState(false);

  const joinAsGuest = (event) => {
    event.preventDefault();
    const room = guestCode.trim();
    if (room) navigate(`/${encodeURIComponent(room)}`);
  };

  return (
    <div className='landingpagecontainer'>
      <nav>
        <div className="brand"><h2>Webcrat Call</h2></div>
        <div className='navlist'>
          <button className="navTextButton" onClick={() => setGuestOpen(!guestOpen)}>Join as guest</button>
          <button className="navTextButton" onClick={() => navigate('/auth?mode=signup')}>Register</button>
          <button className="navLoginButton" onClick={() => navigate('/auth?mode=login')}>Login</button>
        </div>
      </nav>

      <main className='landingmaincontainer'>
        <div>
          <p className="eyebrow">SECURE. SIMPLE. HUMAN.</p>
          <h1><span>Connect</span> with your loved ones</h1>
          <p>Beautiful, reliable video calls for every conversation that matters.</p>
          <div className="heroActions">
            <Link className="primaryLink" to="/auth?mode=signup">Get started free</Link>
            <button className="secondaryLink" onClick={() => setGuestOpen(true)}>Join a call</button>
          </div>
          {guestOpen && <form className="guestForm" onSubmit={joinAsGuest}>
            <label htmlFor="guest-room">Join as a guest</label>
            <div>
              <input id="guest-room" value={guestCode} onChange={(e) => setGuestCode(e.target.value)} placeholder="Enter meeting code" autoFocus />
              <button type="submit">Join room</button>
            </div>
          </form>}
        </div>
        <div><img src='/mobile.png' alt="Video call preview" /></div>
      </main>
    </div>
  );
}