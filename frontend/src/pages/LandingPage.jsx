import React from 'react'
import {Link} from "react-router-dom";


import "../App.css";


export default function LandingPage() {
  return (
    <div className='landingpagecontainer'>
      <nav>
        {/* left side (brand) */}
        <div className="brand">
          <div className="navHeader"></div>
          <h2>Webcrat Call</h2>
        </div>

        {/* right side (nav list) */}
        <div className='navlist'>
          <p>Join as Guest</p>
          <p>Register</p>
          <div role='button'>
            <p>Login</p>
          </div>
        </div>
      </nav>

      {/* main hero section */}
      <div className='landingmaincontainer'>
        <div>
          <h1>
            <span style={{ color: "#FF9839" }}>Connect</span> with your loved ones
          </h1>
          <p>Cover distance by webcraft video call</p>
          <div role='button'>  
            <Link to={"/auth"}>Get Started </Link>
          </div>
        </div>
        <div>
         <img src='/mobile.png'></img>
        </div>
      </div>
    </div>
  )
}
