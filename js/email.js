document.addEventListener("DOMContentLoaded", () => {
    const user = JSON.parse(localStorage.getItem('currentUser'));
    // Walidacja ról dla skrzynki
    if (!user || (user.role !== 'Legituser' && user.role !== 'Admin')) {
        document.body.innerHTML = "<h1>403 - Access Denied</h1>";
        return;
    }
    // Domyślny start na folderze inbox
    changeFolder('inbox');
});

let currentFolder = 'inbox';
// Przykładowe dane z flagami
let emails = [
    { id: 1, from: "admin@system.pl", subject: "Witaj", content: "Treść powitania...", isRead: false, folder: 'inbox' },
    { id: 2, from: "bot@spam.pl", subject: "Wygrałeś!", content: "Kliknij tutaj...", isRead: false, folder: 'spam' }
];

function renderEmails() {
    const list = document.getElementById('emailList');
    const filter = document.getElementById('emailFilter').value.toLowerCase();

    // Filtrowanie po aktualnym folderze
    const filtered = emails.filter(e =>
        e.folder === currentFolder &&
        (e.subject.toLowerCase().includes(filter) || e.from.toLowerCase().includes(filter))
    );

    list.innerHTML = filtered.map(e => `
        <div class="email-item ${e.isRead ? '' : 'unread'}" onclick="viewEmail(${e.id})">
            <div>
                <strong>${e.from}</strong> 
                ${e.folder === 'outbox' ? '<small style="color:orange;">(W kolejce)</small>' : ''}
            </div>
            <div>${e.subject}</div>
        </div>
    `).join('');
}
function openCompose() {
    document.getElementById('composeModal').style.display = 'block';
}

// Zamykanie modala
function closeCompose() {
    document.getElementById('composeModal').style.display = 'none';
}
function sendNewEmail() {
    const to = document.getElementById('composeTo').value;
    const subject = document.getElementById('composeSubject').value;
    const content = document.getElementById('composeContent').value;

    if (!to || !subject) {
        alert("Wypełnij pola!");
        return;
    }

    const newEmail = {
        id: Date.now(),
        from: "Ja", // Tutaj pobierz username z localStorage
        to: to,
        subject: subject,
        content: content,
        isRead: true,
        folder: 'outbox'
    };

    // Dodanie do lokalnej listy i odświeżenie
    emails.push(newEmail);
    closeCompose();
    renderEmails();

    // Tu będzie wysyłka przez WebSocket, gdy serwer będzie gotowy:
    // socket.send(JSON.stringify({ type: 'SEND_EMAIL', payload: newEmail }));
}

function viewEmail(id) {
    const email = emails.find(e => e.id === id);
    if (!email) return;

    email.isRead = true; // Oznacz jako przeczytany
    document.getElementById('previewContent').innerHTML = `
        <p><strong>Od:</strong> ${email.from}</p>
        <p><strong>Temat:</strong> ${email.subject}</p>
        <hr>
        <p>${email.content}</p>
    `;
    renderEmails(); // Odśwież listę, aby usunąć podświetlenie
}

function changeFolder(folder) {
    currentFolder = folder;
    document.getElementById('previewContent').innerHTML = "Wybierz wiadomość";
    renderEmails();
}

document.addEventListener("DOMContentLoaded", () => {
    // WALIDACJA ROLI
    const user = JSON.parse(localStorage.getItem('currentUser'));
    if (!user || (user.role !== 'Legituser' && user.role !== 'Admin')) {
        document.body.innerHTML = "<h1>403 - Access Denied</h1>";
        return;
    }
    renderEmails();
});