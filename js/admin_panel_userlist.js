const saveUserBtn = document.getElementById('saveUserBtn');
const newUserModeBtn = document.getElementById('newUserModeBtn');
const usersContainer = document.getElementById('usersContainer');
const formUserTitle = document.getElementById('formUserTitle');
const deleteUserBtn = document.getElementById('deleteUserBtn');

newUserModeBtn.addEventListener('click', () => {
    isEditingUser = false;
    originalUserData = {};
    clearAllModifiedDots();

    document.querySelectorAll('#tab-users .form-panel input').forEach(el => el.value = "");

    const usernameInput = document.getElementById('u_username');
    if (usernameInput) {
        usernameInput.readOnly = false;
        usernameInput.style.background = '#fff';
    }

    const validCheckbox = document.getElementById('u_valid');
    if (validCheckbox) validCheckbox.checked = false; // Domyślnie odznaczony dla nowego

    const roleSelect = document.getElementById('u_permission');
    if (roleSelect) roleSelect.value = "User";

    if (formUserTitle) formUserTitle.textContent = "🛠️ Dodaj Nowego Użytkownika";
    if (deleteUserBtn) deleteUserBtn.style.display = 'none';
    deselectAll();
});

async function fetchUsers() {
    try {
        const response = await fetch("/api/admin/usr", {
            headers: { 'Authorization': `Bearer ${currentUser.token}` }
        });
        if (!response.ok) throw new Error("Błąd pobierania użytkowników");
        allUsers = await response.json();

        console.log("%c--- 1. DANE Z LISTY (/api/admin/usr) ---", "color: #00ff00; font-weight: bold;");
        console.log(allUsers);

        renderUsersList();
    } catch (error) {
        usersContainer.innerHTML = `<span style="color:red">${error.message}</span>`;
    }
}

function renderUsersList() {
    usersContainer.innerHTML = "";
    allUsers.forEach(user => {
        const div = document.createElement('div');
        div.className = 'product-item user-item';
        div.innerHTML = `
            <strong>${user.username}</strong><br>
            <small>Id:${user.id}</small>
        `;
        div.onclick = async () => {
            deselectAll('.user-item');
            div.classList.add('selected');
            // await selectUserForEdit(user.username);
            await selectUserForEdit(user);
        };
        usersContainer.appendChild(div);
    });
}

async function selectUserForEdit(userObj) {
    isEditingUser = true;
    clearAllModifiedDots();
    const name_id = typeof userObj === 'object' ? userObj.username : userObj;
    const listId = typeof userObj === 'object' ? userObj.id : null;

    // Zapamiętujemy uprawnienie, które PRZYSZŁO Z LISTY
    const fallbackPermission = (typeof userObj === 'object' && userObj.permission) ? userObj.permission : "User";
    try {
        const response = await fetch(`/api/admin/usr/${name_id}`, {
            headers: { 'Authorization': `Bearer ${currentUser.token}` }
        });

        if (!response.ok) throw new Error(`Błąd HTTP: ${response.status}`);

        let data = await response.json();
        console.log("Szczegóły użytkownika z backendu:", data);

        const u = data.user || data.data || data;

        // Wyciąganie wartości z backendu
        const id = u.id ?? u.ID ?? u.user_id ?? listId ?? "";
        const username = u.username || u.Username || name_id || "";
        const email = u.email || u.Email || "";
        const name = u.name || u.Name || u.imie || u.Imie || "";
        const surname = u.surname || u.Surname || u.nazwisko || u.Nazwisko || "";

        // 2. Poprawione dopasowanie Roli dla u_permission
        const rawRole = String(u.permission || u.Permission || u.role || u.Role || fallbackPermission).trim();

        const roleSelect = document.getElementById('u_permission');
        if (roleSelect) {

            const matchedOption = Array.from(roleSelect.options).find(
                option => option.value.toLowerCase() === rawRole.toLowerCase()
            );

            if (matchedOption) {
                roleSelect.value = matchedOption.value;
            } else {
                roleSelect.value = "User"; //default
            }
        }

        const isValid = (u.valid !== undefined) ? u.valid :
            (u.Valid !== undefined) ? u.Valid :
                (u.registration_conditions !== undefined) ? u.registration_conditions : false;

        // formularz
        document.getElementById('u_id').value = id;
        document.getElementById('u_username').value = username;
        document.getElementById('u_email').value = email;
        document.getElementById('u_name').value = name;
        document.getElementById('u_surname').value = surname;

        const validCb = document.getElementById('u_valid');
        if (validCb) {
            validCb.checked = Boolean(isValid);
        }

        // Zapis stanu początkowego do porównywania zmian (punkt 3)
        originalUserData = {
            'u_id': String(id),
            'u_username': String(username),
            'u_email': String(email),
            'u_name': String(name),
            'u_surname': String(surname),
            'u_permission': String(rawRole),
            'u_valid': Boolean(isValid)
        };

        // Blokada pola username w trybie edycji
        const usernameInput = document.getElementById('u_username');
        if (usernameInput) {
            usernameInput.readOnly = true;
            usernameInput.style.background = '#eee';
        }

        if (formUserTitle) formUserTitle.textContent = `Edycja: ${username}`;

    } catch (error) {
        console.error("Błąd podczas pobierania szczegółów użytkownika:", error);
        alert("Nie udało się załadować szczegółowych danych użytkownika.");
    }
    if (deleteUserBtn) deleteUserBtn.style.display = 'block';
}

saveUserBtn.addEventListener('click', async () => {
    const usernameElem = document.getElementById('u_username');
    const username = usernameElem ? usernameElem.value : "";
    if (!username) { alert("Podaj username!"); return; }
    const getVal = (id) => {
        const el = document.getElementById(id);
        return el ? el.value : "";
    };

    let payload;
    let method = isEditingUser ? 'PUT' : 'POST';

    if (isEditingUser) {
        // Payload dla PUT (bez haseł)
        payload = {
            username: username,
            email: getVal('u_email'),
            name: getVal('u_name'),
            surname: getVal('u_surname'),
            registration_conditions: true
        };
    } else {
        const validElem = document.getElementById('u_valid');
        payload = {
            username: username,
            password: "12345678",
            confirm_password: "12345678",
            email: getVal('u_email'),
            name: getVal('u_name'),
            surname: getVal('u_surname'),
            registration_conditions: true
        };
    }

    try {
        const response = await fetch('/api/admin/usr', {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${currentUser.token}`
            },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            alert(isEditingUser ? "Zaktualizowano użytkownika!" : "Dodano użytkownika!");
            await fetchUsers();
        } else {
            const errData = await response.text();
            alert(`Błąd zapisu: ${errData}`);
        }
    } catch (err) {
        console.error("Błąd sieci:", err);
        alert("Błąd połączenia z serwerem.");
    }
});

// Helper do pokazywania/ukrywania zielonej kropeczki przy etykiecie
function updateFieldModifiedStatus(fieldId, isModified) {
    const el = document.getElementById(fieldId);
    if (!el) return;
    const group = el.closest('.form-group');
    if (!group) return;

    let dot = group.querySelector('.modified-dot');
    if (isModified) {
        if (!dot) {
            dot = document.createElement('span');
            dot.className = 'modified-dot';
            dot.title = 'Pole zostało zmodyfikowane';
            const label = group.querySelector('label');
            if (label) label.appendChild(dot);
        }
    } else {
        if (dot) dot.remove();
    }
}

// Czyszczenie wszystkich kropek modyfikacji
function clearAllModifiedDots() {
    document.querySelectorAll('#tab-users .modified-dot').forEach(dot => dot.remove());
}
// Nasłuchiwanie zmian na formularzu użytkownika
document.addEventListener('DOMContentLoaded', () => {
    const userFormInputs = document.querySelectorAll('#tab-users .form-panel input, #tab-users .form-panel select');
    userFormInputs.forEach(input => {
        const handler = () => {
            if (!isEditingUser) {
                clearAllModifiedDots();
                return;
            }
            /** @type {boolean} */
            let isModified;
            let origVal = originalUserData[input.id];

            if (input.type === 'checkbox') {
                isModified = input.checked !== Boolean(origVal);
            } else {
                isModified = String(input.value || '').trim() !== String(origVal || '').trim();
            }

            updateFieldModifiedStatus(input.id, isModified);
        };

        input.addEventListener('input', handler);
        input.addEventListener('change', handler);
    });
});

deleteUserBtn.addEventListener('click', async () => {
    // 1. Wyciągamy ID użytkownika z pola formularza
    const userIdInput = document.getElementById('u_id');
    const userId = userIdInput ? parseInt(userIdInput.value) : 0;
    const usernameInput = document.getElementById('u_username');
    const username = usernameInput ? usernameInput.value : "";

    if (!userId) {
        alert("Brak wybranego użytkownika do usunięcia!");
        return;
    }

    // 2. Komunikat potwierdzający
    const confirmed = confirm(`Czy na pewno chcesz usunąć użytkownika: "${username}" (ID: ${userId})?`);
    if (!confirmed) return;

    try {
        // 3. Wysyłanie zapytania DELETE pod adres edycji z tagiem "delete" i ID w ciele zapytania
        const response = await fetch(`/api/admin/usr/${userId}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${currentUser.token}`
            },
            body: JSON.stringify({
                tag: "delete",
                id: userId
            })
        });

        if (response.ok) {
            alert("Użytkownik został pomyślnie usunięty!");

            // Czyszczenie formularza i ukrycie przycisku
            if (newUserModeBtn) newUserModeBtn.click();

            // Odświeżenie listy użytkowników
            await fetchUsers();
        } else {
            const errData = await response.text();
            alert(`Błąd usuwania użytkownika: ${errData}`);
        }
    } catch (err) {
        console.error("Błąd sieci podczas usuwania:", err);
        alert("Błąd połączenia z serwerem.");
    }
});