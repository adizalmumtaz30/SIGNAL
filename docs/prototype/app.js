(() => {
  const toast = document.getElementById("toast");
  let toastTimer;
  function notify(message) {
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 2400);
  }

  document.querySelectorAll("[data-action]").forEach((button) => {
    button.addEventListener("click", () => notify(`${button.dataset.action} — contoh aksi antarmuka siap dihubungkan ke backend.`));
  });

  document.querySelectorAll(".side-nav .nav-link").forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      document.querySelectorAll(".side-nav .nav-link").forEach((item) => item.classList.remove("active"));
      link.classList.add("active");
      notify(`Menu ${link.innerText.trim()} dipilih.`);
    });
  });

  const themeButton = document.getElementById("themeBtn");
  themeButton?.addEventListener("click", () => {
    document.body.classList.toggle("dark");
    notify(document.body.classList.contains("dark") ? "Mode gelap aktif." : "Mode terang aktif.");
  });

  document.getElementById("notifyBtn")?.addEventListener("click", () => {
    notify("Tidak ada notifikasi baru.");
  });

  const search = document.getElementById("globalSearch");
  document.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      search?.focus();
    }
    if (event.key === "Escape" && document.activeElement === search) {
      search.value = "";
      search.blur();
    }
  });
  search?.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && search.value.trim()) {
      notify(`Pencarian: ${search.value.trim()}`);
    }
  });

  const attendanceFilter = document.getElementById("attendanceFilter");
  attendanceFilter?.addEventListener("click", () => {
    attendanceFilter.textContent = attendanceFilter.textContent.includes("Hari Ini") ? "Minggu Ini⌄" : "Hari Ini⌄";
    notify(`Filter presensi: ${attendanceFilter.textContent.replace("⌄", "")}.`);
  });

  document.querySelectorAll('a[href="#"]').forEach((link) => {
    if (!link.classList.contains("nav-link")) {
      link.addEventListener("click", (event) => {
        event.preventDefault();
        notify(`${link.textContent.trim()} — tautan contoh.`);
      });
    }
  });
})();
