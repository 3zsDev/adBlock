(function () {
  const enabled = false;

  if (document.getElementById("blockwall-overlay")) return;

  const style = document.createElement("style");
  style.textContent = `
    #blockwall-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.97);
      color: white;
      z-index: 2147483647;
      font-family: sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      transition: opacity 0.5s ease;
    }

    .spinner {
      border: 6px solid #444;
      border-top: 6px solid #00e0ff;
      border-radius: 50%;
      width: 60px;
      height: 60px;
      animation: spin 1s linear infinite;
      margin-bottom: 20px;
    }

    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }

    .fade-out {
      opacity: 0;
      pointer-events: none;
    }

    .blockwall-message h1 {
      font-size: 2.2rem;
      margin-bottom: 0.5rem;
    }

    .blockwall-message p {
      font-size: 1.1rem;
      color: #ccc;
    }
  `;
  document.head.appendChild(style);

  const overlay = document.createElement("div");
  overlay.id = "blockwall-overlay";

  const spinner = document.createElement("div");
  spinner.className = "spinner";

  const text = document.createElement("p");
  text.textContent = "Checking subscription...";
  text.style.fontSize = "1.2rem";

  overlay.appendChild(spinner);
  overlay.appendChild(text);
  document.body.appendChild(overlay);

  setTimeout(() => {
    if (enabled) {
      document.body.innerHTML = "";
      document.body.appendChild(overlay);
      overlay.innerHTML = `
        <div class="blockwall-message">
          <h1>Youtube Disabled</h1>
          <p>Your subscription has ended.<br>Please renew to continue using this service or disable the extention</p>
        </div>
      `;
    } else {
      // Fade out and remove overlay
      overlay.classList.add("fade-out");
      setTimeout(() => overlay.remove(), 600);
    }
  }, 1000);
})();
