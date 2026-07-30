// document.getElementById('uploadImageBtn').addEventListener('click', async () => {
//   const fileInput = document.getElementById('imageInput');
//   const statusDiv = document.getElementById('uploadStatus');
//   const file = fileInput.files[0];
//
//   if (!file) {
//     alert("Wybierz plik!");
//     return;
//   }
//
//   // Walidacja nazwy: nazwa_wersja_wariant (np. szafka_1_2)
//   // Regex: sprawdzamy czy na końcu są dwa podkreślniki z liczbami
//   const fileNameParts = file.name.split('.');
//   const nameWithoutExt = fileNameParts[0];
//   const namePattern = /^(.+)_(\d+)_(\d+)$/;
//
//   if (!namePattern.test(nameWithoutExt)) {
//     statusDiv.style.color = "red";
//     statusDiv.textContent = "Błąd nazwy! Wymagany format: nazwa_wersja_wariant";
//     return;
//   }
//
//   statusDiv.style.color = "black";
//   statusDiv.textContent = "Wysyłanie...";
//
//   // Przygotowanie danych do wysyłki
//   const formData = new FormData();
//   formData.append("file", file);
//
//   try {
//     const response = await fetch('http://127.0.0.1:8080/api/images/upload', {
//       method: 'POST',
//       headers: {
//         'Authorization': `Bearer ${currentUser.token}`
//       },
//       body: formData
//     });
//
//     if (response.ok) {
//       statusDiv.style.color = "green";
//       statusDiv.textContent = "Zdjęcie wysłane i dodane do kolejki!";
//       fileInput.value = ""; // czyścimy input
//     } else {
//       throw new Error(await response.text());
//     }
//   } catch (error) {
//     statusDiv.style.color = "red";
//     statusDiv.textContent = "Błąd serwera: " + error.message;
//   }
// });
// Obsługa przycisku wgrywania wewnątrz zakładki edycji produktu
document.getElementById('p_uploadImageBtn').addEventListener('click', async () => {
  const fileInput = document.getElementById('p_imageInput');
  const nameId = document.getElementById('p_name_id').value; // Pobieramy name_id z formularza
  const files = fileInput.files;

  if (!nameId || nameId === "0") {
    alert("Najpierw wybierz produkt z listy lub zapisz go!");
    return;
  }
  if (files.length === 0) {
    alert("Wybierz pliki!");
    return;
  }

  // Tworzymy JEDNO FormData dla wszystkich plików, żeby nie blokować bazy SQLite w Ruście równoległymi zapytaniami
  const formData = new FormData();
  for (const file of files) {
    // Klucz może być "files" lub "file" - Rust przechodzi po prostu przez next_field() i ignoruje nazwę klucza
    formData.append("files", file);
  }

  try {
    // Wysyłamy żądanie do serwera Go
    const response = await fetch(`/api/admin/images/${nameId}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${currentUser.token}` },
      body: formData // Przeglądarka sama ustawi nagłówek Content-Type wraz z boundary, nie wpisuj go ręcznie!
    });

    if (response.ok) {
      const data = await response.json();
      console.log("Serwer przyjął pliki:", data);
      alert("Zdjęcia zostały pomyślnie przesłane na serwer!");
      fileInput.value = "";
    } else {
      // Zamiast throw – bezpośrednia obsługa błędu
      const errorText = await response.text();
      alert(`Błąd serwera (${response.status}): ${errorText || 'Brak szczegółów'}`);
    }

  } catch (error) {
    // Catch przechwytuje teraz TYLKO błędy sieciowe/techniczne (brak połączenia itp.)
    console.error("Błąd połączenia/sieci:", error);
    alert(`Wystąpił błąd sieci: ${error.message}`);
  }

});
document.getElementById('uploadImageBtn').addEventListener('click', async () => {
  const fileInput = document.getElementById('imageInput');
  const statusDiv = document.getElementById('uploadStatus');
  const files = fileInput.files; // Pobieramy listę wszystkich plików

  if (files.length === 0) {
    alert("Wybierz przynajmniej jeden plik!");
    return;
  }

  // Definiujemy dozwolone rozszerzenia
  const allowedExtensions = ['jpg', 'jpeg', 'png', 'webp', 'avif'];
  const namePattern = /^(.+)_(\d+)_(\d+)$/;

  statusDiv.style.color = "black";
  statusDiv.innerHTML = "Przetwarzanie plików...<br>";

  let successCount = 0;
  let failCount = 0;

  // Przechodzimy pętlą przez każdy wybrany plik
  for (const file of files) {
    const fileNameParts = file.name.split('.');
    const extension = fileNameParts.pop().toLowerCase(); // Wyciągamy rozszerzenie
    const nameWithoutExt = fileNameParts.join('.'); // Łączymy resztę, na wypadek kropek w nazwie

    // 1. Walidacja rozszerzenia
    if (!allowedExtensions.includes(extension)) {
      statusDiv.style.color = "red";
      statusDiv.innerHTML += `Snajper: pominięto plik "${file.name}" (niepoprawne rozszerzenie).<br>`;
      failCount++;
      continue; // Przechodzimy do kolejnego pliku
    }

    // 2. Walidacja wzorca nazwy
    if (!namePattern.test(nameWithoutExt)) {
      statusDiv.style.color = "red";
      statusDiv.innerHTML += `Pominięto plik "${file.name}": wymagany format to nazwa_wersja_wariant.<br>`;
      failCount++;
      continue;
    }

    // Przygotowanie danych do wysyłki konkretnego pliku
    const formData = new FormData();
    formData.append("file", file);

    try {
      statusDiv.innerHTML += `Wysyłanie: "${file.name}"...<br>`;

      const response = await fetch('/api/admin/images/', { //tutaj po upload/ ma być name_id przedmiotu, który jest edytowany
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${currentUser.token}`
        },
        body: formData
      });

      if (response.ok) {
        successCount++;
      } else {
        // Wyciągamy treść i przechodzimy do bloku catch lub obsługujemy lokalnie
        const errorText = await response.text();
        statusDiv.style.color = "red";
        statusDiv.innerHTML += `Błąd wysyłania pliku "${file.name}": ${errorText || response.statusText}<br>`;
        failCount++;
      }
    } catch (error) {
      // Blok catch obsłuży wyłącznie awarię sieci
      statusDiv.style.color = "red";
      statusDiv.innerHTML += `Błąd połączenia dla "${file.name}": ${error.message}<br>`;
      failCount++;
    }
  }

  // Podsumowanie operacji po zakończeniu pętli
  if (failCount === 0) {
    statusDiv.style.color = "green";
    statusDiv.innerHTML = `Sukces! Pomyślnie wysłano wszystkie pliki (${successCount}).`;
    fileInput.value = ""; // Czyszczenie inputu tylko, gdy wszystko poszło gładko
  } else {
    statusDiv.style.color = successCount > 0 ? "orange" : "red";
    statusDiv.innerHTML += `<br><b>Podsumowanie:</b> Wysłano: ${successCount}, Błędy: ${failCount}.`;
  }
});