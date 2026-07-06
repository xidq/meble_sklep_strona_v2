// websocket.js

let socket = null;

// Funkcja wywoływana po udanym logowaniu lub przywróceniu sesji
function connectWebSocket(user) {
  const wsSection = document.getElementById('wsSection');
  const statusEl = document.getElementById('status');
  const sendBtn = document.getElementById('sendBtn');
  const userDisplay = document.getElementById('userDisplay');

  // Pokazanie sekcji (jeśli istnieje na danej podstronie)
  if (wsSection) wsSection.style.display = 'block';
  if (userDisplay) userDisplay.textContent = `${user.username} (${user.role})`;

  // Połączenie z WS
  socket = new WebSocket('ws://127.0.0.1:8080/ws');

  socket.addEventListener('open', () => {
    if (statusEl) {
      statusEl.textContent = "Połączono";
      statusEl.style.color = "green";
    }
    if (sendBtn) sendBtn.disabled = false;

    socket.send(JSON.stringify({ type: "auth", username: user.username, role: user.role }));
  });

  socket.addEventListener('message', (e) => logMessage(`[Serwer]: ${e.data}`));

  socket.addEventListener('close', () => {
    if (statusEl) {
      statusEl.textContent = "Rozłączono";
      statusEl.style.color = "red";
    }
    if (sendBtn) sendBtn.disabled = true;
  });
}

// Funkcja wywoływana przy wylogowaniu
function disconnectWebSocket() {
  if (socket) {
    socket.close();
    socket = null;
  }
  const wsSection = document.getElementById('wsSection');
  if (wsSection) wsSection.style.display = 'none';
}

// Funkcja do logowania w oknie
function logMessage(msg) {
  const logsEl = document.getElementById('logs');
  if (!logsEl) return; // Zabezpieczenie dla podstron

  const item = document.createElement('div');
  item.textContent = msg;
  logsEl.appendChild(item);
  logsEl.scrollTop = logsEl.scrollHeight;
}
