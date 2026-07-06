document.getElementById('uploadImageBtn').addEventListener('click', async () => {
  const fileInput = document.getElementById('imageInput');
  const statusDiv = document.getElementById('uploadStatus');
  const file = fileInput.files[0];

  if (!file) {
    alert("Wybierz plik!");
    return;
  }

  // Walidacja nazwy: nazwa_wersja_wariant (np. szafka_1_2)
  // Regex: sprawdzamy czy na końcu są dwa podkreślniki z liczbami
  const fileNameParts = file.name.split('.');
  const nameWithoutExt = fileNameParts[0];
  const namePattern = /^(.+)_(\d+)_(\d+)$/;

  if (!namePattern.test(nameWithoutExt)) {
    statusDiv.style.color = "red";
    statusDiv.textContent = "Błąd nazwy! Wymagany format: nazwa_wersja_wariant";
    return;
  }

  statusDiv.style.color = "black";
  statusDiv.textContent = "Wysyłanie...";

  // Przygotowanie danych do wysyłki
  const formData = new FormData();
  formData.append("file", file);

  try {
    const response = await fetch('http://127.0.0.1:8080/api/images/upload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${currentUser.token}`
      },
      body: formData
    });

    if (response.ok) {
      statusDiv.style.color = "green";
      statusDiv.textContent = "✅ Zdjęcie wysłane i dodane do kolejki!";
      fileInput.value = ""; // czyścimy input
    } else {
      throw new Error(await response.text());
    }
  } catch (error) {
    statusDiv.style.color = "red";
    statusDiv.textContent = "Błąd serwera: " + error.message;
  }
});
